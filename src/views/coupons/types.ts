/**
 * coupons – טיפוסי הנתונים של קולקציית `coupons` ב-Firestore.
 *
 * מסמך אחד לכל קופון. מזהה המסמך = SHA-256 של הקוד המנורמל (ראו codes.ts).
 * הקוד הקריא עצמו לא נשמר בשום מקום בשרת: הוא מוצג פעם אחת ביצירה, ומי
 * שמחזיק בו יכול למצוא את המסמך; מי שלא – לא (החוקים אוסרים list).
 *
 * האפליקציה (koren-tefilla, services/remote/coupons.ts) קוראת מסמך אחד לפי
 * ה-hash עם משתמש אנונימי, ומבצעת כתיבה אחת בלבד: הצבת `usedAt`. החוקים
 * מאפשרים את הכתיבה הזו רק לקופון פעיל, בתוקף ושטרם נוצל – זו ערובת
 * ה"חד-פעמי", והיא בשרת.
 */

export type CouponEnv = "stage" | "prod";

export type CouponDoc = {
    /** מזהה המסמך – ה-hash של הקוד */
    id: string;
    /** תווית פנימית (קמפיין / מקבל) – לא מוצגת למשתמש */
    name: string;
    /** מזהי מוצר בחנות (prep30, commentary10…) – מה שהקופון מעניק */
    storeIds: string[];
    /** תאריך תפוגה (חובה) */
    expiresAt: Date | null;
    /** מתג כיבוי ידני */
    active: boolean;
    /** מועד הניצול; null = טרם נוצל */
    usedAt: Date | null;
    /** מועד היצירה */
    createdAt: Date | null;
};

/** מה שנדרש כדי ליצור קופון (ה-hash מחושב מהקוד ב-codes.ts) */
export type NewCoupon = {
    codeHash: string;
    name: string;
    storeIds: string[];
    expiresAt: Date;
    active: boolean;
};

/** מוצר לבחירה במסך: מזהה חנות + תווית קריאה (כותרת, מחבר, נוסח) */
export type CouponProduct = { id: string; title: string; detail: string; nusach: string };

/**
 * רשימת גיבוי – מזהי המוצרים של הקטלוג בפרוד (Google Play / App Store), כפי
 * שהיו ב-Bagel ב-2026-09. המסך טוען את המוצרים מקולקציית `catalog` ב-Firestore
 * של הסביבה; הרשימה הזו משמשת רק כשהקולקציה עדיין ריקה שם.
 */
export const STORE_PRODUCTS: ReadonlyArray<CouponProduct> = [
    { id: "prep30", title: "הכנה לתפילה", detail: "הרב דוד אהרון (אנגלית)", nusach: "כל הנוסחים" },
    { id: "prep20", title: "הכנה לתפילה", detail: "הרב דניאל כהן (עברית)", nusach: "כל הנוסחים" },
    { id: "prep10", title: "הכנה לתפילה", detail: "הרב יוני לביא (עברית)", nusach: "כל הנוסחים" },
    { id: "autoview10", title: "תפילה מכוונת", detail: "חלוקה למילה/ביטוי", nusach: "כל הנוסחים" },
    { id: "commentary40", title: "פירוש בעברית", detail: "הרב יונתן זקס", nusach: "ספרד" },
    { id: "commentary30", title: "פירוש באנגלית", detail: "הרב יונתן זקס", nusach: "ספרד" },
    { id: "commentary20", title: "פירוש בעברית", detail: "הרב יונתן זקס", nusach: "אשכנז" },
    { id: "commentary10", title: "פירוש באנגלית", detail: "הרב יונתן זקס", nusach: "אשכנז" },
    { id: "translations20", title: "תרגום לאנגלית", detail: "אנגלית", nusach: "אשכנז" },
    { id: "translations10", title: "תרגום לאנגלית", detail: "הרב יונתן זקס", nusach: "ספרד" },
];
