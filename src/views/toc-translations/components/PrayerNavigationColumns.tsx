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
    onAddCategory?: (categoryName: string, afterCategoryId: string | null) => void;
    onDeleteCategory?: (categoryId: string) => void;
    /** מציג את כפתור "הוסף קטגוריה" רק כשנבחרו נוסח ותרגום */
    showAddCategory?: boolean;
    currentPrayers: any[];
    selectedPrayerId: string | null;
    onSelectPrayer: (prayerId: string) => void;
    onAddPrayer?: (prayerName: string, afterPrayerId: string | null) => void;
    onDeletePrayer?: (prayerId: string) => void;
    /** מציג את כפתור "הוסף תפילה" רק כשנבחרו נוסח, תרגום וקטגוריה */
    showAddPrayer?: boolean;
    currentParts: any[];
    selectedGroupId: string | null;
    onSelectPart: (partId: string) => void;
    onAddPart?: (partName: string, afterPartId: string | null) => void;
    onDeletePart?: (partId: string) => void;
    /** מציג את כפתור "הוסף מקטע" רק כשנבחרו נוסח, תרגום, קטגוריה ותפילה */
    showAddPart?: boolean;
    /** במהלך שמירה – כפתורי הוספה/מחיקה מושבתים ומציגים מצב טעינה */
    isSaving?: boolean;
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
    onSelectPart,
    onAddPart,
    onDeletePart,
    showAddPart,
    isSaving = false,
}: PrayerNavigationColumnsProps) {
    const savingClass = "opacity-60 cursor-not-allowed pointer-events-none";

    const handleAddCategoryAfter = (afterCategoryId: string | null) => {
        const name = window.prompt("שם הקטגוריה החדשה:");
        if (name?.trim()) onAddCategory?.(name.trim(), afterCategoryId);
    };

    const handleDeleteCategory = (e: React.MouseEvent, categoryId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את הקטגוריה?")) onDeleteCategory?.(categoryId);
    };

    const handleAddPrayerAfter = (afterPrayerId: string | null) => {
        const name = window.prompt("שם התפילה החדשה:");
        if (name?.trim()) onAddPrayer?.(name.trim(), afterPrayerId);
    };

    const handleDeletePrayer = (e: React.MouseEvent, prayerId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את התפילה?")) onDeletePrayer?.(prayerId);
    };

    const handleAddPartAfter = (afterPartId: string | null) => {
        const name = window.prompt("שם המקטע החדש:");
        if (name?.trim()) onAddPart?.(name.trim(), afterPartId);
    };

    const handleDeletePart = (e: React.MouseEvent, partId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את המקטע וכל הפריטים שלו מכל התרגומים?")) onDeletePart?.(partId);
    };

    return (
        <>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">3. קטגוריה</h4>
                {currentCategories.length === 0 && onAddCategory && showAddCategory && (
                    <button
                        type="button"
                        onClick={() => handleAddCategoryAfter(null)}
                        disabled={isSaving}
                        className={`py-1.5 rounded border-2 border-dashed font-bold text-[9px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-indigo-200 text-indigo-600 hover:bg-indigo-50"}`}
                    >
                        {isSaving ? "שומר…" : "+ הוסף קטגוריה"}
                    </button>
                )}
                {currentCategories.map((category: any) => (
                    <React.Fragment key={category.id ?? category.name}>
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => onSelectCategory(category.name)}
                                disabled={isSaving}
                                className={`flex-1 text-right p-1.5 rounded border ${selectedCategoryName === category.name ? "bg-indigo-600 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
                            >
                                {category.name}
                            </button>
                            {onDeleteCategory && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDeleteCategory(e, category.id)}
                                    disabled={isSaving}
                                    className={`shrink-0 p-1 rounded border border-red-200 text-red-600 text-[8px] ${isSaving ? savingClass : "hover:bg-red-50"}`}
                                    title="מחק קטגוריה"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {onAddCategory && showAddCategory && (
                            <button
                                type="button"
                                onClick={() => handleAddCategoryAfter(category.id)}
                                disabled={isSaving}
                                className={`w-full py-0.5 rounded border border-dashed text-[8px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-indigo-200 text-indigo-500 hover:bg-indigo-50"}`}
                                title={isSaving ? undefined : `הוסף קטגוריה אחרי "${category.name}"`}
                            >
                                {isSaving ? "שומר…" : "+ הוסף כאן"}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">4. תפילה</h4>
                {currentPrayers.length === 0 && onAddPrayer && showAddPrayer && (
                    <button
                        type="button"
                        onClick={() => handleAddPrayerAfter(null)}
                        disabled={isSaving}
                        className={`py-1.5 rounded border-2 border-dashed font-bold text-[9px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-green-200 text-green-600 hover:bg-green-50"}`}
                    >
                        {isSaving ? "שומר…" : "+ הוסף תפילה"}
                    </button>
                )}
                {currentPrayers.map((prayer: any) => (
                    <React.Fragment key={prayer.id}>
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => onSelectPrayer(prayer.id)}
                                disabled={isSaving}
                                className={`flex-1 text-right p-1.5 rounded border ${selectedPrayerId === prayer.id ? "bg-green-600 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
                            >
                                {prayer.name}
                            </button>
                            {onDeletePrayer && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDeletePrayer(e, prayer.id)}
                                    disabled={isSaving}
                                    className={`shrink-0 p-1 rounded border border-red-200 text-red-600 text-[8px] ${isSaving ? savingClass : "hover:bg-red-50"}`}
                                    title="מחק תפילה"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {onAddPrayer && showAddPrayer && (
                            <button
                                type="button"
                                onClick={() => handleAddPrayerAfter(prayer.id)}
                                disabled={isSaving}
                                className={`w-full py-0.5 rounded border border-dashed text-[8px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-green-200 text-green-500 hover:bg-green-50"}`}
                                title={isSaving ? undefined : `הוסף תפילה אחרי "${prayer.name}"`}
                            >
                                {isSaving ? "שומר…" : "+ הוסף כאן"}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">5. מקטע</h4>
                {currentParts.length === 0 && onAddPart && showAddPart && (
                    <button
                        type="button"
                        onClick={() => handleAddPartAfter(null)}
                        disabled={isSaving}
                        className={`py-1.5 rounded border-2 border-dashed font-bold text-[9px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-orange-200 text-orange-600 hover:bg-orange-50"}`}
                    >
                        {isSaving ? "שומר…" : "+ הוסף מקטע"}
                    </button>
                )}
                        {currentParts.map((part: any) => (
                    <React.Fragment key={part.id}>
                        <div className="flex items-center gap-0.5">
                            <button
                                type="button"
                                onClick={() => onSelectPart(part.id)}
                                disabled={isSaving}
                                className={`flex-1 text-right p-1.5 rounded border ${selectedGroupId === part.id ? "bg-orange-500 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
                            >
                                {part.name}
                            </button>
                            {onDeletePart && (
                                <button
                                    type="button"
                                    onClick={(e) => handleDeletePart(e, part.id)}
                                    disabled={isSaving}
                                    className={`shrink-0 p-1 rounded border border-red-200 text-red-600 text-[8px] ${isSaving ? savingClass : "hover:bg-red-50"}`}
                                    title="מחק מקטע"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {onAddPart && showAddPart && (
                            <button
                                type="button"
                                onClick={() => handleAddPartAfter(part.id)}
                                disabled={isSaving}
                                className={`w-full py-0.5 rounded border border-dashed text-[8px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-orange-200 text-orange-500 hover:bg-orange-50"}`}
                                title={isSaving ? undefined : `הוסף מקטע אחרי "${part.name}"`}
                            >
                                {isSaving ? "שומר…" : "+ הוסף כאן"}
                            </button>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </>
    );
}
