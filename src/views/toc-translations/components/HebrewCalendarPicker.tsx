/**
 * HebrewCalendarPicker – לוח שנה עברי לבחירת תאריכים (יום + חודש).
 * המשתמש בוחר חודש וימי החודש; כל לחיצה על יום מוסיפה/מסירה את התאריך מהרשימה.
 * התוצאה: מערך DateRange (כל תאריך בודד כ־startDate/startMonth = endDate/endMonth).
 */

import React, { useState } from "react";
import type { DateRange } from "../constants/calendarTypes";

const HEBREW_MONTHS: Record<number, string> = {
    1: "ניסן",
    2: "אייר",
    3: "סיוון",
    4: "תמוז",
    5: "אב",
    6: "אלול",
    7: "תשרי",
    8: "חשון",
    9: "כסלו",
    10: "טבת",
    11: "שבט",
    12: "אדר",
    13: "אדר ב",
};

function isDaySelected(ranges: DateRange[], day: number, month: number): boolean {
    return ranges.some(
        (r) =>
            r.startMonth === month &&
            r.startDate === day &&
            r.endMonth === month &&
            r.endDate === day
    );
}

function toggleDay(ranges: DateRange[], day: number, month: number): DateRange[] {
    const filtered = ranges.filter(
        (r) =>
            !(r.startMonth === month && r.startDate === day && r.endMonth === month && r.endDate === day)
    );
    if (filtered.length === ranges.length) {
        return [...ranges, { startDate: day, startMonth: month, endDate: day, endMonth: month }];
    }
    return filtered;
}

export type HebrewCalendarPickerProps = {
    value: DateRange[];
    onChange: (ranges: DateRange[]) => void;
    /** כותרת מעל הלוח (למשל "תאריכים שאומרים") */
    title?: string;
};

const DAYS_IN_MONTH = 30;

export function HebrewCalendarPicker({ value, onChange, title }: HebrewCalendarPickerProps) {
    const [currentMonth, setCurrentMonth] = useState(7);

    const handleDayClick = (day: number) => {
        onChange(toggleDay(value, day, currentMonth));
    };

    const monthOptions = Object.entries(HEBREW_MONTHS).map(([num, name]) => (
        <option key={num} value={num}>
            {name}
        </option>
    ));

    return (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50" dir="rtl">
            {title && (
                <div className="text-gray-700 font-medium mb-2 text-base">{title}</div>
            )}
            <div className="flex flex-wrap gap-3 items-start">
                <div>
                    <label className="block text-sm text-gray-500 mb-1">חודש</label>
                    <select
                        value={currentMonth}
                        onChange={(e) => setCurrentMonth(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1.5 text-base"
                    >
                        {monthOptions}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <div className="grid grid-cols-5 gap-0.5">
                        {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map((day) => {
                            const selected = isDaySelected(value, day, currentMonth);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDayClick(day)}
                                    className={`w-9 h-9 rounded text-base border ${
                                        selected
                                            ? "bg-blue-600 text-white border-blue-700"
                                            : "bg-white border-gray-300 hover:bg-blue-50"
                                    }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                        לחץ על יום כדי לסמן/לבטל. נבחרו {value.length} תאריכים.
                    </p>
                </div>
            </div>
        </div>
    );
}
