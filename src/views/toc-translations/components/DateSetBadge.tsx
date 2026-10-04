/**
 * DateSetBadge – תגית "מוגבל לתאריכים" של פריט, עם tooltip שמפרט את התנאי.
 *
 * מתריע באדום כשהתנאי לא יתקיים לעולם באפליקציה:
 *   - "deleted": רשומת הלוח מסומנת `deleted: true` ב-Firestore;
 *   - "missing": אין רשומת לוח עם ה-ID הזה (נבדק רק אחרי שהלוח נטען).
 * בשני המקרים האפליקציה מסתירה את הפריט בכל תאריך.
 */

import type { DateSetLabelEntry } from "../hooks/useDateSetLabels";

export type DateSetProblem = "deleted" | "missing" | null;

/** null כשהתנאי תקין, או כשהלוח עוד לא נטען (מפה ריקה). */
export function getDateSetProblem(
    dateSetId: string,
    dateSetLabels: Record<string, DateSetLabelEntry>
): DateSetProblem {
    const entry = dateSetLabels[dateSetId];
    if (entry?.deleted) return "deleted";
    if (!entry && Object.keys(dateSetLabels).length > 0) return "missing";
    return null;
}

const PROBLEM_TEXT: Record<Exclude<DateSetProblem, null>, { badge: string; detail: string }> = {
    deleted: {
        badge: "תנאי תאריך מחוק",
        detail: "רשומת הלוח מסומנת כמחוקה – האפליקציה לא מציגה את הפריט באף תאריך.",
    },
    missing: {
        badge: "תנאי תאריך לא קיים",
        detail: "אין רשומת לוח עם המזהה הזה – האפליקציה לא מציגה את הפריט באף תאריך.",
    },
};

type DateSetBadgeProps = {
    dateSetId: string;
    dateSetLabels: Record<string, DateSetLabelEntry>;
};

export function DateSetBadge({ dateSetId, dateSetLabels }: DateSetBadgeProps) {
    const entry = dateSetLabels[dateSetId] ?? null;
    const short = entry?.short ?? `ID ${dateSetId}`;
    const full = entry?.full ?? short;
    const problem = getDateSetProblem(dateSetId, dateSetLabels);
    const problemText = problem ? PROBLEM_TEXT[problem] : null;

    const badgeClass = problemText
        ? "bg-red-100 border-red-400 text-red-800 font-bold"
        : "bg-violet-100 border-violet-300 text-violet-800 font-medium";
    const badgeText = problemText ? `⚠ ${problemText.badge}` : "מוגבל לתאריכים";

    return (
        <div className="relative group shrink-0 normal-case tracking-normal inline-flex items-center -translate-y-px">
            <span
                className={`inline-flex items-center px-1 py-px rounded text-[10px] leading-none border cursor-default select-none whitespace-nowrap ${badgeClass}`}
                title={problemText?.detail ?? "מוגבל לתאריכים"}
            >
                {badgeText}
            </span>
            <div
                className={`absolute bottom-full right-0 mb-1.5 z-50 invisible group-hover:visible bg-white border rounded-lg shadow-xl p-3 min-w-[220px] max-w-[340px] pointer-events-none ${problemText ? "border-red-400" : "border-violet-300"}`}
            >
                {problemText && (
                    <div className="font-bold text-red-700 text-xs mb-1.5 text-right leading-snug">
                        {problemText.detail}
                    </div>
                )}
                <div className="font-bold text-violet-800 text-sm mb-1.5 text-right leading-snug">{short}</div>
                {full !== short && (
                    <div className="text-gray-700 text-xs text-right leading-relaxed mb-1.5 whitespace-pre-wrap">
                        {full}
                    </div>
                )}
                <div className="text-gray-400 text-xs item-en-ltr border-t border-gray-100 pt-1 mt-1">
                    ID: {dateSetId}
                </div>
            </div>
        </div>
    );
}
