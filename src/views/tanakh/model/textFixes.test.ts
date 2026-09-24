import { describe, expect, it } from "vitest";

import { applyTextFixes, findAll, splice, type TextFix } from "./textFixes";
import type { Entry } from "./types";

function entry(over: Partial<Entry> = {}): Entry {
    return {
        id: "e0001",
        title: { he: "עַכּוֹ" },
        body: { he: "" },
        images: [],
        ...over,
    } as unknown as Entry;
}

const fix = (find: string, replace: string, entryId = "e0001", row = 2): TextFix => ({ row, entryId, find, replace });

describe("findAll", () => {
    it("מוצא התאמה מדויקת", () => {
        expect(findAll("אבג דהו אבג", "אבג")).toEqual([
            [0, 3],
            [8, 11],
        ]);
    });

    it("סובלני לסדר דגש ותנועה", () => {
        // בערך: ב + דגש + קמץ; בחיפוש: ב + קמץ + דגש
        const hay = "וְהַבָּיִת";
        const needle = "הַבָּ";
        expect(hay.includes(needle)).toBe(false);
        expect(findAll(hay, needle)).toEqual([[2, 7]]);
    });

    it("לא מתאים לאות בלי הסימן שלה", () => {
        // "בר" לא אמור להתאים ל"בָּר" – הסימנים חלק מהאות
        expect(findAll("בָּר", "בר")).toEqual([]);
    });
});

describe("splice", () => {
    it("החלפה רגילה לא נוגעת ברווחים", () => {
        expect(splice("א  ב ג", 5, 6, "ד")).toBe("א  ב ד");
    });

    it("מחיקת פסקה שלמה לא משאירה פסקה ריקה", () => {
        const t = "פסקה א\n\nזנב\n\nפסקה ב";
        const i = t.indexOf("זנב");
        expect(splice(t, i, i + 3, "")).toBe("פסקה א\n\nפסקה ב");
    });

    it("מחיקת זנב שנדבק לתחילת פסקה", () => {
        const t = "פסקה א\n\nזנב ירושלים נחפרת";
        const i = t.indexOf("זנב");
        expect(splice(t, i, i + 4, "")).toBe("פסקה א\n\nירושלים נחפרת");
    });

    it("מחיקה באמצע שורה משאירה רווח אחד", () => {
        expect(splice("א ב ג", 2, 3, "")).toBe("א ג");
    });

    it("מחיקה בסוף הטקסט", () => {
        expect(splice("פסקה\n\nזנב", 6, 9, "")).toBe("פסקה");
    });
});

describe("applyTextFixes", () => {
    it("מחיל תיקון בגוף הערך", () => {
        const e = entry({ body: { he: "הוא נשלח לַעֲבָדֶאֶתהָאֲדָמָה" } });
        const { changed, results } = applyTextFixes([e], [fix("לַעֲבָדֶאֶתהָאֲדָמָה", "לַעֲבֹד אֶת הָאֲדָמָה")]);
        expect(results[0].status).toBe("applied");
        expect(changed.get("e0001")!.body.he).toBe("הוא נשלח לַעֲבֹד אֶת הָאֲדָמָה");
        // המקור לא השתנה
        expect(e.body.he).toBe("הוא נשלח לַעֲבָדֶאֶתהָאֲדָמָה");
    });

    it("מחיל תיקון בכיתוב תמונה", () => {
        const e = entry({ images: [{ kind: "baked", src: "x", caption: { he: "שיבולט", en: "ear" } }] });
        const { changed, results } = applyTextFixes([e], [fix("שיבולט", "שיבולת")]);
        expect(results[0]).toMatchObject({ status: "applied", field: "caption" });
        expect(changed.get("e0001")!.images[0].caption).toEqual({ he: "שיבולת", en: "ear" });
    });

    it("לא נוגע כשהטקסט מופיע פעמיים", () => {
        const e = entry({ body: { he: "אמרו ועוד אמרו" } });
        const { changed, results } = applyTextFixes([e], [fix("אמרו", "אמר")]);
        expect(results[0].status).toBe("ambiguous");
        expect(changed.size).toBe(0);
    });

    it("מזהה תיקון שכבר נעשה", () => {
        const e = entry({ body: { he: "הצטווה" } });
        expect(applyTextFixes([e], [fix("נצטווה", "הצטווה")]).results[0].status).toBe("already");
    });

    it("מדווח כשהטקסט לא נמצא", () => {
        const e = entry({ body: { he: "משהו אחר" } });
        expect(applyTextFixes([e], [fix("נצטווה", "הצטווה")]).results[0].status).toBe("not-found");
    });

    it("שורה בלי טקסט ושורה לערך שלא קיים", () => {
        const { results } = applyTextFixes([entry()], [fix("", "x"), fix("a", "b", "e9999")]);
        expect(results.map(r => r.status)).toEqual(["empty", "no-entry"]);
    });

    it("כמה תיקונים באותו ערך נבנים זה על זה", () => {
        const e = entry({ body: { he: "אחת שתיים שלוש" } });
        const { changed } = applyTextFixes([e], [fix("אחת", "1"), fix("שלוש", "3")]);
        expect(changed.get("e0001")!.body.he).toBe("1 שתיים 3");
    });
});
