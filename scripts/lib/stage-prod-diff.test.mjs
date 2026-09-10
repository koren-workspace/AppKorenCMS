/**
 * בדיקות לסיווג ההפרשים של compare-stage-prod-items.
 *
 * מה שנבדק כאן הוא ההבחנה בין "רעש" ל"התנגשות אמיתית". סיווג שגוי משמעו דוח
 * שמסתיר פריטים שאבדה בהם עריכה, או שמציף אותם ברעש — בשני המקרים הסקריפט
 * מפספס את מטרתו.
 */

import { describe, it, expect } from "vitest";
import {
    deepEqual,
    diffDocs,
    isDefaultValue,
    nextPublishOutcome,
} from "./stage-prod-diff.mjs";

describe("isDefaultValue", () => {
    it("בוליאני: false הוא ברירת מחדל, true אינו", () => {
        expect(isDefaultValue("noSpace", false)).toBe(true);
        expect(isDefaultValue("noSpace", true)).toBe(false);
    });

    it("מחרוזת אופציונלית: ריק ורווחים בלבד הם ברירת מחדל", () => {
        expect(isDefaultValue("title", "")).toBe(true);
        expect(isDefaultValue("title", "   ")).toBe(true);
        expect(isDefaultValue("title", "כותרת")).toBe(false);
    });

    it("תלת־מצבי: רק null הוא ברירת מחדל – false הוא ערך אמיתי", () => {
        expect(isDefaultValue("minyan", null)).toBe(true);
        // false = "רק ביחיד", משמעותי לחלוטין באפליקציה (types/content.ts)
        expect(isDefaultValue("minyan", false)).toBe(false);
        expect(isDefaultValue("minyan", true)).toBe(false);
    });

    it("שדה שאינו ברשימות – שום ערך אינו ברירת מחדל", () => {
        expect(isDefaultValue("content", "")).toBe(false);
        expect(isDefaultValue("dateSetId", "")).toBe(false);
        expect(isDefaultValue("partId", false)).toBe(false);
    });
});

describe("deepEqual", () => {
    it("משווה מערכים לעומק ולפי סדר", () => {
        expect(deepEqual(["1", "2"], ["1", "2"])).toBe(true);
        expect(deepEqual(["1", "2"], ["2", "1"])).toBe(false);
        expect(deepEqual(["1"], ["1", "2"])).toBe(false);
    });

    it("מבחין בין null, undefined ו-false", () => {
        expect(deepEqual(null, undefined)).toBe(false);
        expect(deepEqual(false, null)).toBe(false);
        expect(deepEqual(0, false)).toBe(false);
    });
});

describe("diffDocs", () => {
    it("מסמכים זהים – אין הפרשים", () => {
        expect(diffDocs({ content: "א", partId: "1" }, { content: "א", partId: "1" })).toEqual([]);
    });

    it("מתעלם מ-timestamp", () => {
        expect(diffDocs({ content: "א", timestamp: 1 }, { content: "א", timestamp: 999 })).toEqual([]);
    });

    it("התרחיש של noSpace – ערכים הפוכים בשני הצדדים = התנגשות אמיתית", () => {
        const diffs = diffDocs(
            { content: "אֲנִי מַאֲמִין", noSpace: true },
            { content: "אֲנִי מַאֲמִין", noSpace: false }
        );
        expect(diffs).toEqual([{ field: "noSpace", stage: true, prod: false, noise: false }]);
    });

    it("bold: false בפרוד מול היעדר בסטייג' = רעש", () => {
        const diffs = diffDocs({ content: "א" }, { content: "א", bold: false });
        expect(diffs).toEqual([
            { field: "bold", stage: undefined, prod: false, noise: true },
        ]);
    });

    it("cohanim: null בפרוד מול היעדר בסטייג' = רעש", () => {
        const diffs = diffDocs({ content: "א" }, { content: "א", cohanim: null });
        expect(diffs[0].noise).toBe(true);
    });

    it("שדה עם ערך אמיתי שקיים רק בצד אחד = התנגשות, לא רעש", () => {
        // כותרת שקיימת בסטייג' וחסרה בפרוד היא הפרש תוכן לכל דבר
        const diffs = diffDocs({ content: "א", title: "כותרת" }, { content: "א" });
        expect(diffs).toEqual([
            { field: "title", stage: "כותרת", prod: undefined, noise: false },
        ]);
    });

    it("minyan: false שקיים רק בצד אחד = התנגשות (תלת־מצבי)", () => {
        const diffs = diffDocs({ content: "א", minyan: false }, { content: "א" });
        expect(diffs[0].noise).toBe(false);
    });

    it("מפריד בין רעש להתנגשות באותו מסמך", () => {
        const diffs = diffDocs(
            { content: "א", noSpace: true },
            { content: "ב", noSpace: false, bold: false }
        );
        const real = diffs.filter((d) => !d.noise).map((d) => d.field).sort();
        const noise = diffs.filter((d) => d.noise).map((d) => d.field);
        expect(real).toEqual(["content", "noSpace"]);
        expect(noise).toEqual(["bold"]);
    });
});

describe("nextPublishOutcome", () => {
    it("סטייג' חדש יותר – ידרוס את פרוד", () => {
        expect(nextPublishOutcome(200, 100)).toBe("סטייג' ידרוס את פרוד");
    });

    it("חותמות שוות – סטייג' גובר, כמו ב-shouldCopyToProd", () => {
        expect(nextPublishOutcome(100, 100)).toBe("סטייג' ידרוס את פרוד");
    });

    it("פרוד חדש יותר – הפרסום מדלג", () => {
        expect(nextPublishOutcome(100, 200)).toBe("הפרסום ידלג (פרוד חדש יותר)");
    });

    it("חותמת חסרה נחשבת 0", () => {
        expect(nextPublishOutcome(undefined, 5)).toBe("הפרסום ידלג (פרוד חדש יותר)");
        expect(nextPublishOutcome(undefined, undefined)).toBe("סטייג' ידרוס את פרוד");
    });
});
