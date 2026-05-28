/**
 * DateFilterBar – סרגל עליון: סינון לפי תאריך + פרסום נוסח לאפליקציה.
 *
 * מציג:
 *   - HebrewSingleDatePicker: בוחר יום בודד בלוח עברי (popover)
 *   - כפתור "חזרה להיום" כשהתאריך הנבחר אינו היום
 *   - badge עם מספר ה-dateSetIds הפעילים (כשהסינון פעיל)
 *   - כפתור toggle "הצג הכל" — מבטל את הסינון
 *   - כפתור "פרסום {נוסח} לאפליקציה" — מעדכן timestamp לנוסח (לא תלוי בחלק תפילה פתוח)
 *
 * כל הנתונים והפעולות מגיעים ב-props (controlled) — ה-state נמצא ב-useDateFilter / usePartEdit.
 */

import React from "react";
import { HebrewSingleDatePicker } from "./HebrewSingleDatePicker";
import { getNusachPalette } from "../utils/nusachPalette";

export type DateFilterBarProps = {
    filterDate: Date;
    onDateChange: (date: Date) => void;
    showAll: boolean;
    onShowAllToggle: (v: boolean) => void;
    relevantDateSetIds: string[] | null;
    hebrewLabel: string;
    isLoading: boolean;
    /** נדרש להפעלת פרסום (מספיק בחירת נוסח) */
    selectedTocId?: string | null;
    publishNusachLabel?: string | null;
    saving?: boolean;
    onFinalPublish?: () => void;
};

/** משווה האם שני תאריכים מתייחסים לאותו יום קלנדרי (לפי שעון מקומי) */
function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function DateFilterBar({
    filterDate,
    onDateChange,
    showAll,
    onShowAllToggle,
    relevantDateSetIds,
    isLoading,
    selectedTocId = null,
    publishNusachLabel,
    saving = false,
    onFinalPublish,
}: DateFilterBarProps) {
    const isToday = isSameDay(filterDate, new Date());
    const activeCount = relevantDateSetIds?.length ?? 0;
    const canPublish = !!selectedTocId && !!onFinalPublish;

    const p = getNusachPalette(selectedTocId);
    const publishBtnStyle = {
        backgroundColor: p.selectedColors[0],
        color: p.darkText[0] ? "#1a1a1a" : "#ffffff",
        borderColor: p.selectedColors[0],
    };

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

    const handleResetToToday = () => {
        onDateChange(new Date());
        onShowAllToggle(false);
    };

    return (
        <div
            className="flex flex-wrap items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded shrink-0 text-sm"
            dir="rtl"
            role="region"
            aria-label="סינון לפי תאריך ופרסום"
        >
            <span className="font-semibold text-gray-700">סינון לפי תאריך:</span>

            <HebrewSingleDatePicker
                value={filterDate}
                onChange={onDateChange}
                disabled={showAll}
            />

            {!showAll && !isToday && (
                <button
                    type="button"
                    onClick={handleResetToToday}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                    חזרה להיום
                </button>
            )}

            {!showAll && (
                <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
                    title="כמה מזהי dateSetId פעילים בתאריך הנבחר (כולל '100' = תמיד)"
                >
                    {isLoading ? "טוען..." : `${activeCount} מזהים פעילים`}
                </span>
            )}

            <button
                type="button"
                onClick={() => onShowAllToggle(!showAll)}
                aria-pressed={showAll}
                className={`px-3 py-1 rounded text-sm border transition-colors ${
                    showAll
                        ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
                title={showAll ? "כעת מוצג הכל ללא סינון. לחץ כדי להפעיל סינון לפי תאריך" : "הצג את כל הפריטים והמקטעים ללא סינון תאריך"}
            >
                {showAll ? "✓ מוצג הכל ללא סינון" : "הצג הכל ללא סינון"}
            </button>

            {onFinalPublish && (
                <>
                    <span className="hidden sm:inline w-px h-5 bg-gray-200 shrink-0" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={onFinalPublish}
                        disabled={saving || !canPublish}
                        className="ms-auto shrink-0 px-3 py-1 rounded font-bold border-2 text-sm max-w-[min(100%,18rem)] truncate disabled:opacity-30"
                        style={publishBtnStyle}
                        title={publishDisabledTitle}
                    >
                        🚀 {publishButtonLabel}
                    </button>
                </>
            )}
        </div>
    );
}
