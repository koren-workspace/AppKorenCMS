/**
 * PrayerNavigationColumns – עמודות ניווט 3, 4 ו-5
 *
 * עמודה 3: קטגוריות (לפי currentCategories)
 * עמודה 4: תפילות של הקטגוריה הנבחרת (currentPrayers)
 * עמודה 5: פריטים (parts) של התפילה הנבחרת – לחיצה טוענת את פריטי הפריט (onSelectPart)
 *
 * מקבל את הרשימות וה-handlers מ-useTocNavigation ו-usePartEdit.
 */

import React, { useState } from "react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type PrayerNavigationColumnsProps = {
    currentCategories: any[];
    selectedCategoryId: string | null;
    onSelectCategory: (categoryId: string) => void;
    /** נקרא בלחיצה על "הוסף קטגוריה" – פותח מודל להזנת שם עברית + אנגלית. afterCategoryId = null = בסוף הרשימה */
    onAddCategoryClick?: (afterCategoryId: string | null) => void;
    onEditCategory?: (categoryId: string) => void;
    onDeleteCategory?: (categoryId: string) => void;
    /** מציג את כפתור "הוסף קטגוריה" רק כשנבחרו נוסח ותרגום */
    showAddCategory?: boolean;
    currentPrayers: any[];
    selectedPrayerId: string | null;
    onSelectPrayer: (prayerId: string) => void;
    /** נקרא בלחיצה על "הוסף תפילה" – פותח מודל להזנת שם עברית + אנגלית. afterPrayerId = null = בסוף הרשימה */
    onAddPrayerClick?: (afterPrayerId: string | null) => void;
    /** נקרא בלחיצה על עריכת תפילה – פותח מודל עריכה */
    onEditPrayer?: (prayerId: string) => void;
    onDeletePrayer?: (prayerId: string) => void;
    /** מציג את כפתור "הוסף תפילה" רק כשנבחרו נוסח, תרגום וקטגוריה */
    showAddPrayer?: boolean;
    currentParts: any[];
    selectedGroupId: string | null;
    onSelectPart: (partId: string) => void;
    /** נקרא בלחיצה על "הוסף פריט" – פותח מודל להזנת מאפיינים. afterPartId = null = בסוף הרשימה */
    onAddPartClick?: (afterPartId: string | null) => void;
    /** נקרא בלחיצה על עריכת פריט – פותח מודל עריכה */
    onEditPart?: (partId: string) => void;
    onDeletePart?: (partId: string) => void;
    /** מציג את כפתור "הוסף פריט" רק כשנבחרו נוסח, תרגום, קטגוריה ותפילה */
    showAddPart?: boolean;
    /** קריאה לאחר גרירה לסידור מחדש של פריטים */
    onReorderParts?: (orderedPartIds: string[]) => void;
    /** במהלך שמירה – כפתורי הוספה/מחיקה מושבתים ומציגים מצב טעינה */
    isSaving?: boolean;
};

/** פריט פריט יחיד הניתן לגרירה */
function SortablePartItem({
    part,
    selectedGroupId,
    onSelectPart,
    onEditPart,
    onDeletePart,
    isSaving,
    isDragDisabled,
}: {
    part: any;
    selectedGroupId: string | null;
    onSelectPart: (id: string) => void;
    onEditPart?: (partId: string) => void;
    onDeletePart?: (e: React.MouseEvent, id: string) => void;
    isSaving: boolean;
    isDragDisabled: boolean;
}) {
    const savingClass = "opacity-60 cursor-not-allowed pointer-events-none";
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: part.id, disabled: isDragDisabled });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-0.5">
            {!isDragDisabled && (
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="shrink-0 px-0.5 py-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
                    title="גרור לשינוי סדר"
                    tabIndex={-1}
                >
                    ⠿
                </button>
            )}
            <button
                type="button"
                onClick={() => onSelectPart(part.id)}
                disabled={isSaving}
                className={`flex-1 text-right p-1.5 rounded border ${selectedGroupId === part.id ? "bg-orange-500 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
            >
                {part.name}
            </button>
            {onEditPart && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditPart(part.id); }}
                    disabled={isSaving}
                    className={`shrink-0 p-1 rounded border border-blue-200 text-blue-600 text-[8px] ${isSaving ? savingClass : "hover:bg-blue-50"}`}
                    title="ערוך פריט"
                >
                    ✎
                </button>
            )}
            {onDeletePart && (
                <button
                    type="button"
                    onClick={(e) => onDeletePart(e, part.id)}
                    disabled={isSaving}
                    className={`shrink-0 p-1 rounded border border-red-200 text-red-600 text-[8px] ${isSaving ? savingClass : "hover:bg-red-50"}`}
                    title="מחק פריט"
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export function PrayerNavigationColumns({
    currentCategories,
    selectedCategoryId,
    onSelectCategory,
    onAddCategoryClick,
    onEditCategory,
    onDeleteCategory,
    showAddCategory,
    currentPrayers,
    selectedPrayerId,
    onSelectPrayer,
    onAddPrayerClick,
    onEditPrayer,
    onDeletePrayer,
    showAddPrayer,
    currentParts,
    selectedGroupId,
    onSelectPart,
    onAddPartClick,
    onEditPart,
    onDeletePart,
    showAddPart,
    onReorderParts,
    isSaving = false,
}: PrayerNavigationColumnsProps) {
    const savingClass = "opacity-60 cursor-not-allowed pointer-events-none";

    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(String(event.active.id));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragId(null);
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = currentParts.findIndex((p: any) => p.id === active.id);
        const newIndex = currentParts.findIndex((p: any) => p.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(currentParts, oldIndex, newIndex);
        onReorderParts?.(reordered.map((p: any) => p.id));
    };

    const activePart = activeDragId ? currentParts.find((p: any) => p.id === activeDragId) : null;
    const isDragEnabled = !!onReorderParts && !isSaving && currentParts.length > 1;

    const handleAddCategoryAfter = (afterCategoryId: string | null) => {
        onAddCategoryClick?.(afterCategoryId);
    };

    const handleDeleteCategory = (e: React.MouseEvent, categoryId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את הקטגוריה?")) onDeleteCategory?.(categoryId);
    };

    const handleAddPrayerAfter = (afterPrayerId: string | null) => {
        onAddPrayerClick?.(afterPrayerId);
    };

    const handleDeletePrayer = (e: React.MouseEvent, prayerId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את התפילה?")) onDeletePrayer?.(prayerId);
    };

    const handleAddPartAfter = (afterPartId: string | null) => {
        onAddPartClick?.(afterPartId);
    };

    const handleDeletePart = (e: React.MouseEvent, partId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את הפריט וכל הפריטים שלו מכל התרגומים?")) onDeletePart?.(partId);
    };

    return (
        <>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">3. קטגוריה</h4>
                {currentCategories.length === 0 && onAddCategoryClick && showAddCategory && (
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
                                onClick={() => onSelectCategory(category.id)}
                                disabled={isSaving}
                                className={`flex-1 text-right p-1.5 rounded border ${selectedCategoryId === category.id ? "bg-indigo-600 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
                            >
                                {category.name}
                            </button>
                            {onEditCategory && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEditCategory(category.id); }}
                                    disabled={isSaving}
                                    className={`shrink-0 p-1 rounded border border-blue-200 text-blue-600 text-[8px] ${isSaving ? savingClass : "hover:bg-blue-50"}`}
                                    title="ערוך קטגוריה"
                                >
                                    ✎
                                </button>
                            )}
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
                        {onAddCategoryClick && showAddCategory && (
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
                {currentPrayers.length === 0 && onAddPrayerClick && showAddPrayer && (
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
                            {onEditPrayer && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onEditPrayer(prayer.id); }}
                                    disabled={isSaving}
                                    className={`shrink-0 p-1 rounded border border-blue-200 text-blue-600 text-[8px] ${isSaving ? savingClass : "hover:bg-blue-50"}`}
                                    title="ערוך תפילה"
                                >
                                    ✎
                                </button>
                            )}
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
                        {onAddPrayerClick && showAddPrayer && (
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
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">5. פריט</h4>
                {currentParts.length === 0 && onAddPartClick && showAddPart && (
                    <button
                        type="button"
                        onClick={() => handleAddPartAfter(null)}
                        disabled={isSaving}
                        className={`py-1.5 rounded border-2 border-dashed font-bold text-[9px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-orange-200 text-orange-600 hover:bg-orange-50"}`}
                    >
                        {isSaving ? "שומר…" : "+ הוסף פריט"}
                    </button>
                )}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={currentParts.map((p: any) => p.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {currentParts.map((part: any) => (
                            <React.Fragment key={part.id}>
                                <SortablePartItem
                                    part={part}
                                    selectedGroupId={selectedGroupId}
                                    onSelectPart={onSelectPart}
                                    onEditPart={onEditPart}
                                    onDeletePart={onDeletePart ? handleDeletePart : undefined}
                                    isSaving={isSaving}
                                    isDragDisabled={!isDragEnabled}
                                />
                                {onAddPartClick && showAddPart && !activeDragId && (
                                    <button
                                        type="button"
                                        onClick={() => handleAddPartAfter(part.id)}
                                        disabled={isSaving}
                                        className={`w-full py-0.5 rounded border border-dashed text-[8px] ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "border-orange-200 text-orange-500 hover:bg-orange-50"}`}
                                        title={isSaving ? undefined : `הוסף פריט אחרי "${part.name}"`}
                                    >
                                        {isSaving ? "שומר…" : "+ הוסף כאן"}
                                    </button>
                                )}
                            </React.Fragment>
                        ))}
                    </SortableContext>
                    <DragOverlay>
                        {activePart ? (
                            <div className="flex items-center gap-0.5 bg-white shadow-lg rounded border border-orange-300 opacity-95">
                                <span className="shrink-0 px-0.5 py-1 text-gray-400">⠿</span>
                                <span className={`flex-1 text-right p-1.5 rounded text-[10px] ${selectedGroupId === activePart.id ? "bg-orange-500 text-white" : "bg-gray-50"}`}>
                                    {activePart.name}
                                </span>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </>
    );
}
