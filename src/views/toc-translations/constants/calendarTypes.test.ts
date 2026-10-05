import { describe, expect, it } from "vitest";
import {
    diffCalendarPayloads,
    entityValuesToFormValues,
    formValuesToPayload,
    validateCalendarPayload,
} from "./calendarTypes";

const range = (startDate: number, startMonth: number, endDate = startDate, endMonth = startMonth) => ({
    startDate,
    startMonth,
    endDate,
    endMonth,
});

describe("form round-trip keeps false flags", () => {
    // abroad=false means "Israel only" in the app – 153 flags in the live data are false.
    it("abroad=false survives load → payload", () => {
        const form = entityValuesToFormValues({ abroad: false, simha: true, dates_when_we_say_prayer: [range(1, 7)] });
        expect(form.abroad).toBe(false);
        expect(form.beitEvel).toBeNull();
        const payload = formValuesToPayload(form);
        expect(payload.abroad).toBe(false);
        expect(payload.simha).toBe(true);
        expect(payload.beitEvel).toBeUndefined();
    });
});

describe("validateCalendarPayload", () => {
    it("blocks a set with no condition left (that is ID 100)", () => {
        expect(validateCalendarPayload({}).errors).toHaveLength(1);
    });

    it("a false flag alone is a real condition", () => {
        expect(validateCalendarPayload({ abroad: false }).errors).toEqual([]);
    });

    it("blocks out-of-range months and days", () => {
        expect(validateCalendarPayload({ dates_when_we_say_prayer: [range(1, 14)] }).errors).toHaveLength(1);
        expect(validateCalendarPayload({ dates_when_we_say_prayer: [range(31, 1)] }).errors).toHaveLength(1);
    });

    it("single-day 30 Cheshvan (Rosh Chodesh) is fine", () => {
        const v = validateCalendarPayload({ dates_when_we_say_prayer: [range(30, 8)] });
        expect(v.errors).toEqual([]);
        expect(v.warnings).toEqual([]);
    });

    it("warns on a multi-day range ending on 30 Kislev – the app skips it in short years", () => {
        const v = validateCalendarPayload({ dates_when_we_say_prayer: [range(25, 9, 30, 9)] });
        expect(v.warnings).toHaveLength(1);
    });

    it("warns that 30 Iyar never exists", () => {
        expect(validateCalendarPayload({ dates_when_we_say_prayer: [range(30, 2)] }).warnings).toHaveLength(1);
    });

    it("blocks invalid weekdays", () => {
        expect(validateCalendarPayload({ weekdays: [0, 8] }).errors.length).toBeGreaterThan(0);
    });
});

describe("diffCalendarPayloads", () => {
    it("is empty when nothing changed", () => {
        const p = { abroad: false, dates_when_we_say_prayer: [range(1, 7)] };
        expect(diffCalendarPayloads(p, { ...p })).toEqual([]);
    });

    it("reports a flag going from false to no-condition", () => {
        const rows = diffCalendarPayloads({ abroad: false }, {});
        expect(rows).toHaveLength(1);
        expect(rows[0].before).toBe("רק בארץ");
        expect(rows[0].after).toBe("אין תנאי");
    });

    it("reports changed dates and weekdays", () => {
        const rows = diffCalendarPayloads(
            { dates_when_we_say_prayer: [range(1, 7)], weekdays: [7] },
            { dates_when_we_say_prayer: [range(2, 7)] }
        );
        expect(rows.map((r) => r.field)).toEqual(["תאריכים שאומרים", "ימי שבוע"]);
    });
});
