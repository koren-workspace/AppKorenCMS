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
     * מוסיף תרגום לנוסח הנבחר: יוצר מסמך ב-collection "translations" ומעדכן את מערך translations במסמך ה-TOC.
     * מזהה התרגום מתחיל בנוסח (למשל 0-ashkenaz, 1-ashkenaz). מציע מזהה הבא; המשתמש יכול לאשר או לערוך.
     */
    const addTranslation = async (translationId: string) => {
        const id = translationId?.trim();
        if (!id || !selectedTocId || !currentTocData) return;
        try {
            await dataSource.saveEntity({
                path: "translations",
                entityId: id,
                values: {},
                status: "new",
                collection: baseColl,
            });
            const newEntry = { translationId: id, categories: [] as any[] };
            const updatedTranslations = [...(currentTocData.translations ?? []), newEntry];
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
            snackbar.open({ type: "success", message: "תרגום נוסף בהצלחה" });
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

    /** מוסיף קטגוריה לתרגום הנבחר (בתוך toc.translations[index].categories); קטגוריה = { id, name, prayers: [] } */
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
        const updatedCategories = [...(trans.categories ?? []), newCategory];
        const updatedTranslations = currentTocData.translations.map((t: any, i: number) =>
            i === idx ? { ...t, categories: updatedCategories } : t
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

    /** מוחק קטגוריה מהתרגום הנבחר (לפי id) */
    const deleteCategory = async (categoryId: string) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !currentTocData?.translations?.length
        )
            return;
        const idx = selectedTranslationIndex;
        const trans = currentTocData.translations[idx];
        if (!trans?.categories) return;
        const updatedCategories = trans.categories.filter((c: any) => c.id !== categoryId);
        const updatedTranslations = currentTocData.translations.map((t: any, i: number) =>
            i === idx ? { ...t, categories: updatedCategories } : t
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
            const deletedWasSelected =
                currentCategories?.some((c: any) => c.id === categoryId);
            if (deletedWasSelected) {
                setSelectedCategoryName(null);
                setSelectedPrayerId(null);
            } else {
                const stillSelected = currentCategories?.find(
                    (c: any) => c.name === selectedCategoryName
                );
                if (!stillSelected) setSelectedCategoryName(null);
            }
            snackbar.open({ type: "success", message: "קטגוריה נמחקה" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete category failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת קטגוריה" });
        }
    };

    /**
     * מוסיף תפילה ב-2 מקומות: (1) ב-TOC – בקטגוריה הנבחרת (translations[].categories[].prayers),
     * (2) ב-Firestore – מסמך חדש תחת translations/{translationId}/prayers/{prayerId} עם nusach, tefilaId, timestamp, translationId, type.
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
        const updatedCategories = (trans.categories ?? []).map((c: any) =>
            c.name === selectedCategoryName
                ? { ...c, prayers: [...(c.prayers ?? []), newPrayer] }
                : c
        );
        const updatedTranslations = currentTocData.translations.map((t: any, i: number) =>
            i === transIdx ? { ...t, categories: updatedCategories } : t
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
     * מוחק תפילה מ-2 מקומות: (1) מוציא מ-TOC מהקטגוריה הרלוונטית, (2) מוחק מסמך translations/{translationId}/prayers/{prayerId}.
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
        const transIdx = selectedTranslationIndex;
        const trans = currentTocData.translations[transIdx];
        const updatedCategories = (trans.categories ?? []).map((c: any) => ({
            ...c,
            prayers: (c.prayers ?? []).filter((p: any) => p.id !== prayerId),
        }));
        const updatedTranslations = currentTocData.translations.map((t: any, i: number) =>
            i === transIdx ? { ...t, categories: updatedCategories } : t
        );
        try {
            const prayerPath = `translations/${currentTranslationData.translationId}/prayers`;
            const prayersList = await dataSource.fetchCollection({
                path: prayerPath,
                collection: baseColl,
            });
            const prayerEntity = prayersList.find((e) => e.id === prayerId);
            if (prayerEntity) await dataSource.deleteEntity({ entity: prayerEntity });
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
            snackbar.open({ type: "success", message: "תפילה נמחקה" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete prayer failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת תפילה" });
        }
    };

    /** מוחק תרגום: מוציא מהמערך במסמך ה-TOC ומוחק את המסמך ב-collection "translations" */
    const deleteTranslation = async (translationId: string) => {
        if (!selectedTocId || !currentTocData) return;
        const updated = (currentTocData.translations ?? []).filter(
            (t: any) => t.translationId !== translationId
        );
        try {
            const tocEntity = tocItems.find((t) => t.id === selectedTocId);
            if (!tocEntity) return;
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updated },
                status: "existing",
                collection: baseColl,
            });
            const transList = await dataSource.fetchCollection({
                path: "translations",
                collection: baseColl,
            });
            const transEntity = transList.find((e) => e.id === translationId);
            if (transEntity) await dataSource.deleteEntity({ entity: transEntity });
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
