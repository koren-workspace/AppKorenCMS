/**
 * תגי dateSetId לרשימות פריטים במודלי פיצול / העברה / העתקה.
 * הפריטים תמיד מוצגים במלואם (לא מסננים לפי תאריך — חשוב לפיצול רציף),
 * אבל מסמנים במפורש פריטים שלא פעילים בתאריך שבסרגל הסינון.
 */

import React from "react";

/**
 * תואם לסינון ב-PartEditPanel:
 *   - null = הצג הכל (סינון מבוטל) → כולם "פעילים"
 *   - אין dateSetId → נחשב פעיל (כמו בעורך)
 *   - אחרת: פעיל רק אם ה-id ברשימה
 */
export function isItemActiveForDateFilter(
    dateSetId: string | number | null | undefined,
    relevantDateSetIds: string[] | null | undefined
): boolean {
    if (relevantDateSetIds == null) return true;
    if (dateSetId == null || dateSetId === "") return true;
    return relevantDateSetIds.includes(String(dateSetId));
}

export function ItemDateSetBadges({
    dateSetId,
    relevantDateSetIds,
}: {
    dateSetId: string | number | null | undefined;
    relevantDateSetIds?: string[] | null;
}): React.ReactElement {
    const label = dateSetId != null && dateSetId !== "" ? String(dateSetId) : "—";
    const active = isItemActiveForDateFilter(dateSetId, relevantDateSetIds);
    const isAlways = label === "100" || label === "—";

    return (
        <>
            <span
                className={`text-sm px-1 rounded shrink-0 font-mono ${
                    isAlways
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}
                title="סט תאריכים (dateSetId)"
            >
                ds:{label}
            </span>
            {!active && (
                <span
                    className="text-sm px-1 rounded shrink-0 bg-gray-200 text-gray-600"
                    title="הפריט לא מוצג בעורך תחת סינון התאריך הנוכחי"
                >
                    לא בתאריך הנוכחי
                </span>
            )}
        </>
    );
}

/** הערה קצרה מעל רשימת פריטים במודלים */
export function ItemDateSetListNote({
    relevantDateSetIds,
}: {
    relevantDateSetIds?: string[] | null;
}): React.ReactElement | null {
    if (relevantDateSetIds == null) return null;
    return (
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 mb-1.5">
            מוצגים כל הפריטים (בלי סינון תאריך). פריטים שלא פעילים בתאריך שבסרגל מסומנים ב־
            <span className="font-semibold">«לא בתאריך הנוכחי»</span>.
        </div>
    );
}
