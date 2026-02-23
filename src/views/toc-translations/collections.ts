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
        fontTanach: { dataType: "boolean", name: "גופן תנך" },
        noSpace: { dataType: "boolean", name: "ללא רווח" },
        role: { dataType: "string", name: "תפקיד" },
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
