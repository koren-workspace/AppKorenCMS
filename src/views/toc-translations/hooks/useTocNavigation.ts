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
import { baseColl, dbUpdateTimeCollection } from "../collections";
import { appendChangeLog } from "../services/changeLogService";
import { updatePartMetadataInItems } from "../services/partEditService";

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

    /** מוסיף שמות להקשר (לצד IDs) לתיעוד באקסל. override – שמות ידניים (למשל partName לפריט חדש) */
    const withNames = (ctx: Record<string, any>, override?: Record<string, string | undefined>) => {
        const t = ctx.tocId ? (tocItems.find((x) => x.id === ctx.tocId)?.values ?? currentTocData) : null;
        const trans = ctx.translationId && t?.translations ? (t.translations as any[]).find((x: any) => x.translationId === ctx.translationId) : null;
        const part = ctx.partId ? currentParts?.find((p: any) => p.id === ctx.partId) : null;
        return {
            ...ctx,
            tocName: override?.tocName ?? (ctx.tocId ? (t?.nusach ?? currentTocData?.nusach) : undefined),
            translationName: override?.translationName ?? (ctx.translationId ? (trans?.label ?? ctx.translationId) : undefined),
            prayerName: override?.prayerName ?? (ctx.prayerId ? (currentPrayers?.find((p: any) => p.id === ctx.prayerId)?.name) : undefined),
            partName: override?.partName ?? (part ? (part.nameHe ?? part.name) : undefined),
        };
    };

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
            appendChangeLog({
                timestamp: Date.now(),
                action: "add_toc",
                context: {},
                details: { newTocId: newId, nusachName: name },
                savedToFirestore: true,
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
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            appendChangeLog({
                timestamp: Date.now(),
                action: "add_translation",
                context: withNames({ tocId: selectedTocId }),
                details: { newTranslationId: id },
                savedToFirestore: true,
            });
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

    /** מוסיף קטגוריה אחרי קטגוריה קיימת (או בסוף אם afterCategoryId null). options.nameEn + tocId: בתרגום 1-{tocId} משתמשים בשם האנגלית. */
    const addCategory = async (
        nameHe: string,
        afterCategoryId: string | null,
        options?: { nameEn?: string; tocId?: string }
    ) => {
        const name = nameHe?.trim();
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
        const tocId = selectedTocId;
        const getCategoryForTranslation = (translationId: string) => ({
            id: "",
            name:
                options?.nameEn && options?.tocId && translationId === `1-${options.tocId}`
                    ? options.nameEn.trim()
                    : name,
            prayers: [] as any[],
        });
        const allCategories = trans.categories ?? [];
        const maxId = allCategories.length
            ? Math.max(0, ...allCategories.map((c: any) => Number(c.id) || 0))
            : 0;
        const newCategoryId = String(maxId + 10);
        const insertAt = (cats: any[], t: any) => {
            const catObj = {
                ...getCategoryForTranslation(t.translationId ?? ""),
                id: newCategoryId,
            };
            if (afterCategoryId == null) return [...cats, catObj];
            const i = cats.findIndex((c: any) => c.id === afterCategoryId);
            const pos = i >= 0 ? i + 1 : cats.length;
            return [...cats.slice(0, pos), catObj, ...cats.slice(pos)];
        };
        const updatedTranslations = isBase
            ? currentTocData.translations.map((t: any) => ({
                  ...t,
                  categories: insertAt(t.categories ?? [], t),
              }))
            : currentTocData.translations.map((t: any, i: number) =>
                  i === idx ? { ...t, categories: insertAt(t.categories ?? [], t) } : t
              );
        setIsSaving(true);
        setSavingMessage("מוסיף קטגוריה...");
        try {
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            appendChangeLog({
                timestamp: Date.now(),
                action: "add_category",
                context: withNames({ tocId: selectedTocId, translationId: trans?.translationId }),
                details: { newCategoryId, categoryName: name, categoryNameEn: options?.nameEn, afterCategoryId: afterCategoryId },
                savedToFirestore: true,
            });
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

    /** מחזיר נתוני קטגוריה לעריכה: בבסיס nameHe+nameEn; בתרגום (1-*, 2-*) שם בתרגום הנוכחי */
    const getCategoryForEdit = (categoryId: string) => {
        if (!currentTocData?.translations?.length || !selectedTocId) return null;
        const baseTrans = currentTocData.translations.find((t: any) =>
            String(t?.translationId ?? "").startsWith("0-")
        );
        const engTrans = currentTocData.translations.find(
            (t: any) => t?.translationId === `1-${selectedTocId}`
        );
        const getCat = (trans: any) => (trans?.categories ?? []).find((c: any) => c.id === categoryId);
        const baseCat = baseTrans ? getCat(baseTrans) : null;
        const engCat = engTrans ? getCat(engTrans) : null;
        if (!baseCat) return null;
        const tid = currentTranslationData?.translationId ?? "";
        const isBase = String(tid).startsWith("0-");
        if (isBase) {
            return {
                id: categoryId,
                mode: "base" as const,
                nameHe: baseCat.name ?? "",
                nameEn: engCat?.name ?? baseCat.name ?? "",
            };
        }
        const currCat = getCat(currentTranslationData);
        return {
            id: categoryId,
            mode: "translation" as const,
            name: currCat?.name ?? "",
        };
    };

    /**
     * מעדכן קטגוריה קיימת.
     * בבסיס (0-*): מעדכן nameHe בבסיס ו-nameEn ב-1-{tocId}.
     * בתרגום (1-*, 2-*): מעדכן רק את השם בתרגום הנוכחי.
     */
    const updateCategory = async (
        categoryId: string,
        params: { nameHe?: string; nameEn?: string; name?: string }
    ) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !currentTocData?.translations?.length
        )
            return;
        const tocId = selectedTocId;
        const tid = currentTranslationData?.translationId ?? "";
        const isBase = String(tid).startsWith("0-");

        let nameHe: string;
        let nameEn: string;
        let targetTranslationId: string | null = null;

        if (isBase && params.nameHe != null && params.nameEn != null) {
            nameHe = params.nameHe;
            nameEn = params.nameEn;
        } else if (!isBase && params.name != null) {
            targetTranslationId = tid;
            nameHe = params.name;
            nameEn = params.name;
        } else {
            return;
        }

        const getCategoryForTranslation = (translationId: string) => {
            if (targetTranslationId) {
                return translationId === targetTranslationId ? nameHe : undefined;
            }
            return translationId === `1-${tocId}` ? nameEn : nameHe;
        };

        const updateTranslation = (t: any) => {
            const newName = getCategoryForTranslation(t.translationId ?? "");
            if (newName === undefined) return t;
            return {
                ...t,
                categories: (t.categories ?? []).map((c: any) =>
                    c.id === categoryId ? { ...c, name: newName } : c
                ),
            };
        };

        const updatedTranslations = currentTocData.translations.map(updateTranslation);

        setIsSaving(true);
        setSavingMessage("מעדכן קטגוריה...");
        try {
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            const cat = currentCategories?.find((c: any) => c.id === categoryId);
            if (cat && selectedCategoryName === cat.name) {
                const newName = targetTranslationId ? nameHe : (tid === `1-${tocId}` ? nameEn : nameHe);
                setSelectedCategoryName(newName);
            }
            appendChangeLog({
                timestamp: Date.now(),
                action: "update_category",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId, categoryId }),
                details: { categoryId, nameHe, nameEn },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "הקטגוריה עודכנה" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Update category failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בעדכון הקטגוריה" });
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
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
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
            appendChangeLog({
                timestamp: Date.now(),
                action: "delete_category",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId }),
                details: { deletedId: categoryId, deletedName: categoryToDelete?.name },
                savedToFirestore: true,
            });
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
     * options.nameEn + options.tocId: בתרגום 1-{tocId} משתמשים בשם האנגלית; בשאר – בעברית.
     */
    const addPrayer = async (
        prayerName: string,
        afterPrayerId: string | null,
        options?: { nameEn?: string; tocId?: string }
    ) => {
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
        const getPrayerForTranslation = (translationId: string) => ({
            id: newPrayerId,
            name:
                options?.nameEn && options?.tocId && translationId === `1-${options.tocId}`
                    ? options.nameEn
                    : name,
            parts: [] as any[],
        });
        const insertPrayerAt = (prayerList: any[], prayerObj: any) => {
            if (afterPrayerId == null) return [...prayerList, prayerObj];
            const i = prayerList.findIndex((p: any) => p.id === afterPrayerId);
            const pos = i >= 0 ? i + 1 : prayerList.length;
            return [...prayerList.slice(0, pos), prayerObj, ...prayerList.slice(pos)];
        };
        const updateTranslation = (t: any) => {
            const prayerObj = getPrayerForTranslation(t.translationId ?? "");
            return {
                ...t,
                categories: (t.categories ?? []).map((c: any) =>
                    c.name === selectedCategoryName
                        ? { ...c, prayers: insertPrayerAt(c.prayers ?? [], prayerObj) }
                        : c
                ),
            };
        };
        const updatedTranslations = isBase
            ? currentTocData.translations.map(updateTranslation)
            : currentTocData.translations.map((t: any, i: number) =>
                  i === transIdx ? updateTranslation(t) : t
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
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            appendChangeLog({
                timestamp: Date.now(),
                action: "add_prayer",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId, prayerId: newPrayerId }),
                details: { newPrayerId, prayerName: name, afterPrayerId: afterPrayerId },
                savedToFirestore: true,
            });
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
     * מעדכן תפילה קיימת.
     * בבסיס (0-*): מעדכן nameHe בבסיס ו-nameEn ב-1-{tocId}.
     * בתרגום (1-*, 2-*): מעדכן רק את השם בתרגום הנוכחי.
     */
    const updatePrayer = async (
        prayerId: string,
        params: { nameHe?: string; nameEn?: string; name?: string }
    ) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedCategoryName ||
            !currentTocData?.translations?.length
        )
            return;
        const tocId = selectedTocId;
        const tid = currentTranslationData?.translationId ?? "";
        const isBase = String(tid).startsWith("0-");

        let nameHe: string;
        let nameEn: string;
        let targetTranslationId: string | null = null;

        if (isBase && params.nameHe != null && params.nameEn != null) {
            nameHe = params.nameHe;
            nameEn = params.nameEn;
        } else if (!isBase && params.name != null) {
            targetTranslationId = tid;
            nameHe = params.name;
            nameEn = params.name;
        } else {
            return;
        }

        const selectedCat = currentCategories?.find((c: any) => c.name === selectedCategoryName);
        const categoryId = selectedCat?.id;

        const getPrayerParts = (t: any): any[] => {
            const cat = categoryId
                ? (t?.categories ?? []).find((c: any) => c.id === categoryId)
                : (t?.categories ?? []).find((c: any) => c.name === selectedCategoryName);
            const prayer = (cat?.prayers ?? []).find((p: any) => p.id === prayerId);
            return prayer?.parts ?? [];
        };

        const getPrayerForTranslation = (translationId: string) => {
            const useName = targetTranslationId
                ? translationId === targetTranslationId
                    ? nameHe
                    : undefined
                : translationId === `1-${tocId}`
                  ? nameEn
                  : nameHe;
            return useName !== undefined ? { id: prayerId, name: useName, parts: [] as any[] } : null;
        };

        const updateTranslation = (t: any) => {
            const prayerObj = getPrayerForTranslation(t.translationId ?? "");
            if (prayerObj) {
                const existingParts = getPrayerParts(t);
                prayerObj.parts = existingParts;
            }
            if (!prayerObj) return t;
            return {
                ...t,
                categories: (t.categories ?? []).map((c: any) =>
                    (categoryId ? c.id === categoryId : c.name === selectedCategoryName)
                        ? {
                              ...c,
                              prayers: (c.prayers ?? []).map((p: any) =>
                                  p.id === prayerId ? prayerObj : p
                              ),
                          }
                        : c
                ),
            };
        };

        const updatedTranslations = currentTocData.translations.map(updateTranslation);

        setIsSaving(true);
        setSavingMessage("מעדכן תפילה...");
        try {
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );

            const translationsToUpdate = targetTranslationId
                ? currentTocData.translations.filter((t: any) => t.translationId === targetTranslationId)
                : currentTocData.translations;

            for (const t of translationsToUpdate ?? []) {
                const tId = t?.translationId;
                if (!tId) continue;
                const typeName = tId === `1-${tocId}` ? nameEn : nameHe;
                const prayersPath = `translations/${tId}/prayers`;
                try {
                    const prayersList = await dataSource.fetchCollection({
                        path: prayersPath,
                        collection: baseColl,
                    });
                    const prayerEntity = prayersList.find((e: any) => e.id === prayerId);
                    if (prayerEntity) {
                        const pathToUse = (prayerEntity as any).path ?? prayersPath;
                        await dataSource.saveEntity({
                            path: pathToUse,
                            entityId: prayerEntity.id,
                            values: { ...prayerEntity.values, type: typeName, timestamp: Date.now() },
                            status: "existing",
                            collection: baseColl,
                        });
                    }
                } catch (_) {}
            }

            appendChangeLog({
                timestamp: Date.now(),
                action: "update_prayer",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId, prayerId }),
                details: { prayerId, nameHe, nameEn },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "התפילה עודכנה" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Update prayer failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בעדכון התפילה" });
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מחזיר נתוני תפילה לעריכה: בבסיס (0-*) nameHe+nameEn; בתרגום (1-*, 2-*) שם בתרגום הנוכחי */
    const getPrayerForEdit = (prayerId: string) => {
        if (!currentTocData?.translations?.length || !selectedTocId || !selectedCategoryName) return null;
        const selectedCat = currentCategories?.find((c: any) => c.name === selectedCategoryName);
        const categoryId = selectedCat?.id;
        const baseTrans = currentTocData.translations.find((t: any) =>
            String(t?.translationId ?? "").startsWith("0-")
        );
        const engTrans = currentTocData.translations.find(
            (t: any) => t?.translationId === `1-${selectedTocId}`
        );
        const getPrayer = (trans: any) => {
            const cat = categoryId
                ? (trans?.categories ?? []).find((c: any) => c.id === categoryId)
                : (trans?.categories ?? []).find((c: any) => c.name === selectedCategoryName);
            return (cat?.prayers ?? []).find((p: any) => p.id === prayerId) ?? null;
        };
        const basePrayer = baseTrans ? getPrayer(baseTrans) : null;
        const engPrayer = engTrans ? getPrayer(engTrans) : null;
        if (!basePrayer) return null;
        const tid = currentTranslationData?.translationId ?? "";
        const isBase = String(tid).startsWith("0-");
        if (isBase) {
            return {
                id: prayerId,
                mode: "base" as const,
                nameHe: basePrayer.name ?? "",
                nameEn: engPrayer?.name ?? basePrayer.name ?? "",
            };
        }
        const currPrayer = getPrayer(currentTranslationData);
        return {
            id: prayerId,
            mode: "translation" as const,
            name: currPrayer?.name ?? "",
        };
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
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            if (selectedPrayerId === prayerId) setSelectedPrayerId(null);
            const prayerName = trans?.categories?.flatMap((c: any) => c.prayers ?? []).find((p: any) => p.id === prayerId)?.name;
            appendChangeLog({
                timestamp: Date.now(),
                action: "delete_prayer",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId }),
                details: { deletedId: prayerId, deletedName: prayerName },
                savedToFirestore: true,
            });
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
            appendChangeLog({
                timestamp: Date.now(),
                action: "delete_translation",
                context: withNames({ tocId: selectedTocId }),
                details: { deletedId: translationId },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "התרגום נמחק" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete translation failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת תרגום" });
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מעדכן את שם התצוגה של הנוסח (nusach) */
    const updateToc = async (tocId: string, params: { nusach: string }) => {
        const toc = tocItems.find((t) => t.id === tocId);
        if (!toc || !params.nusach?.trim()) return;
        setIsSaving(true);
        setSavingMessage("מעדכן נוסח...");
        try {
            await dataSource.saveEntity({
                path: toc.path,
                entityId: toc.id,
                values: { ...toc.values, nusach: params.nusach.trim(), timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === tocId
                        ? { ...t, values: { ...t.values, nusach: params.nusach.trim(), timestamp: Date.now() } }
                        : t
                )
            );
            appendChangeLog({
                timestamp: Date.now(),
                action: "update_toc",
                context: withNames({ tocId }),
                details: { tocId, nusach: params.nusach },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "הנוסח עודכן" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Update TOC failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בעדכון הנוסח" });
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
            appendChangeLog({
                timestamp: Date.now(),
                action: "delete_toc",
                context: withNames({ tocId }),
                details: { deletedId: tocId, deletedName: (toc.values as any)?.nusach },
                savedToFirestore: true,
            });
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

    /**
     * מוסיף מקטע אחרי afterPartId (או בסוף אם null). רק בנוסח הבסיסי מעדכן את כל התרגומים.
     * אפשרויות נוספות (לפיצול): nameEn לתרגום 1-{tocId}, dateSetIds/hazan/minyan.
     * מחזיר את newPartId שנוצר, או null אם הפעולה נכשלה / הוחמצה.
     */
    const addPart = async (
        partName: string,
        afterPartId: string | null,
        options?: {
            nameEn?: string;
            tocId?: string;
            dateSetIds?: string[];
            hazan?: boolean | null;
            minyan?: boolean | null;
        }
    ): Promise<string | null> => {
        const name = partName?.trim();
        if (
            !name ||
            selectedTocId == null ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedPrayerId ||
            !currentTocData?.translations?.length
        )
            return null;
        const idx = selectedTranslationIndex;
        const trans = currentTocData.translations[idx];
        if (!trans) return null;
        const isBase = String(trans.translationId ?? "").startsWith("0-");

        const getParts = (t: any): any[] => {
            for (const cat of t.categories ?? []) {
                const prayer = (cat.prayers ?? []).find((p: any) => p.id === selectedPrayerId);
                if (prayer) return prayer.parts ?? [];
            }
            return [];
        };

        // חישוב newPartId מהתרגום הבסיסי (0-*) – מקטע חדש = max + 10
        const baseTrans = currentTocData.translations.find((t: any) =>
            String(t.translationId ?? "").startsWith("0-")
        ) ?? trans;
        const allParts = getParts(baseTrans);
        const maxId = allParts.length
            ? Math.max(0, ...allParts.map((p: any) => Number(p.id) || 0))
            : 0;
        const newPartId = String(maxId + 10);

        // בסיס המקטע החדש עם שדות תצוגה
        const basePart = {
            id: newPartId,
            dateSetIds: options?.dateSetIds ?? ["100"],
            hazan: options?.hazan ?? null,
            minyan: options?.minyan ?? null,
        };

        // שם לפי תרגום: 1-{tocId} → אנגלית; כולם → עברית
        const getPartForTranslation = (translationId: string) => ({
            ...basePart,
            name:
                options?.nameEn && options?.tocId && translationId === `1-${options.tocId}`
                    ? options.nameEn
                    : name,
        });

        const insertAt = (parts: any[], partObj: any) => {
            if (afterPartId == null) return [...parts, partObj];
            const i = parts.findIndex((p: any) => p.id === afterPartId);
            const pos = i >= 0 ? i + 1 : parts.length;
            return [...parts.slice(0, pos), partObj, ...parts.slice(pos)];
        };

        const updateTranslation = (t: any) => {
            const partObj = getPartForTranslation(t.translationId ?? "");
            return {
                ...t,
                categories: (t.categories ?? []).map((cat: any) => ({
                    ...cat,
                    prayers: (cat.prayers ?? []).map((p: any) =>
                        p.id === selectedPrayerId
                            ? { ...p, parts: insertAt(p.parts ?? [], partObj) }
                            : p
                    ),
                })),
            };
        };

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
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            appendChangeLog({
                timestamp: Date.now(),
                action: "add_part",
                context: withNames({ tocId: selectedTocId, translationId: trans?.translationId, prayerId: selectedPrayerId, partId: newPartId }, { partName: name }),
                details: { newPartId, partName: name, afterPartId: afterPartId },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "מקטע נוסף" });
            return newPartId;
        } catch (err) {
            console.error(`${LOG_PREFIX} Add part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בהוספת מקטע" });
            return null;
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /**
     * מעדכן מקטע קיים.
     * בבסיס (0-*): שם עברית/אנגלית, dateSetIds, hazan, minyan – מעדכן את כולם.
     * בתרגום (1-*, 2-*): מעדכן רק את השם בתרגום הנוכחי.
     */
    const updatePart = async (
        partId: string,
        params: {
            nameHe?: string;
            nameEn?: string;
            name?: string;
            dateSetIds?: string[];
            hazan?: boolean | null;
            minyan?: boolean | null;
        }
    ) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedPrayerId ||
            !currentTocData?.translations?.length
        )
            return;
        const tocId = selectedTocId;
        const tid = currentTranslationData?.translationId ?? "";
        const isBase = String(tid).startsWith("0-");

        const getExistingPart = (trans: any) => {
            for (const cat of trans?.categories ?? []) {
                const prayer = (cat.prayers ?? []).find((p: any) => p.id === selectedPrayerId);
                const part = (prayer?.parts ?? []).find((p: any) => p.id === partId);
                if (part) return part;
            }
            return null;
        };

        let nameHe: string;
        let nameEn: string;
        let dateSetIds: string[];
        let hazan: boolean | null;
        let minyan: boolean | null;
        let targetTranslationId: string | null = null;

        if (isBase && params.nameHe != null && params.nameEn != null && params.dateSetIds != null) {
            nameHe = params.nameHe;
            nameEn = params.nameEn;
            dateSetIds = params.dateSetIds;
            hazan = params.hazan ?? null;
            minyan = params.minyan ?? null;
        } else if (!isBase && params.name != null) {
            targetTranslationId = tid;
            const currPart = getExistingPart(currentTranslationData);
            if (!currPart) return;
            nameHe = params.name;
            nameEn = params.name;
            dateSetIds = currPart.dateSetIds ?? ["100"];
            hazan = currPart.hazan ?? null;
            minyan = currPart.minyan ?? null;
        } else {
            return;
        }

        const getPartForTranslation = (translationId: string) => {
            if (targetTranslationId) {
                return translationId === targetTranslationId
                    ? { id: partId, name: nameHe, dateSetIds, hazan, minyan }
                    : null;
            }
            return {
                id: partId,
                name: translationId === `1-${tocId}` ? nameEn : nameHe,
                dateSetIds,
                hazan,
                minyan,
            };
        };

        const updateTranslation = (t: any) => {
            const partObj = getPartForTranslation(t.translationId ?? "");
            if (!partObj) return t;
            return {
                ...t,
                categories: (t.categories ?? []).map((cat: any) => ({
                    ...cat,
                    prayers: (cat.prayers ?? []).map((p: any) =>
                        p.id === selectedPrayerId
                            ? {
                                  ...p,
                                  parts: (p.parts ?? []).map((pt: any) =>
                                      pt.id === partId ? partObj : pt
                                  ),
                              }
                            : p
                    ),
                })),
            };
        };

        const updatedTranslations = currentTocData.translations.map(updateTranslation);

        setIsSaving(true);
        setSavingMessage("מעדכן מקטע...");
        try {
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );

            await updatePartMetadataInItems(dataSource, {
                selectedPrayerId,
                partId,
                translations: updatedTranslations,
            });

            appendChangeLog({
                timestamp: Date.now(),
                action: "update_part",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId, prayerId: selectedPrayerId, partId }, { partName: nameHe }),
                details: { partId, nameHe, nameEn },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "המקטע עודכן" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Update part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בעדכון המקטע" });
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /**
     * משנה את סדר המקטעים בתפילה הנבחרת לפי orderedPartIds.
     * מעדכן את כל התרגומים ב-TOC (סדר אחיד בכולם).
     */
    const reorderParts = async (orderedPartIds: string[]) => {
        if (
            !selectedTocId ||
            selectedTranslationIndex == null ||
            selectedTranslationIndex < 0 ||
            !selectedPrayerId ||
            !currentTocData?.translations?.length
        )
            return;

        const rearrange = (parts: any[]): any[] =>
            orderedPartIds
                .map((id) => parts.find((p: any) => p.id === id))
                .filter(Boolean) as any[];

        const updatedTranslations = currentTocData.translations.map((t: any) => ({
            ...t,
            categories: (t.categories ?? []).map((cat: any) => ({
                ...cat,
                prayers: (cat.prayers ?? []).map((p: any) =>
                    p.id === selectedPrayerId
                        ? { ...p, parts: rearrange(p.parts ?? []) }
                        : p
                ),
            })),
        }));

        setIsSaving(true);
        setSavingMessage("מסדר מקטעים...");
        try {
            await dataSource.saveEntity({
                path: "toc",
                entityId: selectedTocId,
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );

            // עדכון timestamp ב-Firestore בלבד – האפליקציה תסנכרן את הסדר החדש בלחיצה על "פרסם"
            const publishTimestamp = Date.now();
            await dataSource.saveEntity({
                path: "db-update-time",
                entityId: selectedTocId,
                values: { maxTimestamp: publishTimestamp },
                status: "existing",
                collection: dbUpdateTimeCollection,
            });

            appendChangeLog({
                timestamp: publishTimestamp,
                action: "reorder_parts",
                context: {
                    tocId: selectedTocId,
                    translationId: currentTocData.translations[selectedTranslationIndex]?.translationId,
                    prayerId: selectedPrayerId,
                },
                details: { orderedPartIds },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "סדר המקטעים עודכן" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Reorder parts failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בסידור מחדש של מקטעים" });
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
                values: { ...currentTocData, translations: updatedTranslations, timestamp: Date.now() },
                status: "existing",
                collection: baseColl,
            });
            setTocItems((prev) =>
                prev.map((t) =>
                    t.id === selectedTocId
                        ? { ...t, values: { ...t.values, translations: updatedTranslations, timestamp: Date.now() } }
                        : t
                )
            );
            const partName = trans?.categories?.flatMap((c: any) => c.prayers ?? []).find((p: any) => p.id === selectedPrayerId)?.parts?.find((pt: any) => pt.id === partId)?.name;
            appendChangeLog({
                timestamp: Date.now(),
                action: "delete_part",
                context: withNames({ tocId: selectedTocId, translationId: currentTranslationData?.translationId, prayerId: selectedPrayerId, partId }, { partName }),
                details: { deletedId: partId, deletedName: partName },
                savedToFirestore: true,
            });
            snackbar.open({ type: "success", message: "מקטע נמחק מכל התרגומים" });
        } catch (err) {
            console.error(`${LOG_PREFIX} Delete part failed`, err);
            snackbar.open({ type: "error", message: "שגיאה במחיקת מקטע" });
        } finally {
            setIsSaving(false);
            setSavingMessage(null);
        }
    };

    /** מחזיר נתוני מקטע לעריכה: בבסיס nameHe+nameEn+מאפיינים; בתרגום (1-*, 2-*) שם בלבד */
    const getPartForEdit = (partId: string) => {
        if (!currentTocData?.translations?.length || !selectedTocId || !selectedPrayerId) return null;
        const baseTrans = currentTocData.translations.find((t: any) =>
            String(t?.translationId ?? "").startsWith("0-")
        );
        const engTrans = currentTocData.translations.find(
            (t: any) => t?.translationId === `1-${selectedTocId}`
        );
        const getPart = (trans: any) => {
            for (const cat of trans?.categories ?? []) {
                const prayer = (cat.prayers ?? []).find((p: any) => p.id === selectedPrayerId);
                const part = (prayer?.parts ?? []).find((p: any) => p.id === partId);
                if (part) return part;
            }
            return null;
        };
        const basePart = baseTrans ? getPart(baseTrans) : null;
        const engPart = engTrans ? getPart(engTrans) : null;
        if (!basePart) return null;
        const tid = currentTranslationData?.translationId ?? "";
        const isBase = String(tid).startsWith("0-");
        if (isBase) {
            return {
                id: partId,
                mode: "base" as const,
                nameHe: basePart.name ?? "",
                nameEn: engPart?.name ?? basePart.name ?? "",
                dateSetIds: basePart.dateSetIds ?? ["100"],
                hazan: basePart.hazan ?? null,
                minyan: basePart.minyan ?? null,
            };
        }
        const currPart = getPart(currentTranslationData);
        return {
            id: partId,
            mode: "translation" as const,
            name: currPart?.name ?? "",
        };
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
        updateToc,
        deleteToc,
        addTranslation,
        getSuggestedTranslationId,
        deleteTranslation,
        addCategory,
        updateCategory,
        getCategoryForEdit,
        deleteCategory,
        addPrayer,
        updatePrayer,
        deletePrayer,
        getPrayerForEdit,
        addPart,
        updatePart,
        deletePart,
        reorderParts,
        getPartForEdit,
    };
}
