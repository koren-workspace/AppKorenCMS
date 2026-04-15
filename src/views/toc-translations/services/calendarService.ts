/**
 * calendarService – טעינה, חיפוש ויצירה של רשומות לוח שנה (dateSetId).
 * תואם ל־calendar.json / Firestore collection "calendar".
 * משמש "מצוא או צור": אם קיימת רשומה עם אותם מאפיינים – מחזיר את ה־dateSetId שלה; אחרת יוצר רשומה חדשה עם ID הבא.
 */

import { Entity } from "@firecms/core";
import { calendarCollection } from "../collections";
import {
    type CalendarEntryPayload,
    type DateRange,
    calendarPayloadsEqual,
    entityValuesToPayload,
    formValuesToPayload,
    type DateSetIdFormValues,
} from "../constants/calendarTypes";

type DataSource = {
    fetchCollection: (opts: any) => Promise<Entity<any>[]>;
    saveEntity: (opts: any) => Promise<any>;
};

const CALENDAR_PATH = "calendar";

/**
 * טוען את כל רשומות הלוח (מסמכי Firestore ב־calendar).
 * מחזיר רשימת entities – id = dateSetId, values = שאר השדות.
 */
export async function fetchAllCalendar(dataSource: DataSource): Promise<Entity<any>[]> {
    const entities = await dataSource.fetchCollection({
        path: CALENDAR_PATH,
        collection: calendarCollection,
    });
    return entities ?? [];
}

/**
 * מחזיר רשומת לוח לפי dateSetId (או null אם לא נמצא).
 */
export async function fetchCalendarEntryById(
    dataSource: DataSource,
    dateSetId: string
): Promise<Entity<any> | null> {
    if (!dateSetId) return null;
    const all = await fetchAllCalendar(dataSource);
    return all.find((e) => e.id === dateSetId) ?? null;
}

/**
 * מחפש רשומה קיימת עם payload זהה (כל המאפיינים מלבד dateSetId).
 * מחזיר את ה־dateSetId אם נמצא, אחרת null.
 */
export function findMatchingDateSetId(
    calendarEntities: Entity<any>[],
    payload: CalendarEntryPayload
): string | null {
    for (const e of calendarEntities) {
        const existingPayload = entityValuesToPayload(e.values || {});
        if (calendarPayloadsEqual(payload, existingPayload)) {
            return e.id;
        }
    }
    return null;
}

/**
 * מחזיר ה־ID המספרי הבא שלא בשימוש.
 * מניח ש־dateSetId הם מספרים או מחרוזות מספריות.
 */
export function getNextDateSetId(calendarEntities: Entity<any>[]): string {
    const ids = calendarEntities.map((e) => e.id).filter(Boolean);
    let max = 0;
    for (const id of ids) {
        const n = parseInt(String(id), 10);
        if (!Number.isNaN(n) && n > max) max = n;
    }
    return String(max + 1);
}

/**
 * שומר רשומת לוח חדשה ב-Firestore.
 * path = "calendar", entityId = dateSetId, values = השדות (בלי deleted).
 */
export async function saveCalendarEntry(
    dataSource: DataSource,
    dateSetId: string,
    payload: CalendarEntryPayload
): Promise<void> {
    const values: Record<string, any> = {
        dateSetId,
        timestamp: Date.now(),
    };
    if (payload.simha !== undefined && payload.simha !== null) values.simha = payload.simha;
    if (payload.beitEvel !== undefined && payload.beitEvel !== null) values.beitEvel = payload.beitEvel;
    if (payload.abroad !== undefined && payload.abroad !== null) values.abroad = payload.abroad;
    if (payload.yad !== undefined && payload.yad !== null) values.yad = payload.yad;
    if (payload.tv !== undefined && payload.tv !== null) values.tv = payload.tv;
    if (payload.dates_when_we_say_prayer?.length)
        values.dates_when_we_say_prayer = payload.dates_when_we_say_prayer;
    if (payload.dates_when_we_say_prayer_abroad?.length)
        values.dates_when_we_say_prayer_abroad = payload.dates_when_we_say_prayer_abroad;
    if (payload.dates_when_we_dont_say_prayer?.length)
        values.dates_when_we_dont_say_prayer = payload.dates_when_we_dont_say_prayer;
    if (payload.dates_when_we_dont_say_prayer_abroad?.length)
        values.dates_when_we_dont_say_prayer_abroad = payload.dates_when_we_dont_say_prayer_abroad;
    if (payload.weekdays?.length) values.weekdays = payload.weekdays;

    await dataSource.saveEntity({
        path: CALENDAR_PATH,
        entityId: dateSetId,
        values,
        status: "new",
        collection: calendarCollection,
    });
}

/**
 * מחזיר dateSetId מוכן לשימוש: או קיים תואם, או יוצר רשומה חדשה עם ID הבא.
 */
export async function resolveDateSetId(
    dataSource: DataSource,
    form: DateSetIdFormValues
): Promise<{ dateSetId: string; created: boolean }> {
    const payload = formValuesToPayload(form);
    const all = await fetchAllCalendar(dataSource);
    const existing = findMatchingDateSetId(all, payload);
    if (existing) return { dateSetId: existing, created: false };
    const nextId = getNextDateSetId(all);
    await saveCalendarEntry(dataSource, nextId, payload);
    return { dateSetId: nextId, created: true };
}
