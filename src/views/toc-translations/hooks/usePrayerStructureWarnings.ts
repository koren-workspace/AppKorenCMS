import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getAuth } from "firebase/auth";
import { getProdFirebaseApp, isProdConfigured } from "../../../firebase_config";
import {
    buildPrayerStructureWarning,
    checkPrayerStructureStatus,
} from "../services/prayerStructureCheckService";
import { isProdAuthenticated } from "../services/prodAuthService";

type UsePrayerStructureWarningsParams = {
    baseTranslationId: string | null;
    selectedPrayerId: string | null;
    currentPrayers: Array<{ id?: string; name?: string }>;
};

export function usePrayerStructureWarnings({
    baseTranslationId,
    selectedPrayerId,
    currentPrayers,
}: UsePrayerStructureWarningsParams) {
    const [selectedWarning, setSelectedWarning] = useState<string | null>(null);
    const [prayersMissingInStage, setPrayersMissingInStage] = useState<Set<string>>(
        new Set()
    );
    const [prayersMissingInProd, setPrayersMissingInProd] = useState<Set<string>>(
        new Set()
    );
    const [prayersNeedProdAuth, setPrayersNeedProdAuth] = useState<Set<string>>(
        new Set()
    );
    const [prodAuthTick, setProdAuthTick] = useState(0);
    const checkGenRef = useRef(0);

    useEffect(() => {
        if (!isProdConfigured()) return;
        const auth = getAuth(getProdFirebaseApp());
        return onAuthStateChanged(auth, () => {
            setProdAuthTick((t) => t + 1);
        });
    }, []);

    const prayerNameById = useMemo(() => {
        const map = new Map<string, string>();
        currentPrayers.forEach((p) => {
            if (p?.id) map.set(String(p.id), String(p.name ?? p.id));
        });
        return map;
    }, [currentPrayers]);

    const prayerIdsKey = useMemo(
        () =>
            currentPrayers
                .map((p) => String(p.id ?? ""))
                .filter(Boolean)
                .join(","),
        [currentPrayers]
    );

    useEffect(() => {
        if (!baseTranslationId || !selectedPrayerId) {
            setSelectedWarning(null);
            return;
        }

        let cancelled = false;
        const prayerId = selectedPrayerId;
        const prayerName = prayerNameById.get(prayerId) ?? prayerId;

        (async () => {
            const status = await checkPrayerStructureStatus(
                baseTranslationId,
                prayerId,
                { checkProd: isProdConfigured() }
            );
            if (cancelled) return;
            setSelectedWarning(buildPrayerStructureWarning(prayerName, prayerId, status));
        })();

        return () => {
            cancelled = true;
        };
    }, [baseTranslationId, selectedPrayerId, prayerNameById, prodAuthTick]);

    useEffect(() => {
        if (!baseTranslationId || !prayerIdsKey) {
            setPrayersMissingInStage(new Set());
            setPrayersMissingInProd(new Set());
            setPrayersNeedProdAuth(new Set());
            return;
        }

        const gen = ++checkGenRef.current;
        const prayerIds = prayerIdsKey.split(",").filter(Boolean);

        (async () => {
            const missingStage = new Set<string>();
            const missingProd = new Set<string>();
            const needAuth = new Set<string>();

            await Promise.all(
                prayerIds.map(async (prayerId) => {
                    const status = await checkPrayerStructureStatus(
                        baseTranslationId,
                        prayerId,
                        { checkProd: isProdConfigured() }
                    );
                    if (gen !== checkGenRef.current) return;
                    if (!status.stageExists) missingStage.add(prayerId);
                    if (status.prodChecked && status.prodExists === false) {
                        missingProd.add(prayerId);
                    }
                    if (status.prodNeedsAuth && status.stageExists) {
                        needAuth.add(prayerId);
                    }
                })
            );

            if (gen !== checkGenRef.current) return;
            setPrayersMissingInStage(missingStage);
            setPrayersMissingInProd(missingProd);
            setPrayersNeedProdAuth(needAuth);
        })();

        return () => {
            checkGenRef.current += 1;
        };
    }, [baseTranslationId, prayerIdsKey, prodAuthTick]);

    return {
        selectedWarning,
        prayersMissingInStage,
        prayersMissingInProd,
        prayersNeedProdAuth,
        // בלי הגדרות פרוד אתחול אפליקציית הפרוד נכשל ב-getAuth, ולכן חייבים
        // לבדוק תחילה שפרוד מוגדר – כמו בכל שאר הקריאות לפרוד בקוד
        isProdAuthenticated: isProdConfigured() ? isProdAuthenticated() : false,
    };
}
