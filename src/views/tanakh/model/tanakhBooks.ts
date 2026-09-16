/**
 * ספרי התנ"ך – מטא-נתונים לאימות הפניות (ספר, פרק, פסוק).
 * הקובץ tanakhIndex.json הוא עותק של assets/content/tanakh/index.json
 * מריפו האפליקציה (מקרא על פי המסורה, CC-BY-SA); הטקסט עצמו לא כאן.
 */

import index from "./tanakhIndex.json";

export interface TanakhBook {
    id: string;
    he: string;
    en: string;
    group: "torah" | "neviim" | "ketuvim";
    order: number;
    chapters: number;
    /** מספר הפסוקים בכל פרק (אינדקס 0 = פרק א) */
    verses: number[];
}

export const TANAKH_BOOKS: readonly TanakhBook[] = (index as { books: TanakhBook[] }).books;

const BY_ID = new Map(TANAKH_BOOKS.map(b => [b.id, b]));

export function tanakhBook(id: string): TanakhBook | undefined {
    return BY_ID.get(id);
}

/** האם ההפניה קיימת בתנ"ך (ספר, פרק ופסוק בטווח) */
export function isValidVerseRef(ref: { book: string; ch: number; v: number; v2?: number }): boolean {
    const book = BY_ID.get(ref.book);
    if (!book) return false;
    if (!Number.isInteger(ref.ch) || ref.ch < 1 || ref.ch > book.chapters) return false;
    const verses = book.verses[ref.ch - 1] ?? 0;
    if (!Number.isInteger(ref.v) || ref.v < 1 || ref.v > verses) return false;
    if (ref.v2 !== undefined && (!Number.isInteger(ref.v2) || ref.v2 <= ref.v || ref.v2 > verses)) return false;
    return true;
}

// ── פירוק מראה מקום בעברית ("יהושע יח, א" / "שיר השירים ד, יב–יד") ────────

const GEMATRIA: Record<string, number> = {
    א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
    י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90,
    ק: 100, ר: 200, ש: 300, ת: 400,
    ך: 20, ם: 40, ן: 50, ף: 80, ץ: 90,
};

function gematria(s: string): number {
    const letters = s.replace(/[^א-ת]/g, "");
    if (!letters) return 0;
    let n = 0;
    for (const c of letters) n += GEMATRIA[c] ?? 0;
    return n > 0 && n <= 999 ? n : 0;
}

// שמות ספרים, הארוך קודם, כדי ש"שמואל א" ינצח את "שמואל"
const BOOK_BY_HE = [...TANAKH_BOOKS]
    .map(b => ({ he: b.he, id: b.id }))
    .sort((a, b) => b.he.length - a.he.length);

export type ParsedRef = { book?: string; ch?: number; v?: number; v2?: number };

/**
 * מפרק מראה מקום בעברית להפניה. מחזיר רק את השדות שזוהו; `book` חסר = לא
 * זוהה ספר. אותו אלגוריתם כמו hebrefs.ts באפליקציה, כדי שהתוצאות יתאימו.
 */
export function parseHebrewRef(raw: string): ParsedRef {
    const s = raw.trim();
    const out: ParsedRef = {};
    let rest = s;
    for (const { he, id } of BOOK_BY_HE) {
        if (rest.startsWith(he)) {
            out.book = id;
            rest = rest.slice(he.length).trim();
            break;
        }
    }
    if (!out.book) return out;
    const parts = rest.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 1) {
        const ch = gematria(parts[0]);
        if (ch) out.ch = ch;
    }
    if (parts.length >= 2) {
        const vm = parts[1].match(/^([א-ת]+)\s*[–-]\s*([א-ת]+)$/);
        if (vm) {
            const v = gematria(vm[1]);
            const v2 = gematria(vm[2]);
            if (v) out.v = v;
            if (v2 && v2 > v) out.v2 = v2;
        } else {
            const v = gematria(parts[1]);
            if (v) out.v = v;
        }
    }
    return out;
}
