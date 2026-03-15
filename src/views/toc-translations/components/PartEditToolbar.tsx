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

export type PartEditToolbarProps = {
    selectedGroupId: string | null;
    saving: boolean;
    hasChanges: boolean;
    onSaveGroup: () => void;
    onFinalPublish: () => void;
    /** מציג כפתורי פיצול והעברה – רק בנוסח הבסיסי */
    allowSplitAndMove?: boolean;
    onSplitPart?: () => void;
    onMoveItemsToPart?: () => void;
};

export function PartEditToolbar({
    selectedGroupId,
    saving,
    hasChanges,
    onSaveGroup,
    onFinalPublish,
    allowSplitAndMove,
    onSplitPart,
    onMoveItemsToPart,
}: PartEditToolbarProps) {
    if (!selectedGroupId) return null;

    return (
        <div className="mb-3 pb-2 border-b shrink-0">
            <div className="flex justify-between items-center flex-wrap gap-1">
                <h3 className="font-bold text-base">{selectedGroupId}</h3>
                <div className="flex gap-2 flex-wrap items-center">
                    {allowSplitAndMove && (
                        <>
                            <button
                                type="button"
                                onClick={onSplitPart}
                                disabled={saving}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded font-bold text-[10px] disabled:opacity-30 hover:bg-purple-700"
                                title="פצל מקטע – יצירת מקטע חדש מחלק מהפריטים"
                            >
                                ✂ פצל מקטע
                            </button>
                            <button
                                type="button"
                                onClick={onMoveItemsToPart}
                                disabled={saving}
                                className="px-3 py-1.5 bg-orange-500 text-white rounded font-bold text-[10px] disabled:opacity-30 hover:bg-orange-600"
                                title="העבר פריטים למקטע אחר"
                            >
                                ↔ העבר למקטע
                            </button>
                        </>
                    )}
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
        </div>
    );
}
