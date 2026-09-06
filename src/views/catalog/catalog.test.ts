/**
 * catalog.test – the document shape the screen writes is the shape the app
 * parses (koren-tefilla, services/remote/enhancements.ts). Empty fields must
 * be ABSENT, not "", and the round trip through coerceItem must be lossless
 * for what the app reads.
 */

import { describe, expect, it } from "vitest";
import { coerceItem, historicalFields, toDocument } from "./services/catalogService";
import { emptyItem, type CatalogItem } from "./types";

const PREP: CatalogItem = {
    storeId: "prep30",
    kind: "preparation",
    order: 0,
    title: { default: "Preparation for Tefilla", he: "הכנה לתפילה" },
    author: { default: "Rav David Aaron (English)", he: "" },
    description: { default: "", he: "" },
    nusach: { default: "", he: "" },
    nusachId: "",
    contentId: "",
    backgroundColor: "",
    thumbnail: "https://firebasestorage.googleapis.com/v0/b/x/o/mods%2Fthumbnails%2Fa.png?alt=media",
    preparationContent: [
        { id: "t1", rank: "0000004abvgg", title: { default: "Intro", he: "מבוא" }, type: "audio", url: "https://res.cloudinary.com/x/intro.wav", thumbnail: "" },
    ],
};

describe("toDocument", () => {
    it("writes only what is filled in, in the app's field names", () => {
        const doc = toDocument(PREP, "malka@korenpub.com");
        expect(doc).toMatchObject({
            storeId: "prep30",
            kind: "preparation",
            order: 0,
            title: { default: "Preparation for Tefilla", he: "הכנה לתפילה" },
            author: { default: "Rav David Aaron (English)" },
            thumbnail: PREP.thumbnail,
            preparationContent: [
                { id: "t1", rank: "0000004abvgg", title: { default: "Intro", he: "מבוא" }, type: "audio", url: "https://res.cloudinary.com/x/intro.wav" },
            ],
            updatedBy: "malka@korenpub.com",
        });
        for (const absent of ["description", "nusach", "nusachId", "contentId", "backgroundColor"]) {
            expect(doc).not.toHaveProperty(absent);
        }
        expect(doc.author).not.toHaveProperty("he");
        expect((doc.preparationContent as any[])[0]).not.toHaveProperty("thumbnail");
    });

    it("does not write preparationContent for stream products", () => {
        const doc = toDocument({ ...PREP, kind: "commentary", contentId: "10-ashkenaz", backgroundColor: "#771144", nusachId: "Ashkenaz" }, "x");
        expect(doc).not.toHaveProperty("preparationContent");
        expect(doc).toMatchObject({ contentId: "10-ashkenaz", backgroundColor: "#771144", nusachId: "Ashkenaz" });
    });

    it("refuses what the app could not show", () => {
        expect(() => toDocument({ ...PREP, storeId: "prep 30" }, "x")).toThrow(/storeId/);
        expect(() => toDocument({ ...PREP, title: { default: "", he: "רק עברית" } }, "x")).toThrow(/כותרת/);
        expect(() => toDocument({ ...PREP, order: -1 }, "x")).toThrow(/סדר/);
        expect(() => toDocument({ ...PREP, backgroundColor: "red" }, "x")).toThrow(/צבע/);
        expect(() => toDocument({ ...PREP, preparationContent: [{ ...PREP.preparationContent[0], url: "" }] }, "x")).toThrow(/רצועה 1/);
    });
});

describe("coerceItem", () => {
    it("round-trips a written document", () => {
        const doc = toDocument(PREP, "x");
        expect(coerceItem("prep30", doc)).toEqual(PREP);
    });

    it("tolerates a sparse or foreign document (id from the path, defaults elsewhere)", () => {
        const item = coerceItem("odd10", { kind: "hologram", title: { default: "Odd" } });
        expect(item).toMatchObject({ storeId: "odd10", kind: "translation", title: { default: "Odd", he: "" }, order: Number.MAX_SAFE_INTEGER, preparationContent: [] });
        expect(coerceItem("e", {})).toMatchObject({ ...emptyItem(Number.MAX_SAFE_INTEGER), storeId: "e" });
    });
});

describe("historicalFields", () => {
    it("keeps only the migration provenance", () => {
        expect(historicalFields({ bagelId: "63d1", migratedFromBagelAt: "t", title: {} })).toEqual({ bagelId: "63d1", migratedFromBagelAt: "t" });
        expect(historicalFields({})).toEqual({});
    });
});
