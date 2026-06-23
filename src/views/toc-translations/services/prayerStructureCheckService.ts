import { doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp, isProdConfigured } from "../../../firebase_config";
import { getProdFirestore } from "./prodAuthService";

export type PrayerStructureStatus = {
    stageExists: boolean;
    prodExists: boolean | null;
    /** false כשפרוד לא מוגדר או שלא ניתן היה לבדוק */
    prodChecked: boolean;
};

export function getStageFirestore(): Firestore {
    return getFirestore(getFirebaseApp());
}

export function prayerFirestorePath(translationId: string, prayerId: string): string {
    return `translations/${translationId}/prayers/${prayerId}`;
}

export async function checkPrayerDocumentExists(
    db: Firestore,
    translationId: string,
    prayerId: string
): Promise<boolean> {
    if (!translationId || !prayerId) return false;
    const ref = doc(db, "translations", translationId, "prayers", prayerId);
    const snap = await getDoc(ref);
    return snap.exists();
}

export async function checkPrayerStructureStatus(
    baseTranslationId: string,
    prayerId: string,
    options?: { checkProd?: boolean }
): Promise<PrayerStructureStatus> {
    const stageDb = getStageFirestore();
    const stageExists = await checkPrayerDocumentExists(
        stageDb,
        baseTranslationId,
        prayerId
    );

    const shouldCheckProd = options?.checkProd !== false && isProdConfigured();
    if (!shouldCheckProd) {
        return { stageExists, prodExists: null, prodChecked: false };
    }

    try {
        const prodDb = getProdFirestore();
        const prodExists = await checkPrayerDocumentExists(
            prodDb,
            baseTranslationId,
            prayerId
        );
        return { stageExists, prodExists, prodChecked: true };
    } catch {
        return { stageExists, prodExists: null, prodChecked: false };
    }
}

export function buildPrayerStructureWarning(
    prayerName: string,
    prayerId: string,
    status: PrayerStructureStatus
): string | null {
    if (!status.stageExists) {
        return `תפילה «${prayerName}» (${prayerId}) מופיעה בתוכן העניינים, אך אין לה מסמך ב-Firestore בסטייג' (translations/.../prayers). עריכת חלקים ופריטים עלולה להיכשל.`;
    }
    if (status.prodChecked && status.prodExists === false) {
        return `תפילה «${prayerName}» (${prayerId}) קיימת בסטייג' אך חסרה בפרוד. יש לבצע «שמור מבנה · פרוד» (ויש לוודא שמסמך התפילה נכלל בסנכרון) לפני פרסום.`;
    }
    return null;
}
