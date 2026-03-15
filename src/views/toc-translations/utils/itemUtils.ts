/**
 * itemUtils – פונקציות עזר לפריטים במסך העריכה
 *
 * - chunkArray: פיצול מערך לחלקים (למשל 30) – נדרש ל-Firestore (array-contains-any מוגבל)
 * - getItemStyle: classNames ל-textarea לפי סוג הפריט (title / instructions / body)
 * - mitIdBetween: מחשב ערך mit_id חדש בין שני ערכים קיימים
 */

const MIT_ID_GAP = 10;

/**
 * מחשב ערך mit_id בין idBefore ל-idAfter.
 * - בין שני ערכים: ממוצע (חצי ביניהם).
 * - רק לפני: idAfter - GAP (הוספה בהתחלה).
 * - רק אחרי: idBefore + GAP (הוספה בסוף).
 * - אין אף אחד: "0".
 */
export function mitIdBetween(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined
): string {
    const before = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
    const after = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;
    if (!Number.isNaN(before) && !Number.isNaN(after)) {
        const mid = (before + after) / 2;
        return mid === Math.floor(mid) ? String(Math.floor(mid)) : String(mid);
    }
    if (!Number.isNaN(before)) return String(before + MIT_ID_GAP);
    if (!Number.isNaN(after)) return String(after - MIT_ID_GAP);
    return "0";
}

/**
 * פיצול מערך לחלקים (chunks) בגודל קבוע.
 * משמש לטעינת פריטים מקושרים במנות (למשל 30 בכל פעם).
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
    return Array.from(
        { length: Math.ceil(arr.length / size) },
        (_, i) => arr.slice(i * size, i * size + size)
    );
}

/**
 * מחזיר מחרוזת classNames ל־textarea של פריט (תוכן / כותרת / הוראות).
 * type: "title" | "instructions" | אחר = body
 */
export function getItemStyle(
    type: string,
    titleType?: string,
    fontTanach?: boolean
): string {
    let baseStyle =
        "w-full p-4 border rounded-b-md shadow-sm outline-none transition-all ";
    if (fontTanach)
        baseStyle += "font-serif text-2xl border-r-8 border-amber-200 pr-4 ";
    else baseStyle += "font-sans text-lg ";

    if (type === "title")
        return baseStyle + "font-bold bg-gray-50 border-r-4 border-gray-400";
    if (type === "instructions")
        return baseStyle + "text-base italic text-blue-700 bg-blue-50/50";
    return baseStyle + "leading-relaxed bg-white border-gray-200 min-h-[80px]";
}
