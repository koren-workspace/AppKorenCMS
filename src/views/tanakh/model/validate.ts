/**
 * אימות ערך לפני שמירה/פרסום. מחזיר רשימת בעיות; ריקה = תקין.
 *
 *   error    חוסם שמירה (שדה חובה חסר, מזהה לא תקין)
 *   warning  לא חוסם, מוצג לעורך (מיקום מחוץ לאזור, ערך קשור לא קיים…)
 */

import type { Entry, Localized } from "./types";
import { isValidVerseRef, refReach, tanakhBook } from "./tanakhBooks";

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
    level: IssueLevel;
    /** שם השדה (למשל "title.he", "quotes[2]") */
    field: string;
    message: string;
}

export interface ValidationContext {
    /** מזהי כל הערכים הקיימים – לבדיקת xrefs ו-see */
    entryIds?: ReadonlySet<string>;
    /** מפתחות הקטגוריות הקיימות */
    categoryKeys?: ReadonlySet<string>;
}

/** אותיות לטיניות קטנות, ספרות, מקף ונקודה (בגיליון יש מזהים כמו e0216.1) */
export const ENTRY_ID_PATTERN = /^[a-z][a-z0-9.-]{1,40}$/;

/** תיבת גבולות של עולם המקרא – מחוץ לה כנראה טעות הקלדה */
export const WORLD_BBOX = { latMin: 25, latMax: 38, lngMin: 30, lngMax: 49 };

function nonEmpty(v: Localized | undefined): boolean {
    return Boolean(v?.he?.trim());
}

export function validateEntry(entry: Entry, ctx: ValidationContext = {}): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const err = (field: string, message: string) => issues.push({ level: "error", field, message });
    const warn = (field: string, message: string) => issues.push({ level: "warning", field, message });

    if (!ENTRY_ID_PATTERN.test(entry.id)) err("id", "מזהה חייב להיות אותיות לטיניות קטנות, ספרות, מקפים ונקודות, ולהתחיל באות");
    if (!entry.cat) err("cat", "חסרה קטגוריה");
    else if (ctx.categoryKeys && !ctx.categoryKeys.has(entry.cat)) err("cat", `קטגוריה לא קיימת: ${entry.cat}`);

    if (!nonEmpty(entry.title)) err("title.he", "חסרה כותרת בעברית");

    if (entry.see) {
        if (ctx.entryIds && !ctx.entryIds.has(entry.see)) err("see", `ערך ההפניה לא קיים: ${entry.see}`);
        if (entry.see === entry.id) err("see", "ערך לא יכול להפנות לעצמו");
    } else if (!nonEmpty(entry.body)) {
        warn("body.he", "גוף הערך ריק");
    }

    entry.quotes.forEach((q, i) => {
        if (!tanakhBook(q.book)) err(`quotes[${i}]`, `ספר לא מוכר: ${q.book}`);
        else if (!isValidVerseRef(q)) err(`quotes[${i}]`, `הפניה מחוץ לטווח: ${q.book} ${q.ch}:${q.v}${q.v2 ? "-" + q.v2 : ""}`);
    });

    entry.refs.forEach((r, i) => {
        if (!r.raw?.trim()) err(`refs[${i}]`, "מראה מקום ריק");
        else if (!r.book) warn(`refs[${i}]`, `מראה מקום לא זוהה כהפניה לתנ"ך: ${r.raw}`);
        else if (refReach(r) === "out-of-range") {
            warn(`refs[${i}]`, `מראה מקום מחוץ לטווח: ${r.raw}`);
        }
    });

    entry.xrefs.forEach((id, i) => {
        if (id === entry.id) warn(`xrefs[${i}]`, "ערך מקשר לעצמו");
        else if (ctx.entryIds && !ctx.entryIds.has(id)) warn(`xrefs[${i}]`, `ערך קשור לא קיים: ${id}`);
    });

    if (entry.location) {
        const { lat, lng, conf } = entry.location;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) err("location", "קואורדינטות לא תקינות");
        else if (lat < WORLD_BBOX.latMin || lat > WORLD_BBOX.latMax || lng < WORLD_BBOX.lngMin || lng > WORLD_BBOX.lngMax) {
            warn("location", `המיקום (${lat}, ${lng}) מחוץ לאזור המקרא – לבדוק`);
        }
        if (![1, 2, 3].includes(conf)) err("location.conf", "רמת ביטחון חייבת להיות 1, 2 או 3");
    }

    entry.images.forEach((img, i) => {
        if (!img.src?.trim()) err(`images[${i}]`, "תמונה ללא מקור");
        if (img.kind !== "baked" && img.kind !== "storage") err(`images[${i}]`, "סוג תמונה לא מוכר");
    });

    entry.anchors.forEach((a, i) => {
        if (!tanakhBook(a.book)) err(`anchors[${i}]`, `ספר לא מוכר: ${a.book}`);
        else if (!isValidVerseRef(a)) err(`anchors[${i}]`, `קישור מהפסוקים מחוץ לטווח: ${a.book} ${a.ch}:${a.v}`);
    });

    if (entry.page !== undefined && (!Number.isInteger(entry.page) || entry.page < 0)) warn("page", "מספר עמוד לא תקין");

    return issues;
}

export function hasErrors(issues: readonly ValidationIssue[]): boolean {
    return issues.some(i => i.level === "error");
}
