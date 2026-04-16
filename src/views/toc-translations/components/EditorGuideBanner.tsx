/**
 * EditorGuideBanner – הסבר לעורך: מה מותר לערוך, מה להוסיף ואיך
 *
 * מציג הודעה תלוית הקשר לפי סוג התרגום הנבחר:
 * 0-* = בסיס, 1-9 = תרגום רגיל, 10+ = פירוש/תרגום מוגבל.
 * התוכן המפורט בתוך תיבה מתקפתלת (ברירת מחדל: מכווץ).
 */

import React, { useEffect, useState } from "react";

type EditorGuideBannerProps = {
    /** מזהה התרגום הנבחר (למשל 0-ashkenaz או 1-ashkenaz) */
    translationId: string | undefined;
    /** האם נבחר תרגום (יש נוסח + תרגום) */
    hasSelection: boolean;
};

type GuideTone = "emerald" | "amber";

function GuideCollapsible({
    tone,
    icon,
    title,
    summaryKey,
    children,
}: {
    tone: GuideTone;
    icon: React.ReactNode;
    title: React.ReactNode;
    /** משתנה כשההקשר משתנה — מאפס מצב פתוח */
    summaryKey: string;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(false);
    }, [summaryKey]);

    const shell =
        tone === "emerald"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-amber-50 border-amber-200 text-amber-800";
    const titleCls =
        tone === "emerald" ? "text-emerald-900" : "text-amber-900";
    const btn =
        tone === "emerald"
            ? "text-emerald-800 border-emerald-300 hover:bg-emerald-100"
            : "text-amber-800 border-amber-300 hover:bg-amber-100";

    return (
        <div className={`shrink-0 rounded-lg border text-[10px] ${shell}`} dir="rtl">
            <div className="flex items-center gap-2 px-3 py-2">
                <span className="shrink-0" aria-hidden>
                    {icon}
                </span>
                <div className={`flex-1 min-w-0 font-bold text-[11px] leading-snug ${titleCls}`}>
                    {title}
                </div>
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className={`shrink-0 px-2 py-1 rounded border text-[10px] font-semibold ${btn}`}
                    aria-expanded={open}
                >
                    {open ? "צמצם" : "הרחב"}
                </button>
            </div>
            {open && (
                <div
                    className={`px-3 pb-2.5 pt-1 border-t ${
                        tone === "emerald" ? "border-emerald-200/80" : "border-amber-200/80"
                    }`}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

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
            <GuideCollapsible
                tone="emerald"
                icon={<span className="mt-0.5 inline-block" aria-hidden>✓</span>}
                title={<>נוסח בסיסי ({translationId}) – כאן מותר גם להוסיף</>}
                summaryKey={`base:${translationId}`}
            >
                <ul className="list-disc list-inside space-y-0.5 text-emerald-700 mr-1">
                    <li><strong>לערוך:</strong> שמות ותוכן בכל הרמות: קטגוריות, תפילות, חלקי תפילה ופריטי תוכן.</li>
                    <li><strong>להוסיף:</strong> קטגוריות, תפילות, חלקי תפילה ופריטי תוכן חדשים.</li>
                    <li><strong>פעולות נוספות:</strong> מותר גם למחוק, לפצל חלק תפילה, להעביר פריטים לחלק תפילה אחר, וליצור תרגום מקושר לפריט בסיס.</li>
                    <li><strong>איך:</strong> השתמש בכפתורי ההוספה בעמודות הניווט ובאזור העריכה. מה שנוסף כאן הוא המקור שממנו מקשרים תרגומים אחרים.</li>
                </ul>
            </GuideCollapsible>
        );
    }

    if (canEditNames) {
        return (
            <GuideCollapsible
                tone="amber"
                icon={<span className="mt-0.5 inline-block" aria-hidden>✎</span>}
                title={<>תרגום רגיל ({translationId}) – בלי הוספת מבנה</>}
                summaryKey={`regular:${translationId}`}
            >
                <ul className="list-disc list-inside space-y-0.5 text-amber-700 mr-1">
                    <li><strong>לערוך:</strong> שמות של קטגוריות, תפילות וחלקי תפילה, וגם תוכן ומאפיינים של פריטים קיימים.</li>
                    <li><strong>להוסיף:</strong> מותר להוסיף <strong>הוראה</strong> חדשה בתוך חלק התפילה, אבל לא קטגוריה, תפילה, חלק תפילה או פריט בסיס חדש.</li>
                    <li><strong>לא זמין כאן:</strong> מחיקת קטגוריות/תפילות/חלקי תפילה, פיצול חלק תפילה, העברת פריטים ויצירת תרגום מקושר מפריט בסיס.</li>
                    <li><strong>אם צריך להוסיף מבנה או פריט חדש:</strong> עבור לנוסח הבסיסי שמתחיל ב־<strong>0-</strong>, הוסף שם, ואז ערוך או קשר בתרגום הזה.</li>
                </ul>
            </GuideCollapsible>
        );
    }

    return (
        <GuideCollapsible
            tone="amber"
            icon={<span className="mt-0.5 inline-block" aria-hidden>✎</span>}
            title={<>פירוש / תרגום מוגבל ({translationId})</>}
            summaryKey={`limited:${translationId}`}
        >
            <ul className="list-disc list-inside space-y-0.5 text-amber-700 mr-1">
                <li><strong>לערוך:</strong> תוכן ומאפיינים של פריטים קיימים.</li>
                <li><strong>להוסיף:</strong> מותר להוסיף רק <strong>הוראה</strong> חדשה בתוך חלק התפילה.</li>
                <li><strong>מוגבל כאן:</strong> לא עורכים שמות של קטגוריות, תפילות וחלקי תפילה, ולא מוסיפים מבנה חדש.</li>
                <li><strong>אם צריך מבנה חדש:</strong> הוסף אותו קודם בנוסח בסיסי <strong>0-*</strong>, ואז חזור לכאן לעריכת התוכן המתאים.</li>
            </ul>
        </GuideCollapsible>
    );
}
