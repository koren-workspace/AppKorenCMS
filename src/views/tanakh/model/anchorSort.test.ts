import { describe, expect, it } from "vitest";
import { anchorKey, sortAnchors } from "../components/AnchorEditor";
import type { Anchor } from "./types";

const a = (book: string, ch: number, v: number, w?: string): Anchor => (w ? { book, ch, v, w } : { book, ch, v });

describe("sortAnchors", () => {
    it("ממיין לפי סדר ספרי התנ\"ך ואז פרק ופסוק", () => {
        const sorted = sortAnchors([a("shmuel-a", 1, 3), a("bereshit", 10, 2), a("yehoshua", 18, 1), a("bereshit", 2, 5)]);
        expect(sorted.map(x => `${x.book} ${x.ch}:${x.v}`)).toEqual([
            "bereshit 2:5",
            "bereshit 10:2",
            "yehoshua 18:1",
            "shmuel-a 1:3",
        ]);
    });

    it("לא משנה את המערך שהתקבל", () => {
        const input = [a("yehoshua", 18, 1), a("bereshit", 1, 1)];
        sortAnchors(input);
        expect(input[0].book).toBe("yehoshua");
    });

    it("ספר לא מוכר נדחף לסוף ולא מפיל את המיון", () => {
        const sorted = sortAnchors([a("nope", 1, 1), a("bereshit", 1, 1)]);
        expect(sorted.map(x => x.book)).toEqual(["bereshit", "nope"]);
    });
});

describe("anchorKey", () => {
    it("אותו פסוק עם אותה מילה הוא אותו מפתח", () => {
        expect(anchorKey(a("devarim", 2, 12, "בשעיר"))).toBe(anchorKey(a("devarim", 2, 12, "בשעיר")));
    });

    it("אותו פסוק עם מילה אחרת הוא מפתח אחר", () => {
        expect(anchorKey(a("devarim", 2, 12, "בשעיר"))).not.toBe(anchorKey(a("devarim", 2, 12)));
    });
});
