/**
 * DateSetUpdateReview – מסך הבדיקה והאישור של "עדכון סט קיים בכל המקומות".
 *
 * העדכון משנה את הסט עצמו – כל פריט ומקטע שמפנה אליו, בכל הנוסחים – ומפורסם
 * מיד למתפללים. לכן לפני האישור המשתמש רואה בדיוק:
 *   1. מה משתנה בסט (לפני/אחרי, רק השדות ששונו).
 *   2. מתי הסט יחול בפועל, לפני ואחרי – לפי מנוע האפליקציה, ארץ וחו"ל.
 *   3. איפה הסט בשימוש – סריקה של כל הנוסחים.
 *   4. מה יקרה כשמאשרים – שלב אחר שלב.
 * ואחרי האישור – התקדמות כל שלב, ובכשל: מה נכשל ו"נסה לפרסם שוב".
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    CALENDAR_FLAGS,
    calendarPayloadsEqual,
    describeFlagValue,
    diffCalendarPayloads,
    entityValuesToPayload,
    validateCalendarPayload,
    type CalendarEntryPayload,
} from "../constants/calendarTypes";
import { fetchAllCalendar } from "../services/calendarService";
import { findDateSetUsages, type DateSetUsage } from "../services/dateSetUsageService";
import {
    publishDateSetEverywhere,
    saveDateSetToStage,
    type PublishStep,
} from "../services/dateSetUpdateService";
import { appendChangeLog } from "../services/changeLogService";
import { formatSpan, listOccurrences, type Location, type YearOccurrences } from "../utils/dateSetOccurrences";
import { isProdConfigured } from "../../../firebase_config";
import { isProdAuthenticated } from "../services/prodAuthService";

type DataSource = { fetchCollection: (opts: any) => Promise<any[]>; saveEntity: (opts: any) => Promise<any> };

export type DateSetUpdateReviewProps = {
    dataSource: DataSource;
    dateSetId: string;
    /** ערכי הרשומה כפי שנטענו בפתיחת החלון */
    beforeValues: Record<string, any>;
    afterPayload: CalendarEntryPayload;
    requestProdAuth?: () => Promise<boolean>;
    /** חזרה לטופס (רק לפני שהתחיל העדכון) */
    onBack: () => void;
    /** הסט נשמר בסטייג' (גם אם הפרסום עוד לא הושלם) – לרענון ה-badges */
    onSaved: () => void;
    onClose: () => void;
};

const MAX_SPANS = 10;
const MAX_LISTED_USAGES = 30;

const LOCATION_LABEL: Record<Location, string> = { israel: "בארץ", abroad: 'בחו"ל' };

function StepIcon({ status }: { status: PublishStep["status"] }) {
    const map: Record<PublishStep["status"], string> = {
        pending: "○",
        running: "⏳",
        done: "✓",
        error: "✗",
        skipped: "–",
    };
    const color: Record<PublishStep["status"], string> = {
        pending: "text-gray-400",
        running: "text-blue-600",
        done: "text-green-600",
        error: "text-red-600",
        skipped: "text-gray-400",
    };
    return <span className={`inline-block w-5 text-center font-bold ${color[status]}`}>{map[status]}</span>;
}

function YearColumn({ years }: { years: YearOccurrences[] }) {
    return (
        <div className="space-y-2">
            {years.map((y) => (
                <div key={y.year}>
                    <div className="font-semibold text-sm">
                        {y.yearLabel}
                        {y.leap ? " (מעוברת)" : ""}: {y.totalDays === 0 ? "לא חל אף יום" : `${y.totalDays} ימים`}
                    </div>
                    {y.spans.length > 0 && (
                        <ul className="text-sm text-gray-700 list-disc pr-5">
                            {y.spans.slice(0, MAX_SPANS).map((s, i) => (
                                <li key={i}>{formatSpan(s)}</li>
                            ))}
                            {y.spans.length > MAX_SPANS && (
                                <li className="text-gray-500">ועוד {y.spans.length - MAX_SPANS} רצפים…</li>
                            )}
                        </ul>
                    )}
                </div>
            ))}
        </div>
    );
}

function sameOccurrences(a: YearOccurrences[], b: YearOccurrences[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((y, i) => {
        const z = b[i];
        if (y.totalDays !== z.totalDays || y.spans.length !== z.spans.length) return false;
        return y.spans.every((s, j) => s.from.abs() === z.spans[j].from.abs() && s.to.abs() === z.spans[j].to.abs());
    });
}

export function DateSetUpdateReview({
    dataSource,
    dateSetId,
    beforeValues,
    afterPayload,
    requestProdAuth,
    onBack,
    onSaved,
    onClose,
}: DateSetUpdateReviewProps) {
    const beforePayload = useMemo(() => entityValuesToPayload(beforeValues), [beforeValues]);
    const diff = useMemo(() => diffCalendarPayloads(beforePayload, afterPayload), [beforePayload, afterPayload]);
    const validation = useMemo(() => validateCalendarPayload(afterPayload), [afterPayload]);

    const preview = useMemo(() => {
        const locations: Location[] = ["israel", "abroad"];
        return locations.map((loc) => {
            const before = listOccurrences(beforePayload, loc);
            const after = listOccurrences(afterPayload, loc);
            return { loc, before, after, unchanged: sameOccurrences(before, after) };
        });
    }, [beforePayload, afterPayload]);

    const extraConditions = CALENDAR_FLAGS.filter((f) => f.key !== "abroad" && afterPayload[f.key] != null).map(
        (f) => describeFlagValue(f.key, afterPayload[f.key])
    );

    const [usage, setUsage] = useState<DateSetUsage | null>(null);
    const [usageError, setUsageError] = useState<string | null>(null);
    const [usageProgress, setUsageProgress] = useState<{ done: number; total: number } | null>(null);
    const [duplicateOf, setDuplicateOf] = useState<string | null>(null);
    const [showUsageDetails, setShowUsageDetails] = useState(false);

    const [confirmed, setConfirmed] = useState(false);
    const [phase, setPhase] = useState<"review" | "running" | "finished">("review");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [steps, setSteps] = useState<PublishStep[]>([]);
    const [publishOk, setPublishOk] = useState<boolean | null>(null);
    /** מה נשמר בפועל בסטייג' – לתיעוד גם בניסיון פרסום חוזר */
    const savedRef = useRef<{ before: Record<string, any>; after: Record<string, any> } | null>(null);

    useEffect(() => {
        let cancelled = false;
        findDateSetUsages(dateSetId, (done, total) => {
            if (!cancelled) setUsageProgress({ done, total });
        })
            .then((u) => !cancelled && setUsage(u))
            .catch((e) => !cancelled && setUsageError(e instanceof Error ? e.message : String(e)));
        fetchAllCalendar(dataSource)
            .then((all) => {
                if (cancelled) return;
                const match = all.find(
                    (e) =>
                        e.id !== dateSetId &&
                        e.values?.deleted !== true &&
                        calendarPayloadsEqual(afterPayload, entityValuesToPayload(e.values ?? {}))
                );
                setDuplicateOf(match ? String(match.id) : null);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [dateSetId, dataSource, afterPayload]);

    const nusachCount = usage?.tocs.length ?? 0;
    const prodEnabled = isProdConfigured();
    const canConfirm =
        phase === "review" && !!usage && diff.length > 0 && validation.errors.length === 0 && confirmed;

    const logResult = (
        before: Record<string, any>,
        after: Record<string, any>,
        result: { steps: PublishStep[]; stageNusachIds: string[]; prodNusachIds: string[] } | null,
        errorMessage?: string
    ) => {
        appendChangeLog({
            timestamp: Date.now(),
            action: "update_date_set",
            context: {},
            details: {
                errorMessage,
                fieldChanges: [
                    {
                        entityId: `calendar/${dateSetId}`,
                        itemId: dateSetId,
                        changes: diff.map((d) => ({ field: d.field, oldValue: d.before, newValue: d.after })),
                    },
                ],
                dateSet: {
                    dateSetId,
                    before,
                    after,
                    usageItems: usage?.totalItems ?? 0,
                    usageParts: usage?.totalParts ?? 0,
                    usageTocIds: usage?.tocs.map((t) => t.tocId) ?? [],
                    publishedStageNusachIds: result?.stageNusachIds,
                    publishedProdNusachIds: result?.prodNusachIds,
                    failedSteps: result?.steps.filter((s) => s.status === "error").map((s) => s.label),
                },
            },
            savedToFirestore: !errorMessage,
            publishedToBagel: result ? result.steps.every((s) => s.status === "done" || s.status === "skipped") : false,
        });
    };

    const runPublish = async () => {
        if (prodEnabled && !isProdAuthenticated()) {
            const ok = requestProdAuth ? await requestProdAuth() : false;
            if (!ok) return null;
        }
        const result = await publishDateSetEverywhere(dateSetId, setSteps);
        setPublishOk(result.ok);
        return result;
    };

    const handleConfirm = async () => {
        if (!canConfirm) return;
        // מתחברים לפרוד *לפני* השמירה – כדי לא להשאיר סט שנשמר בסטייג' בלי פרסום.
        if (prodEnabled && !isProdAuthenticated()) {
            const ok = requestProdAuth ? await requestProdAuth() : false;
            if (!ok) {
                setSaveError("נדרשת התחברות לפרוד כדי לפרסם. לא נשמר כלום.");
                return;
            }
        }
        setSaveError(null);
        setPhase("running");
        let saved: { before: Record<string, any>; after: Record<string, any> };
        try {
            saved = await saveDateSetToStage({
                dateSetId,
                payload: afterPayload,
                expectedTimestamp: Number.isFinite(Number(beforeValues.timestamp)) ? Number(beforeValues.timestamp) : null,
            });
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : String(e));
            setPhase("review");
            return;
        }
        savedRef.current = saved;
        onSaved();
        const result = await runPublish();
        logResult(saved.before, saved.after, result);
        setPhase("finished");
    };

    const handleRetryPublish = async () => {
        setPhase("running");
        setPublishOk(null);
        const result = await runPublish();
        const saved = savedRef.current;
        if (result && saved) logResult(saved.before, saved.after, result);
        setPhase("finished");
    };

    // ── מסך התקדמות / סיום ────────────────────────────────────────────────
    if (phase !== "review") {
        return (
            <div className="space-y-4">
                <div className="font-semibold">
                    {phase === "running"
                        ? `מעדכן ומפרסם את סט ${dateSetId}…`
                        : publishOk
                          ? `סט ${dateSetId} עודכן ופורסם ✓`
                          : `סט ${dateSetId} נשמר, אבל הפרסום לא הושלם`}
                </div>
                <ul className="space-y-1">
                    {steps.map((s) => (
                        <li key={s.key} className="text-sm">
                            <StepIcon status={s.status} /> {s.label}
                            {s.detail && (
                                <div className={`pr-6 text-xs ${s.status === "error" ? "text-red-600" : "text-gray-500"}`}>
                                    {s.detail}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
                {phase === "finished" && publishOk && (
                    <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                        השינוי חל על {usage?.totalItems ?? 0} פריטים ו-{usage?.totalParts ?? 0} מקטעים. המתפללים בכל
                        הנוסחים יקבלו אותו בסנכרון הבא של האפליקציה. השינוי נרשם ביומן השינויים, כולל הערכים
                        הקודמים.
                    </div>
                )}
                {phase === "finished" && !publishOk && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm space-y-2">
                        <div>
                            הסט כבר נשמר בסטייג' עם הערכים החדשים, אבל לא כל שלבי הפרסום הצליחו – ייתכן שחלק
                            מהמתפללים עדיין רואים את הערכים הישנים. אפשר לנסות שוב; זה בטוח (רק הסט הזה מתפרסם).
                        </div>
                        <button
                            type="button"
                            onClick={handleRetryPublish}
                            className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            נסה לפרסם שוב
                        </button>
                    </div>
                )}
                {phase === "finished" && (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                        >
                            סגור
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ── מסך בדיקה ─────────────────────────────────────────────────────────
    return (
        <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm">
                אתם עומדים לשנות את <b>סט {dateSetId} עצמו</b>. זה לא משנה רק את הפריט שממנו נכנסתם – אלא כל
                פריט ומקטע שמשתמש בסט הזה, בכל הנוסחים, והשינוי יוצא למתפללים מיד.
            </div>

            {/* 1. מה משתנה */}
            <section>
                <h3 className="font-bold mb-1">1. מה משתנה בסט</h3>
                {diff.length === 0 ? (
                    <p className="text-sm text-gray-600">לא שיניתם שום דבר בסט. חזרו לטופס ושנו את מה שצריך.</p>
                ) : (
                    <table className="w-full text-sm border">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-1.5 text-right border">שדה</th>
                                <th className="p-1.5 text-right border">לפני</th>
                                <th className="p-1.5 text-right border">אחרי</th>
                            </tr>
                        </thead>
                        <tbody>
                            {diff.map((d) => (
                                <tr key={d.field}>
                                    <td className="p-1.5 border font-semibold whitespace-nowrap">{d.field}</td>
                                    <td className="p-1.5 border text-red-700">{d.before}</td>
                                    <td className="p-1.5 border text-green-700">{d.after}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {validation.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-700 list-disc pr-5">
                        {validation.errors.map((e) => (
                            <li key={e}>{e}</li>
                        ))}
                    </ul>
                )}
                {validation.warnings.length > 0 && (
                    <ul className="mt-2 text-sm text-amber-700 list-disc pr-5">
                        {validation.warnings.map((w) => (
                            <li key={w}>{w}</li>
                        ))}
                    </ul>
                )}
                {duplicateOf && (
                    <p className="mt-2 text-sm text-amber-700">
                        שימו לב: הערכים החדשים זהים לסט {duplicateOf} שכבר קיים. העדכון עדיין אפשרי, אבל ייתכן שעדיף
                        לשייך את הפריט לסט {duplicateOf} ("החל על פריט זה בלבד").
                    </p>
                )}
            </section>

            {/* 2. מתי יחול */}
            <section>
                <h3 className="font-bold mb-1">2. מתי הסט יחול – מהיום ועד סוף השנה הבאה</h3>
                <p className="text-xs text-gray-500 mb-2">
                    מחושב באותו אופן שהאפליקציה מחשבת.
                    {extraConditions.length > 0 && <> בנוסף, אחרי העדכון הסט חל רק כש: {extraConditions.join(" · ")}.</>}
                </p>
                <div className="space-y-3">
                    {preview.map((p) => (
                        <div key={p.loc} className="border rounded">
                            <div className="bg-gray-50 px-2 py-1 font-semibold text-sm">
                                {LOCATION_LABEL[p.loc]}
                                {p.unchanged && <span className="font-normal text-gray-500"> – ללא שינוי בתאריכים</span>}
                            </div>
                            {!p.unchanged && (
                                <div className="grid grid-cols-2 gap-3 p-2">
                                    <div>
                                        <div className="text-xs font-bold text-red-700 mb-1">לפני</div>
                                        <YearColumn years={p.before} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-green-700 mb-1">אחרי</div>
                                        <YearColumn years={p.after} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* 3. איפה בשימוש */}
            <section>
                <h3 className="font-bold mb-1">3. איפה הסט בשימוש</h3>
                {usageError ? (
                    <p className="text-sm text-red-700">הסריקה נכשלה: {usageError}. אי אפשר לעדכן בלי לדעת את היקף השינוי.</p>
                ) : !usage ? (
                    <p className="text-sm text-gray-600">
                        סורק את כל הנוסחים…
                        {usageProgress && usageProgress.total > 0 && ` (${usageProgress.done}/${usageProgress.total})`}
                    </p>
                ) : usage.tocs.length === 0 ? (
                    <p className="text-sm text-gray-600">אף פריט או מקטע לא משתמש כרגע בסט הזה.</p>
                ) : (
                    <>
                        <table className="w-full text-sm border">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-1.5 text-right border">נוסח</th>
                                    <th className="p-1.5 text-right border">פריטים</th>
                                    <th className="p-1.5 text-right border">מקטעים</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usage.tocs.map((t) => (
                                    <tr key={t.tocId}>
                                        <td className="p-1.5 border">{t.nusachLabel}</td>
                                        <td className="p-1.5 border">{t.items.length}</td>
                                        <td className="p-1.5 border">{t.parts.length}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold">
                                    <td className="p-1.5 border">סה"כ</td>
                                    <td className="p-1.5 border">{usage.totalItems}</td>
                                    <td className="p-1.5 border">{usage.totalParts}</td>
                                </tr>
                            </tbody>
                        </table>
                        <button
                            type="button"
                            className="mt-1 text-sm text-blue-700 underline"
                            onClick={() => setShowUsageDetails((v) => !v)}
                        >
                            {showUsageDetails ? "הסתר פירוט" : "הצג פירוט"}
                        </button>
                        {showUsageDetails && (
                            <div className="mt-1 max-h-48 overflow-auto text-xs text-gray-700 space-y-2">
                                {usage.tocs.map((t) => (
                                    <div key={t.tocId}>
                                        <div className="font-semibold">{t.nusachLabel}</div>
                                        <ul className="list-disc pr-5">
                                            {t.parts.slice(0, MAX_LISTED_USAGES).map((p, i) => (
                                                <li key={`p${i}`}>
                                                    מקטע: {p.prayerName} › {p.partName} ({p.translationId})
                                                </li>
                                            ))}
                                            {t.items.slice(0, MAX_LISTED_USAGES).map((it) => (
                                                <li key={`${it.translationId}/${it.prayerId}/${it.itemId}`}>
                                                    פריט {it.itemId}: {it.prayerName} ({it.translationId}){it.snippet ? ` – ${it.snippet}` : ""}
                                                </li>
                                            ))}
                                            {t.items.length + t.parts.length > 2 * MAX_LISTED_USAGES && (
                                                <li className="text-gray-500">…</li>
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* 4. מה יקרה */}
            <section>
                <h3 className="font-bold mb-1">4. מה יקרה כשתאשרו</h3>
                <ol className="text-sm list-decimal pr-5 space-y-0.5">
                    <li>סט {dateSetId} יישמר בסטייג' עם הערכים החדשים (ה-ID לא משתנה).</li>
                    {prodEnabled && <li>הסט יועתק לפרוד.</li>}
                    <li>
                        כל הנוסחים יסומנו כמעודכנים{prodEnabled ? " בסטייג' ובפרוד" : ""}, כולל ב-Bagel – כך שגם
                        האפליקציות הישנות יקבלו את השינוי.
                    </li>
                    <li>המתפללים יראו את התאריכים החדשים בסנכרון הבא של האפליקציה.</li>
                    <li>השינוי יירשם ביומן השינויים עם הערכים הקודמים, כדי שאפשר יהיה לשחזר.</li>
                </ol>
                <p className="text-sm text-gray-600 mt-1">
                    רק הסט הזה מתפרסם. שינויים אחרים שממתינים בסטייג' (פריטים, מבנה) <b>לא</b> יוצאים לפרוד בעקבות
                    הפעולה הזו.
                </p>
            </section>

            {saveError && <div className="text-sm text-red-700 whitespace-pre-line">{saveError}</div>}

            <label className="flex items-start gap-2 bg-gray-50 border rounded p-2 text-sm">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmed}
                    disabled={!usage || diff.length === 0 || validation.errors.length > 0}
                    onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                    הבנתי: השינוי חל על {usage?.totalItems ?? "…"} פריטים ו-{usage?.totalParts ?? "…"} מקטעים
                    {nusachCount > 0 ? ` ב-${nusachCount} נוסחים` : ""}, ויתפרסם מיד למתפללים בכל הנוסחים.
                </span>
            </label>

            <div className="flex justify-between gap-2">
                <button type="button" onClick={onBack} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                    חזרה לעריכה
                </button>
                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    className="px-4 py-2 bg-amber-600 text-white rounded disabled:opacity-50 hover:bg-amber-700"
                >
                    עדכן את סט {dateSetId} ופרסם לכל הנוסחים
                </button>
            </div>
        </div>
    );
}
