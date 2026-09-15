import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    anchorsByEntry,
    buildTitleIndex,
    convertLegacyContent,
    convertLegacyEntry,
    type LegacyAnchorMap,
    type LegacyEntry,
    type LegacyLocation,
} from "./fromLegacy";
import { validateEntry } from "./validate";
import { LEGACY_CATEGORIES } from "./categories";
import { bodyToBlocks } from "./body";
import { sourceHashOf } from "./hash";

const shiloh: LegacyEntry = {
    id: "e0203",
    cat: 4,
    title: "שִׁילֹה, שילו",
    titleClean: "שילה",
    page: 300,
    blocks: [
        { t: "q", x: "וַיִּקָּהֲלוּ כָּל עֲדַת בְּנֵי יִשְׂרָאֵל שִׁלֹה", book: "yehoshua", ch: 18, v: 1 },
        { t: "q", x: "ציטוט שלא זוהה" },
        { t: "p", x: "פסקה ראשונה." },
        { t: "h", x: "כותרת משנה" },
        { t: "p", x: "פסקה שנייה." },
        { t: "img", src: "e0203_1_1", cap: "התל" },
        { t: "img", src: "e0203_1_2" },
        { t: "sci", x: "הערה מדעית" },
    ],
    refs: [{ n: 1, raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 }, { raw: "משנה זבחים יד" }],
    xrefs: [{ cat: 4, title: "ירושלים", id: "e0300" }, { cat: 4, title: "בית אל", id: null }, { cat: 1, title: "לא קיים" }],
    group: "השומרון",
    altTitles: ["שילו"],
};

const beitEl: LegacyEntry = {
    id: "e0250",
    cat: 4,
    title: "בֵּית אֵל",
    titleClean: "בית אל",
    page: 220,
    blocks: [{ t: "p", x: "עיר." }],
    refs: [],
    xrefs: [],
};

const redirect: LegacyEntry = {
    id: "e0251",
    cat: 4,
    title: "לוז",
    titleClean: "לוז",
    page: 221,
    blocks: [],
    refs: [],
    xrefs: [],
    see: "בית אל",
};

const all = [shiloh, beitEl, redirect];
const locations: LegacyLocation[] = [{ id: "e0203", lat: 32.0556, lng: 35.2897, conf: 3 }];
const anchors: LegacyAnchorMap = {
    yehoshua: { "18": { "1": [{ e: "e0203", cat: 4, w: "שלה" }] } },
    shoftim: { "21": { "19": [{ e: "e0203", cat: 4 }, { e: "e0250", cat: 4, w: "ביתאל" }] } },
};

describe("convertLegacyEntry", () => {
    const entries = convertLegacyContent(all, locations, anchors, { now: 1000, updatedBy: "test" });
    const e = entries.find(x => x.id === "e0203")!;

    it("שדות בסיס", () => {
        expect(e.cat).toBe("places");
        expect(e.title).toEqual({ he: "שִׁילֹה, שילו" });
        expect(e.altTitles).toEqual({ he: ["שילו"] });
        expect(e.region).toEqual({ he: "השומרון" });
        expect(e.page).toBe(300);
        expect(e.visible).toBe(true);
        expect(e.i18n).toEqual({});
        expect(e.createdAt).toBe(1000);
        expect(e.updatedBy).toBe("test");
    });

    it("פסוק מזוהה → quotes; לא מזוהה → גוף + הערת בדיקה", () => {
        expect(e.quotes).toEqual([{ book: "yehoshua", ch: 18, v: 1 }]);
        expect(bodyToBlocks(e.body.he)).toEqual([
            { t: "q", x: "ציטוט שלא זוהה" },
            { t: "p", x: "פסקה ראשונה." },
            { t: "h", x: "כותרת משנה" },
            { t: "p", x: "פסקה שנייה." },
            { t: "sci", x: "הערה מדעית" },
        ]);
        expect(e.review.some(r => r.includes("ציטוט לא זוהה"))).toBe(true);
    });

    it("resolveQuote מזהה ציטוט לפי טקסט", () => {
        const resolved = convertLegacyEntry(shiloh, { findByTitle: () => undefined }, {
            resolveQuote: text => (text === "ציטוט שלא זוהה" ? { book: "shoftim", ch: 21, v: 19 } : undefined),
        });
        expect(resolved.quotes).toEqual([{ book: "yehoshua", ch: 18, v: 1 }, { book: "shoftim", ch: 21, v: 19 }]);
        expect(resolved.review.some(r => r.includes("ציטוט"))).toBe(false);
    });

    it("תמונות → images אפויות עם כיתוב", () => {
        expect(e.images).toEqual([
            { kind: "baked", src: "e0203_1_1", caption: { he: "התל" } },
            { kind: "baked", src: "e0203_1_2" },
        ]);
    });

    it("מראי מקום נשמרים כפי שהם", () => {
        expect(e.refs).toEqual([{ raw: "יהושע יח, א", n: 1, book: "yehoshua", ch: 18, v: 1 }, { raw: "משנה זבחים יד" }]);
    });

    it("ערכים קשורים: לפי id, לפי כותרת, ואזהרה כשלא נמצא", () => {
        expect(e.xrefs).toEqual(["e0300", "e0250"]);
        expect(e.review).toContain('ערך קשור לא נמצא: "לא קיים"');
    });

    it("הפניה (see) לפי כותרת", () => {
        expect(entries.find(x => x.id === "e0251")!.see).toBe("e0250");
    });

    it("מיקום עם רמת ביטחון", () => {
        expect(e.location).toEqual({ lat: 32.0556, lng: 35.2897, conf: 3 });
        expect(entries.find(x => x.id === "e0250")!.location).toBeUndefined();
    });

    it("קישורים מהפסוקים מקובצים לפי ערך", () => {
        expect(e.anchors).toEqual([
            { book: "yehoshua", ch: 18, v: 1, w: "שלה" },
            { book: "shoftim", ch: 21, v: 19 },
        ]);
        expect(anchorsByEntry(anchors).get("e0250")).toEqual([{ book: "shoftim", ch: 21, v: 19, w: "ביתאל" }]);
    });

    it("התוצאה עוברת אימות (בלי שגיאות)", () => {
        const ctx = { entryIds: new Set(entries.map(x => x.id).concat("e0300")), categoryKeys: new Set(LEGACY_CATEGORIES.map(c => c.key)) };
        for (const x of entries) {
            expect(validateEntry(x, ctx).filter(i => i.level === "error")).toEqual([]);
        }
    });

    it("hash המקור יציב ומשתנה עם הטקסט", () => {
        const h1 = sourceHashOf(e);
        expect(sourceHashOf(e)).toBe(h1);
        expect(sourceHashOf({ ...e, body: { he: e.body.he + " שינוי" } })).not.toBe(h1);
    });
});

describe("buildTitleIndex", () => {
    const find = buildTitleIndex(all);
    it("מתאים לפי אותיות בלבד ובסלחנות לכתיב מלא/חסר", () => {
        expect(find("בית אל")).toBe("e0250");
        expect(find("בית־אל")).toBe("e0250");
        expect(find("שילו")).toBe("e0203");
        expect(find("שילה")).toBe("e0203");
    });
    it("מדלג על ערכי הפניה", () => {
        expect(find("לוז")).toBeUndefined();
    });
});

// ── התוכן האמיתי: רץ רק כשריפו האפליקציה משוכפל ליד ריפו זה ─────────────────

const APP_CONTENT = resolve(process.cwd(), "..", "Tanakh-LaMetayel", "assets", "content");

describe.skipIf(!existsSync(resolve(APP_CONTENT, "entries.json")))("convertLegacyContent על התוכן האפוי", () => {
    const read = (f: string) => JSON.parse(readFileSync(resolve(APP_CONTENT, f), "utf8"));
    const legacy: LegacyEntry[] = read("entries.json");
    const locs: LegacyLocation[] = read("locations.json");
    const anchorMap: LegacyAnchorMap = read("anchors.json");
    const entries = convertLegacyContent(legacy, locs, anchorMap, { now: 1 });

    it("כל הערכים מומרים, בלי שגיאות אימות", () => {
        expect(entries).toHaveLength(legacy.length);
        const ctx = { entryIds: new Set(entries.map(e => e.id)), categoryKeys: new Set(LEGACY_CATEGORIES.map(c => c.key)) };
        const errors = entries.flatMap(e => validateEntry(e, ctx).filter(i => i.level === "error").map(i => `${e.id} ${i.field}: ${i.message}`));
        expect(errors).toEqual([]);
    });

    it("שום דבר לא הולך לאיבוד: מיקומים, תמונות, קישורים, פסוקים", () => {
        expect(entries.filter(e => e.location)).toHaveLength(locs.length);
        const legacyImages = legacy.reduce((n, e) => n + e.blocks.filter(b => b.t === "img").length, 0);
        expect(entries.reduce((n, e) => n + e.images.length, 0)).toBe(legacyImages);
        const legacyAnchors = Object.values(anchorMap).reduce((n, chs) => n + Object.values(chs).reduce((m, vs) => m + Object.values(vs).reduce((k, l) => k + l.length, 0), 0), 0);
        expect(entries.reduce((n, e) => n + e.anchors.length, 0)).toBe(legacyAnchors);
        const legacyQuotes = legacy.reduce((n, e) => n + e.blocks.filter(b => b.t === "q").length, 0);
        const quotesKept = entries.reduce((n, e) => n + e.quotes.length + bodyToBlocks(e.body.he).filter(b => b.t === "q").length, 0);
        expect(quotesKept).toBe(legacyQuotes);
    });

    it("כל ההפניות (see) וכל הערכים הקשורים עם id מצביעים על ערכים קיימים", () => {
        const ids = new Set(entries.map(e => e.id));
        for (const e of entries) {
            if (e.see) expect(ids.has(e.see)).toBe(true);
            for (const x of e.xrefs) expect(ids.has(x)).toBe(true);
        }
    });
});
