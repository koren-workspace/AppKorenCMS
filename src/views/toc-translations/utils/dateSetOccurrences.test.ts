import { describe, expect, it } from "vitest";
import { HDate } from "@hebcal/core";
import { isDateInRanges, listOccurrences, occursOn } from "./dateSetOccurrences";

const range = (startDate: number, startMonth: number, endDate = startDate, endMonth = startMonth) => ({
    startDate,
    startMonth,
    endDate,
    endMonth,
});

describe("isDateInRanges – app engine parity", () => {
    it("Chanukah (25 Kislev – 2 Tevet) is 8 days", () => {
        // 5787: Kislev has 30 days
        const chanukah = [range(25, 9, 2, 10)];
        let days = 0;
        for (let abs = new HDate(20, 9, 5787).abs(); abs <= new HDate(10, 10, 5787).abs(); abs++) {
            if (isDateInRanges(chanukah, new HDate(abs))) days++;
        }
        expect(days).toBe(8);
    });

    it("skips a range whose endpoint does not exist that year (30 Cheshvan in 5786)", () => {
        expect(HDate.daysInMonth(8, 5786)).toBe(29);
        expect(isDateInRanges([range(25, 8, 30, 8)], new HDate(26, 8, 5786))).toBe(false);
        expect(isDateInRanges([range(25, 8, 30, 8)], new HDate(26, 8, 5787))).toBe(true);
    });

    it("month 13 in a non-leap year means Adar", () => {
        // 5786 is not leap: 14 Adar (12) must match a rule written for 14/13
        expect(HDate.isLeapYear(5786)).toBe(false);
        expect(isDateInRanges([range(14, 13)], new HDate(14, 12, 5786))).toBe(true);
        // 5787 is leap: 14 Adar I is Purim Katan, not 14/13
        expect(isDateInRanges([range(14, 13)], new HDate(14, 12, 5787))).toBe(false);
        expect(isDateInRanges([range(14, 13)], new HDate(14, 13, 5787))).toBe(true);
    });

    it("handles a range across Rosh Hashana (25 Elul – 10 Tishrei)", () => {
        const r = [range(25, 6, 10, 7)];
        expect(isDateInRanges(r, new HDate(5, 7, 5787))).toBe(true);
        expect(isDateInRanges(r, new HDate(27, 6, 5787))).toBe(true);
        expect(isDateInRanges(r, new HDate(15, 7, 5787))).toBe(false);
    });
});

describe("occursOn", () => {
    it("abroad=false never applies abroad", () => {
        const d = new HDate(1, 7, 5787);
        expect(occursOn({ abroad: false }, d, "israel")).toBe(true);
        expect(occursOn({ abroad: false }, d, "abroad")).toBe(false);
    });

    it("abroad list replaces the regular list abroad", () => {
        const p = {
            dates_when_we_say_prayer: [range(22, 7)],
            dates_when_we_say_prayer_abroad: [range(23, 7)],
        };
        expect(occursOn(p, new HDate(22, 7, 5787), "israel")).toBe(true);
        expect(occursOn(p, new HDate(22, 7, 5787), "abroad")).toBe(false);
        expect(occursOn(p, new HDate(23, 7, 5787), "abroad")).toBe(true);
    });

    it("weekdays use 1=Sunday … 7=Shabbat", () => {
        const shabbat = new HDate(new Date(2026, 9, 3, 12)); // Saturday 3.10.2026
        expect(occursOn({ weekdays: [7] }, shabbat, "israel")).toBe(true);
        expect(occursOn({ weekdays: [1] }, shabbat, "israel")).toBe(false);
    });
});

describe("listOccurrences", () => {
    it("groups consecutive days and covers this year and next", () => {
        const years = listOccurrences({ dates_when_we_say_prayer: [range(15, 7, 21, 7)] }, "israel", new Date(2026, 9, 4, 12));
        expect(years.map((y) => y.year)).toEqual([5787, 5788]);
        // 4.10.2026 = כ"ג תשרי – Sukkot 5787 is already over
        expect(years[0].totalDays).toBe(0);
        expect(years[1].totalDays).toBe(7);
        expect(years[1].spans).toHaveLength(1);
    });
});
