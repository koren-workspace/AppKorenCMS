import { describe, expect, it } from "vitest";
import { archiveFileName, archiveVersionOf, ARCHIVE_DIR } from "./publishService";
import { packFileName } from "../model/publish";

describe("שמות קובצי הפרסום", () => {
    it("הערוץ החי והתצוגה המקדימה הם קבצים נפרדים", () => {
        expect(packFileName(false)).toBe("published/live.json");
        expect(packFileName(true)).toBe("published/preview.json");
    });

    it("עותק הגרסה יושב בתיקיית הארכיון ומרופד באפסים", () => {
        expect(archiveFileName(1)).toBe(`${ARCHIVE_DIR}/live-0001.json`);
        expect(archiveFileName(42)).toBe(`${ARCHIVE_DIR}/live-0042.json`);
        expect(archiveFileName(12345)).toBe(`${ARCHIVE_DIR}/live-12345.json`);
    });

    it("הריפוד שומר על סדר לקסיקוגרפי זהה לסדר מספרי", () => {
        const names = [9, 10, 2, 100].map(archiveFileName).sort();
        expect(names.map(n => archiveVersionOf(n))).toEqual([2, 9, 10, 100]);
    });

    it("archiveVersionOf קורא את הגרסה מהנתיב", () => {
        expect(archiveVersionOf("published/archive/live-0007.json")).toBe(7);
        expect(archiveVersionOf(archiveFileName(3))).toBe(3);
    });

    it("נתיב שאינו עותק גרסה מחזיר null", () => {
        expect(archiveVersionOf("published/live.json")).toBeNull();
        expect(archiveVersionOf("published/archive/preview.json")).toBeNull();
        expect(archiveVersionOf("")).toBeNull();
    });

    it("עותק הגרסה לעולם אינו דורס את הערוץ", () => {
        for (const v of [0, 1, 999, 10000]) expect(archiveFileName(v)).not.toBe(packFileName(false));
    });
});
