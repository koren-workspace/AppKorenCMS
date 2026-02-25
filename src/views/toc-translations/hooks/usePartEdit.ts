/**
 * usePartEdit – Hook לעריכת מקטע (part)
 *
 * תפקיד:
 *   - טוען פריטי המקטע הנבחר + "תרגומים מקושרים" (enhancements) משאר התרגומים (דרך partEditService)
 *   - שומר עריכות מקומית (localValues, changedIds) עד ללחיצה על "שמור מקטע"
 *   - שמירה: שומר רק פריטים ששונו ל-Firestore (savePartItems)
 *   - פרסום: מעדכן db-update-time וקורא ל-Bagel (publishToBagel)
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
    publishToBagel,
    deletePartItemAndRelatedTranslations,
    createTranslationItem,
} from "../services/partEditService";
import { isBaseTranslation } from "../services/navigationService";
import { mitIdBetween } from "../utils/itemUtils";

/** הקשר הניווט – מועבר מ-useTocNavigation כדי לדעת איזה תרגום/תפילה נבחרו */
export type PartEditContext = {
    currentTocData: any;
    currentTranslationData: any;
    selectedPrayerId: string | null;
    selectedTocId: string | null;
};

const LOG_PREFIX = "[TocTranslations]";

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
    const [enhancements, setEnhancements] = useState<
        Record<string, Entity<any>[]>
    >({});
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    /** מזהה הפריט שנוסף לאחרונה – להעברת פוקוס (מנוקה אחרי זמן קצר) */
    const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

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
    }, [currentTocData, currentTranslationData, selectedPrayerId]);

    /** טוען פריטי מקטע + enhancements ומעדכן את כל state העריכה */
    const fetchItemsWithEnhancements = async (partId: string) => {
        if (!currentTranslationData || !selectedPrayerId || !currentTocData)
            return;
        setLoading(true);
        try {
            const result = await fetchPartWithEnhancements(dataSource, {
                translationId: currentTranslationData.translationId,
                selectedPrayerId,
                partId,
                translations: currentTocData.translations ?? [],
                currentTranslationId: currentTranslationData.translationId,
            });
            setAllItems(result.sorted);
            setBaseItems(result.baseItems ?? []);
            setEnhancements(result.enhancementsMap);
            setLocalValues(result.initialValues);
            setSelectedGroupId(partId);
            setChangedIds(new Set());
            setEnhancementLocalValues({});
            setEnhancementChangedIds(new Set());
            setEnhancementTranslationIds({});
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

    /** שומר את כל הפריטים שסומנו כ־changed ואת שינויי התרגומים המקושרים; אם יש פריטים חדשים – טוען מחדש */
    const handleSaveGroup = async () => {
        if (!currentTranslationData || (changedIds.size === 0 && enhancementChangedIds.size === 0)) return;
        setSaving(true);
        const path = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
        const changedIdList = Array.from(changedIds);
        const hasNewItems = changedIdList.some((id) => id.startsWith("new_"));
        const hadEnhancementChanges = enhancementChangedIds.size > 0;
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
            snackbar.open({
                type: "success",
                message: "המקטע נשמר בהצלחה (מקומי)",
            });
            setChangedIds(new Set());
            if ((hasNewItems || hadEnhancementChanges) && selectedGroupId) {
                await fetchItemsWithEnhancements(selectedGroupId);
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} Save failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בשמירה" });
        } finally {
            setSaving(false);
        }
    };

    /** מעדכן זמן עדכון ב-DB וקורא ל-Bagel – מפעיל סנכרון באפליקציה */
    const handleFinalPublish = async () => {
        if (!selectedTocId) return;
        setSaving(true);
        try {
            await publishToBagel(dataSource, selectedTocId);
            snackbar.open({
                type: "success",
                message: "השינויים פורסמו בהצלחה לאפליקציה!",
            });
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

    /** מוחק פריט מקטע ואת כל התרגומים המקושרים אליו (linkedItem); מרענן את הרשימה */
    const handleDeleteItem = async (item: Entity<any>, itemId: string) => {
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
        setSaving(true);
        try {
            const isBase = isBaseTranslation(currentTranslationData.translationId);
            if (isBase) {
                await deletePartItemAndRelatedTranslations(dataSource, {
                    itemEntity: item,
                    itemId,
                    currentTranslationId: currentTranslationData.translationId,
                    selectedPrayerId,
                    translations: currentTocData.translations,
                });
                snackbar.open({
                    type: "success",
                    message: "המקטע וכל התרגומים המקושרים נמחקו",
                });
            } else {
                await dataSource.saveEntity({
                    path: item.path,
                    entityId: item.id,
                    values: { ...item.values, deleted: true, timestamp: Date.now() },
                    status: "existing",
                });
                snackbar.open({
                    type: "success",
                    message: "המקטע נמחק (תרגום זה בלבד)",
                });
            }
            if (selectedGroupId) {
                await fetchItemsWithEnhancements(selectedGroupId);
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete part item failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת מקטע" });
        } finally {
            setSaving(false);
        }
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
     */
    const computeMitIdForIndex = (index: number): string => {
        let idBefore: string | null = null;
        let idAfter: string | null | undefined = undefined;

        if (index > 0) {
            const itemAbove = allItems[index - 1];
            const aboveInTranslation = getEffectiveMitId(itemAbove);
            const aboveInBase = getMitIdForPosition(itemAbove);
            idBefore = baseItems.length > 0 ? maxMitId(aboveInTranslation, aboveInBase) : aboveInBase;
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

        return mitIdBetween(idBefore ?? undefined, idAfter ?? undefined);
    };

    /**
     * מחשב itemId לפריט חדש במיקום index – כמו קטגוריות/תפילות: ערך "בין" שני שכנים + ייחודיות.
     * משמש גם למיון (אם ממיינים לפי itemId) וגם כמזהה ייחודי לקישור (linkedItem).
     */
    const computeItemIdForIndex = (index: number): string => {
        const itemIdBefore = index > 0 ? getEffectiveItemId(allItems[index - 1]) : null;
        const itemIdAfter = index < allItems.length ? getEffectiveItemId(allItems[index]) : null;
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
            await createTranslationItem(dataSource, {
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
    };
}
