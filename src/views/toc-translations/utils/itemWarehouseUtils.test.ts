import { describe, it, expect } from "vitest";
import {
    buildWarehouseEntryFromRow,
    buildWarehouseEntryFromRows,
    warehouseEntrySourceItemIds,
    warehouseSnapshotsToEntities,
} from "./itemWarehouseUtils";

describe("itemWarehouseUtils", () => {
    it("buildWarehouseEntryFromRow merges base and enhancements", () => {
        const entry = buildWarehouseEntryFromRow({
            sourceMeta: {
                tocId: "ashkenaz",
                sourceTocId: "ashkenaz",
                translationId: "0-ashkenaz",
                prayerId: "shacharit",
                partId: "part1",
                itemIds: ["100"],
            },
            baseEntity: {
                id: "ent1",
                values: { itemId: "100", content: "אמן", type: "body" },
            } as any,
            baseLocalValues: { content: "אמן!" },
            relatedEnhancements: [
                {
                    id: "enh1",
                    tId: "1-ashkenaz",
                    values: { content: "Amen", linkedItem: ["100"] },
                },
            ],
            enhancementLocalValues: {},
        });
        expect(entry.schemaVersion).toBe(2);
        expect(entry.sourceMeta.sourceTocId).toBe("ashkenaz");
        expect(entry.baseItems[0].values.content).toBe("אמן!");
        expect(entry.enhancementsByTranslationId["1-ashkenaz"]).toHaveLength(1);
        expect(warehouseEntrySourceItemIds(entry)).toEqual(["100"]);
    });

    it("buildWarehouseEntryFromRows stores several items in itemId order with one copy per translation", () => {
        const entry = buildWarehouseEntryFromRows({
            sourceMeta: {
                tocId: "ashkenaz",
                sourceTocId: "ashkenaz",
                translationId: "0-ashkenaz",
                prayerId: "shacharit",
                partId: "part1",
                itemIds: ["300", "100", "200"],
            },
            baseRows: [
                { baseEntity: { id: "e3", values: { itemId: "300", content: "ג" } } as any, baseLocalValues: {} },
                { baseEntity: { id: "e1", values: { itemId: "100", content: "א" } } as any, baseLocalValues: {} },
                { baseEntity: { id: "e2", values: { itemId: "200", content: "ב" } } as any, baseLocalValues: { content: "ב!" } },
            ],
            relatedEnhancements: [
                // מקושר לשני פריטים נבחרים – מופיע פעמיים בקלט, נשמר פעם אחת
                { id: "enh1", tId: "1-ashkenaz", values: { content: "A-B", linkedItem: ["100", "200"] } },
                { id: "enh1", tId: "1-ashkenaz", values: { content: "A-B", linkedItem: ["100", "200"] } },
                { id: "enh2", tId: "1-ashkenaz", values: { content: "C", linkedItem: ["300"] } },
            ],
            enhancementLocalValues: { enh2: { content: "C!" } },
        });
        expect(warehouseEntrySourceItemIds(entry)).toEqual(["100", "200", "300"]);
        expect(entry.baseItems.map((b) => b.entityId)).toEqual(["e1", "e2", "e3"]);
        expect(entry.baseItems[1].values.content).toBe("ב!");
        expect(entry.label).toBe("3 פריטים: א");
        expect(entry.enhancementsByTranslationId["1-ashkenaz"].map((s) => s.entityId)).toEqual([
            "enh1",
            "enh2",
        ]);
        expect(entry.enhancementsByTranslationId["1-ashkenaz"][1].values.content).toBe("C!");
    });

    it("warehouseSnapshotsToEntities preserves values", () => {
        const entities = warehouseSnapshotsToEntities([
            { entityId: "x", values: { itemId: "5", content: "hi" } },
        ]);
        expect(entities[0].id).toBe("x");
        expect(entities[0].values.content).toBe("hi");
    });
});
