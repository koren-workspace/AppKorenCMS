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
    };
}
