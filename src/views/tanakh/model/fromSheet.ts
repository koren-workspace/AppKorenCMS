/**
 * קריאת הגיליון "ערכים" (Google Sheet, ייצוא CSV) לצורה הישנה של האפליקציה
 * (LegacyEntry), שממנה convertLegacyEntry מייצר את המודל החדש.
 *
 * זהו פורט של src/content/sheet.ts באפליקציה, עם שני שיפורים:
 *   - שורת פסוק בצורה "[יהושע יח, א] טקסט" – ההפניה שבסוגריים מפורקת
 *     (parseHebrewRef) ונשמרת על הבלוק, כך שהפסוק הופך להפניה ולא לטקסט.
 *     (האפליקציה זורקת את הסוגריים ושומרת רק את הטקסט.)
 *   - עמודת "הערות" נקראת (הערות פנימיות לעורכים).
 *
 * העמודות (זיהוי סלחני לפי מילים בכותרת, כמו באפליקציה):
 *   id · קטגוריה · כותרת · שמות נוספים · lat · lng · ערך · פסוקים ·
 *   מראי מקום · ערכים קשורים · תמונות · ראה · אזור · עמוד · הערות
 */

import type { LegacyBlock, LegacyEntry, LegacyLocation } from "./fromLegacy";
import { LEGACY_CATEGORIES } from "./categories";
import { parseHebrewRef } from "./tanakhBooks";
import { bodyToBlocks } from "./body";

// ── CSV (RFC 4180: שדות בגרשיים עם פסיקים ושבירות שורה) ──────────────────

export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let buf: string[] = [];
    let inQuotes = false;
    const endField = () => {
        row.push(buf.join(""));
        buf = [];
    };
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    buf.push('"');
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                buf.push(ch);
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ",") {
            endField();
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            endField();
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
        } else {
            buf.push(ch);
        }
    }
    if (buf.length || row.length) {
        endField();
        rows.push(row);
    }
    return rows;
}

// ── עמודות ────────────────────────────────────────────────────────────────

export type SheetColumn =
    | "id" | "cat" | "title" | "alt" | "lat" | "lng" | "article" | "quotes"
    | "refs" | "seealso" | "images" | "redirect" | "region" | "page" | "notes";

const COLUMN_TOKENS: Record<SheetColumn, string[]> = {
    id: ["id", "ID"],
    cat: ["קטגוריה", "Category"],
    title: ["כותרת", "Title"],
    alt: ["שמות נוספים", "Alt"],
    lat: ["lat"],
    lng: ["lng"],
    article: ["ערך (", "Article"],
    quotes: ["פסוקים", "Tanakh text"],
    refs: ["מראי מקום", "References"],
    seealso: ["ערכים קשורים", "See also"],
    images: ["תמונות", "Images"],
    redirect: ["ראה (", "Redirect"],
    region: ["אזור", "Region"],
    page: ["עמוד", "Source page"],
    notes: ["הערות", "Notes"],
};

export function columnIndex(headers: string[]): Record<SheetColumn, number> {
    const out = {} as Record<SheetColumn, number>;
    for (const [key, tokens] of Object.entries(COLUMN_TOKENS) as [SheetColumn, string[]][]) {
        out[key] = headers.findIndex(h => tokens.some(t => h.includes(t)));
    }
    return out;
}

// ── עזרי טקסט (זהים לאפליקציה) ───────────────────────────────────────────

/** צורת חיפוש ללא ניקוד: מקף/גרש/גרשיים → רווח, הסרת ניקוד וטעמים */
export function cleanTitle(s: string): string {
    return s
        .replace(/[־׳״]/g, " ")
        .normalize("NFKD")
        .replace(/[֐-׿]/g, m => (/[א-ת ]/.test(m) ? m : ""))
        .replace(/\s+/g, " ")
        .trim();
}

const CAT_BY_HE = new Map(LEGACY_CATEGORIES.map(c => [c.name.he, c.legacyId]));

/** מקבל תא קואורדינטה רק אם כולו מספר ובתוך תיבת הגבולות של עולם המקרא */
const BBOX = { latMin: 25, latMax: 38, lngMin: 30, lngMax: 49 };
export function parseCoordPair(latS: string, lngS: string): { lat: number; lng: number } | null {
    const num = (v: string) => (/^-?\d+(\.\d+)?$/.test(v.trim()) ? parseFloat(v.trim()) : NaN);
    const lat = num(latS);
    const lng = num(lngS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) return null;
    return { lat, lng };
}

/** שורות "פסוקים": "[הפניה] טקסט" או טקסט בלבד */
export function quoteBlocks(quotes: string): LegacyBlock[] {
    const out: LegacyBlock[] = [];
    for (const line of quotes.split(/\n/).map(l => l.trim()).filter(Boolean)) {
        const m = line.match(/^\[([^\]]*)\]\s*(.*)$/);
        if (!m) {
            out.push({ t: "q", x: line });
            continue;
        }
        const text = m[2].trim();
        const ref = parseHebrewRef(m[1]);
        if (ref.book && ref.ch && ref.v) {
            out.push({ t: "q", x: text || m[1], book: ref.book, ch: ref.ch, v: ref.v });
        } else {
            out.push({ t: "q", x: text || line });
        }
    }
    return out;
}

/** שורות "תמונות": "מזהה — כיתוב" או מזהה בלבד */
export function imageBlocks(images: string): LegacyBlock[] {
    const out: LegacyBlock[] = [];
    for (const line of images.split(/\n/).map(l => l.trim()).filter(Boolean)) {
        const m = line.match(/^([\w.-]+)(?:\s[—–-]\s(.*))?$/);
        if (!m) continue;
        out.push(m[2] ? { t: "img", src: m[1], cap: m[2].trim() } : { t: "img", src: m[1] });
    }
    return out;
}

export function refItems(refs: string): LegacyEntry["refs"] {
    return refs
        .split(/[;\n]/)
        .map(r => r.trim())
        .filter(Boolean)
        .map(raw => ({ raw, ...parseHebrewRef(raw) }));
}

// ── שורה → ערך ────────────────────────────────────────────────────────────

export interface SheetRow {
    entry: LegacyEntry;
    location?: LegacyLocation;
    notes?: string;
    /** מספר השורה בגיליון (1-based, כולל שורת הכותרות) */
    rowNumber: number;
    /** true = לשורה לא היה מזהה בגיליון והוא הוקצה דרך idForRow */
    assignedId?: boolean;
    /** בעיות בשורה שלא מנעו את הקריאה (למשל קטגוריה לא מוכרת) */
    warnings: string[];
}

export interface SheetParseResult {
    rows: SheetRow[];
    /** שורות עם תוכן שדולגו (בלי כותרת, או בלי מזהה כשאין idForRow), לפי מספר שורה */
    skipped: number[];
}

export interface SheetParseOptions {
    /**
     * מזהה לשורה שיש לה כותרת אבל אין לה מזהה בגיליון. מחזיר מזהה → השורה
     * נקלטת ומסומנת assignedId; מחזיר undefined → השורה מדולגת.
     */
    idForRow?: (row: { title: string; titleClean: string; rowNumber: number }) => string | undefined;
}

export function parseSheetRows(rows: string[][], options: SheetParseOptions = {}): SheetParseResult {
    if (rows.length < 2) throw new Error("הגיליון ריק");
    const col = columnIndex(rows[0]);
    if (col.id < 0 || col.title < 0) throw new Error("כותרות הגיליון לא זוהו (חסר id או כותרת)");

    const out: SheetRow[] = [];
    const skipped: number[] = [];
    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const rowNumber = r + 1;
        const get = (k: SheetColumn) => (col[k] >= 0 ? (row[col[k]] ?? "").trim() : "");
        let id = get("id");
        const title = get("title");
        let assignedId = false;
        if (!id && title && options.idForRow) {
            const primaryTitle = title.split(",")[0]?.trim() ?? title;
            id = options.idForRow({ title, titleClean: cleanTitle(primaryTitle), rowNumber }) ?? "";
            assignedId = Boolean(id);
        }
        if (!id || !title) {
            if (row.some(c => c.trim())) skipped.push(rowNumber);
            continue;
        }
        const warnings: string[] = [];

        const catHe = get("cat");
        let cat = CAT_BY_HE.get(catHe);
        if (!cat) {
            cat = 4;
            warnings.push(`קטגוריה לא מוכרת "${catHe}" – שויך ל"מקומות במקרא"`);
        }

        const blocks: LegacyBlock[] = [
            ...quoteBlocks(get("quotes")),
            ...bodyToBlocks(get("article")).map(b => ({ t: b.t, x: b.x }) as LegacyBlock),
            ...imageBlocks(get("images")),
        ];

        const xrefs = get("seealso")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
            .map(t => ({ cat: cat!, title: cleanTitle(t) }));

        const nameParts = title.split(",").map(s => s.trim()).filter(Boolean);
        const primary = nameParts[0] ?? title;
        const altFromCol = get("alt").split(",").map(s => s.trim()).filter(Boolean);
        const altFromTitle = nameParts.slice(1).map(p => cleanTitle(p)).filter(Boolean);
        const altTitles = Array.from(new Set([...altFromCol, ...altFromTitle]));

        const entry: LegacyEntry = {
            id,
            cat,
            title,
            titleClean: cleanTitle(primary),
            page: Number(get("page")) || 0,
            blocks,
            refs: refItems(get("refs")),
            xrefs,
        };
        if (altTitles.length) entry.altTitles = altTitles;
        const see = get("redirect");
        if (see) entry.see = cleanTitle(see);
        const region = get("region");
        if (region) entry.group = region;

        const item: SheetRow = { entry, warnings, rowNumber };
        if (assignedId) item.assignedId = true;
        const latS = get("lat");
        const lngS = get("lng");
        if (latS || lngS) {
            const coord = parseCoordPair(latS, lngS);
            if (coord) item.location = { id, lat: coord.lat, lng: coord.lng, conf: 1 };
            else warnings.push(`קואורדינטות לא תקינות ("${latS}", "${lngS}") – המיקום דולג`);
        }
        const notes = get("notes");
        if (notes) item.notes = notes;
        out.push(item);
    }
    return { rows: out, skipped };
}

/** כתובת ייצוא ה-CSV של טאב בגיליון משותף "לכל מי שיש לו את הקישור" */
export function sheetCsvUrl(sheetId: string, tab: string): string {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

/** הגיליון של המדריך (אותו מזהה כמו GUIDE_SHEET_ID באפליקציה) */
export const GUIDE_SHEET_ID = "1u85BJWl9srjWC80Ynqr3R3AXYekVy6CU0QjqT1V8jXg";
export const GUIDE_SHEET_TAB = "ערכים";
