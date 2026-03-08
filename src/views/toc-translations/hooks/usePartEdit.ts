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
} from "../services/partEditService";
import { isBaseTranslation } from "../services/navigationService";
import { appendChangeLog } from "../services/changeLogService";
import { updateBagelTimestamp } from "../services/bagelUpdateTimeService";
import { mitIdBetween } from "../utils/itemUtils";
import { LOGGED_FIELDS } from "../constants/itemFields";

/** הקשר הניווט – מועבר מ-useTocNavigation כדי לדעת איזה תרגום/תפילה נבחרו */
export type PartEditContext = {
    currentTocData: any;
    currentTranslationData: any;
    selectedPrayerId: string | null;
    selectedTocId: string | null;
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

    /** מודל הגדרת dateSetId לפני הוספת מקטע/הוראה או בעריכת מקטע קיים */
    const [dateSetIdModalOpen, setDateSetIdModalOpen] = useState(false);
    const [pendingAddKind, setPendingAddKind] = useState<"part" | "instruction" | "addTranslation" | "edit" | null>(null);
    const [pendingAddIndex, setPendingAddIndex] = useState(0);
    /** בעריכת dateSetId של מקטע קיים: מזהה הפריט וה-dateSetId הנוכחי (לטעינה במודל) */
    const [pendingEditEntityId, setPendingEditEntityId] = useState<string | null>(null);
    const [dateSetIdInitialForEdit, setDateSetIdInitialForEdit] = useState<string | undefined>(undefined);

    // עריכת תרגומים מקושרים (enhancements) – ערכים מקומיים + איזה תרגום כל entity שייך אליו
    const [enhancementLocalValues, setEnhancementLocalValues] = useState<Record<string, any>>({});
    const [enhancementChangedIds, setEnhancementChangedIds] = useState<Set<string>>(new Set());
    const [enhancementTranslationIds, setEnhancementTranslationIds] = useState<Record<string, string>>({});

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
        cohanim: false,
        hazan: false,
        minyan: false,
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
            cohanim: false,
            hazan: false,
            minyan: false,
            role: "",
            reference: "",
            specialSign: "",
            dateSetId: "",
        });
        setPendingDeletes([]);
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

    /** טוען פריטי מקטע + enhancements + גבולות מהמקטעים הסמוכים (במקביל) */
    const fetchItemsWithEnhancements = async (partId: string) => {
        if (!currentTranslationData || !selectedPrayerId || !currentTocData)
            return;
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

            setAllItems(result.sorted);
            setBaseItems(result.baseItems ?? []);
            setEnhancements(result.enhancementsMap);
            setLocalValues(result.initialValues);
            setNeighborBounds(bounds);
            setSelectedGroupId(partId);
            setChangedIds(new Set());
            setEnhancementLocalValues({});
            setEnhancementChangedIds(new Set());
            setEnhancementTranslationIds({});

            // שמירת snapshot של ערכי הפריטים לפני עריכה (לחישוב diff ביומן)
            const origMap: Record<string, any> = {};
            result.sorted.forEach((item) => { origMap[item.id] = { ...item.values }; });
            setOriginalValues(origMap);
            const origEnhMap: Record<string, any> = {};
            Object.values(result.enhancementsMap).flat().forEach((e) => { origEnhMap[e.id] = { ...e.values }; });
            setOriginalEnhancementValues(origEnhMap);
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
                        },
                        details: {
                            deletedItemId: itemId,
                            deletedEntityId: entity.id,
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
                        },
                        details: {
                            deletedItemId: itemId,
                            deletedEntityId: entity.id,
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
                appendChangeLog({
                    timestamp: now,
                    action: "save_part_items",
                    context: {
                        tocId: selectedTocId,
                        translationId: currentTranslationData.translationId,
                        prayerId: selectedPrayerId,
                        partId: selectedGroupId,
                    },
                    details: {
                        fieldChanges: Array.from(byEntity.entries()).map(([entityId, row]) => ({
                            entityId,
                            itemId: row.itemId,
                            mitId: row.mitId,
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
                context: { tocId: selectedTocId },
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

        return mitIdBetween(idBefore ?? undefined, idAfter ?? undefined);
    };

    /**
     * מחשב itemId לפריט חדש במיקום index – ערך "בין" שני שכנים + ייחודיות.
     * בקצוות הרשימה (index=0 או index=allItems.length) נעזרים ב-neighborBounds
     * כדי לא ליפול ל-"0" כשהמקטע ריק או כשמוסיפים לפני/אחרי כל הפריטים.
     */
    const computeItemIdForIndex = (index: number): string => {
        const itemIdBefore =
            index > 0
                ? getEffectiveItemId(allItems[index - 1])
                : (neighborBounds.prevLastItemId ?? null);
        const itemIdAfter =
            index < allItems.length
                ? getEffectiveItemId(allItems[index])
                : (neighborBounds.nextFirstItemId ?? null);
        const existingIds = new Set(
            allItems.map((i) => getEffectiveItemId(i)).filter((id) => id !== "")
        );
        let candidate = mitIdBetween(itemIdBefore || undefined, itemIdAfter || undefined);
        while (existingIds.has(candidate)) {
            candidate = String((Number(candidate) || 0) + 1);
        }
        return candidate;
    };

    /** מוסיף פריט חדש (מזהה new_xxx מקומי) במקום index; עם dateSetId אופציונלי (אחרי בחירה במודל) */
    const doAddNewItemAt = (index: number, dateSetId: string) => {
        const newEntityId = `new_${Date.now()}`;
        const computedItemId = computeItemIdForIndex(index);
        const newItemValues: Record<string, any> = {
            content: "",
            type: "body",
            partId: selectedGroupId,
            itemId: computedItemId,
            mit_id: computeMitIdForIndex(index),
            timestamp: Date.now(),
        };
        if (dateSetId) newItemValues.dateSetId = dateSetId;
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

    /** מוסיף פריט הוראה חדש; עם dateSetId אופציונלי */
    const doAddNewInstructionAt = (index: number, dateSetId: string) => {
        const newEntityId = `new_${Date.now()}`;
        const computedItemId = computeItemIdForIndex(index);
        const newItemValues: Record<string, any> = {
            content: "",
            type: "instructions",
            partId: selectedGroupId,
            itemId: computedItemId,
            mit_id: computeMitIdForIndex(index),
            timestamp: Date.now(),
        };
        if (dateSetId) newItemValues.dateSetId = dateSetId;
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

    /** פותח מודל בחירת/הגדרת dateSetId ואז מוסיף מקטע במיקום index */
    const addNewItemAt = (index: number) => {
        setPendingAddKind("part");
        setPendingAddIndex(index);
        setDateSetIdModalOpen(true);
    };

    /** פותח מודל בחירת/הגדרת dateSetId ואז מוסיף הוראה במיקום index */
    const addNewInstructionAt = (index: number) => {
        setPendingAddKind("instruction");
        setPendingAddIndex(index);
        setDateSetIdModalOpen(true);
    };

    const closeDateSetIdModal = () => {
        setDateSetIdModalOpen(false);
        setPendingAddKind(null);
        setPendingEditEntityId(null);
        setDateSetIdInitialForEdit(undefined);
    };

    const onDateSetIdSelected = (dateSetId: string) => {
        if (pendingAddKind === "part") {
            doAddNewItemAt(pendingAddIndex, dateSetId);
        } else if (pendingAddKind === "instruction") {
            doAddNewInstructionAt(pendingAddIndex, dateSetId);
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
        cohanim: false,
        hazan: false,
        minyan: false,
        role: "",
        reference: "",
        specialSign: "",
        dateSetId: "",
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

    /** טוען פריטי המקטע בתרגום היעד שמקושרים לפריט הבסיס – לקביעת מיקום */
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
            const linked = partItems.filter((e: any) => {
                const link = e.values?.linkedItem;
                return Array.isArray(link) ? link.includes(baseItemId) : link === baseItemId;
            });
            setAddTranslationTargetLinkedItems(linked);
        } catch (err) {
            console.error(`${LOG_PREFIX} Load target part items failed`, err);
            setAddTranslationTargetLinkedItems([]);
        }
    };

    /** שומר את פריט התרגום החדש וסוגר את המודל */
    const submitAddTranslation = async () => {
        if (
            !addTranslationBaseItem ||
            !addTranslationTargetId ||
            !selectedPrayerId ||
            !selectedGroupId ||
            !currentTocData?.translations?.some((t: any) => t.translationId === addTranslationTargetId)
        )
            return;
        const baseItemId = getEffectiveItemId(addTranslationBaseItem);
        if (!baseItemId) return;
        const form = addTranslationForm;
        setSaving(true);
        try {
            const { newItemId, newMitId } = await createTranslationItem(dataSource, {
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
                dateSetId: form.dateSetId,
            });
            appendChangeLog({
                timestamp: Date.now(),
                action: "create_translation_item",
                context: {
                    tocId: selectedTocId,
                    translationId: addTranslationTargetId,
                    prayerId: selectedPrayerId,
                    partId: selectedGroupId,
                },
                details: {
                    newItemId,
                    newMitId,
                    baseItemId,
                    targetTranslationId: addTranslationTargetId,
                },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "תרגום נוסף בהצלחה" });
            closeAddTranslation();
            if (selectedGroupId) await fetchItemsWithEnhancements(selectedGroupId);
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
        lastAddedItemId,
        handleDeleteItem,
        handleRestoreItem,
        enhancementLocalValues,
        enhancementChangedIds,
        enhancementTranslationIds,
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
        dateSetIdModalOpen,
        closeDateSetIdModal,
        onDateSetIdSelected,
        dateSetIdModalTitle:
            pendingAddKind === "part"
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
