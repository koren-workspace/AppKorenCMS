/**
 * dateSetOccurrences – "מתי הסט הזה יחול בפועל": רשימת הימים הקרובים שבהם
 * האפליקציה תציג תוכן עם הסט, לפי התאריך העברי, ימי השבוע ומיקום (ארץ/חו"ל).
 *
 * פורט נאמן למנוע של אפליקציית ה-RN (koren-tefilla: src/engine/dateSet.ts →
 * isDateInRanges / doesDateSetRulePass) – בכוונה *לא* hebrewDateUtils.ts של
 * ה-CMS, כדי שהתצוגה המקדימה תראה בדיוק מה המתפללים יראו, כולל המקרים
 * העדינים:
 *   - חודש 13 בשנה רגילה = 12 (אדר).
 *   - טווח שקצהו תאריך שלא קיים באותה שנה (ל' חשוון בשנה חסרה) – מדלגים על
 *     כל הטווח באותה שנה.
 *   - טווח שחוצה את ראש השנה (התחלה "אחרי" הסוף) – מעוגן לשנה הקודמת/הבאה.
 *   - בחו"ל: הרשימה _abroad מחליפה את הרגילה כשהיא קיימת.
 *
 * דגלי simha/beitEvel/yad/tv לא תלויים בתאריך – הם מוצגים כ"תנאים נוספים"
 * ולא נבדקים כאן. abroad כן נבדק, כחלק מהמיקום.
 */

import { HDate } from "@hebcal/core";
import type { CalendarEntryPayload, DateRange } from "../constants/calendarTypes";

export type Location = "israel" | "abroad";

function coerceMonth(month: number, leap: boolean): number {
    return !leap && month === 13 ? 12 : month;
}

/** HDate לתאריך נתון, או null כשהתאריך לא קיים באותה שנה (hebcal מגלגל קדימה) */
function exactDate(day: number, month: number, year: number): HDate | null {
    const d = new HDate(day, month, year);
    return d.getDate() === day && d.getMonth() === month ? d : null;
}

/** עיגון קצה טווח לשנה אחרת – יום שלא קיים נחתך ל-29 (כמו KosherJava באפליקציה) */
function anchorToYear(day: number, rawMonth: number, year: number): HDate {
    const month = coerceMonth(rawMonth, HDate.isLeapYear(year));
    const clamped = Math.min(day, HDate.daysInMonth(month, year));
    return new HDate(clamped, month, year);
}

export function isDateInRanges(ranges: readonly DateRange[] | null | undefined, date: HDate): boolean {
    if (!ranges || ranges.length === 0) return false;
    const year = date.getFullYear();
    const leap = HDate.isLeapYear(year);
    const current = date.abs();
    for (const range of ranges) {
        const start = exactDate(range.startDate, coerceMonth(range.startMonth, leap), year);
        const end = exactDate(range.endDate, coerceMonth(range.endMonth, leap), year);
        if (!start || !end) continue;
        let startAbs = start.abs();
        let endAbs = end.abs();
        if (startAbs > endAbs) {
            if (startAbs > current) {
                startAbs = anchorToYear(range.startDate, range.startMonth, year - 1).abs();
            } else {
                endAbs = anchorToYear(range.endDate, range.endMonth, year + 1).abs();
            }
        }
        if (current >= startAbs && current <= endAbs) return true;
    }
    return false;
}

/** האם הסט חל ביום נתון במיקום נתון (בלי דגלי simha/beitEvel/yad/tv) */
export function occursOn(payload: CalendarEntryPayload, date: HDate, location: Location): boolean {
    const abroad = location === "abroad";
    if (payload.abroad != null && payload.abroad !== abroad) return false;
    if (payload.weekdays?.length && !payload.weekdays.includes(date.getDay() + 1)) return false;
    const negative =
        abroad && payload.dates_when_we_dont_say_prayer_abroad?.length
            ? payload.dates_when_we_dont_say_prayer_abroad
            : payload.dates_when_we_dont_say_prayer;
    if (negative?.length && isDateInRanges(negative, date)) return false;
    const positive =
        abroad && payload.dates_when_we_say_prayer_abroad?.length
            ? payload.dates_when_we_say_prayer_abroad
            : payload.dates_when_we_say_prayer;
    if (positive?.length && !isDateInRanges(positive, date)) return false;
    return true;
}

/** רצף ימים עוקבים שבהם הסט חל */
export type OccurrenceSpan = { from: HDate; to: HDate; days: number };

export type YearOccurrences = {
    year: number;
    yearLabel: string;
    leap: boolean;
    totalDays: number;
    spans: OccurrenceSpan[];
};

/**
 * מחשב את הימים שבהם הסט חל מהיום ועד סוף השנה העברית הבאה – כך התצוגה
 * כוללת תמיד גם שנה מעוברת וגם שנה רגילה, או לפחות שתי שנים שונות.
 */
export function listOccurrences(
    payload: CalendarEntryPayload,
    location: Location,
    from: Date = new Date()
): YearOccurrences[] {
    const first = new HDate(from);
    const lastYear = first.getFullYear() + 1;
    const last = new HDate(29, 6, lastYear); // כ"ט אלול של השנה הבאה
    const byYear = new Map<number, YearOccurrences>();
    let open: OccurrenceSpan | null = null;
    let openYear = 0;

    for (let abs = first.abs(); abs <= last.abs(); abs++) {
        const day = new HDate(abs);
        const year = day.getFullYear();
        if (!byYear.has(year)) {
            byYear.set(year, {
                year,
                yearLabel: new HDate(1, 7, year).renderGematriya(true).split(" ").pop() ?? String(year),
                leap: HDate.isLeapYear(year),
                totalDays: 0,
                spans: [],
            });
        }
        const bucket = byYear.get(year)!;
        if (occursOn(payload, day, location)) {
            bucket.totalDays++;
            if (open && openYear === year && open.to.abs() === abs - 1) {
                open.to = day;
                open.days++;
            } else {
                open = { from: day, to: day, days: 1 };
                openYear = year;
                bucket.spans.push(open);
            }
        }
    }
    return Array.from(byYear.values());
}

function dayAndMonth(d: HDate): string {
    // renderGematriya: "כ״ג תִּשְׁרֵי תשפ״ז" → בלי השנה ובלי ניקוד
    const parts = d.renderGematriya(true).split(" ");
    return parts.slice(0, -1).join(" ");
}

export function formatSpan(span: OccurrenceSpan): string {
    const weekday = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    if (span.days === 1) return `${dayAndMonth(span.from)} (יום ${weekday[span.from.getDay()]})`;
    return `${dayAndMonth(span.from)} – ${dayAndMonth(span.to)} (${span.days} ימים)`;
}
