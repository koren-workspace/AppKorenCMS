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
    const [isSaving, setIsSaving] = useState(false);
    const [savingMessage, setSavingMessage] = useState<string | null>(null);

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
        setIsSaving(true);
        setSavingMessage("מוסיף נוסח...");
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
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
        setIsSaving(true);
        setSavingMessage("מוסיף תרגום...");
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
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

    /** מוסיף קטגוריה אחרי קטגוריה קיימת (או בסוף אם afterCategoryId null). ID = מקסימום מבין כל הקטגוריות + 10. בנוסח הבסיסי מעדכן את כל התרגומים. */
    const addCategory = async (categoryName: string, afterCategoryId: string | null) => {
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
        const isBase = String(trans.translationId ?? "").startsWith("0-");
        const allCategories = trans.categories ?? [];
        const maxId = allCategories.length
            ? Math.max(0, ...allCategories.map((c: any) => Number(c.id) || 0))
            : 0;
        const newCategoryId = String(maxId + 10);
        const newCategory = { id: newCategoryId, name, prayers: [] as any[] };
        const insertAt = (cats: any[]) => {
            if (afterCategoryId == null) return [...cats, newCategory];
            const i = cats.findIndex((c: any) => c.id === afterCategoryId);
            const pos = i >= 0 ? i + 1 : cats.length;
            return [...cats.slice(0, pos), newCategory, ...cats.slice(pos)];
        };
        const updatedTranslations = isBase
            ? currentTocData.translations.map((t: any) => ({
                  ...t,
                  categories: insertAt(t.categories ?? []),
              }))
            : currentTocData.translations.map((t: any, i: number) =>
                  i === idx ? { ...t, categories: insertAt(t.categories ?? []) } : t
              );
        setIsSaving(true);
        setSavingMessage("מוסיף קטגוריה...");
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
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
        setIsSaving(true);
        setSavingMessage("מוחק קטגוריה...");
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
                        for (const item of itemsList) await dataSource.saveEntity({ path: item.path, entityId: item.id, values: { ...item.values, deleted: true, timestamp: Date.now() }, status: "existing" });
                    } catch (_) {}
                    try {
                        const prayersList = await dataSource.fetchCollection({
                            path: prayersPath,
                            collection: baseColl,
                        });
                        const prayerEntity = prayersList.find((e: any) => e.id === prayerId);
                        if (prayerEntity) await dataSource.saveEntity({ path: prayerEntity.path, entityId: prayerEntity.id, values: { ...prayerEntity.values, deleted: true, timestamp: Date.now() }, status: "existing" });
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /**
     * מוסיף תפילה אחרי תפילה קיימת (או בסוף אם afterPrayerId null). ID מחושב בין המסמכים ב-prayers בנוסח הבסיסי, עם בדיקה שה-ID פנוי.
     * בנוסח הבסיסי מעדכן את כל התרגומים; מסמך Firestore נוצר רק בבסיס.
     */
    const addPrayer = async (prayerName: string, afterPrayerId: string | null) => {
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
        const isBase = String(currentTranslationData.translationId ?? "").startsWith("0-");
        const baseTrans = (currentTocData.translations ?? []).find((t: any) =>
            String(t.translationId ?? "").startsWith("0-")
        );
        const baseId = baseTrans?.translationId;
        let afterId = afterPrayerId;
        let nextId: string | undefined;
        if (afterId != null) {
            const idx = prayers.findIndex((p: any) => p.id === afterId);
            nextId = idx >= 0 && idx < prayers.length - 1 ? prayers[idx + 1]?.id : undefined;
        } else {
            afterId = prayers.length ? prayers[prayers.length - 1]?.id : undefined;
            nextId = undefined;
        }
        const prayersPath = baseId ? `translations/${baseId}/prayers` : null;
        let existingIds = new Set<string>();
        let allPrayerIds: string[] = [];
        if (prayersPath) {
            try {
                const list = await dataSource.fetchCollection({
                    path: prayersPath,
                    collection: baseColl,
                });
                list.forEach((e: any) => {
                    if (e.id != null) {
                        existingIds.add(e.id);
                        allPrayerIds.push(e.id);
                    }
                });
            } catch (_) {}
        }
        if (nextId == null && afterId != null) {
            const afterNum = Number(afterId);
            const nextInCollection = allPrayerIds
                .filter((id) => Number(id) > afterNum)
                .sort((a, b) => Number(a) - Number(b))[0];
            if (nextInCollection != null) nextId = nextInCollection;
        }
        let newPrayerId = midIdBetween(afterId ?? null, nextId ?? null);
        while (existingIds.has(newPrayerId)) {
            newPrayerId = String((Number(newPrayerId) || 0) + 1);
        }
        const newPrayer = { id: newPrayerId, name, parts: [] as any[] };
        const insertPrayerAt = (prayerList: any[]) => {
            if (afterPrayerId == null) return [...prayerList, newPrayer];
            const i = prayerList.findIndex((p: any) => p.id === afterPrayerId);
            const pos = i >= 0 ? i + 1 : prayerList.length;
            return [...prayerList.slice(0, pos), newPrayer, ...prayerList.slice(pos)];
        };
        const updatedTranslations = isBase
            ? currentTocData.translations.map((t: any) => ({
                  ...t,
                  categories: (t.categories ?? []).map((c: any) =>
                      c.name === selectedCategoryName
                          ? { ...c, prayers: insertPrayerAt(c.prayers ?? []) }
                          : c
                  ),
              }))
            : currentTocData.translations.map((t: any, i: number) =>
                  i === transIdx
                      ? {
                            ...t,
                            categories: (t.categories ?? []).map((c: any) =>
                                c.name === selectedCategoryName
                                    ? { ...c, prayers: insertPrayerAt(c.prayers ?? []) }
                                    : c
                            ),
                        }
                      : t
              );
        const prayerPath = `translations/${currentTranslationData.translationId}/prayers`;
        setIsSaving(true);
        setSavingMessage("מוסיף תפילה...");
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
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
        setIsSaving(true);
        setSavingMessage("מוחק תפילה...");
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
                    for (const item of itemsList) await dataSource.saveEntity({ path: item.path, entityId: item.id, values: { ...item.values, deleted: true, timestamp: Date.now() }, status: "existing" });
                } catch (_) {}
                try {
                    const prayersList = await dataSource.fetchCollection({
                        path: prayersPath,
                        collection: baseColl,
                    });
                    const prayerEntity = prayersList.find((e: any) => e.id === prayerId);
                    if (prayerEntity) await dataSource.saveEntity({ path: prayerEntity.path, entityId: prayerEntity.id, values: { ...prayerEntity.values, deleted: true, timestamp: Date.now() }, status: "existing" });
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מוחק תרגום: מוחק את כל המסמכים תחת התרגום (items, prayers), את מסמך התרגום ב-translations, ומוציא מהמערך ב-TOC */
    const deleteTranslation = async (translationId: string) => {
        if (!selectedTocId || !currentTocData) return;
        const updated = (currentTocData.translations ?? []).filter(
            (t: any) => t.translationId !== translationId
        );
        setIsSaving(true);
        setSavingMessage("מוחק תרגום...");
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
                    await dataSource.saveEntity({ path: item.path, entityId: item.id, values: { ...item.values, deleted: true, timestamp: Date.now() }, status: "existing" });
                }
                await dataSource.saveEntity({ path: prayer.path, entityId: prayer.id, values: { ...prayer.values, deleted: true, timestamp: Date.now() }, status: "existing" });
            }
            const transList = await dataSource.fetchCollection({
                path: "translations",
                collection: baseColl,
            });
            const transEntity = transList.find((e) => e.id === translationId);
            if (transEntity) await dataSource.saveEntity({ path: transEntity.path, entityId: transEntity.id, values: { ...transEntity.values, deleted: true, timestamp: Date.now() }, status: "existing" });
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מוחק רק את מסמך הנוסח (TOC) ב-collection "toc"; לא נוגע בתרגומים */
    const deleteToc = async (tocId: string) => {
        const toc = tocItems.find((t) => t.id === tocId);
        if (!toc) return;
        setIsSaving(true);
        setSavingMessage("מוחק נוסח...");
        try {
            await dataSource.saveEntity({ path: toc.path, entityId: toc.id, values: { ...toc.values, deleted: true, timestamp: Date.now() }, status: "existing" });
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
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מוסיף מקטע אחרי מקטע קיים (או בסוף אם afterPartId null). רק בנוסח הבסיסי מעדכן את כל התרגומים. */
    const addPart = async (partName: string, afterPartId: string | null) => {
        const name = partName?.trim();
        if (
            !name ||
            selectedTocId == null ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedPrayerId ||
            !currentTocData?.translations?.length
        )
            return;
        const idx = selectedTranslationIndex;
        const trans = currentTocData.translations[idx];
        if (!trans) return;
        const isBase = String(trans.translationId ?? "").startsWith("0-");

        const getParts = (t: any): any[] => {
            for (const cat of t.categories ?? []) {
                const prayer = (cat.prayers ?? []).find((p: any) => p.id === selectedPrayerId);
                if (prayer) return prayer.parts ?? [];
            }
            return [];
        };

        const allParts = getParts(trans);
        const maxId = allParts.length
            ? Math.max(0, ...allParts.map((p: any) => Number(p.id) || 0))
            : 0;
        const newPartId = String(maxId + 10);
        const newPart = { id: newPartId, name };

        const insertAt = (parts: any[]) => {
            if (afterPartId == null) return [...parts, newPart];
            const i = parts.findIndex((p: any) => p.id === afterPartId);
            const pos = i >= 0 ? i + 1 : parts.length;
            return [...parts.slice(0, pos), newPart, ...parts.slice(pos)];
        };

        const updateTranslation = (t: any) => ({
            ...t,
            categories: (t.categories ?? []).map((cat: any) => ({
                ...cat,
                prayers: (cat.prayers ?? []).map((p: any) =>
                    p.id === selectedPrayerId
                        ? { ...p, parts: insertAt(p.parts ?? []) }
                        : p
                ),
            })),
        });

        const updatedTranslations = isBase
            ? currentTocData.translations.map(updateTranslation)
            : currentTocData.translations.map((t: any, i: number) =>
                  i === idx ? updateTranslation(t) : t
              );

        setIsSaving(true);
        setSavingMessage("מוסיף מקטע...");
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
            snackbar.open({ type: "success", message: "מקטע נוסף" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Add part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהוספת מקטע" });
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מוחק מקטע: רק בנוסח הבסיסי (0-*). מוציא את המקטע מכל התרגומים ב-TOC ומסמן פריטים כמחוקים. */
    const deletePart = async (partId: string) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedPrayerId ||
            !currentTocData?.translations?.length ||
            !currentTranslationData?.translationId
        )
            return;
        const trans = currentTocData.translations[selectedTranslationIndex];
        const isBase = String(trans?.translationId ?? "").startsWith("0-");
        if (!isBase) return;

        const updatedTranslations = currentTocData.translations.map((t: any) => ({
            ...t,
            categories: (t.categories ?? []).map((cat: any) => ({
                ...cat,
                prayers: (cat.prayers ?? []).map((p: any) =>
                    p.id === selectedPrayerId
                        ? { ...p, parts: (p.parts ?? []).filter((part: any) => part.id !== partId) }
                        : p
                ),
            })),
        }));

        setIsSaving(true);
        setSavingMessage("מוחק מקטע...");
        try {
            for (const t of currentTocData.translations ?? []) {
                const tid = t.translationId;
                if (!tid) continue;
                const itemsPath = `translations/${tid}/prayers/${selectedPrayerId}/items`;
                try {
                    const itemsList = await dataSource.fetchCollection({
                        path: itemsPath,
                        collection: baseColl,
                        filter: { partId: ["==", partId] },
                    });
                    for (const item of itemsList) {
                        await dataSource.saveEntity({
                            path: item.path,
                            entityId: item.id,
                            values: { ...item.values, deleted: true, timestamp: Date.now() },
                            status: "existing",
                        });
                    }
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
            snackbar.open({ type: "success", message: "מקטע נמחק מכל התרגומים" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת מקטע" });
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    return {
        tocItems,
        selectedTocId,
        selectedTranslationIndex,
        selectedCategoryName,
        selectedPrayerId,
        isSaving,
        savingMessage,
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
        addPart,
        deletePart,
    };
}
