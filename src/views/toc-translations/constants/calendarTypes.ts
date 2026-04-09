/**
 * טיפוסים ל-calendar / dateSetId – תואמים ל־CalendarItem ו־DateRange ב־Android (calendar.json).
 * משמשים להגדרת סט תאריכים בהוספת מקטע/הוראה (או פריט תוכן) ולביצוע "מצוא או צור" מול לוח השנה.
 */

/** טווח תאריכים עברי: יום התחלה, חודש התחלה, יום סיום, חודש סיום (1=ניסן … 13=אדר ב) */
export type DateRange = {
    startDate: number;
    startMonth: number;
    endDate: number;
    endMonth: number;
};

/** ערכים להשוואה – בלי dateSetId (המזהה נקבע לפי תוכן) */
export type CalendarEntryPayload = {
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

/** רשומה מלאה כמו ב-Firestore (כולל dateSetId) */
export type CalendarEntry = CalendarEntryPayload & { dateSetId: string };

/** ערך טופס להגדרת סט תאריכים – מערכי DateRange לבחירה בלוח, מחרוזת weekdays */
export type DateSetIdFormValues = {
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

/** מפרסר מחרוזת מספרים מופרדים (1-7) ל־weekdays */
function parseWeekdays(s: string): number[] | null {
    if (!s || typeof s !== "string") return null;
    const trimmed = s.trim();
    if (!trimmed) return null;
    const arr = trimmed.split(/[,;\s]+/).map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 7);
    return arr.length ? arr : null;
}

/** המרת ערכי טופס ל־CalendarEntryPayload (ללא dateSetId) */
export function formValuesToPayload(form: DateSetIdFormValues): CalendarEntryPayload {
    return {
        simha: form.simha || undefined,
        beitEvel: form.beitEvel || undefined,
        abroad: form.abroad || undefined,
        yad: form.yad || undefined,
        tv: form.tv || undefined,
        dates_when_we_say_prayer:
            form.dates_when_we_say_prayer?.length ? form.dates_when_we_say_prayer : undefined,
        dates_when_we_say_prayer_abroad:
            form.dates_when_we_say_prayer_abroad?.length ? form.dates_when_we_say_prayer_abroad : undefined,
        dates_when_we_dont_say_prayer:
            form.dates_when_we_dont_say_prayer?.length ? form.dates_when_we_dont_say_prayer : undefined,
        dates_when_we_dont_say_prayer_abroad:
            form.dates_when_we_dont_say_prayer_abroad?.length ? form.dates_when_we_dont_say_prayer_abroad : undefined,
        weekdays: parseWeekdays(form.weekdays) ?? undefined,
    };
}

/** השוואה נורמלית של שני DateRange */
function dateRangeEqual(a: DateRange, b: DateRange): boolean {
    return (
        a.startDate === b.startDate &&
        a.startMonth === b.startMonth &&
        a.endDate === b.endDate &&
        a.endMonth === b.endMonth
    );
}

function dateRangesEqual(a: DateRange[] | null | undefined, b: DateRange[] | null | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b || a.length !== b.length) return false;
    return a.every((r, i) => dateRangeEqual(r, b[i]));
}

function numbersEqual(a: number[] | null | undefined, b: number[] | null | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b || a.length !== b.length) return false;
    return a.every((n, i) => n === b[i]);
}

/** בודק אם שני payloads זהים (לכל המאפיינים הרלוונטיים) */
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

/** המרת entity מ-Firestore ל־CalendarEntryPayload (מערכים/אובייקטים כבר בפורמט) */
export function entityValuesToPayload(values: Record<string, any>): CalendarEntryPayload {
    return {
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
    return arr.map(ensureDateRange).filter((r) => r.startMonth && r.startDate);
}

/** המרת ערכי רשומת לוח (מ-Firestore) לערכי טופס – להצגה/עריכה במודל */
export function entityValuesToFormValues(values: Record<string, any>): DateSetIdFormValues {
    return {
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
