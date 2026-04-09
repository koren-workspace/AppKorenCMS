/**
 * partEditService – לוגיקת טעינה, שמירה ופרסום של מקטע
 *
 * פונקציות "טהורות": מקבלות dataSource (ו-params) ומבצעות קריאות ל-Firestore/API.
 * אין כאן state או UI – רק פעולות. ה-hook usePartEdit קורא לפונקציות ומעדכן state + snackbar.
 *
 * - fetchPartWithEnhancements: טוען פריטי מקטע, ממיין לפי itemId, טוען תרגומים מקושרים במנות
 * - savePartItems: שומר רשימת פריטים (חדשים + קיימים) לפי path
 * - updateFirestoreTimestamp: מעדכן db-update-time ב-Firestore (Bagel SDK ב-bagelUpdateTimeService)
 */

import { Entity } from "@firecms/core";
import { itemsCollection, dbUpdateTimeCollection } from "../collections";
import { chunkArray, computeItemIdForInsert, NO_SPACE_BETWEEN_ITEMS } from "../utils/itemUtils";
import { cmsDebugItemIdsEnabled } from "../utils/debugFlags";

export { NO_SPACE_BETWEEN_ITEMS };

function cmsIdDbg(...args: unknown[]) {
    if (cmsDebugItemIdsEnabled()) console.log(...args);
}

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
    /** מזההים של פריטים שמסומנים deleted: true – לא מוצגים אבל נספרים בחישוב itemId/mit_id לפריטים חדשים */
    deletedItemIds: string[];
    deletedMitIds: string[];
};

/**
 * טוען פריטי מקטע (filter partId), ממיין לפי itemId.
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
    const allSourceEntities = await dataSource.fetchCollection({
        path: itemsPath,
        collection: itemsCollection,
        filter: { partId: ["==", partId] },
    });
    const sourceEntities = allSourceEntities.filter((e) => e.values?.deleted !== true);
    const deletedEntities = allSourceEntities.filter((e) => e.values?.deleted === true);
    const deletedItemIds = deletedEntities.map((e) => e.values?.itemId).filter((id): id is string => !!id);
    const deletedMitIds = deletedEntities.map((e) => e.values?.mit_id).filter((id): id is string => !!id);

    const sorted = [...sourceEntities].sort(
        (a: any, b: any) =>
            (a.values?.itemId || "").localeCompare(
                b.values?.itemId || "",
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
                    (a.values?.itemId || "").localeCompare(
                        b.values?.itemId || "",
                        undefined,
                        { numeric: true }
                    )
            );
        }
    }

    return { sorted, enhancementsMap, initialValues, baseItems, deletedItemIds, deletedMitIds };
}

/** path ל-items (translations/.../prayers/.../items), רשימת IDs ששונו, וערכים מקומיים */
export type SavePartParams = {
    path: string;
    changedIds: string[];
    localValues: Record<string, any>;
};

/** גודל מנה לשמירה – מונע מאות כתיבות סימולטניות ל-Firestore (rate limits / timeouts) */
const SAVE_CHUNK_SIZE = 50;

/** שדות סינון שיש להסיר מהנתונים כש-null – כדי שלא יישמרו ב-Firestore ולא יפעילו סינון באפליקציה */
const NULLABLE_FILTER_FIELDS = ["cohanim", "hazan", "minyan"] as const;

/** מנקה שדות סינון שערכם null – מסיר את השדה כדי שלא יגיע ל-Firestore */
function stripNullFilterFields(values: Record<string, any>): Record<string, any> {
    const cleaned = { ...values };
    for (const field of NULLABLE_FILTER_FIELDS) {
        if (cleaned[field] === null || cleaned[field] === undefined) {
            delete cleaned[field];
        }
    }
    return cleaned;
}

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

    for (const id of changedIds) {
        if (!id.startsWith("new_")) continue;
        const values = localValues[id];
        const rawItemId = values?.itemId;
        const itemIdStr =
            rawItemId != null && String(rawItemId).trim() !== ""
                ? String(rawItemId).trim()
                : "";
        if (!itemIdStr) {
            throw new Error(
                `savePartItems: new item missing valid itemId (changedId=${id})`
            );
        }
    }

    const chunks = chunkArray(changedIds, SAVE_CHUNK_SIZE);
    for (const chunkIds of chunks) {
        const savePromises = chunkIds.map((id) => {
            const isNew = id.startsWith("new_");
            const values = localValues[id];
            const entityId = isNew ? (values?.itemId || undefined) : id;
            return dataSource.saveEntity({
                path,
                entityId,
                values: stripNullFilterFields({ ...values, timestamp: now }),
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

    const otherTranslations = translations.filter(
        (t) => t?.translationId && t.translationId !== currentTranslationId
    );

    const relatedLists = await Promise.all(
        otherTranslations.map((trans: any) => {
            const tid = trans.translationId as string;
            const itemsPath = `translations/${tid}/prayers/${selectedPrayerId}/items`;
            return dataSource.fetchCollection({
                path: itemsPath,
                collection: itemsCollection,
                filter: { linkedItem: ["array-contains", itemId] },
            });
        })
    );

    const relatedFlat = relatedLists.flat();
    const results = await Promise.allSettled(
        relatedFlat.map((entity) => softDeleteEntity(dataSource, entity))
    );

    const failures = results.flatMap((r, i) =>
        r.status === "rejected"
            ? [
                  {
                      entityId: relatedFlat[i]?.id,
                      reason: r.reason,
                  },
              ]
            : []
    );

    if (failures.length > 0) {
        const detail = failures
            .map((f) => `${f.entityId ?? "?"}: ${f.reason}`)
            .join("; ");
        throw new Error(
            `deletePartItemAndRelatedTranslations: ${failures.length} related soft-delete(s) failed (${detail})`
        );
    }
}

/**
 * טוען פריטי מקטע של תרגום אחד (לפי partId), ממוינים לפי itemId.
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
            (a.values?.itemId || "").localeCompare(
                b.values?.itemId || "",
                undefined,
                { numeric: true }
            )
    );
}

/** רשימת מקטעים לתפילה מתוך מבנה ה-TOC (כמו ב-usePartEdit.getPartsFromToc) */
export function getPartsForPrayerInTranslation(
    translations: any[],
    translationId: string,
    prayerId: string
): any[] {
    const trans = (translations ?? []).find((t: any) => t.translationId === translationId);
    if (!trans) return [];
    for (const cat of trans.categories ?? []) {
        const prayer = (cat.prayers ?? []).find((p: any) => p.id === prayerId);
        if (prayer) return prayer.parts ?? [];
    }
    return [];
}

/**
 * itemId של הפריט האחרון במקטע הקודם והראשון במקטע הבא – אותו תרגום (כמו neighborBounds בטעינת מקטע).
 */
export async function fetchNeighborItemIdBoundsForPart(
    dataSource: DataSource,
    params: {
        translationId: string;
        selectedPrayerId: string;
        partId: string;
        translations: any[];
    }
): Promise<{ prevLastItemId?: string; nextFirstItemId?: string }> {
    const { translationId, selectedPrayerId, partId, translations } = params;
    const parts = getPartsForPrayerInTranslation(translations, translationId, selectedPrayerId);
    const partIdx = parts.findIndex((p: any) => p.id === partId);
    const prevPartId: string | null =
        partIdx > 0 ? (parts[partIdx - 1]?.id as string) ?? null : null;
    const nextPartId: string | null =
        partIdx >= 0 && partIdx < parts.length - 1
            ? (parts[partIdx + 1]?.id as string) ?? null
            : null;

    const [prevItems, nextItems] = await Promise.all([
        prevPartId
            ? fetchPartItems(dataSource, translationId, selectedPrayerId, prevPartId)
            : Promise.resolve([] as Entity<any>[]),
        nextPartId
            ? fetchPartItems(dataSource, translationId, selectedPrayerId, nextPartId)
            : Promise.resolve([] as Entity<any>[]),
    ]);

    const bounds: { prevLastItemId?: string; nextFirstItemId?: string } = {};
    if (prevItems.length > 0) {
        const last = prevItems[prevItems.length - 1] as any;
        const id = last.values?.itemId;
        if (id != null && String(id).trim() !== "") bounds.prevLastItemId = String(id);
    }
    if (nextItems.length > 0) {
        const first = nextItems[0] as any;
        const id = first.values?.itemId;
        if (id != null && String(id).trim() !== "") bounds.nextFirstItemId = String(id);
    }
    return bounds;
}

/** פרמטרים ליצירת פריט תרגום חדש (מקושר לפריט בסיס) */
export type CreateTranslationItemParams = {
    targetTranslationId: string;
    selectedPrayerId: string;
    partId: string;
    /** רשימת התרגומים מה-TOC – לחישוב מקטע קודם/הבא לאותו תרגום יעד */
    translations: any[];
    baseItemId: string;
    afterItemId: string | null;
    /**
     * סדר itemId לכל שורת בסיס במקטע — באורך זהה ל-baseItems (מחרוזת ריקה אם חסר).
     * סריקה לאחור: לכל שורה קודמת מחפשים תרגומים ש-linkedItem מצביע על itemId של אותה שורה.
     */
    baseItemIdsInPartOrder?: string[];
    /** אינדקס שורת הבסיס ב-baseItems (לפי entity.id) */
    currentBaseRowIndex?: number;
    /** רצפל מזהי פריטים לפי תבנית אקסל (נגזר ממזהה המקטע) */
    minIdBefore?: string;
    content: string;
    type?: string;
    titleType?: string;
    title?: string;
    fontTanach?: boolean;
    bold?: boolean;
    centerAlign?: boolean;
    lineLine?: boolean;
    red?: boolean;
    justifyBlock?: boolean;
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
    /** mit_id של פריט הבסיס המקושר – לחישוב mit_id של התרגום (פסקה / תחילת פסקה / itemId) */
    baseItemMitId?: string;
    /** האם פריט התרגום הוא "תחילת פסקה" – רלוונטי רק כשפריט הבסיס אינו חלק מפסקה (itemId === mit_id) */
    isStartOfParagraph?: boolean;
    /** נקרא כשצריך לשאול את המשתמש האם ליצור מזהה .5 בין שני מספרים צמודים. מחזיר true אם מאשר. */
    confirmUserWantsDecimalId?: () => boolean;
    /** שם המקטע – לשמירת partName ו-partIdAndName על הפריט (לחיפוש/סינון באפליקציה) */
    partName?: string;
};

/** תוצאה מ-createTranslationItem – מזההים ללוג שינויים */
export type CreateTranslationItemResult = { newItemId: string; newMitId: string };

/**
 * יוצר פריט תרגום חדש בתרגום היעד, מקושר לפריט הבסיס (linkedItem).
 */
export async function createTranslationItem(
    dataSource: DataSource,
    params: CreateTranslationItemParams
): Promise<CreateTranslationItemResult> {
    const {
        targetTranslationId,
        selectedPrayerId,
        partId,
        baseItemId,
        afterItemId,
        baseItemIdsInPartOrder,
        currentBaseRowIndex,
        content,
        type = "body",
        titleType,
        title,
        fontTanach,
        bold,
        centerAlign,
        lineLine,
        red,
        justifyBlock,
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
        baseItemMitId: baseItemMitIdParam,
        isStartOfParagraph,
        confirmUserWantsDecimalId,
        translations,
        partName,
        minIdBefore: minIdBeforeParam,
    } = params;

    const path = `translations/${targetTranslationId}/prayers/${selectedPrayerId}/items`;
    cmsIdDbg("[CMS-ID] ▶▶▶ createTranslationItem – התחלה");
    cmsIdDbg("[CMS-ID]   targetTranslationId=", targetTranslationId, "selectedPrayerId=", selectedPrayerId, "partId=", partId);
    cmsIdDbg("[CMS-ID]   baseItemId=", baseItemId, "afterItemId=", afterItemId ?? "(ריק)", "minIdBefore=", minIdBeforeParam ?? "(ריק)");
    cmsIdDbg("[CMS-ID]   path=", path);

    const [partEntities, neighborItemBounds] = await Promise.all([
        dataSource.fetchCollection({
            path,
            collection: itemsCollection,
            filter: { partId: ["==", partId] },
        }),
        fetchNeighborItemIdBoundsForPart(dataSource, {
            translationId: targetTranslationId,
            selectedPrayerId,
            partId,
            translations,
        }),
    ]);

    cmsIdDbg("[CMS-ID]   partEntities נטענו: סה\"כ=", partEntities.length);
    cmsIdDbg("[CMS-ID]   neighborItemBounds=", JSON.stringify(neighborItemBounds));

    const deletedItemIds: string[] = partEntities
        .filter((e: any) => e.values?.deleted === true)
        .map((e: any) => e.values?.itemId)
        .filter((id: any) => id != null && String(id).trim() !== "")
        .map((id: any) => String(id));
    cmsIdDbg("[CMS-ID]   deletedItemIds=", deletedItemIds.length > 0 ? JSON.stringify(deletedItemIds) : "(אין)");

    const allItems = partEntities
        .filter((e: any) => e.values?.deleted !== true)
        .sort((a: any, b: any) =>
            (a.values?.itemId || "").localeCompare(b.values?.itemId || "", undefined, {
                numeric: true,
            })
        );
    const orderedItemIds = allItems.map((e: any) =>
        e.values?.itemId != null && e.values?.itemId !== "" ? String(e.values.itemId) : ""
    );
    cmsIdDbg("[CMS-ID]   allItems (לא deleted, ממוין):", allItems.length, "פריטים");
    cmsIdDbg("[CMS-ID]   orderedItemIds=", orderedItemIds.length <= 20 ? JSON.stringify(orderedItemIds) : `[${orderedItemIds.length} IDs: ${orderedItemIds.slice(0, 8).join(",")}...]`);

    const idNorm = (v: unknown) =>
        v != null && String(v).trim() !== "" ? String(v).trim() : "";
    const baseKey = idNorm(baseItemId);
    let afterKey =
        afterItemId != null && String(afterItemId).trim() !== ""
            ? String(afterItemId).trim()
            : null;

    /** linkedItem מתייחס ל-itemId של פריט הבסיס (מערך או ערך בודד). */
    const linksToBaseItemId = (e: any, baseItemIdStr: string) => {
        if (!baseItemIdStr) return false;
        const link = e.values?.linkedItem;
        if (Array.isArray(link)) return link.some((x: unknown) => idNorm(x) === baseItemIdStr);
        return idNorm(link) === baseItemIdStr;
    };

    const rawItemRow = (baseItemIdsInPartOrder ?? []).map((x) => idNorm(x));

    const curBaseIdx =
        typeof currentBaseRowIndex === "number" && currentBaseRowIndex >= 0
            ? currentBaseRowIndex
            : rawItemRow.findIndex((id) => id === baseKey);

    /**
     * אין afterItemId: עוגן = מקסימום itemId מבין כל פריטי התרגום במקטע שמקושרים לשורת בסיס כלשהי
     * עם אינדקס < curBaseIdx (לא רק "השורה הקרובה ביותר עם תרגום") — כדי שלא ייבחר עוגן נמוך
     * כשיש שורת בסיס קודמת עם תרגום בעל itemId גבוה יותר (מיון גלובלי vs סדר שורות).
     */
    const tryAnchorFromPriorBaseRows = (): void => {
        if (afterKey != null && afterKey !== "") return;
        if (curBaseIdx < 1) return;
        let best: string | null = null;
        let bestNum = -Infinity;
        for (let j = 0; j < curBaseIdx; j++) {
            const prevBaseItemId = rawItemRow[j];
            if (!prevBaseItemId) continue;
            const linkedToPrev = allItems.filter((e: any) => linksToBaseItemId(e, prevBaseItemId));
            for (const ent of linkedToPrev) {
                const id = idNorm(ent.values?.itemId ?? ent.id);
                if (id === "") continue;
                const n = Number(id);
                if (!Number.isNaN(n) && n > bestNum) {
                    bestNum = n;
                    best = id;
                }
            }
        }
        if (best != null) afterKey = best;
    };

    tryAnchorFromPriorBaseRows();
    cmsIdDbg("[CMS-ID]   baseKey=", baseKey, "afterKey (אחרי tryAnchor)=", afterKey ?? "(ריק)", "curBaseIdx=", curBaseIdx);
    cmsIdDbg("[CMS-ID]   rawItemRow (baseItemIdsInPartOrder)=", rawItemRow.length <= 20 ? JSON.stringify(rawItemRow) : `[${rawItemRow.length} IDs]`);

    /** סימטריה לסריקה אחורה: מינימום itemId בין תרגומי שורת הבסיס הבאה (לפי סדר שורות) שיש לה תרגומים — כבסיס ל-idAfter. */
    const nextBaseLinkedMinForInsert = ((): string | undefined => {
        if (curBaseIdx < 0) return undefined;
        for (let j = curBaseIdx + 1; j < rawItemRow.length; j++) {
            const nextBaseItemId = rawItemRow[j];
            if (!nextBaseItemId) continue;
            const linkedToNext = allItems.filter((e: any) => linksToBaseItemId(e, nextBaseItemId));
            if (linkedToNext.length > 0) {
                const firstNext = linkedToNext[0];
                const id = idNorm(firstNext.values?.itemId ?? firstNext.id);
                return id !== "" ? id : undefined;
            }
        }
        return undefined;
    })();
    const nextBaseItemIdForInsert = ((): string | undefined => {
        if (curBaseIdx < 0) return undefined;
        for (let j = curBaseIdx + 1; j < rawItemRow.length; j++) {
            const nextBaseItemId = rawItemRow[j];
            if (nextBaseItemId) return nextBaseItemId;
        }
        return undefined;
    })();
    const nextUpperCapForInsert = ((): string | undefined => {
        const linkedCap = nextBaseLinkedMinForInsert;
        const baseCap = nextBaseItemIdForInsert;
        if (!linkedCap) return baseCap;
        if (!baseCap) return linkedCap;
        return Number(baseCap) <= Number(linkedCap) ? baseCap : linkedCap;
    })();

    cmsIdDbg("[CMS-ID]   nextBaseLinkedMinForInsert=", nextBaseLinkedMinForInsert ?? "(ריק)");
    cmsIdDbg("[CMS-ID]   nextBaseItemIdForInsert=", nextBaseItemIdForInsert ?? "(ריק)");
    cmsIdDbg("[CMS-ID]   nextUpperCapForInsert=", nextUpperCapForInsert ?? "(ריק)");

    let insertIndex: number;
    if (afterKey == null) {
        const linkedToBase = allItems.filter((e: any) => linksToBaseItemId(e, baseKey));
        if (linkedToBase.length > 0) {
            const lastLinked = linkedToBase[linkedToBase.length - 1];
            const lastIdx = allItems.findIndex((e: any) => e.id === lastLinked.id);
            insertIndex = lastIdx >= 0 ? lastIdx + 1 : allItems.length;
            cmsIdDbg("[CMS-ID]   insertIndex: afterKey=null, linkedToBase=", linkedToBase.length, "→ אחרי אחרון (idx=", lastIdx, ") → insertIndex=", insertIndex);
        } else {
            insertIndex = 0;
            cmsIdDbg("[CMS-ID]   insertIndex: afterKey=null, אין פריטים מקושרים ל-baseKey → insertIndex=0");
        }
    } else {
        let inAll = allItems.findIndex(
            (e: any) => idNorm(e.values?.itemId ?? e.id) === afterKey
        );
        if (inAll < 0) {
            cmsIdDbg("[CMS-ID]   afterKey=", afterKey, "לא נמצא ב-allItems → מנסה tryAnchorFromPriorBaseRows");
            afterKey = null;
            tryAnchorFromPriorBaseRows();
            if (afterKey != null && afterKey !== "") {
                inAll = allItems.findIndex(
                    (e: any) => idNorm(e.values?.itemId ?? e.id) === afterKey
                );
                cmsIdDbg("[CMS-ID]   afterKey חדש מ-tryAnchor=", afterKey, "inAll=", inAll);
            }
        }
        insertIndex = inAll >= 0 ? inAll + 1 : allItems.length;
        cmsIdDbg("[CMS-ID]   insertIndex: afterKey=", afterKey, "inAll=", inAll, "→ insertIndex=", insertIndex);
    }

    let nextFirstFromPrayer: string | undefined;
    if (
        insertIndex >= orderedItemIds.length &&
        neighborItemBounds.nextFirstItemId == null
    ) {
        cmsIdDbg("[CMS-ID]   הוספה בסוף + אין nextFirstItemId ממקטע סמוך → fetch כל התפילה");
        const allPrayerItems = await dataSource.fetchCollection({
            path,
            collection: itemsCollection,
        });
        cmsIdDbg("[CMS-ID]   allPrayerItems=", allPrayerItems.length, "פריטים בתפילה");
        const laterIds = allPrayerItems
            .filter((e: any) => e.values?.deleted !== true)
            .map((e: any) => e.values?.itemId)
            .filter((id: any) => id != null && id !== "")
            .map((id: any) => String(id))
            .filter((id: string) => Number(id) > Number(baseItemId));
        if (laterIds.length > 0) {
            laterIds.sort((a: string, b: string) => Number(a) - Number(b));
            nextFirstFromPrayer = laterIds[0];
            cmsIdDbg("[CMS-ID]   laterIds (> baseItemId", baseItemId, "):", laterIds.length, "→ nextFirstFromPrayer=", nextFirstFromPrayer);
        } else {
            cmsIdDbg("[CMS-ID]   אין IDs מאוחרים מ-baseItemId=", baseItemId, "בכל התפילה");
        }
    }

    const neighborBoundsForInsert = {
        prevLastItemId: neighborItemBounds.prevLastItemId,
        nextFirstItemId:
            neighborItemBounds.nextFirstItemId ?? nextFirstFromPrayer ?? undefined,
    };
    const isNewPrayer = orderedItemIds.length === 0 && !neighborBoundsForInsert.prevLastItemId && !neighborBoundsForInsert.nextFirstItemId;
    cmsIdDbg("[CMS-ID]   neighborBoundsForInsert=", JSON.stringify(neighborBoundsForInsert));
    cmsIdDbg("[CMS-ID]   isNewPrayer=", isNewPrayer, "(orderedItemIds.length=", orderedItemIds.length, "prevLast=", neighborBoundsForInsert.prevLastItemId ?? "ריק", "nextFirst=", neighborBoundsForInsert.nextFirstItemId ?? "ריק", ")");
    cmsIdDbg("[CMS-ID]   → קריאה ל-computeItemIdForInsert: orderedItemIds=", orderedItemIds.length, "insertIndex=", insertIndex, "extraTakenIds(deleted)=", deletedItemIds.length, "nextUpperCap=", nextUpperCapForInsert ?? "(ריק)", "minIdBefore=", isNewPrayer ? (minIdBeforeParam ?? "(ריק)") : "(לא רלוונטי – יש פריטים/שכנים)");

    const newItemId = computeItemIdForInsert(orderedItemIds, insertIndex, {
        confirmUserWantsDecimalId,
        extraTakenIds: deletedItemIds,
        neighborBounds: neighborBoundsForInsert,
        ...(nextUpperCapForInsert != null
            ? { nextBaseLinkedMinItemId: nextUpperCapForInsert }
            : {}),
        ...(isNewPrayer && minIdBeforeParam ? { minIdBefore: minIdBeforeParam } : {}),
    });

    // חישוב mit_id: אם הבסיס חלק מפסקה → mit_id של הבסיס; אם לא ו"תחילת פסקה" → mit_id של הבסיס; אחרת → itemId של התרגום
    const baseItemMitId = baseItemMitIdParam != null && String(baseItemMitIdParam).trim() !== "" ? String(baseItemMitIdParam).trim() : null;
    const baseIsPartOfParagraph =
        baseItemMitId != null && baseKey !== idNorm(baseItemMitId);
    let newMitId: string;
    if (baseIsPartOfParagraph) {
        newMitId = baseItemMitId;
    } else if (isStartOfParagraph && baseItemMitId != null) {
        newMitId = baseItemMitId;
    } else {
        newMitId = newItemId;
    }
    cmsIdDbg("[CMS-ID] ◀◀◀ createTranslationItem – תוצאה סופית:");
    cmsIdDbg("[CMS-ID]   newItemId=", newItemId, "newMitId=", newMitId);
    cmsIdDbg("[CMS-ID]   baseItemMitId=", baseItemMitId ?? "(ריק)", "baseIsPartOfParagraph=", baseIsPartOfParagraph, "isStartOfParagraph=", isStartOfParagraph);
    cmsIdDbg("[CMS-ID]   mit_id חישוב:", baseIsPartOfParagraph ? "בסיס חלק מפסקה → mit_id=baseItemMitId" : isStartOfParagraph && baseItemMitId != null ? "תחילת פסקה → mit_id=baseItemMitId" : "רגיל → mit_id=newItemId");

    const values: Record<string, any> = {
        content: content ?? "",
        type,
        partId,
        itemId: newItemId,
        mit_id: newMitId,
        linkedItem: [baseKey || String(baseItemId)],
        timestamp: Date.now(),
    };
    if (partName != null && partName !== "") {
        values.partName = partName;
        values.partIdAndName = `${partId} ${partName}`;
    }
    if (titleType !== undefined) values.titleType = titleType;
    if (title !== undefined) values.title = title;
    if (fontTanach !== undefined) values.fontTanach = fontTanach;
    if (bold !== undefined) values.bold = bold;
    if (centerAlign !== undefined) values.centerAlign = centerAlign;
    if (lineLine !== undefined) values.lineLine = lineLine;
    if (red !== undefined) values.red = red;
    if (justifyBlock !== undefined) values.justifyBlock = justifyBlock;
    if (noSpace !== undefined) values.noSpace = noSpace;
    if (block !== undefined) values.block = block;
    if (firstInPage !== undefined) values.firstInPage = firstInPage;
    if (specialDate !== undefined) values.specialDate = specialDate;
    if (cohanim != null) values.cohanim = cohanim;
    if (hazan != null) values.hazan = hazan;
    if (minyan != null) values.minyan = minyan;
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
    return { newItemId, newMitId };
}

// ─── Split Part ──────────────────────────────────────────────────────────────

/**
 * פרמטרים לפיצול מקטע: מזהה פריט החתך קובע אילו פריטים עוברים למקטע החדש.
 * insertBefore=false → פריט החתך ועד הסוף עוברים.
 * insertBefore=true  → מתחילת המקטע עד פריט החתך (כולל) עוברים.
 */
export type SplitPartItemsParams = {
    currentTranslationId: string;
    selectedPrayerId: string;
    /** tocId (e.g. "ashkenaz") – לזיהוי תרגום האנגלית "1-{tocId}" */
    tocId: string;
    currentPartId: string;
    splitAtItemId: string;
    insertBefore: boolean;
    newPartId: string;
    newPartNameHe: string;
    newPartNameEn: string;
    translations: any[];
};

/**
 * מעדכן partId / partName / partIdAndName / timestamp על פריטי המקטע המועברים,
 * כולל פריטים מקושרים בכל שאר התרגומים.
 * partName = שם עברי לכולם חוץ מתרגום "1-{tocId}", שם שמקבל שם אנגלי.
 */
export async function splitPartItems(
    dataSource: DataSource,
    params: SplitPartItemsParams
): Promise<void> {
    const {
        currentTranslationId,
        selectedPrayerId,
        tocId,
        currentPartId,
        splitAtItemId,
        insertBefore,
        newPartId,
        newPartNameHe,
        newPartNameEn,
        translations,
    } = params;

    const baseItems = await fetchPartItems(
        dataSource,
        currentTranslationId,
        selectedPrayerId,
        currentPartId
    );

    const splitIdx = baseItems.findIndex((e: any) => e.values?.itemId === splitAtItemId);
    if (splitIdx < 0) {
        throw new Error(`splitPartItems: split item not found: ${splitAtItemId}`);
    }

    const movedItems = insertBefore
        ? baseItems.slice(0, splitIdx + 1)
        : baseItems.slice(splitIdx);

    if (movedItems.length === 0) {
        throw new Error("splitPartItems: no items selected for split");
    }

    const movedItemIds = new Set(
        movedItems.map((e: any) => e.values?.itemId as string).filter(Boolean)
    );
    const now = Date.now();

    const getPartName = (translationId: string): string =>
        translationId === `1-${tocId}` ? newPartNameEn : newPartNameHe;

    for (const trans of translations) {
        const tid = trans?.translationId as string | undefined;
        if (!tid) continue;

        const partName = getPartName(tid);
        const partIdAndName = `${newPartId} ${partName}`;
        const path = `translations/${tid}/prayers/${selectedPrayerId}/items`;

        if (tid === currentTranslationId) {
            for (const item of movedItems) {
                await dataSource.saveEntity({
                    path,
                    entityId: item.id,
                    values: { ...item.values, partId: newPartId, partName, partIdAndName, timestamp: now },
                    status: "existing",
                    collection: itemsCollection,
                });
            }
        } else {
            const chunks = chunkArray([...movedItemIds], 30);
            for (const chunk of chunks) {
                const related = (
                    await dataSource.fetchCollection({
                        path,
                        collection: itemsCollection,
                        filter: { linkedItem: ["array-contains-any", chunk] },
                    })
                ).filter((e: any) => e.values?.deleted !== true);
                for (const item of related) {
                    await dataSource.saveEntity({
                        path,
                        entityId: item.id,
                        values: { ...item.values, partId: newPartId, partName, partIdAndName, timestamp: now },
                        status: "existing",
                        collection: itemsCollection,
                    });
                }
            }
        }
    }
}

// ─── Move Items to Part ───────────────────────────────────────────────────────

export type MoveItemsToPartParams = {
    currentTranslationId: string;
    selectedPrayerId: string;
    /** tocId – לא בשימוש כאן כי שם המקטע נלקח מה-TOC לכל תרגום */
    movedItemIds: string[];
    sourcePartId: string;
    targetPartId: string;
    /** itemId של הפריט שאחריו להכניס; null = תחילת המקטע היעד */
    insertAfterItemId: string | null;
    /**
     * האם פריט בסיס הוא חלק מפסקה של הפריט שלפניו במיקום החדש.
     * true  -> mit_id של הפריט הקודם במיקום החדש (אם קיים)
     * false -> mit_id = itemId החדש של הפריט
     */
    paragraphByBaseItemId?: Record<string, boolean>;
    /** translations array from TOC (כולל categories/prayers/parts לכל תרגום) */
    translations: any[];
};

/**
 * מעביר פריטים (רצף רציף) ממקטע מקור למקטע יעד באותה תפילה.
 * סדר הפריטים המועברים נשמר לפי itemId, ובמקביל מחושבים mit_id חדשים לפי מיקום ההכנסה במקטע היעד.
 * partName לכל תרגום נלקח מעץ ה-TOC של אותו תרגום.
 */
export async function moveItemsToPart(
    dataSource: DataSource,
    params: MoveItemsToPartParams
): Promise<void> {
    const {
        currentTranslationId,
        selectedPrayerId,
        movedItemIds,
        sourcePartId,
        targetPartId,
        insertAfterItemId,
        paragraphByBaseItemId = {},
        translations,
    } = params;

    if (movedItemIds.length === 0) return;

    const movedIdSet = new Set(movedItemIds);

    const replaceLinkedItemId = (linked: unknown, oldId: string, newId: string): unknown => {
        if (Array.isArray(linked)) {
            return linked.map((v) => (v === oldId ? newId : v));
        }
        return linked === oldId ? [newId] : linked;
    };

    // פריטי בסיס מועברים (מהתרגום הנוכחי) ממוינים לפי itemId הנוכחי (שמירת סדר)
    const sourceItems = await fetchPartItems(
        dataSource,
        currentTranslationId,
        selectedPrayerId,
        sourcePartId
    );
    const movedEntities = sourceItems
        .filter((e: any) => movedIdSet.has(e.values?.itemId))
        .sort((a: any, b: any) =>
            (a.values?.itemId ?? "").localeCompare(b.values?.itemId ?? "", undefined, { numeric: true })
        );

    if (movedEntities.length === 0) {
        throw new Error("moveItemsToPart: no matching source items found for movedItemIds");
    }

    // פריטי יעד של הבסיס (ללא הפריטים המועברים, למקרה עתידי של source==target)
    const rawTargetItems = await fetchPartItems(
        dataSource,
        currentTranslationId,
        selectedPrayerId,
        targetPartId
    );
    const targetItems = rawTargetItems.filter(
        (e: any) => !movedIdSet.has(e.values?.itemId)
    );

    const insertAfterIdx =
        insertAfterItemId === null
            ? -1
            : targetItems.findIndex((e: any) => e.values?.itemId === insertAfterItemId);

    const baseIdAfter =
        insertAfterIdx + 1 < targetItems.length
            ? (targetItems[insertAfterIdx + 1].values?.itemId ?? null)
            : null;

    const baseOrderedIds = targetItems.map((e: any) => e.values?.itemId ?? "");
    let baseInsertIdx = insertAfterIdx + 1;

    const oldToNewBaseItemId: Record<string, string> = {};
    const oldToNewBaseMitId: Record<string, string> = {};
    let prevBaseMitId: string | null =
        insertAfterIdx >= 0 ? (targetItems[insertAfterIdx].values?.mit_id ?? null) : null;

    for (const item of movedEntities) {
        const oldBaseItemId = item.values?.itemId as string;
        const newBaseItemId = computeItemIdForInsert(baseOrderedIds, baseInsertIdx, {});
        baseOrderedIds.splice(baseInsertIdx, 0, newBaseItemId);
        baseInsertIdx++;
        oldToNewBaseItemId[oldBaseItemId] = newBaseItemId;

        const wantsParagraph = paragraphByBaseItemId[oldBaseItemId] === true;
        const newBaseMitId =
            wantsParagraph && prevBaseMitId != null && String(prevBaseMitId).trim() !== ""
                ? String(prevBaseMitId)
                : newBaseItemId;
        oldToNewBaseMitId[oldBaseItemId] = newBaseMitId;

        prevBaseMitId = newBaseMitId;
        cmsIdDbg("[CMS-ID] moveItemsToPart (base) | oldBaseItemId=", oldBaseItemId, "newBaseItemId=", newBaseItemId, "newBaseMitId=", newBaseMitId, "baseInsertIdx=", baseInsertIdx - 1, "wantsParagraph=", wantsParagraph);
    }

    const now = Date.now();

    // עוזר: שם המקטע היעד לפי עץ TOC של תרגום מסוים
    const getTargetPartName = (trans: any): string => {
        for (const cat of trans.categories ?? []) {
            const prayer = (cat.prayers ?? []).find((p: any) => p.id === selectedPrayerId);
            if (prayer) {
                const part = (prayer.parts ?? []).find((pt: any) => pt.id === targetPartId);
                if (part) return part.name ?? "";
            }
        }
        return "";
    };

    for (const trans of translations) {
        const tid = trans?.translationId as string | undefined;
        if (!tid) continue;

        const partName = getTargetPartName(trans);
        const partIdAndName = `${targetPartId} ${partName}`;
        const path = `translations/${tid}/prayers/${selectedPrayerId}/items`;

        if (tid === currentTranslationId) {
            for (const item of movedEntities) {
                const oldItemId = item.values?.itemId as string;
                const newItemId = oldToNewBaseItemId[oldItemId] ?? oldItemId;
                const newMitId = oldToNewBaseMitId[oldItemId] ?? item.values?.mit_id;
                await dataSource.saveEntity({
                    path,
                    entityId: item.id,
                    values: {
                        ...item.values,
                        partId: targetPartId,
                        partName,
                        partIdAndName,
                        itemId: newItemId,
                        mit_id: newMitId,
                        timestamp: now,
                    },
                    status: "existing",
                    collection: itemsCollection,
                });
            }
        } else {
            const targetItemsForTranslation = await fetchPartItems(
                dataSource,
                tid,
                selectedPrayerId,
                targetPartId
            );
            const chunks = chunkArray([...movedIdSet], 30);
            const relatedToMove: Entity<any>[] = [];
            for (const chunk of chunks) {
                const related = (
                    await dataSource.fetchCollection({
                        path,
                        collection: itemsCollection,
                        filter: { linkedItem: ["array-contains-any", chunk] },
                    })
                ).filter((e: any) => e.values?.deleted !== true);
                relatedToMove.push(...related);
            }

            const relatedIds = new Set(relatedToMove.map((e: any) => e.id));
            const stableTargetItems = targetItemsForTranslation.filter(
                (e: any) => !relatedIds.has(e.id)
            );
            // קיבוץ לפי פריט בסיס מקורי, כדי לחשב itemId בנפרד לכל תרגום ובהתאם למיקום הבסיס
            const relatedByBaseId = new Map<string, Entity<any>[]>();
            relatedToMove.forEach((item: any) => {
                const link = item.values?.linkedItem;
                const linkedBaseIds: string[] = Array.isArray(link) ? link : [link].filter(Boolean);
                const matchedBaseId = linkedBaseIds.find((id) => movedIdSet.has(id));
                if (!matchedBaseId) return;
                if (!relatedByBaseId.has(matchedBaseId)) relatedByBaseId.set(matchedBaseId, []);
                relatedByBaseId.get(matchedBaseId)!.push(item);
            });
            relatedByBaseId.forEach((arr) =>
                arr.sort((a: any, b: any) =>
                    (a.values?.itemId ?? "").localeCompare(b.values?.itemId ?? "", undefined, {
                        numeric: true,
                    })
                )
            );

            const orderedOldBaseIds = movedEntities.map((e: any) => e.values?.itemId as string);
            const translationOrderedIds = stableTargetItems
                .map((e: any) => e.values?.itemId)
                .filter((v: string | undefined) => !!v)
                .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));

            for (const oldBaseId of orderedOldBaseIds) {
                const relatedItems = relatedByBaseId.get(oldBaseId) ?? [];
                if (relatedItems.length === 0) continue;

                const newBaseId = oldToNewBaseItemId[oldBaseId] ?? oldBaseId;
                const baseIsParagraph =
                    (oldToNewBaseMitId[oldBaseId] ?? newBaseId) !== newBaseId;

                cmsIdDbg("[CMS-ID] moveItemsToPart (translation) | tid=", tid, "oldBaseId=", oldBaseId, "newBaseId=", newBaseId, "baseIsParagraph=", baseIsParagraph);

                // הכנסת newBaseId כנקודת ייחוס ממוינת — תרגומים ייכנסו מיד אחריו
                let baseRefPos = translationOrderedIds.findIndex((id: string) => Number(id) > Number(newBaseId));
                if (baseRefPos < 0) baseRefPos = translationOrderedIds.length;
                translationOrderedIds.splice(baseRefPos, 0, newBaseId);
                let insertPos = baseRefPos + 1;

                for (const item of relatedItems) {
                    const newTranslationItemId = computeItemIdForInsert(translationOrderedIds, insertPos, {});
                    translationOrderedIds.splice(insertPos, 0, newTranslationItemId);
                    insertPos++;

                    const updatedLinkedItem = replaceLinkedItemId(
                        item.values?.linkedItem,
                        oldBaseId,
                        newBaseId
                    );
                    const newTranslationMitId = baseIsParagraph
                        ? (oldToNewBaseMitId[oldBaseId] ?? item.values?.mit_id)
                        : newTranslationItemId;

                    cmsIdDbg("[CMS-ID] moveItemsToPart (translation item) | tid=", tid, "entityId=", item.id, "oldItemId=", item.values?.itemId, "newTranslationItemId=", newTranslationItemId, "newTranslationMitId=", newTranslationMitId);

                    await dataSource.saveEntity({
                        path,
                        entityId: item.id,
                        values: {
                            ...item.values,
                            linkedItem: updatedLinkedItem,
                            itemId: newTranslationItemId,
                            mit_id: newTranslationMitId,
                            partId: targetPartId,
                            partName,
                            partIdAndName,
                            timestamp: now,
                        },
                        status: "existing",
                        collection: itemsCollection,
                    });
                }
            }
        }
    }
}

// ─── Update Part Metadata in Items ────────────────────────────────────────────

export type UpdatePartMetadataParams = {
    selectedPrayerId: string;
    partId: string;
    /** translations array from TOC (כולל categories/prayers/parts לכל תרגום) */
    translations: any[];
};

/**
 * מעדכן partName ו-partIdAndName על כל הפריטים במקטע, בכל התרגומים.
 * השם לכל תרגום נלקח מעץ ה-TOC של אותו תרגום.
 */
export async function updatePartMetadataInItems(
    dataSource: DataSource,
    params: UpdatePartMetadataParams
): Promise<void> {
    const { selectedPrayerId, partId, translations } = params;

    const getPartName = (trans: any): string => {
        for (const cat of trans.categories ?? []) {
            const prayer = (cat.prayers ?? []).find((p: any) => p.id === selectedPrayerId);
            if (prayer) {
                const part = (prayer.parts ?? []).find((pt: any) => pt.id === partId);
                if (part) return part.name ?? "";
            }
        }
        return "";
    };

    const now = Date.now();

    for (const trans of translations) {
        const tid = trans?.translationId as string | undefined;
        if (!tid) continue;

        const partName = getPartName(trans);
        const partIdAndName = `${partId} ${partName}`;
        const path = `translations/${tid}/prayers/${selectedPrayerId}/items`;

        const items = await dataSource.fetchCollection({
            path,
            collection: itemsCollection,
            filter: { partId: ["==", partId] },
        });

        const toUpdate = items.filter((e: any) => e.values?.deleted !== true);
        for (const item of toUpdate) {
            await dataSource.saveEntity({
                path,
                entityId: item.id,
                values: {
                    ...item.values,
                    partName,
                    partIdAndName,
                    timestamp: now,
                },
                status: "existing",
                collection: itemsCollection,
            });
        }
    }
}

/**
 * מעדכן את זמן העדכון ב-Firestore (db-update-time) לנוסח הנבחר.
 * החיבור ל-Bagel עצמו מתבצע דרך bagelUpdateTimeService (SDK).
 */
export async function updateFirestoreTimestamp(
    dataSource: DataSource,
    selectedTocId: string,
    timestamp: number
): Promise<void> {
    await dataSource.saveEntity({
        path: "db-update-time",
        entityId: selectedTocId,
        values: { maxTimestamp: timestamp },
        status: "existing",
        collection: dbUpdateTimeCollection,
    });
}