/**
 * AddItemModal – חלון הוספת פריט: נפתח תחילה עם כל הפרטים והמאפיינים.
 * במרכז: כפתור להגדרת dateSetId (ברירת מחדל 100).
 */

import React from "react";
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
import { contentUsesRtlAlignment, splitParagraphSentences } from "../utils/itemUtils";

export type AddItemFormValues = {
    dateSetId: string;
    content: string;
    type: string;
    titleType: string;
    title: string;
    fontTanach: boolean;
    bold: boolean;
    centerAlign: boolean;
    lineLine: boolean;
    red: boolean;
    justifyBlock: boolean;
    noSpace: boolean;
    block: boolean;
    firstInPage: boolean;
    specialDate: boolean;
    cohanim: boolean | null;
    hazan: boolean | null;
    minyan: boolean | null;
    role: string;
    reference: string;
    specialSign: string;
};

export const defaultAddItemForm = (isInstruction: boolean): AddItemFormValues => ({
    dateSetId: "100",
    content: "",
    type: isInstruction ? "instructions" : "body",
    titleType: "",
    title: "",
    fontTanach: false,
    bold: false,
    centerAlign: false,
    lineLine: false,
    red: false,
    justifyBlock: false,
    noSpace: false,
    block: false,
    firstInPage: false,
    specialDate: false,
    cohanim: null,
    hazan: null,
    minyan: null,
    role: "",
    reference: "",
    specialSign: "",
});

export type AddItemModalProps = {
    open: boolean;
    onClose: () => void;
    /** הוראה (instructions) או פריט רגיל */
    isInstruction: boolean;
    /** האם התרגום הנוכחי הוא תרגום בסיס (0-*) */
    isBaseTranslation: boolean;
    /** מזהה התרגום הנוכחי – דיבור המתחיל רק בתרגומי פירוש (2 ספרות) */
    translationId?: string | null;
    form: AddItemFormValues;
    onFormChange: (field: keyof AddItemFormValues, value: unknown) => void;
    onConfirm: () => void;
    /** פותח את מודל הגדרת dateSetId (תמיד/מתקדם) */
    onOpenDateSetIdConfig: () => void;
    saving?: boolean;
};

export function AddItemModal({
    open,
    onClose,
    isInstruction,
    isBaseTranslation,
    translationId = null,
    form,
    onFormChange,
    onConfirm,
    onOpenDateSetIdConfig,
    saving = false,
}: AddItemModalProps) {
    if (!open) return null;

    const setField = (field: keyof AddItemFormValues, value: unknown) => {
        onFormChange(field, value);
    };

    const typeOptions = isInstruction ? INSTRUCTION_TYPE_OPTIONS : ITEM_TYPE_OPTIONS;
    const currentType = form.type ?? (isInstruction ? "instructions" : "body");
    const showHebrewBodyOnly = supportsHebrewBodyOnlyFields(currentType, isBaseTranslation);
    const showNoSpace = supportsNoSpace(currentType);
    const showFirstInPage = supportsFirstInPage(currentType);
    const showAttachedMeta = supportsAttachedMeta(currentType);
    const paragraphSentences = splitParagraphSentences(form.content);
    const contentRtl = contentUsesRtlAlignment(form.content);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b font-bold text-gray-800">
                    {isInstruction ? "הוסף הוראה" : "הוסף פריט"}
                </div>
                <div className="p-4 overflow-auto space-y-4 flex-1 text-sm">
                    {/* חלון מרכזי: כפתור הגדרת dateSetId */}
                    <div className="flex flex-col items-center justify-center py-4">
                        {/* כפתור הגדרת dateSetId – ברירת מחדל 100 */}
                        <div className="mt-4 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-600">סט תאריכים (dateSetId)</span>
                            <button
                                type="button"
                                onClick={onOpenDateSetIdConfig}
                                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-blue-50 text-gray-700 font-medium"
                            >
                                {form.dateSetId ? `הגדר dateSetId (נוכחי: ${form.dateSetId})` : "הגדר dateSetId (ברירת מחדל: 100)"}
                            </button>
                            {form.dateSetId && (
                                <span className="text-[10px] text-gray-500">נוכחי: {form.dateSetId}</span>
                            )}
                        </div>
                    </div>

                    {/* כל המאפיינים */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-3 bg-gray-50 rounded text-[10px]">
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.type}>
                            <span className="text-gray-600 w-20 shrink-0">סוג</span>
                            <select
                                value={form.type}
                                onChange={(e) => setField("type", e.target.value)}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                            >
                                {typeOptions.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </label>
                        {(form.type === "title") && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.titleType}>
                                <span className="text-gray-600 w-20 shrink-0">סוג כותרת</span>
                                <select
                                    value={form.titleType}
                                    onChange={(e) => setField("titleType", e.target.value)}
                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                >
                                    {TITLE_TYPE_OPTIONS.map((o) => (
                                        <option key={o.value || "_"} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        {showDiburHamatkhilField(form.type, translationId) && (
                            <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.titleCommentary}>
                                <span className="text-gray-600 w-20 shrink-0">דיבור המתחיל</span>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(e) => setField("title", e.target.value)}
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
                                        checked={form.fontTanach}
                                        onChange={(e) => setField("fontTanach", e.target.checked)}
                                    />
                                    <span className="text-gray-600">גופן תנ"ך</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.bold}>
                                    <input
                                        type="checkbox"
                                        checked={form.bold}
                                        onChange={(e) => setField("bold", e.target.checked)}
                                    />
                                    <span className="text-gray-600">גופן מודגש</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.centerAlign}>
                                    <input
                                        type="checkbox"
                                        checked={form.centerAlign}
                                        onChange={(e) => setField("centerAlign", e.target.checked)}
                                    />
                                    <span className="text-gray-600">מיושר לאמצע</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.lineLine}>
                                    <input
                                        type="checkbox"
                                        checked={form.lineLine}
                                        onChange={(e) => setField("lineLine", e.target.checked)}
                                    />
                                    <span className="text-gray-600">שורה שורה</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.red}>
                                    <input
                                        type="checkbox"
                                        checked={form.red}
                                        onChange={(e) => setField("red", e.target.checked)}
                                    />
                                    <span className="text-gray-600">טקסט אדום</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.justifyBlock}>
                                    <input
                                        type="checkbox"
                                        checked={form.justifyBlock}
                                        onChange={(e) => setField("justifyBlock", e.target.checked)}
                                    />
                                    <span className="text-gray-600">יישור בלוק</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                                    <input
                                        type="checkbox"
                                        checked={form.block}
                                        onChange={(e) => setField("block", e.target.checked)}
                                    />
                                    <span className="text-gray-600">פיסקה</span>
                                </label>
                            </>
                        )}
                        {showNoSpace && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                                <input
                                    type="checkbox"
                                    checked={form.noSpace}
                                    onChange={(e) => setField("noSpace", e.target.checked)}
                                />
                                <span className="text-gray-600">ללא רווח</span>
                            </label>
                        )}
                        {showFirstInPage && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                                <input
                                    type="checkbox"
                                    checked={form.firstInPage}
                                    onChange={(e) => setField("firstInPage", e.target.checked)}
                                />
                                <span className="text-gray-600">ראשון בעמוד</span>
                            </label>
                        )}
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialDate}>
                            <input
                                type="checkbox"
                                checked={form.specialDate}
                                onChange={(e) => setField("specialDate", e.target.checked)}
                            />
                            <span className="text-gray-600">תאריך מיוחד</span>
                        </label>
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.cohanim}>
                            <span className="text-gray-600 w-20 shrink-0">כהנים</span>
                            <select
                                value={form.cohanim === null ? "" : form.cohanim ? "true" : "false"}
                                onChange={(e) => setField("cohanim", e.target.value === "" ? null : e.target.value === "true")}
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
                                value={form.hazan === null ? "" : form.hazan ? "true" : "false"}
                                onChange={(e) => setField("hazan", e.target.value === "" ? null : e.target.value === "true")}
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
                                value={form.minyan === null ? "" : form.minyan ? "true" : "false"}
                                onChange={(e) => setField("minyan", e.target.value === "" ? null : e.target.value === "true")}
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
                                        value={form.role}
                                        onChange={(e) => setField("role", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                        dir="rtl"
                                    />
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.reference}>
                                    <span className="text-gray-600 w-20 shrink-0">מקורות</span>
                                    <input
                                        type="text"
                                        value={form.reference}
                                        onChange={(e) => setField("reference", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    />
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialSign}>
                                    <span className="text-gray-600 w-20 shrink-0">סימן מיוחד</span>
                                    <input
                                        type="text"
                                        value={form.specialSign}
                                        onChange={(e) => setField("specialSign", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    />
                                </label>
                            </>
                        )}
                    </div>

                    <label className="block">
                        <span className="text-gray-600 block mb-1">תוכן (אופציונלי)</span>
                        <textarea
                            value={form.content}
                            onChange={(e) => setField("content", e.target.value)}
                            className={`w-full border border-gray-300 rounded px-2 py-1 min-h-[80px] whitespace-pre-wrap ${contentRtl ? "" : "text-left"}`}
                            dir={contentRtl ? "rtl" : "ltr"}
                            style={{ textAlign: contentRtl ? "right" : "left" }}
                            placeholder="ניתן להשאיר ריק ולהוסיף אחרי הוספת הפריט"
                        />
                        {form.block && (
                            <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
                                <div className="text-[10px] text-gray-600 mb-1">
                                    תצוגת משפטים לפסקה ({paragraphSentences.length})
                                </div>
                                <div className="space-y-1 max-h-28 overflow-auto text-[10px]">
                                    {paragraphSentences.length === 0 ? (
                                        <div className="text-gray-400">אין משפטים (פיצול לפי שורות)</div>
                                    ) : (
                                        paragraphSentences.map((sentence, index) => (
                                            <div
                                                key={`${index}_${sentence.slice(0, 10)}`}
                                                className="px-2 py-1 rounded bg-white border border-gray-200"
                                            >
                                                <span className="text-gray-500 ml-1">{index + 1}.</span>
                                                <span>{sentence}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </label>
                </div>
                <div className="p-4 border-t flex justify-end gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                    >
                        {saving ? "שומר…" : isInstruction ? "הוסף הוראה" : "הוסף פריט"}
                    </button>
                </div>
            </div>
        </div>
    );
}
