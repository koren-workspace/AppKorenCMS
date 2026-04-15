/**
 * itemUtils – פונקציות עזר לפריטים במסך העריכה
 *
 * - chunkArray: פיצול מערך לחלקים (למשל 30) – נדרש ל-Firestore (array-contains-any מוגבל)
 * - getItemStyle: classNames ל-textarea לפי סוג הפריט (title / instructions / body)
 * - idBetween: מחשב ערך mit_id חדש בין שני ערכים קיימים
 * - computeNextAvailableItemId: מחשב itemId חדש פנוי בין שני ערכים, עם decimal fallback
 * - computeItemIdForInsert: צינור קבוע – גבולות מאזן הרשימה → תיקוני מקטע/מדיניות → takenIds → מספר פנוי
 */

import { cmsDebugItemIdsEnabled } from "./debugFlags";

const MIT_ID_GAP = 1000;

/**
 * מחשב ערך mit_id בין idBefore ל-idAfter.
 * - בין שני ערכים: ממוצע (חצי ביניהם).
 * - רק לפני: idAfter - GAP (הוספה בהתחלה).
 * - רק אחרי: idBefore + GAP (הוספה בסוף).
 * - אין אף אחד: "0".
 */
const ID_LOG_PREFIX = "[CMS-ID]";

function cmsIdLog(...args: unknown[]) {
    if (cmsDebugItemIdsEnabled()) console.log(...args);
}

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
        const isConsecutive = Math.abs(after - before) === 1;
        if (isConsecutive) {
            result = String(mid);
            formula = `(idBefore + idAfter) / 2 = (${before} + ${after}) / 2 = ${mid} → IDs צמודים (פער 1), נשאר עשרוני`;
        } else {
            const rounded = Math.round(mid);
            result = String(rounded);
            formula = `(idBefore + idAfter) / 2 = (${before} + ${after}) / 2 = ${mid} → יש מרווח, עיגול למספר שלם ${rounded}`;
        }
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

    cmsIdLog(`${ID_LOG_PREFIX} ─── idBetween ───`);
    cmsIdLog(`${ID_LOG_PREFIX}   קלט: idBefore=${String(idBefore ?? "(ריק)")} idAfter=${String(idAfter ?? "(ריק)")}`);
    cmsIdLog(`${ID_LOG_PREFIX}   חישוב: ${formula}`);
    cmsIdLog(`${ID_LOG_PREFIX}   תוצאה: ${result}`);
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
        cmsIdLog(`${ID_LOG_PREFIX}   getRoundedInitialItemId: ערך גולמי מ-idBetween=${raw} → עיגול למספר שלם=${rounded}`);
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

    cmsIdLog(`${ID_LOG_PREFIX} ─── computeNextAvailableItemId ───`);
    cmsIdLog(`${ID_LOG_PREFIX}   קלט: idBefore=${String(idBefore ?? "(ריק)")} idAfter=${String(idAfter ?? "(ריק)")} takenIds=${takenArr.length <= 30 ? JSON.stringify(takenArr) : `[${takenArr.length} IDs: ${takenArr.slice(0, 10).join(",")}...]`}`);

    let result = getRoundedInitialItemId(idBefore, idAfter);
    cmsIdLog(`${ID_LOG_PREFIX}   ערך התחלתי (מעוגל מ-idBetween): ${result}`);

    const idBeforeNum = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
    const idAfterNum = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;
    let step = 0;
    // די מיותר בגלל שלא יכול לקרות מקרה שבו יש  הID החדש תפוסם
    while (takenIds.has(result)) {
        step++;
        const nextNum = (Number(result) || 0) + 1;
        cmsIdLog(`${ID_LOG_PREFIX}   שלב ${step}: ${result} תפוס ב-takenIds → מנסה ${nextNum}`);
        if (!Number.isNaN(idAfterNum) && nextNum >= idAfterNum) {
            const isConsecutive = !Number.isNaN(idBeforeNum) && idAfterNum - idBeforeNum === 1;
            cmsIdLog(`${ID_LOG_PREFIX}   ${nextNum} >= idAfter(${idAfterNum}) → אין מקום. צמודים? ${isConsecutive} (idAfter-idBefore===1)`);
            if (isConsecutive) {
                const approved = confirmUserWantsDecimalId?.();
                if (!approved) throw new Error(NO_SPACE_BETWEEN_ITEMS);
                const decimalId = `${idBeforeNum + 0.5}`;
                if (takenIds.has(decimalId)) throw new Error(NO_SPACE_BETWEEN_ITEMS);
                cmsIdLog(`${ID_LOG_PREFIX}   משתמש אישר → מזהה עשרוני: ${decimalId}`);
                cmsIdLog(`${ID_LOG_PREFIX}   תוצאה סופית: ${decimalId} (עשרוני)`);
                return decimalId;
            }
            throw new Error(NO_SPACE_BETWEEN_ITEMS);
        }
        result = String(nextNum);
    }
    if (step > 0) {
        cmsIdLog(`${ID_LOG_PREFIX}   ${result} פנוי. תוצאה סופית: ${result}`);
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}   תוצאה סופית: ${result} (לא תפוס)`);
    }
    return result;
}

// ─── Centralized insert helper ──────────────────────────────────────────────
//
// צינור (אותו סדר תמיד): (1) גבולות מרשימה ± linked  (2) neighborBounds  (3) minIdBefore
// (4) nextBaseLinkedMinItemId  (5) הרמת idBefore מתוך extraTakenIds ברווח  (6) takenIds + בחירת מספר

type InsertBoundsState = {
    idBefore: string | null;
    idAfter: string | null;
    idBeforeSource: string;
    idAfterSource: string;
};

function computeBoundsFromOrderedList(
    orderedItemIds: string[],
    insertIndex: number,
    linkedIdsPerPosition: string[][] | undefined
): InsertBoundsState {
    let idBefore: string | null = null;
    let idAfter: string | null = null;
    let idBeforeSource = "";
    let idAfterSource = "";

    cmsIdLog(`${ID_LOG_PREFIX}   ┌─ computeBoundsFromOrderedList ─┐`);
    cmsIdLog(`${ID_LOG_PREFIX}   │ מצב: ${linkedIdsPerPosition ? "עם linkedIdsPerPosition" : "פשוט (ללא linked)"}`);

    if (linkedIdsPerPosition) {
        const above: string[] = [];
        for (let i = 0; i < insertIndex; i++) {
            const id = orderedItemIds[i];
            const linked = linkedIdsPerPosition[i];
            const posIds: string[] = [];
            if (id) { above.push(id); posIds.push(id); }
            if (linked) for (const lid of linked) if (lid) { above.push(lid); posIds.push(lid); }
            if (posIds.length > 0)
                cmsIdLog(`${ID_LOG_PREFIX}   │ מעל [${i}]: בסיס=${id ?? "(ריק)"} linked=[${linked?.join(",") ?? ""}] → [${posIds.join(",")}]`);
        }
        const below: string[] = [];
        for (let i = insertIndex; i < orderedItemIds.length; i++) {
            const id = orderedItemIds[i];
            const linked = linkedIdsPerPosition[i];
            const posIds: string[] = [];
            if (id) { below.push(id); posIds.push(id); }
            if (linked) for (const lid of linked) if (lid) { below.push(lid); posIds.push(lid); }
            if (posIds.length > 0)
                cmsIdLog(`${ID_LOG_PREFIX}   │ מתחת [${i}]: בסיס=${id ?? "(ריק)"} linked=[${linked?.join(",") ?? ""}] → [${posIds.join(",")}]`);
        }
        cmsIdLog(`${ID_LOG_PREFIX}   │ סה"כ מעל: ${above.length} IDs [${above.length <= 20 ? above.join(",") : above.slice(0, 10).join(",") + "..."}]`);
        cmsIdLog(`${ID_LOG_PREFIX}   │ סה"כ מתחת: ${below.length} IDs [${below.length <= 20 ? below.join(",") : below.slice(0, 10).join(",") + "..."}]`);
        if (above.length > 0) {
            idBefore = above.reduce((a, b) => (Number(a) >= Number(b) ? a : b));
            idBeforeSource = `MAX מעל insertIndex (בסיס+מקושרים): [${above.join(",")}] → ${idBefore}`;
        }
        if (below.length > 0) {
            idAfter = below.reduce((a, b) => (Number(a) <= Number(b) ? a : b));
            idAfterSource = `MIN מתחת insertIndex (בסיס+מקושרים): [${below.join(",")}] → ${idAfter}`;
        }
    } else {
        for (let i = insertIndex - 1; i >= 0; i--) {
            if (orderedItemIds[i]) {
                idBefore = orderedItemIds[i];
                idBeforeSource = `שכן ישיר מעל: orderedItemIds[${i}]=${idBefore}`;
                cmsIdLog(`${ID_LOG_PREFIX}   │ שכן מעל: סורק מ-[${insertIndex - 1}] ← מצא ב-[${i}]=${idBefore}`);
                break;
            }
        }
        if (!idBefore) cmsIdLog(`${ID_LOG_PREFIX}   │ שכן מעל: לא נמצא (insertIndex=${insertIndex})`);
        for (let i = insertIndex; i < orderedItemIds.length; i++) {
            if (orderedItemIds[i]) {
                idAfter = orderedItemIds[i];
                idAfterSource = `שכן ישיר מתחת: orderedItemIds[${i}]=${idAfter}`;
                cmsIdLog(`${ID_LOG_PREFIX}   │ שכן מתחת: סורק מ-[${insertIndex}] → מצא ב-[${i}]=${idAfter}`);
                break;
            }
        }
        if (!idAfter) cmsIdLog(`${ID_LOG_PREFIX}   │ שכן מתחת: לא נמצא`);
        if (!idBefore && idBeforeSource === "") idBeforeSource = "(אין)";
        if (!idAfter && idAfterSource === "") idAfterSource = "(אין)";
    }

    cmsIdLog(`${ID_LOG_PREFIX}   │ תוצאה: idBefore=${idBefore ?? "(ריק)"} idAfter=${idAfter ?? "(ריק)"}`);
    cmsIdLog(`${ID_LOG_PREFIX}   └──────────────────────────────────┘`);

    return { idBefore, idAfter, idBeforeSource, idAfterSource };
}

function applyNeighborBoundsFallback(
    b: InsertBoundsState,
    neighborBounds: InsertNeighborBounds | undefined
): void {
    cmsIdLog(`${ID_LOG_PREFIX}   [שלב 2: neighborBounds fallback] neighborBounds=${neighborBounds ? JSON.stringify(neighborBounds) : "(לא סופק)"}`);
    if (b.idBefore == null && neighborBounds?.prevLastItemId) {
        b.idBefore = neighborBounds.prevLastItemId;
        cmsIdLog(`${ID_LOG_PREFIX}     ✓ idBefore היה ריק → עדכון מ-prevLastItemId: ${b.idBefore}`);
    } else if (b.idBefore == null) {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ idBefore ריק ואין prevLastItemId – נשאר ריק`);
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ idBefore כבר מוגדר (${b.idBefore}) – ללא שינוי`);
    }
    if (b.idAfter == null && neighborBounds?.nextFirstItemId) {
        b.idAfter = neighborBounds.nextFirstItemId;
        cmsIdLog(`${ID_LOG_PREFIX}     ✓ idAfter היה ריק → עדכון מ-nextFirstItemId: ${b.idAfter}`);
    } else if (b.idAfter == null) {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ idAfter ריק ואין nextFirstItemId – נשאר ריק`);
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ idAfter כבר מוגדר (${b.idAfter}) – ללא שינוי`);
    }
}

function applyMinIdBeforeConstraint(b: InsertBoundsState, minIdBefore: string | undefined): void {
    cmsIdLog(`${ID_LOG_PREFIX}   [שלב 3: minIdBefore] minIdBefore=${minIdBefore ?? "(לא סופק)"}`);
    if (minIdBefore == null || minIdBefore === "") {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ לא סופק – דילוג`);
        return;
    }
    const minNum = Number(minIdBefore);
    if (Number.isNaN(minNum)) {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ ערך לא מספרי (${minIdBefore}) – דילוג`);
        return;
    }
    const beforeNum = b.idBefore != null && b.idBefore !== "" ? Number(b.idBefore) : NaN;
    if (Number.isNaN(beforeNum) || beforeNum < minNum) {
        cmsIdLog(
            `${ID_LOG_PREFIX}     ✓ idBefore היה ${b.idBefore ?? "(ריק)"} (${Number.isNaN(beforeNum) ? "ריק" : beforeNum + " < " + minNum}) → מעדכן ל-${minIdBefore}`
        );
        b.idBefore = minIdBefore;
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ idBefore (${beforeNum}) >= minIdBefore (${minNum}) – ללא שינוי`);
    }
    const afterNum = b.idAfter != null && b.idAfter !== "" ? Number(b.idAfter) : NaN;
    if (!Number.isNaN(afterNum) && afterNum <= minNum) {
        cmsIdLog(`${ID_LOG_PREFIX}     ✓ idAfter=${b.idAfter} <= minIdBefore(${minNum}) → מאפסים idAfter`);
        b.idAfter = null;
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ idAfter (${b.idAfter ?? "ריק"}) ${!Number.isNaN(afterNum) ? `> minIdBefore(${minNum})` : "ריק"} – ללא שינוי`);
    }
}

function applyNextBaseLinkedCap(
    b: InsertBoundsState,
    nextBaseLinkedMinItemId: string | undefined
): void {
    cmsIdLog(`${ID_LOG_PREFIX}   [שלב 4: nextBaseLinkedMinItemId cap] nextBaseLinkedMinItemId=${nextBaseLinkedMinItemId ?? "(לא סופק)"}`);
    if (nextBaseLinkedMinItemId == null || nextBaseLinkedMinItemId === "") {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ לא סופק – דילוג`);
        return;
    }
    const capNum = Number(nextBaseLinkedMinItemId);
    if (Number.isNaN(capNum)) {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ ערך לא מספרי (${nextBaseLinkedMinItemId}) – דילוג`);
        return;
    }
    const beforeNum = b.idBefore != null && b.idBefore !== "" ? Number(b.idBefore) : NaN;
    if (Number.isNaN(beforeNum) || capNum > beforeNum) {
        if (b.idAfter == null || b.idAfter === "") {
            const oldAfter = b.idAfter;
            b.idAfter = nextBaseLinkedMinItemId;
            b.idAfterSource = `nextBaseLinkedMinItemId (אין שכן מתחת): ${b.idAfter}`;
            cmsIdLog(`${ID_LOG_PREFIX}     ✓ idAfter היה ${oldAfter ?? "(ריק)"} → עדכון ל-${b.idAfter} (אין שכן מתחת, capNum ${capNum} > idBefore ${beforeNum})`);
        } else {
            const afterNum = Number(b.idAfter);
            if (!Number.isNaN(afterNum) && capNum < afterNum) {
                const oldAfter = b.idAfter;
                b.idAfter = nextBaseLinkedMinItemId;
                b.idAfterSource = `MIN(שכן מתחת, nextBaseLinkedMinItemId) → ${b.idAfter}`;
                cmsIdLog(`${ID_LOG_PREFIX}     ✓ capNum(${capNum}) < idAfter(${afterNum}) → idAfter עודכן מ-${oldAfter} ל-${b.idAfter}`);
            } else {
                cmsIdLog(`${ID_LOG_PREFIX}     ─ capNum(${capNum}) >= idAfter(${b.idAfter}) – ללא שינוי`);
            }
        }
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ capNum(${capNum}) <= idBefore(${beforeNum}) – ללא שינוי`);
    }
}

function bumpIdBeforeFromExtraInGap(b: InsertBoundsState, extraTakenIds: string[] | undefined): void {
    cmsIdLog(`${ID_LOG_PREFIX}   [שלב 5: bumpIdBefore מ-extraTakenIds] extraTakenIds=${extraTakenIds?.length ? `[${extraTakenIds.length} IDs: ${extraTakenIds.length <= 20 ? extraTakenIds.join(",") : extraTakenIds.slice(0, 10).join(",") + "..."}]` : "(ריק)"}`);
    if (!extraTakenIds || extraTakenIds.length === 0) {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ אין extraTakenIds – דילוג`);
        return;
    }
    const beforeNum = b.idBefore != null && b.idBefore !== "" ? Number(b.idBefore) : -Infinity;
    const afterNum = b.idAfter != null && b.idAfter !== "" ? Number(b.idAfter) : Infinity;
    cmsIdLog(`${ID_LOG_PREFIX}     תחום חיפוש: (${beforeNum === -Infinity ? "-∞" : beforeNum}, ${afterNum === Infinity ? "∞" : afterNum})`);
    const inGap: string[] = [];
    let maxInZone = -Infinity;
    for (const id of extraTakenIds) {
        const n = Number(id);
        if (!Number.isNaN(n) && n > beforeNum && n < afterNum) {
            inGap.push(id);
            if (n > maxInZone) maxInZone = n;
        }
    }
    if (maxInZone > -Infinity) {
        const newIdBefore = String(maxInZone);
        cmsIdLog(`${ID_LOG_PREFIX}     IDs בתחום: [${inGap.join(",")}] → MAX=${maxInZone}`);
        cmsIdLog(
            `${ID_LOG_PREFIX}     ✓ מעדכן idBefore מ-${b.idBefore ?? "(ריק)"} ל-${newIdBefore}`
        );
        b.idBefore = newIdBefore;
    } else {
        cmsIdLog(`${ID_LOG_PREFIX}     ─ אין IDs בתחום – ללא שינוי`);
    }
}

function buildTakenIdsForInsert(
    orderedItemIds: string[],
    linkedIdsPerPosition: string[][] | undefined,
    extraTakenIds: string[] | undefined
): Set<string> {
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
    cmsIdLog(
        `${ID_LOG_PREFIX}   takenIds: מ-orderedItemIds=${fromOrdered} מ-linkedIdsPerPosition=${fromLinked} מ-extraTakenIds=${fromExtra} סה"כ=${takenIds.size}`
    );
    return takenIds;
}

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
    /**
     * סימטריה לסריקה אחורה על בסיס: מינימום itemId מבין תרגומי שורת הבסיס הבאה (במקטע) שיש לה תרגומים.
     * מחמיר את idAfter: idAfter_effective = MIN(numeric)(idAfter מהשכן/גבול, ערך זה), רק אם הערך > idBefore.
     */
    nextBaseLinkedMinItemId?: string;
    /** נקרא כשצריך לשאול את המשתמש האם ליצור מזהה .5 בין שני מספרים צמודים. מחזיר true אם מאשר. */
    confirmUserWantsDecimalId?: () => boolean;
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
    const {
        neighborBounds,
        extraTakenIds,
        linkedIdsPerPosition,
        minIdBefore,
        nextBaseLinkedMinItemId,
        confirmUserWantsDecimalId,
    } = options ?? {};

    cmsIdLog(`${ID_LOG_PREFIX} ╔═══════════════════════════════════════════════════════════╗`);
    cmsIdLog(`${ID_LOG_PREFIX} ║  computeItemIdForInsert – התחלה                          ║`);
    cmsIdLog(`${ID_LOG_PREFIX} ╚═══════════════════════════════════════════════════════════╝`);
    cmsIdLog(`${ID_LOG_PREFIX}   קלט: orderedItemIds=${orderedItemIds.length <= 20 ? JSON.stringify(orderedItemIds) : `[${orderedItemIds.length} IDs: ${orderedItemIds.slice(0, 8).join(",")}...]`} (אורך ${orderedItemIds.length}) insertIndex=${insertIndex}`);
    cmsIdLog(`${ID_LOG_PREFIX}   אופציות:`);
    cmsIdLog(`${ID_LOG_PREFIX}     linkedIdsPerPosition: ${linkedIdsPerPosition ? `כן (${linkedIdsPerPosition.length} עמדות)` : "לא"}`);
    cmsIdLog(`${ID_LOG_PREFIX}     neighborBounds: ${neighborBounds ? JSON.stringify(neighborBounds) : "(לא סופק)"}`);
    cmsIdLog(`${ID_LOG_PREFIX}     extraTakenIds: ${extraTakenIds?.length ? `[${extraTakenIds.length} IDs${extraTakenIds.length <= 15 ? ": " + extraTakenIds.join(",") : ""}]` : "(לא סופק)"}`);
    cmsIdLog(`${ID_LOG_PREFIX}     minIdBefore: ${minIdBefore ?? "(לא סופק)"}`);
    cmsIdLog(`${ID_LOG_PREFIX}     nextBaseLinkedMinItemId: ${nextBaseLinkedMinItemId ?? "(לא סופק)"}`);

    cmsIdLog(`${ID_LOG_PREFIX}   [שלב 1: חישוב גבולות מהרשימה]`);
    const b = computeBoundsFromOrderedList(orderedItemIds, insertIndex, linkedIdsPerPosition);
    cmsIdLog(`${ID_LOG_PREFIX}   → idBefore: ${b.idBeforeSource || "(ריק)"}`);
    cmsIdLog(`${ID_LOG_PREFIX}   → idAfter:  ${b.idAfterSource || "(ריק)"}`);

    applyNeighborBoundsFallback(b, neighborBounds);
    cmsIdLog(`${ID_LOG_PREFIX}   ── מצב אחרי שלב 2: idBefore=${b.idBefore ?? "(ריק)"} idAfter=${b.idAfter ?? "(ריק)"}`);

    applyMinIdBeforeConstraint(b, minIdBefore);
    cmsIdLog(`${ID_LOG_PREFIX}   ── מצב אחרי שלב 3: idBefore=${b.idBefore ?? "(ריק)"} idAfter=${b.idAfter ?? "(ריק)"}`);

    applyNextBaseLinkedCap(b, nextBaseLinkedMinItemId);
    cmsIdLog(`${ID_LOG_PREFIX}   ── מצב אחרי שלב 4: idBefore=${b.idBefore ?? "(ריק)"} idAfter=${b.idAfter ?? "(ריק)"}`);

    bumpIdBeforeFromExtraInGap(b, extraTakenIds);
    cmsIdLog(`${ID_LOG_PREFIX}   ── מצב אחרי שלב 5: idBefore=${b.idBefore ?? "(ריק)"} idAfter=${b.idAfter ?? "(ריק)"}`);

    cmsIdLog(`${ID_LOG_PREFIX}   [שלב 6: בניית takenIds + חישוב מספר סופי]`);
    const takenIds = buildTakenIdsForInsert(orderedItemIds, linkedIdsPerPosition, extraTakenIds);
    const result = computeNextAvailableItemId(b.idBefore, b.idAfter, takenIds, { confirmUserWantsDecimalId });

    cmsIdLog(`${ID_LOG_PREFIX} ╔═══════════════════════════════════════════════════════════╗`);
    cmsIdLog(`${ID_LOG_PREFIX} ║  תוצאה סופית: ${result.padEnd(42)} ║`);
    cmsIdLog(`${ID_LOG_PREFIX} ║  (idBefore=${(b.idBefore ?? "ריק").padEnd(12)} idAfter=${(b.idAfter ?? "ריק").padEnd(12)})      ║`);
    cmsIdLog(`${ID_LOG_PREFIX} ╚═══════════════════════════════════════════════════════════╝`);
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

export function splitParagraphSentences(text: string): string[] {
    return (text ?? "")
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
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
        "w-full p-4 border rounded-b-md shadow-sm outline-none transition-all whitespace-pre-wrap ";
    if (fontTanach)
        baseStyle += "font-serif text-2xl border-r-8 border-amber-200 pr-4 ";
    else baseStyle += "font-sans text-lg ";

    if (type === "title")
        return baseStyle + "font-bold bg-gray-50 border-r-4 border-gray-400";
    if (type === "instructions")
        return baseStyle + "text-base italic text-blue-700 bg-blue-50/50";
    return baseStyle + "leading-relaxed bg-white border-gray-200 min-h-[120px]";
}