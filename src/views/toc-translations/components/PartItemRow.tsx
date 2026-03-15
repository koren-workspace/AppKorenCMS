/**
 * PartItemRow – שורת פריט בודדת ברשימת העריכה
 *
 * מציג:
 *   - כרטיס: itemId, MIT, זמן עדכון + textarea לתוכן (עם עיצוב לפי type)
 *   - בלוק מאפיינים (סוג, כותרת, גופן, תפקיד, וכו') – ניתן להרחבה
 *   - בלוק "תרגומים מקושרים": פריטים מתרגומים אחרים שמקושרים ל-itemId (linkedItem) – ניתן לעריכה
 *   - כפתור "הוסף מקטע כאן" / "הוסף הוראה כאן" / "הוסף תרגום לטקסט זה"
 *
 * קומפוננטה תצוגתית – כל הנתונים וה-callbacks ב-props.
 */

import React, { useState, useRef, useEffect } from "react";
import { Entity } from "@firecms/cloud";
import { getItemStyle } from "../utils/itemUtils";
import { ITEM_TYPE_OPTIONS, INSTRUCTION_TYPE_OPTIONS, TITLE_TYPE_OPTIONS, ITEM_FIELD_HELP } from "../constants/itemFields";

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
    /** מוחק את המקטע ואת כל התרגומים המקושרים */
    onDelete?: (item: Entity<any>, itemId: string) => void;
    /** פריט סומן למחיקה (ימוחק בשמירה) – מציג עיצוב מודגש וכפתור "החזר" */
    isPendingDelete?: boolean;
    /** מחזיר פריט מרשימת המחיקות המתינות */
    onRestore?: (item: Entity<any>, itemId: string) => void;
    /** עריכת פריט בסיס – במחיקה יימחקו גם כל הפריטים המקושרים בכל התרגומים */
    isBaseTranslation?: boolean;
    /** מוצג רק בנוסח הבסיסי (0-*); בשאר הנוסחים – עריכה בלבד */
    onAddAfter?: () => void;
    /** מוצג רק בתרגום: הוסף פריט הוראה אחרי שורה זו */
    onAddInstructionAfter?: () => void;
    /** פותח מודל הוספת תרגום לפריט הזה */
    onAddTranslation?: (item: Entity<any>) => void;
    /** בתרגום (לא בסיס): במאפיינים סוג ניתן לשינוי רק בין סוגי הוראות */
    restrictTypeToInstructions?: boolean;
    /** העברת פוקוס לשדה התוכן (למקטע שנוסף זה עתה) */
    autoFocus?: boolean;
    /** פותח מודל הגדרת/עריכת dateSetId (לחיצה על שדה dateSetId) */
    onOpenDateSetIdConfig?: (entityId: string, currentDateSetId: string) => void;
    /** props לידית גרירה */
    dragHandleProps?: {
        attributes?: Record<string, unknown>;
        listeners?: Record<string, unknown>;
    };
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
    onAddAfter,
    onAddInstructionAfter,
    onAddTranslation,
    restrictTypeToInstructions = false,
    autoFocus = false,
    onOpenDateSetIdConfig,
    dragHandleProps,
}: PartItemRowProps) {
    const curId = localVal.itemId;
    const [showProps, setShowProps] = useState(false);
    const [showEnhancementProps, setShowEnhancementProps] = useState<Record<string, boolean>>({});
    const entityId = item.id;
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

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
                className={`p-2 border rounded ${isPendingDelete ? "bg-red-50 border-red-300 border-2 opacity-95" : isChanged ? "border-orange-300" : "border-gray-200"}`}
            >
                {isPendingDelete && (
                    <div className="flex items-center gap-2 mb-2 py-1 px-2 bg-red-100 border border-red-300 rounded text-[10px] font-bold text-red-800">
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
                                className="px-2 py-0.5 bg-green-600 text-white rounded hover:bg-green-700 text-[9px] font-bold"
                                title="החזר – לא יימחק בשמירה"
                            >
                                החזר
                            </button>
                        )}
                    </div>
                )}
                <div className="flex justify-between items-center text-[7px] text-gray-400 mb-1 uppercase tracking-tighter">
                    <span>itemId: {curId} | MIT: {localVal.mit_id}</span>
                    <div className="flex items-center gap-2">
                        {onFieldChange && (
                            <button
                                type="button"
                                onClick={() => setShowProps((p) => !p)}
                                className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 border border-gray-200 rounded text-[8px]"
                            >
                                {showProps ? "הסתר מאפיינים" : "מאפיינים"}
                            </button>
                        )}
                        {dragHandleProps && (
                            <button
                                type="button"
                                {...(dragHandleProps.attributes ?? {})}
                                {...(dragHandleProps.listeners ?? {})}
                                className="px-1.5 py-0.5 text-gray-500 hover:bg-gray-100 border border-gray-200 rounded text-[8px] cursor-grab active:cursor-grabbing touch-none"
                                title="גרור לשינוי סדר"
                                tabIndex={-1}
                            >
                                ⠿
                            </button>
                        )}
                        {onDelete && !isPendingDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    const msg = isBaseTranslation && related.length > 0
                                        ? `למחוק את המקטע ואת כל ${related.length} התרגומים המקושרים אליו?\n(יסומנו כ-deleted בכל הנוסחים)`
                                        : isBaseTranslation
                                            ? "למחוק את המקטע?"
                                            : "למחוק את המקטע? (תרגום זה בלבד)";
                                    if (window.confirm(msg))
                                        onDelete(item, curId ?? item.id);
                                }}
                                className="px-1.5 py-0.5 text-red-500 hover:bg-red-50 border border-red-200 rounded text-[8px] font-bold"
                                title={isBaseTranslation && related.length > 0 ? "מחק מקטע וכל התרגומים המקושרים בכל הנוסחים" : "מחק מקטע"}
                            >
                                מחק מקטע
                            </button>
                        )}
                        <span>
                            Update:{" "}
                            {localVal.timestamp
                                ? new Date(localVal.timestamp).toLocaleTimeString()
                                : "Never"}
                        </span>
                    </div>
                </div>
                {showProps && onFieldChange && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 p-2 bg-gray-50 rounded text-[10px]">
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.type}>
                            <span className="text-gray-600 w-20 shrink-0">סוג</span>
                            {restrictTypeToInstructions && !INSTRUCTION_TYPE_OPTIONS.some((o) => o.value === (localVal.type ?? "body")) ? (
                                <span className="border border-gray-200 bg-gray-100 text-gray-500 rounded px-1 py-0.5 flex-1 min-w-0 text-[10px]">
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
                                    <span className="border border-gray-200 bg-gray-100 text-gray-500 rounded px-1 py-0.5 flex-1 min-w-0 text-[10px]">
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
                        {(["title", "commentary"] as const).includes((localVal.type ?? "body") as any) && (
                            <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.title}>
                                <span className="text-gray-600 w-20 shrink-0">כותרת</span>
                                <input
                                    type="text"
                                    value={localVal.title ?? ""}
                                    onChange={(e) => onFieldChange(entityId, "title", e.target.value)}
                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    dir="rtl"
                                />
                            </label>
                        )}
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.fontTanach}>
                            <input
                                type="checkbox"
                                checked={!!localVal.fontTanach}
                                onChange={(e) => onFieldChange(entityId, "fontTanach", e.target.checked)}
                            />
                            <span className="text-gray-600">גופן תנ"ך</span>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                            <input
                                type="checkbox"
                                checked={!!localVal.noSpace}
                                onChange={(e) => onFieldChange(entityId, "noSpace", e.target.checked)}
                            />
                            <span className="text-gray-600">ללא רווח</span>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                            <input
                                type="checkbox"
                                checked={!!localVal.block}
                                onChange={(e) => onFieldChange(entityId, "block", e.target.checked)}
                            />
                            <span className="text-gray-600">בלוק</span>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                            <input
                                type="checkbox"
                                checked={!!localVal.firstInPage}
                                onChange={(e) => onFieldChange(entityId, "firstInPage", e.target.checked)}
                            />
                            <span className="text-gray-600">ראשון בעמוד</span>
                        </label>
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
                            <span className="text-gray-600 w-20 shrink-0">reference</span>
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
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.mit_id}>
                            <span className="text-gray-600 w-20 shrink-0">MIT ID</span>
                            <input
                                type="text"
                                value={localVal.mit_id ?? ""}
                                onChange={(e) => onFieldChange(entityId, "mit_id", e.target.value)}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                            />
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.dateSetId}>
                            <span className="text-gray-600 w-20 shrink-0">dateSetId</span>
                            {onOpenDateSetIdConfig ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenDateSetIdConfig(entityId, localVal.dateSetId ?? "")}
                                    className="border border-gray-300 rounded px-2 py-0.5 flex-1 min-w-0 text-right bg-white hover:bg-blue-50 text-gray-700"
                                >
                                    {localVal.dateSetId ? localVal.dateSetId : "לחץ להגדרה"}
                                </button>
                            ) : (
                                <input
                                    type="text"
                                    value={localVal.dateSetId ?? ""}
                                    onChange={(e) => onFieldChange(entityId, "dateSetId", e.target.value)}
                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                />
                            )}
                        </label>
                    </div>
                )}
                <textarea
                    ref={contentTextareaRef}
                    className={getItemStyle(localVal.type)}
                    value={localVal.content ?? ""}
                    onChange={(e) => onContentChange(item.id, e.target.value)}
                    dir="rtl"
                />
            </div>

            {/* תרגומים מקושרים – ניתן לעריכה כולל מאפיינים; כשהבסיס סומן למחיקה – גם הם מסומנים */}
            {related.length > 0 && (
                <div className={`mr-8 pr-3 space-y-1 border-r-4 ${isPendingDelete && isBaseTranslation ? "border-red-400 bg-red-50/50 rounded-r p-2" : "border-blue-400"}`}>
                    {isPendingDelete && isBaseTranslation && (
                        <div className="text-[10px] font-bold text-red-700 mb-2 px-2 py-1 bg-red-100 border border-red-300 rounded">
                            כל הפריטים למטה יימחקו בשמירה (יחד עם פריט הבסיס)
                        </div>
                    )}
                    {related.map((enh) => {
                        const displayVal = { ...enh.values, ...enhancementLocalValues[enh.id] };
                        const enhChanged = isEnhancementChanged?.(enh.id) ?? false;
                        const enhShowProps = showEnhancementProps[enh.id] ?? false;
                        const relatedWillBeDeleted = isPendingDelete && isBaseTranslation;
                        return (
                            <div
                                key={enh.id}
                                className={`p-2 rounded text-[10px] ${relatedWillBeDeleted ? "bg-red-50 border-2 border-red-300" : enhChanged ? "bg-amber-50 border border-amber-200" : "bg-blue-50 border border-blue-100"}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-bold text-[9px] ${relatedWillBeDeleted ? "text-red-700" : "text-blue-600"}`}>{enh.tId}</span>
                                        {relatedWillBeDeleted && (
                                            <span className="text-[8px] font-bold text-red-600 bg-red-200 px-1.5 py-0.5 rounded">ימוחק בשמירה</span>
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
                                            className="px-1.5 py-0.5 text-blue-500 hover:bg-blue-100 border border-blue-200 rounded text-[8px]"
                                        >
                                            {enhShowProps ? "הסתר מאפיינים" : "מאפיינים"}
                                        </button>
                                    )}
                                </div>
                                {enhShowProps && onEnhancementFieldChange && (
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-2 p-2 bg-white rounded text-[10px] border border-blue-100">
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
                                        {(["title", "commentary"] as const).includes((displayVal.type ?? "body") as any) && (
                                            <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.title}>
                                                <span className="text-gray-600 w-20 shrink-0">כותרת</span>
                                                <input
                                                    type="text"
                                                    value={displayVal.title ?? ""}
                                                    onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "title", e.target.value)}
                                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                                    dir="rtl"
                                                />
                                            </label>
                                        )}
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.fontTanach}>
                                            <input type="checkbox" checked={!!displayVal.fontTanach}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "fontTanach", e.target.checked)} />
                                            <span className="text-gray-600">גופן תנ"ך</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                                            <input type="checkbox" checked={!!displayVal.noSpace}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "noSpace", e.target.checked)} />
                                            <span className="text-gray-600">ללא רווח</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                                            <input type="checkbox" checked={!!displayVal.block}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "block", e.target.checked)} />
                                            <span className="text-gray-600">בלוק</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                                            <input type="checkbox" checked={!!displayVal.firstInPage}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "firstInPage", e.target.checked)} />
                                            <span className="text-gray-600">ראשון בעמוד</span>
                                        </label>
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
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.role}>
                                            <span className="text-gray-600 w-20 shrink-0">תפקיד</span>
                                            <input type="text" value={displayVal.role ?? ""}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "role", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" dir="rtl" />
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.reference}>
                                            <span className="text-gray-600 w-20 shrink-0">reference</span>
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
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.dateSetId}>
                                            <span className="text-gray-600 w-20 shrink-0">dateSetId</span>
                                            <input type="text" value={displayVal.dateSetId ?? ""}
                                                onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "dateSetId", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" />
                                        </label>
                                    </div>
                                )}
                                {onEnhancementFieldChange ? (
                                    <textarea
                                        value={displayVal?.content ?? ""}
                                        onChange={(e) => onEnhancementFieldChange(enh.id, enh.tId, "content", e.target.value)}
                                        className="w-full p-1.5 border border-gray-200 rounded text-[10px] min-h-[60px]"
                                        dir="rtl"
                                    />
                                ) : (
                                    <div>{displayVal?.content}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {onAddTranslation && (
                <button
                    type="button"
                    onClick={() => onAddTranslation(item)}
                    className="w-full py-2 px-3 mt-1.5 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-colors shadow-sm"
                >
                    + הוסף תרגום לטקסט זה
                </button>
            )}
            {onAddAfter && (
                <button
                    type="button"
                    onClick={onAddAfter}
                    className="w-full py-2 px-3 mt-1.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 transition-colors shadow-sm"
                >
                    + הוסף מקטע כאן
                </button>
            )}
            {onAddInstructionAfter && (
                <button
                    type="button"
                    onClick={onAddInstructionAfter}
                    className="w-full py-2 px-3 mt-1.5 rounded-lg text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:border-sky-300 transition-colors shadow-sm"
                >
                    + הוסף הוראה כאן
                </button>
            )}
        </React.Fragment>
    );
}
