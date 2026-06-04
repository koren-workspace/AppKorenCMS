/**
 * טיפוסים למחסן פריטים – snapshot מלא ליצירת עותקים חדשים דרך לוגיקת ההעתקה.
 */

export const ITEM_WAREHOUSE_SCHEMA_VERSION = 2;

/** עותק של פריט בודד (ערכי מסמך בלבד + מזהה entity לתצוגה/דיבוג) */
export type WarehouseItemSnapshot = {
    entityId: string;
    values: Record<string, any>;
};

/** מטא־דאטה של מקור השמירה – לתצוגה ורענון אופציונלי */
export type WarehouseSourceMeta = {
    /** מזהה הנוסח שממנו נשמר ה-snapshot (שדה חובה למיפוי enhancements בין נוסחים) */
    sourceTocId: string;
    /** נשמר לתאימות לאחור מול רשומות v1 */
    tocId: string;
    translationId: string;
    prayerId: string;
    partId: string;
    itemIds: string[];
    tocName?: string;
    prayerName?: string;
    partName?: string;
};

/** רשומה אחת במחסן */
export type WarehouseEntry = {
    id: string;
    schemaVersion: number;
    /** שם לתצוגה (ברירת מחדל: תחילת התוכן) */
    label: string;
    savedAt: number;
    /** האם ביצירה מהמחסן להעתיק גם תרגומים מקושרים */
    copyLinkedTranslations: boolean;
    sourceMeta: WarehouseSourceMeta;
    /** פריטי בסיס (בדרך כלל פריט אחד) */
    baseItems: WarehouseItemSnapshot[];
    /** תרגומים מקושרים לפי translationId */
    enhancementsByTranslationId: Record<string, WarehouseItemSnapshot[]>;
};

/** בחירת קבוצות שדות בהדבקה מהמחסן */
export type WarehouseFieldSelection = {
    content: boolean;
    type: boolean;
    title: boolean;
    style: boolean;
    roleMeta: boolean;
    dateSetId: boolean;
    copyLinkedTranslations: boolean;
};

export const DEFAULT_WAREHOUSE_FIELD_SELECTION: WarehouseFieldSelection = {
    content: true,
    type: true,
    title: true,
    style: true,
    roleMeta: true,
    dateSetId: true,
    copyLinkedTranslations: true,
};
