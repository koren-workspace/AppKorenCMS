/**
 * PartEditToolbar – סרגל פעולות באזור העריכה
 *
 * מציג את שם החלק תפילה הנבחר (או הודעת מצב) + כפתורים:
 *   - "שמור חלק תפילה": רק כשחלק תפילה נבחר — שומר שינויים ל-Firestore (מושבת אם אין שינויים או במצב saving)
 *   - כפתור "פרסום {נוסח} לאפליקציה": תמיד גלוי כשהמסך פעיל; מופעל כשנבחר נוסח (TOC) — מעדכן timestamp לנוסח
 */

import React from "react";
import { getNusachPalette } from "../utils/nusachPalette";

export type PartEditToolbarProps = {
    selectedGroupId: string | null;
    /** נדרש להפעלת פרסום (מספיק בחירת נוסח; לא חובה חלק תפילה פתוח) */
    selectedTocId: string | null;
    /** שם הנוסח הנבחר (להבהרה: פרסום לבייגל חל על כל הנוסח, לא רק על החלק תפילה) */
    publishNusachLabel?: string | null;
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
    selectedTocId,
    publishNusachLabel,
    saving,
    hasChanges,
    onSaveGroup,
    onFinalPublish,
    allowSplitAndMove,
    onSplitPart,
    onMoveItemsToPart,
}: PartEditToolbarProps) {
    const hasPart = !!selectedGroupId;
    const canPublish = !!selectedTocId;

    const p = getNusachPalette(selectedTocId);
    const btn = (i: 0|1|2|3|4) => ({
        backgroundColor: p.selectedColors[i],
        color: p.darkText[i] ? '#1a1a1a' : '#ffffff',
        borderColor: p.selectedColors[i],
    });

    const trimmedNusach = publishNusachLabel?.trim() ?? "";
    const hasNusachLabel = trimmedNusach.length > 0;
    const publishTitle = hasNusachLabel
        ? `מסמן שהנוסח «${trimmedNusach}» התעדכן בבייגל. האפליקציה מסנכרנת את כל התרגומים של נוסח זה — לא רק את החלק תפילה הפתוח.`
        : "מסמן שהנוסח הנבחר התעדכן בבייגל; האפליקציה מסנכרנת לפי נוסח (לא לפי חלק תפילה בודד).";
    const publishButtonLabel = hasNusachLabel
        ? `פרסום ${trimmedNusach} לאפליקציה`
        : "פרסום לאפליקציה";
    const publishDisabledTitle = canPublish
        ? publishTitle
        : "בחר נוסח בעמודות השמאליות כדי לפרסם לאפליקציה.";

    return (
        <div className="mb-3 pb-2 border-b shrink-0">
            <div className="flex justify-between items-center flex-wrap gap-1">
                <h3 className="font-bold text-lg text-gray-800">
                    {hasPart ? selectedGroupId : "בחר חלק תפילה לעריכת פריטים"}
                </h3>
                <div className="flex gap-2 flex-wrap items-center">
                    {allowSplitAndMove && hasPart && (
                        <>
                            <button
                                type="button"
                                onClick={onSplitPart}
                                disabled={saving}
                                className="px-3 py-2 rounded font-bold text-sm disabled:opacity-30"
                                style={btn(2)}
                                title="פצל חלק תפילה – יצירת חלק תפילה חדש מחלק מהפריטים"
                            >
                                ✂ פצל חלק תפילה
                            </button>
                            <button
                                type="button"
                                onClick={onMoveItemsToPart}
                                disabled={saving}
                                className="px-3 py-2 rounded font-bold text-sm disabled:opacity-30"
                                style={btn(3)}
                                title="העבר פריטים לחלק תפילה אחר"
                            >
                                ↔ העבר לחלק תפילה
                            </button>
                        </>
                    )}
                    {hasPart && (
                        <button
                            type="button"
                            onClick={onSaveGroup}
                            disabled={saving || !hasChanges}
                            className="px-4 py-2 rounded font-bold text-base disabled:opacity-30"
                            style={btn(1)}
                        >
                            {saving ? "שומר..." : "שמור חלק תפילה"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onFinalPublish}
                        disabled={saving || !canPublish}
                        className="px-3 py-2 rounded font-bold border-2 text-sm max-w-[min(100%,14rem)] truncate sm:max-w-[18rem] disabled:opacity-30"
                        style={btn(0)}
                        title={publishDisabledTitle}
                    >
                        🚀 {publishButtonLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
