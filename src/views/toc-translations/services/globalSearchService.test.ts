import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({}));
vi.mock("../../../firebase_config", () => ({ getFirebaseApp: vi.fn() }));

import {
    buildSearchTargets,
    matchItem,
    normalizeForSearch,
    searchLoaded,
    stripHtml,
    targetKey,
    toCachedItem,
    type GlobalSearchScope,
} from "./globalSearchService";

const prayer = (id: string, name: string, parts: any[], extra: any = {}) => ({ id, name, parts, ...extra });

const tocs = [
    {
        id: "ashkenaz",
        values: {
            nusach: "אשכנז",
            translations: [
                {
                    translationId: "0-ashkenaz",
                    categories: [
                        {
                            id: "c1",
                            name: "חול",
                            prayers: [
                                prayer("p1", "שחרית", [
                                    { id: "a", name: "ברכות השחר" },
                                    { id: "gone", name: "מחוק", deleted: true },
                                ]),
                                prayer("p-del", "מחוקה", [], { deleted: true }),
                            ],
                        },
                        { id: "c2", name: "שבת", prayers: [prayer("p2", "מוסף", [{ id: "b", name: "קדושה" }])] },
                    ],
                },
                {
                    translationId: "1-ashkenaz",
                    categories: [{ id: "c1", name: "חול", prayers: [prayer("p1", "שחרית", [{ id: "a", name: "x" }])] }],
                },
            ],
        },
    },
    {
        id: "sefard",
        values: {
            translations: [
                {
                    translationId: "0-sefard",
                    categories: [{ id: "c9", name: "חול", prayers: [prayer("p1", "שחרית", [{ id: "a", name: "y" }])] }],
                },
                {
                    translationId: "1-sefard",
                    categories: [{ id: "c9", name: "חול", prayers: [prayer("p1", "שחרית", [{ id: "a", name: "z" }])] }],
                },
            ],
        },
    },
    { id: "old", values: { deleted: true, translations: [{ translationId: "0-old", categories: [] }] } },
];

const scope = (nusach: "current" | "all", translation: "current" | "all"): GlobalSearchScope => ({
    nusach,
    translation,
    currentTocId: "ashkenaz",
    currentTranslationId: "0-ashkenaz",
});

const keys = (s: GlobalSearchScope) => buildSearchTargets(tocs, s).map(targetKey);

describe("normalizeForSearch", () => {
    it("ignores niqqud, cantillation, case and extra spaces", () => {
        expect(normalizeForSearch("  בָּרוּךְ   אַתָּה ")).toBe("ברוך אתה");
        expect(normalizeForSearch("Blessed ARE")).toBe("blessed are");
    });

    it("treats a maqaf as a space", () => {
        expect(normalizeForSearch("עַל־כֵּן")).toBe("על כן");
    });

    it("decomposes presentation forms (vav with dagesh)", () => {
        expect(normalizeForSearch("וּ")).toBe("ו");
    });
});

describe("stripHtml", () => {
    it("removes tags and decodes common entities", () => {
        expect(stripHtml("<b>אמן</b>&nbsp;ו&amp;<br/>סלה")).toBe("אמן ו& סלה");
    });
});

describe("buildSearchTargets", () => {
    it("current translation only: every category, skipping deleted prayers", () => {
        expect(keys(scope("current", "current"))).toEqual(["0-ashkenaz/p1", "0-ashkenaz/p2"]);
    });

    it("current nusach, all translations", () => {
        expect(keys(scope("current", "all"))).toEqual(["0-ashkenaz/p1", "0-ashkenaz/p2", "1-ashkenaz/p1"]);
    });

    it("all nusachim, same translation kind (prefix)", () => {
        expect(keys(scope("all", "current"))).toEqual(["0-ashkenaz/p1", "0-ashkenaz/p2", "0-sefard/p1"]);
    });

    it("all nusachim, all translations, skipping deleted nusachim", () => {
        expect(keys(scope("all", "all"))).toEqual([
            "0-ashkenaz/p1",
            "0-ashkenaz/p2",
            "1-ashkenaz/p1",
            "0-sefard/p1",
            "1-sefard/p1",
        ]);
    });

    it("carries location names and only live parts", () => {
        const [t] = buildSearchTargets(tocs, scope("current", "current"));
        expect(t).toMatchObject({ tocId: "ashkenaz", nusachLabel: "אשכנז", categoryId: "c1", prayerName: "שחרית" });
        expect([...t.partNames.keys()]).toEqual(["a"]);
    });
});

describe("matchItem", () => {
    const item = toCachedItem("doc1", {
        itemId: "1015010001",
        partId: "a",
        content: "<b>בָּרוּךְ</b> אַתָּה ה׳ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם",
        title: "ברכה",
    })!;

    it("finds text regardless of niqqud and highlights the original (pointed) text", () => {
        const m = matchItem(item, normalizeForSearch("אתה"))!;
        expect(m.field).toBe("content");
        expect(m.match).toBe("אַתָּה");
        expect(m.before).toBe("בָּרוּךְ ");
    });

    it("includes trailing marks of the last matched letter", () => {
        expect(matchItem(item, normalizeForSearch("ברוך"))!.match).toBe("בָּרוּךְ");
    });

    it("falls back to title, then item id", () => {
        expect(matchItem(item, normalizeForSearch("ברכה"))!.field).toBe("title");
        expect(matchItem(item, "1015010001")!.field).toBe("itemId");
    });

    it("returns null when nothing matches", () => {
        expect(matchItem(item, normalizeForSearch("קדיש"))).toBeNull();
    });

    it("skips deleted items", () => {
        expect(toCachedItem("d", { deleted: true, content: "x" })).toBeNull();
    });
});

describe("searchLoaded", () => {
    it("returns hits with full location, ignoring items of deleted parts", () => {
        const targets = buildSearchTargets(tocs, scope("current", "current"));
        const loaded = new Map([
            [
                "0-ashkenaz/p1",
                [
                    toCachedItem("d1", { itemId: "1", partId: "a", content: "מודה אני" })!,
                    toCachedItem("d2", { itemId: "2", partId: "gone", content: "מודה אני" })!,
                ],
            ],
            ["0-ashkenaz/p2", [toCachedItem("d3", { itemId: "3", partId: "b", content: "מודים אנחנו" })!]],
        ]);
        const hits = searchLoaded(targets, loaded, "מוד");
        expect(hits.map((h) => h.docId)).toEqual(["d1", "d3"]);
        expect(hits[1]).toMatchObject({ categoryName: "שבת", prayerName: "מוסף", partName: "קדושה", partId: "b" });
        expect(searchLoaded(targets, loaded, "   ")).toEqual([]);
    });
});
