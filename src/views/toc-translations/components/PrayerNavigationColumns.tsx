/**
 * PrayerNavigationColumns – עמודות ניווט 3, 4 ו-5
 *
 * עמודה 3: קטגוריות (לפי currentCategories)
 * עמודה 4: תפילות של הקטגוריה הנבחרת (currentPrayers)
 * עמודה 5: מקטעים (parts) של התפילה הנבחרת – לחיצה טוענת את פריטי המקטע (onSelectPart)
 *
 * מקבל את הרשימות וה-handlers מ-useTocNavigation ו-usePartEdit.
 */

import React from "react";

type PrayerNavigationColumnsProps = {
    currentCategories: any[];
    selectedCategoryName: string | null;
    onSelectCategory: (categoryName: string) => void;
    onAddCategory?: (categoryName: string) => void;
    onDeleteCategory?: (categoryId: string) => void;
    /** מציג את כפתור "הוסף קטגוריה" רק כשנבחרו נוסח ותרגום */
    showAddCategory?: boolean;
    currentPrayers: any[];
    selectedPrayerId: string | null;
    onSelectPrayer: (prayerId: string) => void;
    onAddPrayer?: (prayerName: string) => void;
    onDeletePrayer?: (prayerId: string) => void;
    /** מציג את כפתור "הוסף תפילה" רק כשנבחרו נוסח, תרגום וקטגוריה */
    showAddPrayer?: boolean;
    currentParts: any[];
    selectedGroupId: string | null;
    onSelectPart: (partId: string) => void;
};

export function PrayerNavigationColumns({
    currentCategories,
    selectedCategoryName,
    onSelectCategory,
    onAddCategory,
    onDeleteCategory,
    showAddCategory,
    currentPrayers,
    selectedPrayerId,
    onSelectPrayer,
    onAddPrayer,
    onDeletePrayer,
    showAddPrayer,
    currentParts,
    selectedGroupId,
    onSelectPart
}: PrayerNavigationColumnsProps) {
    const handleAddCategory = () => {
        const name = window.prompt("הזן שם לקטגוריה:");
        if (name?.trim()) onAddCategory?.(name.trim());
    };

    const handleDeleteCategory = (e: React.MouseEvent, categoryId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את הקטגוריה?")) onDeleteCategory?.(categoryId);
    };

    const handleAddPrayer = () => {
        const name = window.prompt("הזן שם לתפילה:");
        if (name?.trim()) onAddPrayer?.(name.trim());
    };

    const handleDeletePrayer = (e: React.MouseEvent, prayerId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את התפילה?")) onDeletePrayer?.(prayerId);
    };

    return (
        <>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">3. קטגוריה</h4>
                {currentCategories.map((category: any) => (
                    <div key={category.id ?? category.name} className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => onSelectCategory(category.name)}
                            className={`flex-1 text-right p-1.5 rounded border ${selectedCategoryName === category.name ? "bg-indigo-600 text-white" : "bg-gray-50"}`}
                        >
                            {category.name}
                        </button>
                        {onDeleteCategory && (
                            <button
                                type="button"
                                onClick={(e) => handleDeleteCategory(e, category.id)}
                                className="shrink-0 p-1 rounded border border-red-200 text-red-600 hover:bg-red-50 text-[8px]"
                                title="מחק קטגוריה"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
                {onAddCategory && showAddCategory && (
                    <button
                        type="button"
                        onClick={handleAddCategory}
                        className="mt-1 py-1.5 rounded border-2 border-dashed border-indigo-200 text-indigo-600 font-bold text-[9px] hover:bg-indigo-50"
                    >
                        + הוסף קטגוריה
                    </button>
                )}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">4. תפילה</h4>
                {currentPrayers.map((prayer: any) => (
                    <div key={prayer.id} className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => onSelectPrayer(prayer.id)}
                            className={`flex-1 text-right p-1.5 rounded border ${selectedPrayerId === prayer.id ? "bg-green-600 text-white" : "bg-gray-50"}`}
                        >
                            {prayer.name}
                        </button>
                        {onDeletePrayer && (
                            <button
                                type="button"
                                onClick={(e) => handleDeletePrayer(e, prayer.id)}
                                className="shrink-0 p-1 rounded border border-red-200 text-red-600 hover:bg-red-50 text-[8px]"
                                title="מחק תפילה"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
                {onAddPrayer && showAddPrayer && (
                    <button
                        type="button"
                        onClick={handleAddPrayer}
                        className="mt-1 py-1.5 rounded border-2 border-dashed border-green-200 text-green-600 font-bold text-[9px] hover:bg-green-50"
                    >
                        + הוסף תפילה
                    </button>
                )}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">5. מקטע</h4>
                {currentParts.map((part: any) => (
                    <button
                        key={part.id}
                        onClick={() => onSelectPart(part.id)}
                        className={`text-right p-1.5 rounded border ${selectedGroupId === part.id ? "bg-orange-500 text-white" : "bg-gray-50"}`}
                    >
                        {part.name}
                    </button>
                ))}
            </div>
        </>
    );
}
