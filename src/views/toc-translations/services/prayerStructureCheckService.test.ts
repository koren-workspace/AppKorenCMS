import { describe, expect, it } from "vitest";
import {
    buildPrayerStructureWarning,
    isSoftDeletedPrayer,
} from "./prayerStructureCheckService";

describe("prayerStructureCheckService – isSoftDeletedPrayer", () => {
    it("treats deleted true / string / 1 as soft-deleted", () => {
        expect(isSoftDeletedPrayer({ deleted: true })).toBe(true);
        expect(isSoftDeletedPrayer({ deleted: "true" })).toBe(true);
        expect(isSoftDeletedPrayer({ deleted: 1 })).toBe(true);
    });

    it("treats missing or inactive deleted field as active", () => {
        expect(isSoftDeletedPrayer({})).toBe(false);
        expect(isSoftDeletedPrayer({ deleted: false })).toBe(false);
        expect(isSoftDeletedPrayer(undefined)).toBe(false);
    });
});

describe("prayerStructureCheckService – buildPrayerStructureWarning", () => {
    it("warns when prayer missing in stage", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: false,
            prodExists: null,
            prodChecked: false,
            prodNeedsAuth: false,
        });
        expect(msg).toContain("3015135");
        expect(msg).toContain("סטייג'");
    });

    it("warns when prayer exists in stage but missing in prod", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: true,
            prodExists: false,
            prodChecked: true,
            prodNeedsAuth: false,
        });
        expect(msg).toContain("שמור מבנה · פרוד");
    });

    it("warns when prod check needs auth", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: true,
            prodExists: null,
            prodChecked: false,
            prodNeedsAuth: true,
        });
        expect(msg).toContain("התחבר");
    });

    it("returns null when structure is aligned", () => {
        const msg = buildPrayerStructureWarning("ערבית", "3015135", {
            stageExists: true,
            prodExists: true,
            prodChecked: true,
            prodNeedsAuth: false,
        });
        expect(msg).toBeNull();
    });
});
