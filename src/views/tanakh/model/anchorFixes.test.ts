import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANCHOR_FIXES, applyAnchorFixes, type AnchorFix } from "./anchorFixes";
import { anchorsByEntry, type LegacyAnchorMap } from "./fromLegacy";

const map = (): LegacyAnchorMap => ({
    devarim: { "2": { "12": [{ e: "e0516", cat: 5 }] } },
    tehillim: { "52": { "1": [{ e: "e0516", cat: 5 }] }, "137": { "7": [{ e: "e0517", cat: 5 }] } },
    yehoshua: { "15": { "10": [{ e: "e0516", cat: 5 }, { e: "e0506", cat: 4 }] } },
    "divrei-hayamim-b": { "25": { "15": [{ e: "e0516", cat: 5, w: "לו" }] } },
});

describe("applyAnchorFixes", () => {
    it("מעביר עוגן לערך אחר באותו פסוק", () => {
        const { map: out, applied, missing } = applyAnchorFixes(map(), [
            { book: "devarim", ch: 2, v: 12, from: "e0516", to: { entry: "e0517" }, why: "" },
        ]);
        expect(out.devarim["2"]["12"]).toEqual([{ e: "e0517", cat: 5 }]);
        expect(applied).toHaveLength(1);
        expect(missing).toHaveLength(0);
    });

    it("מעביר עוגן לפסוק אחר", () => {
        const { map: out } = applyAnchorFixes(map(), [
            { book: "tehillim", ch: 52, v: 1, from: "e0516", to: { entry: "e0517", v: 2 }, why: "" },
        ]);
        expect(out.tehillim["52"]["1"]).toBeUndefined();
        expect(out.tehillim["52"]["2"]).toEqual([{ e: "e0517", cat: 5 }]);
    });

    it("מוריד עוגן בלי יעד, ומשאיר את שאר העוגנים של הפסוק", () => {
        const { map: out } = applyAnchorFixes(map(), [
            { book: "yehoshua", ch: 15, v: 10, from: "e0516", why: "" },
        ]);
        expect(out.yehoshua["15"]["10"]).toEqual([{ e: "e0506", cat: 4 }]);
    });

    it("מוחק מילת עיגון עם w: null", () => {
        const { map: out } = applyAnchorFixes(map(), [
            { book: "divrei-hayamim-b", ch: 25, v: 15, from: "e0516", to: { entry: "e0517", w: null }, why: "" },
        ]);
        expect(out["divrei-hayamim-b"]["25"]["15"]).toEqual([{ e: "e0517", cat: 5 }]);
    });

    it("לא משנה את המפה שהתקבלה", () => {
        const input = map();
        applyAnchorFixes(input, ANCHOR_FIXES);
        expect(input.devarim["2"]["12"]).toEqual([{ e: "e0516", cat: 5 }]);
    });

    it("מדווח על תיקון שלא נמצא לו עוגן, בלי לזרוק", () => {
        const fix: AnchorFix = { book: "yona", ch: 1, v: 1, from: "e0516", to: { entry: "e0517" }, why: "" };
        const { applied, missing } = applyAnchorFixes(map(), [fix]);
        expect(applied).toHaveLength(0);
        expect(missing).toEqual([fix]);
    });

    it("לא יוצר כפילות אם העוגן כבר קיים ביעד", () => {
        const { map: out } = applyAnchorFixes(map(), [
            { book: "tehillim", ch: 52, v: 1, from: "e0516", to: { entry: "e0517", ch: 137, v: 7 }, why: "" },
        ]);
        expect(out.tehillim["137"]["7"]).toHaveLength(1);
    });
});

describe("ANCHOR_FIXES", () => {
    it("13 תיקונים, כולם של e0516, ואחד בלי יעד", () => {
        expect(ANCHOR_FIXES).toHaveLength(13);
        expect(ANCHOR_FIXES.every(f => f.from === "e0516")).toBe(true);
        expect(ANCHOR_FIXES.filter(f => !f.to)).toHaveLength(1);
        expect(ANCHOR_FIXES.every(f => f.why.length > 0)).toBe(true);
    });
});

const APP_CONTENT = resolve(process.cwd(), "..", "Tanakh-LaMetayel", "assets", "content");

describe.skipIf(!existsSync(resolve(APP_CONTENT, "anchors.json")))("ANCHOR_FIXES על העוגנים האפויים", () => {
    const anchors = JSON.parse(readFileSync(resolve(APP_CONTENT, "anchors.json"), "utf8")) as LegacyAnchorMap;

    it("כל 13 התיקונים נמצאים בפועל", () => {
        const { applied, missing } = applyAnchorFixes(anchors);
        expect(missing).toEqual([]);
        expect(applied).toHaveLength(13);
    });

    it("e0516 נשאר רק עם שני עוגני לוח העמים, ו-e0517 מקבל 12", () => {
        const before = anchorsByEntry(anchors);
        const after = anchorsByEntry(applyAnchorFixes(anchors).map);

        expect(before.get("e0516")).toHaveLength(15);
        expect(after.get("e0516")?.map(a => `${a.book} ${a.ch}:${a.v}`)).toEqual([
            "divrei-hayamim-a 1:4",
            "divrei-hayamim-a 1:28",
        ]);
        expect(after.get("e0517")).toHaveLength((before.get("e0517")?.length ?? 0) + 12);
    });

    it("הפסוקים שתוקנו אכן מזכירים אדום", () => {
        const after = anchorsByEntry(applyAnchorFixes(anchors).map);
        const has = (book: string, ch: number, v: number) =>
            after.get("e0517")!.some(a => a.book === book && a.ch === ch && a.v === v);
        expect(has("tehillim", 52, 2)).toBe(true);
        expect(has("tehillim", 60, 2)).toBe(true);
        expect(has("tehillim", 83, 7)).toBe(true);
        expect(has("yehoshua", 15, 10)).toBe(false);
    });
});
