/**
 * hebrewDateUtils – לוגיקת חישוב תאריך עברי וסינון dateSetIds לפי יום נבחר.
 *
 * פורט נאמן ל-Android `JewishDatesUtils.kt`:
 *   - בונה רשימת `relevantDateSetIds` שמתאימים לתאריך נתון
 *   - בודק כל רשומת CalendarItem מול: יום-בשבוע, טווחי-תאריך עבריים (חיובי/שלילי), דגלים בוליאניים
 *   - dateSetId "100" = "תמיד" – נכלל תמיד ברשימה
 *
 * הערות מספור:
 *   - HDate.getMonth(): 1=ניסן … 7=תשרי … 13=אדר ב' (תואם ל-HEBREW_MONTHS ב-calendarTypes.ts)
 *   - HDate.getDay(): 0=ראשון … 6=שבת (תקן JS)
 *   - weekdays ב-CalendarItem: 1=ראשון … 7=שבת (סגנון KosherJava)
 */

import { HDate } from "@hebcal/core";
import { Entity } from "@firecms/core";
import { DateRange, entityValuesToPayload, CalendarEntryPayload } from "../constants/calendarTypes";

const ALWAYS_DATE_SET_ID = "100";

export type HebrewDateInfo = {
    /** יום בחודש העברי (1-30) */
    day: number;
    /** חודש עברי (1=ניסן, 7=תשרי, 13=אדר ב') */
    month: number;
    /** שנה עברית */
    year: number;
    /** יום בשבוע בסגנון KosherJava: 1=ראשון … 7=שבת */
    dayOfWeek: number;
    /** ה-HDate המקורי – שימושי לעיצוב/הדפסה */
    hDate: HDate;
    /** תווית קריאה בעברית — לדוגמה "ו' ניסן תשפ"ד" */
    label: string;
};

export type CalendarFlags = {
    simha?: boolean;
    beitEvel?: boolean;
    abroad?: boolean;
    yad?: boolean;
    tv?: boolean;
};

const DEFAULT_FLAGS: Required<CalendarFlags> = {
    simha: false,
    beitEvel: false,
    abroad: false,
    yad: false,
    tv: false,
};

/**
 * ממיר תאריך גרגוריאני לתאריך עברי + מטא-דאטה לסינון.
 */
export function getHebrewDateInfo(date: Date): HebrewDateInfo {
    const hDate = new HDate(date);
    const day = hDate.getDate();
    const month = hDate.getMonth();
    const year = hDate.getFullYear();
    // HDate.getDay(): 0=ראשון … 6=שבת. ב-KosherJava: 1=ראשון … 7=שבת.
    const dayOfWeek = hDate.getDay() + 1;
    let label: string;
    try {
        label = hDate.renderGematriya();
    } catch {
        label = `${day}/${month}/${year}`;
    }
    return { day, month, year, dayOfWeek, hDate, label };
}

/**
 * מתאים מספר חודש מהקונבנציה של הנתונים (calendar.json / Firestore) לקונבנציה של hebcal.
 *
 * הקונבנציה בנתונים:
 *   - 1=ניסן ... 11=שבט, 12=אדר א' (רק בשנה מעוברת), 13=אדר רגיל / אדר ב'
 *   - כלומר אדר "רגיל" (בשנה לא מעוברת) מסומן כ-13 בנתונים.
 *
 * הקונבנציה של hebcal HDate:
 *   - בשנה רגילה: 1=ניסן ... 11=שבט, 12=אדר רגיל (אין 13)
 *   - בשנה מעוברת: 1=ניסן ... 11=שבט, 12=אדר א', 13=אדר ב'
 *
 * לכן בשנה לא מעוברת, month=13 בנתונים מתורגם ל-12 ב-hebcal.
 * זה תואם ל-`getDataMonth()` ב-Android JewishDatesUtils.kt.
 */
function normalizeDataMonthToHebcal(dataMonth: number, isLeapYear: boolean): number {
    if (!isLeapYear && dataMonth === 13) return 12;
    return dataMonth;
}

/**
 * בודק אם יום וחודש עברי (במספור hebcal) נמצאים בתוך טווח DateRange (במספור הנתונים).
 * `isLeapYear` הוא של השנה שאליה משייכים את התאריך הנבחר — נדרש להמרה מ-data_month ל-hebcal_month.
 * תומך גם בטווחים שעוברים בין שנים (כש-endMonth < startMonth).
 */
export function isHebrewDateInRange(
    day: number,
    month: number,
    range: DateRange,
    isLeapYear: boolean
): boolean {
    const rawStartM = Number(range.startMonth);
    const startD = Number(range.startDate);
    const rawEndM = Number(range.endMonth);
    const endD = Number(range.endDate);
    if (!rawStartM || !startD || !rawEndM || !endD) return false;

    const startM = normalizeDataMonthToHebcal(rawStartM, isLeapYear);
    const endM = normalizeDataMonthToHebcal(rawEndM, isLeapYear);

    const targetKey = month * 100 + day;
    const startKey = startM * 100 + startD;
    const endKey = endM * 100 + endD;

    if (startKey <= endKey) {
        return targetKey >= startKey && targetKey <= endKey;
    }
    // טווח שעובר את גבול השנה (לדוגמה אדר ב' → ניסן)
    return targetKey >= startKey || targetKey <= endKey;
}

/**
 * בוחר את רשימת הטווחים החיוביים המתאימה (ארץ/חו"ל).
 * תואם getDates ב-JewishDatesUtils.kt: בחו"ל משתמשים ב-_abroad אם קיים, אחרת ברשימה הרגילה.
 */
function getPositiveRanges(payload: CalendarEntryPayload, abroad: boolean): DateRange[] | null {
    if (abroad && payload.dates_when_we_say_prayer_abroad?.length) {
        return payload.dates_when_we_say_prayer_abroad;
    }
    return payload.dates_when_we_say_prayer ?? null;
}

/**
 * בוחר את רשימת הטווחים השליליים המתאימה (ארץ/חו"ל).
 * תואם getNegativeDates ב-JewishDatesUtils.kt.
 */
function getNegativeRanges(payload: CalendarEntryPayload, abroad: boolean): DateRange[] | null {
    if (abroad && payload.dates_when_we_dont_say_prayer_abroad?.length) {
        return payload.dates_when_we_dont_say_prayer_abroad;
    }
    return payload.dates_when_we_dont_say_prayer ?? null;
}

/** בודק תאימות יום-בשבוע: אם null/ריק — אין הגבלה. */
function passesWeekday(payload: CalendarEntryPayload, dayOfWeek: number): boolean {
    if (!payload.weekdays || payload.weekdays.length === 0) return true;
    return payload.weekdays.includes(dayOfWeek);
}

/** בודק תאימות תאריך עברי: גם פילטר חיובי וגם פילטר שלילי. */
function passesHebrewDate(
    payload: CalendarEntryPayload,
    info: HebrewDateInfo,
    flags: Required<CalendarFlags>
): boolean {
    const positive = getPositiveRanges(payload, flags.abroad);
    const negative = getNegativeRanges(payload, flags.abroad);
    const isLeap = HDate.isLeapYear(info.year);

    const passesPositive =
        !positive || positive.length === 0 ||
        positive.some((r) => isHebrewDateInRange(info.day, info.month, r, isLeap));

    const passesNegative =
        !negative || negative.length === 0 ||
        !negative.some((r) => isHebrewDateInRange(info.day, info.month, r, isLeap));

    return passesPositive && passesNegative;
}

/**
 * בודק תאימות דגלים בוליאניים: שדה null = אין הגבלה; אחרת חייב להתאים.
 *
 * חריג: `yad` ו-`tv` מייצגים מיקומים בלעדיים (פורים י"ד מול פורים ט"ו / שושן פורים).
 * ב-CMS אנחנו רוצים שעורך התוכן יראה את **כל** התפילות שעלולות להופיע באותו יום
 * בכל מיקום — ולכן הדגלים האלה מתעלמים לחלוטין מהסינון. כך תפילות פורים י"ד
 * ותפילות שושן פורים יופיעו שתיהן באותו יום, ללא הבחנה.
 */
function passesBooleanFlags(payload: CalendarEntryPayload, flags: Required<CalendarFlags>): boolean {
    if (payload.simha != null && payload.simha !== flags.simha) return false;
    if (payload.beitEvel != null && payload.beitEvel !== flags.beitEvel) return false;
    if (payload.abroad != null && payload.abroad !== flags.abroad) return false;
    // yad / tv: לא מסננים — מציגים איחוד של תפילות י"ד ו-ט"ו
    return true;
}

/**
 * מחשב את כל ה-dateSetIds שתואמים לתאריך הנבחר ולדגלים.
 * תמיד כולל את ALWAYS_DATE_SET_ID ("100" = "תמיד").
 */
export function getRelevantDateSetIds(
    calendarEntries: Entity<any>[],
    selectedDate: Date,
    flags?: CalendarFlags
): string[] {
    const info = getHebrewDateInfo(selectedDate);
    const fullFlags: Required<CalendarFlags> = { ...DEFAULT_FLAGS, ...(flags ?? {}) };

    const result = new Set<string>();
    result.add(ALWAYS_DATE_SET_ID);

    for (const entity of calendarEntries) {
        const id = entity.id;
        if (!id) continue;
        const payload = entityValuesToPayload(entity.values ?? {});
        if (!passesWeekday(payload, info.dayOfWeek)) continue;
        if (!passesHebrewDate(payload, info, fullFlags)) continue;
        if (!passesBooleanFlags(payload, fullFlags)) continue;
        result.add(id);
    }

    return Array.from(result);
}
