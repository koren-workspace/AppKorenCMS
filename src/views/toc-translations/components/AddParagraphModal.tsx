import React from "react";
import {
    ITEM_TYPE_OPTIONS,
    ITEM_FIELD_HELP,
    TITLE_TYPE_OPTIONS,
    supportsAttachedMeta,
    supportsFirstInPage,
    supportsHebrewBodyOnlyFields,
    supportsNoSpace,
} from "../constants/itemFields";
import { AddItemFormValues, defaultAddItemForm } from "./AddItemModal";
import { splitParagraphSentences } from "../services/googleSheetsService";

export type AddParagraphFormValues = AddItemFormValues & {
    paragraphText: string;
};

export const defaultAddParagraphForm = (): AddParagraphFormValues => ({
    ...defaultAddItemForm(false),
    paragraphText: "",
});

export type AddParagraphModalProps = {
    open: boolean;
    onClose: () => void;
    isBaseTranslation: boolean;
    form: AddParagraphFormValues;
    onFormChange: (field: keyof AddParagraphFormValues, value: unknown) => void;
    onConfirm: () => void;
    onOpenDateSetIdConfig: () => void;
    saving?: boolean;
};

export function AddParagraphModal({
    open,
    onClose,
    isBaseTranslation,
    form,
    onFormChange,
    onConfirm,
    onOpenDateSetIdConfig,
    saving = false,
}: AddParagraphModalProps) {
    if (!open) return null;

    const setField = (field: keyof AddParagraphFormValues, value: unknown) => {
        onFormChange(field, value);
    };
    const currentType = form.type ?? "body";
    const showHebrewBodyOnly = supportsHebrewBodyOnlyFields(currentType, isBaseTranslation);
    const showNoSpace = supportsNoSpace(currentType);
    const showFirstInPage = supportsFirstInPage(currentType);
    const showAttachedMeta = supportsAttachedMeta(currentType);
    const sentences = splitParagraphSentences(form.paragraphText);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b font-bold text-gray-800">הוסף פסקה</div>
                <div className="p-4 overflow-auto space-y-4 flex-1 text-sm">
                    <div className="flex flex-col items-center justify-center py-2">
                        <div className="mt-4 flex flex-col items-center gap-1">
                            <span className="text-xs text-gray-600">סט תאריכים (dateSetId)</span>
                            <button
                                type="button"
                                onClick={onOpenDateSetIdConfig}
                                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-blue-50 text-gray-700 font-medium"
                            >
                                {form.dateSetId ? `הגדר dateSetId (נוכחי: ${form.dateSetId})` : "הגדר dateSetId (ברירת מחדל: 100)"}
                            </button>
                        </div>
                    </div>

                    <label className="block">
                        <span className="text-gray-700 block mb-1 font-semibold">טקסט פסקה מלא</span>
                        <textarea
                            value={form.paragraphText}
                            onChange={(e) => setField("paragraphText", e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 min-h-[120px] whitespace-pre-wrap"
                            dir="rtl"
                            placeholder="הדבק כאן את כל הטקסט. פיצול למשפטים מתבצע לפי שורות (Enter)."
                        />
                    </label>

                    <div className="border border-gray-200 rounded p-2 bg-gray-50">
                        <div className="text-xs text-gray-600 mb-2">
                            תצוגה מקדימה של משפטים לשמירה ב-Sheets ({sentences.length})
                        </div>
                        <div className="max-h-44 overflow-auto space-y-1 text-xs">
                            {sentences.length === 0 ? (
                                <div className="text-gray-400">אין משפטים עדיין</div>
                            ) : (
                                sentences.map((sentence, index) => (
                                    <div key={`${index}_${sentence.slice(0, 10)}`} className="border border-gray-200 rounded bg-white px-2 py-1">
                                        <span className="text-gray-500 ml-1">{index + 1}.</span>
                                        <span>{sentence}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 p-3 bg-gray-50 rounded text-[10px]">
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.type}>
                            <span className="text-gray-600 w-20 shrink-0">סוג</span>
                            <select
                                value={form.type}
                                onChange={(e) => setField("type", e.target.value)}
                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                            >
                                {ITEM_TYPE_OPTIONS.map((o) => (
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
                        {showHebrewBodyOnly && (
                            <>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.fontTanach}>
                                    <input type="checkbox" checked={form.fontTanach} onChange={(e) => setField("fontTanach", e.target.checked)} />
                                    <span className="text-gray-600">גופן תנ"ך</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.bold}>
                                    <input type="checkbox" checked={form.bold} onChange={(e) => setField("bold", e.target.checked)} />
                                    <span className="text-gray-600">גופן מודגש</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.centerAlign}>
                                    <input type="checkbox" checked={form.centerAlign} onChange={(e) => setField("centerAlign", e.target.checked)} />
                                    <span className="text-gray-600">מיושר לאמצע</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.lineLine}>
                                    <input type="checkbox" checked={form.lineLine} onChange={(e) => setField("lineLine", e.target.checked)} />
                                    <span className="text-gray-600">שורה שורה</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.red}>
                                    <input type="checkbox" checked={form.red} onChange={(e) => setField("red", e.target.checked)} />
                                    <span className="text-gray-600">טקסט אדום</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.justifyBlock}>
                                    <input type="checkbox" checked={form.justifyBlock} onChange={(e) => setField("justifyBlock", e.target.checked)} />
                                    <span className="text-gray-600">יישור בלוק</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                                    <input type="checkbox" checked={form.block} onChange={(e) => setField("block", e.target.checked)} />
                                    <span className="text-gray-600">פיסקה</span>
                                </label>
                            </>
                        )}
                        {showNoSpace && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                                <input type="checkbox" checked={form.noSpace} onChange={(e) => setField("noSpace", e.target.checked)} />
                                <span className="text-gray-600">ללא רווח</span>
                            </label>
                        )}
                        {showFirstInPage && (
                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                                <input type="checkbox" checked={form.firstInPage} onChange={(e) => setField("firstInPage", e.target.checked)} />
                                <span className="text-gray-600">ראשון בעמוד</span>
                            </label>
                        )}
                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialDate}>
                            <input type="checkbox" checked={form.specialDate} onChange={(e) => setField("specialDate", e.target.checked)} />
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
                                    <input type="text" value={form.role} onChange={(e) => setField("role", e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" dir="rtl" />
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.reference}>
                                    <span className="text-gray-600 w-20 shrink-0">מקורות</span>
                                    <input type="text" value={form.reference} onChange={(e) => setField("reference", e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" />
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialSign}>
                                    <span className="text-gray-600 w-20 shrink-0">סימן מיוחד</span>
                                    <input type="text" value={form.specialSign} onChange={(e) => setField("specialSign", e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0" />
                                </label>
                            </>
                        )}
                    </div>
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
                        disabled={saving || sentences.length === 0}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                    >
                        {saving ? "שומר..." : "הוסף פסקה"}
                    </button>
                </div>
            </div>
        </div>
    );
}
