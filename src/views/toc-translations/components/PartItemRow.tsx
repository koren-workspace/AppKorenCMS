/**
 * PartItemRow – שורת פריט בודדת ברשימת העריכה
 *
 * מציג:
 *   - כרטיס: itemId, זמן עדכון + textarea לתוכן (עם עיצוב לפי type)
 *   - בלוק מאפיינים (סוג, כותרת, גופן, תפקיד, וכו') – ניתן להרחבה
 *   - בלוק "תרגומים מקושרים": פריטים מתרגומים אחרים שמקושרים ל-itemId (linkedItem) – ניתן לעריכה
 *   - כפתור "הוסף פריט" / "הוסף הוראה כאן" / "הוסף תרגום לטקסט זה"
 *
 * קומפוננטה תצוגתית – כל הנתונים וה-callbacks ב-props.
 */

import React, { useState, useRef, useEffect } from "react";
import type { DateSetLabelEntry } from "../hooks/useDateSetLabels";
import { Entity } from "@firecms/core";
import { contentUsesRtlAlignment, getItemStyle } from "../utils/itemUtils";
import {
    ITEM_TYPE_OPTIONS,
    INSTRUCTION_TYPE_OPTIONS,
    TITLE_TYPE_OPTIONS,
    ITEM_FIELD_HELP,
    showDiburHamatkhilField,
    supportsAttachedMeta,
    supportsFirstInPage,
    supportsHebrewBodyOnlyFields,
    supportsNoSpace,
} from "../constants/itemFields";

/** פריט מתרגום אחר שמקושר לפריט הנוכחי (לפי linkedItem); tId = מזהה התרגום */
export type RelatedEntry = { id: string; tId: string; values: any };

type PartItemRowProps = {
    item: Entity<any>;
    localVal: Record<string, any>;
    isChanged: boolean;
    related: RelatedEntry[];
    /** ערכים מקומיים לעריכת תרגומים מקושרים (entityId -> values) */
    enhancementLocalValues?: Record<string, any>;
    /** עדכון שדה של תרגום מקושר (entityId, translationId, field, value) */
    onEnhancementFieldChange?: (entityId: string, translationId: string, field: string, value: unknown) => void;
    /** האם פריט תרגום מקושר סומן כ־שונה (לשמירה) */
    isEnhancementChanged?: (entityId: string) => boolean;
    onContentChange: (itemId: string, value: string) => void;
    /** עדכון שדה מאפיין (entityId, fieldName, value) */
    onFieldChange?: (entityId: string, field: string, value: unknown) => void;
    /** מוחק את הפריט ואת כל התרגומים המקושרים */
    onDelete?: (item: Entity<any>, itemId: string) => void;
    /** פריט סומן למחיקה (ימוחק בשמירה) – מציג עיצוב מודגש וכפתור "החזר" */
    isPendingDelete?: boolean;
    /** מחזיר פריט מרשימת המחיקות המתינות */
    onRestore?: (item: Entity<any>, itemId: string) => void;
    /** עריכת פריט בסיס – במחיקה יימחקו גם כל הפריטים המקושרים בכל התרגומים */
    isBaseTranslation?: boolean;
    /** מזהה התרגום הנוכחי – להצגת דיבור המתחיל רק בתרגומי פירוש (2 ספרות) */
    currentTranslationId?: string | null;
    /** מוצג רק בנוסח הבסיסי (0-*); בשאר הנוסחים – עריכה בלבד */
    onAddAfter?: () => void;
    /** מוצג רק בתרגום: הוסף פריט הוראה אחרי שורה זו */
    onAddInstructionAfter?: () => void;
    /** פותח מודל הוספת תרגום לפריט הזה */
    onAddTranslation?: (item: Entity<any>) => void;
    /** מנוטרל עד שמירת פריט (פריט חדש) */
    isAddTranslationBlocked?: boolean;
    /** בתרגום (לא בסיס): במאפיינים סוג ניתן לשינוי רק בין סוגי הוראות */
    restrictTypeToInstructions?: boolean;
    /** העברת פוקוס לשדה התוכן (לפריט שנוסף זה עתה) */
    autoFocus?: boolean;
    /** פותח מודל הגדרת/עריכת dateSetId; אם enhancementTranslationId – עריכה בפריט תרגום מקושר */
    onOpenDateSetIdConfig?: (entityId: string, currentDateSetId: string, enhancementTranslationId?: string) => void;
    /** מפה dateSetId → { short, full } (נטענת פעם אחת מה-calendar collection) */
    dateSetLabels?: Record<string, DateSetLabelEntry>;
    // ——— גרירת פריט בתוך המקטע (מושבתת זמנית) ———
    // /** props לידית גרירה */
    // dragHandleProps?: {
    //     attributes?: Record<string, unknown>;
    //     listeners?: Record<string, unknown>;
    // };
};

export function PartItemRow({
    item,
    localVal,
    isChanged,
    related,
    enhancementLocalValues = {},
    onEnhancementFieldChange,
    isEnhancementChanged,
    onContentChange,
    onFieldChange,
    onDelete,
    isPendingDelete = false,
    onRestore,
    isBaseTranslation = false,
    currentTranslationId = null,
    onAddAfter,
    onAddInstructionAfter,
    onAddTranslation,
    isAddTranslationBlocked = false,
    restrictTypeToInstructions = false,
    autoFocus = false,
    onOpenDateSetIdConfig,
    dateSetLabels = {},
    // dragHandleProps,
}: PartItemRowProps) {
    const curId = localVal.itemId;
    const isDateRestricted = !!localVal.dateSetId && localVal.dateSetId !== "100";
    const dateSetEntry = isDateRestricted ? (dateSetLabels[localVal.dateSetId] ?? null) : null;
    const dateSetShort = dateSetEntry?.short ?? (isDateRestricted ? `ID ${localVal.dateSetId}` : null);
    const dateSetFull = dateSetEntry?.full ?? dateSetShort;
    const [showProps, setShowProps] = useState(false);
    const [showEnhancementProps, setShowEnhancementProps] = useState<Record<string, boolean>>({});
    const entityId = item.id;
    const currentType = (localVal.type ?? "body") as string;
    const showHebrewBodyOnly = supportsHebrewBodyOnlyFields(currentType, isBaseTranslation);
    const showNoSpace = supportsNoSpace(currentType);
    const showFirstInPage = supportsFirstInPage(currentType);
    const showAttachedMeta = supportsAttachedMeta(currentType);
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const mainContentRtl = contentUsesRtlAlignment(localVal.content);

    useEffect(() => {
        if (!autoFocus) return;
        const t = setTimeout(() => {
            contentTextareaRef.current?.focus();
            contentTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
        return () => clearTimeout(t);
    }, [autoFocus]);

    return (
        <React.Fragment>
            <div
                className={`p-2 border rounded ${isPendingDelete ? "bg-red-50 border-red-300 border-2 opacity-95" : isChanged ? "border-orange-300" : isDateRestricted ? "border-violet-300 bg-violet-50/40" : "border-gray-200"}`}
            >
                {isPendingDelete && (
                    <div className="flex items-center gap-2 mb-2 py-2 px-2 bg-red-100 border border-red-300 rounded text-base font-bold text-red-800">
                        <span>
                            ימוחק בשמירה
                            {related.length > 0 && (
                                <span className="font-normal text-red-700 mr-1">
                                    {" "}(כולל {related.length} פריט{related.length !== 1 ? "ים" : ""} בתרגומים אחרים)
                                </span>
                            )}
                        </span>
                        {onRestore && (
                            <button
                                type="button"
                                onClick={() => onRestore(item, curId ?? item.id)}
                                className="px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold leading-none"
                                title="החזר – לא יימחק בשמירה"
                            >
                                החזר
                            </button>
                        )}
                    </div>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500 mb-1 uppercase tracking-tight gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="item-en-ltr text-xs shrink-0">itemId: {curId}</span>
                        {isDateRestricted && (
                            <div className="relative group shrink-0 normal-case tracking-normal">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-violet-100 border border-violet-400 text-violet-800 cursor-default select-none whitespace-nowrap">
                                    מוגבל לתאריכים
                                </span>
                                <div className="absolute bottom-full right-0 mb-1.5 z-50 invisible group-hover:visible bg-white border border-violet-300 rounded-lg shadow-xl p-3 min-w-[220px] max-w-[340px] pointer-events-none">
                                    {dateSetShort && (
                                        <div className="font-bold text-violet-800 text-sm mb-1.5 text-right leading-snug">
                                            {dateSetShort}
                                        </div>
                                    )}
                                    {dateSetFull && dateSetFull !== dateSetShort && (
                                        <div className="text-gray-700 text-xs text-right leading-relaxed mb-1.5 whitespace-pre-wrap">
                                            {dateSetFull}
                                        </div>
                                    )}
                                    <div className="text-gray-400 text-xs item-en-ltr border-t border-gray-100 pt-1 mt-1">
                                        ID: {localVal.dateSetId}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {onFieldChange && (
                            <button
                                type="button"
                                onClick={() => setShowProps((p) => !p)}
                                className="inline-flex items-center px-2 py-0.5 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded text-sm leading-none whitespace-nowrap"
                            >
                                {showProps ? "הסתר מאפיינים" : "מאפיינים"}
                            </button>
                        )}
                        {/* ——— גרירת פריט בתוך המקטע (מושבתת זמנית) ———
                        {dragHandleProps && (
                            <button
                                type="button"
                                {...(dragHandleProps.attributes ?? {})}
                                {...(dragHandleProps.listeners ?? {})}
                                className="px-2 py-1 text-gray-500 hover:bg-gray-100 border border-gray-200 rounded text-sm cursor-grab active:cursor-grabbing touch-none"
                                title="גרור לשינוי סדר"
                                tabIndex={-1}
                            >
                                ⠿
                            </button>
                        )}
                        */}
                        {onDelete && !isPendingDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    const msg = isBaseTranslation && related.length > 0
                                        ? `למחוק את הפריט ואת כל ${related.length} התרגומים המקושרים אליו?\n(יסומנו כ-deleted בכל הנוסחים)`
                                        : isBaseTranslation
                                            ? "למחוק את הפריט?"
                                            : "למחוק את הפריט? (תרגום זה בלבד)";
                                    if (window.confirm(msg))
                                        onDelete(item, curId ?? item.id);
                                }}
                                className="inline-flex items-center px-2 py-0.5 text-red-600 hover:bg-red-50 border border-red-200 rounded text-sm font-bold leading-none whitespace-nowrap"
                                title={isBaseTranslation && related.length > 0 ? "מחק פריט וכל התרגומים המקושרים בכל הנוסחים" : "מחק פריט"}
                            >
                                מחק פריט
                            </button>
                        )}
                        <span className="item-en-ltr text-xs">
                            Update:{" "}
                            {localVal.timestamp
                                ? new Date(localVal.timestamp).toLocaleTimeString()
                                : "Never"}
                        </span>
                    </div>
                </div>
                {showProps && onFieldChange && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 p-2 bg-gray-50 rounded text-base">
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.type}>
                            <span className="text-gray-600 w-20 shrink-0">סוג</span>
                            {restrictTypeToInstructions && !INSTRUCTION_TYPE_OPTIONS.some((o) => o.value === (localVal.type ?? "body")) ? (
                                <span className="border border-gray-200 bg-gray-100 text-gray-500 rounded px-1 py-0.5 flex-1 min-w-0 text-base">
                                    {ITEM_TYPE_OPTIONS.find((o) => o.value === (localVal.type ?? "body"))?.label ?? (localVal.type ?? "body")}
                                </span>
                            ) : (
                                <select
                                    value={localVal.type ?? "body"}
                                    onChange={(e) => onFieldChange(entityId, "type", e.target.value)}
                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                >
                                    {(restrictTypeToInstructions ? INSTRUCTION_TYPE_OPTIONS : ITEM_TYPE_OPTIONS).map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            )}
                        </label>
                        {(localVal.type ?? "body") === "title" && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.titleType}>
                                <span className="text-gray-600 w-20 shrink-0">סוג כותרת</span>
                                {restrictTypeToInstructions ? (
                                    <span className="border border-gray-200 bg-gray-100 text-gray-500 rounded px-1 py-0.5 flex-1 min-w-0 text-base">
                                        {TITLE_TYPE_OPTIONS.find((o) => o.value === (localVal.titleType ?? ""))?.label ?? (localVal.titleType || "—")}
                                    </span>
                                ) : (
                                    <select
                                        value={localVal.titleType ?? ""}
                                        onChange={(e) => onFieldChange(entityId, "titleType", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    >
                                        {TITLE_TYPE_OPTIONS.map((o) => (
                                            <option key={o.value || "_"} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                )}
                            </label>
                        )}
                        {showDiburHamatkhilField(localVal.type, currentTranslationId) && (
                            <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.titleCommentary}>
                                <span className="text-gray-600 w-20 shrink-0">דיבור המתחיל</span>
                                <input
                                    type="text"
                                    value={localVal.title ?? ""}
                                    onChange={(e) => onFieldChange(entityId, "title", e.target.value)}
                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    dir="rtl"
                                />
                            </label>
                        )}
                        {showHebrewBodyOnly && (
                            <>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.fontTanach}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.fontTanach}
                                        onChange={(e) => onFieldChange(entityId, "fontTanach", e.target.checked)}
                                    />
                                    <span className="text-gray-600">גופן תנ"ך</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.bold}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.bold}
                                        onChange={(e) => onFieldChange(entityId, "bold", e.target.checked)}
                                    />
                                    <span className="text-gray-600">גופן מודגש</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.centerAlign}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.centerAlign}
                                        onChange={(e) => onFieldChange(entityId, "centerAlign", e.target.checked)}
                                    />
                                    <span className="text-gray-600">מיושר לאמצע</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.lineLine}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.lineLine}
                                        onChange={(e) => onFieldChange(entityId, "lineLine", e.target.checked)}
                                    />
                                    <span className="text-gray-600">שורה שורה</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.red}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.red}
                                        onChange={(e) => onFieldChange(entityId, "red", e.target.checked)}
                                    />
                                    <span className="text-gray-600">טקסט אדום</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.justifyBlock}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.justifyBlock}
                                        onChange={(e) => onFieldChange(entityId, "justifyBlock", e.target.checked)}
                                    />
                                    <span className="text-gray-600">יישור בלוק</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                                    <input
                                        type="checkbox"
                                        checked={!!localVal.block}
                                        onChange={(e) => onFieldChange(entityId, "block", e.target.checked)}
                                    />
                                    <span className="text-gray-600">פיסקה</span>
                                </label>
                            </>
                        )}
                        {showNoSpace && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                                <input
                                    type="checkbox"
                                    checked={!!localVal.noSpace}
                                    onChange={(e) => onFieldChange(entityId, "noSpace", e.target.checked)}
                                />
                                <span className="text-gray-600">ללא רווח</span>
                            </label>
                        )}
                        {showFirstInPage && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                                <input
                                    type="checkbox"
                                    checked={!!localVal.firstInPage}
                                    onChange={(e) => onFieldChange(entityId, "firstInPage", e.target.checked)}
                                />
                                <span className="text-gray-600">ראשון בעמוד</span>
                            </label>
                        )}
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialDate}>
                            <input
                                type="checkbox"
                                checked={!!localVal.specialDate}
                                onChange={(e) => onFieldChange(entityId, "specialDate", e.target.checked)}
                            />
                            <span className="text-gray-600">תאריך מיוחד</span>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.cohanim}>
                            <span className="text-gray-600 w-20 shrink-0">כהנים</span>
                            <select
                                value={localVal.cohanim === null || localVal.cohanim === undefined ? "" : localVal.cohanim ? "true" : "false"}
                                onChange={(e) => onFieldChange(entityId, "cohanim", e.target.value === "" ? null : e.target.value === "true")}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                            >
                                <option value="">לא מוגדר</option>
                                <option value="true">כן</option>
                                <option value="false">לא</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.hazan}>
                            <span className="text-gray-600 w-20 shrink-0">חזן</span>
                            <select
                                value={localVal.hazan === null || localVal.hazan === undefined ? "" : localVal.hazan ? "true" : "false"}
                                onChange={(e) => onFieldChange(entityId, "hazan", e.target.value === "" ? null : e.target.value === "true")}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                            >
                                <option value="">לא מוגדר</option>
                                <option value="true">כן</option>
                                <option value="false">לא</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.minyan}>
                            <span className="text-gray-600 w-20 shrink-0">מניין</span>
                            <select
                                value={localVal.minyan === null || localVal.minyan === undefined ? "" : localVal.minyan ? "true" : "false"}
                                onChange={(e) => onFieldChange(entityId, "minyan", e.target.value === "" ? null : e.target.value === "true")}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                            >
                                <option value="">לא מוגדר</option>
                                <option value="true">כן</option>
                                <option value="false">לא</option>
                            </select>
                        </label>
                        {showAttachedMeta && (
                            <>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.role}>
                                    <span className="text-gray-600 w-20 shrink-0">תפקיד</span>
                                    <input
                                        type="text"
                                        value={localVal.role ?? ""}
                                        onChange={(e) => onFieldChange(entityId, "role", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                        dir="rtl"
                                    />
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.reference}>
                                    <span className="text-gray-600 w-20 shrink-0">מקורות</span>
                                    <input
                                        type="text"
                                        value={localVal.reference ?? ""}
                                        onChange={(e) => onFieldChange(entityId, "reference", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    />
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialSign}>
                                    <span className="text-gray-600 w-20 shrink-0">סימן מיוחד</span>
                                    <input
                                        type="text"
                                        value={localVal.specialSign ?? ""}
                                        onChange={(e) => onFieldChange(entityId, "specialSign", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    />
                                </label>
                            </>
                        )}
                        <label className="flex items-center gap-1 col-span-2 flex-wrap" title={ITEM_FIELD_HELP.dateSetId}>
                            <span className="text-gray-600 w-20 shrink-0 item-en-ltr">dateSetId</span>
                            <input
                                type="text"
                                value={localVal.dateSetId ?? ""}
                                onChange={(e) => onFieldChange(entityId, "dateSetId", e.target.value)}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0 item-en-ltr"
                            />
                            {onOpenDateSetIdConfig && (
                                <button
                                    type="button"
                                    onClick={() => onOpenDateSetIdConfig(entityId, localVal.dateSetId ?? "")}
                                    className="shrink-0 inline-flex items-center px-2 py-0.5 text-sm leading-none border border-blue-300 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 whitespace-nowrap"
                                >
                                    הגדר סט תאריכים
                                </button>
                            )}
                        </label>
                    </div>
                )}
                <textarea
                    ref={contentTextareaRef}
                    className={`${getItemStyle(localVal.type)} ${mainContentRtl ? "" : "text-left"}`}
                    value={localVal.content ?? ""}
                    onChange={(e) => onContentChange(item.id, e.target.value)}
                    dir={mainContentRtl ? "rtl" : "ltr"}
                    style={{ textAlign: mainContentRtl ? "right" : "left" }}
                />
            </div>

            {/* תרגומים מקושרים – ניתן לעריכה כולל מאפיינים; כשהבסיס סומן למחיקה – גם הם מסומנים */}
            {related.length > 0 && (
                <div className={`mr-8 pr-3 space-y-1 border-r-4 ${isPendingDelete && isBaseTranslation ? "border-red-400 bg-red-50/50 rounded-r p-2" : "border-blue-400"}`}>
                    {isPendingDelete && isBaseTranslation && (
                        <div className="text-base font-bold text-red-700 mb-2 px-2 py-1 bg-red-100 border border-red-300 rounded">
                            כל הפריטים למטה יימחקו בשמירה (יחד עם פריט הבסיס)
                        </div>
                    )}
                    {related.map((enh) => {
                        const displayVal = { ...enh.values, ...enhancementLocalValues[enh.id] };
                        const enhChanged = isEnhancementChanged?.(enh.id) ?? false;
                        const enhShowProps = showEnhancementProps[enh.id] ?? false;
                        const relatedWillBeDeleted = isPendingDelete && isBaseTranslation;
                        const enhType = (displayVal.type ?? "body") as string;
                        const enhancementIsBase = String(enh.tId ?? "").startsWith("0-");
                        const enhShowHebrewBodyOnly = supportsHebrewBodyOnlyFields(enhType, enhancementIsBase);
                        const enhShowNoSpace = supportsNoSpace(enhType);
                        const enhShowFirstInPage = supportsFirstInPage(enhType);
                        const enhShowAttachedMeta = supportsAttachedMeta(enhType);
                        const enhContentRtl = contentUsesRtlAlignment(displayVal?.content);
                        const enhIsDateRestricted = !!displayVal.dateSetId && displayVal.dateSetId !== "100";
                        const enhEntry = enhIsDateRestricted ? (dateSetLabels[displayVal.dateSetId] ?? null) : null;
                        const enhShort = enhEntry?.short ?? (enhIsDateRestricted ? `ID ${displayVal.dateSetId}` : null);
                        const enhFull = enhEntry?.full ?? enhShort;
                        return (
                            <div
                                key={enh.id}
                                className={`p-2 rounded text-base ${relatedWillBeDeleted ? "bg-red-50 border-2 border-red-300" : enhChanged ? "bg-amber-50 border border-amber-200" : enhIsDateRestricted ? "bg-violet-50 border border-violet-200" : "bg-blue-50 border border-blue-100"}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-bold text-xs item-en-ltr ${relatedWillBeDeleted ? "text-red-700" : "text-blue-600"}`}>{enh.tId}</span>
                                        <span className="text-xs text-gray-500 font-mono item-en-ltr" title="מזהה הפריט (entity ID)">ID: {enh.id}</span>
                                        {relatedWillBeDeleted && (
                                            <span className="text-xs font-bold text-red-600 bg-red-200 px-1.5 py-0.5 rounded">ימוחק בשמירה</span>
                                        )}
                                        {enhIsDateRestricted && !relatedWillBeDeleted && (
                                            <div className="relative group">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-violet-100 border border-violet-400 text-violet-800 cursor-default select-none whitespace-nowrap">
                                                    מוגבל לתאריכים
                                                </span>
                                                <div className="absolute bottom-full right-0 mb-1.5 z-50 invisible group-hover:visible bg-white border border-violet-300 rounded-lg shadow-xl p-3 min-w-[220px] max-w-[340px] pointer-events-none">
                                                    {enhShort && (
                                                        <div className="font-bold text-violet-800 text-sm mb-1.5 text-right leading-snug">
                                                            {enhShort}
                                                        </div>
                                                    )}
                                                    {enhFull && enhFull !== enhShort && (
                                                        <div className="text-gray-700 text-xs text-right leading-relaxed mb-1.5 whitespace-pre-wrap">
                                                            {enhFull}
                                                        </div>
                                                    )}
                                                    <div className="text-gray-400 text-xs item-en-ltr border-t border-gray-100 pt-1 mt-1">
                                                        ID: {displayVal.dateSetId}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {onEnhancementFieldChange && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowEnhancementProps((prev) => ({
                                                    ...prev,
                                                    [enh.id]: !prev[enh.id],
                                                }))
                                            }
                                            className="inline-flex items-center px-2 py-0.5 text-blue-500 hover:bg-blue-100 border border-blue-200 rounded text-sm leading-none whitespace-nowrap"
                                        >
                                            {enhShowProps ? "הסתר מאפיינים" : "מאפיינים"}
                                        </button>
                                    )}
                                </div>
                                {enhShowProps && onEnhancementFieldChange && (
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 p-2 bg-white rounded text-base border border-blue-100">
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.type}>
                                            <span className="text-gray-600 w-20 shrink-0">סוג</span>
                                            <select
                                                value={displayVal.type ?? "body"}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "type", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                            >
                                                {ITEM_TYPE_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </label>
                                        {(displayVal.type ?? "body") === "title" && (
                                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.titleType}>
                                                <span className="text-gray-600 w-20 shrink-0">סוג כותרת</span>
                                                <select
                                                    value={displayVal.titleType ?? ""}
                                                    onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "titleType", e.target.value)}
                                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                                >
                                                    {TITLE_TYPE_OPTIONS.map((o) => (
                                                        <option key={o.value || "_"} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        {showDiburHamatkhilField(displayVal.type, enh.tId) && (
                                            <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.titleCommentary}>
                                                <span className="text-gray-600 w-20 shrink-0">דיבור המתחיל</span>
                                                <input
                                                    type="text"
                                                    value={displayVal.title ?? ""}
                                                    onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "title", e.target.value)}
                                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                                    dir="rtl"
                                                />
                                            </label>
                                        )}
                                        {enhShowHebrewBodyOnly && (
                                            <>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.fontTanach}>
                                                    <input type="checkbox" checked={!!displayVal.fontTanach}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "fontTanach", e.target.checked)} />
                                                    <span className="text-gray-600">גופן תנ"ך</span>
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.bold}>
                                                    <input type="checkbox" checked={!!displayVal.bold}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "bold", e.target.checked)} />
                                                    <span className="text-gray-600">גופן מודגש</span>
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.centerAlign}>
                                                    <input type="checkbox" checked={!!displayVal.centerAlign}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "centerAlign", e.target.checked)} />
                                                    <span className="text-gray-600">מיושר לאמצע</span>
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.lineLine}>
                                                    <input type="checkbox" checked={!!displayVal.lineLine}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "lineLine", e.target.checked)} />
                                                    <span className="text-gray-600">שורה שורה</span>
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.red}>
                                                    <input type="checkbox" checked={!!displayVal.red}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "red", e.target.checked)} />
                                                    <span className="text-gray-600">טקסט אדום</span>
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.justifyBlock}>
                                                    <input type="checkbox" checked={!!displayVal.justifyBlock}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "justifyBlock", e.target.checked)} />
                                                    <span className="text-gray-600">יישור בלוק</span>
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                                                    <input type="checkbox" checked={!!displayVal.block}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "block", e.target.checked)} />
                                                    <span className="text-gray-600">פיסקה</span>
                                                </label>
                                            </>
                                        )}
                                        {enhShowNoSpace && (
                                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                                                <input type="checkbox" checked={!!displayVal.noSpace}
                                                    onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "noSpace", e.target.checked)} />
                                                <span className="text-gray-600">ללא רווח</span>
                                            </label>
                                        )}
                                        {enhShowFirstInPage && (
                                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                                                <input type="checkbox" checked={!!displayVal.firstInPage}
                                                    onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "firstInPage", e.target.checked)} />
                                                <span className="text-gray-600">ראשון בעמוד</span>
                                            </label>
                                        )}
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialDate}>
                                            <input type="checkbox" checked={!!displayVal.specialDate}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "specialDate", e.target.checked)} />
                                            <span className="text-gray-600">תאריך מיוחד</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.cohanim}>
                                            <span className="text-gray-600 w-20 shrink-0">כהנים</span>
                                            <select
                                                value={displayVal.cohanim === null || displayVal.cohanim === undefined ? "" : displayVal.cohanim ? "true" : "false"}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "cohanim", e.target.value === "" ? null : e.target.value === "true")}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                            >
                                                <option value="">לא מוגדר</option>
                                                <option value="true">כן</option>
                                                <option value="false">לא</option>
                                            </select>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.hazan}>
                                            <span className="text-gray-600 w-20 shrink-0">חזן</span>
                                            <select
                                                value={displayVal.hazan === null || displayVal.hazan === undefined ? "" : displayVal.hazan ? "true" : "false"}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "hazan", e.target.value === "" ? null : e.target.value === "true")}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                            >
                                                <option value="">לא מוגדר</option>
                                                <option value="true">כן</option>
                                                <option value="false">לא</option>
                                            </select>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.minyan}>
                                            <span className="text-gray-600 w-20 shrink-0">מניין</span>
                                            <select
                                                value={displayVal.minyan === null || displayVal.minyan === undefined ? "" : displayVal.minyan ? "true" : "false"}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "minyan", e.target.value === "" ? null : e.target.value === "true")}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                            >
                                                <option value="">לא מוגדר</option>
                                                <option value="true">כן</option>
                                                <option value="false">לא</option>
                                            </select>
                                        </label>
                                        {enhShowAttachedMeta && (
                                            <>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.role}>
                                                    <span className="text-gray-600 w-20 shrink-0">תפקיד</span>
                                                    <input type="text" value={displayVal.role ?? ""}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "role", e.target.value)}
                                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" dir="rtl" />
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.reference}>
                                                    <span className="text-gray-600 w-20 shrink-0">מקורות</span>
                                                    <input type="text" value={displayVal.reference ?? ""}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "reference", e.target.value)}
                                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" />
                                                </label>
                                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialSign}>
                                                    <span className="text-gray-600 w-20 shrink-0">סימן מיוחד</span>
                                                    <input type="text" value={displayVal.specialSign ?? ""}
                                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "specialSign", e.target.value)}
                                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" />
                                                </label>
                                            </>
                                        )}
                                        <label className="flex items-center gap-1 col-span-2 flex-wrap" title={ITEM_FIELD_HELP.dateSetId}>
                                            <span className="text-gray-600 w-20 shrink-0 item-en-ltr">dateSetId</span>
                                            <input
                                                type="text"
                                                value={displayVal.dateSetId ?? ""}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "dateSetId", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0 item-en-ltr"
                                            />
                                            {onOpenDateSetIdConfig && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onOpenDateSetIdConfig(enh.id, displayVal.dateSetId ?? "", enh.tId)
                                                    }
                                                    className="shrink-0 inline-flex items-center px-2 py-0.5 text-sm leading-none border border-blue-300 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 whitespace-nowrap"
                                                >
                                                    הגדר סט תאריכים
                                                </button>
                                            )}
                                        </label>
                                    </div>
                                )}
                                {onEnhancementFieldChange ? (
                                    <textarea
                                        value={displayVal?.content ?? ""}
                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "content", e.target.value)}
                                        className={`w-full p-2 border border-gray-200 rounded text-base min-h-[72px] whitespace-pre-wrap ${enhContentRtl ? "" : "text-left"}`}
                                        dir={enhContentRtl ? "rtl" : "ltr"}
                                        style={{ textAlign: enhContentRtl ? "right" : "left" }}
                                    />
                                ) : (
                                    <div
                                        className={`whitespace-pre-wrap break-words ${enhContentRtl ? "" : "text-left"}`}
                                        dir={enhContentRtl ? "rtl" : "ltr"}
                                        style={{ textAlign: enhContentRtl ? "right" : "left" }}
                                    >
                                        {displayVal?.content}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {onAddTranslation && (
                <div className="mt-1.5">
                    <button
                        type="button"
                        disabled={isAddTranslationBlocked}
                        title={
                            isAddTranslationBlocked
                                ? "הוספת תרגום זמינה רק אחרי לחיצה על «שמור מקטע» (בראש אזור המקטע)"
                                : undefined
                        }
                        onClick={() => onAddTranslation!(item)}
                        className={`w-full py-3 px-3 rounded-lg text-base font-semibold border transition-colors shadow-sm ${
                            isAddTranslationBlocked
                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300"
                        }`}
                    >
                        + הוסף תרגום לטקסט זה
                    </button>
                    {isAddTranslationBlocked && (
                        <p
                            className="mt-1.5 text-base text-amber-900/90 text-center leading-snug px-1"
                            dir="rtl"
                        >
                            לא ניתן להוסיף תרגום לפני <span className="font-semibold">שמירת המקטע</span>
                            — לחץ <span className="font-semibold">«שמור מקטע»</span> למעלה.
                        </p>
                    )}
                </div>
            )}
            {onAddAfter && (
                <button
                    type="button"
                    onClick={onAddAfter}
                    className="w-full py-3 px-3 mt-1.5 rounded-lg text-base font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm"
                >
                    + הוסף פריט
                </button>
            )}
            {onAddInstructionAfter && (
                <button
                    type="button"
                    onClick={onAddInstructionAfter}
                    className="w-full py-3 px-3 mt-1.5 rounded-lg text-base font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 transition-colors shadow-sm"
                >
                    + הוסף הוראה כאן
                </button>
            )}
        </React.Fragment>
    );
}
