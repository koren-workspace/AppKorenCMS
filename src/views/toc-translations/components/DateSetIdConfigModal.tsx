/**
 * DateSetIdConfigModal – הגדרת סט תאריכים (dateSetId) לפי מבנה calendar.json.
 *
 * שתי פעולות שונות מאוד:
 *   - "החל על פריט זה בלבד": בודק אם קיים dateSetId זהה, ואם לא – יוצר רשומה
 *     חדשה עם ה-ID הבא. רק הפריט הנוכחי מקבל את ה-ID; שום סט קיים לא משתנה.
 *   - "עדכן את סט X בכל המקומות" (רק כשנפתח עם סט קיים): משנה את הסט עצמו –
 *     כל פריט ומקטע שמשתמש בו, בכל הנוסחים – ומפרסם מיד. עובר דרך מסך בדיקה
 *     ואישור (DateSetUpdateReview).
 */

import React, { useState, useEffect } from "react";
import {
    CALENDAR_FLAGS,
    defaultDateSetIdFormValues,
    entityValuesToFormValues,
    formValuesToPayload,
    type CalendarEntryPayload,
    type DateSetIdFormValues,
    type DateRange,
    type TriStateFlag,
} from "../constants/calendarTypes";
import {
    buildCalendarEntryValues,
    resolveDateSetId,
    fetchCalendarEntryById,
} from "../services/calendarService";
import { whyCannotUpdate } from "../services/dateSetUpdateService";
import { HebrewCalendarPicker } from "./HebrewCalendarPicker";
import { DateSetUpdateReview } from "./DateSetUpdateReview";

export type DateSetIdConfigModalProps = {
    open: boolean;
    onClose: () => void;
    /** מקור נתונים (dataSource) ל-Firestore */
    dataSource: { fetchCollection: (opts: any) => Promise<any[]>; saveEntity: (opts: any) => Promise<any> };
    /** לאחר resolve: מחזיר את ה-dateSetId + רשומת calendar חדשה אם נוצרה */
    onSelect: (
        dateSetId: string,
        createdEntry?: { collectionPath: string; docId: string; data: Record<string, any> }
    ) => void;
    /** כותרת מודל (למשל "הגדר סט תאריכים למקטע") */
    title?: string;
    /** כשמוגדר – טוען את רשומת הלוח עם ה-ID ומציג את המאפיינים לעריכה */
    initialDateSetId?: string;
    /** נקרא אחרי שסט קיים עודכן במקום (לרענון ה-badges וסינון התאריך) */
    onUpdatedInPlace?: () => void;
    /** פותח את חלון ההתחברות לפרוד ומחכה לתוצאה */
    requestProdAuth?: () => Promise<boolean>;
};

const WEEKDAYS_HINT = "ימי שבוע 1–7 (מופרדים בפסיק), למשל 1,7 = ראשון ושבת";

function FlagChooser({
    name,
    yes,
    no,
    value,
    onChange,
}: {
    name: string;
    yes: string;
    no: string;
    value: TriStateFlag;
    onChange: (v: TriStateFlag) => void;
}) {
    const options: Array<{ v: TriStateFlag; label: string }> = [
        { v: null, label: "אין תנאי" },
        { v: true, label: yes },
        { v: false, label: no },
    ];
    return (
        <div>
            <div className="text-sm font-semibold mb-0.5">{name}</div>
            <div className="inline-flex border border-gray-300 rounded overflow-hidden text-sm">
                {options.map((o) => (
                    <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => onChange(o.v)}
                        className={`px-2 py-1 border-l last:border-l-0 ${
                            value === o.v ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"
                        }`}
                    >
                        {o.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function DateSetIdConfigModal({
    open,
    onClose,
    dataSource,
    onSelect,
    title = "הגדר סט תאריכים (dateSetId)",
    initialDateSetId,
    onUpdatedInPlace,
    requestProdAuth,
}: DateSetIdConfigModalProps) {
    const [form, setForm] = useState<DateSetIdFormValues>(defaultDateSetIdFormValues);
    const [saving, setSaving] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resolvedId, setResolvedId] = useState<string | null>(null);
    /** ערכי הרשומה הקיימת כפי שנטענו (null = אין סט קיים / לא נמצא) */
    const [loadedValues, setLoadedValues] = useState<Record<string, any> | null>(null);
    /** כשמוגדר – מוצג מסך הבדיקה של עדכון במקום, עם הערכים שהיו בטופס */
    const [reviewPayload, setReviewPayload] = useState<CalendarEntryPayload | null>(null);

    useEffect(() => {
        if (!open) return;
        setResolvedId(null);
        setReviewPayload(null);
        setLoadedValues(null);
        if (initialDateSetId) {
            setLoadingInitial(true);
            setError(null);
            fetchCalendarEntryById(dataSource, initialDateSetId)
                .then((entry) => {
                    if (entry?.values) {
                        setForm(entityValuesToFormValues(entry.values));
                        setLoadedValues(entry.values);
                    } else setForm(defaultDateSetIdFormValues);
                })
                .catch(() => setForm(defaultDateSetIdFormValues))
                .finally(() => setLoadingInitial(false));
        } else {
            setForm(defaultDateSetIdFormValues);
        }
    }, [open, initialDateSetId, dataSource]);

    const setField = (field: keyof DateSetIdFormValues, value: TriStateFlag | string | DateRange[]) => {
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
            const { dateSetId, created } = await resolveDateSetId(dataSource, form);
            setResolvedId(dateSetId);
            const createdEntry = created
                ? {
                      collectionPath: "calendar",
                      docId: dateSetId,
                      data: buildCalendarEntryValues(dateSetId, formValuesToPayload(form)),
                  }
                : undefined;
            onSelect(dateSetId, createdEntry);
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : "שגיאה בשמירת סט תאריכים");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const isExisting = !!initialDateSetId && !loadingInitial;
    const cannotUpdateReason = isExisting
        ? loadedValues
            ? whyCannotUpdate(initialDateSetId, loadedValues)
            : initialDateSetId === "100"
              ? whyCannotUpdate(initialDateSetId)
              : `סט ${initialDateSetId} לא נמצא בלוח`
        : null;
    const canUpdateInPlace = isExisting && !cannotUpdateReason && !!onUpdatedInPlace;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b font-bold text-lg text-gray-800">
                    {reviewPayload ? `בדיקה לפני עדכון סט ${initialDateSetId}` : title}
                </div>

                {reviewPayload && initialDateSetId && loadedValues ? (
                    <div className="p-4 overflow-auto flex-1 text-base">
                        <DateSetUpdateReview
                            dataSource={dataSource}
                            dateSetId={initialDateSetId}
                            beforeValues={loadedValues}
                            afterPayload={reviewPayload}
                            requestProdAuth={requestProdAuth}
                            onBack={() => setReviewPayload(null)}
                            onSaved={() => onUpdatedInPlace?.()}
                            onClose={onClose}
                        />
                    </div>
                ) : (
                    <>
                        <div className="p-4 overflow-auto space-y-3 flex-1 text-base">
                            {loadingInitial ? (
                                <p className="text-gray-500">טוען נתוני סט תאריכים…</p>
                            ) : isExisting ? (
                                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1">
                                    <div className="font-semibold">ערכו את המאפיינים ובחרו מה לעשות איתם:</div>
                                    <div>
                                        <b>החל על פריט זה בלבד</b> – רק הפריט הנוכחי יקבל סט עם הערכים האלה (סט זהה
                                        שכבר קיים, או סט חדש). סט {initialDateSetId} ושאר הפריטים לא משתנים.
                                    </div>
                                    {canUpdateInPlace ? (
                                        <div>
                                            <b>עדכן את סט {initialDateSetId} בכל המקומות</b> – משנה את הסט עצמו: כל
                                            הפריטים והמקטעים שמשתמשים בו, בכל הנוסחים, יקבלו את התאריכים החדשים,
                                            והשינוי יפורסם למתפללים. לפני השמירה תוצג בדיקה מלאה לאישור.
                                        </div>
                                    ) : (
                                        cannotUpdateReason && (
                                            <div className="text-gray-600">
                                                עדכון הסט בכל המקומות לא זמין: {cannotUpdateReason}.
                                            </div>
                                        )
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-600 text-sm">
                                    הגדר את המאפיינים לפי calendar.json. אם קיים כבר סט תאריכים זהה – ישמש את המזהה
                                    הקיים; אחרת ייווצר מזהה חדש.
                                </p>
                            )}
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    שם קצר לתצוגה (label)
                                    <span className="font-normal text-gray-400 mr-1">
                                        – מוצג ב-badge במקום המספר; השאר ריק לתיאור אוטומטי
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={form.label}
                                    onChange={(e) => setField("label", e.target.value)}
                                    placeholder={'לדוגמה: ט"ו בשבט, ר"ח, ט באב...'}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-violet-400"
                                    dir="rtl"
                                    maxLength={40}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                {CALENDAR_FLAGS.map((flag) => (
                                    <FlagChooser
                                        key={flag.key}
                                        name={flag.name}
                                        yes={flag.yes}
                                        no={flag.no}
                                        value={form[flag.key]}
                                        onChange={(v) => setField(flag.key, v)}
                                    />
                                ))}
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
                                    <span className="text-sm text-gray-400 block mt-0.5">{WEEKDAYS_HINT}</span>
                                </label>
                            </div>
                            {error && <div className="text-red-600 text-sm">{error}</div>}
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded text-base hover:bg-gray-50"
                            >
                                ביטול
                            </button>
                            <button
                                type="button"
                                onClick={handleAlways}
                                disabled={loadingInitial}
                                className="px-4 py-2 border border-gray-300 rounded text-base hover:bg-gray-50 disabled:opacity-50"
                            >
                                תמיד (ID 100)
                            </button>
                            {canUpdateInPlace && (
                                <button
                                    type="button"
                                    onClick={() => setReviewPayload(formValuesToPayload(form))}
                                    disabled={saving}
                                    className="px-4 py-2 border border-amber-500 text-amber-800 bg-amber-50 rounded text-base hover:bg-amber-100 disabled:opacity-50"
                                >
                                    עדכן את סט {initialDateSetId} בכל המקומות…
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={saving || loadingInitial}
                                className="px-4 py-2 bg-blue-600 text-white rounded text-base disabled:opacity-50 hover:bg-blue-700"
                            >
                                {saving
                                    ? "שומר…"
                                    : loadingInitial
                                      ? "טוען…"
                                      : isExisting
                                        ? "החל על פריט זה בלבד"
                                        : "החל (מצוא או צור)"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
