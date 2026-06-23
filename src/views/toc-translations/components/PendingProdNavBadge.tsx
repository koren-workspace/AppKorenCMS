import React from "react";

type PendingProdNavBadgeProps = {
    /** compact = שורת ניווט; default = תג מלא יותר */
    compact?: boolean;
};

/** תג על ישות מבנה (חלק/קטגוריה/תפילה) שנשמרה לסטייג' בלבד */
export function PendingProdNavBadge({ compact = false }: PendingProdNavBadgeProps) {
    if (compact) {
        return (
            <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-blue-100 px-1 py-px text-[9px] font-semibold leading-none text-blue-800"
                title="נשמר לסטייג' בלבד — ממתין לשמירת מבנה לפרוד"
            >
                <span
                    className="inline-block h-1 w-1 rounded-full bg-blue-700"
                    aria-hidden="true"
                />
                פרוד
            </span>
        );
    }

    return (
        <span
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800"
            title="נשמר לסטייג' בלבד — ממתין לשמירת מבנה לפרוד"
        >
            <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-blue-700"
                aria-hidden="true"
            />
            ממתין לפרוד
        </span>
    );
}
