import { describe, expect, it } from "vitest";
import {
    collectTranslationPrayerPairs,
    countCopiesByKind,
    itemValuesEqual,
    shouldCopyToProd,
    summarizeCopy,
    type ReconcileCopy,
} from "./prodReconcileService";

describe("collectTranslationPrayerPairs", () => {
    const toc = {
        nusach: "sefard",
        translations: [
            {
                translationId: "0-sefard",
                categories: [
                    {
                        id: "c1",
                        prayers: [{ id: "2015010" }, { id: "2015020" }],
                    },
                    {
                        id: "c2",
                        // תפילה כפולה בין קטגוריות – נספרת פעם אחת
                        prayers: [{ id: "2015020" }, { id: "2015300" }],
                    },
                ],
            },
            {
                translationId: "1-sefard",
                categories: [{ id: "c1", prayers: [{ id: "2015010" }] }],
            },
            // תרגום בלי translationId – מדולג
            { categories: [{ id: "c1", prayers: [{ id: "9999999" }] }] },
        ],
    };

    it("אוסף צמד לכל תרגום+תפילה, בלי כפילויות", () => {
        expect(collectTranslationPrayerPairs(toc)).toEqual([
            { translationId: "0-sefard", prayerId: "2015010" },
            { translationId: "0-sefard", prayerId: "2015020" },
            { translationId: "0-sefard", prayerId: "2015300" },
            { translationId: "1-sefard", prayerId: "2015010" },
        ]);
    });

    it("מחזיר ריק על קלט חסר", () => {
        expect(collectTranslationPrayerPairs(null)).toEqual([]);
        expect(collectTranslationPrayerPairs({})).toEqual([]);
    });
});

describe("itemValuesEqual", () => {
    it("מתעלם מהבדלי timestamp (כתיבה כפולה מטביעה חותמות שונות)", () => {
        expect(
            itemValuesEqual(
                { content: "א", timestamp: 1 },
                { content: "א", timestamp: 2 }
            )
        ).toBe(true);
    });

    it("מזהה הבדל בערך שדה", () => {
        expect(
            itemValuesEqual({ content: "א" }, { content: "ב" })
        ).toBe(false);
    });

    it("מזהה שדה שקיים רק בצד אחד (למשל deleted / hazan)", () => {
        expect(
            itemValuesEqual(
                { content: "א", deleted: true },
                { content: "א" }
            )
        ).toBe(false);
        expect(
            itemValuesEqual({ content: "א" }, { content: "א", hazan: true })
        ).toBe(false);
    });

    it("משווה מערכים לעומק (linkedItem)", () => {
        expect(
            itemValuesEqual(
                { linkedItem: ["1", "2"] },
                { linkedItem: ["1", "2"] }
            )
        ).toBe(true);
        expect(
            itemValuesEqual({ linkedItem: ["1", "2"] }, { linkedItem: ["1"] })
        ).toBe(false);
        expect(
            itemValuesEqual({ linkedItem: ["1", "2"] }, { linkedItem: ["2", "1"] })
        ).toBe(false);
    });
});

describe("shouldCopyToProd", () => {
    it("מעתיק כשהמסמך חסר בפרוד", () => {
        expect(shouldCopyToProd({ content: "א", timestamp: 5 }, undefined)).toBe(
            "copy"
        );
    });

    it("מדלג כשהערכים זהים (גם אם החותמות שונות)", () => {
        expect(
            shouldCopyToProd(
                { content: "א", timestamp: 5 },
                { content: "א", timestamp: 8 }
            )
        ).toBe("skip-equal");
    });

    it("מעתיק מחיקה רכה שלא הגיעה לפרוד (התרחיש של הבאג)", () => {
        // סטייג': deleted:true עם חותמת חדשה; פרוד: העותק הישן החי
        expect(
            shouldCopyToProd(
                { content: "א", deleted: true, timestamp: 100 },
                { content: "א", timestamp: 50 }
            )
        ).toBe("copy");
    });

    it("לא דורס פרוד חדש יותר (עריכת פרוד ישירה)", () => {
        expect(
            shouldCopyToProd(
                { content: "א", timestamp: 50 },
                { content: "א", hazan: true, timestamp: 100 }
            )
        ).toBe("skip-prod-newer");
    });

    it("חותמות שוות + ערכים שונים → סטייג' מנצח (סטייג' הוא מקור האמת)", () => {
        expect(
            shouldCopyToProd(
                { content: "א", timestamp: 100 },
                { content: "ב", timestamp: 100 }
            )
        ).toBe("copy");
    });

    it("מסמך סטייג' בלי timestamp לא דורס פרוד עם timestamp", () => {
        expect(
            shouldCopyToProd({ content: "א" }, { content: "ב", timestamp: 100 })
        ).toBe("skip-prod-newer");
    });
});

/** העזרים שמזינים את התצוגה המקדימה שלפני אישור הפרסום */
describe("תצוגה מקדימה לפרסום", () => {
    const itemCopy = (over: Partial<ReconcileCopy> = {}): ReconcileCopy => ({
        path: "translations/0-ashkenaz/prayers/1015010/items",
        docId: "103250811270",
        data: { content: "אֲנִי מַאֲמִין" },
        reason: "changed",
        kind: "item",
        ...over,
    });

    it("summarizeCopy מפרק נתיב פריט לתרגום ולתפילה", () => {
        expect(summarizeCopy(itemCopy())).toEqual({
            kind: "item",
            reason: "changed",
            docId: "103250811270",
            translationId: "0-ashkenaz",
            prayerId: "1015010",
            snippet: "אֲנִי מַאֲמִין",
        });
    });

    it("summarizeCopy קוטם תוכן ארוך", () => {
        const long = "א".repeat(200);
        const snippet = summarizeCopy(itemCopy({ data: { content: long } })).snippet!;
        expect(snippet.endsWith("…")).toBe(true);
        expect(snippet.length).toBe(61);
    });

    it("summarizeCopy על לוח שנה ומבנה – בלי תרגום/תפילה ובלי תוכן", () => {
        expect(
            summarizeCopy({
                path: "calendar",
                docId: "100",
                data: { dates: [] },
                reason: "missing",
                kind: "calendar",
            })
        ).toEqual({
            kind: "calendar",
            reason: "missing",
            docId: "100",
            translationId: undefined,
            prayerId: undefined,
            snippet: undefined,
        });
    });

    it("countCopiesByKind סופר לפי סוג", () => {
        expect(
            countCopiesByKind([
                itemCopy(),
                itemCopy({ docId: "2" }),
                { path: "calendar", docId: "100", data: {}, reason: "missing", kind: "calendar" },
                { path: "toc", docId: "ashkenaz", data: {}, reason: "changed", kind: "toc" },
            ])
        ).toEqual({ items: 2, calendar: 1, toc: 1 });
    });

    it("countCopiesByKind על רשימה ריקה", () => {
        expect(countCopiesByKind([])).toEqual({ items: 0, calendar: 0, toc: 0 });
    });
});
