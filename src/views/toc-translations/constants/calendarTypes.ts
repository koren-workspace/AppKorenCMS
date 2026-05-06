/**
 * טיפוסים ופונקציות עזר לערכי calendar/dateSetId.
 * תואמים ל־CalendarItem ו־DateRange ב־Android (calendar.json).
 */

/** טווח תאריכים עברי: יום/חודש התחלה ויום/חודש סיום (1=ניסן … 13=אדר ב). */
export type DateRange = {
    startDate: number;
    startMonth: number;
    endDate: number;
    endMonth: number;
};

export const HEBREW_MONTHS: Record<number, string> = {
    1: "ניסן",
    2: "אייר",
    3: "סיוון",
    4: "תמוז",
    5: "אב",
    6: "אלול",
    7: "תשרי",
    8: "חשון",
    9: "כסלו",
    10: "טבת",
    11: "שבט",
    12: "אדר",
    13: "אדר ב",
};

function toPositiveInt(value: unknown): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    const intVal = Math.trunc(num);
    return intVal > 0 ? intVal : 0;
}

export function normalizeDateRange(range: DateRange): DateRange {
    return {
        startDate: toPositiveInt(range.startDate),
        startMonth: toPositiveInt(range.startMonth),
        endDate: toPositiveInt(range.endDate),
        endMonth: toPositiveInt(range.endMonth),
    };
}

export function dateRangeKey(range: DateRange): string {
    const normalized = normalizeDateRange(range);
    return `${normalized.startMonth}-${normalized.startDate}-${normalized.endMonth}-${normalized.endDate}`;
}

export function isSingleDayRange(range: DateRange): boolean {
    const normalized = normalizeDateRange(range);
    return normalized.startDate === normalized.endDate && normalized.startMonth === normalized.endMonth;
}

function compareDateRanges(a: DateRange, b: DateRange): number {
    const left = normalizeDateRange(a);
    const right = normalizeDateRange(b);
    if (left.startMonth !== right.startMonth) return left.startMonth - right.startMonth;
    if (left.startDate !== right.startDate) return left.startDate - right.startDate;
    if (left.endMonth !== right.endMonth) return left.endMonth - right.endMonth;
    return left.endDate - right.endDate;
}

export function sortDateRanges(ranges: DateRange[]): DateRange[] {
    return [...ranges].sort(compareDateRanges);
}

export function getHebrewMonthName(month: number): string {
    return HEBREW_MONTHS[month] ?? `חודש ${month}`;
}

const HEBREW_TENS: Record<number, string> = { 10: "י", 20: "כ", 30: "ל" };
const HEBREW_ONES: Record<number, string> = {
    1: "א", 2: "ב", 3: "ג", 4: "ד", 5: "ה",
    6: "ו", 7: "ז", 8: "ח", 9: "ט",
};

/**
 * ממיר מספר יום (1–30) לאותיות עבריות (גימטריה).
 * 15 → ט"ו, 16 → ט"ז (ולא יה/יו שהם ראשי תיבות).
 */
export function toHebrewNumeral(n: number): string {
    if (n <= 0 || n > 30) return String(n);
    if (n === 15) return 'ט"ו';
    if (n === 16) return 'ט"ז';
    const tens = Math.floor(n / 10) * 10;
    const ones = n % 10;
    const letters = (HEBREW_TENS[tens] ?? "") + (HEBREW_ONES[ones] ?? "");
    if (letters.length === 0) return String(n);
    if (letters.length === 1) return letters + "'";
    return letters[0] + '"' + letters.slice(1);
}

function formatDatePoint(day: number, month: number): string {
    return `${toHebrewNumeral(day)} ${getHebrewMonthName(month)}`;
}

export function formatDateRangeLabel(range: DateRange): string {
    const normalized = normalizeDateRange(range);
    if (isSingleDayRange(normalized)) return formatDatePoint(normalized.startDate, normalized.startMonth);
    if (normalized.startMonth === normalized.endMonth) {
        return `${toHebrewNumeral(normalized.startDate)}-${toHebrewNumeral(normalized.endDate)} ${getHebrewMonthName(normalized.startMonth)}`;
    }
    return `${formatDatePoint(normalized.startDate, normalized.startMonth)} - ${formatDatePoint(normalized.endDate, normalized.endMonth)}`;
}

/** ערכי השוואה ללא dateSetId (המזהה נקבע לפי תוכן). */
export type CalendarEntryPayload = {
    label?: string | null;
    simha?: boolean | null;
    beitEvel?: boolean | null;
    abroad?: boolean | null;
    yad?: boolean | null;
    tv?: boolean | null;
    dates_when_we_say_prayer?: DateRange[] | null;
    dates_when_we_say_prayer_abroad?: DateRange[] | null;
    dates_when_we_dont_say_prayer?: DateRange[] | null;
    dates_when_we_dont_say_prayer_abroad?: DateRange[] | null;
    weekdays?: number[] | null;
};

/** רשומה מלאה כפי שנשמרת ב-Firestore (כולל dateSetId). */
export type CalendarEntry = CalendarEntryPayload & { dateSetId: string };

/** ערכי הטופס למודל הגדרת dateSet. */
export type DateSetIdFormValues = {
    label: string;
    simha: boolean;
    beitEvel: boolean;
    abroad: boolean;
    yad: boolean;
    tv: boolean;
    dates_when_we_say_prayer: DateRange[];
    dates_when_we_say_prayer_abroad: DateRange[];
    dates_when_we_dont_say_prayer: DateRange[];
    dates_when_we_dont_say_prayer_abroad: DateRange[];
    weekdays: string;
};

export const defaultDateSetIdFormValues: DateSetIdFormValues = {
    label: "",
    simha: false,
    beitEvel: false,
    abroad: false,
    yad: false,
    tv: false,
    dates_when_we_say_prayer: [],
    dates_when_we_say_prayer_abroad: [],
    dates_when_we_dont_say_prayer: [],
    dates_when_we_dont_say_prayer_abroad: [],
    weekdays: "",
};

/** מפרסר מחרוזת מספרים מופרדים (1-7) ל־weekdays. */
function parseWeekdays(s: string): number[] | null {
    if (!s || typeof s !== "string") return null;
    const trimmed = s.trim();
    if (!trimmed) return null;
    const arr = trimmed
        .split(/[,;\s]+/)
        .map((n) => parseInt(n, 10))
        .filter((n) => n >= 1 && n <= 7);
    return arr.length ? arr : null;
}

/** המרת ערכי טופס ל־CalendarEntryPayload (ללא dateSetId). */
export function formValuesToPayload(form: DateSetIdFormValues): CalendarEntryPayload {
    return {
        label: form.label?.trim() || undefined,
        simha: form.simha || undefined,
        beitEvel: form.beitEvel || undefined,
        abroad: form.abroad || undefined,
        yad: form.yad || undefined,
        tv: form.tv || undefined,
        dates_when_we_say_prayer: form.dates_when_we_say_prayer?.length
            ? sortDateRanges(form.dates_when_we_say_prayer)
            : undefined,
        dates_when_we_say_prayer_abroad: form.dates_when_we_say_prayer_abroad?.length
            ? sortDateRanges(form.dates_when_we_say_prayer_abroad)
            : undefined,
        dates_when_we_dont_say_prayer: form.dates_when_we_dont_say_prayer?.length
            ? sortDateRanges(form.dates_when_we_dont_say_prayer)
            : undefined,
        dates_when_we_dont_say_prayer_abroad: form.dates_when_we_dont_say_prayer_abroad?.length
            ? sortDateRanges(form.dates_when_we_dont_say_prayer_abroad)
            : undefined,
        weekdays: parseWeekdays(form.weekdays) ?? undefined,
    };
}

/** השוואה נורמלית של שני DateRange. */
function dateRangeEqual(a: DateRange, b: DateRange): boolean {
    const left = normalizeDateRange(a);
    const right = normalizeDateRange(b);
    return (
        left.startDate === right.startDate &&
        left.startMonth === right.startMonth &&
        left.endDate === right.endDate &&
        left.endMonth === right.endMonth
    );
}

function dateRangesEqual(a: DateRange[] | null | undefined, b: DateRange[] | null | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b || a.length !== b.length) return false;
    const left = sortDateRanges(a);
    const right = sortDateRanges(b);
    return left.every((r, i) => dateRangeEqual(r, right[i]));
}

function numbersEqual(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b || a.length !== b.length) return false;
    return a.every((n, i) => n === b[i]);
}

/** בודק אם שני payloads זהים (לכל המאפיינים הרלוונטיים). */
export function calendarPayloadsEqual(a: CalendarEntryPayload, b: CalendarEntryPayload): boolean {
    return (
        (a.simha === b.simha || (a.simha == null && b.simha == null)) &&
        (a.beitEvel === b.beitEvel || (a.beitEvel == null && b.beitEvel == null)) &&
        (a.abroad === b.abroad || (a.abroad == null && b.abroad == null)) &&
        (a.yad === b.yad || (a.yad == null && b.yad == null)) &&
        (a.tv === b.tv || (a.tv == null && b.tv == null)) &&
        dateRangesEqual(a.dates_when_we_say_prayer, b.dates_when_we_say_prayer) &&
        dateRangesEqual(a.dates_when_we_say_prayer_abroad, b.dates_when_we_say_prayer_abroad) &&
        dateRangesEqual(a.dates_when_we_dont_say_prayer, b.dates_when_we_dont_say_prayer) &&
        dateRangesEqual(a.dates_when_we_dont_say_prayer_abroad, b.dates_when_we_dont_say_prayer_abroad) &&
        numbersEqual(
            a.weekdays != null && a.weekdays.length ? [...a.weekdays].sort() : null,
            b.weekdays != null && b.weekdays.length ? [...b.weekdays].sort() : null
        )
    );
}

const WEEKDAY_SHORT: Record<number, string> = { 1: "א", 2: "ב", 3: "ג", 4: "ד", 5: "ה", 6: "ו", 7: "ש" };

/**
 * בונה תיאור קצר וקריא מ-CalendarEntryPayload לתצוגת badge ב-CMS.
 * מחזיר: { short, full }
 *   - short: שם קצר לתצוגה (label ידני, או פולבק אוטומטי מקוצר ל-40 תווים)
 *   - full: תיאור מלא לtitle/tooltip
 * dateSetId 100 = "תמיד" (מוצג תמיד, ללא הגבלה).
 */
export function buildDateSetLabel(
    payload: CalendarEntryPayload,
    dateSetId?: string
): { short: string; full: string } {
    if (dateSetId === "100") return { short: "תמיד", full: "תמיד" };

    if (payload.label?.trim()) {
        return { short: payload.label.trim(), full: payload.label.trim() };
    }

    const parts: string[] = [];

    if (payload.simha) parts.push("שמחה");
    if (payload.beitEvel) parts.push("בית אבל");
    if (payload.abroad) parts.push('חו"ל');
    if (payload.yad) parts.push("יד");
    if (payload.tv) parts.push('ט"ו');

    if (payload.dates_when_we_say_prayer?.length) {
        const dates = payload.dates_when_we_say_prayer.map(formatDateRangeLabel).join(", ");
        parts.push(`אומרים: ${dates}`);
    }
    if (payload.dates_when_we_say_prayer_abroad?.length) {
        const dates = payload.dates_when_we_say_prayer_abroad.map(formatDateRangeLabel).join(", ");
        parts.push(`אומרים חו"ל: ${dates}`);
    }
    if (payload.dates_when_we_dont_say_prayer?.length) {
        const dates = payload.dates_when_we_dont_say_prayer.map(formatDateRangeLabel).join(", ");
        parts.push(`לא אומרים: ${dates}`);
    }
    if (payload.dates_when_we_dont_say_prayer_abroad?.length) {
        const dates = payload.dates_when_we_dont_say_prayer_abroad.map(formatDateRangeLabel).join(", ");
        parts.push(`לא אומרים חו"ל: ${dates}`);
    }
    if (payload.weekdays?.length) {
        const days = payload.weekdays.map((d) => WEEKDAY_SHORT[d] ?? String(d)).join(",");
        parts.push(`ימי שבוע: ${days}`);
    }

    const full = parts.length ? parts.join(" | ") : `ID ${dateSetId ?? "?"}`;
    const short = full.length > 40 ? full.slice(0, 38) + "…" : full;
    return { short, full };
}

/** המרת entity מ-Firestore ל־CalendarEntryPayload. */
export function entityValuesToPayload(values: Record<string, any>): CalendarEntryPayload {
    return {
        label: typeof values.label === "string" && values.label.trim() ? values.label.trim() : undefined,
        simha: values.simha ?? undefined,
        beitEvel: values.beitEvel ?? undefined,
        abroad: values.abroad ?? undefined,
        yad: values.yad ?? undefined,
        tv: values.tv ?? undefined,
        dates_when_we_say_prayer: (values.dates_when_we_say_prayer as DateRange[] | undefined) ?? undefined,
        dates_when_we_say_prayer_abroad:
            (values.dates_when_we_say_prayer_abroad as DateRange[] | undefined) ?? undefined,
        dates_when_we_dont_say_prayer:
            (values.dates_when_we_dont_say_prayer as DateRange[] | undefined) ?? undefined,
        dates_when_we_dont_say_prayer_abroad:
            (values.dates_when_we_dont_say_prayer_abroad as DateRange[] | undefined) ?? undefined,
        weekdays: Array.isArray(values.weekdays) ? values.weekdays : undefined,
    };
}

function ensureDateRange(r: any): DateRange {
    if (r && typeof r === "object" && "startDate" in r && "startMonth" in r)
        return {
            startDate: Number(r.startDate),
            startMonth: Number(r.startMonth),
            endDate: "endDate" in r ? Number(r.endDate) : Number(r.startDate),
            endMonth: "endMonth" in r ? Number(r.endMonth) : Number(r.startMonth),
        };
    return { startDate: 0, startMonth: 0, endDate: 0, endMonth: 0 };
}

function ensureDateRangeList(arr: any): DateRange[] {
    if (!Array.isArray(arr)) return [];
    return sortDateRanges(arr.map(ensureDateRange).filter((r) => r.startMonth && r.startDate));
}

/** המרת ערכי רשומת לוח (מ-Firestore) לערכי טופס – להצגה/עריכה במודל. */
export function entityValuesToFormValues(values: Record<string, any>): DateSetIdFormValues {
    return {
        label: typeof values.label === "string" ? values.label : "",
        simha: !!values.simha,
        beitEvel: !!values.beitEvel,
        abroad: !!values.abroad,
        yad: !!values.yad,
        tv: !!values.tv,
        dates_when_we_say_prayer: ensureDateRangeList(values.dates_when_we_say_prayer),
        dates_when_we_say_prayer_abroad: ensureDateRangeList(values.dates_when_we_say_prayer_abroad),
        dates_when_we_dont_say_prayer: ensureDateRangeList(values.dates_when_we_dont_say_prayer),
        dates_when_we_dont_say_prayer_abroad: ensureDateRangeList(values.dates_when_we_dont_say_prayer_abroad),
        weekdays: Array.isArray(values.weekdays) ? values.weekdays.join(",") : "",
    };
}
