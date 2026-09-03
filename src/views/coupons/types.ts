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

/**
 * מזהי המוצרים של קטלוג המודים בפרוד (Google Play / App Store), כפי שהם
 * ב-Bagel `enhancments/items` ב-2026-09. הרשימה קבועה כאן עד שהקטלוג יעבור
 * ל-FireCMS – אז מקשרים אליו במקום.
 */
export const STORE_PRODUCTS: ReadonlyArray<{ id: string; label: string }> = [
    { id: "prep10", label: "הכנה לתפילה" },
    { id: "prep20", label: "הכנה לתפילה" },
    { id: "prep30", label: "הכנה לתפילה" },
    { id: "autoview10", label: "תפילה מכוונת" },
    { id: "translations10", label: "תרגום לאנגלית" },
    { id: "translations20", label: "תרגום לאנגלית" },
    { id: "commentary10", label: "פירוש באנגלית" },
    { id: "commentary20", label: "פירוש בעברית" },
    { id: "commentary30", label: "פירוש באנגלית" },
    { id: "commentary40", label: "פירוש בעברית" },
];
