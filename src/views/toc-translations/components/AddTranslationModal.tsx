/**
 * AddTranslationModal – הוספת תרגום לפריט בסיס
 *
 * מציג את כל התרגומים המקושרים לפריט (מכל התרגומים), מיקום ויזואלי, וטופס מלא עם כל המאפיינים.
 */

import React, { useEffect, useRef, useState } from "react";
import { Entity } from "@firecms/core";
import {
    ITEM_TYPE_OPTIONS,
    TITLE_TYPE_OPTIONS,
    ITEM_FIELD_HELP,
    isBodyLikeType,
    showDiburHamatkhilField,
    supportsAttachedMeta,
    supportsFirstInPage,
    supportsNoSpace,
} from "../constants/itemFields";
import { splitParagraphSentences } from "../utils/itemUtils";

export type TranslationOption = { translationId: string; [k: string]: any };

/** פריט תרגום מקושר (מכל תרגום) – להצגת "כל התרגומים המקושרים לפריט" */
export type ExistingLinkedEntry = { id: string; tId: string; values: any };

export type AddTranslationModalProps = {
    open: boolean;
    onClose: () => void;
    baseItemId: string;
    baseContentPreview: string;
    /** כל הפריטים שמקושרים לפריט הזה – מכל התרגומים (לא רק מאותו סוג) */
    existingLinked: ExistingLinkedEntry[];
    translations: TranslationOption[];
    currentTranslationId: string | null;
    targetPartItemsLinkedToBase: Entity<any>[];
    onLoadTargetPartItems?: (translationId: string) => Promise<void>;
    targetTranslationId: string | null;
    onSelectTargetTranslation: (translationId: string) => void;
    insertAfterItemId: string | null;
    onInsertAfterChange: (itemId: string | null) => void;
    /** טופס מלא: content + type, titleType, title, וכל המאפיינים */
    form: Record<string, any>;
    onFormFieldChange: (field: string, value: unknown) => void;
    onSubmit: () => void;
    saving: boolean;
    /** פותח מודל להגדרת סט תאריכים (מצוא או צור) – התוצאה מוזנת ל־form.dateSetId */
    onOpenDateSetIdConfig?: () => void;
};

export function AddTranslationModal({
    open,
    onClose,
    baseItemId,
    baseContentPreview,
    existingLinked,
    translations,
    currentTranslationId,
    targetPartItemsLinkedToBase,
    onLoadTargetPartItems,
    targetTranslationId,
    onSelectTargetTranslation,
    insertAfterItemId,
    onInsertAfterChange,
    form,
    onFormFieldChange,
    onSubmit,
    saving,
    onOpenDateSetIdConfig,
}: AddTranslationModalProps) {
    const [showProps, setShowProps] = useState(false);
    const onLoadRef = useRef(onLoadTargetPartItems);
    onLoadRef.current = onLoadTargetPartItems;

    useEffect(() => {
        if (!open || !targetTranslationId) return;
        onLoadRef.current?.(targetTranslationId);
    }, [open, targetTranslationId]);

    /** בפתיחת המודל – אם נבחר תרגום בסיס (0-*) מנקים בחירה, כי אסור להוסיף תרגום לתרגום הבסיס */
    useEffect(() => {
        if (open && targetTranslationId && String(targetTranslationId).startsWith("0-")) {
            onSelectTargetTranslation("");
            onInsertAfterChange(null);
        }
    }, [open]);

    if (!open) return null;

    const content = (form.content ?? "").toString().trim();
    const isParagraphMode = form.translationMode === "paragraph";
    const paragraphSentences = splitParagraphSentences(form.content ?? "");
    const baseSentencesCount = splitParagraphSentences(baseContentPreview ?? "").length;
    const canSubmit =
        !!targetTranslationId &&
        (isParagraphMode ? paragraphSentences.length > 0 : content.length > 0);
    const currentType = (form.type ?? "body") as string;
    const showBodyFields = isBodyLikeType(currentType);
    const showNoSpace = supportsNoSpace(currentType);
    const showFirstInPage = supportsFirstInPage(currentType);
    const showAttachedMeta = supportsAttachedMeta(currentType);

    /** קיבוץ לפי תרגום – להצגת "כל התרגומים המקושרים" */
    const byTranslation: Record<string, ExistingLinkedEntry[]> = {};
    existingLinked.forEach((e) => {
        if (!byTranslation[e.tId]) byTranslation[e.tId] = [];
        byTranslation[e.tId].push(e);
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b font-bold text-gray-800">הוסף תרגום לטקסט</div>
                <div className="p-4 overflow-auto space-y-4 flex-1 text-sm">
                    {/* פריט בסיס */}
                    <div>
                        <div className="text-[10px] text-gray-500 mb-1">פריט בסיס (itemId: {baseItemId})</div>
                        <div className="p-2 bg-gray-50 rounded border text-gray-700 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                            {baseContentPreview || "(ללא תוכן)"}
                        </div>
                    </div>

                    {/* כל התרגומים המקושרים לפריט – מכל התרגומים */}
                    {existingLinked.length > 0 && (
                        <div>
                            <div className="text-[10px] font-semibold text-gray-600 mb-2">תרגומים מקושרים לפריט זה (מכל התרגומים)</div>
                            <div className="space-y-2 max-h-32 overflow-auto border border-gray-200 rounded p-2 bg-gray-50">
                                {Object.entries(byTranslation).map(([tId, entries]) => (
                                    <div key={tId} className="border-r-2 border-blue-300 pr-2">
                                        <div className="font-bold text-blue-700 text-[10px]">{tId}</div>
                                        {entries.map((e) => (
                                            <div key={e.id} className="text-[10px] text-gray-600 pr-2 mt-0.5">
                                                <span className="text-[9px] text-gray-500 font-mono mr-1">ID: {e.id}</span>
                                                {(e.values?.content ?? "").slice(0, 60)}
                                                {(e.values?.content?.length ?? 0) > 60 ? "…" : ""}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* בחירת תרגום יעד – רק תרגומים משניים (לא 0-נוסח), כי מוסיפים תרגום לפריט שבסיס */}
                    <div>
                        <label className="block text-[10px] text-gray-600 mb-1">הוסף לתרגום</label>
                        <select
                            value={targetTranslationId ?? ""}
                            onChange={(e) => {
                                const v = e.target.value;
                                onSelectTargetTranslation(v || "");
                                onInsertAfterChange(null);
                            }}
                            className="w-full border border-gray-300 rounded px-2 py-1.5"
                        >
                            <option value="">בחר תרגום</option>
                            {translations
                                .filter((t) => !String(t.translationId ?? "").startsWith("0-"))
                                .map((t) => (
                                    <option key={t.translationId} value={t.translationId}>
                                        {t.translationId}
                                        {t.translationId === currentTranslationId ? " (נוכחי)" : ""}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* מיקום – תצוגה ויזואלית: רשימה עם "הוסף כאן" / "הוסף אחרי" */}
                    {targetTranslationId && (
                        <div>
                            <div className="text-[10px] font-semibold text-gray-600 mb-2">מיקום בתרגום הנבחר</div>
                            <div className="border border-gray-200 rounded divide-y divide-gray-100 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => onInsertAfterChange(null)}
                                    className={`w-full text-right py-2 px-3 text-[11px] font-medium transition-colors ${insertAfterItemId === null ? "bg-indigo-100 text-indigo-800 border-r-4 border-indigo-500" : "bg-white hover:bg-gray-50"}`}
                                >
                                    ↓ הוסף בהתחלה
                                </button>
                                {targetPartItemsLinkedToBase.map((e) => {
                                    const itemId = e.values?.itemId ?? e.id;
                                    const isSelected = insertAfterItemId === itemId;
                                    const preview = (e.values?.content ?? "").slice(0, 50);
                                    return (
                                        <React.Fragment key={e.id}>
                                            <div className="px-3 py-1.5 bg-gray-50 text-[10px] text-gray-500 border-r-2 border-gray-200">
                                                <span className="text-[9px] text-gray-400 font-mono mr-1">ID: {e.id}</span>
                                                {preview}{preview.length >= 50 ? "…" : ""}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onInsertAfterChange(itemId)}
                                                className={`w-full text-right py-2 px-3 text-[11px] font-medium transition-colors ${isSelected ? "bg-indigo-100 text-indigo-800 border-r-4 border-indigo-500" : "bg-white hover:bg-gray-50"}`}
                                            >
                                                ↓ הוסף אחרי פריט זה
                                            </button>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* תוכן */}
                    <div>
                        <div className="mb-2 p-2 border border-gray-200 rounded bg-gray-50">
                            <div className="flex items-center gap-2 text-[11px] text-gray-700 mb-1">
                                <span className="font-semibold">מצב תרגום</span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                                <label className="flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="translationMode"
                                        checked={!isParagraphMode}
                                        onChange={() => onFormFieldChange("translationMode", "regular")}
                                    />
                                    <span>תרגום רגיל</span>
                                </label>
                                <label className="flex items-center gap-1">
                                    <input
                                        type="radio"
                                        name="translationMode"
                                        checked={isParagraphMode}
                                        onChange={() => onFormFieldChange("translationMode", "paragraph")}
                                    />
                                    <span>תרגום פסקה</span>
                                </label>
                            </div>
                            <div className="text-[10px] text-gray-600 mt-1">
                                הפריט מכיל {baseSentencesCount} משפטים
                            </div>
                        </div>
                        <label className="block text-[10px] text-gray-600 mb-1">תוכן התרגום</label>
                        <textarea
                            value={form.content ?? ""}
                            onChange={(e) => onFormFieldChange("content", e.target.value)}
                            className="w-full border border-gray-300 rounded p-2 min-h-[80px] whitespace-pre-wrap"
                            dir="rtl"
                            placeholder="הזן את התרגום"
                        />
                        {isParagraphMode && (
                            <div className="mt-2 border border-gray-200 rounded p-2 bg-gray-50">
                                <div className="text-[10px] text-gray-600 mb-1">
                                    תצוגת משפטים לפסקה ({paragraphSentences.length})
                                </div>
                                <div className="space-y-1 max-h-28 overflow-auto text-[10px]">
                                    {paragraphSentences.length === 0 ? (
                                        <div className="text-gray-400">אין משפטים (פיצול לפי שורות)</div>
                                    ) : (
                                        paragraphSentences.map((sentence, index) => (
                                            <div key={`${index}_${sentence.slice(0, 10)}`} className="px-2 py-1 rounded bg-white border border-gray-200">
                                                <span className="text-gray-500 ml-1">{index + 1}.</span>
                                                <span>{sentence}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* מאפיינים (כמו בפריט רגיל) */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowProps((p) => !p)}
                            className="px-2 py-1 text-gray-600 hover:bg-gray-100 border border-gray-200 rounded text-[10px]"
                        >
                            {showProps ? "הסתר מאפיינים" : "מאפיינים (סוג, כותרת, גופן וכו')"}
                        </button>
                        {showProps && (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 p-2 bg-gray-50 rounded text-[10px] border border-gray-100">
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.type}>
                                    <span className="text-gray-600 w-20 shrink-0">סוג</span>
                                    <select
                                        value={form.type ?? "body"}
                                        onChange={(e) => onFormFieldChange("type", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    >
                                        {ITEM_TYPE_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </label>
                                {(["title", "commentary"] as const).includes((form.type ?? "body") as any) && (
                                    <>
                                        {(form.type ?? "body") === "title" && (
                                            <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.titleType}>
                                                <span className="text-gray-600 w-20 shrink-0">סוג כותרת</span>
                                                <select
                                                    value={form.titleType ?? ""}
                                                    onChange={(e) => onFormFieldChange("titleType", e.target.value)}
                                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                                >
                                                    {TITLE_TYPE_OPTIONS.map((o) => (
                                                        <option key={o.value || "_"} value={o.value}>{o.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}
                                        {showDiburHamatkhilField(form.type, targetTranslationId) && (
                                            <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.titleCommentary}>
                                                <span className="text-gray-600 w-20 shrink-0">דיבור המתחיל</span>
                                                <input
                                                    type="text"
                                                    value={form.title ?? ""}
                                                    onChange={(e) => onFormFieldChange("title", e.target.value)}
                                                    className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                                    dir="rtl"
                                                />
                                            </label>
                                        )}
                                    </>
                                )}
                                {showBodyFields && (
                                    <>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.bold}>
                                            <input
                                                type="checkbox"
                                                checked={!!form.bold}
                                                onChange={(e) => onFormFieldChange("bold", e.target.checked)}
                                            />
                                            <span className="text-gray-600">גופן מודגש</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.centerAlign}>
                                            <input
                                                type="checkbox"
                                                checked={!!form.centerAlign}
                                                onChange={(e) => onFormFieldChange("centerAlign", e.target.checked)}
                                            />
                                            <span className="text-gray-600">מיושר לאמצע</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.lineLine}>
                                            <input
                                                type="checkbox"
                                                checked={!!form.lineLine}
                                                onChange={(e) => onFormFieldChange("lineLine", e.target.checked)}
                                            />
                                            <span className="text-gray-600">שורה שורה</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.red}>
                                            <input
                                                type="checkbox"
                                                checked={!!form.red}
                                                onChange={(e) => onFormFieldChange("red", e.target.checked)}
                                            />
                                            <span className="text-gray-600">טקסט אדום</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.justifyBlock}>
                                            <input
                                                type="checkbox"
                                                checked={!!form.justifyBlock}
                                                onChange={(e) => onFormFieldChange("justifyBlock", e.target.checked)}
                                            />
                                            <span className="text-gray-600">יישור בלוק</span>
                                        </label>
                                        <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.block}>
                                            <input
                                                type="checkbox"
                                                checked={!!form.block}
                                                onChange={(e) => onFormFieldChange("block", e.target.checked)}
                                            />
                                            <span className="text-gray-600">פיסקה</span>
                                        </label>
                                    </>
                                )}
                                {showNoSpace && (
                                    <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.noSpace}>
                                        <input
                                            type="checkbox"
                                            checked={!!form.noSpace}
                                            onChange={(e) => onFormFieldChange("noSpace", e.target.checked)}
                                        />
                                        <span className="text-gray-600">ללא רווח</span>
                                    </label>
                                )}
                                {showFirstInPage && (
                                    <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.firstInPage}>
                                        <input
                                            type="checkbox"
                                            checked={!!form.firstInPage}
                                            onChange={(e) => onFormFieldChange("firstInPage", e.target.checked)}
                                        />
                                        <span className="text-gray-600">ראשון בעמוד</span>
                                    </label>
                                )}
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.specialDate}>
                                    <input
                                        type="checkbox"
                                        checked={!!form.specialDate}
                                        onChange={(e) => onFormFieldChange("specialDate", e.target.checked)}
                                    />
                                    <span className="text-gray-600">תאריך מיוחד</span>
                                </label>
                                <label className="flex items-center gap-1" title={ITEM_FIELD_HELP.cohanim}>
                                    <span className="text-gray-600 w-20 shrink-0">כהנים</span>
                                    <select
                                        value={form.cohanim === null || form.cohanim === undefined ? "" : form.cohanim ? "true" : "false"}
                                        onChange={(e) => onFormFieldChange("cohanim", e.target.value === "" ? null : e.target.value === "true")}
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
                                        value={form.hazan === null || form.hazan === undefined ? "" : form.hazan ? "true" : "false"}
                                        onChange={(e) => onFormFieldChange("hazan", e.target.value === "" ? null : e.target.value === "true")}
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
                                        value={form.minyan === null || form.minyan === undefined ? "" : form.minyan ? "true" : "false"}
                                        onChange={(e) => onFormFieldChange("minyan", e.target.value === "" ? null : e.target.value === "true")}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    >
                                        <option value="">לא מוגדר</option>
                                        <option value="true">כן</option>
                                        <option value="false">לא</option>
                                    </select>
                                </label>
                                {showAttachedMeta && (
                                    <>
                                        <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.role}>
                                            <span className="text-gray-600 w-20 shrink-0">תפקיד</span>
                                            <input
                                                type="text"
                                                value={form.role ?? ""}
                                                onChange={(e) => onFormFieldChange("role", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                                dir="rtl"
                                            />
                                        </label>
                                        <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.reference}>
                                            <span className="text-gray-600 w-20 shrink-0">מקורות</span>
                                            <input
                                                type="text"
                                                value={form.reference ?? ""}
                                                onChange={(e) => onFormFieldChange("reference", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                            />
                                        </label>
                                        <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.specialSign}>
                                            <span className="text-gray-600 w-20 shrink-0">סימן מיוחד</span>
                                            <input
                                                type="text"
                                                value={form.specialSign ?? ""}
                                                onChange={(e) => onFormFieldChange("specialSign", e.target.value)}
                                                className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                            />
                                        </label>
                                    </>
                                )}
                                <label className="flex items-center gap-1 col-span-2" title={ITEM_FIELD_HELP.dateSetId}>
                                    <span className="text-gray-600 w-20 shrink-0">dateSetId</span>
                                    <input
                                        type="text"
                                        value={form.dateSetId ?? ""}
                                        onChange={(e) => onFormFieldChange("dateSetId", e.target.value)}
                                        className="border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                                    />
                                    {onOpenDateSetIdConfig && (
                                        <button
                                            type="button"
                                            onClick={onOpenDateSetIdConfig}
                                            className="shrink-0 px-2 py-0.5 text-xs border border-blue-300 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                                        >
                                            הגדר סט תאריכים
                                        </button>
                                    )}
                                </label>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={!canSubmit || saving}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                    >
                        {saving ? "שומר…" : "הוסף תרגום"}
                    </button>
                </div>
            </div>
        </div>
    );
}
