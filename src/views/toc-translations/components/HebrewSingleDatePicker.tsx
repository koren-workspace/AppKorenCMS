/**
 * HebrewSingleDatePicker – בוחר יום עברי בודד (לעומת HebrewCalendarPicker שבוחר טווחים).
 *
 * UI:
 *   - כפתור עיקרי שמראה את התאריך העברי הנוכחי בגימטריה (לדוגמה "ו' ניסן תשפ"ו")
 *   - בלחיצה נפתח popover עם:
 *       • ניווט שנה (◀ / ▶) + תצוגת השנה בגימטריה ובמספר
 *       • dropdown של חודש (1-13, מתאים לשנה מעוברת או רגילה)
 *       • גריד יומי (5×6) עם הימים החוקיים בחודש (29 או 30)
 *       • כפתור "היום"
 *
 * הקומפוננטה controlled: מקבלת value (Date גרגוריאני) ו-onChange.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { HDate } from "@hebcal/core";
import { HEBREW_MONTHS, toHebrewNumeral } from "../constants/calendarTypes";

export type HebrewSingleDatePickerProps = {
    /** התאריך הנבחר (גרגוריאני) – ימוצג ויומר ללוח עברי */
    value: Date;
    /** נקרא כשהמשתמש בוחר תאריך חדש (גרגוריאני) */
    onChange: (date: Date) => void;
    /** מנטרל את הקומפוננטה (מצב "הצג הכל") */
    disabled?: boolean;
};

/** בוחר את שם החודש לתצוגה, עם טיפול נכון באדר א/ב בשנה מעוברת */
function getMonthLabel(month: number, isLeap: boolean): string {
    if (isLeap && month === 12) return "אדר א'";
    if (month === 13) return "אדר ב'";
    return HEBREW_MONTHS[month] ?? `חודש ${month}`;
}

/**
 * כותרות ימות השבוע (RTL): ראשון מימין → שבת משמאל.
 * בגריד עם dir="rtl" התא הראשון נמצא מימין, לכן ראשון הוא הראשון ברשימה.
 */
const WEEKDAY_HEADERS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"] as const;
const WEEKDAY_TITLES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

/** מחזיר את שם השנה בגימטריה (למשל 5786 → תשפ"ו) ע"י שימוש ב-HDate.renderGematriya */
function getHebrewYearLabel(year: number): string {
    try {
        const sample = new HDate(1, 1, year); // 1 ניסן של אותה שנה
        const full = sample.renderGematriya();
        const parts = full.trim().split(/\s+/);
        return parts[parts.length - 1] ?? String(year);
    } catch {
        return String(year);
    }
}

export function HebrewSingleDatePicker({ value, onChange, disabled }: HebrewSingleDatePickerProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    const hd = useMemo(() => new HDate(value), [value]);
    const yy = hd.getFullYear();
    const mm = hd.getMonth();
    const dd = hd.getDate();
    const isLeap = HDate.isLeapYear(yy);
    const monthsInYear = HDate.monthsInYear(yy);
    const daysInMonth = HDate.daysInMonth(mm, yy);

    /**
     * תאי הגריד: ימים מסודרים לפי ימות השבוע (כמו בלוח רגיל).
     * - מזהים את יום השבוע של ה-1 בחודש (0=ראשון … 6=שבת)
     * - מוסיפים תאים ריקים לפני יום 1 כדי שתאריך 1 ייפול בעמודה הנכונה
     * - בסוף משלימים תאים ריקים כך שכל שורה (שבוע) שלמה
     */
    const cells = useMemo<Array<number | null>>(() => {
        const firstDayOfWeek = new HDate(1, mm, yy).getDay(); // 0=ראשון … 6=שבת
        const result: Array<number | null> = [];
        for (let i = 0; i < firstDayOfWeek; i++) result.push(null);
        for (let d = 1; d <= daysInMonth; d++) result.push(d);
        const trailingPadding = (7 - (result.length % 7)) % 7;
        for (let i = 0; i < trailingPadding; i++) result.push(null);
        return result;
    }, [mm, yy, daysInMonth]);

    const triggerLabel = useMemo(() => {
        try {
            return hd.renderGematriya();
        } catch {
            return `${dd}/${mm}/${yy}`;
        }
    }, [hd, dd, mm, yy]);

    /** עדכון תאריך עברי עם clamping בטוח (חודש/יום שלא קיים בשנה החדשה — clamping כלפי מטה) */
    const setHebrew = (year: number, month: number, day: number) => {
        const safeMonth = Math.min(Math.max(1, month), HDate.monthsInYear(year));
        const safeDay = Math.min(Math.max(1, day), HDate.daysInMonth(safeMonth, year));
        const next = new HDate(safeDay, safeMonth, year).greg();
        onChange(next);
    };

    const handleYearPrev = () => setHebrew(yy - 1, mm, dd);
    const handleYearNext = () => setHebrew(yy + 1, mm, dd);
    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setHebrew(yy, Number(e.target.value), dd);
    };
    const handleDayClick = (day: number) => {
        setHebrew(yy, mm, day);
        setOpen(false);
    };
    const handleToday = () => {
        const today = new Date();
        const todayHd = new HDate(today);
        setHebrew(todayHd.getFullYear(), todayHd.getMonth(), todayHd.getDate());
        setOpen(false);
    };

    return (
        <div className="relative inline-block" ref={containerRef} dir="rtl">
            <button
                type="button"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`inline-flex items-center gap-1 border rounded px-2 py-1 text-sm min-w-[12rem] justify-between ${
                    disabled
                        ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                }`}
                aria-haspopup="dialog"
                aria-expanded={open}
                title="פתח לוח עברי לבחירת תאריך"
            >
                <span>{triggerLabel}</span>
                <span className="text-gray-400 text-xs">▾</span>
            </button>

            {open && (
                <div
                    className="absolute top-full mt-1 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-[22rem]"
                    role="dialog"
                    aria-label="בחירת תאריך עברי"
                >
                    {/* ניווט שנה */}
                    <div className="flex items-center justify-between mb-2 gap-2">
                        <button
                            type="button"
                            onClick={handleYearNext}
                            className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-sm"
                            aria-label="שנה הבאה"
                        >
                            ▶
                        </button>
                        <div className="flex flex-col items-center text-center min-w-0">
                            <span className="text-base font-semibold text-gray-900">
                                {getHebrewYearLabel(yy)}
                            </span>
                            <span className="text-xs text-gray-500">{yy}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleYearPrev}
                            className="px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-sm"
                            aria-label="שנה קודמת"
                        >
                            ◀
                        </button>
                    </div>

                    {/* בחירת חודש */}
                    <div className="mb-2">
                        <label className="block text-xs text-gray-500 mb-1">חודש</label>
                        <select
                            value={mm}
                            onChange={handleMonthChange}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                        >
                            {Array.from({ length: monthsInYear }, (_, i) => i + 1).map((m) => (
                                <option key={m} value={m}>
                                    {getMonthLabel(m, isLeap)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* גריד יומי לפי ימות השבוע (כמו בלוח רגיל) */}
                    <div className="mb-2">
                        <label className="block text-xs text-gray-500 mb-1">יום</label>
                        {/* כותרת ימות השבוע: ראשון מימין, שבת משמאל (RTL) */}
                        <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[11px] font-semibold text-gray-500">
                            {WEEKDAY_HEADERS.map((label, idx) => (
                                <div
                                    key={idx}
                                    className={`py-0.5 ${idx === 6 ? "text-blue-600" : ""}`}
                                    title={WEEKDAY_TITLES[idx]}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {cells.map((d, idx) => {
                                if (d === null) {
                                    return <div key={`empty-${idx}`} aria-hidden="true" />;
                                }
                                const selected = d === dd;
                                const dayOfWeek = idx % 7; // 0=ראשון … 6=שבת
                                const isShabbat = dayOfWeek === 6;
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => handleDayClick(d)}
                                        className={`w-full py-1 rounded text-xs border transition-colors ${
                                            selected
                                                ? "bg-blue-600 text-white border-blue-700"
                                                : isShabbat
                                                    ? "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100"
                                                    : "bg-white border-gray-300 text-gray-900 hover:bg-blue-50"
                                        }`}
                                        title={`${toHebrewNumeral(d)} ${getMonthLabel(mm, isLeap)} (${WEEKDAY_TITLES[dayOfWeek]})`}
                                    >
                                        <div className="leading-tight">
                                            <div className="font-semibold">{toHebrewNumeral(d)}</div>
                                            <div className="text-[9px] opacity-70">{d}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* פעולות מהירות */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleToday}
                            className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                            היום
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                            סגור
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
