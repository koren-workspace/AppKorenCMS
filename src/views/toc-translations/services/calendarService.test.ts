import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn(),
    runTransaction: vi.fn(),
}));
vi.mock("../../../firebase_config", () => ({
    getFirebaseApp: vi.fn(() => ({})),
}));
vi.mock("../collections", () => ({
    calendarCollection: {},
}));

import { buildCalendarEntryValues, findMatchingDateSetId, getNextDateSetId } from "./calendarService";

describe("calendarService – buildCalendarEntryValues", () => {
    it("includes required fields and timestamp", () => {
        const values = buildCalendarEntryValues("123", {
            label: "ט\"ו בשבט",
            simha: true,
            beitEvel: false,
            abroad: true,
            yad: false,
            tv: true,
            weekdays: [1, 7],
            dates_when_we_say_prayer: [],
            dates_when_we_say_prayer_abroad: [],
            dates_when_we_dont_say_prayer: [],
            dates_when_we_dont_say_prayer_abroad: [],
        });

        expect(values.dateSetId).toBe("123");
        expect(values.label).toBe("ט\"ו בשבט");
        expect(values.simha).toBe(true);
        expect(values.abroad).toBe(true);
        expect(values.weekdays).toEqual([1, 7]);
        expect(typeof values.timestamp).toBe("number");
        expect(values.timestamp).toBeGreaterThan(0);
    });

    it("omits empty optional arrays and label", () => {
        const values = buildCalendarEntryValues("200", {
            label: "   ",
            simha: null,
            beitEvel: null,
            abroad: null,
            yad: null,
            tv: null,
            weekdays: [],
            dates_when_we_say_prayer: [],
            dates_when_we_say_prayer_abroad: [],
            dates_when_we_dont_say_prayer: [],
            dates_when_we_dont_say_prayer_abroad: [],
        });

        expect(values.dateSetId).toBe("200");
        expect(values.label).toBeUndefined();
        expect(values.weekdays).toBeUndefined();
        expect(values.dates_when_we_say_prayer).toBeUndefined();
        expect(values.dates_when_we_say_prayer_abroad).toBeUndefined();
        expect(values.dates_when_we_dont_say_prayer).toBeUndefined();
        expect(values.dates_when_we_dont_say_prayer_abroad).toBeUndefined();
    });
});

describe("calendarService – deleted calendar entries", () => {
    const hoshana16Sunday = {
        dates_when_we_say_prayer: [{ startDate: 16, startMonth: 7, endDate: 16, endMonth: 7 }],
        weekdays: [1],
    };

    it("never reuses a deleted entry for a new item with the same conditions", () => {
        const entities = [{ id: "651", values: { dateSetId: "651", ...hoshana16Sunday, deleted: true } }] as any;
        expect(findMatchingDateSetId(entities, hoshana16Sunday)).toBeNull();
    });

    it("still matches the live entry with the same conditions", () => {
        const entities = [
            { id: "651", values: { dateSetId: "651", ...hoshana16Sunday, deleted: true } },
            { id: "700", values: { dateSetId: "700", ...hoshana16Sunday } },
        ] as any;
        expect(findMatchingDateSetId(entities, hoshana16Sunday)).toBe("700");
    });

    it("does not hand out a deleted entry's id again", () => {
        const entities = [{ id: "651", values: { deleted: true } }, { id: "650", values: {} }] as any;
        expect(getNextDateSetId(entities)).toBe("652");
    });
});
