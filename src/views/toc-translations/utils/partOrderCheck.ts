/**
 * partOrderCheck – בדיקה ששינוי סדר מקטעים בתוכן העניינים לא סותר את סדר מזהי הפריטים.
 *
 * האפליקציה מסדרת את פריטי התפילה לפי itemId מספרי בלבד (ולא לפי סדר המקטעים ב-TOC),
 * וכך גם משולבים התרגומים. גרירת מקטע משנה רק את ה-TOC, ולכן אם המקטע עובר אל מעבר
 * למקטע שהמזהים שלו "בצד השני" – ב-CMS הוא ייראה במקום החדש ובאפליקציה יישאר בישן.
 * (מקרה אמת: קדיש יתום 2011546 בשחרית ספרד, שנגרר אל אחרי שיר של יום 2011135.)
 *
 * נבדקים רק זוגות מקטעים שהסדר היחסי שלהם התהפך בגרירה – לזוגות אחרים הסטטוס לא השתנה,
 * כך שגרירה שמחזירה סדר שבור למצב תקין תמיד מותרת.
 */

/** טווח itemId (מספרי) של פריטי מקטע שאינם מחוקים; null כשהמקטע ריק. */
export type PartIdRange = { min: number; max: number } | null;

export interface PartOrderConflict {
    /** המקטע שבסדר החדש בא ראשון */
    beforePartId: string;
    /** המקטע שבסדר החדש בא אחריו, אבל המזהים שלו לא כולם גדולים מאלה של beforePartId */
    afterPartId: string;
}

/** זוגות [a, b] כך ש-a לפני b בסדר החדש ו-b לפני a בסדר הישן. */
export function swappedPartPairs(oldOrder: string[], newOrder: string[]): [string, string][] {
    const oldIndex = new Map(oldOrder.map((id, i) => [id, i]));
    const pairs: [string, string][] = [];
    for (let i = 0; i < newOrder.length; i++) {
        for (let j = i + 1; j < newOrder.length; j++) {
            const a = oldIndex.get(newOrder[i]);
            const b = oldIndex.get(newOrder[j]);
            if (a !== undefined && b !== undefined && a > b) {
                pairs.push([newOrder[i], newOrder[j]]);
            }
        }
    }
    return pairs;
}

/** מזהי המקטעים שצריך לטעון את טווחי המזהים שלהם כדי לבדוק את הגרירה. */
export function partsToCheck(oldOrder: string[], newOrder: string[]): string[] {
    const ids = new Set<string>();
    for (const [a, b] of swappedPartPairs(oldOrder, newOrder)) {
        ids.add(a);
        ids.add(b);
    }
    return [...ids];
}

/** טווח מספרי של רשימת itemId (מתעלם מערכים ריקים/לא מספריים). */
export function itemIdRange(itemIds: unknown[]): PartIdRange {
    let min = Infinity;
    let max = -Infinity;
    for (const raw of itemIds) {
        if (raw == null || String(raw).trim() === "") continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) continue;
        if (n < min) min = n;
        if (n > max) max = n;
    }
    return min === Infinity ? null : { min, max };
}

/**
 * זוגות שהגרירה הפכה לסותרים: בסדר החדש a לפני b, אבל לא כל המזהים של a קטנים מאלה של b,
 * ובסדר הישן (b לפני a) הם לא היו סותרים. מקטע ריק (או שלא נטען) לא נבדק.
 */
export function findReorderConflicts(
    oldOrder: string[],
    newOrder: string[],
    ranges: Map<string, PartIdRange>
): PartOrderConflict[] {
    const conflicts: PartOrderConflict[] = [];
    for (const [a, b] of swappedPartPairs(oldOrder, newOrder)) {
        const ra = ranges.get(a);
        const rb = ranges.get(b);
        if (!ra || !rb) continue;
        const brokenNow = ra.max >= rb.min;
        const brokenBefore = rb.max >= ra.min;
        if (brokenNow && !brokenBefore) {
            conflicts.push({ beforePartId: a, afterPartId: b });
        }
    }
    return conflicts;
}
