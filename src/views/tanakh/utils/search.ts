/**
 * חיפוש וסינון ברשימת הערכים – בדפדפן, על כל הערכים שנטענו.
 * ההתאמה סלחנית: בלי ניקוד, בלי סימני פיסוק, ובכתיב מלא/חסר (ו/י מושמטות).
 */

import type { Entry, TargetLang } from "../model/types";
import { hasTranslation } from "../model/entryOps";

/** אותיות עבריות/לטיניות/ספרות בלבד, בלי ניקוד */
export function searchKey(s: string): string {
    return (s ?? "")
        .normalize("NFKD")
        .replace(/[֑-ׇ]/g, "")
        .toLowerCase()
        .replace(/[^א-תa-z0-9]/g, "");
}

/** כמו searchKey, וגם בלי ו/י – לכתיב מלא/חסר */
export function skeletonKey(s: string): string {
    return searchKey(s).replace(/[וי]/g, "");
}

/** כל השמות שבהם ערך נמצא בחיפוש */
export function entrySearchTerms(e: Entry): string[] {
    return [e.id, e.title.he, e.title.en ?? "", ...e.altTitles.he, ...(e.altTitles.en ?? [])].filter(Boolean);
}

/**
 * עד כמה ערך מתאים לשאילתה – מספר קטן = התאמה טובה יותר, null = לא מתאים.
 *
 *   0  שם שלם זהה (כותרת, שם נוסף או מזהה)
 *   1  שם שמתחיל בשאילתה
 *   2  מילה בתוך השם שמתחילה בשאילתה
 *   3  השאילתה מופיעה בתוך השם
 *   4  שם שלם זהה בכתיב מלא/חסר ("שילה" ↔ "שִׁלֹה")
 *   5  התאמה חלקית בכתיב מלא/חסר בלבד
 *
 * למה דירוג ולא רק כן/לא: ההתאמה הסלחנית לכתיב מלא/חסר הופכת "שור" ל"שר",
 * וזה תופס גם תאשור, נשר, שרון, אשור… בחלון שמציג רק כמה תוצאות, "שור"
 * עצמו נחתך. עם הדירוג הוא ראשון.
 */
export function queryRank(e: Entry, query: string): number | null {
    const q = searchKey(query);
    if (!q) return 0;
    let best: number | null = null;
    const consider = (r: number) => { if (best === null || r < best) best = r; };
    for (const t of entrySearchTerms(e)) {
        const key = searchKey(t);
        if (key === q) consider(0);
        else if (key.startsWith(q)) consider(1);
        else if (key.includes(q)) {
            // התחלת מילה: "שילה" ב"תל שילה" – מפצלים לפי רווח/פסיק ובודקים כל חלק
            const wordStart = t.split(/[\s,،]+/).some(w => searchKey(w).startsWith(q));
            consider(wordStart ? 2 : 3);
        }
    }
    if (best !== null) return best;
    const sk = skeletonKey(query);
    if (sk.length < 2) return null;
    for (const t of entrySearchTerms(e)) {
        const key = skeletonKey(t);
        if (key === sk) consider(4);
        else if (key.includes(sk)) consider(5);
    }
    return best;
}

export function matchesQuery(e: Entry, query: string): boolean {
    return queryRank(e, query) !== null;
}

/**
 * הערכים שמתאימים לשאילתה, הטובים ביותר קודם; בתוך אותו דירוג – בסדר המקורי.
 * `total` הוא מספר ההתאמות לפני החיתוך, כדי שהתצוגה תוכל לומר "ועוד N".
 */
export function rankEntries(entries: readonly Entry[], query: string, limit: number): { matches: Entry[]; total: number } {
    const ranked: { e: Entry; r: number; i: number }[] = [];
    entries.forEach((e, i) => {
        const r = queryRank(e, query);
        if (r !== null) ranked.push({ e, r, i });
    });
    ranked.sort((a, b) => a.r - b.r || a.i - b.i);
    return { matches: ranked.slice(0, limit).map(x => x.e), total: ranked.length };
}

export type QuickFilter = "review" | "hidden" | "noLocation" | "untranslated" | "stale" | "redirect";

export const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
    review: "לבדיקה",
    hidden: "מוסתרים",
    noLocation: "בלי מיקום",
    untranslated: "בלי תרגום",
    stale: "תרגום לא מעודכן",
    redirect: "הפניות",
};

export function matchesQuickFilter(e: Entry, f: QuickFilter, lang: TargetLang = "en"): boolean {
    switch (f) {
        case "review": return e.review.length > 0;
        case "hidden": return !e.visible;
        case "noLocation": return !e.location && !e.see;
        case "untranslated": return !hasTranslation(e, lang) && !e.see;
        case "stale": return e.i18n[lang]?.status === "stale";
        case "redirect": return Boolean(e.see);
    }
}

export interface ListFilters {
    query: string;
    cat: string | "all";
    quick: QuickFilter | null;
}

export function filterEntries(entries: readonly Entry[], f: ListFilters): Entry[] {
    return entries.filter(e =>
        (f.cat === "all" || e.cat === f.cat) &&
        (!f.quick || matchesQuickFilter(e, f.quick)) &&
        matchesQuery(e, f.query),
    );
}

/** מיון לתצוגה: לפי קטגוריה (סדר), ואז כותרת בעברית */
export function sortEntries(entries: Entry[], catOrder: Map<string, number>): Entry[] {
    return [...entries].sort((a, b) =>
        (catOrder.get(a.cat) ?? 99) - (catOrder.get(b.cat) ?? 99) ||
        searchKey(a.title.he).localeCompare(searchKey(b.title.he), "he") ||
        (a.page ?? 0) - (b.page ?? 0),
    );
}
