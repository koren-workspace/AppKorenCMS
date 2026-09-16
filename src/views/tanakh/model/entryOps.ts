/**
 * פעולות טהורות על ערכים (בלי Firestore, בלי React) – לשימוש מסך העריכה
 * ולבדיקות.
 */

import { sourceHashOf } from "./hash";
import type { Entry, TargetLang } from "./types";
import { TARGET_LANGS } from "./types";

/**
 * הטווח e0001–e0999 שמור לתוכן המקורי (הספר והגיליון, כולל מזהים שההעברה
 * מקצה). ערכים שנוצרים ב-CMS מתחילים מ-e1000, כדי שערך שנוצר לפני ההעברה
 * לא יתפוס מזהה של ערך אמיתי.
 */
export const CMS_ID_FLOOR = 1000;

/** המזהה הבא לערך חדש ב-CMS: גדול מכל מזהה מספרי קיים, ולא פחות מ-e1000 */
export function nextEntryId(existingIds: Iterable<string>): string {
    let max = CMS_ID_FLOOR - 1;
    for (const id of existingIds) {
        const m = id.match(/^e(\d{4,})$/);
        if (m) max = Math.max(max, Number(m[1]));
    }
    return `e${String(max + 1).padStart(4, "0")}`;
}

/**
 * מכין ערך לשמירה: חותמת זמן ומשתמש, וסימון תרגומים כ"לא מעודכן" (stale)
 * כשהמקור העברי השתנה מאז שתורגמו. לא משנה את הקלט.
 */
export function prepareEntryForSave(next: Entry, user: string | undefined, now: number = Date.now()): Entry {
    const out: Entry = structuredClone(next);
    out.updatedAt = now;
    if (user) out.updatedBy = user;
    else delete out.updatedBy;
    if (!out.createdAt) out.createdAt = now;

    const hash = sourceHashOf(out);
    for (const lang of TARGET_LANGS) {
        const state = out.i18n[lang];
        if (!state) continue;
        if (state.sourceHash && state.sourceHash !== hash && state.status !== "stale") {
            out.i18n[lang] = { ...state, status: "stale" };
        }
    }
    return out;
}

/** סימון ידני של מצב תרגום (נבדק / מאושר) – מקבע את hash המקור הנוכחי */
export function setTranslationStatus(entry: Entry, lang: TargetLang, status: "reviewed" | "approved", user: string | undefined, now: number = Date.now()): Entry {
    const out: Entry = structuredClone(entry);
    const prev = out.i18n[lang];
    out.i18n[lang] = { ...(prev ?? {}), status, updatedAt: now, updatedBy: user, sourceHash: sourceHashOf(out) };
    return out;
}

/** האם יש טקסט בשפת היעד (לפחות כותרת או גוף) */
export function hasTranslation(entry: Entry, lang: TargetLang): boolean {
    return Boolean(entry.title[lang]?.trim() || entry.body[lang]?.trim());
}

/** מסיר undefined (Firestore לא מקבל) בלי לשנות את הקלט */
export function stripUndefined<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

/** שוויון תוכני, לזיהוי "יש שינויים שלא נשמרו" */
export function entriesEqual(a: Entry, b: Entry): boolean {
    const norm = (e: Entry) => {
        const { updatedAt: _u, updatedBy: _b, ...rest } = stripUndefined(e);
        return JSON.stringify(rest);
    };
    return norm(a) === norm(b);
}
