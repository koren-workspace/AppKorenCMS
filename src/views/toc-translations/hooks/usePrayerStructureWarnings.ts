import { useEffect, useMemo, useRef, useState } from "react";
import { isProdConfigured } from "../../../firebase_config";
import {
    buildPrayerStructureWarning,
    checkPrayerStructureStatus,
} from "../services/prayerStructureCheckService";

type UsePrayerStructureWarningsParams = {
    baseTranslationId: string | null;
    selectedPrayerId: string | null;
    currentPrayers: Array<{ id?: string; name?: string }>;
    prodFeatureEnabled: boolean;
};

export function usePrayerStructureWarnings({
    baseTranslationId,
    selectedPrayerId,
    currentPrayers,
    prodFeatureEnabled,
}: UsePrayerStructureWarningsParams) {
    const [selectedWarning, setSelectedWarning] = useState<string | null>(null);
    const [prayersMissingInStage, setPrayersMissingInStage] = useState<Set<string>>(
        new Set()
    );
    const [prayersMissingInProd, setPrayersMissingInProd] = useState<Set<string>>(
        new Set()
    );
    const checkGenRef = useRef(0);

    const prayerNameById = useMemo(() => {
        const map = new Map<string, string>();
        currentPrayers.forEach((p) => {
            if (p?.id) map.set(String(p.id), String(p.name ?? p.id));
        });
        return map;
    }, [currentPrayers]);

    useEffect(() => {
        if (!baseTranslationId || !selectedPrayerId || !prodFeatureEnabled) {
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
    }, [baseTranslationId, selectedPrayerId, prodFeatureEnabled, prayerNameById]);

    useEffect(() => {
        if (!baseTranslationId || !prodFeatureEnabled || currentPrayers.length === 0) {
            setPrayersMissingInStage(new Set());
            setPrayersMissingInProd(new Set());
            return;
        }

        const gen = ++checkGenRef.current;
        const prayerIds = currentPrayers
            .map((p) => String(p.id ?? ""))
            .filter(Boolean);

        (async () => {
            const missingStage = new Set<string>();
            const missingProd = new Set<string>();

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
                })
            );

            if (gen !== checkGenRef.current) return;
            setPrayersMissingInStage(missingStage);
            setPrayersMissingInProd(missingProd);
        })();

        return () => {
            checkGenRef.current += 1;
        };
    }, [baseTranslationId, currentPrayers, prodFeatureEnabled]);

    return {
        selectedWarning,
        prayersMissingInStage,
        prayersMissingInProd,
    };
}
