/**
 * textFixes – החלת תיקוני טקסט שאושרו בגיליון ההשוואה מול הספר המודפס.
 *
 * כל תיקון הוא זוג "טקסט באפליקציה" → "טקסט מתוקן" בערך אחד. התיקון מוחל
 * רק אם הטקסט הישן נמצא בערך **בדיוק פעם אחת** – בגוף הערך, בכיתוב תמונה
 * או בכותרת. כל מצב אחר (לא נמצא, נמצא יותר מפעם אחת, כבר תוקן) מדווח
 * ולא נוגעים בו. כך תיקון לא ידרוס טקסט שעורך כבר שינה ידנית.
 *
 * ההשוואה סובלנית להבדל אחד בלתי נראה: סדר סימני הניקוד על אות (דגש לפני
 * התנועה או אחריה). האותיות והסימנים עצמם חייבים להיות זהים.
 */

import type { Entry, Localized } from "./types";

export interface TextFix {
    /** שורה בגיליון, לדיווח */
    row: number;
    entryId: string;
    find: string;
    replace: string;
}

export type FixStatus =
    | "applied" // הוחל
    | "already" // הטקסט הישן לא נמצא והמתוקן כן – כבר תוקן
    | "not-found" // הטקסט הישן לא נמצא
    | "ambiguous" // הטקסט הישן נמצא יותר מפעם אחת
    | "no-entry" // אין ערך כזה
    | "empty"; // שורה בלי טקסט לתיקון

export type FixField = "body" | "caption" | "title";

export interface FixResult {
    fix: TextFix;
    status: FixStatus;
    field?: FixField;
    /** קטע קצר לפני ואחרי, לדוח */
    before?: string;
    after?: string;
}

/** מחרוזת אחרי נרמול כל אות-עם-סימנים בנפרד, ומיפוי חזרה לאינדקסים במקור */
interface Normalized {
    s: string;
    /** starts[k] = אינדקס במקור שבו מתחיל התו ה-k של s (ועוד אחד בסוף) */
    starts: number[];
    /** האם תו k ב-s הוא תחילת אשכול (אות + הסימנים שלה) */
    boundary: boolean[];
}

const COMBINING = /\p{M}/u;

function normalize(src: string): Normalized {
    let s = "";
    const starts: number[] = [];
    const boundary: boolean[] = [];
    let i = 0;
    while (i < src.length) {
        let j = i + 1;
        while (j < src.length && COMBINING.test(src[j])) j++;
        const cluster = src.slice(i, j).normalize("NFC");
        for (let k = 0; k < cluster.length; k++) {
            // תו בתוך אשכול ממופה לתחילת האשכול; החיתוך תמיד על גבול אשכול
            starts.push(i);
            boundary.push(k === 0);
        }
        s += cluster;
        i = j;
    }
    starts.push(src.length);
    boundary.push(true);
    return { s, starts, boundary };
}

/** כל המופעים של needle ב-hay, כטווחים במקור. רק מופעים שמתחילים ונגמרים בגבול אשכול. */
export function findAll(hay: string, needle: string): [number, number][] {
    if (!needle) return [];
    const exact: [number, number][] = [];
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) exact.push([i, i + needle.length]);
    if (exact.length) return exact;

    const h = normalize(hay);
    const n = normalize(needle).s;
    const out: [number, number][] = [];
    for (let i = h.s.indexOf(n); i >= 0; i = h.s.indexOf(n, i + 1)) {
        const end = i + n.length;
        if (!h.boundary[i] || !h.boundary[end]) continue;
        out.push([h.starts[i], h.starts[end]]);
    }
    return out;
}

/**
 * מחיקה (תיקון ריק): מדביק את שני הצדדים בלי להשאיר רווח כפול או פסקה
 * ריקה. נוגע רק ברווחים שצמודים לקטע שנמחק – שאר הערך לא זז.
 */
export function splice(text: string, from: number, to: number, replace: string): string {
    if (replace) return text.slice(0, from) + replace + text.slice(to);
    const left = text.slice(0, from).replace(/\s+$/, "");
    const right = text.slice(to).replace(/^\s+/, "");
    if (!left) return right;
    if (!right) return left;
    const gap = text.slice(left.length, from) + text.slice(to, text.length - right.length);
    const newlines = (gap.match(/\n/g) ?? []).length;
    return left + (newlines >= 2 ? "\n\n" : newlines === 1 ? "\n" : " ") + right;
}

function snippet(text: string, from: number, to: number, pad = 40): string {
    const a = Math.max(0, from - pad);
    const b = Math.min(text.length, to + pad);
    return (a > 0 ? "…" : "") + text.slice(a, b).replace(/\n+/g, " ¶ ") + (b < text.length ? "…" : "");
}

/** המקומות בערך שתיקון יכול לגעת בהם */
function slots(entry: Entry): { field: FixField; get: () => string; set: (v: string) => void }[] {
    const out: { field: FixField; get: () => string; set: (v: string) => void }[] = [
        { field: "body", get: () => entry.body.he ?? "", set: v => (entry.body = { ...entry.body, he: v }) },
    ];
    entry.images.forEach((img, i) => {
        if (!img.caption?.he) return;
        out.push({
            field: "caption",
            get: () => entry.images[i].caption?.he ?? "",
            set: v => {
                const images = entry.images.slice();
                images[i] = { ...images[i], caption: { ...(images[i].caption as Localized), he: v } };
                entry.images = images;
            },
        });
    });
    out.push({ field: "title", get: () => entry.title.he, set: v => (entry.title = { ...entry.title, he: v }) });
    return out;
}

/**
 * מחיל את התיקונים על עותק של הערכים. מחזיר את הערכים ששונו ותוצאה לכל תיקון.
 * התיקונים של אותו ערך מוחלים לפי הסדר, כל אחד על התוצאה של קודמו.
 */
export function applyTextFixes(entries: readonly Entry[], fixes: readonly TextFix[]): { changed: Map<string, Entry>; results: FixResult[] } {
    const byId = new Map(entries.map(e => [e.id, e]));
    const changed = new Map<string, Entry>();
    const results: FixResult[] = [];

    for (const fix of fixes) {
        if (!fix.find) {
            results.push({ fix, status: "empty" });
            continue;
        }
        const base = changed.get(fix.entryId) ?? byId.get(fix.entryId);
        if (!base) {
            results.push({ fix, status: "no-entry" });
            continue;
        }
        const entry: Entry = structuredClone(base);

        const hits: { slot: ReturnType<typeof slots>[number]; range: [number, number] }[] = [];
        for (const slot of slots(entry)) {
            for (const range of findAll(slot.get(), fix.find)) hits.push({ slot, range });
        }
        if (hits.length > 1) {
            results.push({ fix, status: "ambiguous", before: hits.map(h => snippet(h.slot.get(), ...h.range)).join("  |  ") });
            continue;
        }
        if (!hits.length) {
            const done = fix.replace && slots(entry).some(s => findAll(s.get(), fix.replace).length > 0);
            results.push({ fix, status: done ? "already" : "not-found" });
            continue;
        }

        const { slot, range } = hits[0];
        const old = slot.get();
        const next = splice(old, range[0], range[1], fix.replace);
        slot.set(next);
        changed.set(entry.id, entry);
        const at = Math.min(range[0], next.length);
        results.push({
            fix,
            status: "applied",
            field: slot.field,
            before: snippet(old, range[0], range[1]),
            after: snippet(next, at, Math.min(next.length, at + fix.replace.length)),
        });
    }
    return { changed, results };
}
