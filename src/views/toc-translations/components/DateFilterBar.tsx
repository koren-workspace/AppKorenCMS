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

import React, { useState } from "react";
import { HebrewSingleDatePicker } from "./HebrewSingleDatePicker";
import { getNusachPalette } from "../utils/nusachPalette";
import { PublishConfirmModal, type PublishEnvironment } from "./PublishConfirmModal";

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
    /** Prod dual-write */
    onPublishToProd?: () => void;
    /** שמירת מבנה TOC לפרוד */
    pendingProdNavCount?: number;
    onSaveTocToProd?: () => void;
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
    onPublishToProd,
    pendingProdNavCount = 0,
    onSaveTocToProd,
}: DateFilterBarProps) {
    const isToday = isSameDay(filterDate, new Date());
    const activeCount = relevantDateSetIds?.length ?? 0;
    const canPublish = !!selectedTocId && !!onFinalPublish;
    const canSaveNavToProd = !!selectedTocId && !!onSaveTocToProd && pendingProdNavCount > 0;

    const p = getNusachPalette(selectedTocId);
    const publishBtnStyle = {
        backgroundColor: p.selectedColors[0],
        color: p.darkText[0] ? "#1a1a1a" : "#ffffff",
        borderColor: p.selectedColors[0],
    };

    const trimmedNusach = publishNusachLabel?.trim() ?? "";
    const hasNusachLabel = trimmedNusach.length > 0;
    const publishTitle = hasNusachLabel
        ? `פרסם בסטייג': מסמן שהנוסח «${trimmedNusach}» התעדכן בבייגל של סטייג'. האפליקציה מסנכרנת את כל התרגומים של נוסח זה.`
        : "פרסם בסטייג': מסמן שהנוסח הנבחר התעדכן בבייגל של סטייג'.";
    const publishButtonLabel = hasNusachLabel
        ? `פרסם ${trimmedNusach} · סטייג'`
        : "פרסם · סטייג'";
    const prodPublishTitle = hasNusachLabel
        ? `פרסם בפרוד: מסמן שהנוסח «${trimmedNusach}» התעדכן בבייגל של פרוד. האפליקציה בפרוד תסנכרן.`
        : "פרסם בפרוד: מסמן שהנוסח הנבחר התעדכן בבייגל של פרוד.";
    const prodPublishButtonLabel = hasNusachLabel
        ? `פרסם ${trimmedNusach} · פרוד`
        : "פרסם · פרוד";
    const publishDisabledTitle = canPublish
        ? publishTitle
        : "בחר נוסח בעמודות השמאליות כדי לפרסם.";

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmEnv, setConfirmEnv] = useState<PublishEnvironment>("stage");

    const openPublishConfirm = (env: PublishEnvironment) => {
        setConfirmEnv(env);
        setConfirmOpen(true);
    };

    const handlePublishConfirm = () => {
        setConfirmOpen(false);
        if (confirmEnv === "prod") {
            onPublishToProd?.();
        } else {
            onFinalPublish?.();
        }
    };

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
                        onClick={() => openPublishConfirm("stage")}
                        disabled={saving || !canPublish}
                        className="ms-auto shrink-0 px-3 py-1 rounded font-bold border-2 text-sm max-w-[min(100%,18rem)] truncate disabled:opacity-30"
                        style={publishBtnStyle}
                        title={publishDisabledTitle}
                    >
                        🚀 {publishButtonLabel}
                    </button>
                </>
            )}
            {onPublishToProd && (
                <>
                    <span className="hidden sm:inline w-px h-5 bg-gray-200 shrink-0" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={() => openPublishConfirm("prod")}
                        disabled={saving || !canPublish}
                        className="shrink-0 px-3 py-1 rounded font-bold border-2 text-sm max-w-[min(100%,18rem)] truncate disabled:opacity-30"
                        style={{
                            backgroundColor: canPublish ? "#1565c0" : "#90a4ae",
                            color: "#fff",
                            borderColor: canPublish ? "#1565c0" : "#90a4ae",
                        }}
                        title={canPublish ? prodPublishTitle : "בחר נוסח כדי לפרסם בפרוד"}
                    >
                        🚀 {prodPublishButtonLabel}
                    </button>
                </>
            )}
            {onSaveTocToProd && pendingProdNavCount > 0 && (
                <>
                    <span className="hidden sm:inline w-px h-5 bg-gray-200 shrink-0" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={onSaveTocToProd}
                        disabled={saving || !canSaveNavToProd}
                        className="shrink-0 px-3 py-1 rounded font-bold border-2 text-sm border-blue-600 bg-blue-50 text-blue-800 hover:bg-blue-100 disabled:opacity-30"
                        title="שומר שינויי מבנה (קטגוריה/תפילה/חלק) שנשמרו לסטייג' בלבד — לפרוד"
                    >
                        {saving ? "שומר…" : `שמור מבנה · פרוד (${pendingProdNavCount})`}
                    </button>
                </>
            )}
            <PublishConfirmModal
                open={confirmOpen}
                environment={confirmEnv}
                nusachLabel={trimmedNusach || null}
                saving={saving}
                onConfirm={handlePublishConfirm}
                onClose={() => setConfirmOpen(false)}
            />
        </div>
    );
}
