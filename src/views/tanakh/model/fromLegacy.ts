/**
 * המרה מהתוכן הקיים של האפליקציה (entries.json, locations.json, anchors.json)
 * למודל החדש. משמשת את סקריפט ההעברה בשלב 3, ופועלת גם על התוכן שנמשך
 * מהגיליון (שם התבנית זהה, ראו sheet.ts באפליקציה).
 *
 * מה נעשה עם כל דבר:
 *   - בלוקים p / h / sci          → גוף הערך (טקסט עם סימונים)
 *   - בלוק q עם ספר/פרק/פסוק      → quotes (הפניה בלבד)
 *   - בלוק q בלי הפניה מזוהה      → מנסים resolveQuote; אחרת נשאר בגוף
 *                                    כציטוט "> " עם הערת בדיקה
 *   - בלוק img                    → images (kind "baked")
 *   - xrefs עם id                 → xrefs; בלי id → זיהוי לפי כותרת, אחרת
 *                                    הערת בדיקה
 *   - see (כותרת נקייה)           → זיהוי לפי כותרת; אחרת הערת בדיקה
 *   - group → region, page → page, altTitles → altTitles
 *   - locations.json               → location
 *   - anchors.json                 → anchors (מקובצים לפי ערך)
 */

import type { Anchor, Entry, EntryImage, RefItem, VerseRef } from "./types";
import type { BodyBlock } from "./body";
import { blocksToBody } from "./body";
import { categoryKeyOfLegacyId } from "./categories";

// ── הצורות הישנות (עותק של src/content/types.ts באפליקציה) ────────────────

export type LegacyBlock =
    | { t: "p"; x: string }
    | { t: "h"; x: string }
    | { t: "q"; x: string; book?: string; ch?: number; v?: number }
    | { t: "img"; src: string; cap?: string }
    | { t: "sci"; x: string };

export interface LegacyEntry {
    id: string;
    cat: number;
    title: string;
    titleClean: string;
    page: number;
    blocks: LegacyBlock[];
    refs: { n?: number; book?: string; ch?: number; v?: number; v2?: number; raw: string }[];
    xrefs: { cat: number; title: string; id?: string | null }[];
    see?: string;
    group?: string;
    altTitles?: string[];
}

export interface LegacyLocation {
    id: string;
    lat: number;
    lng: number;
    conf: number;
}

/** anchors.json: book → chapter → verse → [{ e, cat, w? }] */
export type LegacyAnchorMap = Record<string, Record<string, Record<string, { e: string; cat: number; w?: string }[]>>>;

export interface ConvertOptions {
    /** חותמת זמן ליצירה/עדכון (ברירת מחדל: עכשיו) */
    now?: number;
    updatedBy?: string;
    /** ניסיון לזהות ציטוט ללא הפניה מול טקסט התנ"ך (סקריפט ההעברה מספק) */
    resolveQuote?: (text: string) => VerseRef | undefined;
}

// ── זיהוי לפי כותרת (אותו אלגוריתם כמו ContentContext.findByTitle באפליקציה) ──

const lettersOnly = (s: string) => (s ?? "").replace(/[^א-ת]/g, "");
const skeleton = (s: string) => lettersOnly(s).replace(/[וי]/g, "");

/** אינדקס כותרת → מזהה ערך (ללא ערכי הפניה), עם התאמה סלחנית לכתיב מלא/חסר */
export function buildTitleIndex(entries: readonly LegacyEntry[]): (title: string) => string | undefined {
    const exact = new Map<string, string>();
    const bySkeleton = new Map<string, string>();
    for (const e of entries) {
        if (e.see) continue;
        const names = [e.titleClean, ...(e.altTitles ?? []), ...e.title.split(",").map(p => p.trim())];
        for (const n of names) {
            const k = lettersOnly(n);
            if (k.length >= 2 && !exact.has(k)) exact.set(k, e.id);
            const sk = skeleton(n);
            if (sk.length >= 2 && !bySkeleton.has(sk)) bySkeleton.set(sk, e.id);
        }
    }
    return (title: string) => {
        const q = lettersOnly(title);
        if (q.length < 2) return undefined;
        return exact.get(q) ?? bySkeleton.get(skeleton(title));
    };
}

// ── ההמרה ─────────────────────────────────────────────────────────────────

function clampConf(conf: number): 1 | 2 | 3 {
    return conf === 1 || conf === 2 ? conf : 3;
}

/** קיבוץ anchors.json לפי מזהה ערך, ממוינים לפי ספר/פרק/פסוק */
export function anchorsByEntry(map: LegacyAnchorMap): Map<string, Anchor[]> {
    const out = new Map<string, Anchor[]>();
    for (const [book, chapters] of Object.entries(map)) {
        for (const [ch, verses] of Object.entries(chapters)) {
            for (const [v, list] of Object.entries(verses)) {
                for (const a of list) {
                    const anchor: Anchor = { book, ch: Number(ch), v: Number(v) };
                    if (a.w) anchor.w = a.w;
                    const arr = out.get(a.e) ?? [];
                    arr.push(anchor);
                    out.set(a.e, arr);
                }
            }
        }
    }
    return out;
}

export function convertLegacyEntry(
    legacy: LegacyEntry,
    ctx: {
        findByTitle: (title: string) => string | undefined;
        location?: LegacyLocation;
        anchors?: Anchor[];
        /** הערות פנימיות (עמודת "הערות" בגיליון) */
        notes?: string;
    },
    options: ConvertOptions = {},
): Entry {
    const now = options.now ?? Date.now();
    const review: string[] = [];
    const bodyBlocks: BodyBlock[] = [];
    const quotes: VerseRef[] = [];
    const images: EntryImage[] = [];

    for (const b of legacy.blocks) {
        switch (b.t) {
            case "p":
            case "h":
            case "sci":
                bodyBlocks.push({ t: b.t, x: b.x });
                break;
            case "q": {
                if (b.book && b.ch && b.v) {
                    quotes.push({ book: b.book, ch: b.ch, v: b.v });
                    break;
                }
                const resolved = options.resolveQuote?.(b.x);
                if (resolved) {
                    quotes.push(resolved);
                } else {
                    bodyBlocks.push({ t: "q", x: b.x });
                    review.push(`ציטוט לא זוהה כפסוק: "${b.x.slice(0, 40)}${b.x.length > 40 ? "…" : ""}"`);
                }
                break;
            }
            case "img": {
                const img: EntryImage = { kind: "baked", src: b.src };
                if (b.cap) img.caption = { he: b.cap };
                images.push(img);
                break;
            }
        }
    }

    const xrefs: string[] = [];
    for (const x of legacy.xrefs) {
        const id = x.id ?? ctx.findByTitle(x.title);
        if (id && id !== legacy.id) {
            if (!xrefs.includes(id)) xrefs.push(id);
        } else if (!id) {
            review.push(`ערך קשור לא נמצא: "${x.title}"`);
        }
    }

    let see: string | undefined;
    if (legacy.see) {
        see = ctx.findByTitle(legacy.see);
        if (!see) review.push(`ערך ההפניה ("ראה") לא נמצא: "${legacy.see}"`);
    }

    const refs: RefItem[] = legacy.refs.map(r => {
        const item: RefItem = { raw: r.raw };
        if (r.n !== undefined) item.n = r.n;
        if (r.book) item.book = r.book;
        if (r.ch !== undefined) item.ch = r.ch;
        if (r.v !== undefined) item.v = r.v;
        if (r.v2 !== undefined) item.v2 = r.v2;
        return item;
    });

    const entry: Entry = {
        id: legacy.id,
        cat: categoryKeyOfLegacyId(legacy.cat),
        title: { he: legacy.title },
        altTitles: { he: [...(legacy.altTitles ?? [])] },
        body: { he: blocksToBody(bodyBlocks) },
        quotes,
        refs,
        xrefs,
        images,
        anchors: ctx.anchors ?? [],
        visible: true,
        i18n: {},
        review,
        createdAt: now,
        updatedAt: now,
    };
    if (see) entry.see = see;
    if (legacy.group) entry.region = { he: legacy.group };
    if (legacy.page) entry.page = legacy.page;
    if (ctx.location) {
        entry.location = { lat: ctx.location.lat, lng: ctx.location.lng, conf: clampConf(ctx.location.conf) };
    }
    if (ctx.notes) entry.notes = ctx.notes;
    if (options.updatedBy) entry.updatedBy = options.updatedBy;
    return entry;
}

/** המרת חבילת תוכן שלמה */
export function convertLegacyContent(
    entries: readonly LegacyEntry[],
    locations: readonly LegacyLocation[],
    anchors: LegacyAnchorMap,
    options: ConvertOptions = {},
): Entry[] {
    const findByTitle = buildTitleIndex(entries);
    const locationById = new Map(locations.map(l => [l.id, l]));
    const anchorsById = anchorsByEntry(anchors);
    return entries.map(e =>
        convertLegacyEntry(e, {
            findByTitle,
            location: locationById.get(e.id),
            anchors: anchorsById.get(e.id),
        }, options),
    );
}
