/**
 * itemUtils – פונקציות עזר לפריטים במסך העריכה
 *
 * - chunkArray: פיצול מערך לחלקים (למשל 30) – נדרש ל-Firestore (array-contains-any מוגבל)
 * - getItemStyle: classNames ל-textarea לפי סוג הפריט (title / instructions / body)
 * - idBetween: מחשב ערך mit_id חדש בין שני ערכים קיימים
 * - computeNextAvailableItemId: מחשב itemId חדש פנוי בין שני ערכים, עם decimal fallback
 * - computeItemIdForInsert: פונקציה מרכזית – מחשבת idBefore/idAfter/takenIds מרשימה ממוינת + מיקום
 *   (ברירת מחדל חדשה: עבודה בתוך מרחב IDs של הרשימה הנוכחית בלבד; linkedIdsPerPosition נשאר לתאימות)
 */

const MIT_ID_GAP = 1000;

/**
 * מחשב ערך mit_id בין idBefore ל-idAfter.
 * - בין שני ערכים: ממוצע (חצי ביניהם).
 * - רק לפני: idAfter - GAP (הוספה בהתחלה).
 * - רק אחרי: idBefore + GAP (הוספה בסוף).
 * - אין אף אחד: "0".
 */
const ID_LOG_PREFIX = "[CMS-ID]";

export function idBetween(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined
): string {
    const before = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
    const after = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;

    let result: string;
    let formula: string;

    if (!Number.isNaN(before) && !Number.isNaN(after)) {
        const mid = (before + after) / 2;
        result = mid === Math.floor(mid) ? String(Math.floor(mid)) : String(mid);
        formula = `(idBefore + idAfter) / 2 = (${before} + ${after}) / 2 = ${mid} ${mid === Math.floor(mid) ? "→ עיגול לשלם " + Math.floor(mid) : "→ נשאר עשרוני"}`;
    } else if (!Number.isNaN(before)) {
        result = String(before + MIT_ID_GAP);
        formula = `רק idBefore קיים → idBefore + MIT_ID_GAP = ${before} + ${MIT_ID_GAP} = ${result} (הוספה בסוף)`;
    } else if (!Number.isNaN(after)) {
        result = String(after - MIT_ID_GAP);
        formula = `רק idAfter קיים → idAfter - MIT_ID_GAP = ${after} - ${MIT_ID_GAP} = ${result} (הוספה בהתחלה)`;
    } else {
        result = "0";
        formula = "אין idBefore ואין idAfter → תוצאה \"0\"";
    }

    console.log(`${ID_LOG_PREFIX} ─── idBetween ───`);
    console.log(`${ID_LOG_PREFIX}   קלט: idBefore=${String(idBefore ?? "(ריק)")} idAfter=${String(idAfter ?? "(ריק)")}`);
    console.log(`${ID_LOG_PREFIX}   חישוב: ${formula}`);
    console.log(`${ID_LOG_PREFIX}   תוצאה: ${result}`);
    return result;
}

/**
 * מחשב itemId חדש בין idBefore ל-idAfter שלא קיים ב-takenIds.
 *
 * אלגוריתם:
 * 1. ממוצע מעוגל (אין מספרים עשרוניים כברירת מחדל).
 * 2. אם הערך תפוס → ממשיך +1 עד שמוצא פנוי.
 * 3. אם +1 חורג מ-idAfter: רק כשמדובר בשני מספרים צמודים (למשל 1 ו-2) – שואל את המשתמש
 *    האם ליצור מזהה .5. רק אם מאשר – מנסה .5. אם .5 תפוס – זורק NO_SPACE_BETWEEN_ITEMS.
 * 4. אם לא צמודים או המשתמש לא מאשר – זורק NO_SPACE_BETWEEN_ITEMS.
 *
 * confirmUserWantsDecimalId – callback שמחזיר true/false. נקרא רק כשיש שני מספרים צמודים.
 */
export const NO_SPACE_BETWEEN_ITEMS = "NO_SPACE_BETWEEN_ITEMS";

export interface ComputeNextAvailableItemIdOptions {
    /** נקרא כשצריך לשאול את המשתמש האם ליצור מזהה .5 בין שני מספרים צמודים. מחזיר true אם מאשר. */
    confirmUserWantsDecimalId?: () => boolean;
}

function getRoundedInitialItemId(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined
): string {
    const raw = idBetween(idBefore ?? undefined, idAfter ?? undefined);
    const num = Number(raw);
    const rounded = Number.isNaN(num) ? raw : String(Math.round(num));
    if (!Number.isNaN(num) && String(num) !== rounded) {
        console.log(`${ID_LOG_PREFIX}   getRoundedInitialItemId: ערך גולמי מ-idBetween=${raw} → עיגול למספר שלם=${rounded}`);
    }
    return rounded;
}

export function computeNextAvailableItemId(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined,
    takenIds: Set<string>,
    options?: ComputeNextAvailableItemIdOptions
): string {
    const confirmUserWantsDecimalId = options?.confirmUserWantsDecimalId;
    const takenArr = Array.from(takenIds).sort((a, b) => Number(a) - Number(b));

    console.log(`${ID_LOG_PREFIX} ─── computeNextAvailableItemId ───`);
    console.log(`${ID_LOG_PREFIX}   קלט: idBefore=${String(idBefore ?? "(ריק)")} idAfter=${String(idAfter ?? "(ריק)")} takenIds=${takenArr.length <= 30 ? JSON.stringify(takenArr) : `[${takenArr.length} IDs: ${takenArr.slice(0, 10).join(",")}...]`}`);

    let result = getRoundedInitialItemId(idBefore, idAfter);
    console.log(`${ID_LOG_PREFIX}   ערך התחלתי (מעוגל מ-idBetween): ${result}`);

    const idBeforeNum = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
    const idAfterNum = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;
    let step = 0;
    // די מיותר בגלל שלא יכול לקרות מקרה שבו יש  הID החדש תפוסם
    while (takenIds.has(result)) {
        step++;
        const nextNum = (Number(result) || 0) + 1;
        console.log(`${ID_LOG_PREFIX}   שלב ${step}: ${result} תפוס ב-takenIds → מנסה ${nextNum}`);
        if (!Number.isNaN(idAfterNum) && nextNum >= idAfterNum) {
            const isConsecutive = !Number.isNaN(idBeforeNum) && idAfterNum - idBeforeNum === 1;
            console.log(`${ID_LOG_PREFIX}   ${nextNum} >= idAfter(${idAfterNum}) → אין מקום. צמודים? ${isConsecutive} (idAfter-idBefore===1)`);
            if (isConsecutive) {
                const approved = confirmUserWantsDecimalId?.();
                if (!approved) throw new Error(NO_SPACE_BETWEEN_ITEMS);
                const decimalId = `${idBeforeNum + 0.5}`;
                if (takenIds.has(decimalId)) throw new Error(NO_SPACE_BETWEEN_ITEMS);
                console.log(`${ID_LOG_PREFIX}   משתמש אישר → מזהה עשרוני: ${decimalId}`);
                console.log(`${ID_LOG_PREFIX}   תוצאה סופית: ${decimalId} (עשרוני)`);
                return decimalId;
            }
            throw new Error(NO_SPACE_BETWEEN_ITEMS);
        }
        result = String(nextNum);
    }
    if (step > 0) {
        console.log(`${ID_LOG_PREFIX}   ${result} פנוי. תוצאה סופית: ${result}`);
    } else {
        console.log(`${ID_LOG_PREFIX}   תוצאה סופית: ${result} (לא תפוס)`);
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
     * כשלא סופק: idBefore/idAfter נלקחים מהשכן הישיר (ברירת המחדל אחרי הפרדת טווחי IDs).
     */
    linkedIdsPerPosition?: string[][];
    /**
     * ערך מינימלי ל-idBefore – מבטיח שה-ID החדש יהיה >= minIdBefore.
     * שימוש: תאימות/מקרי קצה שבהם עדיין צריך עיגון תחתון קשיח.
     */
    minIdBefore?: string;
    /** נקרא כשצריך לשאול את המשתמש האם ליצור מזהה .5 בין שני מספרים צמודים. מחזיר true אם מאשר. */
    confirmUserWantsDecimalId?: () => boolean;
}

/**
 * מחשב itemId חדש בהתבסס על רשימה ממוינת של IDs קיימים + מיקום הוספה.
 *
 * מצב פשוט (ללא linkedIdsPerPosition, ברירת מחדל מומלצת):
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
    const { neighborBounds, extraTakenIds, linkedIdsPerPosition, minIdBefore, confirmUserWantsDecimalId } = options ?? {};

    console.log(`${ID_LOG_PREFIX} ═══ computeItemIdForInsert (כניסה) ═══`);
    console.log(`${ID_LOG_PREFIX}   קלט: orderedItemIds=${JSON.stringify(orderedItemIds)} (אורך ${orderedItemIds.length}) insertIndex=${insertIndex}`);
    console.log(`${ID_LOG_PREFIX}   אופציות: linkedIdsPerPosition=${linkedIdsPerPosition ? `כן (${linkedIdsPerPosition.length} עמדות)` : "לא"} neighborBounds=${neighborBounds ? JSON.stringify(neighborBounds) : "(לא)"} extraTakenIds=${extraTakenIds?.length ? JSON.stringify(extraTakenIds) : "(לא)"} minIdBefore=${minIdBefore ?? "(לא)"}`);

    let idBefore: string | null = null;
    let idAfter: string | null = null;
    let idBeforeSource = "";
    let idAfterSource = "";

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
        if (above.length > 0) {
            idBefore = above.reduce((a, b) => (Number(a) >= Number(b) ? a : b));
            idBeforeSource = `MAX מעל insertIndex (בסיס+מקושרים): [${above.join(",")}] → ${idBefore}`;
        }
        if (below.length > 0) {
            idAfter = below.reduce((a, b) => (Number(a) <= Number(b) ? a : b));
            idAfterSource = `MIN מתחת insertIndex (בסיס+מקושרים): [${below.join(",")}] → ${idAfter}`;
        }
    } else {
        // Simple: direct neighbors (scan for first non-empty)
        for (let i = insertIndex - 1; i >= 0; i--) {
            if (orderedItemIds[i]) {
                idBefore = orderedItemIds[i];
                idBeforeSource = `שכן ישיר מעל: orderedItemIds[${i}]=${idBefore}`;
                break;
            }
        }
        for (let i = insertIndex; i < orderedItemIds.length; i++) {
            if (orderedItemIds[i]) {
                idAfter = orderedItemIds[i];
                idAfterSource = `שכן ישיר מתחת: orderedItemIds[${i}]=${idAfter}`;
                break;
            }
        }
        if (!idBefore && idBeforeSource === "") idBeforeSource = "(אין)";
        if (!idAfter && idAfterSource === "") idAfterSource = "(אין)";
    }

    console.log(`${ID_LOG_PREFIX}   idBefore: ${idBeforeSource || "(ריק)"} → ${idBefore ?? "(ריק)"}`);
    console.log(`${ID_LOG_PREFIX}   idAfter:  ${idAfterSource || "(ריק)"} → ${idAfter ?? "(ריק)"}`);

    // Neighbor-bounds fallback (edges of part)
    if (idBefore == null && neighborBounds?.prevLastItemId) {
        idBefore = neighborBounds.prevLastItemId;
        console.log(`${ID_LOG_PREFIX}   idBefore (fallback מ-neighborBounds.prevLastItemId): ${idBefore}`);
    }
    if (idAfter == null && neighborBounds?.nextFirstItemId) {
        idAfter = neighborBounds.nextFirstItemId;
        console.log(`${ID_LOG_PREFIX}   idAfter (fallback מ-neighborBounds.nextFirstItemId): ${idAfter}`);
    }

    // Minimum idBefore constraint (e.g. translation itemId >= base itemId)
    if (minIdBefore != null && minIdBefore !== "") {
        const minNum = Number(minIdBefore);
        if (!Number.isNaN(minNum)) {
            const beforeNum = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
            if (Number.isNaN(beforeNum) || beforeNum < minNum) {
                console.log(`${ID_LOG_PREFIX}   אילוץ minIdBefore=${minIdBefore}: idBefore היה ${idBefore ?? "(ריק)"} → מעדכן ל-${minIdBefore}`);
                idBefore = minIdBefore;
            }
            const afterNum = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;
            if (!Number.isNaN(afterNum) && afterNum <= minNum) {
                console.log(`${ID_LOG_PREFIX}   אילוץ minIdBefore: idAfter=${idAfter} <= minIdBefore → מאפסים idAfter`);
                idAfter = null;
            }
        }
    }

    // עדכון idBefore לפי extraTakenIds: כל ID שנמצא בתחום (idBefore, idAfter) – צריך להפוך ל-idBefore
    // (כדי שה-ID החדש ייצא *אחרי* כל ה-enhancements הקיימים, לא רק לא יהיה זהה להם)
    if (extraTakenIds && extraTakenIds.length > 0) {
        const beforeNum = idBefore != null && idBefore !== "" ? Number(idBefore) : -Infinity;
        const afterNum  = idAfter  != null && idAfter  !== "" ? Number(idAfter)  :  Infinity;
        let maxInZone: number = -Infinity;
        for (const id of extraTakenIds) {
            const n = Number(id);
            if (!Number.isNaN(n) && n > beforeNum && n < afterNum && n > maxInZone) {
                maxInZone = n;
            }
        }
        if (maxInZone > -Infinity) {
            const newIdBefore = String(maxInZone);
            console.log(`${ID_LOG_PREFIX}   extraTakenIds: מעדכן idBefore מ-${idBefore ?? "(ריק)"} ל-${newIdBefore} (MAX של extraTakenIds בתחום (${idBefore ?? "-∞"}, ${idAfter ?? "∞"}))`);
            idBefore = newIdBefore;
        }
    }

    // Build takenIds
    const takenIds = new Set<string>();
    for (const id of orderedItemIds) if (id) takenIds.add(id);
    const fromOrdered = takenIds.size;
    if (linkedIdsPerPosition) {
        for (const linked of linkedIdsPerPosition) {
            if (linked) for (const lid of linked) if (lid) takenIds.add(lid);
        }
    }
    const fromLinked = takenIds.size - fromOrdered;
    if (extraTakenIds) {
        for (const id of extraTakenIds) if (id) takenIds.add(id);
    }
    const fromExtra = takenIds.size - fromOrdered - fromLinked;
    console.log(`${ID_LOG_PREFIX}   takenIds: מ-orderedItemIds=${fromOrdered} מ-linkedIdsPerPosition=${fromLinked} מ-extraTakenIds=${fromExtra} סה"כ=${takenIds.size}`);

    const result = computeNextAvailableItemId(idBefore, idAfter, takenIds, { confirmUserWantsDecimalId });
    console.log(`${ID_LOG_PREFIX} ═══ computeItemIdForInsert תוצאה: ${result} ═══`);
    return result;
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