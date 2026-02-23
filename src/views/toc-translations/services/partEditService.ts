/**
 * partEditService – לוגיקת טעינה, שמירה ופרסום של מקטע
 *
 * פונקציות "טהורות": מקבלות dataSource (ו-params) ומבצעות קריאות ל-Firestore/API.
 * אין כאן state או UI – רק פעולות. ה-hook usePartEdit קורא לפונקציות ומעדכן state + snackbar.
 *
 * - fetchPartWithEnhancements: טוען פריטי מקטע, ממיין לפי mit_id, טוען תרגומים מקושרים במנות
 * - savePartItems: שומר רשימת פריטים (חדשים + קיימים) לפי path
 * - publishToBagel: מעדכן db-update-time + קריאה ל-API של Bagel
 */

import { Entity } from "@firecms/cloud";
import { itemsCollection, dbUpdateTimeCollection } from "../collections";
import { chunkArray } from "../utils/itemUtils";

/** ממשק מינימלי ל-DataSource (fetchCollection, saveEntity) – מאפשר טסטים עם mock */
type DataSource = {
    fetchCollection: (opts: any) => Promise<Entity<any>[]>;
    saveEntity: (opts: any) => Promise<any>;
};

/** פרמטרים לטעינת מקטע: מזהה תרגום, תפילה, מקטע, ורשימת תרגומים (לשליפת enhancements) */
export type FetchPartParams = {
    translationId: string;
    selectedPrayerId: string;
    partId: string;
    translations: any[];
    currentTranslationId: string;
};

/** תוצאה: פריטים ממוינים, מפת enhancements לפי translationId, וערכי התחלה לעריכה */
export type FetchPartResult = {
    sorted: Entity<any>[];
    enhancementsMap: Record<string, Entity<any>[]>;
    initialValues: Record<string, any>;
};

/**
 * טוען פריטי מקטע (filter partId), ממיין לפי mit_id.
 * לכל תרגום אחר טוען פריטים עם linkedItem שמכיל את ה-itemIds (במנות של 30 בגלל מגבלת Firestore).
 */
export async function fetchPartWithEnhancements(
    dataSource: DataSource,
    params: FetchPartParams
): Promise<FetchPartResult> {
    const {
        translationId,
        selectedPrayerId,
        partId,
        translations,
        currentTranslationId,
    } = params;

    const itemsPath = `translations/${translationId}/prayers/${selectedPrayerId}/items`;
    const sourceEntities = await dataSource.fetchCollection({
        path: itemsPath,
        collection: itemsCollection,
        filter: { partId: ["==", partId] },
    });

    const sorted = [...sourceEntities].sort(
        (a: any, b: any) =>
            (a.values?.mit_id || "").localeCompare(
                b.values?.mit_id || "",
                undefined,
                { numeric: true }
            )
    );

    const sourceItemIds = sorted
        .map((i) => i.values.itemId)
        .filter((id: string) => id);
    const idChunks = chunkArray(sourceItemIds, 30);
    const enhancementsMap: Record<string, Entity<any>[]> = {};

    // טוען מכל תרגום (חוץ מהנוכחי) פריטים שמקושרים ל-itemIds של המקטע
    const enhancementPromises = translations.map(async (trans: any) => {
        if (trans.translationId === currentTranslationId) return;
        const tPath = `translations/${trans.translationId}/prayers/${selectedPrayerId}/items`;
        let allRelated: Entity<any>[] = [];
        for (const chunk of idChunks) {
            const related = await dataSource.fetchCollection({
                path: tPath,
                collection: itemsCollection,
                filter: { linkedItem: ["array-contains-any", chunk] },
            });
            allRelated = [...allRelated, ...related];
        }
        enhancementsMap[trans.translationId] = allRelated;
    });

    await Promise.all(enhancementPromises);

    const initialValues: Record<string, any> = {};
    sorted.forEach((item) => (initialValues[item.id] = { ...item.values }));

    return { sorted, enhancementsMap, initialValues };
}

/** path ל-items (translations/.../prayers/.../items), רשימת IDs ששונו, וערכים מקומיים */
export type SavePartParams = {
    path: string;
    changedIds: string[];
    localValues: Record<string, any>;
};

/**
 * שומר כל פריט ב-changedIds: ID שמתחיל ב-new_ נשמר כ-entity חדש, אחרת עדכון.
 */
export async function savePartItems(
    dataSource: DataSource,
    params: SavePartParams
): Promise<void> {
    const { path, changedIds, localValues } = params;
    const now = Date.now();

    const savePromises = changedIds.map((id) => {
        const isNew = id.startsWith("new_");
        return dataSource.saveEntity({
            path,
            entityId: isNew ? undefined : id,
            values: { ...localValues[id], timestamp: now },
            status: isNew ? "new" : "existing",
            collection: itemsCollection,
        });
    });
    await Promise.all(savePromises);
}

/**
 * מעדכן מסמך db-update-time עם maxTimestamp (לפי selectedTocId).
 * קורא ל-API של Bagel עם VITE_BAGEL_TOKEN – האפליקציה מסתנכרנת לפי timestamp.
 */
export async function publishToBagel(
    dataSource: DataSource,
    selectedTocId: string
): Promise<void> {
    const newTimestamp = Date.now();

    await dataSource.saveEntity({
        path: "db-update-time",
        entityId: selectedTocId,
        values: { maxTimestamp: newTimestamp },
        status: "existing",
        collection: dbUpdateTimeCollection,
    });

    const BAGEL_TOKEN = (import.meta as any).env.VITE_BAGEL_TOKEN;
    await fetch(
        `https://api.bageldb.com/v1/collection/updateTime/items/${selectedTocId}`,
        {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${BAGEL_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ timestamp: newTimestamp }),
        }
    );
}
