/**
 * useTocNavigation – Hook לניווט במבנה ה-TOC
 *
 * תפקיד:
 *   - טוען את רשימת הנוסחים (TOC) מה-collection "toc"
 *   - שומר את הבחירות: נוסח נבחר, תרגום, קטגוריה, תפילה (מקטע נבחר מגיע מ-usePartEdit)
 *   - מחשב מתוך הנתונים: currentTocData, currentTranslationData, currentCategories,
 *     currentPrayers, currentParts (להצגה בעמודות הניווט)
 *
 * כל בחירה "מתחת" מאפסת את הבחירות שמתחתיה (למשל בחירת תרגום מאפסת קטגוריה ותפילה).
 */

import { useEffect, useMemo, useState } from "react";
import { useDataSource, useSnackbarController, Entity } from "@firecms/cloud";
import {
    getPrayerCategoriesFromTranslation,
    getPrayersForCategory,
    getPartsForPrayer,
} from "../services/navigationService";
import { baseColl } from "../collections";

const LOG_PREFIX = "[TocTranslations]";

/** מרווח ברירת מחדל כשאין "אחרי" (הוספה בסוף) או אין "לפני" (הוספה בהתחלה) */
const DEFAULT_ID_GAP = 10;

/**
 * מחשב ID חדש בין idBefore ל-idAfter (חצי ביניהם).
 * אם יש רק לפני – מחזיר לפני + GAP (הוספה בסוף).
 * אם יש רק אחרי – מחזיר אחרי − GAP (הוספה בהתחלה).
 * אם אין אף אחד – מחזיר ערך התחלתי.
 */
function midIdBetween(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined
): string {
    const before = idBefore != null ? Number(idBefore) : NaN;
    const after = idAfter != null ? Number(idAfter) : NaN;
    if (!Number.isNaN(before) && !Number.isNaN(after)) {
        const mid = (before + after) / 2;
        return mid === Math.floor(mid) ? String(Math.floor(mid)) : String(mid);
    }
    if (!Number.isNaN(before)) return String(before + DEFAULT_ID_GAP);
    if (!Number.isNaN(after)) return String(after - DEFAULT_ID_GAP);
    return "1000000";
}

export function useTocNavigation() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    // —— State: רשימת הנוסחים + הבחירות בשרשרת הניווט ——
    const [tocItems, setTocItems] = useState<Entity<any>[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);

    // טעינת רשימת הנוסחים (TOC) בעת עליית המסך
    useEffect(() => {
        dataSource
            .fetchCollection({ path: "toc", collection: baseColl })
            .then(setTocItems)
            .catch((error) => {
                console.error(`${LOG_PREFIX} TOC fetch failed`, error);
                snackbar.open({ type: "error", message: "שגיאה בטעינת רשימת נוסחים" });
            });
    }, [dataSource, snackbar]);

    // —— נתונים נגזרים: מחפשים במבנה לפי הבחירות ——
    const currentTocData = useMemo(
        () => tocItems.find((t) => t.id === selectedTocId)?.values as any,
        [tocItems, selectedTocId]
    );
    const currentTranslationData = useMemo(
        () => currentTocData?.translations?.[selectedTranslationIndex ?? -1],
        [currentTocData, selectedTranslationIndex]
    );
    const currentCategories = useMemo(
        () => getPrayerCategoriesFromTranslation(currentTranslationData),
        [currentTranslationData]
    );
    const currentPrayers = useMemo(
        () => getPrayersForCategory(currentCategories, selectedCategoryName),
        [currentCategories, selectedCategoryName]
    );
    const currentParts = useMemo(
        () => getPartsForPrayer(currentCategories, selectedPrayerId),
        [currentCategories, selectedPrayerId]
    );

    // —— Handlers: בחירה בכל רמה מאפסת את הרמות שמתחתיה ——
    const onSelectToc = (tocId: string) => {
        setSelectedTocId(tocId);
        setSelectedTranslationIndex(null);
        setSelectedCategoryName(null);
        setSelectedPrayerId(null);
    };

    const onSelectTranslation = (index: number) => {
        setSelectedTranslationIndex(index);
        setSelectedCategoryName(null);
        setSelectedPrayerId(null);
    };

    const onSelectCategory = (categoryName: string) => {
        setSelectedCategoryName(categoryName);
        setSelectedPrayerId(null);
    };

    const onSelectPrayer = (prayerId: string) => {
        setSelectedPrayerId(prayerId);
    };

    /** יוצר נוסח (TOC) חדש ב-collection "toc". מקבל שם מהמשתמש; id המסמך = השם ללא רווחים (תחתיים). */
    const addToc = async (nusachName: string) => {
        const name = nusachName?.trim();
        if (!name) return;
        const newId = name.replace(/\s+/g, "_");
        const values = {
            nusach: name,
            timestamp: Date.now(),
            translations: [] as any[],
        };
        try {
            const saved = await dataSource.saveEntity({
                path: "toc",
                entityId: newId,
                values,
                status: "new",
                collection: baseColl,
            });
            snackbar.open({ type: "success", message: "נוסח חדש נוצר בהצלחה" });
            setTocItems((prev) => [...prev, saved]);
            setSelectedTocId(newId);
            setSelectedTranslationIndex(null);
            setSelectedCategoryName(null);
            setSelectedPrayerId(null);
        } catch (err) {
            console.error(`${LOG_PREFIX} Add TOC failed`, err);
            snackbar.open({ type: "error", message: "שגיאה ביצירת נוסח" });
        }
    };

    /**
     * מוסיף תרגום לנוסח הנבחר: יוצר מסמך ב-collection "translations", מעתיק קטגוריות ותפילות
     * מהנוסח הבסיסי (0-*) לאותו נוסח, ומעדכן את מערך translations במסמך ה-TOC.
     * מזהה התרגום מתחיל בנוסח (למשל 0-ashkenaz, 1-ashkenaz).
     */
    const addTranslation = async (translationId: string) => {
        const id = translationId?.trim();
        if (!id || !selectedTocId || !currentTocData) return;
        const baseTranslation = (currentTocData.translations ?? []).find(
            (t: any) => String(t.translationId ?? "").startsWith("0-")
        );
        const categories =
            baseTranslation?.categories?.length > 0
                ? JSON.parse(JSON.stringify(baseTranslation.categories))
                : [];
        const newEntry = { translationId: id, categories };
        const updatedTranslations = [...(currentTocData.translations ?? []), newEntry];
        try {
            await dataSource.saveEntity({
                path: "translations",
                entityId: id,
                values: {},
                status: "new",
                collection: baseColl,
            });
            const tocEntity = tocItems.find((t) => t.id === selectedTocId);
            if (!tocEntity) return;
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations } }
                        : t
                )
            );
            snackbar.open({
                type: "success",
                message: categories.length > 0
                    ? `תרגום נוסף בהצלחה (הועתקו ${categories.length} קטגוריות מהנוסח הבסיסי)`
                    : "תרגום נוסף בהצלחה",
            });
            setSelectedTranslationIndex(updatedTranslations.length - 1);
            setSelectedCategoryName(null);
            setSelectedPrayerId(null);
        } catch (err) {
            console.error(`${LOG_PREFIX} Add translation failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהוספת תרגום" });
        }
    };

    /** מחזיר מזהה מוצע לתרגום חדש: המספר הבא בנוסח הנבחר (למשל 0-ashkenaz, 1-ashkenaz → 2-ashkenaz) */
    const getSuggestedTranslationId = (): string => {
        if (!selectedTocId || !currentTocData?.translations?.length) return `${0}-${selectedTocId}`;
        const existing = currentTocData.translations.map((t: any) => t.translationId).filter(Boolean);
        const regex = new RegExp(`^(\\d+)-${selectedTocId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(-.*)?$`);
        let maxIndex = -1;
        for (const id of existing) {
            const m = id.match(regex);
            if (m) maxIndex = Math.max(maxIndex, parseInt(m[1], 10));
        }
        return `${maxIndex + 1}-${selectedTocId}`;
    };

    /** מוסיף קטגוריה: בנוסח הבסיסי (0-*) מוסיף לכל התרגומים באותו נוסח; אחרת רק לתרגום הנבחר. קטגוריה = { id, name, prayers: [] } */
    const addCategory = async (categoryName: string) => {
        const name = categoryName?.trim();
        if (
            !name ||
            selectedTocId == null ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !currentTocData?.translations?.length
        )
            return;
        const idx = selectedTranslationIndex;
        const trans = currentTocData.translations[idx];
        if (!trans) return;
        const newCategory = { id: String(Date.now()), name, prayers: [] as any[] };
        const isBase = String(trans.translationId ?? "").startsWith("0-");
        const updatedTranslations = isBase
            ? currentTocData.translations.map((t: any) => ({
                  ...t,
                  categories: [...(t.categories ?? []), newCategory],
              }))
            : currentTocData.translations.map((t: any, i: number) =>
                  i === idx ? { ...t, categories: [...(t.categories ?? []), newCategory] } : t
              );
        try {
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations } }
                        : t
                )
            );
            snackbar.open({ type: "success", message: "קטגוריה נוספה" });
            setSelectedCategoryName(null);
            setSelectedPrayerId(null);
        } catch (err) {
            console.error(`${LOG_PREFIX} Add category failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהוספת קטגוריה" });
        }
    };

    /** מוחק קטגוריה: רק בנוסח הבסיסי (0-*). מוציא את הקטגוריה מכל התרגומים ב-TOC ומוחק מסמכי תפילות (ופריטים) בכל תרגום. */
    const deleteCategory = async (categoryId: string) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !currentTocData?.translations?.length ||
            !currentTranslationData?.translationId
        )
            return;
        const trans = currentTocData.translations[selectedTranslationIndex];
        if (!trans?.categories) return;
        const isBase = String(trans.translationId ?? "").startsWith("0-");
        if (!isBase) return;
        const categoryToDelete = trans.categories.find((c: any) => c.id === categoryId);
        const prayerIds = categoryToDelete ? (categoryToDelete.prayers ?? []).map((p: any) => p.id) : [];
        const updatedTranslations = currentTocData.translations.map((t: any) => ({
            ...t,
            categories: (t.categories ?? []).filter((c: any) => c.id !== categoryId),
        }));
        try {
            for (const t of currentTocData.translations ?? []) {
                const tid = t.translationId;
                if (!tid) continue;
                const prayersPath = `translations/${tid}/prayers`;
                for (const prayerId of prayerIds) {
                    const itemsPath = `${prayersPath}/${prayerId}/items`;
                    try {
                        const itemsList = await dataSource.fetchCollection({
                            path: itemsPath,
                            collection: baseColl,
                        });
                        for (const item of itemsList) await dataSource.deleteEntity({ entity: item });
                    } catch (_) {}
                    try {
                        const prayersList = await dataSource.fetchCollection({
                            path: prayersPath,
                            collection: baseColl,
                        });
                        const prayerEntity = prayersList.find((e: any) => e.id === prayerId);
                        if (prayerEntity) await dataSource.deleteEntity({ entity: prayerEntity });
                    } catch (_) {}
                }
            }
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations } }
                        : t
                )
            );
            const deletedWasSelected = currentCategories?.some((c: any) => c.id === categoryId);
            if (deletedWasSelected) {
                setSelectedCategoryName(null);
                setSelectedPrayerId(null);
            } else {
                const stillSelected = currentCategories?.find(
                    (c: any) => c.name === selectedCategoryName
                );
                if (!stillSelected) setSelectedCategoryName(null);
            }
            snackbar.open({ type: "success", message: "קטגוריה נמחקה מכל התרגומים" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete category failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת קטגוריה" });
        }
    };

    /**
     * מוסיף תפילה: בנוסח הבסיסי (0-*) מוסיף את התפילה לאותה קטגוריה (לפי שם) בכל התרגומים באותו נוסח ב-TOC;
     * מסמך Firestore נוצר רק עבור הנוסח הבסיסי. אחרת רק בתרגום הנבחר.
     */
    const addPrayer = async (prayerName: string) => {
        const name = prayerName?.trim();
        if (
            !name ||
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedCategoryName ||
            !currentTocData?.translations?.length ||
            !currentTranslationData?.translationId
        )
            return;
        const transIdx = selectedTranslationIndex;
        const trans = currentTocData.translations[transIdx];
        const category = (trans.categories ?? []).find(
            (c: any) => c.name === selectedCategoryName
        );
        if (!category) return;
        const prayers = category.prayers ?? [];
        const lastPrayer = prayers[prayers.length - 1];
        const newPrayerId = midIdBetween(lastPrayer?.id, undefined);
        const newPrayer = { id: newPrayerId, name, parts: [] as any[] };
        const isBase = String(currentTranslationData.translationId ?? "").startsWith("0-");
        const updatedTranslations = isBase
            ? currentTocData.translations.map((t: any) => ({
                  ...t,
                  categories: (t.categories ?? []).map((c: any) =>
                      c.name === selectedCategoryName
                          ? { ...c, prayers: [...(c.prayers ?? []), newPrayer] }
                          : c
                  ),
              }))
            : currentTocData.translations.map((t: any, i: number) =>
                  i === transIdx
                      ? {
                            ...t,
                            categories: (t.categories ?? []).map((c: any) =>
                                c.name === selectedCategoryName
                                    ? { ...c, prayers: [...(c.prayers ?? []), newPrayer] }
                                    : c
                            ),
                        }
                      : t
              );
        const prayerPath = `translations/${currentTranslationData.translationId}/prayers`;
        try {
            await dataSource.saveEntity({
                path: prayerPath,
                entityId: newPrayerId,
                values: {
                    nusach: selectedTocId,
                    tefilaId: newPrayerId,
                    timestamp: Date.now(),
                    translationId: currentTranslationData.translationId,
                    type: name,
                },
                status: "new",
                collection: baseColl,
            });
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations } }
                        : t
                )
            );
            snackbar.open({ type: "success", message: "תפילה נוספה" });
            setSelectedPrayerId(null);
        } catch (err) {
            console.error(`${LOG_PREFIX} Add prayer failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהוספת תפילה" });
        }
    };

    /**
     * מוחק תפילה: רק בנוסח הבסיסי (0-*). מוציא את התפילה מכל התרגומים ב-TOC ומוחק מסמך התפילה (ופריטים) בכל תרגום.
     */
    const deletePrayer = async (prayerId: string) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !currentTocData?.translations?.length ||
            !currentTranslationData?.translationId
        )
            return;
        const trans = currentTocData.translations[selectedTranslationIndex];
        const isBase = String(trans?.translationId ?? "").startsWith("0-");
        if (!isBase) return;
        const updatedTranslations = currentTocData.translations.map((t: any) => ({
            ...t,
            categories: (t.categories ?? []).map((c: any) => ({
                ...c,
                prayers: (c.prayers ?? []).filter((p: any) => p.id !== prayerId),
            })),
        }));
        try {
            for (const t of currentTocData.translations ?? []) {
                const tid = t.translationId;
                if (!tid) continue;
                const prayersPath = `translations/${tid}/prayers`;
                const itemsPath = `${prayersPath}/${prayerId}/items`;
                try {
                    const itemsList = await dataSource.fetchCollection({
                        path: itemsPath,
                        collection: baseColl,
                    });
                    for (const item of itemsList) await dataSource.deleteEntity({ entity: item });
                } catch (_) {}
                try {
                    const prayersList = await dataSource.fetchCollection({
                        path: prayersPath,
                        collection: baseColl,
                    });
                    const prayerEntity = prayersList.find((e: any) => e.id === prayerId);
                    if (prayerEntity) await dataSource.deleteEntity({ entity: prayerEntity });
                } catch (_) {}
            }
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations } }
                        : t
                )
            );
            if (selectedPrayerId === prayerId) setSelectedPrayerId(null);
            snackbar.open({ type: "success", message: "תפילה נמחקה מכל התרגומים" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete prayer failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת תפילה" });
        }
    };

    /** מוחק תרגום: מוחק את כל המסמכים תחת התרגום (items, prayers), את מסמך התרגום ב-translations, ומוציא מהמערך ב-TOC */
    const deleteTranslation = async (translationId: string) => {
        if (!selectedTocId || !currentTocData) return;
        const updated = (currentTocData.translations ?? []).filter(
            (t: any) => t.translationId !== translationId
        );
        try {
            const prayersPath = `translations/${translationId}/prayers`;
            const prayersList = await dataSource.fetchCollection({
                path: prayersPath,
                collection: baseColl,
            });
            for (const prayer of prayersList) {
                const itemsPath = `${prayersPath}/${prayer.id}/items`;
                const itemsList = await dataSource.fetchCollection({
                    path: itemsPath,
                    collection: baseColl,
                });
                for (const item of itemsList) {
                    await dataSource.deleteEntity({ entity: item });
                }
                await dataSource.deleteEntity({ entity: prayer });
            }
            const transList = await dataSource.fetchCollection({
                path: "translations",
                collection: baseColl,
            });
            const transEntity = transList.find((e) => e.id === translationId);
            if (transEntity) await dataSource.deleteEntity({ entity: transEntity });
            const tocEntity = tocItems.find((t) => t.id === selectedTocId);
            if (!tocEntity) return;
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updated },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updated } }
                        : t
                )
            );
            if (currentTranslationData?.translationId === translationId) {
                setSelectedTranslationIndex(null);
                setSelectedCategoryName(null);
                setSelectedPrayerId(null);
            } else {
                const newIndex = updated.findIndex(
                    (t: any) => t.translationId === currentTranslationData?.translationId
                );
                setSelectedTranslationIndex(newIndex >= 0 ? newIndex : null);
            }
            snackbar.open({ type: "success", message: "התרגום נמחק" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete translation failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת תרגום" });
        }
    };

    /** מוחק רק את מסמך הנוסח (TOC) ב-collection "toc"; לא נוגע בתרגומים */
    const deleteToc = async (tocId: string) => {
        const toc = tocItems.find((t) => t.id === tocId);
        if (!toc) return;
        try {
            // deleteEntity מצפה ל-{ entity } כאשר entity כולל path/reference (databaseId)
            await dataSource.deleteEntity({ entity: toc });
            snackbar.open({ type: "success", message: "הנוסח נמחק" });
            setTocItems((prev) => prev.filter((t) => t.id !== tocId));
            if (selectedTocId === tocId) {
                setSelectedTocId(null);
                setSelectedTranslationIndex(null);
                setSelectedCategoryName(null);
                setSelectedPrayerId(null);
            }
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete TOC failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת נוסח" });
        }
    };

    return {
        tocItems,
        selectedTocId,
        selectedTranslationIndex,
        selectedCategoryName,
        selectedPrayerId,
        currentTocData,
        currentTranslationData,
        currentCategories,
        currentPrayers,
        currentParts,
        onSelectToc,
        onSelectTranslation,
        onSelectCategory,
        onSelectPrayer,
        addToc,
        deleteToc,
        addTranslation,
        getSuggestedTranslationId,
        deleteTranslation,
        addCategory,
        deleteCategory,
        addPrayer,
        deletePrayer,
    };
}
