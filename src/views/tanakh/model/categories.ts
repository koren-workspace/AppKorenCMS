/**
 * שמונה הקטגוריות של המדריך, כפי שהן באפליקציה היום (src/content/categories.ts).
 * משמשות לזריעת קולקציית `categories` בשלב 3 ולתרגום מזהה מספרי → מפתח.
 */

import type { Category } from "./types";

export const LEGACY_CATEGORIES: readonly Category[] = [
    { key: "land",     legacyId: 1, name: { he: "הארץ במקרא",          en: "The Land in the Tanakh" },  icon: "trail-sign",     iconOutline: "trail-sign-outline",     order: 0, pages: [1, 70] },
    { key: "plants",   legacyId: 2, name: { he: "הצמחים במקרא",        en: "Plants of the Tanakh" },    icon: "leaf",           iconOutline: "leaf-outline",           order: 1, pages: [71, 128] },
    { key: "animals",  legacyId: 3, name: { he: "בעלי החיים במקרא",    en: "Animals of the Tanakh" },   icon: "paw",            iconOutline: "paw-outline",            order: 2, pages: [129, 194] },
    { key: "places",   legacyId: 4, name: { he: "מקומות במקרא",        en: "Places in the Tanakh" },    icon: "location",       iconOutline: "location-outline",       order: 3, pages: [195, 438] },
    { key: "nations",  legacyId: 5, name: { he: "ארצות ועמים במקרא",   en: "Lands & Peoples" },         icon: "globe",          iconOutline: "globe-outline",          order: 4, pages: [439, 500] },
    { key: "findings", legacyId: 6, name: { he: "ממצאים מתקופת המקרא", en: "Archaeological Findings" }, icon: "file-tray-full", iconOutline: "file-tray-full-outline", order: 5, pages: [501, 582] },
    { key: "maps",     legacyId: 7, name: { he: "מפות המקרא",          en: "Maps of the Tanakh" },      icon: "map",            iconOutline: "map-outline",            order: 6, pages: [583, 604] },
    { key: "routes",   legacyId: 8, name: { he: "מסלולי טיול עם המקרא", en: "Hiking Routes" },          icon: "footsteps",      iconOutline: "footsteps-outline",      order: 7, pages: [605, 686] },
];

const BY_LEGACY_ID = new Map(LEGACY_CATEGORIES.map(c => [c.legacyId, c]));

/** מפתח קטגוריה לפי המזהה המספרי באפליקציה; לא מוכר → "places" (כמו sheet.ts) */
export function categoryKeyOfLegacyId(id: number): string {
    return BY_LEGACY_ID.get(id)?.key ?? "places";
}
