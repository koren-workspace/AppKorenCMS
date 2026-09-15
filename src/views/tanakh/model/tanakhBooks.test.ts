import { describe, expect, it } from "vitest";
import { isValidVerseRef, parseHebrewRef, tanakhBook, TANAKH_BOOKS } from "./tanakhBooks";

describe("tanakhBooks", () => {
    it("39 ספרים, כל אחד עם מספר פסוקים לכל פרק", () => {
        expect(TANAKH_BOOKS).toHaveLength(39);
        for (const b of TANAKH_BOOKS) expect(b.verses).toHaveLength(b.chapters);
    });

    it("isValidVerseRef בודק ספר, פרק ופסוק", () => {
        expect(isValidVerseRef({ book: "bereshit", ch: 1, v: 1 })).toBe(true);
        expect(isValidVerseRef({ book: "bereshit", ch: 1, v: 31 })).toBe(true);
        expect(isValidVerseRef({ book: "bereshit", ch: 1, v: 32 })).toBe(false);
        expect(isValidVerseRef({ book: "bereshit", ch: 51, v: 1 })).toBe(false);
        expect(isValidVerseRef({ book: "bereshit", ch: 0, v: 1 })).toBe(false);
        expect(isValidVerseRef({ book: "no-such-book", ch: 1, v: 1 })).toBe(false);
    });

    it("טווח פסוקים חייב להיות עולה ובתוך הפרק", () => {
        expect(isValidVerseRef({ book: "bereshit", ch: 1, v: 1, v2: 5 })).toBe(true);
        expect(isValidVerseRef({ book: "bereshit", ch: 1, v: 5, v2: 5 })).toBe(false);
        expect(isValidVerseRef({ book: "bereshit", ch: 1, v: 5, v2: 99 })).toBe(false);
    });
});

describe("parseHebrewRef", () => {
    it("ספר, פרק ופסוק", () => {
        expect(parseHebrewRef("יהושע יח, א")).toEqual({ book: "yehoshua", ch: 18, v: 1 });
    });

    it("טווח פסוקים", () => {
        expect(parseHebrewRef("שיר השירים ד, יב–יד")).toEqual({ book: "shir-hashirim", ch: 4, v: 12, v2: 14 });
    });

    it("שם ספר ארוך מנצח קצר (שמואל א לפני שמואל)", () => {
        expect(parseHebrewRef("שמואל א א, כ").book).toBe("shmuel-a");
        expect(tanakhBook("shmuel-a")?.he).toBe("שמואל א");
    });

    it("פרק בלבד", () => {
        expect(parseHebrewRef("תהלים כג")).toEqual({ book: "tehillim", ch: 23 });
    });

    it("לא זוהה ספר → אובייקט ריק", () => {
        expect(parseHebrewRef("משנה ברכות א, א")).toEqual({});
    });
});
