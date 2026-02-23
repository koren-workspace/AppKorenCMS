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
    savePartItems,
    publishToBagel,
} from "../services/partEditService";

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
    const [enhancements, setEnhancements] = useState<
        Record<string, Entity<any>[]>
    >({});
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // איפוס אזור העריכה כשמחליפים TOC / תרגום / תפילה
    useEffect(() => {
        setSelectedGroupId(null);
        setAllItems([]);
        setLocalValues({});
        setEnhancements({});
        setChangedIds(new Set());
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
            setEnhancements(result.enhancementsMap);
            setLocalValues(result.initialValues);
            setSelectedGroupId(partId);
            setChangedIds(new Set());
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

    /** שומר את כל הפריטים שסומנו כ־changed; אם יש פריטים חדשים – טוען מחדש את המקטע */
    const handleSaveGroup = async () => {
        if (!currentTranslationData || changedIds.size === 0) return;
        setSaving(true);
        const path = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
        const changedIdList = Array.from(changedIds);
        const hasNewItems = changedIdList.some((id) => id.startsWith("new_"));
        try {
            await savePartItems(dataSource, {
                path,
                changedIds: changedIdList,
                localValues,
            });
            snackbar.open({
                type: "success",
                message: "המקטע נשמר בהצלחה (מקומי)",
            });
            setChangedIds(new Set());
            if (hasNewItems && selectedGroupId) {
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
            console.error(`${LOG_PREFIX} Publish failed`, err);
            snackbar.open({
                type: "error",
                message: "נכשל הפרסום ל-Bagel",
            });
        } finally {
            setSaving(false);
        }
    };

    /** מוסיף פריט חדש (מזהה new_xxx) במקום index; מסומן אוטומטית כ־changed */
    const addNewItemAt = (index: number) => {
        const newId = `new_${Date.now()}`;
        const newItemValues = {
            content: "",
            type: "body",
            partId: selectedGroupId,
            itemId: newId,
            mit_id: "",
            timestamp: Date.now(),
        };
        const updated = [...allItems];
        updated.splice(index, 0, {
            id: newId,
            values: newItemValues,
        } as any);
        setAllItems(updated);
        setLocalValues((prev) => ({ ...prev, [newId]: newItemValues }));
        setChangedIds((prev) => new Set(prev).add(newId));
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
        handleSaveGroup,
        handleFinalPublish,
        addNewItemAt,
    };
}
