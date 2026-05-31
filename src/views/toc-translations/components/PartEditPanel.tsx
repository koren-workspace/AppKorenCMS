/**
 * PartEditPanel – אזור העריכה הראשי במסך
 *
 * מציג:
 *   - PartEditToolbar: כותרת/מצב חלק תפילה + "שמור חלק תפילה" (כשחלק תפילה נבחר)
 *   - במצב טעינה: "טוען..."
 *   - לאחר טעינה: רשימת פריטים (PartItemRow) + כפתור "הוסף פריט"
 *
 * כל הנתונים והפעולות מגיעים ב-props (controlled) – ה-state נמצא ב-usePartEdit.
 */

import React, { useState, useEffect, useCallback } from "react";
import { Entity } from "@firecms/core";
import { PartEditToolbar } from "./PartEditToolbar";
import { PartItemRow } from "./PartItemRow";
import { useDateSetLabels, type DateSetLabelEntry } from "../hooks/useDateSetLabels";
// ——— גרירת פריטים בתוך החלק תפילה (מושבתת זמנית) ———
// import {
//     DndContext,
//     closestCenter,
//     PointerSensor,
//     useSensor,
//     useSensors,
//     DragEndEvent,
// } from "@dnd-kit/core";
// import {
//     SortableContext,
//     verticalListSortingStrategy,
//     useSortable,
// } from "@dnd-kit/sortable";
// import { CSS } from "@dnd-kit/utilities";

export type PartEditPanelProps = {
    selectedGroupId: string | null;
    selectedTocId: string | null;
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
    onContentChange: (itemId: string, value: string) => void;
    /** עדכון שדה מאפיין של פריט (entityId, field, value) */
    onFieldChange?: (entityId: string, field: string, value: unknown) => void;
    /** עדכון שדה של תרגום מקושר (entityId, translationId, field, value) */
    onEnhancementFieldChange?: (entityId: string, translationId: string, field: string, value: unknown) => void;
    onAddNewItemAt: (index: number) => void;
    /** מוחק פריט ואת כל התרגומים המקושרים (סימון למחיקה בשמירה) */
    onDeleteItem?: (item: Entity<any>, itemId: string) => void;
    /** פריטים שסומנו למחיקה – מוצגים עם עיצוב "ימוחק בשמירה" וכפתור החזר */
    pendingDeletes?: Array<{ entity: Entity<any>; itemId: string }>;
    /** מחזיר פריט מרשימת המחיקות המתינות */
    onRestoreItem?: (item: Entity<any>, itemId: string) => void;
    /** מוחק פריט תרגום מקושר (מתצוגת בסיס) */
    onDeleteEnhancementItem?: (entityId: string, translationId: string) => void;
    /** פריטי תרגום שסומנו למחיקה */
    pendingEnhancementDeleteIds?: Set<string>;
    /** מחזיר פריט תרגום מרשימת המחיקות המתינות */
    onRestoreEnhancementItem?: (entityId: string) => void;
    /** רק בנוסח הבסיסי (0-*) מותר להוסיף חלק תפילהים; בשאר הנוסחים – עריכה בלבד */
    allowAddPart?: boolean;
    /** רק בתרגום (לא בסיס) מותר להוסיף הוראות – טקסט שלא מקושר לבסיס */
    allowAddInstruction?: boolean;
    /** מוסיף פריט הוראה חדש במיקום index (רק allowAddInstruction) */
    onAddNewInstructionAt?: (index: number) => void;
    /** פותח מודל הוספת תרגום לפריט */
    onAddTranslation?: (item: Entity<any>) => void;
    /** true = כפתור הוספת תרגום מנוטרל (פריט לא נשמר) */
    isAddTranslationBlockedForItem?: (item: Entity<any>) => boolean;
    /** בתרגום (לא בסיס): במאפיינים לשנות סוג רק בין סוגי הוראות */
    restrictTypeToInstructions?: boolean;
    /** עריכת נוסח בסיס – במחיקה יימחקו גם כל הפריטים המקושרים בכל התרגומים */
    isBaseTranslation?: boolean;
    /** מזהה התרגום הנוכחי – להצגת דיבור המתחיל רק בתרגומי פירוש */
    currentTranslationId?: string | null;
    /** מזהה הפריט שנוסף לאחרונה – להעברת פוקוס לשדה התוכן */
    lastAddedItemId?: string | null;
    /** פותח מודל הגדרת/עריכת dateSetId (פרמטר שלישי = תרגום מקושר) */
    onOpenDateSetIdForItem?: (entityId: string, currentDateSetId: string, enhancementTranslationId?: string) => void;
    /** כפתורי פיצול / העברה / העתקה – רק בנוסח הבסיסי */
    allowSplitAndMove?: boolean;
    onSplitPart?: () => void;
    onMoveItemsToPart?: () => void;
    onCopyItemsToPart?: () => void;
    onReorderItems?: (activeId: string, overId: string) => void;
    /** מקור נתונים לטעינת תיאורי dateSetId */
    dataSource?: { fetchCollection: (opts: any) => Promise<any[]>; saveEntity: (opts: any) => Promise<any> } | null;
    /**
     * רשימת dateSetIds פעילים לתאריך הנבחר (מחושב ב-useDateFilter).
     * כשערך = null: מוצגים כל הפריטים (סינון מבוטל).
     * כשערך = string[]: מוצגים רק פריטים שאין להם dateSetId, או שה-dateSetId שלהם נמצא ברשימה.
     * הסינון הוא להצגה בלבד — `allItems`, `changedIds`, שמירה ופרסום ממשיכים לפעול על כל הפריטים.
     */
    relevantDateSetIds?: string[] | null;
};

// ——— גרירת פריטים בתוך החלק תפילה (מושבתת זמנית) ———
// function SortableItemRow({
//     item,
//     children,
// }: {
//     item: Entity<any>;
//     children: (dragHandleProps: { attributes: Record<string, unknown>; listeners: Record<string, unknown> }) => React.ReactNode;
// }) {
//     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
//         id: item.id,
//     });
//     const style: React.CSSProperties = {
//         transform: CSS.Transform.toString(transform),
//         transition,
//         opacity: isDragging ? 0.5 : 1,
//     };
//     return (
//         <div ref={setNodeRef} style={style}>
//             {children({
//                 attributes: attributes as unknown as Record<string, unknown>,
//                 listeners: listeners as unknown as Record<string, unknown>,
//             })}
//         </div>
//     );
// }

export function PartEditPanel({
    selectedGroupId,
    selectedTocId,
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
    onContentChange,
    onFieldChange,
    onEnhancementFieldChange,
    onAddNewItemAt,
    onDeleteItem,
    pendingDeletes = [],
    onRestoreItem,
    onDeleteEnhancementItem,
    pendingEnhancementDeleteIds = new Set(),
    onRestoreEnhancementItem,
    allowAddPart = true,
    allowAddInstruction = false,
    onAddNewInstructionAt,
    onAddTranslation,
    isAddTranslationBlockedForItem,
    restrictTypeToInstructions = false,
    isBaseTranslation = false,
    currentTranslationId = null,
    lastAddedItemId = null,
    onOpenDateSetIdForItem,
    allowSplitAndMove = false,
    onSplitPart,
    onMoveItemsToPart,
    onCopyItemsToPart,
    onReorderItems: _onReorderItems,
    dataSource,
    relevantDateSetIds = null,
}: PartEditPanelProps) {
    const pendingDeleteIds = new Set(pendingDeletes.map((p) => p.entity.id));
    const hasAnyChanges =
        changedIds.size > 0 ||
        enhancementChangedIds.size > 0 ||
        pendingDeletesCount > 0 ||
        pendingEnhancementDeleteIds.size > 0;
    const dateSetLabels = useDateSetLabels(dataSource);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    /**
     * סינון פריטים מוצגים לפי relevantDateSetIds:
     *   - null = הצג הכל ללא סינון
     *   - string[] = הצג רק פריטים שאין להם dateSetId, או שה-dateSetId שלהם נמצא ברשימה
     *   - פריטים שסומנו כ־changed (בעריכה) נשארים גלויים תמיד
     * הסינון מבוסס על dateSetId השמור (item.values), לא על ערך ביניים בזמן הקלדה.
     */
    const visibleItems = relevantDateSetIds === null
        ? allItems
        : allItems.filter((item) => {
            // פריט בעריכה נשאר גלוי גם אם dateSetId המקומי עדיין לא תואם לסינון (למשל בעת הקלדה)
            if (changedIds.has(item.id)) return true;
            const dsId = item.values?.dateSetId as string | undefined;
            if (!dsId) return true;
            return relevantDateSetIds.includes(dsId);
        });
    const hiddenItemsCount = allItems.length - visibleItems.length;

    /**
     * מסיר ניקוד, טעמים וסימני פיסוק עבריים לפני השוואה.
     * NFKD מפרק תווים מורכבים מראש (כגון U+FB4B = ו+דגש) לאות + ניקוד נפרדים,
     * ואז הרג'קס מוחק את כל הניקוד (U+0591–U+05C7).
     */
    const stripDiacritics = (text: string) =>
        text.normalize("NFKD").replace(/[\u0591-\u05C7]/g, "");
    const normalize = (text: string) => stripDiacritics(text).toLowerCase();

    const q = normalize(searchQuery.trim());

    const itemMatches = useCallback((item: Entity<any>) => {
        if (q === "") return false;
        const val = localValues[item.id] || {};
        if (normalize(String(val.itemId ?? "")).includes(q)) return true;
        if (normalize(val.content ?? "").includes(q)) return true;
        if (normalize(val.title ?? "").includes(q)) return true;
        const curId = val.itemId;
        const relatedList = Object.values(enhancements).flatMap((list) =>
            list.filter((e) => {
                const link = e.values?.linkedItem;
                return Array.isArray(link) ? link.includes(curId) : link === curId;
            })
        );
        return relatedList.some((e) => {
            const ev = { ...e.values, ...enhancementLocalValues[e.id] };
            return normalize(ev.content ?? "").includes(q);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, localValues, enhancements, enhancementLocalValues]);

    const matchingItemIds: string[] = q === "" ? [] : visibleItems.filter(itemMatches).map((i) => i.id);
    const totalMatches = matchingItemIds.length;
    const safeIndex = totalMatches === 0 ? 0 : ((currentMatchIndex % totalMatches) + totalMatches) % totalMatches;
    const activeMatchId = matchingItemIds[safeIndex] ?? null;

    useEffect(() => { setCurrentMatchIndex(0); }, [q]);

    useEffect(() => {
        if (!activeMatchId) return;
        const el = document.getElementById(`part-item-${activeMatchId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [activeMatchId, safeIndex]);
    // ——— גרירת פריטים בתוך החלק תפילה (מושבתת זמנית) ———
    // const sensors = useSensors(
    //     useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    // );
    //
    // const handleDragEnd = (event: DragEndEvent) => {
    //     const { active, over } = event;
    //     if (!over || active.id === over.id) return;
    //     _onReorderItems?.(String(active.id), String(over.id));
    // };

    return (
        <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
            <PartEditToolbar
                selectedGroupId={selectedGroupId}
                selectedTocId={selectedTocId}
                saving={saving}
                hasChanges={hasAnyChanges}
                onSaveGroup={onSaveGroup}
                allowSplitAndMove={allowSplitAndMove}
                onSplitPart={onSplitPart}
                onMoveItemsToPart={onMoveItemsToPart}
                onCopyItemsToPart={onCopyItemsToPart}
            />
            {loading ? (
                <div className="m-auto font-bold text-blue-500 animate-pulse text-lg">
                    טוען...
                </div>
            ) : (
                selectedGroupId && (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* חיפוש טקסט בפריטים – קבוע למעלה, לא גולל */}
                        <div className="flex items-center gap-2 pb-2 shrink-0">
                            <div className="relative flex-1">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            setCurrentMatchIndex((i) => (i + 1) % Math.max(totalMatches, 1));
                                        }
                                    }}
                                    placeholder="חיפוש בטקסט פריטים..."
                                    className="w-full pr-8 pl-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                    dir="rtl"
                                    aria-label="חיפוש בפריטים"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none select-none">🔍</span>
                            </div>
                            {q !== "" && totalMatches === 0 && (
                                <span className="text-xs text-red-500 whitespace-nowrap shrink-0">לא נמצא</span>
                            )}
                            {q !== "" && totalMatches > 0 && (
                                <>
                                    <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 tabular-nums">
                                        {safeIndex + 1} / {totalMatches}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)}
                                        className="px-2 py-1 text-gray-600 hover:bg-gray-100 border border-gray-300 rounded text-sm leading-none"
                                        title="התאמה קודמת"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentMatchIndex((i) => (i + 1) % totalMatches)}
                                        className="px-2 py-1 text-gray-600 hover:bg-gray-100 border border-gray-300 rounded text-sm leading-none"
                                        title="התאמה הבאה"
                                    >
                                        ▼
                                    </button>
                                </>
                            )}
                        </div>
                    <div className="overflow-auto flex-1 space-y-4 px-2 pb-10">
                        {/* הוספת פריט בתחילת הרשימה – רק בנוסח הבסיסי (0-*) */}
                        {allowAddPart && q === "" && (
                            <button
                                type="button"
                                onClick={() => onAddNewItemAt(0)}
                                className="w-full px-3 py-1 rounded text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                                + הוסף פריט
                            </button>
                        )}
                        {/* הוספת הוראה – רק בתרגום (לא בבסיס); הוראות לא מקושרות לבסיס */}
                        {allowAddInstruction && onAddNewInstructionAt && q === "" && (
                            <button
                                type="button"
                                onClick={() => onAddNewInstructionAt(0)}
                                className="w-full px-3 py-1 rounded text-sm font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-colors"
                            >
                                + הוסף הוראה
                            </button>
                        )}
                        {/* הודעה כשיש פריטים מוסתרים בסינון */}
                        {hiddenItemsCount > 0 && (
                            <div
                                className="text-sm text-gray-700 px-3 py-2 rounded bg-amber-50 border border-amber-200"
                                role="status"
                                aria-live="polite"
                            >
                                <span className="font-semibold">{hiddenItemsCount}</span> פריטים מוסתרים בגלל סינון לפי תאריך.
                                הם עדיין נשמרים ויפורסמו כרגיל; כדי לראות אותם — לחץ על "הצג הכל ללא סינון" בסרגל העליון.
                            </div>
                        )}
                        {/* לכל פריט: ערכים מקומיים + תרגומים מקושרים (לפי itemId/linkedItem).
                            iterate על visibleItems, אבל את index ברשימה המלאה לוקחים מ-allItems
                            כדי ש-onAddNewItemAt יקבל מיקום נכון בתוך allItems */}
                        {visibleItems.map((item) => {
                            const fullIndex = allItems.indexOf(item);
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
                            const isActive = activeMatchId === item.id;
                            const isMatch = q !== "" && matchingItemIds.includes(item.id);
                            return (
                                <div
                                    key={item.id}
                                    id={`part-item-${item.id}`}
                                    className={
                                        isActive
                                            ? "rounded-lg ring-2 ring-yellow-400 ring-offset-1"
                                            : isMatch
                                            ? "rounded-lg ring-1 ring-yellow-200"
                                            : undefined
                                    }
                                >
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
                                        currentTranslationId={currentTranslationId}
                                        onAddAfter={
                                            allowAddPart
                                                ? () => onAddNewItemAt(fullIndex + 1)
                                                : undefined
                                        }
                                        onAddInstructionAfter={
                                            allowAddInstruction && onAddNewInstructionAt
                                                ? () => onAddNewInstructionAt(fullIndex + 1)
                                                : undefined
                                        }
                                        onAddTranslation={isBaseTranslation ? onAddTranslation : undefined}
                                        isAddTranslationBlocked={
                                            isBaseTranslation && isAddTranslationBlockedForItem
                                                ? isAddTranslationBlockedForItem(item)
                                                : false
                                        }
                                        restrictTypeToInstructions={restrictTypeToInstructions}
                                        autoFocus={lastAddedItemId === item.id}
                                        onOpenDateSetIdConfig={onOpenDateSetIdForItem}
                                        dateSetLabels={dateSetLabels}
                                        onDeleteEnhancementItem={
                                            isBaseTranslation ? onDeleteEnhancementItem : undefined
                                        }
                                        pendingEnhancementDeleteIds={pendingEnhancementDeleteIds}
                                        onRestoreEnhancementItem={
                                            isBaseTranslation ? onRestoreEnhancementItem : undefined
                                        }
                                    />
                                </div>
                            );
                        })}
                        {/*
                        גרירת פריטים בתוך החלק תפילה (מושבתת זמנית) — הקוד המקורי:
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
                                                    currentTranslationId={currentTranslationId}
                                                    onAddAfter={
                                                        allowAddPart
                                                            ? () => onAddNewItemAt(index + 1)
                                                            : undefined
                                                    }
                                                    onAddParagraphAfter={
                                                        allowAddPart && onAddNewParagraphAt
                                                            ? () => onAddNewParagraphAt(index + 1)
                                                            : undefined
                                                    }
                                                    onAddInstructionAfter={
                                                        allowAddInstruction && onAddNewInstructionAt
                                                            ? () => onAddNewInstructionAt(index + 1)
                                                            : undefined
                                                    }
                                                    onAddTranslation={isBaseTranslation ? onAddTranslation : undefined}
                                                    isAddTranslationBlocked={
                                                        isBaseTranslation && isAddTranslationBlockedForItem
                                                            ? isAddTranslationBlockedForItem(item)
                                                            : false
                                                    }
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
                        */}
                    </div>
                    </div>
                )
            )}
        </div>
    );
}
