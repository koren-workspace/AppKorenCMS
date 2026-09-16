/**
 * זיהוי ציטוט לפי הטקסט: מקבל טקסט של פסוק (עם או בלי ניקוד, טעמים,
 * מקפים) ומחזיר את ההפניה אליו בתנ"ך, כולל טווח כשהציטוט משתרע על כמה
 * פסוקים רצופים.
 *
 * הטקסט המקראי מגיע מקובצי הספרים של האפליקציה (assets/content/tanakh/*.json,
 * מקרא על פי המסורה). ההשוואה על צורה מנורמלת: אותיות עבריות ורווחים בלבד.
 *
 * אלגוריתם: מפתח = 3 המילים הראשונות של הציטוט המנורמל. לכל פסוק שמכיל את
 * המפתח בודקים אם הציטוט כולו הוא רצף (תת-מחרוזת) של הפסוק, או של הפסוק
 * ביחד עם הפסוקים שאחריו באותו פרק. התאמה יחידה → הפניה; אפס או יותר
 * מאחת → undefined (עדיף לסמן לבדיקה מאשר לנחש).
 */

import type { VerseRef } from "./types";

export interface TanakhBookText {
    id: string;
    /** chapters[ch-1][v-1].t = טקסט הפסוק */
    chapters: { t: string }[][];
}

/** שם ה' כפי שנכתב במדריך (ה' / ה׳ / ד') → כפי שהוא בטקסט המקראי */
const DIVINE_NAME = "יהוה";

/**
 * אותיות עבריות ורווחים בלבד: NFKC (ﬠ→ע), הסרת ניקוד/טעמים, מקף → רווח,
 * וקיצורי שם ה' מומרים לשם המלא כדי שיתאימו לטקסט המקראי.
 */
export function normalizeHebrew(s: string): string {
    return s
        .normalize("NFKC")
        .replace(/(^|[^א-ת])[הד]['׳](?=$|[^א-ת])/g, `$1${DIVINE_NAME}`)
        .replace(/[־‐-―-]/g, " ")
        .replace(/[^א-ת\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** אורך המפתח באינדקס (מילים). מאונדקסים גם מפתחות קצרים יותר (2) לקטע פתיחה קצר. */
const KEY_WORDS = 3;
const MIN_KEY_WORDS = 2;
/** ציטוט קצר מזה (במילים, בכל הקטעים יחד) לא מזוהה – סיכוי גבוה מדי להתאמות מרובות */
const MIN_WORDS = 3;

interface Indexed {
    book: string;
    ch: number;
    v: number;
    norm: string;
}

export class QuoteResolver {
    private byKey = new Map<string, Indexed[]>();
    private chapters = new Map<string, string[]>(); // `${book}/${ch}` → normalized verses

    constructor(books: readonly TanakhBookText[]) {
        for (const book of books) {
            book.chapters.forEach((verses, ci) => {
                const norms = verses.map(v => normalizeHebrew(v.t));
                this.chapters.set(`${book.id}/${ci + 1}`, norms);
                norms.forEach((norm, vi) => {
                    const words = norm.split(" ").filter(Boolean);
                    // מפתחות שמתחילים בפסוק הזה, כולל כאלה שנמשכים לתחילת הפסוק הבא,
                    // כדי שציטוט שמתחיל בסוף פסוק ונמשך לפסוק הבא יימצא
                    const next = (norms[vi + 1] ?? "").split(" ").filter(Boolean).slice(0, KEY_WORDS - 1);
                    const extended = [...words, ...next];
                    for (let i = 0; i < words.length; i++) {
                        for (let len = MIN_KEY_WORDS; len <= KEY_WORDS && i + len <= extended.length; len++) {
                            const key = extended.slice(i, i + len).join(" ");
                            const arr = this.byKey.get(key) ?? [];
                            arr.push({ book: book.id, ch: ci + 1, v: vi + 1, norm });
                            this.byKey.set(key, arr);
                        }
                    }
                });
            });
        }
    }

    /**
     * ציטוט עם השמטות ("...") מפורק לקטעים; כל קטע חייב להופיע, לפי הסדר,
     * בפסוק המתחיל או בפסוקים שאחריו באותו פרק. הטווח = מהפסוק של הקטע
     * הראשון עד הפסוק של האחרון.
     */
    resolve(text: string): VerseRef | undefined {
        const segments = text
            .split(/\.{3,}|…/)
            .map(normalizeHebrew)
            .filter(Boolean);
        if (!segments.length) return undefined;
        const firstWords = segments[0].split(" ").filter(Boolean);
        const totalWords = segments.reduce((n, s) => n + s.split(" ").length, 0);
        if (totalWords < MIN_WORDS || firstWords.length < MIN_KEY_WORDS) return undefined;
        const candidates = this.byKey.get(firstWords.slice(0, Math.min(KEY_WORDS, firstWords.length)).join(" "));
        if (!candidates?.length) return undefined;

        const matches: VerseRef[] = [];
        const seen = new Set<string>();
        for (const c of candidates) {
            const k = `${c.book}/${c.ch}/${c.v}`;
            if (seen.has(k)) continue;
            seen.add(k);
            const ref = this.matchFrom(c, segments);
            if (ref) matches.push(ref);
        }
        return matches.length === 1 ? matches[0] : undefined;
    }

    /** האם הקטעים מופיעים לפי הסדר מהפסוק הזה והלאה (באותו פרק) */
    private matchFrom(start: Indexed, segments: string[]): VerseRef | undefined {
        const verses = this.chapters.get(`${start.book}/${start.ch}`) ?? [];
        // מחפשים בתוך חלון של עד MAX_SPAN פסוקים, כמחרוזת אחת עם מיקומי גבולות
        const MAX_SPAN = 12;
        let joined = "";
        const bounds: number[] = []; // אינדקס תו שבו מתחיל כל פסוק בחלון
        for (let v = start.v; v <= Math.min(verses.length, start.v + MAX_SPAN - 1); v++) {
            if (joined) joined += " ";
            bounds.push(joined.length);
            joined += verses[v - 1];
        }
        let pos = 0;
        let lastEnd = -1;
        for (let i = 0; i < segments.length; i++) {
            const at = joined.indexOf(segments[i], pos);
            if (at < 0) return undefined;
            // הקטע הראשון חייב להתחיל בפסוק ההתחלה עצמו (זה מה שהאינדקס הבטיח)
            if (i === 0 && bounds.length > 1 && at >= bounds[1]) return undefined;
            pos = at + segments[i].length;
            lastEnd = pos;
        }
        let endVerseOffset = 0;
        while (endVerseOffset + 1 < bounds.length && bounds[endVerseOffset + 1] <= lastEnd) endVerseOffset++;
        const ref: VerseRef = { book: start.book, ch: start.ch, v: start.v };
        if (endVerseOffset > 0) ref.v2 = start.v + endVerseOffset;
        return ref;
    }
}
