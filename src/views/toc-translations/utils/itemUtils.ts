/**
 * itemUtils – פונקציות עזר לפריטים במסך העריכה
 *
 * - chunkArray: פיצול מערך לחלקים (למשל 30) – נדרש ל-Firestore (array-contains-any מוגבל)
 * - getItemStyle: classNames ל-textarea לפי סוג הפריט (title / instructions / body)
 * - mitIdBetween: מחשב ערך mit_id חדש בין שני ערכים קיימים
 * - computeNextAvailableItemId: מחשב itemId חדש פנוי בין שני ערכים, עם decimal fallback
 * - computeItemIdForInsert: פונקציה מרכזית – מחשבת idBefore/idAfter/takenIds מרשימה ממוינת + מיקום
 */

const MIT_ID_GAP = 1000;

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
 * מחשב itemId חדש בין idBefore ל-idAfter שלא קיים ב-takenIds.
 *
 * אלגוריתם:
 * 1. mitIdBetween(idBefore, idAfter) → ערך התחלתי (ממוצע / +GAP / -GAP).
 * 2. אם הערך תפוס → ממשיך +1 עד שמוצא פנוי.
 * 3. אם +1 חורג מ-idAfter → מנסה ערכים עשרוניים (0.5, 0.25, 0.75...) בין idBefore ל-idAfter.
 * 4. אם אף ערך עשרוני לא פנוי → זורק NO_SPACE_BETWEEN_ITEMS.
 *
 * onAboutToTryDecimals – callback שנקרא לפני ניסיון ערכים עשרוניים (להודעת UI).
 */
export const NO_SPACE_BETWEEN_ITEMS = "NO_SPACE_BETWEEN_ITEMS";

const DECIMAL_OFFSETS = [0.5, 0.25, 0.75, 0.125, 0.375, 0.625, 0.875];

export function computeNextAvailableItemId(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined,
    takenIds: Set<string>,
    onAboutToTryDecimals?: () => void
): string {
    let result = mitIdBetween(idBefore ?? undefined, idAfter ?? undefined);
    const idBeforeNum = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
    const idAfterNum = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;

    const tryDecimalSlot = (value: number): string | null => {
        const s = value === Math.floor(value) ? `${value}` : String(value);
        return !takenIds.has(s) ? s : null;
    };

    while (takenIds.has(result)) {
        const nextNum = (Number(result) || 0) + 1;
        if (!Number.isNaN(idAfterNum) && nextNum >= idAfterNum) {
            onAboutToTryDecimals?.();
            let fallbackStr: string | null = null;
            if (!Number.isNaN(idBeforeNum) && idBeforeNum < idAfterNum) {
                for (const o of DECIMAL_OFFSETS) {
                    const v = idBeforeNum + o;
                    if (v < idAfterNum) {
                        fallbackStr = tryDecimalSlot(v);
                        if (fallbackStr) break;
                    }
                }
            }
            if (!fallbackStr && !Number.isNaN(idAfterNum)) {
                for (const o of DECIMAL_OFFSETS) {
                    const v = idAfterNum - o;
                    if (Number.isNaN(idBeforeNum) || v > idBeforeNum) {
                        fallbackStr = tryDecimalSlot(v);
                        if (fallbackStr) break;
                    }
                }
            }
            if (!fallbackStr) throw new Error(NO_SPACE_BETWEEN_ITEMS);
            result = fallbackStr;
            break;
        }
        result = String(nextNum);
    }
    return result;
}

// ─── Centralized insert helper ──────────────────────────────────────────────

export interface InsertNeighborBounds {
    prevLastItemId?: string;
    nextFirstItemId?: string;
}

export interface ComputeItemIdForInsertOptions {
    neighborBounds?: InsertNeighborBounds;
    extraTakenIds?: string[];
    /**
     * IDs מקושרים (תרגומים/enhancements) לכל מיקום ברשימה.
     * linkedIdsPerPosition[i] = מערך IDs של תרגומים המקושרים ל-orderedItemIds[i].
     *
     * כשסופק:
     * - idBefore = MAX של כל ה-IDs (בסיס + מקושרים) *מעל* מיקום ההוספה
     * - idAfter  = MIN של כל ה-IDs (בסיס + מקושרים) *מתחת* למיקום ההוספה
     * - כל ה-IDs המקושרים מתווספים ל-takenIds
     *
     * כשלא סופק: idBefore/idAfter נלקחים מהשכן הישיר (מתאים ל-reorder).
     */
    linkedIdsPerPosition?: string[][];
    /**
     * ערך מינימלי ל-idBefore – מבטיח שה-ID החדש יהיה >= minIdBefore.
     * שימוש: כשתרגום חייב לקבל itemId >= itemId של פריט הבסיס.
     */
    minIdBefore?: string;
    onAboutToTryDecimals?: () => void;
}

/**
 * מחשב itemId חדש בהתבסס על רשימה ממוינת של IDs קיימים + מיקום הוספה.
 *
 * מצב פשוט (ללא linkedIdsPerPosition):
 *   idBefore/idAfter = השכנים הישירים ב-orderedItemIds.
 *
 * מצב עם תרגומים (linkedIdsPerPosition סופק):
 *   idBefore = MAX של כל ה-IDs (בסיס + תרגומים) מעל ← הפריט החדש יוכנס *אחרי* כל התרגומים
 *   idAfter  = MIN של כל ה-IDs מתחת ← הפריט לא ייכנס *בתוך* קבוצת תרגומים
 *
 * minIdBefore: אילוץ תחתון (למשל baseItemId של תרגום).
 * neighborBounds: fallback כשהמיקום בקצה הרשימה.
 * extraTakenIds: IDs נוספים שיתווספו ל-takenIds (deleted, pending וכו').
 */
export function computeItemIdForInsert(
    orderedItemIds: string[],
    insertIndex: number,
    options?: ComputeItemIdForInsertOptions
): string {
    const { neighborBounds, extraTakenIds, linkedIdsPerPosition, minIdBefore, onAboutToTryDecimals } = options ?? {};

    let idBefore: string | null = null;
    let idAfter: string | null = null;

    if (linkedIdsPerPosition) {
        // Enhancement-aware: MAX above / MIN below (including linked IDs)
        const above: string[] = [];
        for (let i = 0; i < insertIndex; i++) {
            const id = orderedItemIds[i];
            if (id) above.push(id);
            const linked = linkedIdsPerPosition[i];
            if (linked) for (const lid of linked) if (lid) above.push(lid);
        }
        const below: string[] = [];
        for (let i = insertIndex; i < orderedItemIds.length; i++) {
            const id = orderedItemIds[i];
            if (id) below.push(id);
            const linked = linkedIdsPerPosition[i];
            if (linked) for (const lid of linked) if (lid) below.push(lid);
        }
        if (above.length > 0) idBefore = above.reduce((a, b) => (Number(a) >= Number(b) ? a : b));
        if (below.length > 0) idAfter = below.reduce((a, b) => (Number(a) <= Number(b) ? a : b));
    } else {
        // Simple: direct neighbors (scan for first non-empty)
        for (let i = insertIndex - 1; i >= 0; i--) {
            if (orderedItemIds[i]) { idBefore = orderedItemIds[i]; break; }
        }
        for (let i = insertIndex; i < orderedItemIds.length; i++) {
            if (orderedItemIds[i]) { idAfter = orderedItemIds[i]; break; }
        }
    }

    // Neighbor-bounds fallback (edges of part)
    if (idBefore == null && neighborBounds?.prevLastItemId) idBefore = neighborBounds.prevLastItemId;
    if (idAfter == null && neighborBounds?.nextFirstItemId) idAfter = neighborBounds.nextFirstItemId;

    // Minimum idBefore constraint (e.g. translation itemId >= base itemId)
    if (minIdBefore != null && minIdBefore !== "") {
        const minNum = Number(minIdBefore);
        if (!Number.isNaN(minNum)) {
            const beforeNum = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
            if (Number.isNaN(beforeNum) || beforeNum < minNum) idBefore = minIdBefore;
            const afterNum = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;
            if (!Number.isNaN(afterNum) && afterNum <= minNum) idAfter = null;
        }
    }

    // Build takenIds
    const takenIds = new Set<string>();
    for (const id of orderedItemIds) if (id) takenIds.add(id);
    if (linkedIdsPerPosition) {
        for (const linked of linkedIdsPerPosition) {
            if (linked) for (const lid of linked) if (lid) takenIds.add(lid);
        }
    }
    if (extraTakenIds) {
        for (const id of extraTakenIds) if (id) takenIds.add(id);
    }

    return computeNextAvailableItemId(idBefore, idAfter, takenIds, onAboutToTryDecimals);
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
