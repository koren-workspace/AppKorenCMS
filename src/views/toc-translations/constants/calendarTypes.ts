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

/**
 * דגל תלת־מצבי: null = לא משנה (אין תנאי), true = רק כש..., false = רק כשלא...
 * `false` הוא תנאי אמיתי באפליקציה (למשל abroad=false = "רק בארץ") – אסור לאבד אותו.
 */
export type TriStateFlag = boolean | null;

/** ערכי הטופס למודל הגדרת dateSet. */
export type DateSetIdFormValues = {
    label: string;
    simha: TriStateFlag;
    beitEvel: TriStateFlag;
    abroad: TriStateFlag;
    yad: TriStateFlag;
    tv: TriStateFlag;
    dates_when_we_say_prayer: DateRange[];
    dates_when_we_say_prayer_abroad: DateRange[];
    dates_when_we_dont_say_prayer: DateRange[];
    dates_when_we_dont_say_prayer_abroad: DateRange[];
    weekdays: string;
};

export const defaultDateSetIdFormValues: DateSetIdFormValues = {
    label: "",
    simha: null,
    beitEvel: null,
    abroad: null,
    yad: null,
    tv: null,
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
        simha: form.simha ?? undefined,
        beitEvel: form.beitEvel ?? undefined,
        abroad: form.abroad ?? undefined,
        yad: form.yad ?? undefined,
        tv: form.tv ?? undefined,
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

export type CalendarFlagKey = "simha" | "beitEvel" | "abroad" | "yad" | "tv";

/**
 * הדגלים הבוליאניים ומשמעותם באפליקציה (dateSet.ts → passesBooleanGates).
 * yes/no = תיאור קצר כשהדגל true/false; ריק (null) = אין תנאי.
 */
export const CALENDAR_FLAGS: ReadonlyArray<{
    key: CalendarFlagKey;
    name: string;
    yes: string;
    no: string;
}> = [
    { key: "simha", name: "שמחה (simha)", yes: "רק כשיש שמחה", no: "רק כשאין שמחה" },
    { key: "beitEvel", name: "בית אבל (beitEvel)", yes: "רק בבית אבל", no: "רק כשלא בבית אבל" },
    { key: "abroad", name: 'חו"ל (abroad)', yes: 'רק בחו"ל', no: "רק בארץ" },
    { key: "yad", name: "פורים י\"ד (yad)", yes: "רק במקום שקוראים בי\"ד", no: "רק במקום שלא קוראים בי\"ד" },
    { key: "tv", name: "שושן פורים ט\"ו (tv)", yes: "רק במקום שקוראים בט\"ו", no: "רק במקום שלא קוראים בט\"ו" },
];

/** תיאור ערך דגל בודד, כולל "אין תנאי" */
export function describeFlagValue(key: CalendarFlagKey, value: boolean | null | undefined): string {
    const flag = CALENDAR_FLAGS.find((f) => f.key === key);
    if (!flag || value == null) return "אין תנאי";
    return value ? flag.yes : flag.no;
}

export const DATE_LIST_FIELDS: ReadonlyArray<{
    key:
        | "dates_when_we_say_prayer"
        | "dates_when_we_say_prayer_abroad"
        | "dates_when_we_dont_say_prayer"
        | "dates_when_we_dont_say_prayer_abroad";
    name: string;
}> = [
    { key: "dates_when_we_say_prayer", name: "תאריכים שאומרים" },
    { key: "dates_when_we_say_prayer_abroad", name: 'תאריכים שאומרים (חו"ל)' },
    { key: "dates_when_we_dont_say_prayer", name: "תאריכים שלא אומרים" },
    { key: "dates_when_we_dont_say_prayer_abroad", name: 'תאריכים שלא אומרים (חו"ל)' },
];

const WEEKDAY_FULL: Record<number, string> = {
    1: "ראשון", 2: "שני", 3: "שלישי", 4: "רביעי", 5: "חמישי", 6: "שישי", 7: "שבת",
};

function describeDateList(ranges: DateRange[] | null | undefined): string {
    if (!ranges?.length) return "(ריק)";
    return sortDateRanges(ranges).map(formatDateRangeLabel).join(", ");
}

function describeWeekdays(weekdays: number[] | null | undefined): string {
    if (!weekdays?.length) return "כל הימים";
    return [...weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_FULL[d] ?? String(d)).join(", ");
}

/** שורת השוואה אחת לתצוגת "מה משתנה" */
export type CalendarFieldDiff = { field: string; before: string; after: string };

/**
 * משווה שני payloads ומחזיר רק את השדות שהשתנו, בתיאור קריא.
 * משמש גם את מסך האישור וגם את יומן השינויים (לשחזור).
 */
export function diffCalendarPayloads(
    before: CalendarEntryPayload,
    after: CalendarEntryPayload
): CalendarFieldDiff[] {
    const rows: CalendarFieldDiff[] = [];
    const beforeLabel = before.label?.trim() || "";
    const afterLabel = after.label?.trim() || "";
    if (beforeLabel !== afterLabel) {
        rows.push({ field: "שם לתצוגה", before: beforeLabel || "(ריק)", after: afterLabel || "(ריק)" });
    }
    for (const flag of CALENDAR_FLAGS) {
        const b = before[flag.key] ?? null;
        const a = after[flag.key] ?? null;
        if (b !== a) {
            rows.push({
                field: flag.name,
                before: describeFlagValue(flag.key, b),
                after: describeFlagValue(flag.key, a),
            });
        }
    }
    for (const list of DATE_LIST_FIELDS) {
        const b = describeDateList(before[list.key]);
        const a = describeDateList(after[list.key]);
        if (b !== a) rows.push({ field: list.name, before: b, after: a });
    }
    const bw = describeWeekdays(before.weekdays);
    const aw = describeWeekdays(after.weekdays);
    if (bw !== aw) rows.push({ field: "ימי שבוע", before: bw, after: aw });
    return rows;
}

/**
 * חודשים שבהם יש לפעמים 29 ולפעמים 30 יום: חשוון, כסלו, ו-12 (אדר א' בשנה
 * מעוברת = 30, אדר בשנה רגילה = 29).
 */
const VARIABLE_LENGTH_MONTHS = new Set([8, 9, 12]);
/** חודשים שתמיד 29 יום: אייר, תמוז, אלול, טבת, אדר ב' */
const ALWAYS_29_MONTHS = new Set([2, 4, 6, 10, 13]);

/**
 * בדיקות לפני שמירת סט קיים.
 * errors – חוסמים שמירה (נתון שהאפליקציה לא תבין, או סט שהפך ל"תמיד").
 * warnings – לא חוסמים, אבל המשתמש חייב לראות אותם לפני האישור.
 *
 * יום בודד בל' של חודש משתנה (ראש חודש) תקין: בשנה שאין בה ל' הוא פשוט לא חל.
 * הבעיה היא *טווח* של כמה ימים שמתחיל/נגמר בל' כזה – האפליקציה מדלגת על כל
 * הטווח באותה שנה (dateSet.ts → isDateInRanges).
 */
export function validateCalendarPayload(payload: CalendarEntryPayload): {
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const list of DATE_LIST_FIELDS) {
        for (const range of payload[list.key] ?? []) {
            const label = formatDateRangeLabel(range);
            const points: Array<[number, number]> = [
                [range.startDate, range.startMonth],
                [range.endDate, range.endMonth],
            ];
            const invalid = points.some(
                ([day, month]) =>
                    !Number.isInteger(day) || day < 1 || day > 30 ||
                    !Number.isInteger(month) || month < 1 || month > 13
            );
            if (invalid) {
                errors.push(`${list.name}: טווח לא תקין (${JSON.stringify(range)})`);
                continue;
            }
            const single = isSingleDayRange(range);
            for (const [day, month] of points) {
                if (day !== 30) continue;
                if (ALWAYS_29_MONTHS.has(month)) {
                    warnings.push(`${list.name}: ל' ${getHebrewMonthName(month)} לא קיים אף פעם – "${label}" לא יחול לעולם`);
                } else if (VARIABLE_LENGTH_MONTHS.has(month) && !single) {
                    warnings.push(
                        `${list.name}: ל' ${getHebrewMonthName(month)} לא קיים בכל שנה. בשנה שאין בה ל' ${getHebrewMonthName(month)} האפליקציה מדלגת על כל הטווח "${label}"`
                    );
                }
            }
        }
    }

    for (const d of payload.weekdays ?? []) {
        if (!Number.isInteger(d) || d < 1 || d > 7) errors.push(`ימי שבוע: ערך לא תקין (${d})`);
    }

    const hasFlag = CALENDAR_FLAGS.some((f) => payload[f.key] != null);
    const hasDates = DATE_LIST_FIELDS.some((l) => (payload[l.key]?.length ?? 0) > 0);
    const hasWeekdays = (payload.weekdays?.length ?? 0) > 0;
    if (!hasFlag && !hasDates && !hasWeekdays) {
        errors.push("לסט לא נשאר אף תנאי – כך הוא יוצג תמיד. לשם כך משתמשים ב-ID 100 (תמיד), לא בעדכון הסט");
    }

    return { errors: Array.from(new Set(errors)), warnings: Array.from(new Set(warnings)) };
}

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

    for (const flag of CALENDAR_FLAGS) {
        const value = payload[flag.key];
        if (value === true) parts.push(flag.yes);
        else if (value === false) parts.push(flag.no);
    }

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

/**
 * רשומת לוח מסומנת `deleted: true` – האפליקציה לא מציגה אף פריט או מקטע
 * שמפנה אליה (תנאי מחוק = לעולם לא מתקיים). כך הוסתרה ההושענא של ט"ז תשרי
 * ביום א' (651) בסוכות תשפ"ז, בלי שום סימן ב-CMS.
 */
export function isCalendarEntryDeleted(values: Record<string, any> | null | undefined): boolean {
    return values?.deleted === true;
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

function toTriState(value: unknown): TriStateFlag {
    return typeof value === "boolean" ? value : null;
}

/** המרת ערכי רשומת לוח (מ-Firestore) לערכי טופס – להצגה/עריכה במודל. */
export function entityValuesToFormValues(values: Record<string, any>): DateSetIdFormValues {
    return {
        label: typeof values.label === "string" ? values.label : "",
        simha: toTriState(values.simha),
        beitEvel: toTriState(values.beitEvel),
        abroad: toTriState(values.abroad),
        yad: toTriState(values.yad),
        tv: toTriState(values.tv),
        dates_when_we_say_prayer: ensureDateRangeList(values.dates_when_we_say_prayer),
        dates_when_we_say_prayer_abroad: ensureDateRangeList(values.dates_when_we_say_prayer_abroad),
        dates_when_we_dont_say_prayer: ensureDateRangeList(values.dates_when_we_dont_say_prayer),
        dates_when_we_dont_say_prayer_abroad: ensureDateRangeList(values.dates_when_we_dont_say_prayer_abroad),
        weekdays: Array.isArray(values.weekdays) ? values.weekdays.join(",") : "",
    };
}
