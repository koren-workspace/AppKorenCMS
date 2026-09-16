/**
 * =============================================================================
 * בניית קובץ התוכן לאפליקציה (שלב 7)
 * =============================================================================
 *
 * ממיר את הערכים שב-Firestore לחבילת תוכן אחת בצורה שהאפליקציה קוראת
 * (`ContentPack` ב-src/content/types.ts שלה). זהו הכיוון ההפוך של
 * fromLegacy.ts, ולכן הוא צריך להישאר נאמן לאותן צורות.
 *
 * שתי החלטות שכדאי להכיר:
 *
 * 1. **פסוקים נשארים הפניות.** הקובץ לא מכיל את טקסט הפסוקים, אלא ספר/פרק/
 *    פסוק בלבד. טקסט התנ"ך כבר אפוי באפליקציה (5MB), ואין טעם לשכפל אותו
 *    לתוך הקובץ ולא לגרור אותו אל ה-CMS. בונוס: כשיתווסף תנ"ך באנגלית,
 *    הפסוקים באנגלית יגיעו ממנו בלי שינוי בקובץ.
 *
 * 2. **רק ערכים גלויים נכנסים.** `visible: false` = טיוטה, ולא ייכלל. ערך
 *    שמפנה או מקשר לערך שלא נכלל מדווח כאזהרה לפני הפרסום.
 */

import { bodyToBlocks, type BodyBlock } from "./body";
import { cleanTitle } from "./fromSheet";
import { tanakhBook } from "./tanakhBooks";
import type { Anchor, Category, Entry, Lang, RefItem, VerseRef } from "./types";

/** גרסת מבנה הקובץ. שינוי שובר = העלאת המספר, כדי שהאפליקציה תדע לסרב. */
export const PACK_FORMAT = 2;

export type PackBlock = BodyBlock | { t: "img"; src: string; cap?: string };

export interface PackEntry {
    id: string;
    /** המזהה המספרי של הקטגוריה באפליקציה */
    cat: number;
    title: string;
    /** כותרת בלי ניקוד, לחיפוש */
    titleClean: string;
    page: number;
    blocks: PackBlock[];
    /** פסוקי הפתיחה – הפניות בלבד; הטקסט נשלף באפליקציה */
    quotes: VerseRef[];
    refs: RefItem[];
    xrefs: { cat: number; title: string; id: string }[];
    see?: string;
    /** אזור/קיבוץ (group באפליקציה) */
    group?: string;
    altTitles?: string[];
}

export interface PackCategory {
    id: number;
    key: string;
    he: string;
    en?: string;
    icon: string;
    iconOutline: string;
    pages?: [number, number];
}

export interface PackLocation {
    id: string;
    lat: number;
    lng: number;
    conf: number;
}

/** book → chapter → verse → [{ e, cat, w? }] – בדיוק כמו anchors.json */
export type PackAnchorMap = Record<string, Record<string, Record<string, { e: string; cat: number; w?: string }[]>>>;

export interface ContentPack {
    format: number;
    /** מספר גרסה עולה; האפליקציה מורידה רק אם הוא גדול ממה שיש לה */
    version: number;
    /** ms */
    publishedAt: number;
    publishedBy?: string;
    /** שפת הקובץ. he = המקור; שפה אחרת נופלת לעברית בשדות שלא תורגמו. */
    lang: Lang;
    /** true = קובץ תצוגה מקדימה, שכולל גם ערכים מוסתרים */
    preview?: boolean;
    categories: PackCategory[];
    entries: PackEntry[];
    anchors: PackAnchorMap;
    locations: PackLocation[];
}

export interface PublishWarning {
    entryId: string;
    title: string;
    message: string;
}

export interface PublishResult {
    pack: ContentPack;
    /** ערכים שנכללו */
    included: number;
    /** ערכים שלא נכללו (מוסתרים) */
    hidden: number;
    warnings: PublishWarning[];
    stats: { images: number; anchors: number; locations: number; quotes: number; redirects: number };
}

export interface PublishOptions {
    lang?: Lang;
    /** גרסה קודמת; הקובץ מקבל את המספר הבא */
    previousVersion?: number;
    publishedBy?: string;
    /** קובץ תצוגה מקדימה: גם ערכים מוסתרים נכללים */
    preview?: boolean;
    now?: number;
}

/** טקסט בשפת היעד, ונפילה לעברית כשאין תרגום */
function text(value: { he: string } & Partial<Record<string, string>>, lang: Lang): string {
    const v = lang === "he" ? value.he : value[lang];
    return (v ?? "").trim() || value.he;
}

function blocksOf(entry: Entry, lang: Lang): PackBlock[] {
    const body = lang === "he" ? entry.body.he : entry.body[lang] ?? entry.body.he;
    const out: PackBlock[] = bodyToBlocks(body ?? "");
    for (const img of entry.images) {
        const cap = img.caption ? text(img.caption, lang) : "";
        out.push(cap ? { t: "img", src: img.src, cap } : { t: "img", src: img.src });
    }
    return out;
}

function anchorsInto(map: PackAnchorMap, entry: Entry, cat: number): number {
    let n = 0;
    for (const a of entry.anchors as Anchor[]) {
        if (!tanakhBook(a.book)) continue;         // ספר לא מוכר – לא נכנס לקובץ
        const book = (map[a.book] ??= {});
        const chapter = (book[String(a.ch)] ??= {});
        const verse = (chapter[String(a.v)] ??= []);
        if (verse.some(x => x.e === entry.id && x.w === a.w)) continue;   // כפילות
        verse.push(a.w ? { e: entry.id, cat, w: a.w } : { e: entry.id, cat });
        n++;
    }
    return n;
}

/**
 * בונה את חבילת התוכן. לא זורק על תוכן פגום: בעיות מדווחות ב-`warnings`
 * וההחלטה אם לפרסם היא של העורך.
 */
export function buildContentPack(
    entries: readonly Entry[],
    categories: readonly Category[],
    options: PublishOptions = {},
): PublishResult {
    const lang: Lang = options.lang ?? "he";
    const now = options.now ?? Date.now();
    const preview = Boolean(options.preview);

    const catId = new Map(categories.map(c => [c.key, c.legacyId]));
    const included = entries.filter(e => preview || e.visible);
    const includedIds = new Set(included.map(e => e.id));
    const byId = new Map(entries.map(e => [e.id, e]));

    const warnings: PublishWarning[] = [];
    const anchors: PackAnchorMap = {};
    const locations: PackLocation[] = [];
    const stats = { images: 0, anchors: 0, locations: 0, quotes: 0, redirects: 0 };

    const packEntries: PackEntry[] = included.map(entry => {
        const cat = catId.get(entry.cat) ?? 0;
        const warn = (message: string) => warnings.push({ entryId: entry.id, title: entry.title.he, message });
        if (!catId.has(entry.cat)) warn(`קטגוריה לא מוכרת: ${entry.cat}`);

        const xrefs: PackEntry["xrefs"] = [];
        for (const id of entry.xrefs) {
            const target = byId.get(id);
            if (!target) { warn(`ערך קשור לא קיים: ${id}`); continue; }
            if (!includedIds.has(id)) { warn(`ערך קשור מוסתר ולכן לא ייכלל: "${target.title.he}"`); continue; }
            xrefs.push({ cat: catId.get(target.cat) ?? 0, title: text(target.title, lang), id });
        }

        if (entry.see) {
            const target = byId.get(entry.see);
            if (!target) warn(`ערך ההפניה לא קיים: ${entry.see}`);
            else if (!includedIds.has(entry.see)) warn(`ההפניה מובילה לערך מוסתר: "${target.title.he}"`);
            else stats.redirects++;
        }

        if (entry.location) {
            locations.push({ id: entry.id, lat: entry.location.lat, lng: entry.location.lng, conf: entry.location.conf });
            stats.locations++;
        }
        stats.anchors += anchorsInto(anchors, entry, cat);
        stats.images += entry.images.length;
        stats.quotes += entry.quotes.length;

        const title = text(entry.title, lang);
        const alt = lang === "he" ? entry.altTitles.he : entry.altTitles[lang] ?? entry.altTitles.he;
        const out: PackEntry = {
            id: entry.id,
            cat,
            title,
            titleClean: cleanTitle(title),
            page: entry.page ?? 0,
            blocks: blocksOf(entry, lang),
            quotes: entry.quotes,
            refs: entry.refs,
            xrefs,
        };
        if (entry.see) out.see = entry.see;
        if (entry.region) out.group = text(entry.region, lang);
        if (alt?.length) out.altTitles = alt.map(cleanTitle).filter(Boolean);
        return out;
    });

    const pack: ContentPack = {
        format: PACK_FORMAT,
        version: (options.previousVersion ?? 0) + 1,
        publishedAt: now,
        lang,
        categories: categories.map(c => {
            const out: PackCategory = { id: c.legacyId, key: c.key, he: c.name.he, icon: c.icon, iconOutline: c.iconOutline };
            if (c.name.en) out.en = c.name.en;
            if (c.pages) out.pages = c.pages;
            return out;
        }),
        entries: packEntries,
        anchors,
        locations,
    };
    if (options.publishedBy) pack.publishedBy = options.publishedBy;
    if (preview) pack.preview = true;

    return { pack, included: packEntries.length, hidden: entries.length - packEntries.length, warnings, stats };
}

/** שם הקובץ לפי הערוץ */
export function packFileName(preview: boolean): string {
    return preview ? "published/preview.json" : "published/live.json";
}
