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

import { buildCalendarEntryValues } from "./calendarService";

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
