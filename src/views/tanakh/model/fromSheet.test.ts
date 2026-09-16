import { describe, expect, it } from "vitest";
import { cleanTitle, columnIndex, imageBlocks, parseCoordPair, parseCsv, parseSheetRows, quoteBlocks, refItems } from "./fromSheet";
import { convertLegacyEntry } from "./fromLegacy";

describe("parseCsv", () => {
    it("שדות בגרשיים עם פסיקים, שבירות שורה וגרשיים כפולים", () => {
        const csv = 'a,"b, c","line1\nline2","say ""hi"""\r\n1,2,3,4\n';
        expect(parseCsv(csv)).toEqual([
            ["a", "b, c", "line1\nline2", 'say "hi"'],
            ["1", "2", "3", "4"],
        ]);
    });
});

describe("columnIndex", () => {
    it("מזהה כותרות בעברית ובאנגלית, סלחני לטקסט נוסף", () => {
        const col = columnIndex(["id", "קטגוריה (Category)", "כותרת (Title)", "lat", "lng", "ערך (Article)", "הערות (Notes)"]);
        expect(col.id).toBe(0);
        expect(col.cat).toBe(1);
        expect(col.title).toBe(2);
        expect(col.article).toBe(5);
        expect(col.notes).toBe(6);
        expect(col.quotes).toBe(-1);
    });
});

describe("quoteBlocks", () => {
    it("[הפניה] טקסט → בלוק פסוק עם ספר/פרק/פסוק", () => {
        expect(quoteBlocks("[יהושע יח, א] וַיִּקָּהֲלוּ")).toEqual([{ t: "q", x: "וַיִּקָּהֲלוּ", book: "yehoshua", ch: 18, v: 1 }]);
    });
    it("הפניה שלא זוהתה → טקסט בלבד", () => {
        expect(quoteBlocks("[משנה] טקסט\nבלי סוגריים")).toEqual([{ t: "q", x: "טקסט" }, { t: "q", x: "בלי סוגריים" }]);
    });
});

describe("imageBlocks / refItems / helpers", () => {
    it("תמונות עם ובלי כיתוב, מפרידים שונים", () => {
        expect(imageBlocks("e0010_79_366 — אבטיח\ne0011_1_1\ne0012_1_1 - כיתוב")).toEqual([
            { t: "img", src: "e0010_79_366", cap: "אבטיח" },
            { t: "img", src: "e0011_1_1" },
            { t: "img", src: "e0012_1_1", cap: "כיתוב" },
        ]);
    });
    it("מראי מקום מופרדים בנקודה-פסיק או שורה, מפורקים להפניה", () => {
        const refs = refItems("יהושע יח, א; חולות בחוף ניצנים\nשמות ג, ח");
        expect(refs).toEqual([
            { raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 },
            { raw: "חולות בחוף ניצנים" },
            { raw: "שמות ג, ח", book: "shemot", ch: 3, v: 8 },
        ]);
    });
    it("cleanTitle מסיר ניקוד ומקפים", () => {
        expect(cleanTitle("שִׁילֹה")).toBe("שילה");
        expect(cleanTitle("בֵּית־אֵל")).toBe("בית אל");
    });
    it("parseCoordPair דוחה טקסט וקואורדינטות מחוץ לאזור", () => {
        expect(parseCoordPair("32.05", "35.28")).toEqual({ lat: 32.05, lng: 35.28 });
        expect(parseCoordPair("32,05", "35.28")).toBeNull();
        expect(parseCoordPair("51.5", "-0.1")).toBeNull();
    });
});

describe("parseSheetRows", () => {
    const rows = [
        ["id", "קטגוריה (Category)", "כותרת (Title)", "שמות נוספים (Alt titles)", "lat", "lng", "ערך (Article)", "פסוקים (Tanakh text)", "מראי מקום (References)", "ערכים קשורים (See also)", "תמונות (Images)", "ראה (Redirect)", "אזור (Region)", "עמוד מקור (Source page)", "הערות (Notes)"],
        ["e0203", "מקומות במקרא", "שִׁילֹה, שילו", "", "32.0556", "35.2897", "פסקה.\n\n## כותרת\n\nעוד פסקה.", "[יהושע יח, א] וַיִּקָּהֲלוּ\nציטוט חופשי", "יהושע יח, א", "בית אל, לא קיים", "e0203_1_1 — התל", "", "השומרון", "300", "הערה פנימית"],
        ["e0250", "מקומות במקרא", "בֵּית אֵל", "", "", "", "עיר.", "", "", "", "", "", "", "220", ""],
        ["e0251", "קטגוריה זרה", "לוז", "", "", "", "", "", "", "", "", "בית אל", "", "221", ""],
        ["", "", "שורה בלי מזהה", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["e0252", "מקומות במקרא", "מיקום שגוי", "", "abc", "35", "", "", "", "", "", "", "", "", ""],
    ];
    const result = parseSheetRows(rows);

    it("קורא את השורות התקינות ומדלג על שורה בלי מזהה", () => {
        expect(result.rows.map(r => r.entry.id)).toEqual(["e0203", "e0250", "e0251", "e0252"]);
        expect(result.skipped).toEqual([5]);
    });

    it("מפרק את כל העמודות", () => {
        const r = result.rows[0];
        expect(r.entry.cat).toBe(4);
        expect(r.entry.titleClean).toBe("שילה");
        expect(r.entry.altTitles).toEqual(["שילו"]);
        expect(r.entry.blocks).toEqual([
            { t: "q", x: "וַיִּקָּהֲלוּ", book: "yehoshua", ch: 18, v: 1 },
            { t: "q", x: "ציטוט חופשי" },
            { t: "p", x: "פסקה." },
            { t: "h", x: "כותרת" },
            { t: "p", x: "עוד פסקה." },
            { t: "img", src: "e0203_1_1", cap: "התל" },
        ]);
        expect(r.entry.refs).toEqual([{ raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 }]);
        expect(r.entry.xrefs).toEqual([{ cat: 4, title: "בית אל" }, { cat: 4, title: "לא קיים" }]);
        expect(r.entry.group).toBe("השומרון");
        expect(r.entry.page).toBe(300);
        expect(r.location).toEqual({ id: "e0203", lat: 32.0556, lng: 35.2897, conf: 1 });
        expect(r.notes).toBe("הערה פנימית");
        expect(r.warnings).toEqual([]);
    });

    it("קטגוריה לא מוכרת → מקומות + אזהרה; הפניה נקראת", () => {
        const r = result.rows[2];
        expect(r.entry.cat).toBe(4);
        expect(r.entry.see).toBe("בית אל");
        expect(r.warnings[0]).toContain("קטגוריה לא מוכרת");
    });

    it("קואורדינטות לא תקינות → בלי מיקום + אזהרה", () => {
        const r = result.rows[3];
        expect(r.location).toBeUndefined();
        expect(r.warnings[0]).toContain("קואורדינטות לא תקינות");
    });

    it("משתלב עם convertLegacyEntry", () => {
        const r = result.rows[0];
        const e = convertLegacyEntry(r.entry, { findByTitle: t => (t === "בית אל" ? "e0250" : undefined), location: r.location, notes: r.notes }, { now: 1 });
        expect(e.quotes).toEqual([{ book: "yehoshua", ch: 18, v: 1 }]);
        expect(e.xrefs).toEqual(["e0250"]);
        expect(e.notes).toBe("הערה פנימית");
        expect(e.review).toEqual(['ציטוט לא זוהה כפסוק: "ציטוט חופשי"', 'ערך קשור לא נמצא: "לא קיים"']);
    });

    it("idForRow מקצה מזהה לשורה בלי מזהה ומסמן אותה", () => {
        const withIds = parseSheetRows(rows, { idForRow: r => (r.titleClean === "שורה בלי מזהה" ? "e9001" : undefined) });
        const assigned = withIds.rows.find(r => r.entry.id === "e9001")!;
        expect(assigned.assignedId).toBe(true);
        expect(assigned.rowNumber).toBe(5);
        expect(withIds.skipped).toEqual([]);
        expect(result.rows[0].assignedId).toBeUndefined();
        expect(result.rows[0].rowNumber).toBe(2);
    });

    it("גיליון בלי כותרות מוכרות → שגיאה", () => {
        expect(() => parseSheetRows([["a", "b"], ["1", "2"]])).toThrow();
    });
});
