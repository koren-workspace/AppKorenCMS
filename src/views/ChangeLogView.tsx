/**
 * =============================================================================
 * ChangeLogView – יומן שינויים
 * =============================================================================
 *
 * מציג את הרשומות האחרונות מקולקציית cms_change_log ב-Firestore: מה השתנה,
 * מתי, ועל ידי מי. הרשומות נכתבות אוטומטית מכל נקודות העריכה במערכת
 * (ראו changeLogService) – אין צורך לתחזק אותן ידנית.
 *
 * לחיצה על שורה פותחת את פירוט השינויים ברמת השדה (ערך לפני ואחרי).
 */

import React, { useEffect, useMemo, useState } from "react";
import {
    fetchChangeLogEntries,
    type ChangeLogAction,
    type ChangeLogEntry,
} from "./toc-translations/services/changeLogService";

const ENTRY_LIMIT = 200;

/** תיאור קריא בעברית לכל סוג פעולה */
const ACTION_LABELS: Record<ChangeLogAction, string> = {
    save_part_items: "שמירת פריטי מקטע",
    delete_part_item: "מחיקת פריט",
    create_translation_item: "הוספת פריט תרגום",
    publish_to_bagel: "פרסום לסטייג' (Bagel)",
    publish_to_prod: "פרסום לפרוד",
    add_toc: "הוספת נוסח",
    update_toc: "עריכת נוסח",
    add_translation: "הוספת תרגום",
    update_translation: "עריכת תרגום",
    add_category: "הוספת קטגוריה",
    update_category: "עריכת קטגוריה",
    add_prayer: "הוספת תפילה",
    update_prayer: "עריכת תפילה",
    add_part: "הוספת מקטע",
    update_part: "עריכת מקטע",
    reorder_parts: "שינוי סדר מקטעים",
    delete_toc: "מחיקת נוסח",
    delete_translation: "מחיקת תרגום",
    delete_category: "מחיקת קטגוריה",
    delete_prayer: "מחיקת תפילה",
    delete_part: "מחיקת מקטע",
    move_items_to_part: "העברת פריטים למקטע",
    copy_items_to_part: "העתקת פריטים למקטע",
    split_part: "פיצול מקטע",
    save_app_copy: "שמירת טקסטי אפליקציה",
    publish_app_copy: "פרסום טקסטי אפליקציה",
};

function actionLabel(action: ChangeLogAction): string {
    return ACTION_LABELS[action] ?? action;
}

/** תאריך ושעה בשעון ישראל */
function formatTime(entry: ChangeLogEntry): string {
    try {
        return new Date(entry.timestamp).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    } catch {
        return entry.timestampIso ?? "";
    }
}

/** נתיב ההקשר: נוסח / תרגום / תפילה / מקטע – לפי מה שקיים ברשומה */
function formatLocation(entry: ChangeLogEntry): string {
    const ctx = entry.context ?? {};
    const parts = [
        ctx.tocName ?? ctx.tocId,
        ctx.translationName ?? ctx.translationId,
        ctx.prayerName ?? ctx.prayerId,
        ctx.partName ?? ctx.partId,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : "—";
}

/** סיכום קצר של הרשומה לשורה בטבלה */
function formatSummary(entry: ChangeLogEntry): string {
    const d = entry.details ?? {};

    // פרסום שנכשל – מציגים את השגיאה במקום סיכום רגיל
    if (d.errorMessage) {
        return `שגיאה: ${String(d.errorMessage).slice(0, 120)}`;
    }
    if (entry.action === "publish_to_prod") {
        const copied =
            (d.prodCopiedItems ?? 0) +
            (d.prodCopiedCalendar ?? 0) +
            (d.prodCopiedToc ? 1 : 0);
        const skipped = d.prodSkippedProdNewerCount ?? 0;
        const parts = [
            copied > 0 ? `סונכרנו ${copied} מסמכים` : "לא נדרש סנכרון",
            skipped > 0 ? `${skipped} דולגו (פרוד חדש יותר)` : "",
            d.prodFirstReconcileRun ? "השוואה מלאה ראשונה" : "",
        ].filter(Boolean);
        return parts.join(" · ");
    }
    if (d.fieldChanges?.length) {
        const fields = d.fieldChanges.reduce((sum, fc) => sum + (fc.changes?.length ?? 0), 0);
        return `${fields} שינויי שדה ב-${d.fieldChanges.length} פריטים`;
    }
    if (d.copyChanges?.length) return `${d.copyChanges.length} מפתחות טקסט`;
    if (d.publishedCopyKeys?.length) return `${d.publishedCopyKeys.length} מפתחות פורסמו`;
    if (d.deletedItemId) return `פריט ${d.deletedItemId}`;
    if (d.newItemId) return `פריט חדש ${d.newItemId}`;
    if (d.movedItemIds?.length) return `${d.movedItemIds.length} פריטים`;
    if (d.copiedItemIds?.length) return `${d.copiedItemIds.length} פריטים`;
    if (d.deletedName || d.deletedId) return String(d.deletedName ?? d.deletedId);
    if (d.partName || d.prayerName || d.categoryName || d.nusachName) {
        return String(d.partName ?? d.prayerName ?? d.categoryName ?? d.nusachName);
    }
    if (d.selectedTocId) return `נוסח ${d.selectedTocId}`;
    return "—";
}

/** ערך לתצוגה בעמודות "לפני" / "אחרי" */
function formatValue(value: unknown): string {
    if (value == null || value === "") return "(ריק)";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
}

/** האם הפעולה הצליחה, לפי הדגלים שנרשמו */
function formatStatus(entry: ChangeLogEntry): string {
    if (
        (entry.action === "publish_to_bagel" || entry.action === "publish_to_prod") &&
        entry.publishedToBagel != null
    ) {
        return entry.publishedToBagel ? "פורסם" : "נכשל";
    }
    if (entry.savedToFirestore != null) return entry.savedToFirestore ? "נשמר" : "נכשל";
    return "";
}

export function ChangeLogView() {
    const [entries, setEntries] = useState<ChangeLogEntry[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setEntries(null);
        setLoadError(null);
        fetchChangeLogEntries(ENTRY_LIMIT)
            .then(loaded => {
                if (!cancelled) setEntries(loaded);
            })
            .catch(err => {
                if (!cancelled) setLoadError(String(err?.message ?? err));
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q || !entries) return entries ?? [];
        return entries.filter(entry =>
            [
                entry.user?.email ?? "",
                actionLabel(entry.action),
                entry.action,
                formatLocation(entry),
                formatSummary(entry),
            ]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [entries, search]);

    if (loadError) {
        return (
            <div style={styles.page}>
                <h2 style={styles.title}>יומן שינויים</h2>
                <p style={styles.error}>שגיאה בטעינת היומן: {loadError}</p>
                <p style={styles.hint}>
                    אם השגיאה היא הרשאות, יש לוודא שכללי האבטחה ב-Firestore מתירים קריאה
                    מקולקציית <code>cms_change_log</code>.
                </p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>יומן שינויים</h2>
                    <p style={styles.subtitle}>
                        {entries == null
                            ? "טוען..."
                            : `${visible.length} רשומות אחרונות · לחיצה על שורה מציגה את פירוט השינויים`}
                    </p>
                </div>
                <div style={styles.actions}>
                    <input
                        style={styles.search}
                        placeholder="חיפוש לפי משתמש / פעולה / מיקום..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button style={styles.refreshBtn} onClick={() => setReloadKey(k => k + 1)}>
                        רענון
                    </button>
                </div>
            </div>

            {entries == null && <p>טוען יומן...</p>}

            {entries != null && visible.length === 0 && (
                <p style={styles.hint}>אין רשומות להצגה.</p>
            )}

            {entries != null && visible.length > 0 && (
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>תאריך ושעה</th>
                            <th style={styles.th}>מי</th>
                            <th style={styles.th}>פעולה</th>
                            <th style={styles.th}>מיקום</th>
                            <th style={styles.th}>פירוט</th>
                            <th style={styles.th}>סטטוס</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(entry => {
                            const isOpen = !!expanded[entry.id];
                            return (
                                <React.Fragment key={entry.id}>
                                    <tr
                                        style={styles.row}
                                        onClick={() =>
                                            setExpanded(prev => ({ ...prev, [entry.id]: !prev[entry.id] }))
                                        }
                                    >
                                        <td style={styles.td}>{formatTime(entry)}</td>
                                        <td style={styles.td}>{entry.user?.email || "—"}</td>
                                        <td style={styles.td}>{actionLabel(entry.action)}</td>
                                        <td style={styles.td}>{formatLocation(entry)}</td>
                                        <td style={styles.td}>
                                            <span style={styles.arrow}>{isOpen ? "▼" : "◀"}</span>
                                            {formatSummary(entry)}
                                        </td>
                                        <td style={styles.td}>{formatStatus(entry)}</td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td style={styles.detailCell} colSpan={6}>
                                                <EntryDetails entry={entry} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

/** פירוט רשומה: טבלת שינויי שדות אם יש, ואחרת ה-details הגולמי */
function EntryDetails({ entry }: { entry: ChangeLogEntry }) {
    const fieldChanges = entry.details?.fieldChanges ?? [];
    const copyChanges = entry.details?.copyChanges ?? [];

    if (fieldChanges.length === 0 && copyChanges.length === 0) {
        return (
            <div>
                <p style={styles.detailTitle}>פרטי הפעולה</p>
                <pre style={styles.raw}>{JSON.stringify(entry.details ?? {}, null, 2)}</pre>
            </div>
        );
    }

    return (
        <div>
            <p style={styles.detailTitle}>שינויי שדות</p>
            <table style={styles.innerTable}>
                <thead>
                    <tr>
                        <th style={styles.innerTh}>פריט</th>
                        <th style={styles.innerTh}>שדה</th>
                        <th style={styles.innerTh}>לפני</th>
                        <th style={styles.innerTh}>אחרי</th>
                    </tr>
                </thead>
                <tbody>
                    {fieldChanges.flatMap(fc =>
                        (fc.changes ?? []).map((change, i) => (
                            <tr key={`${fc.entityId}-${change.field}-${i}`}>
                                <td style={styles.innerTd}>
                                    {fc.itemContent || fc.itemId || fc.entityId}
                                </td>
                                <td style={styles.innerTd}>{change.field}</td>
                                <td style={{ ...styles.innerTd, ...styles.before }}>
                                    {formatValue(change.oldValue)}
                                </td>
                                <td style={{ ...styles.innerTd, ...styles.after }}>
                                    {formatValue(change.newValue)}
                                </td>
                            </tr>
                        ))
                    )}
                    {copyChanges.flatMap(cc =>
                        (cc.changes ?? []).map((change, i) => (
                            <tr key={`${cc.key}-${change.field}-${i}`}>
                                <td style={styles.innerTd}>{cc.key}</td>
                                <td style={styles.innerTd}>{change.field}</td>
                                <td style={{ ...styles.innerTd, ...styles.before }}>
                                    {formatValue(change.oldValue)}
                                </td>
                                <td style={{ ...styles.innerTd, ...styles.after }}>
                                    {formatValue(change.newValue)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        direction: "rtl",
        padding: "20px 24px 60px",
        maxWidth: 1400,
        margin: "0 auto",
        fontFamily: "inherit",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 12,
    },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    subtitle: { margin: "4px 0 0", fontSize: 13, color: "#666" },
    actions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
    search: {
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 14,
        minWidth: 280,
    },
    refreshBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
    },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: {
        textAlign: "right",
        padding: "8px 10px",
        borderBottom: "2px solid #ddd",
        background: "#fafafa",
        whiteSpace: "nowrap",
    },
    row: { cursor: "pointer" },
    td: {
        padding: "7px 10px",
        borderBottom: "1px solid #eee",
        verticalAlign: "top",
    },
    arrow: { marginLeft: 6, color: "#999", fontSize: 10 },
    detailCell: { padding: "10px 24px 16px", background: "#fbfbfb", borderBottom: "1px solid #eee" },
    detailTitle: { margin: "0 0 8px", fontSize: 13, fontWeight: 700 },
    innerTable: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
    innerTh: {
        textAlign: "right",
        padding: "5px 8px",
        borderBottom: "1px solid #ddd",
        color: "#555",
    },
    innerTd: {
        padding: "5px 8px",
        borderBottom: "1px solid #f0f0f0",
        verticalAlign: "top",
        wordBreak: "break-word",
    },
    before: { background: "#fff5f5", color: "#a33" },
    after: { background: "#f3fbf4", color: "#276b2e" },
    raw: {
        margin: 0,
        padding: 10,
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 4,
        fontSize: 11,
        direction: "ltr",
        textAlign: "left",
        overflowX: "auto",
        maxHeight: 320,
    },
    error: { color: "#d32f2f" },
    hint: { color: "#666", fontSize: 13 },
};
