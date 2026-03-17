/**
 * usePartEdit – Hook לעריכת מקטע (part)
 *
 * תפקיד:
 *   - טוען פריטי המקטע הנבחר + "תרגומים מקושרים" (enhancements) משאר התרגומים (דרך partEditService)
 *   - שומר עריכות מקומית (localValues, changedIds) עד ללחיצה על "שמור מקטע"
 *   - שמירה: שומר רק פריטים ששונו ל-Firestore (savePartItems)
 *   - פרסום: מעדכן db-update-time (Firestore) + timestamp ב-Bagel (SDK)
 *
 * מקבל מ-useTocNavigation: currentTocData, currentTranslationData, selectedPrayerId, selectedTocId
 * (הקשר הניווט הנוכחי – נדרש לבניית paths ולטעינה).
 */

import { useEffect, useState } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
} from "@firecms/cloud";
import {
    fetchPartWithEnhancements,
    fetchPartItems,
    savePartItems,
    updateFirestoreTimestamp,
    deletePartItemAndRelatedTranslations,
    createTranslationItem,
    splitPartItems,
    moveItemsToPart,
} from "../services/partEditService";
import { isBaseTranslation } from "../services/navigationService";
import { appendChangeLog } from "../services/changeLogService";
import { updateBagelTimestamp } from "../services/bagelUpdateTimeService";
import { mitIdBetween, computeItemIdForInsert, NO_SPACE_BETWEEN_ITEMS } from "../utils/itemUtils";
import { LOGGED_FIELDS } from "../constants/itemFields";
import { defaultAddItemForm, type AddItemFormValues } from "../components/AddItemModal";

/** הקשר הניווט – מועבר מ-useTocNavigation כדי לדעת איזה תרגום/תפילה נבחרו */
export type PartEditContext = {
    currentTocData: any;
    currentTranslationData: any;
    selectedPrayerId: string | null;
    selectedTocId: string | null;
    /** מקטעים בתפילה הנוכחית (לחישוב afterPartId בפיצול ולמודל ההעברה) */
    currentParts: any[];
    /** תפילות בקטגוריה הנוכחית (לשם תפילה בתיעוד) */
    currentPrayers?: any[];
    /** מוסיף מקטע ב-TOC (מ-useTocNavigation) – מחזיר newPartId */
    addPart: (
        name: string,
        afterPartId: string | null,
        options?: {
            nameEn?: string;
            tocId?: string;
            dateSetIds?: string[];
            hazan?: boolean | null;
            minyan?: boolean | null;
        }
    ) => Promise<string | null>;
};

const LOG_PREFIX = "[TocTranslations]";

/** רשומת שינוי ביומן – נוצרת בשמירה ומתעדת ערך לפני/אחרי עם סטטוס */
export type ChangeLogEntry = {
    id: string;
    timestamp: number;
    tocId: string | null;
    translationId: string;
    prayerId: string | null;
    partId: string | null;
    itemId: string;
    mitId: string;
    entityId: string;
    isEnhancement: boolean;
    enhancementTranslationId?: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    savedToFirestore: boolean;
    publishedToBagel: boolean;
};

/** השוואת שני אובייקטי ערכים – מחזיר רק שדות שהשתנו (מתוך LOGGED_FIELDS) */
function diffValues(
    orig: Record<string, any>,
    curr: Record<string, any>
): Array<{ field: string; oldValue: unknown; newValue: unknown }> {
    const diffs: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
    const normalize = (v: unknown) => (v === undefined ? null : v);
    LOGGED_FIELDS.forEach((field) => {
        const oldVal = normalize(orig[field]);
        const newVal = normalize(curr[field]);
        if (oldVal !== newVal) diffs.push({ field, oldValue: orig[field], newValue: curr[field] });
    });
    return diffs;
}

/** יצירת מזהה ייחודי לרשומת יומן */
function makeLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function usePartEdit(context: PartEditContext) {
    const {
        currentTocData,
        currentTranslationData,
        selectedPrayerId,
        selectedTocId,
        currentParts,
        currentPrayers,
        addPart,
    } = context;

    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    // —— State: מקטע נבחר, פריטים, עריכות מקומיות, סטטוס טעינה/שמירה ——
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [allItems, setAllItems] = useState<Entity<any>[]>([]);
    const [baseItems, setBaseItems] = useState<Entity<any>[]>([]);
    /**
     * גבולות מהמקטעים הסמוכים – נטענים ב-fetchItemsWithEnhancements.
     * משמשים לחישוב itemId/mit_id כשהמקטע ריק או כשמוסיפים בקצה הרשימה.
     */
    const [neighborBounds, setNeighborBounds] = useState<{
        prevLastItemId?: string;
        prevLastMitId?: string;
        nextFirstItemId?: string;
        nextFirstMitId?: string;
    }>({});
    const [enhancements, setEnhancements] = useState<
        Record<string, Entity<any>[]>
    >({});
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    /** מזהה הפריט שנוסף לאחרונה – להעברת פוקוס (מנוקה אחרי זמן קצר) */
    const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

    /** ערכים מקוריים של פריטים (snapshot בטעינה) – לחישוב diff בשמירה */
    const [originalValues, setOriginalValues] = useState<Record<string, any>>({});
    /** ערכים מקוריים של enhancements (snapshot בטעינה) – לחישוב diff בשמירה */
    const [originalEnhancementValues, setOriginalEnhancementValues] = useState<Record<string, any>>({});
    /** שינויי השמירה האחרונה בלבד – מתאפס בכל שמירה חדשה */
    const [lastSaveEntries, setLastSaveEntries] = useState<ChangeLogEntry[]>([]);

    /** פריטים שסומנו למחיקה – נמחקים ב-Firestore רק בלחיצה על "שמור מקטע" */
    const [pendingDeletes, setPendingDeletes] = useState<Array<{ entity: Entity<any>; itemId: string }>>([]);
    /** מזההים של פריטים עם deleted: true בשרת – לא מוצגים אבל נספרים בחישוב itemId/mit_id לפריטים חדשים */
    const [deletedIdsFromServer, setDeletedIdsFromServer] = useState<{ itemIds: string[]; mitIds: string[] }>({
        itemIds: [],
        mitIds: [],
    });

    /** מודל "הוסף פריט" – נפתח תחילה עם כל המאפיינים + המשך פסקה + dateSetId (ברירת מחדל 100) */
    const [addItemModalOpen, setAddItemModalOpen] = useState(false);
    const [addItemForm, setAddItemForm] = useState<AddItemFormValues>(defaultAddItemForm(false));
    /** כשפותחים מודל dateSetId מתוך הוספת פריט – שומרים את סוג ההוספה (part/instruction) */
    const [addItemDateSetIdSource, setAddItemDateSetIdSource] = useState<"part" | "instruction" | null>(null);

    /** מודל הגדרת dateSetId לפני הוספת מקטע/הוראה או בעריכת מקטע קיים */
    const [dateSetIdModalOpen, setDateSetIdModalOpen] = useState(false);
    const [pendingAddKind, setPendingAddKind] = useState<"part" | "instruction" | "addTranslation" | "edit" | "addItemDateSetId" | null>(null);
    const [pendingAddIndex, setPendingAddIndex] = useState(0);
    /** בעריכת dateSetId של מקטע קיים: מזהה הפריט וה-dateSetId הנוכחי (לטעינה במודל) */
    const [pendingEditEntityId, setPendingEditEntityId] = useState<string | null>(null);
    const [dateSetIdInitialForEdit, setDateSetIdInitialForEdit] = useState<string | undefined>(undefined);

    // עריכת תרגומים מקושרים (enhancements) – ערכים מקומיים + איזה תרגום כל entity שייך אליו
    const [enhancementLocalValues, setEnhancementLocalValues] = useState<Record<string, any>>({});
    const [enhancementChangedIds, setEnhancementChangedIds] = useState<Set<string>>(new Set());
    const [enhancementTranslationIds, setEnhancementTranslationIds] = useState<Record<string, string>>({});

    // מודל פיצול מקטע
    const [splitPartModalOpen, setSplitPartModalOpen] = useState(false);
    // מודל העברת פריטים למקטע אחר
    const [moveToPartModalOpen, setMoveToPartModalOpen] = useState(false);
    /** פריטי מקטע היעד (נטענים בבחירת מקטע במודל ההעברה) */
    const [moveTargetPartItems, setMoveTargetPartItems] = useState<Entity<any>[]>([]);

    // מודל "הוסף תרגום" – פריט בסיס, תרגום יעד, מיקום, תוכן
    const [addTranslationOpen, setAddTranslationOpen] = useState(false);
    const [addTranslationBaseItem, setAddTranslationBaseItem] = useState<Entity<any> | null>(null);
    const [addTranslationTargetId, setAddTranslationTargetId] = useState<string | null>(null);
    const [addTranslationInsertAfterId, setAddTranslationInsertAfterId] = useState<string | null>(null);
    const [addTranslationContent, setAddTranslationContent] = useState("");
    const [addTranslationTargetLinkedItems, setAddTranslationTargetLinkedItems] = useState<Entity<any>[]>([]);
    /** טופס מלא לפריט התרגום החדש (תוכן + כל המאפיינים כמו בפריט רגיל) */
    const [addTranslationForm, setAddTranslationForm] = useState<Record<string, any>>({
        content: "",
        type: "body",
        titleType: "",
        title: "",
        fontTanach: false,
        noSpace: false,
        block: false,
        firstInPage: false,
        specialDate: false,
        cohanim: null,
        hazan: null,
        minyan: null,
        role: "",
        reference: "",
        specialSign: "",
        dateSetId: "",
    });

    // איפוס אזור העריכה כשמחליפים TOC / תרגום / תפילה
    useEffect(() => {
        setSelectedGroupId(null);
        setAllItems([]);
        setBaseItems([]);
        setNeighborBounds({});
        setDeletedIdsFromServer({ itemIds: [], mitIds: [] });
        setLocalValues({});
        setEnhancements({});
        setChangedIds(new Set());
        setEnhancementLocalValues({});
        setEnhancementChangedIds(new Set());
        setEnhancementTranslationIds({});
        setLastAddedItemId(null);
        setAddTranslationOpen(false);
        setAddTranslationBaseItem(null);
        setAddTranslationTargetId(null);
        setAddTranslationInsertAfterId(null);
        setAddTranslationContent("");
        setAddTranslationTargetLinkedItems([]);
        setAddTranslationForm({
            content: "",
            type: "body",
            titleType: "",
            title: "",
            fontTanach: false,
            noSpace: false,
            block: false,
            firstInPage: false,
            specialDate: false,
            cohanim: null,
            hazan: null,
            minyan: null,
            role: "",
            reference: "",
            specialSign: "",
            dateSetId: "",
        });
        setPendingDeletes([]);
        setAddItemModalOpen(false);
        setPendingAddKind(null);
        setAddItemDateSetIdSource(null);
    }, [currentTocData, currentTranslationData, selectedPrayerId]);

    /** מחלץ את רשימת המקטעים לתפילה הנוכחית מתוך currentTocData לפי translationId */
    const getPartsFromToc = (translationId: string, prayerId: string): any[] => {
        const trans = (currentTocData?.translations ?? []).find(
            (t: any) => t.translationId === translationId
        );
        if (!trans) return [];
        for (const cat of trans.categories ?? []) {
            const prayer = (cat.prayers ?? []).find((p: any) => p.id === prayerId);
            if (prayer) return prayer.parts ?? [];
        }
        return [];
    };

    /** טוען פריטי מקטע + enhancements + גבולות מהמקטעים הסמוכים (במקביל).
     * options.preserveLocalEdits: כשמוסיפים תרגום – מרענן רק enhancements אבל שומר עריכות לא שמורות. */
    const fetchItemsWithEnhancements = async (
        partId: string,
        options?: { preserveLocalEdits?: boolean }
    ) => {
        if (!currentTranslationData || !selectedPrayerId || !currentTocData)
            return;
        const preserveEdits =
            options?.preserveLocalEdits === true && partId === selectedGroupId;
        const savedChangedIds = preserveEdits ? new Set(changedIds) : new Set<string>();
        const savedLocalValues = preserveEdits ? { ...localValues } : {};
        const savedAllItems = preserveEdits ? [...allItems] : [];
        const savedEnhancementChangedIds = preserveEdits ? new Set(enhancementChangedIds) : new Set<string>();
        const savedEnhancementLocalValues = preserveEdits ? { ...enhancementLocalValues } : {};
        const savedEnhancementTranslationIds = preserveEdits ? { ...enhancementTranslationIds } : {};
        const savedOriginalValues = preserveEdits ? { ...originalValues } : {};
        const savedOriginalEnhancementValues = preserveEdits ? { ...originalEnhancementValues } : {};
        setLoading(true);
        try {
            const translationId = currentTranslationData.translationId;

            // מזהה מקטעים סמוכים מה-TOC
            const parts = getPartsFromToc(translationId, selectedPrayerId);
            const partIdx = parts.findIndex((p: any) => p.id === partId);
            const prevPartId: string | null = partIdx > 0 ? parts[partIdx - 1]?.id ?? null : null;
            const nextPartId: string | null =
                partIdx >= 0 && partIdx < parts.length - 1 ? parts[partIdx + 1]?.id ?? null : null;

            // טוענים הכל במקביל: פריטי המקטע + פריטי מקטע קודם + פריטי מקטע הבא
            const [result, prevItems, nextItems] = await Promise.all([
                fetchPartWithEnhancements(dataSource, {
                    translationId,
                    selectedPrayerId,
                    partId,
                    translations: currentTocData.translations ?? [],
                    currentTranslationId: translationId,
                }),
                prevPartId
                    ? fetchPartItems(dataSource, translationId, selectedPrayerId, prevPartId)
                    : Promise.resolve([] as Entity<any>[]),
                nextPartId
                    ? fetchPartItems(dataSource, translationId, selectedPrayerId, nextPartId)
                    : Promise.resolve([] as Entity<any>[]),
            ]);

            // חישוב גבולות מהפריטים שנטענו
            const bounds: typeof neighborBounds = {};
            if (prevItems.length > 0) {
                const last = prevItems[prevItems.length - 1];
                bounds.prevLastItemId = last.values?.itemId ?? undefined;
                bounds.prevLastMitId =
                    last.values?.mit_id ?? last.values?.itemId ?? undefined;
            }
            if (nextItems.length > 0) {
                const first = nextItems[0];
                bounds.nextFirstItemId = first.values?.itemId ?? undefined;
                bounds.nextFirstMitId =
                    first.values?.mit_id ?? first.values?.itemId ?? undefined;
            }

            const serverItemIds = new Set(
                result.sorted.map((e: Entity<any>) => e.values?.itemId ?? e.id)
            );
            const mergedAllItems =
                preserveEdits && savedAllItems.length > 0
                    ? (() => {
                          let list = [...result.sorted];
                          for (let i = 0; i < savedAllItems.length; i++) {
                              const entity = savedAllItems[i];
                              if (!entity.id.startsWith("new_")) continue;
                              const itemId =
                                  savedLocalValues[entity.id]?.itemId ?? entity.values?.itemId;
                              if (serverItemIds.has(itemId)) continue;
                              const nextInSaved = savedAllItems[i + 1];
                              const insertBeforeId = nextInSaved?.id;
                              const pos = insertBeforeId
                                  ? list.findIndex((e: Entity<any>) => e.id === insertBeforeId)
                                  : -1;
                              if (pos >= 0) list.splice(pos, 0, entity);
                              else list.push(entity);
                          }
                          return list;
                      })()
                    : result.sorted;
            setAllItems(mergedAllItems);
            setBaseItems(result.baseItems ?? []);
            setEnhancements(result.enhancementsMap);
            setNeighborBounds(bounds);
            setSelectedGroupId(partId);
            setDeletedIdsFromServer({
                itemIds: result.deletedItemIds ?? [],
                mitIds: result.deletedMitIds ?? [],
            });

            if (preserveEdits) {
                // שומר עריכות לא שמורות: mergים את הנתונים מהשרת עם העריכה המקומית שנתפסה לפני הטעינה.
                // פריטים ש"new_xxx" שנשמרו עכשיו מגיעים מהשרת עם id=itemId – מעבירים את העריכה המקומית למפתח החדש.
                const mergedLocal = { ...result.initialValues };
                const mergedChangedIds = new Set<string>(savedChangedIds);
                savedChangedIds.forEach((id) => {
                    const val = savedLocalValues[id];
                    if (val == null) return;
                    const isNewSaved = id.startsWith("new_") && val.itemId && serverItemIds.has(val.itemId);
                    const key = isNewSaved ? val.itemId : id;
                    mergedLocal[key] = val;
                    if (isNewSaved) {
                        mergedChangedIds.delete(id);
                        // לא מוסיפים את key ל-changedIds – הפריט נשמר עכשיו בשרת
                    }
                });
                setLocalValues(mergedLocal);
                setChangedIds(mergedChangedIds);
                const mergedEnhLocal: Record<string, any> = {};
                Object.values(result.enhancementsMap).flat().forEach((e: any) => {
                    if (savedEnhancementChangedIds.has(e.id) && savedEnhancementLocalValues[e.id] != null)
                        mergedEnhLocal[e.id] = savedEnhancementLocalValues[e.id];
                });
                setEnhancementLocalValues(mergedEnhLocal);
                setEnhancementChangedIds(savedEnhancementChangedIds);
                setEnhancementTranslationIds(savedEnhancementTranslationIds);
                const mergedOrig: Record<string, any> = { ...savedOriginalValues };
                result.sorted.forEach((item) => {
                    if (!savedChangedIds.has(item.id)) mergedOrig[item.id] = { ...item.values };
                });
                setOriginalValues(mergedOrig);
                const mergedOrigEnh: Record<string, any> = { ...savedOriginalEnhancementValues };
                Object.values(result.enhancementsMap).flat().forEach((e: any) => {
                    if (!savedEnhancementChangedIds.has(e.id)) mergedOrigEnh[e.id] = { ...e.values };
                });
                setOriginalEnhancementValues(mergedOrigEnh);
            } else {
                setLocalValues(result.initialValues);
                setChangedIds(new Set());
                setEnhancementLocalValues({});
                setEnhancementChangedIds(new Set());
                setEnhancementTranslationIds({});
                const origMap: Record<string, any> = {};
                result.sorted.forEach((item) => { origMap[item.id] = { ...item.values }; });
                setOriginalValues(origMap);
                const origEnhMap: Record<string, any> = {};
                Object.values(result.enhancementsMap).flat().forEach((e) => { origEnhMap[e.id] = { ...e.values }; });
                setOriginalEnhancementValues(origEnhMap);
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} Part fetch failed`, err);
            snackbar.open({
                type: "error",
                message: "שגיאה בטעינת נתונים",
            });
        } finally {
            setLoading(false);
        }
    };

    /** מעדכן ערך של פריט בזיכרון ומסמן אותו כ־changed (לשמירה) */
    const updateLocalItem = (id: string, field: string, value: any) => {
        setLocalValues((prev) => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value,
                timestamp: Date.now(),
            },
        }));
        setChangedIds((prev) => new Set(prev).add(id));
    };

    /** מעדכן ערך של פריט תרגום מקושר (enhancement) – נשמר ל־path של אותו תרגום */
    const updateEnhancementLocalItem = (entityId: string, translationId: string, field: string, value: any) => {
        setEnhancementLocalValues((prev) => ({
            ...prev,
            [entityId]: {
                ...prev[entityId],
                [field]: value,
                timestamp: Date.now(),
            },
        }));
        setEnhancementChangedIds((prev) => new Set(prev).add(entityId));
        setEnhancementTranslationIds((prev) => ({ ...prev, [entityId]: translationId }));
    };

    /** שומר את כל הפריטים שסומנו כ־changed, שינויי התרגומים המקושרים, ומבצע מחיקות שסומנו; אם יש פריטים חדשים או מחיקות – טוען מחדש */
    const handleSaveGroup = async () => {
        if (!currentTranslationData || (changedIds.size === 0 && enhancementChangedIds.size === 0 && pendingDeletes.length === 0)) return;
        setSaving(true);
        const path = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
        const pendingDeleteIds = new Set(pendingDeletes.map((p) => p.entity.id));
        const changedIdList = Array.from(changedIds).filter((id) => !pendingDeleteIds.has(id));
        const hasNewItems = changedIdList.some((id) => id.startsWith("new_"));
        const hadEnhancementChanges = enhancementChangedIds.size > 0;
        const pendingDeletesList = [...pendingDeletes];
        try {
            if (changedIds.size > 0) {
                await savePartItems(dataSource, {
                    path,
                    changedIds: changedIdList,
                    localValues,
                });
            }
            if (enhancementChangedIds.size > 0 && selectedPrayerId) {
                const byTid: Record<string, string[]> = {};
                enhancementChangedIds.forEach((eid) => {
                    const tid = enhancementTranslationIds[eid];
                    if (tid) {
                        if (!byTid[tid]) byTid[tid] = [];
                        byTid[tid].push(eid);
                    }
                });
                for (const [tid, ids] of Object.entries(byTid)) {
                    const enhPath = `translations/${tid}/prayers/${selectedPrayerId}/items`;
                    const entities = enhancements[tid] ?? [];
                    const vals: Record<string, any> = {};
                    ids.forEach((id) => {
                        const ent = entities.find((e: any) => e.id === id);
                        const base = ent?.values ?? {};
                        vals[id] = {
                            ...base,
                            ...enhancementLocalValues[id],
                            timestamp: Date.now(),
                        };
                    });
                    await savePartItems(dataSource, {
                        path: enhPath,
                        changedIds: ids,
                        localValues: vals,
                    });
                }
                setEnhancementChangedIds(new Set());
                setEnhancementLocalValues({});
                setEnhancementTranslationIds({});
            }
            for (const { entity, itemId } of pendingDeletesList) {
                const isBase = isBaseTranslation(currentTranslationData.translationId);
                if (isBase) {
                    await deletePartItemAndRelatedTranslations(dataSource, {
                        itemEntity: entity,
                        itemId,
                        currentTranslationId: currentTranslationData.translationId,
                        selectedPrayerId: selectedPrayerId!,
                        translations: currentTocData.translations,
                    });
                    appendChangeLog({
                        timestamp: Date.now(),
                        action: "delete_part_item",
                        context: {
                            tocId: selectedTocId,
                            translationId: currentTranslationData.translationId,
                            prayerId: selectedPrayerId,
                            partId: selectedGroupId,
                            tocName: currentTocData?.nusach,
                            translationName: currentTranslationData?.label ?? currentTranslationData?.translationId,
                            prayerName: (currentPrayers ?? []).find((p: any) => p.id === selectedPrayerId)?.name,
                            partName: (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.nameHe ?? (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.name,
                        },
                        details: {
                            deletedItemId: itemId,
                            deletedEntityId: entity.id,
                            deletedItemContent: (entity.values?.content ?? localValues[entity.id]?.content ?? "").toString().slice(0, 200),
                            relatedTranslationIds: currentTocData.translations
                                .filter((t: any) => t.translationId !== currentTranslationData.translationId)
                                .map((t: any) => t.translationId),
                        },
                        savedToFirestore: true,
                    });
                } else {
                    await dataSource.saveEntity({
                        path: entity.path,
                        entityId: entity.id,
                        values: { ...entity.values, deleted: true, timestamp: Date.now() },
                        status: "existing",
                    });
                    appendChangeLog({
                        timestamp: Date.now(),
                        action: "delete_part_item",
                        context: {
                            tocId: selectedTocId,
                            translationId: currentTranslationData.translationId,
                            prayerId: selectedPrayerId,
                            partId: selectedGroupId,
                            tocName: currentTocData?.nusach,
                            translationName: currentTranslationData?.label ?? currentTranslationData?.translationId,
                            prayerName: (currentPrayers ?? []).find((p: any) => p.id === selectedPrayerId)?.name,
                            partName: (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.nameHe ?? (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.name,
                        },
                        details: {
                            deletedItemId: itemId,
                            deletedEntityId: entity.id,
                            deletedItemContent: (entity.values?.content ?? localValues[entity.id]?.content ?? "").toString().slice(0, 200),
                            relatedTranslationIds: [],
                        },
                        savedToFirestore: true,
                    });
                }
            }
            setPendingDeletes([]);

            snackbar.open({
                type: "success",
                message: "המקטע נשמר בהצלחה (מקומי)",
            });

            // --- יומן שינויים: חישוב diff לפני ניקוי state ---
            const now = Date.now();
            const newLogEntries: ChangeLogEntry[] = [];

            // diff לפריטים הראשיים
            changedIdList.forEach((id) => {
                const orig = originalValues[id] ?? {};
                const curr = localValues[id] ?? {};
                diffValues(orig, curr).forEach(({ field, oldValue, newValue }) => {
                    newLogEntries.push({
                        id: makeLogId(),
                        timestamp: now,
                        tocId: selectedTocId,
                        translationId: currentTranslationData.translationId,
                        prayerId: selectedPrayerId,
                        partId: selectedGroupId,
                        itemId: (curr.itemId ?? orig.itemId ?? id) as string,
                        mitId: (curr.mit_id ?? orig.mit_id ?? "") as string,
                        entityId: id,
                        isEnhancement: false,
                        field,
                        oldValue,
                        newValue,
                        savedToFirestore: true,
                        publishedToBagel: false,
                    });
                });
            });

            // diff ל-enhancements
            if (hadEnhancementChanges) {
                Array.from(enhancementChangedIds).forEach((eid) => {
                    const tid = enhancementTranslationIds[eid];
                    if (!tid) return;
                    const orig = originalEnhancementValues[eid] ?? {};
                    const localEnh = enhancementLocalValues[eid] ?? {};
                    // חובה להשוות מול האובייקט המלא (orig + שינויים), לא רק מול השינויים
                    const curr = { ...orig, ...localEnh };
                    diffValues(orig, curr).forEach(({ field, oldValue, newValue }) => {
                        newLogEntries.push({
                            id: makeLogId(),
                            timestamp: now,
                            tocId: selectedTocId,
                            translationId: currentTranslationData.translationId,
                            prayerId: selectedPrayerId,
                            partId: selectedGroupId,
                            itemId: (curr.itemId ?? orig.itemId ?? eid) as string,
                            mitId: (curr.mit_id ?? orig.mit_id ?? "") as string,
                            entityId: eid,
                            isEnhancement: true,
                            enhancementTranslationId: tid,
                            field,
                            oldValue,
                            newValue,
                            savedToFirestore: true,
                            publishedToBagel: false,
                        });
                    });
                });
            }

            // מחליף (לא מצטבר) – רק השמירה הנוכחית
            setLastSaveEntries(newLogEntries);

            // תיעוד ללוג שינויים מרכזי (למפתחים)
            if (newLogEntries.length > 0) {
                const byEntity = new Map<string, { itemId: string; mitId: string; isEnhancement: boolean; enhancementTranslationId?: string; changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> }>();
                for (const e of newLogEntries) {
                    let row = byEntity.get(e.entityId);
                    if (!row) {
                        row = {
                            itemId: e.itemId,
                            mitId: e.mitId,
                            isEnhancement: e.isEnhancement,
                            enhancementTranslationId: e.enhancementTranslationId,
                            changes: [],
                        };
                        byEntity.set(e.entityId, row);
                    }
                    row.changes.push({ field: e.field, oldValue: e.oldValue, newValue: e.newValue });
                }
                const getItemContent = (entityId: string, isEnh: boolean, enhTid?: string): string => {
                    if (isEnh) {
                        const tid = enhTid ?? enhancementTranslationIds[entityId];
                        const ents = tid ? (enhancements[tid] ?? []) : [];
                        const ent = ents.find((x: any) => x.id === entityId);
                        const c = enhancementLocalValues[entityId]?.content ?? ent?.values?.content;
                        return (c != null ? String(c) : "").slice(0, 200);
                    }
                    const c = localValues[entityId]?.content ?? allItems.find((x) => x.id === entityId)?.values?.content;
                    return (c != null ? String(c) : "").slice(0, 200);
                };
                const ctxWithNames = {
                    tocId: selectedTocId ?? undefined,
                    translationId: currentTranslationData?.translationId ?? undefined,
                    prayerId: selectedPrayerId ?? undefined,
                    partId: selectedGroupId ?? undefined,
                    tocName: currentTocData?.nusach ?? undefined,
                    translationName: currentTranslationData?.label ?? currentTranslationData?.translationId ?? undefined,
                    prayerName: (currentPrayers ?? []).find((p: any) => p.id === selectedPrayerId)?.name ?? undefined,
                    partName: (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.nameHe ?? (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.name ?? undefined,
                };
                appendChangeLog({
                    timestamp: now,
                    action: "save_part_items",
                    context: ctxWithNames,
                    details: {
                        fieldChanges: Array.from(byEntity.entries()).map(([entityId, row]) => ({
                            entityId,
                            itemId: row.itemId,
                            mitId: row.mitId,
                            itemContent: getItemContent(entityId, row.isEnhancement, row.enhancementTranslationId),
                            isEnhancement: row.isEnhancement,
                            enhancementTranslationId: row.enhancementTranslationId,
                            changes: row.changes,
                        })),
                    },
                    savedToFirestore: true,
                    publishedToBagel: false,
                });
            }

            // עדכון snapshot אחרי שמירה (הערכים הנוכחיים הופכים ל"מקוריים")
            setOriginalValues((prev) => {
                const next = { ...prev };
                changedIdList.forEach((id) => { next[id] = { ...localValues[id] }; });
                return next;
            });
            if (hadEnhancementChanges) {
                setOriginalEnhancementValues((prev) => {
                    const next = { ...prev };
                    Array.from(enhancementChangedIds).forEach((eid) => {
                        next[eid] = { ...(prev[eid] ?? {}), ...(enhancementLocalValues[eid] ?? {}) };
                    });
                    return next;
                });
            }
            // --- סוף יומן שינויים ---

            setChangedIds(new Set());
            if ((hasNewItems || hadEnhancementChanges || pendingDeletesList.length > 0) && selectedGroupId) {
                await fetchItemsWithEnhancements(selectedGroupId);
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} Save failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בשמירה" });
        } finally {
            setSaving(false);
        }
    };

    /** מעדכן זמן עדכון ב-Firestore + Bagel (SDK) – מפעיל סנכרון באפליקציה */
    const handleFinalPublish = async () => {
        if (!selectedTocId) return;
        setSaving(true);
        try {
            const publishTimestamp = Date.now();
            await updateFirestoreTimestamp(dataSource, selectedTocId, publishTimestamp);
            await updateBagelTimestamp(selectedTocId, publishTimestamp);
            snackbar.open({
                type: "success",
                message: "השינויים פורסמו בהצלחה לאפליקציה!",
            });
            appendChangeLog({
                timestamp: Date.now(),
                action: "publish_to_bagel",
                context: { tocId: selectedTocId, tocName: currentTocData?.nusach },
                details: { selectedTocId },
                savedToFirestore: true,
                publishedToBagel: true,
            });
            setLastSaveEntries((prev) =>
                prev.map((e) => ({ ...e, publishedToBagel: true }))
            );
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "נכשל הפרסום ל-Bagel";
            console.error(`${LOG_PREFIX} Publish failed`, err);
            snackbar.open({
                type: "error",
                message,
            });
        } finally {
            setSaving(false);
        }
    };

    /** מסמן פריט למחיקה מקומית; המחיקה ב-Firestore מתבצעת רק בלחיצה על "שמור מקטע". הפריט נשאר ברשימה ומסומן כ"ימוחק". */
    const handleDeleteItem = (item: Entity<any>, itemId: string) => {
        if (!currentTranslationData || !selectedPrayerId || !currentTocData?.translations)
            return;
        if (item.id.startsWith("new_")) {
            setAllItems((prev) => prev.filter((e) => e.id !== item.id));
            setLocalValues((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
            setChangedIds((prev) => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
            return;
        }
        setPendingDeletes((prev) => [...prev, { entity: item, itemId }]);
    };

    /** מסיר פריט מרשימת המחיקות המתינות – הפריט נשאר ונשמר כרגיל */
    const handleRestoreItem = (entity: Entity<any>) => {
        setPendingDeletes((prev) => prev.filter((p) => p.entity.id !== entity.id));
    };

    /** מחזיר את ה-mit_id האפקטיבי של פריט (מהעריכה המקומית או מהערכים המקוריים) */
    const getEffectiveMitId = (item: Entity<any>): string => {
        const local = localValues[item.id]?.mit_id;
        if (local !== undefined && local !== null && String(local).trim() !== "")
            return String(local).trim();
        const from = item.values?.mit_id;
        return from != null && from !== "" ? String(from) : "";
    };

    /** מחזיר את ה-itemId האפקטיבי של פריט (מהעריכה המקומית או מהערכים המקוריים) */
    const getEffectiveItemId = (item: Entity<any>): string => {
        const local = localValues[item.id]?.itemId;
        if (local !== undefined && local !== null && String(local).trim() !== "")
            return String(local).trim();
        const from = item.values?.itemId;
        return from != null && from !== "" ? String(from) : "";
    };

    /**
     * מחזיר את ה-itemId של הפריט בהקשר של הרשימה הנוכחית (תרגום או בסיס).
     * כשעורכים תרגום: מעדיפים (1) item.id אם נראה כמו itemId, (2) values.itemId אם שונה מבסיס, (3) בסיס.
     */
    const getItemIdInCurrentContext = (item: Entity<any>): string => {
        if (baseItems.length > 0) {
            const docId = item.id;
            if (docId && /^\d+$/.test(String(docId))) return String(docId);
            const effective = getEffectiveItemId(item);
            const baseId = getItemIdForPosition(item);
            if (effective && effective !== baseId) return effective;
            if (effective) return effective;
        }
        return getEffectiveItemId(item) || getItemIdForPosition(item) || "";
    };

    /**
     * מחזיר mit_id רלוונטי למיקום – כשעורכים תרגום ויש baseItems: פריט מקושר לבסיס → mit_id של הפריט בבסיס;
     * אחרת (בסיס או הוראה) → mit_id של הפריט עצמו.
     */
    const getMitIdForPosition = (item: Entity<any>): string => {
        const effectiveMitId = getEffectiveMitId(item);
        if (baseItems.length === 0) return effectiveMitId;
        const link = localValues[item.id]?.linkedItem ?? item.values?.linkedItem;
        const baseItemId = Array.isArray(link) ? link[0] : link;
        if (baseItemId) {
            const baseItem = baseItems.find(
                (b) => (localValues[b.id]?.itemId ?? b.values?.itemId) === baseItemId
            );
            if (baseItem) return getEffectiveMitId(baseItem);
        }
        return effectiveMitId;
    };

    /** מחזיר את ה-mit_id של פריט הבסיס הבא אחרי baseMitId (לפי סדר baseItems). אם אין – undefined. */
    const getNextBaseMitIdAfter = (baseMitId: string): string | undefined => {
        const num = Number(baseMitId);
        if (Number.isNaN(num) || baseItems.length === 0) return undefined;
        for (const b of baseItems) {
            const m = getEffectiveMitId(b);
            const bNum = Number(m);
            if (!Number.isNaN(bNum) && bNum > num) return m;
        }
        return undefined;
    };

    /** השוואה מספרית של mit_id – מחזיר את המחרוזת עם הערך הגבוה יותר. */
    const maxMitId = (a: string, b: string): string =>
        Number(a) >= Number(b) ? a : b;
    /** השוואה מספרית – מחזיר את המחרוזת עם הערך הנמוך יותר. */
    const minMitId = (a: string, b: string): string =>
        Number(a) <= Number(b) ? a : b;

    /**
     * מחשב mit_id לפריט חדש במיקום index. לוקח בחשבון גם שכנים בתרגום וגם בבסיס:
     * idBefore = מקסימום בין (שכן למעלה בתרגום) ל(פריט הבסיס המקביל) – כך ההוראה אחרי שניהם.
     * idAfter = מינימום בין (שכן למטה בתרגום), (פריט הבסיס המקביל), ו(פריט הבסיס הבא) – כך ההוראה לפני כולם.
     * בקצוות (index=0 / index=allItems.length) + מקטע ריק: neighborBounds מספק את הגבולות.
     */
    const computeMitIdForIndex = (index: number): string => {
        let idBefore: string | null = null;
        let idAfter: string | null | undefined = undefined;

        if (index > 0) {
            const itemAbove = allItems[index - 1];
            const aboveInTranslation = getEffectiveMitId(itemAbove);
            const aboveInBase = getMitIdForPosition(itemAbove);
            idBefore = baseItems.length > 0 ? maxMitId(aboveInTranslation, aboveInBase) : aboveInBase;
        } else if (neighborBounds.prevLastMitId) {
            // מקטע ריק או הוספה לפני כל הפריטים – גבול תחתון מהמקטע הקודם
            idBefore = neighborBounds.prevLastMitId;
        }

        if (index < allItems.length) {
            const itemBelow = allItems[index];
            const belowInTranslation = getEffectiveMitId(itemBelow);
            const belowInBase = getMitIdForPosition(itemBelow);
            idAfter = belowInBase;
            if (baseItems.length > 0) {
                idAfter = minMitId(belowInTranslation, belowInBase);
                const nextBase = idBefore ? getNextBaseMitIdAfter(idBefore) : undefined;
                if (nextBase != null) idAfter = minMitId(idAfter, nextBase);
            }
        } else if (baseItems.length > 0 && idBefore) {
            idAfter = getNextBaseMitIdAfter(idBefore) ?? undefined;
        }

        // אם עדיין אין גבול עליון (הוספה בסוף המקטע, כולל מקטע ריק) – גבול מהמקטע הבא
        if ((idAfter === undefined || idAfter === null) && neighborBounds.nextFirstMitId) {
            idAfter = neighborBounds.nextFirstMitId;
        }

        let result = mitIdBetween(idBefore ?? undefined, idAfter ?? undefined);
        const takenMitIds = new Set<string>(
            [
                ...allItems.map((i) => getEffectiveMitId(i)),
                ...deletedIdsFromServer.mitIds,
                ...pendingDeletes.map((p) => getEffectiveMitId(p.entity)),
            ].filter((m) => m != null && m !== "")
        );
        while (takenMitIds.has(result)) {
            result = String((Number(result) || 0) + 0.5);
        }
        return result;
    };

    /**
     * מחזיר itemId רלוונטי למיקום – כשעורכים תרגום ויש baseItems: פריט מקושר לבסיס → itemId של הפריט בבסיס;
     * אחרת (בסיס או הוראה) → itemId של הפריט עצמו.
     */
    const getItemIdForPosition = (item: Entity<any>): string => {
        const effectiveItemId = getEffectiveItemId(item);
        if (baseItems.length === 0) return effectiveItemId;
        const link = localValues[item.id]?.linkedItem ?? item.values?.linkedItem;
        const baseItemId = Array.isArray(link) ? link[0] : link;
        if (baseItemId) {
            const baseItem = baseItems.find(
                (b) => (localValues[b.id]?.itemId ?? b.values?.itemId) === baseItemId
            );
            if (baseItem) return getEffectiveItemId(baseItem);
        }
        return effectiveItemId;
    };

    /** מחזיר את ה-itemId של פריט הבסיס הבא אחרי baseItemId (לפי סדר baseItems). אם אין – undefined. */
    const getNextBaseItemIdAfter = (baseItemId: string): string | undefined => {
        const num = Number(baseItemId);
        if (Number.isNaN(num) || baseItems.length === 0) return undefined;
        for (const b of baseItems) {
            const id = getEffectiveItemId(b);
            const bNum = Number(id);
            if (!Number.isNaN(bNum) && bNum > num) return id;
        }
        return undefined;
    };

    /**
     * מחשב itemId לפריט חדש במיקום index. לוקח בחשבון שכנים מהרשימה + פריטי תרגום מקושרים (enhancements).
     * confirmUserWantsDecimalId – נקרא כשאין מקום שלם בין שני מספרים צמודים, שואל האם ליצור מזהה .5.
     */
    const computeItemIdForIndex = (index: number, confirmUserWantsDecimalId?: () => boolean): string => {
        const orderedItemIds = allItems.map((i) => getItemIdInCurrentContext(i));

        const allEnhancements = Object.values(enhancements).flat() as Entity<any>[];
        const linkedIdsPerPosition = allItems.map((item) => {
            const positionId = getItemIdForPosition(item);
            if (!positionId) return [];
            return allEnhancements
                .filter((e) => {
                    const link = e.values?.linkedItem;
                    const baseId = Array.isArray(link) ? link[0] : link;
                    return baseId === positionId;
                })
                .map((e) => (e.id && /^\d+$/.test(String(e.id)) ? String(e.id) : (e.values?.itemId ?? "")))
                .filter((id) => id != null && id !== "");
        });

        let nextFirstItemId = neighborBounds.nextFirstItemId;
        if (!nextFirstItemId && baseItems.length > 0 && index >= allItems.length) {
            const allIds = [...orderedItemIds.filter(Boolean), ...linkedIdsPerPosition.flat()];
            const maxAbove = allIds.length > 0 ? allIds.reduce((a, b) => (Number(a) >= Number(b) ? a : b)) : null;
            if (maxAbove) nextFirstItemId = getNextBaseItemIdAfter(maxAbove) ?? undefined;
        }

        return computeItemIdForInsert(orderedItemIds, index, {
            neighborBounds: { prevLastItemId: neighborBounds.prevLastItemId, nextFirstItemId },
            extraTakenIds: [
                ...deletedIdsFromServer.itemIds,
                ...pendingDeletes.map((p) => p.itemId).filter(Boolean),
            ],
            linkedIdsPerPosition,
            confirmUserWantsDecimalId,
        });
    };

    const reorderItemsWithinPart = (activeId: string, overId: string) => {
        if (activeId === overId) return;
        const oldIndex = allItems.findIndex((i) => i.id === activeId);
        const newIndex = allItems.findIndex((i) => i.id === overId);
        if (oldIndex < 0 || newIndex < 0) return;

        const reordered = [...allItems];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        const movedOldItemId = getEffectiveItemId(moved);
        if (!movedOldItemId) return;

        const prev = newIndex > 0 ? reordered[newIndex - 1] : null;

        const orderedIdsWithoutMoved = reordered
            .filter((i) => i.id !== moved.id)
            .map((i) => getItemIdInCurrentContext(i));

        const extraTakenIds = [
            ...deletedIdsFromServer.itemIds,
            ...pendingDeletes.map((p) => p.itemId).filter(Boolean),
        ];

        let newBaseItemId: string;
        try {
            newBaseItemId = computeItemIdForInsert(
                orderedIdsWithoutMoved,
                newIndex,
                { neighborBounds, extraTakenIds }
            );
        } catch (e) {
            if (e instanceof Error && e.message === NO_SPACE_BETWEEN_ITEMS) {
                snackbar.open({
                    type: "error",
                    message: "אין מקום פנוי בין הפריטים להעברה",
                });
                return;
            }
            throw e;
        }

        const prevMitId = prev ? getEffectiveMitId(prev) : null;
        const isPartOfParagraph =
            prev != null
                ? window.confirm("האם הפריט שהוזז הוא חלק מהפסקה של הפריט שלפניו במיקום החדש?")
                : false;
        const newBaseMitId =
            isPartOfParagraph && prevMitId != null && String(prevMitId).trim() !== ""
                ? String(prevMitId)
                : newBaseItemId;

        setAllItems(reordered);
        setLocalValues((prevLocal) => ({
            ...prevLocal,
            [moved.id]: {
                ...(prevLocal[moved.id] ?? moved.values ?? {}),
                itemId: newBaseItemId,
                mit_id: newBaseMitId,
                timestamp: Date.now(),
            },
        }));
        setChangedIds((prevChanged) => new Set(prevChanged).add(moved.id));

        // עדכון כל התרגומים המקושרים: linkedItem + itemId (מחושב בנפרד) + mit_id לפי כלל הפסקה
        const enhancementLocalPatch: Record<string, any> = {};
        const enhancementChangedPatch = new Set<string>();
        const enhancementTidPatch: Record<string, string> = {};

        Object.entries(enhancements).forEach(([tid, entities]) => {
            const related = entities.filter((e: any) => {
                const link = enhancementLocalValues[e.id]?.linkedItem ?? e.values?.linkedItem;
                return Array.isArray(link)
                    ? link.includes(movedOldItemId)
                    : link === movedOldItemId;
            });
            if (related.length === 0) return;

            const remaining = entities.filter((e: any) => !related.some((r: any) => r.id === e.id));
            const enhOrderedIds = remaining
                .map((e: any) => {
                    const local = enhancementLocalValues[e.id]?.itemId;
                    if (local != null && String(local).trim() !== "") return String(local);
                    const from = e.values?.itemId ?? e.id;
                    return from != null && String(from).trim() !== "" ? String(from) : "";
                })
                .filter((id: string) => id !== "")
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            // הכנסת newBaseItemId כנקודת ייחוס — תרגומים ייכנסו מיד אחריו
            let enhBaseRefPos = enhOrderedIds.findIndex((id) => Number(id) > Number(newBaseItemId));
            if (enhBaseRefPos < 0) enhBaseRefPos = enhOrderedIds.length;
            enhOrderedIds.splice(enhBaseRefPos, 0, newBaseItemId);
            let enhInsertPos = enhBaseRefPos + 1;

            related
                .sort((a: any, b: any) =>
                    (a.values?.itemId ?? "").localeCompare(b.values?.itemId ?? "", undefined, {
                        numeric: true,
                    })
                )
                .forEach((enh: any) => {
                    let newEnhItemId = newBaseItemId;
                    try {
                        newEnhItemId = computeItemIdForInsert(enhOrderedIds, enhInsertPos);
                    } catch {
                        newEnhItemId = enhOrderedIds[enhInsertPos - 1] ?? newBaseItemId;
                    }
                    enhOrderedIds.splice(enhInsertPos, 0, newEnhItemId);
                    enhInsertPos++;

                    const oldLink = enhancementLocalValues[enh.id]?.linkedItem ?? enh.values?.linkedItem;
                    const newLinkedItem = Array.isArray(oldLink)
                        ? oldLink.map((v: string) => (v === movedOldItemId ? newBaseItemId : v))
                        : oldLink === movedOldItemId
                            ? [newBaseItemId]
                            : oldLink;
                    enhancementLocalPatch[enh.id] = {
                        ...(enhancementLocalValues[enh.id] ?? enh.values ?? {}),
                        linkedItem: newLinkedItem,
                        itemId: newEnhItemId,
                        mit_id: newBaseMitId !== newBaseItemId ? newBaseMitId : newEnhItemId,
                        timestamp: Date.now(),
                    };
                    enhancementChangedPatch.add(enh.id);
                    enhancementTidPatch[enh.id] = tid;
                });
        });

        if (Object.keys(enhancementLocalPatch).length > 0) {
            setEnhancementLocalValues((prevLocal) => ({ ...prevLocal, ...enhancementLocalPatch }));
            setEnhancementChangedIds((prevChanged) => {
                const nextChanged = new Set(prevChanged);
                enhancementChangedPatch.forEach((id) => nextChanged.add(id));
                return nextChanged;
            });
            setEnhancementTranslationIds((prevTid) => ({ ...prevTid, ...enhancementTidPatch }));
        }
    };

    /**
     * מחשב mit_id לפריט חדש לפי תשובת המשתמש:
     *   המשך פסקה → mit_id = mit_id של הפריט הקודם (ראש הפסקה)
     *   לא המשך   → mit_id = itemId של הפריט החדש עצמו
     */
    const resolveMitIdForNew = (index: number, computedItemId: string, isContinuation: boolean): string => {
        if (isContinuation && index > 0 && allItems[index - 1]) {
            const prevItem = allItems[index - 1];
            const prevMitId = localValues[prevItem.id]?.mit_id ?? prevItem.values?.mit_id;
            if (prevMitId != null && String(prevMitId).trim() !== "") return String(prevMitId);
        }
        return computedItemId;
    };

    /** מוסיף פריט חדש (מזהה new_xxx מקומי) במקום index. defaultType קובע את ברירת המחדל ("body" / "instructions"). מחזיר false אם אין מקום. */
    const doAddNewItemAt = (index: number, dateSetId: string, isContinuation: boolean, form?: AddItemFormValues, defaultType: string = "body"): void | false => {
        let computedItemId: string;
        try {
            computedItemId = computeItemIdForIndex(index, () =>
                window.confirm(
                    "בין שני פריטים צמודים אין מקום למספר שלם. האם ליצור מזהה עם .5?"
                )
            );
        } catch (e) {
            if (e instanceof Error && e.message === NO_SPACE_BETWEEN_ITEMS) {
                snackbar.open({
                    type: "error",
                    message: "אין מקום פנוי בין הפריטים – לא ניתן להוסיף ללא עקיפת הסדר.",
                });
                return false;
            }
            throw e;
        }
        if (computedItemId.includes(".")) {
            snackbar.open({
                type: "info",
                message: "הפריט נוסף עם מזהה עשרוני בשל צפיפות בין פריטים.",
            });
        }
        const newEntityId = `new_${Date.now()}`;
        const newItemValues: Record<string, any> = {
            content: form?.content ?? "",
            type: form?.type ?? defaultType,
            partId: selectedGroupId,
            itemId: computedItemId,
            mit_id: resolveMitIdForNew(index, computedItemId, isContinuation),
            timestamp: Date.now(),
        };
        if (dateSetId) newItemValues.dateSetId = dateSetId;
        if (form) {
            if (form.titleType !== undefined) newItemValues.titleType = form.titleType;
            if (form.title !== undefined) newItemValues.title = form.title;
            if (form.fontTanach !== undefined) newItemValues.fontTanach = form.fontTanach;
            if (form.noSpace !== undefined) newItemValues.noSpace = form.noSpace;
            if (form.block !== undefined) newItemValues.block = form.block;
            if (form.firstInPage !== undefined) newItemValues.firstInPage = form.firstInPage;
            if (form.specialDate !== undefined) newItemValues.specialDate = form.specialDate;
            if (form.cohanim != null) newItemValues.cohanim = form.cohanim;
            if (form.hazan != null) newItemValues.hazan = form.hazan;
            if (form.minyan != null) newItemValues.minyan = form.minyan;
            if (form.role !== undefined) newItemValues.role = form.role;
            if (form.reference !== undefined) newItemValues.reference = form.reference;
            if (form.specialSign !== undefined) newItemValues.specialSign = form.specialSign;
        }
        const updated = [...allItems];
        updated.splice(index, 0, {
            id: newEntityId,
            values: newItemValues,
        } as any);
        setAllItems(updated);
        setLocalValues((prev) => ({ ...prev, [newEntityId]: newItemValues }));
        setChangedIds((prev) => new Set(prev).add(newEntityId));
        setLastAddedItemId(newEntityId);
        setTimeout(() => setLastAddedItemId(null), 300);
    };

    /** פותח חלון הוספת פריט (כל המאפיינים + המשך פסקה + dateSetId ברירת מחדל 100) */
    const addNewItemAt = (index: number) => {
        setPendingAddKind("part");
        setPendingAddIndex(index);
        setAddItemForm(defaultAddItemForm(false));
        setAddItemModalOpen(true);
    };

    /** פותח חלון הוספת הוראה */
    const addNewInstructionAt = (index: number) => {
        setPendingAddKind("instruction");
        setPendingAddIndex(index);
        setAddItemForm(defaultAddItemForm(true));
        setAddItemModalOpen(true);
    };

    const closeAddItemModal = () => {
        setAddItemModalOpen(false);
        setPendingAddKind((k) => (k === "part" || k === "instruction" ? null : k));
        setPendingAddIndex(0);
    };

    const confirmAddItemModal = () => {
        const dateSetId = addItemForm.dateSetId?.trim() || "100";
        const defaultType = pendingAddKind === "instruction" ? "instructions" : "body";
        let added: void | false = undefined;
        if (pendingAddKind === "part" || pendingAddKind === "instruction") {
            added = doAddNewItemAt(pendingAddIndex, dateSetId, addItemForm.isContinuation, addItemForm, defaultType);
        }
        if (added !== false) closeAddItemModal();
    };

    /** פותח מודל הגדרת dateSetId מתוך חלון הוספת פריט (הערך מתעדכן בטופס) */
    const openDateSetIdFromAddItemModal = () => {
        setAddItemDateSetIdSource(pendingAddKind === "part" || pendingAddKind === "instruction" ? pendingAddKind : null);
        setPendingAddKind("addItemDateSetId");
        setDateSetIdInitialForEdit(addItemForm.dateSetId?.trim() || undefined);
        setDateSetIdModalOpen(true);
    };

    const closeDateSetIdModal = () => {
        setDateSetIdModalOpen(false);
        if (pendingAddKind === "addItemDateSetId") {
            setPendingAddKind(addItemDateSetIdSource);
            setAddItemDateSetIdSource(null);
        } else {
            setPendingAddKind(null);
        }
        setPendingEditEntityId(null);
        setDateSetIdInitialForEdit(undefined);
    };

    const onDateSetIdSelected = (dateSetId: string, isContinuation: boolean = false) => {
        if (pendingAddKind === "addItemDateSetId") {
            setAddItemForm((prev) => ({ ...prev, dateSetId }));
            setPendingAddKind(addItemDateSetIdSource);
            setAddItemDateSetIdSource(null);
            setDateSetIdModalOpen(false);
            return;
        }
        if (pendingAddKind === "part") {
            doAddNewItemAt(pendingAddIndex, dateSetId, isContinuation, undefined, "body");
        } else if (pendingAddKind === "instruction") {
            doAddNewItemAt(pendingAddIndex, dateSetId, isContinuation, undefined, "instructions");
        } else if (pendingAddKind === "addTranslation") {
            setAddTranslationForm((prev) => ({ ...prev, dateSetId }));
        } else if (pendingAddKind === "edit" && pendingEditEntityId) {
            updateLocalItem(pendingEditEntityId, "dateSetId", dateSetId);
        }
        closeDateSetIdModal();
    };

    /** פותח מודל הגדרת dateSetId להזנת שדה dateSetId בטופס הוספת תרגום */
    const openDateSetIdModalForAddTranslation = () => {
        setPendingAddKind("addTranslation");
        setDateSetIdInitialForEdit(undefined);
        setDateSetIdModalOpen(true);
    };

    /** פותח מודל עריכת dateSetId של מקטע קיים – טוען את הנתונים של ה-ID הנוכחי */
    const openDateSetIdModalForEdit = (entityId: string, currentDateSetId: string) => {
        setPendingAddKind("edit");
        setPendingEditEntityId(entityId);
        setDateSetIdInitialForEdit(currentDateSetId?.trim() || undefined);
        setDateSetIdModalOpen(true);
    };

    const defaultAddTranslationForm = () => ({
        content: "",
        type: "body",
        titleType: "",
        title: "",
        fontTanach: false,
        noSpace: false,
        block: false,
        firstInPage: false,
        specialDate: false,
        cohanim: null as boolean | null,
        hazan: null as boolean | null,
        minyan: null as boolean | null,
        role: "",
        reference: "",
        specialSign: "",
        dateSetId: "100",
        isStartOfParagraph: false,
    });

    /** פותח מודל הוספת תרגום לפריט בסיס */
    const openAddTranslation = (item: Entity<any>) => {
        setAddTranslationBaseItem(item);
        setAddTranslationOpen(true);
        setAddTranslationTargetId(null);
        setAddTranslationInsertAfterId(null);
        setAddTranslationContent("");
        setAddTranslationTargetLinkedItems([]);
        setAddTranslationForm(defaultAddTranslationForm());
    };

    const closeAddTranslation = () => {
        setAddTranslationOpen(false);
        setAddTranslationBaseItem(null);
        setAddTranslationTargetId(null);
        setAddTranslationInsertAfterId(null);
        setAddTranslationContent("");
        setAddTranslationTargetLinkedItems([]);
        setAddTranslationForm(defaultAddTranslationForm());
    };

    const setAddTranslationFormField = (field: string, value: any) => {
        setAddTranslationForm((prev) => ({ ...prev, [field]: value }));
    };

    /** טוען רק את הפריטים בתרגום היעד שמקושרים לפריט הבסיס הנוכחי – להצגת מיקום (בין אלה בוחרים איפה להוסיף). */
    const loadTargetPartItemsForAddTranslation = async (translationId: string) => {
        if (!selectedPrayerId || !selectedGroupId || !addTranslationBaseItem) return;
        const baseItemId = getEffectiveItemId(addTranslationBaseItem);
        if (!baseItemId) return;
        try {
            const partItems = await fetchPartItems(
                dataSource,
                translationId,
                selectedPrayerId,
                selectedGroupId
            );
            const linkedToThisBase = partItems.filter((e: Entity<any>) => {
                const link = e.values?.linkedItem;
                const linkedId = Array.isArray(link) ? link[0] : link;
                return linkedId === baseItemId;
            });
            setAddTranslationTargetLinkedItems(linkedToThisBase);
            // ברירת מחדל: הוסף אחרי הפריט שמקושר לפריט הבסיס הקודם (אם קיים ברשימה), אחרת בהתחלה
            const baseIndex = baseItems.findIndex(
                (b) => (localValues[b.id]?.itemId ?? b.values?.itemId) === baseItemId
            );
            if (baseIndex > 0) {
                const prevBaseItemId = localValues[baseItems[baseIndex - 1].id]?.itemId ?? baseItems[baseIndex - 1].values?.itemId;
                const insertAfter = partItems.find((e: any) => {
                    const link = e.values?.linkedItem;
                    return Array.isArray(link) ? link.includes(prevBaseItemId) : link === prevBaseItemId;
                });
                const afterId = insertAfter?.values?.itemId ?? insertAfter?.id;
                const inFilteredList = linkedToThisBase.some((e: Entity<any>) => (e.values?.itemId ?? e.id) === afterId);
                setAddTranslationInsertAfterId(inFilteredList ? afterId : null);
            } else {
                setAddTranslationInsertAfterId(null);
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} Load target part items failed`, err);
            setAddTranslationTargetLinkedItems([]);
        }
    };

    // ─── Split Part ────────────────────────────────────────────────────────────

    const openSplitPartModal = () => setSplitPartModalOpen(true);
    const closeSplitPartModal = () => setSplitPartModalOpen(false);

    /**
     * מבצע פיצול מקטע:
     * 1. מוסיף מקטע חדש ב-TOC (addPart עם שם עברית + אנגלית + dateSetIds)
     * 2. מעדכן partId/partName/partIdAndName/timestamp על הפריטים שעברו
     * 3. מרענן את הפריטים בתצוגה
     */
    const handleSplitPart = async (params: {
        splitAtItemId: string;
        newPartNameHe: string;
        newPartNameEn: string;
        newPartDateSetIds: string[];
        newPartHazan: boolean | null;
        newPartMinyan: boolean | null;
        insertBefore: boolean;
    }) => {
        if (!selectedGroupId || !selectedPrayerId || !selectedTocId || !currentTranslationData?.translationId) return;

        const { splitAtItemId, newPartNameHe, newPartNameEn, newPartDateSetIds, newPartHazan, newPartMinyan, insertBefore } = params;

        // tocId נגזר ממזהה התרגום הנוכחי: "0-ashkenaz" → "ashkenaz"
        const tocId = selectedTocId;

        // afterPartId לפי מיקום המקטע החדש
        let afterPartId: string | null;
        if (insertBefore) {
            const idx = (currentParts ?? []).findIndex((p: any) => p.id === selectedGroupId);
            afterPartId = idx > 0 ? (currentParts[idx - 1].id as string) : null;
        } else {
            afterPartId = selectedGroupId;
        }

        setSaving(true);
        try {
            const newPartId = await addPart(newPartNameHe, afterPartId, {
                nameEn: newPartNameEn,
                tocId,
                dateSetIds: newPartDateSetIds,
                hazan: newPartHazan,
                minyan: newPartMinyan,
            });
            if (!newPartId) return;

            await splitPartItems(dataSource, {
                currentTranslationId: currentTranslationData.translationId,
                selectedPrayerId,
                tocId,
                currentPartId: selectedGroupId,
                splitAtItemId,
                insertBefore,
                newPartId,
                newPartNameHe,
                newPartNameEn,
                translations: currentTocData?.translations ?? [],
            });

            appendChangeLog({
                timestamp: Date.now(),
                action: "split_part",
                context: {
                    tocId: selectedTocId,
                    translationId: currentTranslationData.translationId,
                    prayerId: selectedPrayerId,
                    partId: selectedGroupId,
                    tocName: currentTocData?.nusach,
                    translationName: currentTranslationData?.label ?? currentTranslationData?.translationId,
                    prayerName: (currentPrayers ?? []).find((p: any) => p.id === selectedPrayerId)?.name,
                    partName: (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.nameHe ?? (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.name,
                },
                details: {
                    fromPartId: selectedGroupId,
                    toPartId: newPartId,
                    partName: newPartNameHe,
                    newPartId,
                },
                savedToFirestore: true,
            });

            snackbar.open({ type: "success", message: "המקטע פוצל בהצלחה" });
            closeSplitPartModal();
            await fetchItemsWithEnhancements(selectedGroupId);
        } catch (err) {
            console.error(`${LOG_PREFIX} Split part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בפיצול המקטע" });
        } finally {
            setSaving(false);
        }
    };

    // ─── Move Items to Part ────────────────────────────────────────────────────

    const openMoveToPartModal = () => {
        setMoveTargetPartItems([]);
        setMoveToPartModalOpen(true);
    };
    const closeMoveToPartModal = () => setMoveToPartModalOpen(false);

    /** טוען פריטי מקטע יעד להצגה בבחירת מיקום הכנסה */
    const loadMoveTargetPartItems = async (targetPartId: string) => {
        if (!selectedPrayerId || !currentTranslationData?.translationId) return;
        try {
            const items = await fetchPartItems(
                dataSource,
                currentTranslationData.translationId,
                selectedPrayerId,
                targetPartId
            );
            setMoveTargetPartItems(items);
        } catch (err) {
            console.error(`${LOG_PREFIX} Load move target part items failed`, err);
            setMoveTargetPartItems([]);
        }
    };

    /**
     * מעביר פריטים ממקטע נוכחי למקטע יעד קיים.
     * מחשב mit_id חדשים לפי מיקום ההכנסה ומרענן את התצוגה.
     */
    const handleMoveItemsToPart = async (params: {
        movedItemIds: string[];
        targetPartId: string;
        insertAfterItemId: string | null;
        paragraphByBaseItemId: Record<string, boolean>;
    }) => {
        if (!selectedGroupId || !selectedPrayerId || !selectedTocId || !currentTranslationData?.translationId) return;

        const { movedItemIds, targetPartId, insertAfterItemId, paragraphByBaseItemId } = params;
        if (movedItemIds.length === 0) return;

        setSaving(true);
        try {
            await moveItemsToPart(dataSource, {
                currentTranslationId: currentTranslationData.translationId,
                selectedPrayerId,
                movedItemIds,
                sourcePartId: selectedGroupId,
                targetPartId,
                insertAfterItemId,
                paragraphByBaseItemId,
                translations: currentTocData?.translations ?? [],
            });

            appendChangeLog({
                timestamp: Date.now(),
                action: "move_items_to_part",
                context: {
                    tocId: selectedTocId,
                    translationId: currentTranslationData.translationId,
                    prayerId: selectedPrayerId,
                    partId: selectedGroupId,
                    tocName: currentTocData?.nusach,
                    translationName: currentTranslationData?.label ?? currentTranslationData?.translationId,
                    prayerName: (currentPrayers ?? []).find((p: any) => p.id === selectedPrayerId)?.name,
                    partName: (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.nameHe ?? (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.name,
                },
                details: {
                    fromPartId: selectedGroupId,
                    toPartId: targetPartId,
                    movedItemIds,
                },
                savedToFirestore: true,
            });

            snackbar.open({ type: "success", message: "הפריטים הועברו בהצלחה" });
            closeMoveToPartModal();
            await fetchItemsWithEnhancements(selectedGroupId);
        } catch (err) {
            console.error(`${LOG_PREFIX} Move items to part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהעברת הפריטים" });
        } finally {
            setSaving(false);
        }
    };

    /** שומר את פריט התרגום החדש וסוגר את המודל */
    const submitAddTranslation = async () => {
        if (
            !addTranslationBaseItem ||
            !addTranslationTargetId ||
            !selectedPrayerId ||
            !selectedGroupId ||
            !currentTranslationData ||
            !currentTocData?.translations?.some((t: any) => t.translationId === addTranslationTargetId)
        )
            return;
        const baseItemId = getEffectiveItemId(addTranslationBaseItem);
        if (!baseItemId) return;
        const form = addTranslationForm;
        setSaving(true);
        try {
            // אם הפריט הבסיס עדיין לא נשמר (new_xxx) – שומרים אותו קודם כדי שהתרגום יתקשר לפריט קיים בשרת
            const baseIsNew = addTranslationBaseItem.id.startsWith("new_");
            if (baseIsNew && changedIds.has(addTranslationBaseItem.id)) {
                const path = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
                await savePartItems(dataSource, {
                    path,
                    changedIds: Array.from(changedIds),
                    localValues,
                });
                // אחרי השמירה הפריט בשרת עם document id = itemId; הרענון יטען אותו
            }
            let newItemId: string;
            let newMitId: string;
            try {
                const baseItemMitId = addTranslationBaseItem
                    ? (localValues[addTranslationBaseItem.id]?.mit_id ?? addTranslationBaseItem.values?.mit_id ?? undefined)
                    : undefined;
                const result = await createTranslationItem(dataSource, {
                    targetTranslationId: addTranslationTargetId,
                    selectedPrayerId,
                    partId: selectedGroupId,
                    baseItemId,
                    afterItemId: addTranslationInsertAfterId,
                    content: (form.content ?? addTranslationContent ?? "").toString().trim(),
                    type: form.type ?? "body",
                    titleType: form.titleType,
                    title: form.title,
                    fontTanach: form.fontTanach,
                    noSpace: form.noSpace,
                    block: form.block,
                    firstInPage: form.firstInPage,
                    specialDate: form.specialDate,
                    cohanim: form.cohanim,
                    hazan: form.hazan,
                    minyan: form.minyan,
                    role: form.role,
                    reference: form.reference,
                    specialSign: form.specialSign,
                    dateSetId: form.dateSetId?.trim() || "100",
                    baseItemMitId: baseItemMitId != null && String(baseItemMitId).trim() !== "" ? String(baseItemMitId).trim() : undefined,
                    isStartOfParagraph: !!form.isStartOfParagraph,
                    confirmUserWantsDecimalId: () =>
                        window.confirm(
                            "בין שני פריטים צמודים אין מקום למספר שלם. האם ליצור מזהה עם .5?"
                        ),
                });
                newItemId = result.newItemId;
                newMitId = result.newMitId;
            } catch (err) {
                if (err instanceof Error && err.message === NO_SPACE_BETWEEN_ITEMS) {
                    snackbar.open({
                        type: "error",
                        message: "אין מקום פנוי בין הפריטים – לא ניתן להוסיף תרגום ללא עקיפת הסדר.",
                    });
                    return;
                }
                throw err;
            }
            if (newItemId.includes(".")) {
                snackbar.open({
                    type: "info",
                    message: "התרגום נוסף עם מזהה עשרוני בשל צפיפות בין פריטים.",
                });
            }
            const newItemContentVal = (form.content ?? addTranslationContent ?? "").toString().trim().slice(0, 200);
            appendChangeLog({
                timestamp: Date.now(),
                action: "create_translation_item",
                context: {
                    tocId: selectedTocId,
                    translationId: addTranslationTargetId,
                    prayerId: selectedPrayerId,
                    partId: selectedGroupId,
                    tocName: currentTocData?.nusach,
                    translationName: currentTranslationData?.label ?? currentTranslationData?.translationId,
                    prayerName: (currentPrayers ?? []).find((p: any) => p.id === selectedPrayerId)?.name,
                    partName: (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.nameHe ?? (currentParts ?? []).find((p: any) => p.id === selectedGroupId)?.name,
                },
                details: {
                    newItemId,
                    newMitId,
                    newItemContent: newItemContentVal,
                    baseItemId,
                    targetTranslationId: addTranslationTargetId,
                },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "תרגום נוסף בהצלחה" });
            closeAddTranslation();
            if (selectedGroupId)
                await fetchItemsWithEnhancements(selectedGroupId, { preserveLocalEdits: true });
        } catch (err) {
            console.error(`${LOG_PREFIX} Add translation item failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהוספת תרגום" });
        } finally {
            setSaving(false);
        }
    };

    return {
        selectedGroupId,
        allItems,
        enhancements,
        localValues,
        changedIds,
        pendingDeletes,
        loading,
        saving,
        fetchItemsWithEnhancements,
        updateLocalItem,
        updateEnhancementLocalItem,
        handleSaveGroup,
        handleFinalPublish,
        addNewItemAt,
        addNewInstructionAt,
        reorderItemsWithinPart,
        lastAddedItemId,
        handleDeleteItem,
        handleRestoreItem,
        enhancementLocalValues,
        enhancementChangedIds,
        enhancementTranslationIds,
        // פיצול מקטע
        splitPartModalOpen,
        openSplitPartModal,
        closeSplitPartModal,
        handleSplitPart,
        // העברת פריטים למקטע
        moveToPartModalOpen,
        openMoveToPartModal,
        closeMoveToPartModal,
        handleMoveItemsToPart,
        moveTargetPartItems,
        loadMoveTargetPartItems,
        addTranslationOpen,
        addTranslationBaseItem,
        addTranslationTargetId,
        addTranslationInsertAfterId,
        addTranslationContent,
        addTranslationTargetLinkedItems,
        openAddTranslation,
        closeAddTranslation,
        setAddTranslationTargetId,
        setAddTranslationInsertAfterId,
        setAddTranslationContent,
        addTranslationForm,
        setAddTranslationFormField,
        loadTargetPartItemsForAddTranslation,
        submitAddTranslation,
        // מודל "הוסף פריט" – נפתח תחילה עם כל המאפיינים, המשך פסקה במרכז, dateSetId ברירת מחדל 100
        addItemModalOpen,
        addItemForm,
        setAddItemFormField: (field: keyof AddItemFormValues, value: unknown) =>
            setAddItemForm((prev) => ({ ...prev, [field]: value })),
        closeAddItemModal,
        confirmAddItemModal,
        openDateSetIdFromAddItemModal,
        addItemShowParagraphQuestion:
            (pendingAddKind === "part" || pendingAddKind === "instruction") && pendingAddIndex > 0,
        addItemPrevItemContent:
            (pendingAddKind === "part" || pendingAddKind === "instruction") &&
            pendingAddIndex > 0 &&
            allItems[pendingAddIndex - 1]
                ? String(
                      localValues[allItems[pendingAddIndex - 1].id]?.content ??
                          allItems[pendingAddIndex - 1].values?.content ??
                          ""
                  )
                : "",
        addItemIsInstruction: pendingAddKind === "instruction",
        /** האם להציג שאלת "המשך פסקה?" בתוך מודל dateSetId (רק כשמוסיפים פריט/הוראה ויש פריט מעל) */
        showParagraphQuestionInModal:
            (pendingAddKind === "part" || pendingAddKind === "instruction") && pendingAddIndex > 0,
        /** תוכן הפריט שמעל — לתצוגה מקדימה בתוך המודל */
        paragraphModalPrevItemContent:
            (pendingAddKind === "part" || pendingAddKind === "instruction") &&
            pendingAddIndex > 0 &&
            allItems[pendingAddIndex - 1]
                ? String(
                      localValues[allItems[pendingAddIndex - 1].id]?.content ??
                          allItems[pendingAddIndex - 1].values?.content ??
                          ""
                  )
                : "",
        dateSetIdModalOpen,
        closeDateSetIdModal,
        onDateSetIdSelected,
        dateSetIdModalTitle:
            pendingAddKind === "addItemDateSetId"
                ? "הגדר סט תאריכים לפריט"
                : pendingAddKind === "part"
                  ? "הגדר סט תאריכים למקטע"
                  : pendingAddKind === "instruction"
                    ? "הגדר סט תאריכים להוראה"
                    : pendingAddKind === "edit"
                      ? "ערוך סט תאריכים (dateSetId)"
                      : "הגדר סט תאריכים לתרגום",
        dataSource,
        openDateSetIdModalForAddTranslation,
        openDateSetIdModalForEdit,
        dateSetIdInitialForEdit,
        lastSaveEntries,
        clearLastSave: () => setLastSaveEntries([]),
    };
}
