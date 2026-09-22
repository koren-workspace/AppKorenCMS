import { describe, expect, it } from "vitest";

import { mentions, needsRepair, plain, proposeRepair, proposeRepairs, searchTerms, structuralGuesses, type TanakhText } from "./repairRefs";
import type { Entry, RefItem } from "./types";

/** תנ"ך מזויף קטן: רק מה שהבדיקות צריכות, באותה צורה שהאפליקציה אופה */
const BOOKS: Record<string, string[][]> = {
    // לחבקוק שלושה פרקים – מספיק כדי ש"חבקוק ה" ייצא מחוץ לטווח
    chavakuk: [
        ["וַיִּשָּׂא הַנֶּשֶׁר", "בְּ", "קַלּוּ מִנְּמֵרִים סוּסָיו וְחַדּוּ מִזְּאֵבֵי עֶרֶב"],
        ["א", "ב"],
        ["עִיר שָלֵם"],
    ],
    ovadya: [["חֲזוֹן עֹבַדְיָה", "הִנֵּה קָטֹן נְתַתִּיךָ"]],
};

const text: TanakhText = { verses: (book, ch) => BOOKS[book]?.[ch - 1] };

function entry(over: Partial<Entry> = {}): Entry {
    return {
        id: "e0146",
        title: { he: "נֶשֶׁר" },
        altTitles: { he: [] },
        refs: [],
        ...over,
    } as unknown as Entry;
}

describe("plain", () => {
    it("מסיר ניקוד וסימני פיסוק", () => {
        expect(plain("וַיִּשָּׂא הַנֶּשֶׁר׃")).toBe("וישא הנשר");
    });
});

describe("searchTerms", () => {
    it("אוסף כותרת ושמות נוספים, בלי מילים קצרות", () => {
        const e = entry({ title: { he: "רָמֹת גִּלְעָד" }, altTitles: { he: ["רָמֹת בַּגִּלְעָד"] } });
        expect(searchTerms(e)).toEqual(["רמת", "גלעד", "בגלעד"]);
    });

    it("מילה בת שתי אותיות לא נכנסת", () => {
        expect(searchTerms(entry({ title: { he: "עַי" } }))).toEqual([]);
    });
});

describe("needsRepair", () => {
    const ok = (r: Partial<RefItem>) => needsRepair({ raw: "", ...r } as RefItem);

    it("שורה שתעבוד באפליקציה אינה זקוקה לתיקון", () => {
        expect(ok({ book: "chavakuk", ch: 1, v: 1 })).toBe(false);
        expect(ok({ book: "ovadya", ch: 1 })).toBe(false); // ספר+פרק מספיק
    });

    it("פרק מחוץ לטווח, או ספר בלי פרק, כן", () => {
        expect(ok({ book: "chavakuk", ch: 5, v: 8 })).toBe(true);
        expect(ok({ book: "chavakuk" })).toBe(true);
    });

    it("שורה בלי ספר מזוהה אינה שייכת לכאן – היא לא הפניה", () => {
        expect(ok({})).toBe(false);
        expect(ok({ book: "mishna", ch: 1 })).toBe(false);
    });
});

describe("structuralGuesses", () => {
    it("פרק מחוץ לטווח נקרא כפסוק של פרק א", () => {
        const g = structuralGuesses(text, { raw: "", book: "chavakuk", ch: 3, v: 1 } as RefItem);
        expect(g).toEqual([]); // פרק 3 קיים – אין מה לשחזר
        expect(structuralGuesses(text, { raw: "", book: "chavakuk", ch: 5 } as RefItem))
            .toEqual([]); // לפרק א שלושה פסוקים בלבד, ו-5 אינו אחד מהם
    });

    it("לא מציע פסוק שאינו קיים בספר", () => {
        const g = structuralGuesses(text, { raw: "", book: "chavakuk", ch: 99, v: 99 } as RefItem);
        expect(g).toEqual([]);
    });
});

describe("proposeRepair", () => {
    it("מופע יחיד של שם הערך – ודאי", () => {
        // "חבקוק ה, ח": הספר נכון, המספרים שבורים. "נשר" מופיע פעם אחת בלבד.
        const e = entry({ refs: [{ raw: "חבקוק ה, ח", book: "chavakuk", ch: 5, v: 8 }] as RefItem[] });
        const p = proposeRepair(e, 0, text);
        expect(p.confidence).toBe("certain");
        expect(p.candidates).toHaveLength(1);
        expect(p.candidates[0]).toMatchObject({ book: "chavakuk", ch: 1, v: 1 });
    });

    it("שם שלא מופיע בספר – ידני, עם הסבר", () => {
        const e = entry({ title: { he: "תַּדְמֹר" }, refs: [{ raw: "חבקוק ה", book: "chavakuk", ch: 5 }] as RefItem[] });
        const p = proposeRepair(e, 0, text);
        expect(p.confidence).toBe("manual");
        expect(p.candidates).toEqual([]);
        expect(p.note).toContain("לא מופיע");
    });

    it("כמה מופעים בודדים – לבדיקה, עם הפסוקים עצמם", () => {
        const e = entry({ title: { he: "עֶרֶב" }, altTitles: { he: ["נֶשֶׁר"] }, refs: [{ raw: "חבקוק ה", book: "chavakuk", ch: 5 }] as RefItem[] });
        const p = proposeRepair(e, 0, text);
        expect(p.confidence).toBe("review");
        expect(p.candidates.length).toBeGreaterThan(1);
        expect(p.candidates[0].text).toBeTruthy();
    });

    it("שומר את מיקום השורה, כדי שהכותב ידע מה להחליף", () => {
        const refs = [
            { raw: "חבקוק א, א", book: "chavakuk", ch: 1, v: 1 },
            { raw: "חבקוק ה, ח", book: "chavakuk", ch: 5, v: 8 },
        ] as RefItem[];
        expect(proposeRepair(entry({ refs }), 1, text).index).toBe(1);
    });
});

describe("proposeRepairs", () => {
    it("עובר רק על השורות השבורות וסופר לפי ביטחון", () => {
        const e = entry({
            refs: [
                { raw: "חבקוק א, א", book: "chavakuk", ch: 1, v: 1 }, // תקינה
                { raw: "חבקוק ה, ח", book: "chavakuk", ch: 5, v: 8 }, // ודאית
                { raw: "כיתוב תמונה" }, // לא הפניה כלל – לא שייכת לכאן
            ] as RefItem[],
        });
        const { proposals, counts } = proposeRepairs([e], text);
        expect(proposals).toHaveLength(1);
        expect(counts).toEqual({ certain: 1, review: 0, manual: 0 });
    });
});

describe("mentions", () => {
    it("מילה שלמה, עם אות שימוש או בלעדיה", () => {
        expect(mentions("וישא הנשר", "נשר")).toBe(true);
        expect(mentions("ויעל בהר השפלה", "שפלה")).toBe(true);
        expect(mentions("תמנה", "תמנה")).toBe(true);
    });

    // "ציץ" בתוך "מציץ מן החרכים" הפיק בעבר הצעה ודאית לפסוק שאינו קשור לערך
    it("לא רצף אותיות בתוך מילה אחרת", () => {
        expect(mentions("עומד אחר כתלנו מציץ מן החרכים", "ציץ")).toBe(false);
        expect(mentions("ויהי ערב", "רב")).toBe(false);
    });
});

describe("פרק מקורי תקין", () => {
    // כשרק הפסוק גלש מחוץ לפרק, הפרק שנכתב הוא ראיה – והצעה לפרק אחר
    // יורדת ל"לבדיקה" במקום להיכתב אוטומטית.
    it("מוריד מועמד יחיד בפרק אחר ל-לבדיקה", () => {
        // "שלם" מופיע רק בפרק ג, והשורה מציינת פרק א שקיים – עם פסוק שאינו קיים בו
        const e = entry({
            title: { he: "שָלֵם" },
            refs: [{ raw: "חבקוק א, ט", book: "chavakuk", ch: 1, v: 9 }] as RefItem[],
        });
        const p = proposeRepair(e, 0, text);
        expect(p.confidence).toBe("review");
        expect(p.note).toContain("קיים בספר");
    });

    it("אבל פרק שאינו קיים אינו ראיה – נשאר ודאי", () => {
        const e = entry({ refs: [{ raw: "חבקוק ה, ח", book: "chavakuk", ch: 5, v: 8 }] as RefItem[] });
        expect(proposeRepair(e, 0, text).confidence).toBe("certain");
    });
});
