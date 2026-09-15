import { describe, expect, it } from "vitest";
import { blocksToBody, bodyPlainText, bodyToBlocks, type BodyBlock } from "./body";

describe("bodyToBlocks", () => {
    it("פסקאות מופרדות בשורה ריקה", () => {
        expect(bodyToBlocks("פסקה ראשונה\n\nפסקה שנייה")).toEqual([
            { t: "p", x: "פסקה ראשונה" },
            { t: "p", x: "פסקה שנייה" },
        ]);
    });

    it("מזהה כותרת משנה, ציטוט והערה מדעית", () => {
        expect(bodyToBlocks("## כותרת\n\n> ציטוט\n\n~ הערה")).toEqual([
            { t: "h", x: "כותרת" },
            { t: "q", x: "ציטוט" },
            { t: "sci", x: "הערה" },
        ]);
    });

    it("הסימון חל על השורה הראשונה בלבד; ההמשך פסקה נפרדת", () => {
        expect(bodyToBlocks("## כותרת\nגוף")).toEqual([
            { t: "h", x: "כותרת" },
            { t: "p", x: "גוף" },
        ]);
    });

    it("מתעלם משורות ריקות מרובות ומ-CRLF", () => {
        expect(bodyToBlocks("א\r\n\r\n\r\n\r\nב\r\n")).toEqual([
            { t: "p", x: "א" },
            { t: "p", x: "ב" },
        ]);
    });

    it("טקסט ריק → אין בלוקים", () => {
        expect(bodyToBlocks("")).toEqual([]);
        expect(bodyToBlocks("  \n\n  ")).toEqual([]);
    });
});

describe("blocksToBody", () => {
    it("הלוך ושוב שומר על התוכן", () => {
        const blocks: BodyBlock[] = [
            { t: "p", x: "פתיחה" },
            { t: "h", x: "כותרת" },
            { t: "q", x: "ציטוט" },
            { t: "sci", x: "הערה" },
            { t: "p", x: "סיום" },
        ];
        expect(bodyToBlocks(blocksToBody(blocks))).toEqual(blocks);
    });

    it("מדלג על בלוקים ריקים", () => {
        expect(blocksToBody([{ t: "p", x: "  " }, { t: "p", x: "א" }])).toBe("א");
    });
});

describe("bodyPlainText", () => {
    it("מסיר סימונים", () => {
        expect(bodyPlainText("## כותרת\n\nטקסט")).toBe("כותרת\nטקסט");
    });
});
