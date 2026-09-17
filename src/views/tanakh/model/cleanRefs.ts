/**
 * ניקוי מראי מקום שההעברה הביאה מהספר הסרוק.
 *
 * שני דפוסים ניתנים לזיהוי ודאי, ורק הם מטופלים אוטומטית:
 *
 * 1. **שורה שאינה הפניה כלל** – אין בה שום שם ספר. כמעט תמיד כיתוב תמונה
 *    שנחת בעמודה הלא נכונה ("חולות בחוף ניצנים").
 * 2. **מראי מקום על ערך הפניה ריק** – ערך שכל תוכנו "ראה X" לא אמור להחזיק
 *    ביבליוגרפיה משלו; היא שייכת ל-X. בפועל אלה שאריות זליגה מערך שכן.
 *    התנאי "ריק" אינו קישוט: בהעברה יש ערכי הפניה שבלעו גם גוף של ערך שכן
 *    (e0063 "ענף עץ עבות" מחזיק את הערך "עץ" על 61 מראי המקום שלו). שם
 *    מראי המקום כן שייכים לתוכן שבפנים, ולכן ערך הפניה עם גוף רק מדווח.
 *
 * **שום שורה לא נמחקת.** היא עוברת לשדה ההערות הפנימיות, שאינו מתפרסם, כדי
 * שאפשר יהיה להחזיר אותה למקומה הנכון. ניקוי אינו איבוד מידע.
 *
 * לפני שמחליטים ששורה אינה הפניה, מנסים **לשחזר** אותה: המפרק דורש ששם
 * הספר יהיה בתחילת השורה, ובסריקה נדבקה לרבות מהן קידומת – מספר הערת שוליים
 * ("534 יחזקאל מז, טז") או סימון הערה באותיות ומקף ("כ- מלכים ב׳ ג, ט").
 * הסרת הקידומת מחזירה הפניה תקינה לגמרי, ולכן השורה **מתוקנת במקום** ולא
 * מועברת: היא הופכת לקישור לחיץ באפליקציה. זה לא ניחוש – שם הספר כתוב נכון,
 * רק היה מוסתר מאחורי רעש.
 *
 * מה שלא מטופל כאן, בכוונה: הפניה עם פרק או פסוק מחוץ לטווח, שבר כמו
 * "308 מח" (מספר הערה ופרק, בלי שם ספר, שנשאר בשורה הקודמת בעמוד), ושם ספר
 * פגום בסריקה ("יהשע", "חזקאל"). לתקן אותם דורש להבין על מה הערך מדבר, ולכן
 * הם מדווחים לטיפול ידני או לשלב ההזנה בעזרת AI. ניחוש גרוע מלהשאיר שבור.
 * שורה שנראית כהפניה פגומה לא מועברת להערות – בספק, לא נוגעים.
 */

import { isValidVerseRef, parseHebrewRef, tanakhBook, TANAKH_BOOKS } from "./tanakhBooks";
import type { Entry, RefItem } from "./types";

export type MoveReason = "no-book" | "redirect";

export const MOVE_REASON_LABELS: Record<MoveReason, string> = {
    "no-book": "לא זוהה שם ספר – כנראה כיתוב תמונה",
    redirect: "ערך הפניה לא אמור להחזיק מראי מקום",
};

export type ProblemKind = "out-of-range" | "fragment" | "damaged-book";

export const PROBLEM_LABELS: Record<ProblemKind, string> = {
    "out-of-range": "פרק או פסוק מחוץ לטווח הספר",
    fragment: "שבר: מספר ופרק בלי שם ספר",
    "damaged-book": "נראה כמראה מקום ששם הספר בו פגום – לא נגענו",
};

export interface MovedRef {
    raw: string;
    reason: MoveReason;
}

export interface ProblemRef {
    raw: string;
    kind: ProblemKind;
}

export interface RepairedRef {
    from: string;
    to: string;
}

export interface CleanResult {
    entry: Entry;
    moved: MovedRef[];
    /** שורות שהיו "בלי שם ספר" ותוקנו במקום */
    repaired: RepairedRef[];
    /** נשארו במקומם ודורשים עין אנושית */
    problems: ProblemRef[];
    changed: boolean;
}

/** כותרת הבלוק שנוסף להערות – קבועה, כדי שאפשר יהיה לזהות ולבטל */
export const NOTES_HEADER = "מראי מקום שהועברו בניקוי אוטומטי";

function isReference(r: RefItem): boolean {
    return Boolean(r.book && tanakhBook(r.book));
}

/**
 * מסיר קידומת שנדבקה בסריקה לפני שם הספר: מספר הערת שוליים ("534 יחזקאל…")
 * או סימון הערה באותיות ומקף ("כ- מלכים ב׳…").
 */
export function stripRefPrefix(raw: string): string {
    return raw
        .replace(/^\s*\d+\s*,?\s*/, "")
        .replace(/^\s*[א-ת]{1,3}\s*[-–—]\s*/, "")
        .trim();
}

/**
 * שורה בלי שם ספר שהסרת הקידומת הופכת להפניה תקינה. מחזיר את ההפניה
 * המתוקנת, או null אם אין מה לשחזר.
 */
export function salvageRef(raw: string): RefItem | null {
    const stripped = stripRefPrefix(raw);
    if (stripped === raw.trim()) return null;
    const p = parseHebrewRef(stripped);
    if (!p.book || !tanakhBook(p.book)) return null;
    const out: RefItem = { raw: stripped, book: p.book };
    if (p.ch) out.ch = p.ch;
    if (p.v) out.v = p.v;
    if (p.v2) out.v2 = p.v2;
    return out;
}

/** מרחק עריכה 1 לכל היותר: אות חסרה, עודפת או מוחלפת */
function withinOneEdit(a: string, b: string): boolean {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    let i = 0, j = 0, diff = 0;
    while (i < short.length && j < long.length) {
        if (short[i] === long[j]) { i++; j++; continue; }
        if (++diff > 1) return false;
        if (short.length === long.length) i++;
        j++;
    }
    return diff + (long.length - j) <= 1;
}

const BOOK_NAMES = TANAKH_BOOKS.map(b => b.he);

/**
 * שורה שנראית כהפניה ששם הספר בה נפגם בסריקה ("יהשע", "חזקאל", "ירמיה").
 * שמות ספרי התנ"ך קצרים, ולכן המבחן מחזיר גם כיתובי תמונה בודדים
 * ("דבורים" רחוקה אות אחת מ"דברים") – וזה הכיוון הבטוח: שורה כזו פשוט
 * נשארת במקומה ומדווחת, במקום להסתכן בהעברת מראה מקום אמיתי.
 */
export function looksLikeDamagedBook(raw: string): boolean {
    const tokens = stripRefPrefix(raw).split(/[\s,]+/).filter(Boolean);
    if (!tokens.length) return false;
    const first = tokens[0];
    const two = tokens.slice(0, 2).join(" ");
    return BOOK_NAMES.some(n => withinOneEdit(first, n) || withinOneEdit(two, n));
}

/** בעיה שנשארת אחרי הניקוי (לדיווח בלבד) */
export function problemOf(r: RefItem): ProblemKind | null {
    if (!isReference(r)) return null;               // כזה כבר הועבר
    if (r.ch && r.v && !isValidVerseRef({ book: r.book!, ch: r.ch, v: r.v, v2: r.v2 })) return "out-of-range";
    if (r.ch && !isValidVerseRef({ book: r.book!, ch: r.ch, v: 1 })) return "out-of-range";
    if (/^\s*\d/.test(r.raw)) return "fragment";
    return null;
}

function appendToNotes(notes: string | undefined, moved: MovedRef[], date: string): string {
    const lines = moved.map(m => `• ${m.raw}  (${MOVE_REASON_LABELS[m.reason]})`);
    const block = [`${NOTES_HEADER} (${date}):`, ...lines].join("\n");
    return notes?.trim() ? `${notes.trim()}\n\n${block}` : block;
}

/**
 * מחזיר עותק מנוקה של הערך. אם אין מה לנקות, `changed` הוא false והערך
 * המקורי מוחזר כמות שהוא (בלי חותמת זמן מיותרת בשמירה).
 */
export function cleanEntryRefs(entry: Entry, now: number = Date.now()): CleanResult {
    // הפניה "אמיתית": מפנה הלאה ואין בה תוכן משלה
    const redirect = Boolean(entry.see) && !entry.body.he.trim();
    const moved: MovedRef[] = [];
    const repaired: RepairedRef[] = [];
    const kept: RefItem[] = [];

    for (const r of entry.refs) {
        if (redirect) { moved.push({ raw: r.raw, reason: "redirect" }); continue; }
        if (isReference(r)) { kept.push(r); continue; }

        const fixed = salvageRef(r.raw);
        if (fixed) { repaired.push({ from: r.raw, to: fixed.raw }); kept.push(fixed); continue; }
        // בספק – משאירים. העברת מראה מקום אמיתי גרועה מהשארת כיתוב תמונה.
        if (looksLikeDamagedBook(r.raw)) { kept.push(r); continue; }
        moved.push({ raw: r.raw, reason: "no-book" });
    }

    const problems: ProblemRef[] = [];
    for (const r of kept) {
        const kind = isReference(r) ? problemOf(r) : "damaged-book";
        if (kind) problems.push({ raw: r.raw, kind });
    }
    if (!moved.length && !repaired.length) return { entry, moved, repaired, problems, changed: false };

    const date = new Date(now).toISOString().slice(0, 10);
    const next: Entry = { ...entry, refs: kept };
    if (moved.length) next.notes = appendToNotes(entry.notes, moved, date);
    return { entry: next, moved, repaired, problems, changed: true };
}
