import { describe, expect, it } from "vitest";
import {
    allocateNewCategoryId,
    allocateNewPartId,
    allocateNewPrayerId,
    categoryFirstId,
    inferDigitMillionsFromBaseTranslation,
    inferDigitMillionsFallback,
    itemMinIdBefore,
    resolveDigitMillions,
} from "./nusachIdPolicy";
import {
    computeItemIdForInsert,
    computeNextUpperCap,
    computeNextUpperCapForBaseRow,
} from "./itemUtils";

describe("nusachIdPolicy", () => {
    it("itemMinIdBefore matches 12-digit excel-style floor for Sefard part", () => {
        expect(itemMinIdBefore(2, "2011020")).toBe("201002211020");
        expect(itemMinIdBefore(1, "1011030")).toBe("101002211030");
        expect(itemMinIdBefore(3, "3011040")).toBe("301002211040");
    });

    it("categoryFirstId uses X018010", () => {
        expect(categoryFirstId(2)).toBe("2018010");
        expect(categoryFirstId(1)).toBe("1018010");
    });

    it("allocateNewCategoryId first vs next", () => {
        expect(allocateNewCategoryId([], 2)).toBe("2018010");
        expect(allocateNewCategoryId(["2018010", "2018030"], 2)).toBe("2018040");
    });

    it("inferDigitMillionsFromBaseTranslation reads first id", () => {
        const base = {
            categories: [
                {
                    id: "2018010",
                    prayers: [{ id: "x", parts: [] }],
                },
            ],
        };
        expect(inferDigitMillionsFromBaseTranslation(base)).toBe(2);
    });

    it("inferDigitMillionsFallback uses toc slug", () => {
        expect(inferDigitMillionsFallback("ashkenaz")).toBe(1);
        expect(inferDigitMillionsFallback("sefard-book")).toBe(2);
        expect(inferDigitMillionsFallback("edot_mizrah")).toBe(3);
    });

    it("resolveDigitMillions prefers inference", () => {
        const base = { categories: [{ id: "1018010", prayers: [] }] };
        expect(resolveDigitMillions(base, "sefard")).toBe(1);
    });

    it("allocateNewPrayerId without neighbors uses max in band + 10", () => {
        const ids = ["2015010", "2015020", "201999999"];
        expect(allocateNewPrayerId(null, null, ids, 2)).toBe("2015030");
    });

    it("allocateNewPrayerId between neighbors", () => {
        expect(allocateNewPrayerId("2015010", "2015030", ["2015010", "2015020", "2015030"], 2)).toBe(
            "2015020"
        );
    });

    it("allocateNewPartId empty prayer uses block 11 floor", () => {
        expect(allocateNewPartId([], null, 2)).toBe("2011010");
    });

    it("allocateNewPartId after middle part in block", () => {
        const parts = [{ id: "2011010" }, { id: "2011030" }, { id: "2011050" }];
        expect(allocateNewPartId(parts, "2011030", 2)).toBe("2011040");
    });

    it("computeItemIdForInsert on empty part uses minIdBefore not zero", () => {
        const floor = itemMinIdBefore(2, "2011020");
        const id = computeItemIdForInsert([], 0, { minIdBefore: floor });
        expect(id).not.toBe("0");
        expect(Number(id)).toBeGreaterThan(Number(floor));
    });

    it("keeps same id in middle insert: full linked vs sparse linked", () => {
        const ordered = ["100", "200", "300"];
        const fullLinked = [
            ["110", "130"],
            ["210", "230"],
            ["310", "330"],
        ];
        const sparseLinked = [["110", "130"], [], []];
        const insertIndex = 1;

        const idWithFull = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: fullLinked,
        });
        const idWithSparse = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: sparseLinked,
        });

        expect(idWithSparse).toBe(idWithFull);
    });

    it("keeps same id at part start with neighbor bounds", () => {
        const ordered = ["200", "300"];
        const fullLinked = [
            ["210", "230"],
            ["310", "330"],
        ];
        const sparseLinked = [[], []];
        const insertIndex = 0;
        const neighborBounds = { prevLastItemId: "150", nextFirstItemId: "400" };

        const idWithFull = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: fullLinked,
            neighborBounds,
        });
        const idWithSparse = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: sparseLinked,
            neighborBounds,
        });

        expect(idWithSparse).toBe(idWithFull);
    });

    it("keeps same id at part end with next neighbor fallback", () => {
        const ordered = ["100", "200", "300"];
        const fullLinked = [
            ["110", "130"],
            ["210", "230"],
            ["310", "330"],
        ];
        const sparseLinked = [[], [], ["310", "330"]];
        const insertIndex = 3;
        const neighborBounds = { prevLastItemId: "90", nextFirstItemId: "400" };

        const idWithFull = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: fullLinked,
            neighborBounds,
        });
        const idWithSparse = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: sparseLinked,
            neighborBounds,
        });

        expect(idWithSparse).toBe(idWithFull);
    });

    it("computeNextUpperCap picks tighter numeric cap between base and linked", () => {
        expect(computeNextUpperCap("200", "205")).toBe("200");
        expect(computeNextUpperCap("200", "199")).toBe("199");
        expect(computeNextUpperCap(undefined, "205")).toBe("205");
        expect(computeNextUpperCap("200", undefined)).toBe("200");
    });

    it("computeNextUpperCapForBaseRow uses min linked id on next base row with translations", () => {
        const baseOrder = ["100", "200"];
        const items = [
            { values: { itemId: "160", linkedItem: ["100"] } },
            { values: { itemId: "250", linkedItem: ["200"] } },
            { values: { itemId: "205", linkedItem: ["200"] } },
        ];
        expect(computeNextUpperCapForBaseRow(baseOrder, 0, items)).toBe("200");
    });

    it("first translation on base row: minIdBefore keeps id above base when part has other rows", () => {
        // מדמה createTranslationItem: insertIndex=0, רק תרגום לשורה 200, תרגום ראשון לשורה 100
        const ordered = ["250"];
        const insertIndex = 0;
        const nextCap = "200";
        const baseItemId = "100";

        const withoutFloor = computeItemIdForInsert(ordered, insertIndex, {
            nextBaseLinkedMinItemId: nextCap,
        });
        const withBaseFloor = computeItemIdForInsert(ordered, insertIndex, {
            nextBaseLinkedMinItemId: nextCap,
            minIdBefore: baseItemId,
        });

        expect(Number(withoutFloor)).toBeLessThan(Number(baseItemId));
        expect(Number(withBaseFloor)).toBeGreaterThan(Number(baseItemId));
        expect(Number(withBaseFloor)).toBeLessThan(Number(nextCap));
    });

    it("extraTakenIds act as gap blockers inside the insert window", () => {
        const ordered = ["100", "200"];
        const linked = [["110", "130"], []];
        const insertIndex = 1;

        const idWithoutGapBlocker = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: linked,
        });
        const idWithGapBlocker = computeItemIdForInsert(ordered, insertIndex, {
            linkedIdsPerPosition: linked,
            extraTakenIds: ["150"],
        });

        expect(Number(idWithGapBlocker)).toBeGreaterThan(Number(idWithoutGapBlocker));
        expect(Number(idWithGapBlocker)).toBeGreaterThan(150);
        expect(Number(idWithGapBlocker)).toBeLessThan(200);
    });
});
