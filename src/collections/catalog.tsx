/**
 * catalog – קטלוג התוספות (שערים לתפילה) של האפליקציה, קולקציית Firestore
 * `catalog/{storeId}`. עבר מ-BagelDB (`enhancments/items`) ב-2026-09; ראו
 * docs/catalog.md.
 *
 * מזהה המסמך = storeId (מזהה המוצר בחנויות). האפליקציה מזהה בעלות לפי
 * storeId, ולכן אין לשנות אותו במוצר קיים – יצירת מוצר חדש בלבד.
 *
 * הקולקציה מוצגת דרך Firecms הרגיל (בלי מסך מותאם): רשימת המסמכים, טופס
 * עריכה לכל שדה, ורצועות ההכנה כמערך מקונן.
 */

import { buildCollection, buildProperty } from "@firecms/core";

const KIND_LABELS: Record<string, string> = {
    translation: "תרגום",
    commentary: "פירוש",
    preparation: "הכנה לתפילה",
    improved: "תפילה מכוונת",
    narration: "הקראה",
};

/** How a bilingual text looks in the list: Hebrew on top, English below, no field labels. */
const LocalizedPreview = ({ value }: { value?: { default?: string; he?: string } }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, lineHeight: 1.3 }}>
        <span dir="rtl" style={{ fontWeight: 600 }}>{value?.he ?? ""}</span>
        <span dir="ltr" style={{ opacity: 0.7, fontSize: "0.9em" }}>{value?.default ?? ""}</span>
    </div>
);

/** A bilingual text `{ default: English, he: Hebrew }` – the app shows `he` in Hebrew UI, `default` otherwise. */
const localized = (name: string, required = false) =>
    buildProperty({
        dataType: "map",
        name,
        Preview: LocalizedPreview,
        properties: {
            he: { dataType: "string", name: "עברית" },
            default: { dataType: "string", name: "אנגלית", validation: { required } },
        },
    });

export const catalogCollection = buildCollection({
    id: "catalog",
    path: "catalog",
    name: "קטלוג תוספות",
    singularName: "תוספת",
    description: "התוספות הנמכרות באפליקציה (תרגום, פירוש, הכנה לתפילה, תפילה מכוונת). מזהה המסמך = storeId.",
    icon: "Storefront",
    group: "אפליקציה",
    customId: true,
    initialSort: ["order", "asc"],
    properties: {
        storeId: {
            dataType: "string",
            name: "storeId",
            description: "מזהה המוצר בחנויות ומפתח הבעלות באפליקציה. חייב להיות זהה למזהה המסמך. לא לשנות במוצר קיים.",
            validation: { required: true },
            readOnly: true,
            hideFromCollection: true,
        },
        kind: {
            dataType: "string",
            name: "סוג",
            validation: { required: true },
            enumValues: KIND_LABELS,
            // Plain text in the list instead of Firecms's colored chips.
            Preview: ({ value }: { value?: string }) => (
                <span>{value !== undefined ? KIND_LABELS[value] ?? value : ""}</span>
            ),
        },
        order: {
            dataType: "number",
            name: "סדר תצוגה",
            description: "0 ראשון. מסמך בלי ערך מוצג אחרון.",
            validation: { required: true, integer: true, min: 0 },
        },
        title: localized("כותרת", true),
        author: localized("מחבר / כותרת משנה"),
        description: localized("תיאור"),
        nusach: localized("תווית נוסח (תצוגה בלבד)"),
        nusachId: {
            dataType: "string",
            name: "נוסח",
            description: "ריק = לכל הנוסחים.",
            enumValues: { Ashkenaz: "אשכנז", Sefard: "ספרד" },
        },
        contentId: {
            dataType: "string",
            name: "contentId",
            description: "שורש התוכן ב-Firestore, למשל 1-sefard / 10-ashkenaz / 11-ashkenaz (תרגום ופירוש בלבד).",
        },
        backgroundColor: {
            dataType: "string",
            name: "צבע כרטיס",
            description: "hex, למשל #771144 (תרגום ופירוש).",
            propertyConfig: "color",
        },
        thumbnail: {
            dataType: "string",
            name: "תמונה (URL)",
            description: "כתובת ציבורית ב-Firebase Storage (mods/thumbnails).",
            url: true,
        },
        preparationContent: buildProperty({
            dataType: "array",
            name: "רצועות הכנה",
            description: "הכנה לתפילה בלבד. הסדר באפליקציה: לפי rank בסדר יורד.",
            of: {
                dataType: "map",
                properties: {
                    id: { dataType: "string", name: "מזהה", validation: { required: true } },
                    rank: { dataType: "string", name: "rank (מיון יורד)", validation: { required: true } },
                    title: localized("כותרת", true),
                    type: {
                        dataType: "string",
                        name: "סוג מדיה",
                        validation: { required: true },
                        enumValues: { audio: "אודיו", video: "וידאו" },
                    },
                    url: { dataType: "string", name: "URL", url: true, validation: { required: true } },
                    thumbnail: { dataType: "string", name: "תמונה (URL)", url: true },
                },
            },
        }),
        bagelId: { dataType: "string", name: "מזהה Bagel (היסטורי)", readOnly: true, hideFromCollection: true },
        migratedFromBagelAt: { dataType: "date", name: "הועבר מ-Bagel", readOnly: true, hideFromCollection: true },
    },
});
