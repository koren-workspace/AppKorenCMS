import React from "react";

type PrayerNavigationColumnsProps = {
    currentCategories: any[];
    selectedCategoryName: string | null;
    onSelectCategory: (categoryName: string) => void;
    currentPrayers: any[];
    selectedPrayerId: string | null;
    onSelectPrayer: (prayerId: string) => void;
    currentParts: any[];
    selectedGroupId: string | null;
    onSelectPart: (partId: string) => void;
};

export function PrayerNavigationColumns({
    currentCategories,
    selectedCategoryName,
    onSelectCategory,
    currentPrayers,
    selectedPrayerId,
    onSelectPrayer,
    currentParts,
    selectedGroupId,
    onSelectPart
}: PrayerNavigationColumnsProps) {
    return (
        <>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">3. קטגוריה</h4>
                {currentCategories.map((category: any) => (
                    <button
                        key={category.name}
                        onClick={() => onSelectCategory(category.name)}
                        className={`text-right p-1.5 rounded border ${selectedCategoryName === category.name ? "bg-indigo-600 text-white" : "bg-gray-50"}`}
                    >
                        {category.name}
                    </button>
                ))}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">4. תפילה</h4>
                {currentPrayers.map((prayer: any) => (
                    <button
                        key={prayer.id}
                        onClick={() => onSelectPrayer(prayer.id)}
                        className={`text-right p-1.5 rounded border ${selectedPrayerId === prayer.id ? "bg-green-600 text-white" : "bg-gray-50"}`}
                    >
                        {prayer.name}
                    </button>
                ))}
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
