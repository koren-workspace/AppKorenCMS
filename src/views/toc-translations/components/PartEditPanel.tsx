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

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Entity } from "@firecms/core";
import { PartEditToolbar } from "./PartEditToolbar";
import { PartItemRow } from "./PartItemRow";
import { WarehousePasteModal } from "./WarehousePasteModal";
import type { WarehouseEntry, WarehouseFieldSelection } from "../types/itemWarehouse";
import { useDateSetLabels, type DateSetLabelEntry } from "../hooks/useDateSetLabels";
import { normalizeForSearch, stripHtml } from "../services/globalSearchService";

/** בקשה לסמן פריט אחרי ניווט מחיפוש מורחב (nonce – כדי שלחיצה חוזרת על אותה תוצאה תפעל שוב) */
export type PartFocusRequest = { docId: string; query: string; nonce: number };

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
    /** מקור נתונים לטעינת תיאורי dateSetId */
    dataSource?: { fetchCollection: (opts: any) => Promise<any[]>; saveEntity: (opts: any) => Promise<any> } | null;
    /** עולה אחרי עדכון סט תאריכים קיים – טוען מחדש את תיאורי ה-badges */
    calendarVersion?: number;
    /**
     * רשימת dateSetIds פעילים לתאריך הנבחר (מחושב ב-useDateFilter).
     * כשערך = null: מוצגים כל הפריטים (סינון מבוטל).
     * כשערך = string[]: מוצגים רק פריטים שאין להם dateSetId, או שה-dateSetId שלהם נמצא ברשימה.
     * הסינון הוא להצגה בלבד — `allItems`, `changedIds`, שמירה ופרסום ממשיכים לפעול על כל הפריטים.
     */
    relevantDateSetIds?: string[] | null;
    warehouseEnabled?: boolean;
    warehouseEntries?: WarehouseEntry[];
    warehouseSelectedEntryId?: string | null;
    onWarehouseSelectEntry?: (id: string) => void;
    onSaveItemToWarehouse?: (item: Entity<any>) => void;
    /** שמירת כמה פריטי בסיס כרשומה אחת במחסן; מחזיר true אם נשמרו */
    onSaveItemsToWarehouse?: (items: Entity<any>[]) => boolean;
    onOpenWarehousePasteAt?: (insertAfterItemId: string | null) => void;
    onPasteFromWarehouse?: (params: {
        entryId: string;
        insertAfterItemId: string | null;
        selection: WarehouseFieldSelection;
    }) => void;
    /** Prod dual-write */
    pendingProdItemIds?: Set<string>;
    onSavePartToProd?: () => void;
    pendingProdCount?: number;
    /** סימון פריט שנבחר בחיפוש המורחב */
    focusRequest?: PartFocusRequest | null;
    warehousePasteModalOpen?: boolean;
    warehouseFixedInsertAfterItemId?: string | null | undefined;
    onCloseWarehousePasteModal?: () => void;
};

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
    dataSource,
    calendarVersion = 0,
    relevantDateSetIds = null,
    warehouseEnabled = false,
    warehouseEntries = [],
    warehouseSelectedEntryId = null,
    onWarehouseSelectEntry,
    onSaveItemToWarehouse,
    onSaveItemsToWarehouse,
    onOpenWarehousePasteAt,
    onPasteFromWarehouse,
    warehousePasteModalOpen = false,
    warehouseFixedInsertAfterItemId = undefined,
    onCloseWarehousePasteModal,
    pendingProdItemIds = new Set(),
    onSavePartToProd,
    pendingProdCount = 0,
    focusRequest = null,
}: PartEditPanelProps) {
    const pendingDeleteIds = new Set(pendingDeletes.map((p) => p.entity.id));
    const hasAnyChanges =
        changedIds.size > 0 ||
        enhancementChangedIds.size > 0 ||
        pendingDeletesCount > 0 ||
        pendingEnhancementDeleteIds.size > 0;
    const dateSetLabels = useDateSetLabels(dataSource, calendarVersion);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    // בחירה מרובה של פריטי בסיס לשמירה במחסן כרשומה אחת
    const multiSelectAvailable = isBaseTranslation && warehouseEnabled && !!onSaveItemsToWarehouse;
    const [multiSelectMode, setMultiSelectMode] = useState(false);
    const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
    const exitMultiSelect = () => {
        setMultiSelectMode(false);
        setMultiSelectedIds(new Set());
    };
    useEffect(() => {
        exitMultiSelect();
    }, [selectedGroupId, selectedTocId, isBaseTranslation]);
    const toggleMultiSelected = (id: string) =>
        setMultiSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

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
     * אותה השוואה כמו בחיפוש המורחב: מתעלמת מניקוד, טעמים, תגיות HTML ורווחים
     * כפולים, ומקף עברי נחשב רווח – כך ש"עץ חיים" מוצא גם "עֵץ־חַיִּים".
     */
    const normalize = (text: string) => normalizeForSearch(stripHtml(text));

    const q = normalize(searchQuery.trim());

    const itemMatches = useCallback((item: Entity<any>) => {
        if (q === "") return false;
        const val = localValues[item.id] || {};
        if (normalize(String(val.itemId ?? "")).includes(q)) return true;
        if (normalize(val.content ?? "").includes(q)) return true;
        if (normalize(val.title ?? "").includes(q)) return true;
        if (normalize(val.reference ?? "").includes(q)) return true;
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

    /*
     * חיפוש מורחב: אחרי שהמקטע נטען – ממלאים את חיפוש המקטע באותה שאילתה (כך שגם
     * שאר ההתאמות במקטע מסומנות) והופכים את הפריט שנבחר להתאמה הפעילה.
     * חייב לבוא אחרי האיפוס של currentMatchIndex למעלה (אותו commit, סדר הצהרה).
     */
    const [pendingFocusDocId, setPendingFocusDocId] = useState<string | null>(null);
    const [flashItemId, setFlashItemId] = useState<string | null>(null);
    const [focusNotice, setFocusNotice] = useState<string | null>(null);
    const handledFocusNonceRef = useRef<number | null>(null);
    useEffect(() => {
        if (!focusRequest || loading) return;
        if (handledFocusNonceRef.current === focusRequest.nonce) return;
        if (!allItems.some((item) => item.id === focusRequest.docId)) return;
        handledFocusNonceRef.current = focusRequest.nonce;
        setSearchQuery(focusRequest.query);
        setPendingFocusDocId(focusRequest.docId);
        setFocusNotice(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusRequest?.nonce, loading, allItems]);
    useEffect(() => {
        if (!pendingFocusDocId) return;
        setPendingFocusDocId(null);
        const idx = matchingItemIds.indexOf(pendingFocusDocId);
        if (idx >= 0) {
            setCurrentMatchIndex(idx);
            return;
        }
        // ההתאמה בשדה שחיפוש המקטע לא בודק (למשל מקורות), או שהפריט מוסתר בסינון התאריך
        if (visibleItems.some((item) => item.id === pendingFocusDocId)) {
            setFlashItemId(pendingFocusDocId);
            document
                .getElementById(`part-item-${pendingFocusDocId}`)
                ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            setFocusNotice("הפריט שנבחר בחיפוש מוסתר בגלל סינון התאריך – לחצו \"הצג הכל ללא סינון\" כדי לראות אותו.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingFocusDocId, matchingItemIds.join("|")]);
    useEffect(() => {
        setFlashItemId(null);
        setFocusNotice(null);
    }, [selectedGroupId]);

    const selectableVisibleIds = visibleItems
        .filter((item) => !pendingDeleteIds.has(item.id))
        .map((item) => item.id);
    // נשמרים לפי סדר הרשימה המלאה; פריטים שסומנו למחיקה לא נשמרים
    const multiSelectedItems = allItems.filter(
        (item) => multiSelectedIds.has(item.id) && !pendingDeleteIds.has(item.id)
    );
    const allVisibleSelected =
        selectableVisibleIds.length > 0 &&
        selectableVisibleIds.every((id) => multiSelectedIds.has(id));

    useEffect(() => {
        if (!activeMatchId) return;
        const el = document.getElementById(`part-item-${activeMatchId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [activeMatchId, safeIndex]);

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
                onSavePartToProd={onSavePartToProd}
                pendingProdCount={pendingProdCount}
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
                    {multiSelectAvailable && (
                        <div className="flex items-center gap-2 flex-wrap px-2 pb-2 text-sm" dir="rtl">
                            {!multiSelectMode ? (
                                <button
                                    type="button"
                                    onClick={() => setMultiSelectMode(true)}
                                    className="px-2 py-1 rounded border border-violet-200 text-violet-800 bg-white hover:bg-violet-50 text-xs font-semibold"
                                    title="סמן כמה פריטים ושמור אותם יחד כרשומה אחת במחסן"
                                >
                                    בחירה מרובה למחסן
                                </button>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap w-full px-2 py-1.5 rounded border border-violet-300 bg-violet-50">
                                    <span className="font-semibold text-violet-900">
                                        נבחרו {multiSelectedItems.length} פריטים
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setMultiSelectedIds((prev) => {
                                                const next = new Set(prev);
                                                if (allVisibleSelected) {
                                                    selectableVisibleIds.forEach((id) => next.delete(id));
                                                } else {
                                                    selectableVisibleIds.forEach((id) => next.add(id));
                                                }
                                                return next;
                                            })
                                        }
                                        disabled={selectableVisibleIds.length === 0}
                                        className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs disabled:opacity-50"
                                    >
                                        {allVisibleSelected ? "בטל הכל" : "בחר הכל"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (onSaveItemsToWarehouse?.(multiSelectedItems)) {
                                                exitMultiSelect();
                                            }
                                        }}
                                        disabled={multiSelectedItems.length === 0}
                                        className="px-2 py-0.5 rounded bg-violet-600 text-white hover:bg-violet-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="שמור את הפריטים הנבחרים (עם התרגומים המקושרים) כרשומה אחת במחסן"
                                    >
                                        שמור {multiSelectedItems.length} במחסן
                                    </button>
                                    <button
                                        type="button"
                                        onClick={exitMultiSelect}
                                        className="px-2 py-0.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 text-xs"
                                    >
                                        ביטול
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="overflow-auto flex-1 space-y-4 px-2 pb-10">
                        {/* הוספת פריט בתחילת הרשימה – רק בנוסח הבסיסי (0-*) */}
                        {allowAddPart && q === "" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                <button
                                    type="button"
                                    onClick={() => onAddNewItemAt(0)}
                                    className="w-full px-3 py-1 rounded text-sm font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                >
                                    + הוסף פריט
                                </button>
                                {warehouseEnabled && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenWarehousePasteAt?.(null)}
                                        className="w-full px-3 py-1 rounded text-sm font-semibold bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100 transition-colors"
                                    >
                                        + הוסף מהמחסן
                                    </button>
                                )}
                            </div>
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
                        {focusNotice && (
                            <div className="mb-2 px-3 py-2 rounded border border-amber-300 bg-amber-50 text-amber-900 text-xs shrink-0">
                                {focusNotice}
                            </div>
                        )}
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
                            const showSelectBox = multiSelectAvailable && multiSelectMode;
                            const isMultiSelected = multiSelectedIds.has(item.id);
                            const isSelectDisabled = pendingDeleteIds.has(item.id);
                            const highlightClass = isActive || flashItemId === item.id
                                ? "rounded-lg ring-2 ring-yellow-400 ring-offset-1"
                                : isMatch
                                ? "rounded-lg ring-1 ring-yellow-200"
                                : showSelectBox && isMultiSelected
                                ? "rounded-lg ring-2 ring-violet-400"
                                : "";
                            return (
                                <div
                                    key={item.id}
                                    id={`part-item-${item.id}`}
                                    className={
                                        [highlightClass, showSelectBox ? "flex items-start gap-2" : ""]
                                            .filter(Boolean)
                                            .join(" ") || undefined
                                    }
                                >
                                    {showSelectBox && (
                                        <input
                                            type="checkbox"
                                            className="mt-3 h-4 w-4 shrink-0 accent-violet-600 cursor-pointer disabled:cursor-not-allowed"
                                            checked={isMultiSelected && !isSelectDisabled}
                                            disabled={isSelectDisabled}
                                            onChange={() => toggleMultiSelected(item.id)}
                                            title={
                                                isSelectDisabled
                                                    ? "פריט שסומן למחיקה לא נשמר במחסן"
                                                    : "סמן לשמירה במחסן"
                                            }
                                            aria-label={`סמן פריט ${String(val.itemId ?? "")} לשמירה במחסן`}
                                        />
                                    )}
                                    <div className={showSelectBox ? "flex-1 min-w-0" : undefined}>
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
                                        onAddFromWarehouseAfter={
                                            allowAddPart && warehouseEnabled
                                                ? () => {
                                                    // משתמשים בערך השרת בלבד — insertAfterItemId חייב להיות קיים ב-Firestore
                                                    const afterItemId =
                                                        String(item.values?.itemId ?? "").trim() || null;
                                                    onOpenWarehousePasteAt?.(afterItemId);
                                                }
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
                                        onSaveToWarehouse={
                                            isBaseTranslation && warehouseEnabled
                                                ? onSaveItemToWarehouse
                                                : undefined
                                        }
                                        isPendingProd={pendingProdItemIds.has(item.id)}
                                        pendingProdItemIds={pendingProdItemIds}
                                    />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    </div>
                )
            )}
            {warehouseEnabled && onWarehouseSelectEntry && onPasteFromWarehouse && onCloseWarehousePasteModal && (
                <WarehousePasteModal
                    open={warehousePasteModalOpen}
                    entries={warehouseEntries}
                    selectedEntryId={warehouseSelectedEntryId}
                    onSelectEntry={onWarehouseSelectEntry}
                    items={allItems}
                    localValues={localValues}
                    saving={saving}
                    onClose={onCloseWarehousePasteModal}
                    fixedInsertAfterItemId={warehouseFixedInsertAfterItemId}
                    onSubmit={onPasteFromWarehouse}
                />
            )}
        </div>
    );
}
