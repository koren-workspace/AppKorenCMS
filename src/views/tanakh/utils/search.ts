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

export function matchesQuery(e: Entry, query: string): boolean {
    const q = searchKey(query);
    if (!q) return true;
    const terms = entrySearchTerms(e);
    if (terms.some(t => searchKey(t).includes(q))) return true;
    const sk = skeletonKey(query);
    return sk.length >= 2 && terms.some(t => skeletonKey(t).includes(sk));
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
