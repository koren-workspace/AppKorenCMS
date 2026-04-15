/**
 * DateSetIdConfigModal – הגדרת סט תאריכים (dateSetId) לפי מבנה calendar.json.
 * מאפשר למשתמש להגדיר את כל המאפיינים; בלחיצה על "החל" בודק אם קיים dateSetId זהה,
 * ואם לא – יוצר רשומה חדשה בלוח ונותן את ה-ID הבא.
 */

import React, { useState, useEffect } from "react";
import {
    defaultDateSetIdFormValues,
    entityValuesToFormValues,
    type DateSetIdFormValues,
    type DateRange,
} from "../constants/calendarTypes";
import { resolveDateSetId, fetchCalendarEntryById } from "../services/calendarService";
import { HebrewCalendarPicker } from "./HebrewCalendarPicker";

export type DateSetIdConfigModalProps = {
    open: boolean;
    onClose: () => void;
    /** מקור נתונים (dataSource) ל-Firestore */
    dataSource: { fetchCollection: (opts: any) => Promise<any[]>; saveEntity: (opts: any) => Promise<any> };
    /** לאחר resolve: מחזיר את ה-dateSetId */
    onSelect: (dateSetId: string) => void;
    /** כותרת מודל (למשל "הגדר סט תאריכים למקטע") */
    title?: string;
    /** כשמוגדר – טוען את רשומת הלוח עם ה-ID ומציג את המאפיינים לעריכה */
    initialDateSetId?: string;
};

const WEEKDAYS_HINT = "ימי שבוע 1–7 (מופרדים בפסיק), למשל 1,7 = ראשון ושבת";

export function DateSetIdConfigModal({
    open,
    onClose,
    dataSource,
    onSelect,
    title = "הגדר סט תאריכים (dateSetId)",
    initialDateSetId,
}: DateSetIdConfigModalProps) {
    const [form, setForm] = useState<DateSetIdFormValues>(defaultDateSetIdFormValues);
    const [saving, setSaving] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialDateSetId) {
            setLoadingInitial(true);
            setError(null);
            fetchCalendarEntryById(dataSource, initialDateSetId)
                .then((entry) => {
                    if (entry?.values)
                        setForm(entityValuesToFormValues(entry.values));
                    else
                        setForm(defaultDateSetIdFormValues);
                })
                .catch(() => setForm(defaultDateSetIdFormValues))
                .finally(() => setLoadingInitial(false));
        } else {
            setForm(defaultDateSetIdFormValues);
        }
    }, [open, initialDateSetId, dataSource]);

    const setField = (field: keyof DateSetIdFormValues, value: boolean | string | DateRange[]) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError(null);
    };

    /** תמיד – מקצה dateSetId 100 (מוצג תמיד) */
    const handleAlways = () => {
        onSelect("100");
        onClose();
    };

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        try {
            const { dateSetId } = await resolveDateSetId(dataSource, form);
            onSelect(dateSetId);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "שגיאה בשמירת סט תאריכים");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b font-bold text-gray-800">{title}</div>
                <div className="p-4 overflow-auto space-y-3 flex-1 text-sm">
                    {loadingInitial ? (
                        <p className="text-gray-500">טוען נתוני סט תאריכים…</p>
                    ) : (
                        <p className="text-gray-600 text-xs">
                            {initialDateSetId
                                ? "ערוך את המאפיינים. בלחיצה על \"החל\" – אם קיים dateSetId זהה ישמש אותו, אחרת ייווצר מזהה חדש."
                                : "הגדר את המאפיינים לפי calendar.json. אם קיים כבר סט תאריכים זהה – ישמש את המזהה הקיים; אחרת ייווצר מזהה חדש."}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.simha}
                                onChange={(e) => setField("simha", e.target.checked)}
                            />
                            <span>שמחה (simha)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.beitEvel}
                                onChange={(e) => setField("beitEvel", e.target.checked)}
                            />
                            <span>בית אבל (beitEvel)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.abroad}
                                onChange={(e) => setField("abroad", e.target.checked)}
                            />
                            <span>חו&quot;ל (abroad)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.yad}
                                onChange={(e) => setField("yad", e.target.checked)}
                            />
                            <span>יד (yad)</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={form.tv}
                                onChange={(e) => setField("tv", e.target.checked)}
                            />
                            <span>ט&quot;ו (tv)</span>
                        </label>
                    </div>
                    <div className="space-y-4">
                        <HebrewCalendarPicker
                            title="תאריכים שאומרים (dates_when_we_say_prayer)"
                            value={form.dates_when_we_say_prayer}
                            onChange={(r) => setField("dates_when_we_say_prayer", r)}
                        />
                        <HebrewCalendarPicker
                            title={'תאריכים שאומרים חו"ל (dates_when_we_say_prayer_abroad)'}
                            value={form.dates_when_we_say_prayer_abroad}
                            onChange={(r) => setField("dates_when_we_say_prayer_abroad", r)}
                        />
                        <HebrewCalendarPicker
                            title="תאריכים שלא אומרים (dates_when_we_dont_say_prayer)"
                            value={form.dates_when_we_dont_say_prayer}
                            onChange={(r) => setField("dates_when_we_dont_say_prayer", r)}
                        />
                        <HebrewCalendarPicker
                            title={'תאריכים שלא אומרים חו"ל (dates_when_we_dont_say_prayer_abroad)'}
                            value={form.dates_when_we_dont_say_prayer_abroad}
                            onChange={(r) => setField("dates_when_we_dont_say_prayer_abroad", r)}
                        />
                        <label className="block">
                            <span className="text-gray-600 block mb-0.5">ימי שבוע (weekdays)</span>
                            <input
                                type="text"
                                value={form.weekdays}
                                onChange={(e) => setField("weekdays", e.target.value)}
                                className="w-full border border-gray-300 rounded px-2 py-1"
                                placeholder="1,7"
                            />
                            <span className="text-[10px] text-gray-400 block mt-0.5">{WEEKDAYS_HINT}</span>
                        </label>
                    </div>
                    {error && <div className="text-red-600 text-xs">{error}</div>}
                </div>
                <div className="p-4 border-t flex justify-end gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={handleAlways}
                        disabled={loadingInitial}
                        className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        תמיד (ID 100)
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || loadingInitial}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-700"
                    >
                        {saving ? "שומר…" : loadingInitial ? "טוען…" : "החל (מצוא או צור)"}
                    </button>
                </div>
            </div>
        </div>
    );
}
