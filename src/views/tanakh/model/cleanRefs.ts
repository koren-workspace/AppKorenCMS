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
 * מה שלא מטופל כאן, בכוונה: הפניה עם פרק או פסוק מחוץ לטווח, ושבר כמו
 * "308 מח" (מספר הערת שוליים ופרק, בלי שם ספר, שנשאר בשורה הקודמת בעמוד).
 * לתקן אותם דורש להבין על מה הערך מדבר, ולכן הם מדווחים לטיפול ידני או
 * לשלב ההזנה בעזרת AI. ניחוש כאן גרוע מלהשאיר שבור.
 */

import { isValidVerseRef, tanakhBook } from "./tanakhBooks";
import type { Entry, RefItem } from "./types";

export type MoveReason = "no-book" | "redirect";

export const MOVE_REASON_LABELS: Record<MoveReason, string> = {
    "no-book": "לא זוהה שם ספר – כנראה כיתוב תמונה",
    redirect: "ערך הפניה לא אמור להחזיק מראי מקום",
};

export type ProblemKind = "out-of-range" | "fragment";

export const PROBLEM_LABELS: Record<ProblemKind, string> = {
    "out-of-range": "פרק או פסוק מחוץ לטווח הספר",
    fragment: "שבר: מספר ופרק בלי שם ספר",
};

export interface MovedRef {
    raw: string;
    reason: MoveReason;
}

export interface ProblemRef {
    raw: string;
    kind: ProblemKind;
}

export interface CleanResult {
    entry: Entry;
    moved: MovedRef[];
    /** נשארו במקומם ודורשים עין אנושית */
    problems: ProblemRef[];
    changed: boolean;
}

/** כותרת הבלוק שנוסף להערות – קבועה, כדי שאפשר יהיה לזהות ולבטל */
export const NOTES_HEADER = "מראי מקום שהועברו בניקוי אוטומטי";

function isReference(r: RefItem): boolean {
    return Boolean(r.book && tanakhBook(r.book));
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
    const kept: RefItem[] = [];

    for (const r of entry.refs) {
        if (redirect) moved.push({ raw: r.raw, reason: "redirect" });
        else if (!isReference(r)) moved.push({ raw: r.raw, reason: "no-book" });
        else kept.push(r);
    }

    const problems = kept.map(r => ({ raw: r.raw, kind: problemOf(r) })).filter((p): p is ProblemRef => p.kind !== null);
    if (!moved.length) return { entry, moved, problems, changed: false };

    const date = new Date(now).toISOString().slice(0, 10);
    const next: Entry = { ...entry, refs: kept, notes: appendToNotes(entry.notes, moved, date) };
    return { entry: next, moved, problems, changed: true };
}
