/**
 * PublishConfirmModal – אישור לפני פרסום נוסח לבייגל (סטייג' / פרוד)
 *
 * בפרסום לפרוד המודל מציג גם תצוגה מקדימה: בדיוק אילו מסמכים יועתקו מסטייג'
 * לפרוד. זה חשוב כי הפרסום מיישר את *כל* הסטייג' של הנוסח — כולל עריכות של
 * אחרים שלא נשמרו לפרוד — ובלי הרשימה אי אפשר לדעת מה עומד לצאת.
 */

import React, { useEffect, useState } from "react";
import {
    countCopiesByKind,
    summarizeCopy,
    type ReconcilePlan,
} from "../services/prodReconcileService";

export type PublishEnvironment = "stage" | "prod";

/** כמה שורות מוצגות ברשימה לפני "ועוד N" */
const MAX_LISTED = 40;

export type PublishConfirmModalProps = {
    open: boolean;
    environment: PublishEnvironment;
    nusachLabel?: string | null;
    saving?: boolean;
    onConfirm: () => void;
    onClose: () => void;
    /** מריץ את שלב התכנון (קריאה בלבד) ומחזיר מה יועתק. רק לפרוד. */
    onPreview?: () => Promise<ReconcilePlan | null>;
};

const KIND_LABEL: Record<string, string> = {
    item: "פריט",
    calendar: "לוח שנה",
    toc: "מבנה",
};

export function PublishConfirmModal({
    open,
    environment,
    nusachLabel,
    saving = false,
    onConfirm,
    onClose,
    onPreview,
}: PublishConfirmModalProps) {
    const isProd = environment === "prod";
    const wantsPreview = open && isProd && !!onPreview;

    const [plan, setPlan] = useState<ReconcilePlan | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);

    useEffect(() => {
        if (!wantsPreview) {
            setPlan(null);
            setPreviewError(null);
            setPreviewLoading(false);
            return;
        }
        let cancelled = false;
        setPlan(null);
        setPreviewError(null);
        setPreviewLoading(true);
        onPreview!()
            .then((result) => {
                if (!cancelled) setPlan(result);
            })
            .catch((err) => {
                if (cancelled) return;
                setPreviewError(
                    err instanceof Error ? err.message : "שגיאה בחישוב התצוגה המקדימה"
                );
            })
            .finally(() => {
                if (!cancelled) setPreviewLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // onPreview נוצר מחדש בכל רינדור – מכוון להריץ פעם אחת לכל פתיחה
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wantsPreview]);

    if (!open) return null;

    const envLabel = isProd ? "פרוד" : "סטייג'";
    const trimmedNusach = nusachLabel?.trim() ?? "";
    const nusachText = trimmedNusach.length > 0 ? `«${trimmedNusach}»` : "הנוסח הנבחר";

    return (
        <div style={styles.overlay} onClick={saving ? undefined : onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>אישור פרסום · {envLabel}</h3>
                <p style={styles.subtitle}>
                    לפרסם את {nusachText} לבייגל של <strong>{envLabel}</strong>?
                </p>
                <p style={styles.detail}>
                    {isProd
                        ? "האפליקציה בפרוד תסנכרן את כל התרגומים של נוסח זה. פעולה זו משפיעה על משתמשים אמיתיים."
                        : "האפליקציה בסטייג' תסנכרן את כל התרגומים של נוסח זה."}
                </p>

                {wantsPreview && (
                    <PublishPreview
                        plan={plan}
                        loading={previewLoading}
                        error={previewError}
                    />
                )}

                <div style={styles.buttons}>
                    <button
                        type="button"
                        style={styles.cancelBtn}
                        onClick={onClose}
                        disabled={saving}
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        style={{
                            ...styles.confirmBtn,
                            background: isProd ? "#1565c0" : "#2e7d32",
                            opacity: previewLoading ? 0.5 : 1,
                        }}
                        onClick={onConfirm}
                        disabled={saving || previewLoading}
                    >
                        {saving
                            ? "מפרסם…"
                            : previewLoading
                              ? "בודק…"
                              : `פרסם · ${envLabel}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** גוף התצוגה המקדימה: טעינה / שגיאה / סיכום + רשימת המסמכים */
function PublishPreview({
    plan,
    loading,
    error,
}: {
    plan: ReconcilePlan | null;
    loading: boolean;
    error: string | null;
}) {
    if (loading) {
        return (
            <div style={styles.previewBox}>
                <span style={styles.previewMuted}>משווה סטייג' מול פרוד…</span>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ ...styles.previewBox, borderColor: "#e57373", background: "#ffebee" }}>
                <strong style={{ color: "#c62828" }}>לא הצלחתי לחשב מה יעודכן.</strong>
                <div style={styles.previewMuted}>{error}</div>
                <div style={styles.previewMuted}>
                    אפשר לפרסם בכל זאת — הפרסום עצמו יריץ את ההשוואה מחדש.
                </div>
            </div>
        );
    }

    // המשתמש ביטל את מודל הסיסמה, או שאין נוסח נבחר
    if (!plan) return null;

    const counts = countCopiesByKind(plan.copies);
    const total = plan.copies.length;

    if (total === 0) {
        return (
            <div style={styles.previewBox}>
                <strong>פרוד כבר מעודכן — לא יועתק אף מסמך.</strong>
                <div style={styles.previewMuted}>
                    נסרקו {plan.scannedDocs} מסמכים בסטייג'. הפרסום עדיין יעדכן את חותמת
                    הסנכרון, כדי שהמכשירים יבדקו מחדש.
                </div>
                {plan.skippedProdNewer.length > 0 && (
                    <ProdNewerNote count={plan.skippedProdNewer.length} />
                )}
            </div>
        );
    }

    const listed = plan.copies.slice(0, MAX_LISTED);
    const remaining = total - listed.length;

    return (
        <div style={styles.previewBox}>
            <strong>{total} מסמכים יועתקו מסטייג' לפרוד:</strong>
            <div style={styles.previewMuted}>
                {counts.items} פריטים · {counts.calendar} לוח שנה · {counts.toc} מבנה
                {plan.firstRun && " · השוואה מלאה ראשונה"}
            </div>
            <div style={styles.previewNote}>
                כולל כל שינוי שנשמר לסטייג' מאז הפרסום הקודם — גם עריכות של אחרים.
            </div>

            <ul style={styles.previewList}>
                {listed.map((copy) => {
                    const info = summarizeCopy(copy);
                    return (
                        <li key={`${copy.path}/${copy.docId}`} style={styles.previewRow}>
                            <span
                                style={{
                                    ...styles.reasonTag,
                                    background: info.reason === "missing" ? "#e8f5e9" : "#e3f2fd",
                                    color: info.reason === "missing" ? "#2e7d32" : "#1565c0",
                                }}
                            >
                                {info.reason === "missing" ? "חדש" : "עודכן"}
                            </span>
                            <span style={styles.previewMain}>
                                {KIND_LABEL[info.kind] ?? info.kind}
                                {info.translationId ? ` · ${info.translationId}` : ""}
                                {info.prayerId ? ` · ${info.prayerId}` : ""}
                                {" · "}
                                <span style={{ fontFamily: "monospace" }}>{info.docId}</span>
                                {info.snippet && (
                                    <div style={styles.snippet}>{info.snippet}</div>
                                )}
                            </span>
                        </li>
                    );
                })}
            </ul>
            {remaining > 0 && (
                <div style={styles.previewMuted}>ועוד {remaining} מסמכים…</div>
            )}
            {plan.skippedProdNewer.length > 0 && (
                <ProdNewerNote count={plan.skippedProdNewer.length} />
            )}
        </div>
    );
}

function ProdNewerNote({ count }: { count: number }) {
    return (
        <div style={styles.prodNewerNote}>
            ⚠ {count} מסמכים חדשים יותר בפרוד — לא ידרסו. בדרך כלל זו עריכה שנעשתה
            ישירות בפרוד. הרשימה המלאה בקונסול.
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modal: {
        background: "#fff",
        borderRadius: 10,
        padding: "28px 32px",
        minWidth: 340,
        maxWidth: 440,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        direction: "rtl",
    },
    title: {
        margin: "0 0 8px",
        fontSize: 18,
        fontWeight: 700,
        color: "#1a1a2e",
    },
    subtitle: {
        margin: "0 0 10px",
        fontSize: 15,
        color: "#333",
        lineHeight: 1.5,
    },
    detail: {
        margin: "0 0 14px",
        fontSize: 13,
        color: "#666",
        lineHeight: 1.5,
    },
    previewBox: {
        margin: "0 0 18px",
        padding: "10px 12px",
        border: "1px solid #cfd8dc",
        borderRadius: 6,
        background: "#fafafa",
        fontSize: 13,
        lineHeight: 1.5,
    },
    previewMuted: {
        fontSize: 12,
        color: "#666",
        marginTop: 2,
    },
    previewNote: {
        fontSize: 12,
        color: "#8d6e63",
        marginTop: 6,
    },
    previewList: {
        listStyle: "none",
        margin: "8px 0 0",
        padding: 0,
        maxHeight: 220,
        overflowY: "auto",
        borderTop: "1px solid #e0e0e0",
    },
    previewRow: {
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        padding: "5px 0",
        borderBottom: "1px solid #eee",
        fontSize: 12,
    },
    previewMain: {
        minWidth: 0,
        flex: 1,
        color: "#37474f",
    },
    reasonTag: {
        flexShrink: 0,
        borderRadius: 10,
        padding: "1px 7px",
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1.6,
    },
    snippet: {
        color: "#555",
        marginTop: 2,
        overflowWrap: "anywhere",
    },
    prodNewerNote: {
        marginTop: 8,
        padding: "6px 8px",
        borderRadius: 4,
        background: "#fff8e1",
        color: "#8d6e00",
        fontSize: 12,
        lineHeight: 1.5,
    },
    buttons: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
    },
    cancelBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
    },
    confirmBtn: {
        padding: "8px 20px",
        borderRadius: 6,
        border: "none",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
};
