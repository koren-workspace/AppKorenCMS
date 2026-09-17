import { describe, expect, it } from "vitest";
import { cleanEntryRefs, NOTES_HEADER, problemOf } from "./cleanRefs";
import { emptyEntry, type Entry, type RefItem } from "./types";

const NOW = Date.UTC(2026, 8, 17);

function entry(patch: Partial<Entry> = {}): Entry {
    return { ...emptyEntry("e0001", "places", 1), title: { he: "בדיקה" }, ...patch };
}
const ref = (raw: string, rest: Partial<RefItem> = {}): RefItem => ({ raw, ...rest });

describe("cleanEntryRefs", () => {
    it("מעביר שורה בלי שם ספר להערות ומשאיר את השאר", () => {
        const e = entry({ refs: [ref("יהושע יח, א", { book: "yehoshua", ch: 18, v: 1 }), ref("חולות בחוף ניצנים")] });
        const r = cleanEntryRefs(e, NOW);
        expect(r.changed).toBe(true);
        expect(r.entry.refs.map(x => x.raw)).toEqual(["יהושע יח, א"]);
        expect(r.moved).toEqual([{ raw: "חולות בחוף ניצנים", reason: "no-book" }]);
        expect(r.entry.notes).toContain(NOTES_HEADER);
        expect(r.entry.notes).toContain("חולות בחוף ניצנים");
        expect(r.entry.notes).toContain("2026-09-17");
    });

    it("ערך הפניה ריק מאבד את כל מראי המקום, גם תקינים", () => {
        const e = entry({ see: "e0440", refs: [ref("ירמיהו מו, יד", { book: "yirmiyahu", ch: 46, v: 14 })] });
        const r = cleanEntryRefs(e, NOW);
        expect(r.entry.refs).toEqual([]);
        expect(r.moved[0].reason).toBe("redirect");
    });

    it("ערך הפניה שיש בו גוף – לא נוגעים במראי המקום שלו", () => {
        const e = entry({
            see: "e0037",
            body: { he: "המילה עץ נזכרת 329 פעמים במקרא." },
            refs: [ref("יחזקאל ד, ט", { book: "yechezkel", ch: 4, v: 9 })],
        });
        const r = cleanEntryRefs(e, NOW);
        expect(r.changed).toBe(false);
        expect(r.entry.refs).toHaveLength(1);
    });

    it("שומר על הערות קיימות ומוסיף מתחתן", () => {
        const e = entry({ notes: "הערה של עורך", refs: [ref("כיתוב תמונה")] });
        const r = cleanEntryRefs(e, NOW);
        expect(r.entry.notes?.startsWith("הערה של עורך")).toBe(true);
        expect(r.entry.notes).toContain(NOTES_HEADER);
    });

    it("אין מה לנקות – הערך מוחזר כמות שהוא", () => {
        const e = entry({ refs: [ref("יהושע יח, א", { book: "yehoshua", ch: 18, v: 1 })] });
        const r = cleanEntryRefs(e, NOW);
        expect(r.changed).toBe(false);
        expect(r.entry).toBe(e);
        expect(r.entry.notes).toBeUndefined();
    });

    it("הרצה שנייה לא מוסיפה שוב", () => {
        const e = entry({ refs: [ref("כיתוב תמונה")] });
        const once = cleanEntryRefs(e, NOW);
        const twice = cleanEntryRefs(once.entry, NOW);
        expect(twice.changed).toBe(false);
        expect(twice.entry.notes).toBe(once.entry.notes);
    });

    it("לא נוגע בשדות אחרים", () => {
        const e = entry({ title: { he: "שילה" }, page: 300, xrefs: ["e0300"], refs: [ref("כיתוב")] });
        const r = cleanEntryRefs(e, NOW);
        expect(r.entry.title).toEqual({ he: "שילה" });
        expect(r.entry.page).toBe(300);
        expect(r.entry.xrefs).toEqual(["e0300"]);
    });

    it("מדווח על מה שנשאר ודורש עין אנושית", () => {
        const e = entry({
            refs: [
                ref("מלכים א לה, יז", { book: "melakhim-a", ch: 35, v: 17 }),
                ref("יהושע יח, א", { book: "yehoshua", ch: 18, v: 1 }),
            ],
        });
        const r = cleanEntryRefs(e, NOW);
        expect(r.problems).toEqual([{ raw: "מלכים א לה, יז", kind: "out-of-range" }]);
        expect(r.changed).toBe(false);   // דיווח בלבד, בלי שינוי
    });
});

describe("problemOf", () => {
    it("פרק מחוץ לטווח", () => {
        expect(problemOf({ raw: "יהושע כט", book: "yehoshua", ch: 29 })).toBe("out-of-range");
    });
    it("פסוק מחוץ לטווח", () => {
        expect(problemOf({ raw: "בראשית יג, כ", book: "bereshit", ch: 13, v: 20 })).toBe("out-of-range");
    });
    it("הפניה לפרק שלם תקינה", () => {
        expect(problemOf({ raw: "שמואל ב ח", book: "shmuel-b", ch: 8 })).toBeNull();
    });
    it("הפניה תקינה", () => {
        expect(problemOf({ raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 })).toBeNull();
    });
    it("שורה בלי ספר אינה 'בעיה' – היא מועברת", () => {
        expect(problemOf({ raw: "כיתוב תמונה" })).toBeNull();
    });
});
