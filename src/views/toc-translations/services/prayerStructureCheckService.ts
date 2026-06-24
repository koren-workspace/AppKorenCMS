import { doc, getDoc, getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp, isProdConfigured } from "../../../firebase_config";
import { getProdFirestore, isProdAuthenticated } from "./prodAuthService";

export type PrayerStructureStatus = {
    stageExists: boolean;
    prodExists: boolean | null;
    /** false כשפרוד לא מוגדר או שלא ניתן היה לבדוק */
    prodChecked: boolean;
    /** יש לבדוק פרוד אך אין סשן / אין הרשאת קריאה */
    prodNeedsAuth: boolean;
};

function isPermissionDeniedError(err: unknown): boolean {
    const code = (err as { code?: string })?.code;
    return code === "permission-denied" || code === "unauthenticated";
}

export function getStageFirestore(): Firestore {
    return getFirestore(getFirebaseApp());
}

export function prayerFirestorePath(translationId: string, prayerId: string): string {
    return `translations/${translationId}/prayers/${prayerId}`;
}

/** מסמך עם deleted:true נחשב חסר — כמו במסנן TOC ובאפליקציה */
export function isSoftDeletedPrayer(values: Record<string, unknown> | undefined): boolean {
    if (!values) return false;
    const deleted = values.deleted;
    return deleted === true || deleted === "true" || deleted === 1;
}

export async function checkPrayerDocumentExists(
    db: Firestore,
    translationId: string,
    prayerId: string
): Promise<boolean> {
    if (!translationId || !prayerId) return false;
    const ref = doc(db, "translations", translationId, "prayers", prayerId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    return !isSoftDeletedPrayer(snap.data() as Record<string, unknown>);
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
        return {
            stageExists,
            prodExists: null,
            prodChecked: false,
            prodNeedsAuth: false,
        };
    }

    if (!isProdAuthenticated()) {
        return {
            stageExists,
            prodExists: null,
            prodChecked: false,
            prodNeedsAuth: true,
        };
    }

    try {
        const prodDb = getProdFirestore();
        const prodExists = await checkPrayerDocumentExists(
            prodDb,
            baseTranslationId,
            prayerId
        );
        return {
            stageExists,
            prodExists,
            prodChecked: true,
            prodNeedsAuth: false,
        };
    } catch (err) {
        return {
            stageExists,
            prodExists: null,
            prodChecked: false,
            prodNeedsAuth: isPermissionDeniedError(err),
        };
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
    if (status.prodNeedsAuth && status.stageExists && isProdConfigured()) {
        return `תפילה «${prayerName}» (${prayerId}) — לא ניתן לבדוק אם היא קיימת בפרוד ללא התחברות. התחבר דרך «שמור · פרוד» או «שמור מבנה · פרוד», ואז בחר שוב את התפילה.`;
    }
    return null;
}
