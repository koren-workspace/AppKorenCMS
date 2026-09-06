/**
 * app-flags – שלושת דגלי השרת של האפליקציה, במסמך Firestore אחד:
 * `app-config/flags`.
 *
 * האפליקציה החדשה קוראת את המסמך הזה (koren-tefilla,
 * services/remote/firestoreFlags.ts). האפליקציות הישנות עדיין קוראות את
 * שלוש הקולקציות ב-Bagel (`clearTime`, `appPreferences`, `minAppVersion`),
 * ולכן כל שמירה כאן משוקפת ל-Bagel דרך /api/bagel/flags. Bagel לא נערך
 * ידנית יותר.
 */

export type FlagsEnv = "stage" | "prod";

export type AppFlags = {
    /** חותמת זמן (ms) של פקודת מחיקת תוכן מקומי; null = אין */
    clearTime: number | null;
    /** true = כל המודים חינם (בלי חיוב); false = בתשלום */
    freeEnhancements: boolean;
    /** מספר build מינימלי לכל פלטפורמה; null = אין חסימה */
    minAppVersion: { android: number | null; ios: number | null };
};

/** מה שמסך משקף ל-Bagel אחרי שמירה, לפי קולקציה */
export type MirrorResult = Record<string, "ok" | "error">;
