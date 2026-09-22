/**
 * הצעת תיקון למראי מקום ששברה הסריקה.
 *
 * מה שנשאר אחרי cleanRefs הוא שורות שבהן **שם הספר נכון והמספרים שבורים**:
 * "חבקוק ה, ח" (לחבקוק שלושה פרקים), "דברי הימים א" בלי פרק כלל. לתקן אותן
 * דורש לדעת על מה הערך מדבר – ובדיוק את זה אפשר לשאול את הטקסט עצמו, בלי
 * לנחש: טקסט התנ"ך המלא כבר אפוי באפליקציה, ושם הערך הוא מילה שמופיעה בפסוק.
 * "דרור · ויקרא מט" יוצא ויקרא כה, י, כי שם כתוב "וּקְרָאתֶם דְּרוֹר בָּאָרֶץ".
 *
 * שני מקורות ראיה, ורק הצטלבות ביניהם נחשבת ודאית:
 *
 * 1. **חיפוש השם** – היכן בספר הזה מופיעות מילות הכותרת (או שם נוסף).
 * 2. **שחזור מבני** – בסריקה הפרק והפסוק נדחסו זה לזה. "מלכים א לח, מה"
 *    אינו פרק 38 אלא פרק א פסוק לח; המספר השני הוא שריד. הכלל הזה נבדק
 *    מול הספר, ולכן הוא הצעה ולא הנחה.
 *
 * דירוג הביטחון נקבע מכמה מועמדים שרדו, לא מכמה הכלל "נראה נכון":
 *
 *   certain – מועמד יחיד. שתי הראיות מצביעות עליו, או שרק אחת קיימת והיא חד-משמעית.
 *   review  – עד ARGUABLE מועמדים. הרשימה קצרה דיה שאפשר להכריע בהצצה.
 *   manual  – יותר מדי, או כלום. הערך מדבר במילים כלליות ("גבולות הארץ"),
 *             או שהמספר הוא עמוד מהמפתח של הספר ולא פרק. צריך את הספר המודפס.
 *
 * הפונקציה לא כותבת ולא מחליטה – היא מציעה. ההחלטה של העורך.
 */

import { refReach, tanakhBook } from "./tanakhBooks";
import type { Entry, RefItem, VerseRef } from "./types";

/** מעבר לזה הרשימה כבר לא עוזרת לעורך, והשורה עוברת לטיפול ידני */
export const ARGUABLE = 4;

/** מילה קצרה מזה מופיעה בכל פסוק שני ולא מלמדת דבר */
const MIN_TERM = 3;

export type Confidence = "certain" | "review" | "manual";

/** טקסט התנ"ך, כפי שהוא אפוי באפליקציה. מוזרק כדי שלא ייכנס לחבילת ה-CMS. */
export interface TanakhText {
    /** פסוקי הפרק, או undefined אם הפרק אינו קיים בספר */
    verses(book: string, ch: number): readonly string[] | undefined;
}

export interface Candidate extends VerseRef {
    /** הפסוק עצמו, כדי שאפשר יהיה להכריע בלי לפתוח תנ"ך */
    text: string;
    /** האם המועמד עלה גם מהשחזור המבני ולא רק מחיפוש השם */
    structural: boolean;
}

export interface RefProposal {
    entryId: string;
    entryTitle: string;
    /** מיקום השורה ברשימת מראי המקום של הערך, מ-0 */
    index: number;
    raw: string;
    confidence: Confidence;
    candidates: Candidate[];
    /** למה אי אפשר היה להכריע – מוצג בדוח ליד שורות manual */
    note?: string;
}

/** ניקוד וסימני פיסוק מפרידים בין אותן מילים בדיוק, ולכן יורדים משני הצדדים */
export function plain(s: string): string {
    return s
        .normalize("NFC")
        .replace(/[֑-ׇ]/g, "")
        .replace(/[^א-ת]+/g, " ")
        .trim();
}

/**
 * האם המילה מופיעה בפסוק כמילה, ולא כרצף אותיות בתוך מילה אחרת.
 *
 * זו לא קפדנות יתר: "ציץ" נמצא בתוך "מֵצִיץ מִן הַחֲרַכִּים" בשיר השירים,
 * והתוצאה הייתה הצעה ודאית לפסוק שאין לו קשר לערך. מנגד שמות מקומות מופיעים
 * במקרא עם אותיות השימוש ("הַשְּׁפֵלָה", "בְּתִמְנָה"), ולכן קידומת אחת
 * מותרת – אבל רק קידומת, לא כל סיומת.
 */
export function mentions(verse: string, term: string): boolean {
    return new RegExp(`(^| )[והבכלש]?ה?${term}( |$)`).test(verse);
}

/**
 * המילים שמזהות את הערך בתוך פסוק. כותרת וכל שם נוסף, כי הערך "קרית יערים,
 * בעלה" נקרא בשני השמות במקרא ולא תמיד באותו אחד.
 */
export function searchTerms(entry: Entry): string[] {
    const sources = [entry.title?.he ?? "", ...(entry.altTitles?.he ?? [])];
    const words = sources.flatMap(s => plain(s).split(" "));
    return [...new Set(words.filter(w => w.length >= MIN_TERM))];
}

/** האם השורה בכלל צריכה תיקון: הספר מזוהה, והמספרים לא מובילים לשום מקום */
export function needsRepair(ref: RefItem): boolean {
    if (!ref.book || !tanakhBook(ref.book)) return false;
    return refReach(ref) !== "link";
}

function verseHits(text: TanakhText, book: string, terms: string[]): Omit<Candidate, "structural">[] {
    const meta = tanakhBook(book);
    if (!meta || !terms.length) return [];
    const out: Omit<Candidate, "structural">[] = [];
    for (let ch = 1; ch <= meta.chapters; ch++) {
        const verses = text.verses(book, ch);
        if (!verses) continue;
        verses.forEach((raw, i) => {
            const t = plain(raw);
            if (terms.some(term => mentions(t, term))) out.push({ book, ch, v: i + 1, text: raw });
        });
    }
    return out;
}

/**
 * מה שהמספרים השבורים יכלו להיות. רק צורות שהסריקה באמת מייצרת, ורק כאלה
 * שקיימות בספר – אחרת זו המצאה.
 */
export function structuralGuesses(text: TanakhText, ref: RefItem): VerseRef[] {
    const meta = tanakhBook(ref.book!);
    if (!meta) return [];
    const exists = (ch: number, v: number) => {
        const verses = text.verses(ref.book!, ch);
        return !!verses && v >= 1 && v <= verses.length;
    };
    const out: VerseRef[] = [];
    const add = (ch: number, v: number) => {
        if (exists(ch, v) && !out.some(r => r.ch === ch && r.v === v)) out.push({ book: ref.book!, ch, v });
    };

    // הפרק והפסוק נדחסו: "מלכים א לח, מה" = מלכים א א, לח
    if (ref.ch && ref.ch > meta.chapters) add(1, ref.ch);
    // הפסוק גלש מחוץ לפרק, אבל הפרק עצמו תקין: ייתכן שהפסוק שייך לפרק שמספרו כמוהו
    if (ref.ch && ref.v && ref.ch <= meta.chapters && !exists(ref.ch, ref.v)) add(ref.v, ref.ch);
    return out;
}

function same(a: VerseRef, b: VerseRef): boolean {
    return a.book === b.book && a.ch === b.ch && a.v === b.v;
}

/** הצעה לשורה אחת. `index` נשמר כדי שהכותב ידע איזו שורה להחליף. */
export function proposeRepair(entry: Entry, index: number, text: TanakhText): RefProposal {
    const ref = entry.refs[index];
    const meta = tanakhBook(ref.book!)!;
    const base = { entryId: entry.id, entryTitle: entry.title?.he ?? entry.id, index, raw: ref.raw };
    const terms = searchTerms(entry);
    const guesses = structuralGuesses(text, ref);
    const hits = verseHits(text, ref.book!, terms);

    // הצטלבות: מועמד שעלה גם מהשם וגם מהמבנה כמעט תמיד הנכון
    const both = hits.filter(h => guesses.some(g => same(g, h))).map(h => ({ ...h, structural: true }));
    if (both.length === 1) return { ...base, confidence: "certain", candidates: both };

    if (hits.length === 1) {
        const only = hits[0];
        const structural = guesses.some(g => same(g, only));
        // כשהפרק המקורי קיים בספר, רק הפסוק נשבר – והפרק עצמו הוא ראיה שאסור
        // לזרוק. הצעה לפרק אחר לגמרי עשויה להיות נכונה, אבל היא לא ודאית.
        const chapterHeld = !!ref.ch && ref.ch <= meta.chapters && ref.ch !== only.ch;
        const unsure = chapterHeld && !structural;
        return {
            ...base,
            confidence: unsure ? "review" : "certain",
            candidates: [{ ...only, structural }],
            ...(unsure ? { note: `הפרק ${ref.ch} קיים בספר – ייתכן שרק הפסוק שגוי` } : {}),
        };
    }

    const ranked: Candidate[] = [
        ...both,
        ...hits.filter(h => !both.some(b => same(b, h))).map(h => ({ ...h, structural: false })),
    ];

    if (!ranked.length) {
        const note = terms.length
            ? "שם הערך לא מופיע בספר הזה – ייתכן שהמספר הוא עמוד מהמפתח ולא פרק"
            : "אין בכותרת מילה מספיק ייחודית לחיפוש";
        return { ...base, confidence: "manual", candidates: [], note };
    }
    if (ranked.length <= ARGUABLE) return { ...base, confidence: "review", candidates: ranked };
    return {
        ...base,
        confidence: "manual",
        candidates: ranked.slice(0, ARGUABLE),
        note: `${ranked.length} מופעים בספר – הכותרת כללית מדי להכרעה`,
    };
}

export interface RepairReport {
    proposals: RefProposal[];
    counts: Record<Confidence, number>;
}

/** כל השורות השבורות בכל הערכים, מדורגות */
export function proposeRepairs(entries: readonly Entry[], text: TanakhText): RepairReport {
    const proposals: RefProposal[] = [];
    for (const entry of entries) {
        entry.refs.forEach((ref, i) => {
            if (needsRepair(ref)) proposals.push(proposeRepair(entry, i, text));
        });
    }
    const counts: Record<Confidence, number> = { certain: 0, review: 0, manual: 0 };
    for (const p of proposals) counts[p.confidence]++;
    return { proposals, counts };
}
