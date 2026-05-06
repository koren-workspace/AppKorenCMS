/**
 * HebrewCalendarPicker – בחירת ימים בודדים וטווחי תאריכים עבריים.
 */

import React, { useMemo, useState } from "react";
import {
    HEBREW_MONTHS,
    dateRangeKey,
    formatDateRangeLabel,
    isSingleDayRange,
    normalizeDateRange,
    sortDateRanges,
    type DateRange,
} from "../constants/calendarTypes";

export type HebrewCalendarPickerProps = {
    value: DateRange[];
    onChange: (ranges: DateRange[]) => void;
    /** כותרת מעל הלוח (למשל "תאריכים שאומרים") */
    title?: string;
};

const DAYS_IN_MONTH = 30;

function clampDay(value: number): number {
    if (value < 1) return 1;
    if (value > DAYS_IN_MONTH) return DAYS_IN_MONTH;
    return value;
}

function compareMonthDay(leftMonth: number, leftDay: number, rightMonth: number, rightDay: number): number {
    if (leftMonth !== rightMonth) return leftMonth - rightMonth;
    return leftDay - rightDay;
}

function createRange(startDay: number, startMonth: number, endDay: number, endMonth: number): DateRange {
    const normalizedStartDay = clampDay(Number(startDay));
    const normalizedEndDay = clampDay(Number(endDay));
    const normalizedStartMonth = Number(startMonth);
    const normalizedEndMonth = Number(endMonth);

    if (compareMonthDay(normalizedStartMonth, normalizedStartDay, normalizedEndMonth, normalizedEndDay) <= 0) {
        return {
            startDate: normalizedStartDay,
            startMonth: normalizedStartMonth,
            endDate: normalizedEndDay,
            endMonth: normalizedEndMonth,
        };
    }

    return {
        startDate: normalizedEndDay,
        startMonth: normalizedEndMonth,
        endDate: normalizedStartDay,
        endMonth: normalizedStartMonth,
    };
}

function normalizeAndDedupeRanges(ranges: DateRange[]): DateRange[] {
    const unique = new Map<string, DateRange>();
    for (const range of ranges) {
        const normalized = normalizeDateRange(range);
        unique.set(dateRangeKey(normalized), normalized);
    }
    return sortDateRanges(Array.from(unique.values()));
}

function isDaySelected(ranges: DateRange[], day: number, month: number): boolean {
    return ranges.some((range) => {
        if (!isSingleDayRange(range)) return false;
        const normalized = normalizeDateRange(range);
        return normalized.startMonth === month && normalized.startDate === day;
    });
}

function toggleSingleDay(ranges: DateRange[], day: number, month: number): DateRange[] {
    const keyToToggle = dateRangeKey({ startDate: day, startMonth: month, endDate: day, endMonth: month });
    const exists = ranges.some((range) => {
        if (!isSingleDayRange(range)) return false;
        return dateRangeKey(normalizeDateRange(range)) === keyToToggle;
    });

    const next = exists
        ? ranges.filter((range) => {
              if (!isSingleDayRange(range)) return true;
              return dateRangeKey(normalizeDateRange(range)) !== keyToToggle;
          })
        : [...ranges, { startDate: day, startMonth: month, endDate: day, endMonth: month }];

    return normalizeAndDedupeRanges(next);
}

export function HebrewCalendarPicker({ value, onChange, title }: HebrewCalendarPickerProps) {
    const [currentMonth, setCurrentMonth] = useState(7);
    const [rangeStartMonth, setRangeStartMonth] = useState(7);
    const [rangeStartDay, setRangeStartDay] = useState(1);
    const [rangeEndMonth, setRangeEndMonth] = useState(7);
    const [rangeEndDay, setRangeEndDay] = useState(1);

    const normalizedValue = useMemo(() => normalizeAndDedupeRanges(value), [value]);

    const singleDaysCount = normalizedValue.filter(isSingleDayRange).length;
    const rangesCount = normalizedValue.length - singleDaysCount;

    const handleDayClick = (day: number) => {
        onChange(toggleSingleDay(normalizedValue, day, currentMonth));
    };

    const handleAddRange = () => {
        const nextRange = createRange(rangeStartDay, rangeStartMonth, rangeEndDay, rangeEndMonth);
        onChange(normalizeAndDedupeRanges([...normalizedValue, nextRange]));
    };

    const handleRemoveRange = (keyToRemove: string) => {
        onChange(normalizedValue.filter((range) => dateRangeKey(normalizeDateRange(range)) !== keyToRemove));
    };

    const monthOptions = Object.entries(HEBREW_MONTHS).map(([num, name]) => (
        <option key={num} value={num}>
            {name}
        </option>
    ));

    const dayOptions = Array.from({ length: DAYS_IN_MONTH }, (_, index) => {
        const day = index + 1;
        return (
            <option key={day} value={day}>
                {day}
            </option>
        );
    });

    return (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50" dir="rtl">
            {title && <div className="text-gray-700 font-medium mb-2 text-base">{title}</div>}

            <div className="space-y-3">
                <div className="flex flex-wrap gap-3 items-start">
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">חודש לבחירה מהירה</label>
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
                                const selected = isDaySelected(normalizedValue, day, currentMonth);
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
                        <p className="text-sm text-gray-500 mt-1">
                            לחץ על יום כדי להוסיף או להסיר יום בודד.
                            {normalizedValue.length === 0
                                ? " לא הוגדרו תאריכים."
                                : ` מוגדרים: ${singleDaysCount > 0 ? `${singleDaysCount} ימים בודדים` : ""}${singleDaysCount > 0 && rangesCount > 0 ? ", " : ""}${rangesCount > 0 ? `${rangesCount} טווחים` : ""}.`}
                        </p>
                    </div>
                </div>

                <div className="border border-gray-200 rounded bg-white p-3 space-y-2">
                    <div className="text-sm font-medium text-gray-700">הוסף טווח תאריכים</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <label className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-16">התחלה</span>
                            <select
                                value={rangeStartDay}
                                onChange={(e) => setRangeStartDay(Number(e.target.value))}
                                className="border border-gray-300 rounded px-2 py-1"
                            >
                                {dayOptions}
                            </select>
                            <select
                                value={rangeStartMonth}
                                onChange={(e) => setRangeStartMonth(Number(e.target.value))}
                                className="border border-gray-300 rounded px-2 py-1"
                            >
                                {monthOptions}
                            </select>
                        </label>
                        <label className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-16">סיום</span>
                            <select
                                value={rangeEndDay}
                                onChange={(e) => setRangeEndDay(Number(e.target.value))}
                                className="border border-gray-300 rounded px-2 py-1"
                            >
                                {dayOptions}
                            </select>
                            <select
                                value={rangeEndMonth}
                                onChange={(e) => setRangeEndMonth(Number(e.target.value))}
                                className="border border-gray-300 rounded px-2 py-1"
                            >
                                {monthOptions}
                            </select>
                        </label>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleAddRange}
                            className="inline-flex items-center px-3 py-1.5 text-sm border border-blue-300 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                            הוסף טווח
                        </button>
                    </div>
                </div>

                <div className="border border-gray-200 rounded bg-white p-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">תאריכים שכבר מוגדרים</div>
                    {normalizedValue.length === 0 ? (
                        <div className="text-sm text-gray-400">לא הוגדרו תאריכים</div>
                    ) : (
                        <ul className="space-y-1">
                            {normalizedValue.map((range) => {
                                const key = dateRangeKey(normalizeDateRange(range));
                                return (
                                    <li key={key} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="text-gray-700">{formatDateRangeLabel(range)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRange(key)}
                                            className="inline-flex items-center px-2 py-0.5 text-xs border border-red-300 rounded bg-red-50 text-red-700 hover:bg-red-100"
                                        >
                                            מחק
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
