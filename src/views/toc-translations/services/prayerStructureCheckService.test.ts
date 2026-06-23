import { describe, expect, it } from "vitest";
import { buildPrayerStructureWarning } from "./prayerStructureCheckService";

describe("prayerStructureCheckService – buildPrayerStructureWarning", () => {
    it("warns when prayer missing in stage", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: false,
            prodExists: null,
            prodChecked: false,
        });
        expect(msg).toContain("3015135");
        expect(msg).toContain("סטייג'");
    });

    it("warns when prayer exists in stage but missing in prod", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: true,
            prodExists: false,
            prodChecked: true,
        });
        expect(msg).toContain("שמור מבנה · פרוד");
    });

    it("returns null when structure is aligned", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: true,
            prodExists: true,
            prodChecked: true,
        });
        expect(msg).toBeNull();
    });
});
