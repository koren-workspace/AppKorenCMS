/**
 * PartEditToolbar – סרגל פעולות באזור העריכה
 *
 * מציג את שם המקטע הנבחר + שני כפתורים:
 *   - "שמור מקטע": שומר שינויים ל-Firestore (מושבת אם אין שינויים או במצב saving)
 *   - "פרסום (Publish)": מעדכן timestamp וקורא ל-Bagel לסנכרון האפליקציה
 *
 * אם אין מקטע נבחר – לא מציג כלום (return null).
 */

import React from "react";
import { ChangeLogEntry } from "../hooks/usePartEdit";
import { FIELD_LABELS } from "../constants/itemFields";

export type PartEditToolbarProps = {
    selectedGroupId: string | null;
    saving: boolean;
    hasChanges: boolean;
    onSaveGroup: () => void;
    onFinalPublish: () => void;
    lastSaveEntries?: ChangeLogEntry[];
    onClearLastSave?: () => void;
};

function fmtVal(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "כן" : "לא";
    const s = String(v);
    return s === "" ? "(ריק)" : s.length > 30 ? s.slice(0, 30) + "…" : s;
}

export function PartEditToolbar({
    selectedGroupId,
    saving,
    hasChanges,
    onSaveGroup,
    onFinalPublish,
    lastSaveEntries = [],
    onClearLastSave,
}: PartEditToolbarProps) {
    if (!selectedGroupId) return null;

    const published = lastSaveEntries.length > 0 && lastSaveEntries.every((e) => e.publishedToBagel);

    return (
        <div className="mb-3 pb-2 border-b shrink-0">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-base">{selectedGroupId}</h3>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onSaveGroup}
                        disabled={saving || !hasChanges}
                        className="px-4 py-1.5 bg-green-600 text-white rounded font-bold disabled:opacity-30"
                    >
                        {saving ? "שומר..." : "שמור מקטע"}
                    </button>
                    <button
                        type="button"
                        onClick={onFinalPublish}
                        disabled={saving}
                        className="px-4 py-1.5 bg-blue-800 text-white rounded font-bold border-2 border-blue-400"
                    >
                        🚀 פרסום (Publish)
                    </button>
                </div>
            </div>

            {/* סיכום שמירה אחרונה */}
            {lastSaveEntries.length > 0 && (
                <div className={`mt-2 p-2 rounded text-[10px] border ${published ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"}`} dir="rtl">
                    <div className="flex justify-between items-center mb-1">
                        <span className={`font-bold ${published ? "text-blue-700" : "text-green-700"}`}>
                            {published ? "✓ פורסם –" : "✓ נשמר –"} {lastSaveEntries.length} שינויים
                        </span>
                        {onClearLastSave && (
                            <button type="button" onClick={onClearLastSave} className="text-gray-400 hover:text-gray-600 text-[9px]">
                                ✕ סגור
                            </button>
                        )}
                    </div>
                    <div className="space-y-0.5">
                        {lastSaveEntries.map((e) => (
                            <div key={e.id} className="flex gap-1 items-baseline flex-wrap">
                                <span className="text-gray-500 font-mono shrink-0">
                                    {e.isEnhancement ? `[${e.enhancementTranslationId}]` : `[${e.translationId}]`}
                                </span>
                                <span className="text-gray-500 shrink-0">item {e.itemId}</span>
                                <span className="font-semibold text-gray-700 shrink-0">
                                    {FIELD_LABELS[e.field] ?? e.field}:
                                </span>
                                <span className="text-red-600 line-through shrink-0">{fmtVal(e.oldValue)}</span>
                                <span className="text-gray-400 shrink-0">→</span>
                                <span className="text-green-700 font-medium shrink-0">{fmtVal(e.newValue)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
