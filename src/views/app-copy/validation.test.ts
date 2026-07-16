import { describe, expect, it } from "vitest";
import { extractPlaceholders, placeholdersMatch, validateCopyEdit } from "./validation";
import { diffForPublish } from "./services/appCopyService";
import type { AppCopyDoc } from "./types";

describe("extractPlaceholders", () => {
    it("מזהה %s רציפים", () => {
        expect(extractPlaceholders("Today, %s")).toEqual(["%s"]);
        expect(extractPlaceholders("%s of %s")).toEqual(["%s", "%s"]);
    });

    it("מזהה מיקומיים %1$s ולא סופר אותם כ-%s", () => {
        expect(extractPlaceholders("%2$s לפני %1$s")).toEqual(["%1$s", "%2$s"]);
    });

    it("טקסט בלי placeholders מחזיר רשימה ריקה", () => {
        expect(extractPlaceholders("שלום עולם 100%")).toEqual([]);
    });
});

describe("placeholdersMatch", () => {
    it("סדר הופעה שונה עדיין תואם (מיקומיים)", () => {
        expect(placeholdersMatch("a %1$s b %2$s", "%2$s ואז %1$s")).toBe(true);
    });

    it("כמות %s שונה לא תואמת", () => {
        expect(placeholdersMatch("%s", "%s %s")).toBe(false);
    });
});

describe("validateCopyEdit", () => {
    const original = { he: "היום, %s", en: "Today, %s" };

    it("עריכה ששומרת placeholders – תקינה", () => {
        expect(
            validateCopyEdit(original, { he: "התאריך: %s", en: "Date: %s" })
        ).toEqual([]);
    });

    it("מחיקת placeholder נחסמת", () => {
        const errors = validateCopyEdit(original, { he: "היום", en: "Today, %s" });
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe("he");
    });

    it("הוספת placeholder שלא היה נחסמת", () => {
        const noPh = { he: "שלום", en: "Hello" };
        const errors = validateCopyEdit(noPh, { he: "שלום %s", en: "Hello" });
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe("he");
        expect(errors[0].message).toContain("להוסיף");
    });

    it("ריקון שדה שהיה מלא נחסם", () => {
        const errors = validateCopyEdit(original, { he: "", en: "Today, %s" });
        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe("he");
        expect(errors[0].message).toContain("לרוקן");
    });

    it("שדה שהיה ריק ונשאר ריק – תקין; מילוי שדה ריק נבדק מול השפה השנייה", () => {
        const heEmpty = { he: "", en: "Today, %s" };
        expect(validateCopyEdit(heEmpty, { he: "", en: "Today, %s" })).toEqual([]);
        // מילוי עברית בלי ה-placeholder של האנגלית – נחסם
        expect(validateCopyEdit(heEmpty, { he: "היום", en: "Today, %s" })).toHaveLength(1);
        // מילוי עם ה-placeholder – תקין
        expect(validateCopyEdit(heEmpty, { he: "היום, %s", en: "Today, %s" })).toEqual([]);
    });
});

describe("diffForPublish", () => {
    const doc = (key: string, he: string, en: string, timestamp = 1): AppCopyDoc => ({
        key,
        he,
        en,
        category: "כללי",
        description: "",
        order: 0,
        timestamp,
    });

    it("מחזיר רק מפתחות ששונים בפרוד, ומתעלם מ-timestamp", () => {
        const stage = [doc("a", "א", "A", 100), doc("b", "ב", "B", 100)];
        const prod = [doc("a", "א", "A", 5), doc("b", "ישן", "B", 5)];
        expect(diffForPublish(stage, prod).map(d => d.key)).toEqual(["b"]);
    });

    it("מפתח חדש שלא קיים בפרוד נכלל", () => {
        const stage = [doc("a", "א", "A"), doc("new_key", "חדש", "New")];
        const prod = [doc("a", "א", "A")];
        expect(diffForPublish(stage, prod).map(d => d.key)).toEqual(["new_key"]);
    });
});
