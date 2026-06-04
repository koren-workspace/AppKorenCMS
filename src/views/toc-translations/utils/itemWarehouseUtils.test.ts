import { describe, it, expect } from "vitest";
import {
    buildWarehouseEntryFromRow,
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

    it("warehouseSnapshotsToEntities preserves values", () => {
        const entities = warehouseSnapshotsToEntities([
            { entityId: "x", values: { itemId: "5", content: "hi" } },
        ]);
        expect(entities[0].id).toBe("x");
        expect(entities[0].values.content).toBe("hi");
    });
});
