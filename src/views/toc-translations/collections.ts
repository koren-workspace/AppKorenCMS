/**
 * collections – הגדרות ה-collections של Firecms למסך תרגומי TOC
 *
 * - itemsCollection: פריטי תוכן (תרגום) – content, type, partId, itemId, linkedItem וכו'
 * - dbUpdateTimeCollection: זמן עדכון מקסימלי לפי TOC – מפעיל סנכרון
 * - baseColl: collection בסיסי לטעינת רשימת הנוסחים (toc)
 */

import { buildCollection } from "@firecms/cloud";

/** פריטים תחת translations/{translationId}/prayers/{prayerId}/items */
export const itemsCollection = buildCollection({
    id: "items",
    path: "items",
    name: "Items",
    properties: {
        content: { dataType: "string", name: "תוכן" },
        type: { dataType: "string", name: "סוג" },
        titleType: { dataType: "string", name: "סוג כותרת" },
        title: { dataType: "string", name: "כותרת" },
        fontTanach: { dataType: "boolean", name: "גופן תנך" },
        noSpace: { dataType: "boolean", name: "ללא רווח" },
        block: { dataType: "boolean", name: "בלוק" },
        role: { dataType: "string", name: "תפקיד" },
        reference: { dataType: "string", name: "Reference" },
        specialSign: { dataType: "string", name: "סימן מיוחד" },
        specialDate: { dataType: "boolean", name: "תאריך מיוחד" },
        firstInPage: { dataType: "boolean", name: "ראשון בעמוד" },
        cohanim: { dataType: "boolean", name: "כהנים" },
        hazan: { dataType: "boolean", name: "חזן" },
        minyan: { dataType: "boolean", name: "מניין" },
        partId: { dataType: "string", name: "מזהה חלק" },
        partName: { dataType: "string", name: "שם חלק" },
        partIdAndName: { dataType: "string", name: "מזהה ושם" },
        itemId: { dataType: "string", name: "מזהה פריט" },
        mit_id: { dataType: "string", name: "MIT ID" },
        dateSetId: { dataType: "string", name: "Date Set ID" },
        timestamp: { dataType: "number", name: "זמן עדכון" },
        linkedItem: { dataType: "array", name: "פריטים מקושרים", of: { dataType: "string" } }
    }
});

/** זמן עדכון ל-TOC – עדכון מפעיל את סנכרון האפליקציה (Bagel) */
export const dbUpdateTimeCollection = buildCollection({
    id: "db-update-time",
    path: "db-update-time",
    name: "DB Update Time",
    properties: {
        maxTimestamp: { dataType: "number", name: "זמן עדכון מקסימלי" }
    }
});

/** Collection לטעינת רשימת הנוסחים (path: "toc") – ללא שדות, רק מסמכים */
export const baseColl = buildCollection({ id: "base", path: "base", name: "base", properties: {} });

/** לוח שנה – מסמכים עם dateSetId כ־document id, תואם ל־CalendarItem ב־Android (calendar.json / Firestore calendar) */
export const calendarCollection = buildCollection({
    id: "calendar",
    path: "calendar",
    name: "Calendar",
    properties: {
        dateSetId: { dataType: "string", name: "Date Set ID" },
        simha: { dataType: "boolean", name: "שמחה" },
        beitEvel: { dataType: "boolean", name: "בית אבל" },
        abroad: { dataType: "boolean", name: "חו\"ל" },
        yad: { dataType: "boolean", name: "יד" },
        tv: { dataType: "boolean", name: "ט\"ו" },
        dates_when_we_say_prayer: { dataType: "array", name: "תאריכים שאומרים", of: { dataType: "map" } },
        dates_when_we_say_prayer_abroad: { dataType: "array", name: "תאריכים שאומרים חו\"ל", of: { dataType: "map" } },
        dates_when_we_dont_say_prayer: { dataType: "array", name: "תאריכים שלא אומרים", of: { dataType: "map" } },
        dates_when_we_dont_say_prayer_abroad: { dataType: "array", name: "תאריכים שלא אומרים חו\"ל", of: { dataType: "map" } },
        weekdays: { dataType: "array", name: "ימי השבוע", of: { dataType: "number" } },
        timestamp: { dataType: "number", name: "זמן עדכון" },
    }
});
