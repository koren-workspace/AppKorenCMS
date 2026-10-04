import { describe, expect, it } from "vitest";
import { getRelevantDateSetIds } from "./hebrewDateUtils";

// 27.9.2026 = ט"ז תשרי תשפ"ז, יום א' – the day the 651 Hoshana went missing.
const SUKKOT_16_SUNDAY = new Date(2026, 8, 27, 12);
const rule = {
    dates_when_we_say_prayer: [{ startDate: 16, startMonth: 7, endDate: 16, endMonth: 7 }],
    weekdays: [1],
};

describe("getRelevantDateSetIds – deleted entries", () => {
    it("includes a live entry on its date", () => {
        const ids = getRelevantDateSetIds([{ id: "651", values: rule }] as any, SUKKOT_16_SUNDAY);
        expect(ids).toContain("651");
    });

    it("excludes a deleted entry, as the app does", () => {
        const ids = getRelevantDateSetIds([{ id: "651", values: { ...rule, deleted: true } }] as any, SUKKOT_16_SUNDAY);
        expect(ids).not.toContain("651");
    });
});
