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
import { chunkArray, mitIdBetween } from "../utils/itemUtils";

/** ממשק מינימלי ל-DataSource (fetchCollection, saveEntity, deleteEntity) – מאפשר טסטים עם mock */
type DataSource = {
    fetchCollection: (opts: any) => Promise<Entity<any>[]>;
    saveEntity: (opts: any) => Promise<any>;
    deleteEntity: (opts: any) => Promise<void>;
};

/** פרמטרים לטעינת מקטע: מזהה תרגום, תפילה, מקטע, ורשימת תרגומים (לשליפת enhancements) */
export type FetchPartParams = {
    translationId: string;
    selectedPrayerId: string;
    partId: string;
    translations: any[];
    currentTranslationId: string;
};

/** תוצאה: פריטים ממוינים, מפת enhancements לפי translationId, ערכי התחלה, ופריטי בסיס (כשעורכים תרגום – לחישוב mit_id) */
export type FetchPartResult = {
    sorted: Entity<any>[];
    enhancementsMap: Record<string, Entity<any>[]>;
    initialValues: Record<string, any>;
    /** פריטי הבסיס (0-*) של אותו מקטע – רק כשעורכים תרגום לא-בסיס */
    baseItems?: Entity<any>[];
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
    const sourceEntities = (await dataSource.fetchCollection({
        path: itemsPath,
        collection: itemsCollection,
        filter: { partId: ["==", partId] },
    })).filter((e) => e.values?.deleted !== true);

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
            const related = (await dataSource.fetchCollection({
                path: tPath,
                collection: itemsCollection,
                filter: { linkedItem: ["array-contains-any", chunk] },
            })).filter((e) => e.values?.deleted !== true);
            allRelated = [...allRelated, ...related];
        }
        enhancementsMap[trans.translationId] = allRelated;
    });

    await Promise.all(enhancementPromises);

    const initialValues: Record<string, any> = {};
    sorted.forEach((item) => (initialValues[item.id] = { ...item.values }));

    // כשעורכים תרגום (לא בסיס) – טוענים גם פריטי הבסיס של אותו מקטע
    let baseItems: Entity<any>[] | undefined;
    const isCurrentBase = String(currentTranslationId ?? "").startsWith("0-");
    if (!isCurrentBase) {
        const baseEntry = translations.find((t: any) => String(t?.translationId ?? "").startsWith("0-"));
        const baseTranslationId = baseEntry?.translationId;
        if (baseTranslationId) {
            const basePath = `translations/${baseTranslationId}/prayers/${selectedPrayerId}/items`;
            const baseEntities = (await dataSource.fetchCollection({
                path: basePath,
                collection: itemsCollection,
                filter: { partId: ["==", partId] },
            })).filter((e) => e.values?.deleted !== true);
            baseItems = [...baseEntities].sort(
                (a: any, b: any) =>
                    (a.values?.mit_id || "").localeCompare(
                        b.values?.mit_id || "",
                        undefined,
                        { numeric: true }
                    )
            );
        }
    }

    return { sorted, enhancementsMap, initialValues, baseItems };
}

/** path ל-items (translations/.../prayers/.../items), רשימת IDs ששונו, וערכים מקומיים */
export type SavePartParams = {
    path: string;
    changedIds: string[];
    localValues: Record<string, any>;
};

/** גודל מנה לשמירה – מונע מאות כתיבות סימולטניות ל-Firestore (rate limits / timeouts) */
const SAVE_CHUNK_SIZE = 50;

/**
 * שומר כל פריט ב-changedIds: ID שמתחיל ב-new_ נשמר כ-entity חדש, אחרת עדכון.
 * שמירה במנות (chunks) כדי לעמוד בעשרות/מאות תיקונים בלי להעמיס על Firestore.
 */
export async function savePartItems(
    dataSource: DataSource,
    params: SavePartParams
): Promise<void> {
    const { path, changedIds, localValues } = params;
    const now = Date.now();

    const chunks = chunkArray(changedIds, SAVE_CHUNK_SIZE);
    for (const chunkIds of chunks) {
        const savePromises = chunkIds.map((id) => {
            const isNew = id.startsWith("new_");
            const values = localValues[id];
            // לפריט חדש: document ID = itemId (כמו createTranslationItem) כדי שהמסמך יישמר בשם הנכון.
            // אם itemId חסר מסיבה כלשהי – Firestore מפיק ID אוטומטי.
            const entityId = isNew ? (values?.itemId || undefined) : id;
            return dataSource.saveEntity({
                path,
                entityId,
                values: { ...values, timestamp: now },
                status: isNew ? "new" : "existing",
                collection: itemsCollection,
            });
        });
        await Promise.all(savePromises);
    }
}

/**
 * מסמן פריט מקטע כמחוק (deleted: true) בתרגום הנוכחי ובכל התרגומים המקושרים אליו (linkedItem).
 * לא מוחק את הדוקומנט — מאפשר לאנדרואיד לזהות את המחיקה בסנכרון מבוסס-timestamp.
 */
export type DeletePartItemParams = {
    itemEntity: Entity<any>;
    itemId: string;
    currentTranslationId: string;
    selectedPrayerId: string;
    translations: any[];
};

async function softDeleteEntity(dataSource: DataSource, entity: Entity<any>): Promise<void> {
    await dataSource.saveEntity({
        path: entity.path,
        entityId: entity.id,
        values: { ...entity.values, deleted: true, timestamp: Date.now() },
        status: "existing",
    });
}

export async function deletePartItemAndRelatedTranslations(
    dataSource: DataSource,
    params: DeletePartItemParams
): Promise<void> {
    const {
        itemEntity,
        itemId,
        currentTranslationId,
        selectedPrayerId,
        translations,
    } = params;

    await softDeleteEntity(dataSource, itemEntity);

    for (const trans of translations) {
        const tid = trans?.translationId;
        if (!tid || tid === currentTranslationId) continue;
        const itemsPath = `translations/${tid}/prayers/${selectedPrayerId}/items`;
        const related = await dataSource.fetchCollection({
            path: itemsPath,
            collection: itemsCollection,
            filter: { linkedItem: ["array-contains", itemId] },
        });
        for (const entity of related) {
            await softDeleteEntity(dataSource, entity);
        }
    }
}

/**
 * טוען פריטי מקטע של תרגום אחד (לפי partId), ממוינים לפי mit_id.
 */
export async function fetchPartItems(
    dataSource: DataSource,
    translationId: string,
    selectedPrayerId: string,
    partId: string
): Promise<Entity<any>[]> {
    const path = `translations/${translationId}/prayers/${selectedPrayerId}/items`;
    const entities = (await dataSource.fetchCollection({
        path,
        collection: itemsCollection,
        filter: { partId: ["==", partId] },
    })).filter((e) => e.values?.deleted !== true);
    return [...entities].sort(
        (a: any, b: any) =>
            (a.values?.mit_id || "").localeCompare(
                b.values?.mit_id || "",
                undefined,
                { numeric: true }
            )
    );
}

/** פרמטרים ליצירת פריט תרגום חדש (מקושר לפריט בסיס) */
export type CreateTranslationItemParams = {
    targetTranslationId: string;
    selectedPrayerId: string;
    partId: string;
    baseItemId: string;
    afterItemId: string | null;
    content: string;
    type?: string;
    titleType?: string;
    title?: string;
    fontTanach?: boolean;
    noSpace?: boolean;
    block?: boolean;
    firstInPage?: boolean;
    specialDate?: boolean;
    cohanim?: boolean;
    hazan?: boolean;
    minyan?: boolean;
    role?: string;
    reference?: string;
    specialSign?: string;
    dateSetId?: string;
};

/**
 * יוצר פריט תרגום חדש בתרגום היעד, מקושר לפריט הבסיס (linkedItem).
 */
export async function createTranslationItem(
    dataSource: DataSource,
    params: CreateTranslationItemParams
): Promise<void> {
    const {
        targetTranslationId,
        selectedPrayerId,
        partId,
        baseItemId,
        afterItemId,
        content,
        type = "body",
        titleType,
        title,
        fontTanach,
        noSpace,
        block,
        firstInPage,
        specialDate,
        cohanim,
        hazan,
        minyan,
        role,
        reference,
        specialSign,
        dateSetId,
    } = params;

    const path = `translations/${targetTranslationId}/prayers/${selectedPrayerId}/items`;
    const allItems = await fetchPartItems(
        dataSource,
        targetTranslationId,
        selectedPrayerId,
        partId
    );
    const linkedToBase = allItems.filter((e: any) => {
        const link = e.values?.linkedItem;
        return Array.isArray(link) ? link.includes(baseItemId) : link === baseItemId;
    });

    let idBefore: string | null = null;
    let idAfter: string | null = null;
    let itemIdBefore: string | null = null;
    let itemIdAfter: string | null = null;

    if (afterItemId == null || afterItemId === "") {
        if (linkedToBase.length > 0) {
            itemIdAfter = linkedToBase[0].values?.itemId ?? null;
            idAfter = linkedToBase[0].values?.mit_id ?? null;
        } else if (allItems.length > 0) {
            itemIdAfter = allItems[0].values?.itemId ?? null;
            idAfter = allItems[0].values?.mit_id ?? null;
        }
    } else {
        const inAll = allItems.findIndex((e: any) => e.values?.itemId === afterItemId);
        if (inAll >= 0) {
            const afterItem = allItems[inAll];
            itemIdBefore = afterItem.values?.itemId ?? null;
            idBefore = afterItem.values?.mit_id ?? null;
            if (inAll + 1 < allItems.length) {
                idAfter = allItems[inAll + 1].values?.mit_id ?? null;
                itemIdAfter = allItems[inAll + 1].values?.itemId ?? null;
            }
        }
    }

    const newMitId = mitIdBetween(idBefore ?? undefined, idAfter ?? undefined);
    const existingIds = new Set(allItems.map((e: any) => e.values?.itemId).filter(Boolean));
    let newItemId = mitIdBetween(itemIdBefore ?? undefined, itemIdAfter ?? undefined);
    while (existingIds.has(newItemId)) {
        newItemId = String((Number(newItemId) || 0) + 1);
    }

    const values: Record<string, any> = {
        content: content ?? "",
        type,
        partId,
        itemId: newItemId,
        mit_id: newMitId,
        linkedItem: [baseItemId],
        timestamp: Date.now(),
    };
    if (titleType !== undefined) values.titleType = titleType;
    if (title !== undefined) values.title = title;
    if (fontTanach !== undefined) values.fontTanach = fontTanach;
    if (noSpace !== undefined) values.noSpace = noSpace;
    if (block !== undefined) values.block = block;
    if (firstInPage !== undefined) values.firstInPage = firstInPage;
    if (specialDate !== undefined) values.specialDate = specialDate;
    if (cohanim !== undefined) values.cohanim = cohanim;
    if (hazan !== undefined) values.hazan = hazan;
    if (minyan !== undefined) values.minyan = minyan;
    if (role !== undefined) values.role = role;
    if (reference !== undefined) values.reference = reference;
    if (specialSign !== undefined) values.specialSign = specialSign;
    if (dateSetId !== undefined) values.dateSetId = dateSetId;

    await dataSource.saveEntity({
        path,
        entityId: newItemId,
        values,
        status: "new",
        collection: itemsCollection,
    });
}
export async function publishToBagel(
    dataSource: DataSource,
    selectedTocId: string
): Promise<void> {
    const newTimestamp = Date.now();

    // שלב א': עדכון Firestore (עובד תקין)
    await dataSource.saveEntity({
        path: "db-update-time",
        entityId: selectedTocId,
        values: { maxTimestamp: newTimestamp },
        status: "existing",
        collection: dbUpdateTimeCollection,
    });

    const BAGEL_TOKEN = (import.meta as any).env.VITE_BAGEL_TOKEN;
    if (!BAGEL_TOKEN?.trim()) {
        throw new Error("חסר טוקן Bagel (VITE_BAGEL_TOKEN) – בדוק את קובץ .env");
    }

    let response: Response;
    try {
        // שינוי הכתובת ל-api.bageldb.com במקום bagelstudio.co
        const url = `https://api.bageldb.com/api/public/collection/updateTime/items/${selectedTocId}`;
        
        response = await fetch(url, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${BAGEL_TOKEN}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json" // הוספת Accept לעיתים עוזרת לשרת להבין מה להחזיר
                },
                body: JSON.stringify({ timestamp: newTimestamp }),
            }
        );
    } catch (networkErr: any) {
        const msg =
            networkErr?.message?.includes("fetch") || networkErr?.name === "TypeError"
                ? "לא ניתן להתחבר ל-Bagel (בעיית רשת או שרת לא זמין). בדוק חיבור אינטרנט וכתובת API."
                : `שגיאת רשת: ${networkErr?.message ?? String(networkErr)}`;
        throw new Error(msg);
    }

    if (!response.ok) {
        const status = response.status;
        let body = "";
        try { body = await response.text(); } catch { /* ignore */ }
        
        let userMsg: string;
        if (status === 401) userMsg = `טוקן Bagel לא תקין (401).`;
        else if (status === 403) userMsg = `אין הרשאת כתיבה ל-Bagel (403).`;
        else if (status === 404) userMsg = `הפריט '${selectedTocId}' לא נמצא בקולקציה ב-Bagel.`;
        else if (status >= 500) userMsg = `שרת Bagel חווה תקלה (503/500). ודא שהכתובת api.bageldb.com תקינה.`;
        else userMsg = `שגיאה ב-Bagel (${status}): ${body}`;
        
        throw new Error(userMsg);
    }
}