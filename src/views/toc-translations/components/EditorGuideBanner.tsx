/**
 * EditorGuideBanner – הסבר לעורך: מה מותר לערוך, מה להוסיף ואיך
 *
 * מציג הודעה תלוית הקשר לפי סוג התרגום הנבחר (בסיסי 0-* או נוסח משני).
 */

import React from "react";

type EditorGuideBannerProps = {
    /** מזהה התרגום הנבחר (למשל 0-ashkenaz או 1-ashkenaz) */
    translationId: string | undefined;
    /** האם נבחר תרגום (יש נוסח + תרגום) */
    hasSelection: boolean;
};

export function EditorGuideBanner({
    translationId,
    hasSelection,
}: EditorGuideBannerProps) {
    const isBase = Boolean(translationId?.startsWith?.("0-"));

    if (!hasSelection) {
        return (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[10px]" dir="rtl">
                <span className="shrink-0 text-slate-400" aria-hidden>ℹ️</span>
                <span>
                    בחר <strong>נוסח</strong> ואז <strong>תרגום</strong> כדי להתחיל. ההסבר על מה מותר לערוך ולהוסיף יופיע כאן.
                </span>
            </div>
        );
    }

    if (isBase) {
        return (
            <div className="shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px]" dir="rtl">
                <span className="shrink-0 mt-0.5" aria-hidden>✓</span>
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-bold text-emerald-900">נוסח בסיסי ({translationId}) – כאן מותר גם להוסיף</div>
                    <ul className="list-disc list-inside space-y-0.5 text-emerald-700 mr-1">
                        <li><strong>לערוך:</strong> תוכן קיים בכל רמה (קטגוריות, תפילות, פריטים).</li>
                        <li><strong>להוסיף:</strong> קטגוריות חדשות, תפילות חדשות ופריטים (פריטים) חדשים.</li>
                        <li><strong>איך:</strong> השתמש בכפתורי „הוסף קטגוריה“, „הוסף תפילה“ ו„הוסף פריט כאן“ / „הוסף בראש הפריט“. שאר הנוסחים מקושרים לנוסח הבסיסי.</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px]" dir="rtl">
            <span className="shrink-0 mt-0.5" aria-hidden>✎</span>
            <div className="flex-1 min-w-0 space-y-1">
                <div className="font-bold text-amber-900">נוסח משני ({translationId}) – עריכה בלבד</div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700 mr-1">
                    <li><strong>לערוך:</strong> תוכן קיים – טקסט בפריטים, שמירה ופרסום.</li>
                    <li><strong>לא להוסיף:</strong> קטגוריות, תפילות או פריטים חדשים – אין כפתורי הוספה.</li>
                    <li><strong>איך להוסיף תוכן חדש:</strong> עבור לנוסח הבסיסי (זה שמזההו מתחיל ב־0-, למשל 0-ashkenaz), הוסף שם את הקטגוריה/תפילה/פריט, ואז קשר או העתק לנוסח הזה.</li>
                </ul>
            </div>
        </div>
    );
}
