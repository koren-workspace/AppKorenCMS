import { describe, expect, it } from "vitest";
import { emptyEntry, type Entry } from "./types";
import { hasErrors, validateEntry } from "./validate";

function good(): Entry {
    const e = emptyEntry("e0203", "places", 1000);
    e.title.he = "תל שילה";
    e.body.he = "שילה הייתה מרכזו הרוחני של עם ישראל.";
    e.quotes = [{ book: "yehoshua", ch: 18, v: 1 }];
    e.refs = [{ raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 }];
    e.location = { lat: 32.0556, lng: 35.2897, conf: 1 };
    e.anchors = [{ book: "yehoshua", ch: 18, v: 1, w: "שלה" }];
    return e;
}

const ctx = { entryIds: new Set(["e0203", "e0100"]), categoryKeys: new Set(["places", "land"]) };

describe("validateEntry", () => {
    it("ערך תקין – ללא בעיות", () => {
        expect(validateEntry(good(), ctx)).toEqual([]);
    });

    it("מזהה לא תקין וכותרת חסרה – שגיאות", () => {
        const e = good();
        e.id = "E 1";
        e.title.he = "";
        const issues = validateEntry(e, ctx);
        expect(issues.map(i => i.field)).toEqual(expect.arrayContaining(["id", "title.he"]));
        expect(hasErrors(issues)).toBe(true);
    });

    it("קטגוריה לא קיימת – שגיאה", () => {
        const e = good();
        e.cat = "nope";
        expect(validateEntry(e, ctx).find(i => i.field === "cat")?.level).toBe("error");
    });

    it("גוף ריק – אזהרה בלבד, אלא אם זה ערך הפניה", () => {
        const e = good();
        e.body.he = "";
        expect(validateEntry(e, ctx)).toEqual([{ level: "warning", field: "body.he", message: "גוף הערך ריק" }]);
        e.see = "e0100";
        expect(validateEntry(e, ctx)).toEqual([]);
    });

    it("הפניה לערך שלא קיים או לעצמו – שגיאה", () => {
        const e = good();
        e.see = "e9999";
        expect(validateEntry(e, ctx).find(i => i.field === "see")?.level).toBe("error");
        e.see = "e0203";
        expect(validateEntry(e, ctx).find(i => i.field === "see")?.message).toContain("לעצמו");
    });

    it("פסוק מחוץ לטווח – שגיאה", () => {
        const e = good();
        e.quotes = [{ book: "yehoshua", ch: 99, v: 1 }];
        expect(validateEntry(e, ctx).find(i => i.field === "quotes[0]")?.level).toBe("error");
    });

    it("מראה מקום לא מזוהה – אזהרה", () => {
        const e = good();
        e.refs = [{ raw: "משנה ברכות א, א" }];
        expect(validateEntry(e, ctx).find(i => i.field === "refs[0]")?.level).toBe("warning");
    });

    it("ערך קשור לא קיים – אזהרה", () => {
        const e = good();
        e.xrefs = ["e9999"];
        expect(validateEntry(e, ctx).find(i => i.field === "xrefs[0]")?.level).toBe("warning");
    });

    it("מיקום מחוץ לאזור – אזהרה; קואורדינטה לא מספרית – שגיאה", () => {
        const e = good();
        e.location = { lat: 51.5, lng: -0.1, conf: 1 };
        expect(validateEntry(e, ctx).find(i => i.field === "location")?.level).toBe("warning");
        e.location = { lat: Number.NaN, lng: 35, conf: 1 };
        expect(validateEntry(e, ctx).find(i => i.field === "location")?.level).toBe("error");
    });

    it("בלי הקשר – לא בודק קיום ערכים וקטגוריות", () => {
        const e = good();
        e.cat = "anything";
        e.xrefs = ["e9999"];
        expect(validateEntry(e)).toEqual([]);
    });
});
