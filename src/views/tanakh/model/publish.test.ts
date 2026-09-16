import { describe, expect, it } from "vitest";
import { buildContentPack, PACK_FORMAT, packFileName } from "./publish";
import { LEGACY_CATEGORIES } from "./categories";
import { emptyEntry, type Entry } from "./types";

const cats = [...LEGACY_CATEGORIES];

function entry(id: string, patch: Partial<Entry> = {}): Entry {
    return { ...emptyEntry(id, "places", 1), visible: true, ...patch };
}

const shiloh = entry("e0203", {
    title: { he: "שִׁילֹה", en: "Shiloh" },
    altTitles: { he: ["שילו"] },
    body: { he: "פסקה ראשונה.\n\n## כותרת משנה\n\nפסקה שנייה." },
    quotes: [{ book: "yehoshua", ch: 18, v: 1 }],
    refs: [{ raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 }],
    images: [{ kind: "baked", src: "e0203_1_1", caption: { he: "התל" } }],
    anchors: [{ book: "yehoshua", ch: 18, v: 1, w: "שילה" }, { book: "shmuel-a", ch: 1, v: 3 }],
    location: { lat: 32.0556, lng: 35.2897, conf: 1 },
    region: { he: "השומרון" },
    page: 300,
    xrefs: ["e0300"],
});
const jerusalem = entry("e0300", { title: { he: "יְרוּשָׁלַיִם" }, body: { he: "עיר הבירה." } });
const draft = entry("e0999", { title: { he: "טיוטה" }, visible: false });

describe("buildContentPack", () => {
    it("כולל רק ערכים גלויים, וסופר את המוסתרים", () => {
        const r = buildContentPack([shiloh, jerusalem, draft], cats);
        expect(r.included).toBe(2);
        expect(r.hidden).toBe(1);
        expect(r.pack.entries.map(e => e.id)).toEqual(["e0203", "e0300"]);
    });

    it("תצוגה מקדימה כוללת גם מוסתרים ומסומנת ככזו", () => {
        const r = buildContentPack([shiloh, draft], cats, { preview: true });
        expect(r.included).toBe(2);
        expect(r.pack.preview).toBe(true);
    });

    it("קטגוריה הופכת למזהה המספרי של האפליקציה", () => {
        const r = buildContentPack([shiloh], cats);
        expect(r.pack.entries[0].cat).toBe(4);   // places
    });

    it("גוף הערך והתמונות הופכים לבלוקים", () => {
        const r = buildContentPack([shiloh], cats);
        expect(r.pack.entries[0].blocks).toEqual([
            { t: "p", x: "פסקה ראשונה." },
            { t: "h", x: "כותרת משנה" },
            { t: "p", x: "פסקה שנייה." },
            { t: "img", src: "e0203_1_1", cap: "התל" },
        ]);
    });

    it("פסוקים נשארים הפניות, בלי טקסט", () => {
        const r = buildContentPack([shiloh], cats);
        expect(r.pack.entries[0].quotes).toEqual([{ book: "yehoshua", ch: 18, v: 1 }]);
        expect(JSON.stringify(r.pack)).not.toContain("וַיִּקָּהֲלוּ");
    });

    it("ערך קשור מקבל קטגוריה וכותרת; ערך חסר מדווח ולא נכלל", () => {
        const r = buildContentPack([shiloh, jerusalem], cats);
        expect(r.pack.entries[0].xrefs).toEqual([{ cat: 4, title: "יְרוּשָׁלַיִם", id: "e0300" }]);

        const alone = buildContentPack([shiloh], cats);
        expect(alone.pack.entries[0].xrefs).toEqual([]);
        expect(alone.warnings[0].message).toContain("ערך קשור לא קיים");
    });

    it("ערך קשור מוסתר לא נכלל ומדווח", () => {
        const hidden = entry("e0300", { title: { he: "יְרוּשָׁלַיִם" }, visible: false });
        const r = buildContentPack([shiloh, hidden], cats);
        expect(r.pack.entries[0].xrefs).toEqual([]);
        expect(r.warnings.some(w => w.message.includes("מוסתר"))).toBe(true);
    });

    it("הפניה לערך מוסתר מדווחת", () => {
        const redirect = entry("e0251", { title: { he: "לוּז" }, see: "e0250" });
        const target = entry("e0250", { title: { he: "בֵּית אֵל" }, visible: false });
        const r = buildContentPack([redirect, target], cats);
        expect(r.warnings.some(w => w.message.includes("ההפניה מובילה לערך מוסתר"))).toBe(true);
        expect(r.pack.entries[0].see).toBe("e0250");
    });

    it("מיקומים נאספים לרשימה נפרדת", () => {
        const r = buildContentPack([shiloh, jerusalem], cats);
        expect(r.pack.locations).toEqual([{ id: "e0203", lat: 32.0556, lng: 35.2897, conf: 1 }]);
        expect(r.stats.locations).toBe(1);
    });

    it("עוגנים נבנים למפה לפי ספר/פרק/פסוק", () => {
        const r = buildContentPack([shiloh], cats);
        expect(r.pack.anchors.yehoshua["18"]["1"]).toEqual([{ e: "e0203", cat: 4, w: "שילה" }]);
        expect(r.pack.anchors["shmuel-a"]["1"]["3"]).toEqual([{ e: "e0203", cat: 4 }]);
        expect(r.stats.anchors).toBe(2);
    });

    it("עוגן כפול נכנס פעם אחת, וספר לא מוכר נשמט", () => {
        const messy = entry("e0001", {
            title: { he: "בדיקה" },
            anchors: [
                { book: "devarim", ch: 2, v: 12 },
                { book: "devarim", ch: 2, v: 12 },
                { book: "nope", ch: 1, v: 1 },
            ],
        });
        const r = buildContentPack([messy], cats);
        expect(r.pack.anchors.devarim["2"]["12"]).toHaveLength(1);
        expect(r.pack.anchors.nope).toBeUndefined();
        expect(r.stats.anchors).toBe(1);
    });

    it("מספר הגרסה עולה מהגרסה הקודמת", () => {
        expect(buildContentPack([shiloh], cats, { previousVersion: 7 }).pack.version).toBe(8);
        expect(buildContentPack([shiloh], cats).pack.version).toBe(1);
    });

    it("אזור הופך ל-group, ושמות נוספים מנוקים מניקוד", () => {
        const e = buildContentPack([shiloh], cats).pack.entries[0];
        expect(e.group).toBe("השומרון");
        expect(e.altTitles).toEqual(["שילו"]);
        expect(e.titleClean).toBe("שילה");
    });

    it("שפת יעד בלי תרגום נופלת לעברית", () => {
        const r = buildContentPack([shiloh], cats, { lang: "en" });
        expect(r.pack.lang).toBe("en");
        expect(r.pack.entries[0].title).toBe("Shiloh");            // יש תרגום
        expect(r.pack.entries[0].blocks[0]).toEqual({ t: "p", x: "פסקה ראשונה." });  // אין – עברית
    });

    it("חותמת גרסת המבנה", () => {
        expect(buildContentPack([shiloh], cats).pack.format).toBe(PACK_FORMAT);
    });
});

describe("packFileName", () => {
    it("ערוץ חי וערוץ תצוגה מקדימה", () => {
        expect(packFileName(false)).toBe("published/live.json");
        expect(packFileName(true)).toBe("published/preview.json");
    });
});
