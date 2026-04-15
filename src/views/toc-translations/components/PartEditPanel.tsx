/**
 * PartEditPanel – אזור העריכה הראשי במסך
 *
 * מציג:
 *   - PartEditToolbar: כותרת המקטע + כפתורי "שמור מקטע" ו"פרסום"
 *   - במצב טעינה: "טוען..."
 *   - לאחר טעינה: רשימת פריטים (PartItemRow) + כפתור "הוסף בראש המקטע"
 *
 * כל הנתונים והפעולות מגיעים ב-props (controlled) – ה-state נמצא ב-usePartEdit.
 */

import React from "react";
import { Entity } from "@firecms/core";
import { PartEditToolbar } from "./PartEditToolbar";
import { PartItemRow } from "./PartItemRow";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type PartEditPanelProps = {
    selectedGroupId: string | null;
    saving: boolean;
    changedIds: Set<string>;
    /** יש שינויים בתרגומים המקושרים (להצגת כפתור שמירה) */
    enhancementChangedIds?: Set<string>;
    /** מספר פריטים שסומנו למחיקה (מתבצעת בשמירה) */
    pendingDeletesCount?: number;
    loading: boolean;
    allItems: Entity<any>[];
    localValues: Record<string, any>;
    enhancements: Record<string, Entity<any>[]>;
    /** ערכים מקומיים לעריכת תרגומים מקושרים */
    enhancementLocalValues?: Record<string, any>;
    onSaveGroup: () => void;
    onFinalPublish: () => void;
    onContentChange: (itemId: string, value: string) => void;
    /** עדכון שדה מאפיין של פריט (entityId, field, value) */
    onFieldChange?: (entityId: string, field: string, value: unknown) => void;
    /** עדכון שדה של תרגום מקושר (entityId, translationId, field, value) */
    onEnhancementFieldChange?: (entityId: string, translationId: string, field: string, value: unknown) => void;
    onAddNewItemAt: (index: number) => void;
    /** מוחק מקטע ואת כל התרגומים המקושרים (סימון למחיקה בשמירה) */
    onDeleteItem?: (item: Entity<any>, itemId: string) => void;
    /** פריטים שסומנו למחיקה – מוצגים עם עיצוב "ימוחק בשמירה" וכפתור החזר */
    pendingDeletes?: Array<{ entity: Entity<any>; itemId: string }>;
    /** מחזיר פריט מרשימת המחיקות המתינות */
    onRestoreItem?: (item: Entity<any>, itemId: string) => void;
    /** רק בנוסח הבסיסי (0-*) מותר להוסיף מקטעים; בשאר הנוסחים – עריכה בלבד */
    allowAddPart?: boolean;
    /** רק בתרגום (לא בסיס) מותר להוסיף הוראות – טקסט שלא מקושר לבסיס */
    allowAddInstruction?: boolean;
    /** מוסיף פריט הוראה חדש במיקום index (רק allowAddInstruction) */
    onAddNewInstructionAt?: (index: number) => void;
    /** פותח מודל הוספת תרגום לפריט */
    onAddTranslation?: (item: Entity<any>) => void;
    /** בתרגום (לא בסיס): במאפיינים לשנות סוג רק בין סוגי הוראות */
    restrictTypeToInstructions?: boolean;
    /** עריכת נוסח בסיס – במחיקה יימחקו גם כל הפריטים המקושרים בכל התרגומים */
    isBaseTranslation?: boolean;
    /** מזהה הפריט שנוסף לאחרונה – להעברת פוקוס לשדה התוכן */
    lastAddedItemId?: string | null;
    /** פותח מודל הגדרת/עריכת dateSetId בלחיצה על השדה במאפיינים */
    onOpenDateSetIdForItem?: (entityId: string, currentDateSetId: string) => void;
    /** כפתורי פיצול והעברה – רק בנוסח הבסיסי */
    allowSplitAndMove?: boolean;
    onSplitPart?: () => void;
    onMoveItemsToPart?: () => void;
    onReorderItems?: (activeId: string, overId: string) => void;
};

function SortableItemRow({
    item,
    children,
}: {
    item: Entity<any>;
    children: (dragHandleProps: { attributes: Record<string, unknown>; listeners: Record<string, unknown> }) => React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <div ref={setNodeRef} style={style}>
            {children({
                attributes: attributes as unknown as Record<string, unknown>,
                listeners: listeners as unknown as Record<string, unknown>,
            })}
        </div>
    );
}

export function PartEditPanel({
    selectedGroupId,
    saving,
    changedIds,
    enhancementChangedIds = new Set(),
    pendingDeletesCount = 0,
    loading,
    allItems,
    localValues,
    enhancements,
    enhancementLocalValues = {},
    onSaveGroup,
    onFinalPublish,
    onContentChange,
    onFieldChange,
    onEnhancementFieldChange,
    onAddNewItemAt,
    onDeleteItem,
    pendingDeletes = [],
    onRestoreItem,
    allowAddPart = true,
    allowAddInstruction = false,
    onAddNewInstructionAt,
    onAddTranslation,
    restrictTypeToInstructions = false,
    isBaseTranslation = false,
    lastAddedItemId = null,
    onOpenDateSetIdForItem,
    allowSplitAndMove = false,
    onSplitPart,
    onMoveItemsToPart,
    onReorderItems,
}: PartEditPanelProps) {
    const pendingDeleteIds = new Set(pendingDeletes.map((p) => p.entity.id));
    const hasAnyChanges = changedIds.size > 0 || enhancementChangedIds.size > 0 || pendingDeletesCount > 0;
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        onReorderItems?.(String(active.id), String(over.id));
    };

    return (
        <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
            <PartEditToolbar
                selectedGroupId={selectedGroupId}
                saving={saving}
                hasChanges={hasAnyChanges}
                onSaveGroup={onSaveGroup}
                onFinalPublish={onFinalPublish}
                allowSplitAndMove={allowSplitAndMove}
                onSplitPart={onSplitPart}
                onMoveItemsToPart={onMoveItemsToPart}
            />
            {loading ? (
                <div className="m-auto font-bold text-blue-500 animate-pulse text-lg">
                    טוען...
                </div>
            ) : (
                selectedGroupId && (
                    <div className="overflow-auto space-y-4 px-2 pb-10">
                        {/* הוספת פריט בתחילת הרשימה – רק בנוסח הבסיסי (0-*) */}
                        {allowAddPart && (
                            <button
                                type="button"
                                onClick={() => onAddNewItemAt(0)}
                                className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm"
                            >
                                + הוסף בראש המקטע
                            </button>
                        )}
                        {/* הוספת הוראה – רק בתרגום (לא בבסיס); הוראות לא מקושרות לבסיס */}
                        {allowAddInstruction && onAddNewInstructionAt && (
                            <button
                                type="button"
                                onClick={() => onAddNewInstructionAt(0)}
                                className="w-full py-2.5 px-3 rounded-lg text-sm font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 transition-colors shadow-sm"
                            >
                                + הוסף הוראה
                            </button>
                        )}
                        {/* לכל פריט: ערכים מקומיים + תרגומים מקושרים (לפי itemId/linkedItem) */}
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={allItems.map((item) => item.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {allItems.map((item, index) => {
                                    const val = localValues[item.id] || {};
                                    const curId = val.itemId;
                                    const related = Object.entries(enhancements).flatMap(
                                        ([tId, list]) =>
                                            list
                                                .filter((e) => {
                                                    const link = e.values?.linkedItem;
                                                    return Array.isArray(link)
                                                        ? link.includes(curId)
                                                        : link === curId;
                                                })
                                                .map((e) => ({ ...e, tId }))
                                    );
                                    return (
                                        <SortableItemRow key={item.id} item={item}>
                                            {(dragHandleProps) => (
                                                <PartItemRow
                                                    item={item}
                                                    localVal={val}
                                                    isChanged={changedIds.has(item.id)}
                                                    related={related}
                                                    enhancementLocalValues={enhancementLocalValues}
                                                    onEnhancementFieldChange={onEnhancementFieldChange}
                                                    isEnhancementChanged={(eid) => enhancementChangedIds.has(eid)}
                                                    onContentChange={onContentChange}
                                                    onFieldChange={onFieldChange}
                                                    onDelete={onDeleteItem}
                                                    isPendingDelete={pendingDeleteIds.has(item.id)}
                                                    onRestore={onRestoreItem}
                                                    isBaseTranslation={isBaseTranslation}
                                                    onAddAfter={
                                                        allowAddPart
                                                            ? () => onAddNewItemAt(index + 1)
                                                            : undefined
                                                    }
                                                    onAddInstructionAfter={
                                                        allowAddInstruction && onAddNewInstructionAt
                                                            ? () => onAddNewInstructionAt(index + 1)
                                                            : undefined
                                                    }
                                                    onAddTranslation={isBaseTranslation ? onAddTranslation : undefined}
                                                    restrictTypeToInstructions={restrictTypeToInstructions}
                                                    autoFocus={lastAddedItemId === item.id}
                                                    onOpenDateSetIdConfig={onOpenDateSetIdForItem}
                                                    dragHandleProps={dragHandleProps}
                                                />
                                            )}
                                        </SortableItemRow>
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    </div>
                )
            )}
        </div>
    );
}
