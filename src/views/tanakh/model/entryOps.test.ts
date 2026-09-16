import { describe, expect, it } from "vitest";
import { emptyEntry } from "./types";
import { entriesEqual, hasTranslation, nextEntryId, prepareEntryForSave, setTranslationStatus, stripUndefined } from "./entryOps";
import { sourceHashOf } from "./hash";
import { formatVerseRef, toHebrewNumeral } from "./hebnum";

describe("nextEntryId", () => {
    it("ממשיך את הרצף המספרי, מתעלם ממזהים אחרים", () => {
        expect(nextEntryId(["e0001", "e0728", "x012", "e0216.1"])).toBe("e0729");
        expect(nextEntryId([])).toBe("e0001");
    });
});

describe("prepareEntryForSave", () => {
    it("קובע חותמת ומשתמש בלי לשנות את המקור", () => {
        const e = emptyEntry("e0001", "places", 5);
        const out = prepareEntryForSave(e, "malka@korenpub.com", 100);
        expect(out.updatedAt).toBe(100);
        expect(out.updatedBy).toBe("malka@korenpub.com");
        expect(e.updatedAt).toBe(5);
    });

    it("מסמן תרגום כ-stale כשהעברית השתנתה מאז התרגום", () => {
        const e = emptyEntry("e0001", "places", 5);
        e.title.he = "שילה";
        e.title.en = "Shiloh";
        e.i18n.en = { status: "approved", updatedAt: 1, sourceHash: sourceHashOf(e) };
        expect(prepareEntryForSave(e, undefined, 10).i18n.en?.status).toBe("approved");
        e.body.he = "טקסט חדש";
        expect(prepareEntryForSave(e, undefined, 10).i18n.en?.status).toBe("stale");
    });

    it("setTranslationStatus מקבע את hash המקור הנוכחי", () => {
        const e = emptyEntry("e0001", "places", 5);
        e.title.en = "Shiloh";
        const marked = setTranslationStatus(e, "en", "reviewed", "u", 7);
        expect(marked.i18n.en).toEqual({ status: "reviewed", updatedAt: 7, updatedBy: "u", sourceHash: sourceHashOf(e) });
        expect(prepareEntryForSave(marked, undefined, 8).i18n.en?.status).toBe("reviewed");
    });

    it("hasTranslation / stripUndefined / entriesEqual", () => {
        const e = emptyEntry("e0001", "places", 5);
        expect(hasTranslation(e, "en")).toBe(false);
        e.body.en = "text";
        expect(hasTranslation(e, "en")).toBe(true);
        expect(JSON.stringify(stripUndefined({ a: undefined, b: 1 }))).toBe('{"b":1}');
        const f = structuredClone(e);
        f.updatedAt = 999;
        expect(entriesEqual(e, f)).toBe(true);
        f.title.he = "x";
        expect(entriesEqual(e, f)).toBe(false);
    });
});

describe("hebnum", () => {
    it("גימטריה עם טו/טז", () => {
        expect([1, 10, 11, 15, 16, 18, 20, 100, 150, 400, 499].map(toHebrewNumeral)).toEqual(["א", "י", "יא", "טו", "טז", "יח", "כ", "ק", "קנ", "ת", "תצט"]);
    });
    it("formatVerseRef", () => {
        expect(formatVerseRef({ book: "yehoshua", ch: 18, v: 1 })).toBe("יהושע יח, א");
        expect(formatVerseRef({ book: "shir-hashirim", ch: 4, v: 12, v2: 14 })).toBe("שיר השירים ד, יב–יד");
    });
});
