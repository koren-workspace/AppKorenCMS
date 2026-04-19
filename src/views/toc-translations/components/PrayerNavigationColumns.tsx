/**
 * PrayerNavigationColumns – עמודות ניווט 3, 4 ו-5
 *
 * עמודה 3: קטגוריות (לפי currentCategories)
 * עמודה 4: תפילות של הקטגוריה הנבחרת (currentPrayers)
 * עמודה 5: מקטעים (parts) של התפילה הנבחרת – לחיצה טוענת את פריטי המקטע (onSelectPart)
 *
 * מקבל את הרשימות וה-handlers מ-useTocNavigation ו-usePartEdit.
 */

import React, { useState } from "react";
import { getNusachPalette } from "../utils/nusachPalette";
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

/** גובה אחיד לשורות ניווט + הגבלת גובה טקסט (שמות תפילה ארוכים לעומת קטגוריה) */
const NAV_ROW_MIN = "min-h-[3.5rem]";
const NAV_LABEL_BTN = "flex min-w-0 flex-1 items-center border-0 bg-transparent p-1.5 text-right shadow-none";
const NAV_LABEL_TEXT = "block w-full min-w-0 text-right leading-snug line-clamp-2 break-words";

type PrayerNavigationColumnsProps = {
    currentCategories: any[];
    selectedCategoryId: string | null;
    onSelectCategory: (categoryId: string) => void;
    /** נקרא בלחיצה על "הוסף קטגוריה" – פותח מודל להזנת שם עברית + אנגלית + מיקום */
    onAddCategoryClick?: () => void;
    onEditCategory?: (categoryId: string) => void;
    onDeleteCategory?: (categoryId: string) => void;
    /** מציג את כפתור "הוסף קטגוריה" רק כשנבחרו נוסח ותרגום */
    showAddCategory?: boolean;
    currentPrayers: any[];
    selectedPrayerId: string | null;
    onSelectPrayer: (prayerId: string) => void;
    /** נקרא בלחיצה על "הוסף תפילה" – פותח מודל להזנת שם עברית + אנגלית + מיקום */
    onAddPrayerClick?: () => void;
    /** נקרא בלחיצה על עריכת תפילה – פותח מודל עריכה */
    onEditPrayer?: (prayerId: string) => void;
    onDeletePrayer?: (prayerId: string) => void;
    /** מציג את כפתור "הוסף תפילה" רק כשנבחרו נוסח, תרגום וקטגוריה */
    showAddPrayer?: boolean;
    currentParts: any[];
    selectedGroupId: string | null;
    onSelectPart: (partId: string) => void;
    /** נקרא בלחיצה על "הוסף מקטע" – פותח מודל להזנת מאפיינים + מיקום */
    onAddPartClick?: () => void;
    /** נקרא בלחיצה על עריכת מקטע – פותח מודל עריכה */
    onEditPart?: (partId: string) => void;
    onDeletePart?: (partId: string) => void;
    /** מציג את כפתור "הוסף מקטע" רק כשנבחרו נוסח, תרגום, קטגוריה ותפילה */
    showAddPart?: boolean;
    /** קריאה לאחר גרירה לסידור מחדש של מקטעים */
    onReorderParts?: (orderedPartIds: string[]) => void;
    /** במהלך שמירה – כפתורי הוספה/מחיקה מושבתים ומציגים מצב טעינה */
    isSaving?: boolean;
    /** מזהה הנוסח הנבחר — קובע את פלטת הצבעים */
    selectedTocId?: string | null;
};

/** מקטע יחיד ברשימה הניתן לגרירה */
function SortablePartItem({
    part,
    selectedGroupId,
    onSelectPart,
    onEditPart,
    onDeletePart,
    isSaving,
    isDragDisabled,
    partColor,
    partDarkText,
}: {
    part: any;
    selectedGroupId: string | null;
    onSelectPart: (id: string) => void;
    onEditPart?: (partId: string) => void;
    onDeletePart?: (e: React.MouseEvent, id: string) => void;
    isSaving: boolean;
    isDragDisabled: boolean;
    partColor: string;
    partDarkText: boolean;
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

    const sel = selectedGroupId === part.id;
    const selText = partDarkText ? "text-gray-900" : "text-white";
    const selHover = partDarkText ? "hover:bg-black/5" : "hover:bg-white/10";

    return (
        <div ref={setNodeRef} style={style} className="flex items-stretch gap-0.5">
            {!isDragDisabled && (
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    className="shrink-0 self-center px-0.5 py-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
                    title="גרירה משנה רק את סדר החלקים בתפריט — לא את סדר הפריטים בתוך החלק"
                    tabIndex={-1}
                >
                    ⠿
                </button>
            )}
            <div
                className={`flex min-w-0 flex-1 items-stretch overflow-hidden rounded border ${NAV_ROW_MIN} ${sel ? selText : "border-gray-200 bg-gray-50"}`}
                style={sel ? { backgroundColor: partColor, borderColor: partColor } : undefined}
            >
                <button
                    type="button"
                    onClick={() => onSelectPart(part.id)}
                    disabled={isSaving}
                    title={typeof part.name === "string" ? part.name : undefined}
                    className={`${NAV_LABEL_BTN} ${sel ? `${selText} ${selHover}` : "text-gray-900 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
                >
                    <span className={NAV_LABEL_TEXT}>{part.name}</span>
                </button>
                {(onEditPart || onDeletePart) && (
                    <div
                        className={`flex shrink-0 flex-col justify-center gap-px border-l p-px ${sel ? "border-white/30" : "border-gray-200"}`}
                    >
                        {onEditPart && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEditPart(part.id); }}
                                disabled={isSaving}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs leading-none ${sel ? `border-white/35 ${selText} hover:bg-white/15` : "border-gray-300 text-gray-500 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
                                title="ערוך חלק תפילה"
                            >
                                ✎
                            </button>
                        )}
                        {onDeletePart && (
                            <button
                                type="button"
                                onClick={(e) => onDeletePart(e, part.id)}
                                disabled={isSaving}
                                className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs leading-none ${sel ? "border-red-400/50 text-red-700 hover:bg-red-100/40" : "border-red-200 text-red-600 hover:bg-red-50"} ${isSaving ? savingClass : ""}`}
                                title="מחק חלק תפילה"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                )}
            </div>
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
    selectedTocId,
}: PrayerNavigationColumnsProps) {
    const savingClass = "opacity-60 cursor-not-allowed pointer-events-none";
    const palette = getNusachPalette(selectedTocId);
    const [c2, c3, c4] = [palette.selectedColors[2], palette.selectedColors[3], palette.selectedColors[4]];
    const [dark2, dark3, dark4] = [palette.darkText[2], palette.darkText[3], palette.darkText[4]];

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

    const handleDeleteCategory = (e: React.MouseEvent, categoryId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את הקטגוריה?")) onDeleteCategory?.(categoryId);
    };

    const handleDeletePrayer = (e: React.MouseEvent, prayerId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את התפילה?")) onDeletePrayer?.(prayerId);
    };

    const handleDeletePart = (e: React.MouseEvent, partId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את חלק התפילה וכל הפריטים שלו מכל התרגומים?")) onDeletePart?.(partId);
    };

    return (
        <>
            <div className="w-40 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">3. קטגוריה</h4>
                {onAddCategoryClick && showAddCategory && (
                    <button
                        type="button"
                        onClick={onAddCategoryClick}
                        disabled={isSaving}
                        className={`py-0.5 px-1 rounded border border-dashed font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : ""}`}
                        style={!isSaving ? { borderColor: c2, color: c2 } : undefined}
                    >
                        {isSaving ? "שומר…" : "+ הוסף קטגוריה חדשה"}
                    </button>
                )}
                {currentCategories.map((category: any) => {
                    const sel = selectedCategoryId === category.id;
                    const selText2 = dark2 ? "text-gray-900" : "text-white";
                    const selHover2 = dark2 ? "hover:bg-black/5" : "hover:bg-white/10";
                    return (
                        <div
                            key={category.id ?? category.name}
                            className={`flex min-w-0 items-stretch overflow-hidden rounded border ${NAV_ROW_MIN} ${sel ? selText2 : "border-gray-200 bg-gray-50"}`}
                            style={sel ? { backgroundColor: c2, borderColor: c2 } : undefined}
                        >
                            <button
                                type="button"
                                onClick={() => onSelectCategory(category.id)}
                                disabled={isSaving}
                                title={typeof category.name === "string" ? category.name : undefined}
                                className={`${NAV_LABEL_BTN} ${sel ? `${selText2} ${selHover2}` : "text-gray-900 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
                            >
                                <span className={NAV_LABEL_TEXT}>{category.name}</span>
                            </button>
                            {(onEditCategory || onDeleteCategory) && (
                                <div
                                    className={`flex shrink-0 flex-col justify-center gap-px border-l p-px ${sel ? "border-white/30" : "border-gray-200"}`}
                                >
                                    {onEditCategory && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onEditCategory(category.id); }}
                                            disabled={isSaving}
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs leading-none ${sel ? `border-white/35 ${selText2} hover:bg-white/15` : "border-gray-300 text-gray-500 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
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
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs leading-none ${sel ? "border-red-400/50 text-red-700 hover:bg-red-100/40" : "border-red-200 text-red-600 hover:bg-red-50"} ${isSaving ? savingClass : ""}`}
                                            title="מחק קטגוריה"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="w-40 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">4. תפילה</h4>
                {onAddPrayerClick && showAddPrayer && (
                    <button
                        type="button"
                        onClick={onAddPrayerClick}
                        disabled={isSaving}
                        className={`py-0.5 px-1 rounded border border-dashed font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : ""}`}
                        style={!isSaving ? { borderColor: c3, color: c3 } : undefined}
                    >
                        {isSaving ? "שומר…" : "+ הוסף תפילה חדשה"}
                    </button>
                )}
                {currentPrayers.map((prayer: any) => {
                    const sel = selectedPrayerId === prayer.id;
                    const selText3 = dark3 ? "text-gray-900" : "text-white";
                    const selHover3 = dark3 ? "hover:bg-black/5" : "hover:bg-white/10";
                    return (
                        <div
                            key={prayer.id}
                            className={`flex min-w-0 items-stretch overflow-hidden rounded border ${NAV_ROW_MIN} ${sel ? selText3 : "border-gray-200 bg-gray-50"}`}
                            style={sel ? { backgroundColor: c3, borderColor: c3 } : undefined}
                        >
                            <button
                                type="button"
                                onClick={() => onSelectPrayer(prayer.id)}
                                disabled={isSaving}
                                title={typeof prayer.name === "string" ? prayer.name : undefined}
                                className={`${NAV_LABEL_BTN} ${sel ? `${selText3} ${selHover3}` : "text-gray-900 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
                            >
                                <span className={NAV_LABEL_TEXT}>{prayer.name}</span>
                            </button>
                            {(onEditPrayer || onDeletePrayer) && (
                                <div
                                    className={`flex shrink-0 flex-col justify-center gap-px border-l p-px ${sel ? "border-white/30" : "border-gray-200"}`}
                                >
                                    {onEditPrayer && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onEditPrayer(prayer.id); }}
                                            disabled={isSaving}
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs leading-none ${sel ? `border-white/35 ${selText3} hover:bg-white/15` : "border-gray-300 text-gray-500 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
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
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-xs leading-none ${sel ? "border-red-400/50 text-red-700 hover:bg-red-100/40" : "border-red-200 text-red-600 hover:bg-red-50"} ${isSaving ? savingClass : ""}`}
                                            title="מחק תפילה"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="w-40 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">5. חלק תפילה</h4>
                {activeDragId && (
                    <p
                        className="text-sm leading-snug font-semibold text-orange-950 mb-1 rounded px-1.5 py-1 bg-orange-100 border border-orange-300 shadow-sm"
                        role="status"
                        aria-live="polite"
                    >
                        רק סדר החלקים בתפריט משתנה כאן — לא סדר הפריטים בתוך חלק.
                    </p>
                )}
                {onAddPartClick && showAddPart && (
                    <button
                        type="button"
                        onClick={onAddPartClick}
                        disabled={isSaving}
                        className={`py-0.5 px-1 rounded border border-dashed font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : ""}`}
                        style={!isSaving ? { borderColor: c4, color: c4 } : undefined}
                    >
                        {isSaving ? "שומר…" : "+ הוסף חלק תפילה חדש"}
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
                            <SortablePartItem
                                key={part.id}
                                part={part}
                                selectedGroupId={selectedGroupId}
                                onSelectPart={onSelectPart}
                                onEditPart={onEditPart}
                                onDeletePart={onDeletePart ? handleDeletePart : undefined}
                                isSaving={isSaving}
                                isDragDisabled={!isDragEnabled}
                                partColor={c4}
                                partDarkText={dark4}
                            />
                        ))}
                    </SortableContext>
                    <DragOverlay>
                        {activePart ? (
                            <div className="flex items-stretch gap-0.5 bg-white opacity-95 shadow-lg">
                                <span className="shrink-0 self-center px-0.5 py-1 text-gray-400">⠿</span>
                                <div
                                    className={`flex min-w-0 flex-1 items-stretch overflow-hidden rounded border text-sm ${selectedGroupId === activePart.id ? (dark4 ? "text-gray-900" : "text-white") : "border-gray-200 bg-gray-50 text-gray-900"}`}
                                    style={selectedGroupId === activePart.id ? { backgroundColor: c4, borderColor: c4 } : undefined}
                                >
                                    <span className="min-w-0 flex-1 p-1.5 text-right">{activePart.name}</span>
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </>
    );
}
