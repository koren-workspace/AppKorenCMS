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
import { computeItemIdForInsert } from "./itemUtils";

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
});
