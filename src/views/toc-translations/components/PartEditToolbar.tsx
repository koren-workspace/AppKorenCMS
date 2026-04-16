/**
 * PartEditToolbar – סרגל פעולות באזור העריכה
 *
 * מציג את שם החלק תפילה הנבחר (או הודעת מצב) + כפתורים:
 *   - "שמור חלק תפילה": רק כשחלק תפילה נבחר — שומר שינויים ל-Firestore (מושבת אם אין שינויים או במצב saving)
 *   - כפתור "פרסום {נוסח} לאפליקציה": תמיד גלוי כשהמסך פעיל; מופעל כשנבחר נוסח (TOC) — מעדכן timestamp לנוסח
 */

import React from "react";

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
                <h3 className="font-bold text-base text-gray-800">
                    {hasPart ? selectedGroupId : "בחר חלק תפילה לעריכת פריטים"}
                </h3>
                <div className="flex gap-2 flex-wrap items-center">
                    {allowSplitAndMove && hasPart && (
                        <>
                            <button
                                type="button"
                                onClick={onSplitPart}
                                disabled={saving}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded font-bold text-[10px] disabled:opacity-30 hover:bg-purple-700"
                                title="פצל חלק תפילה – יצירת חלק תפילה חדש מחלק מהפריטים"
                            >
                                ✂ פצל חלק תפילה
                            </button>
                            <button
                                type="button"
                                onClick={onMoveItemsToPart}
                                disabled={saving}
                                className="px-3 py-1.5 bg-orange-500 text-white rounded font-bold text-[10px] disabled:opacity-30 hover:bg-orange-600"
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
                            className="px-4 py-1.5 bg-green-600 text-white rounded font-bold disabled:opacity-30"
                        >
                            {saving ? "שומר..." : "שמור חלק תפילה"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onFinalPublish}
                        disabled={saving || !canPublish}
                        className="px-3 py-1.5 bg-blue-800 text-white rounded font-bold border-2 border-blue-400 text-[10px] max-w-[min(100%,14rem)] truncate sm:max-w-[18rem] disabled:opacity-30"
                        title={publishDisabledTitle}
                    >
                        🚀 {publishButtonLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
