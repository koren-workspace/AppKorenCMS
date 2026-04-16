/**
 * EditorGuideBanner – הסבר לעורך: מה מותר לערוך, מה להוסיף ואיך
 *
 * מציג הודעה תלוית הקשר לפי סוג התרגום הנבחר:
 * 0-* = בסיס, 1-9 = תרגום רגיל, 10+ = פירוש/תרגום מוגבל.
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
    const prefix = translationId?.split("-")[0] ?? "";
    const prefixNumber = Number.parseInt(prefix, 10);
    const canEditNames = !Number.isNaN(prefixNumber) && prefixNumber < 10;

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
                        <li><strong>לערוך:</strong> שמות ותוכן בכל הרמות: קטגוריות, תפילות, מקטעים ופריטי תוכן.</li>
                        <li><strong>להוסיף:</strong> קטגוריות, תפילות, מקטעים ופריטי תוכן חדשים.</li>
                        <li><strong>פעולות נוספות:</strong> מותר גם למחוק, לפצל מקטע, להעביר פריטים למקטע אחר, וליצור תרגום מקושר לפריט בסיס.</li>
                        <li><strong>איך:</strong> השתמש בכפתורי ההוספה בעמודות הניווט ובאזור העריכה. מה שנוסף כאן הוא המקור שממנו מקשרים תרגומים אחרים.</li>
                    </ul>
                </div>
            </div>
        );
    }

    if (canEditNames) {
        return (
            <div className="shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px]" dir="rtl">
                <span className="shrink-0 mt-0.5" aria-hidden>✎</span>
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-bold text-amber-900">תרגום רגיל ({translationId}) – בלי הוספת מבנה</div>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700 mr-1">
                        <li><strong>לערוך:</strong> שמות של קטגוריות, תפילות ומקטעים, וגם תוכן ומאפיינים של פריטים קיימים.</li>
                        <li><strong>להוסיף:</strong> מותר להוסיף <strong>הוראה</strong> חדשה בתוך המקטע, אבל לא קטגוריה, תפילה, מקטע או פריט בסיס חדש.</li>
                        <li><strong>לא זמין כאן:</strong> מחיקת קטגוריות/תפילות/מקטעים, פיצול מקטע, העברת פריטים ויצירת תרגום מקושר מפריט בסיס.</li>
                        <li><strong>אם צריך להוסיף מבנה או פריט חדש:</strong> עבור לנוסח הבסיסי שמתחיל ב־<strong>0-</strong>, הוסף שם, ואז ערוך או קשר בתרגום הזה.</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <div className="shrink-0 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px]" dir="rtl">
            <span className="shrink-0 mt-0.5" aria-hidden>✎</span>
            <div className="flex-1 min-w-0 space-y-1">
                <div className="font-bold text-amber-900">פירוש / תרגום מוגבל ({translationId})</div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-700 mr-1">
                    <li><strong>לערוך:</strong> תוכן ומאפיינים של פריטים קיימים.</li>
                    <li><strong>להוסיף:</strong> מותר להוסיף רק <strong>הוראה</strong> חדשה בתוך המקטע.</li>
                    <li><strong>מוגבל כאן:</strong> לא עורכים שמות של קטגוריות, תפילות ומקטעים, ולא מוסיפים מבנה חדש.</li>
                    <li><strong>אם צריך מבנה חדש:</strong> הוסף אותו קודם בנוסח בסיסי <strong>0-*</strong>, ואז חזור לכאן לעריכת התוכן המתאים.</li>
                </ul>
            </div>
        </div>
    );
}
