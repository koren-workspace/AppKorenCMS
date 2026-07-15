/**
 * =============================================================================
 * AppCopyView – מסך עריכת טקסטי האפליקציה (קופי)
 * =============================================================================
 *
 * עורך את קולקציית `app-copy` ב-Firestore: מסמך לכל מפתח טקסט באפליקציה
 * (i18n keys – כל טקסטי הממשק כולל התראות, דיאלוגים, הגדרות ואונבורדינג).
 *
 * זרימת עבודה (כמו במסך התפילות):
 *   1. עורכים עברית/אנגלית ב-Stage ולוחצים "שמירה ל-Stage".
 *   2. "פרסום לפרוד" משווה Stage מול פרוד וכותב רק את המפתחות ששונו,
 *      עם timestamp חדש – האפליקציה מושכת את השינוי בסנכרון הבא.
 *
 * ולידציה: placeholders (%s / %1$s) חייבים להישמר בדיוק – ראו validation.ts.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useAuthController } from "@firecms/core";
import type { AppCopyDoc } from "./app-copy/types";
import {
    diffForPublish,
    loadAppCopy,
    loadProdAppCopy,
    publishAppCopyToProd,
    saveAppCopyChanges,
} from "./app-copy/services/appCopyService";
import { validateCopyEdit, type CopyValidationError } from "./app-copy/validation";
import { ProdAuthModal } from "./toc-translations/components/ProdAuthModal";
import { isProdAuthenticated } from "./toc-translations/services/prodAuthService";
import { appendChangeLog, type FieldChange } from "./toc-translations/services/changeLogService";

type Edits = Record<string, { he: string; en: string }>;
type RowErrors = Record<string, CopyValidationError[]>;
type Banner = { kind: "info" | "success" | "error"; text: string } | null;

export function AppCopyView() {
    const auth = useAuthController();
    const currentUserEmail = (auth.user as any)?.email ?? "";

    const [docs, setDocs] = useState<AppCopyDoc[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [edits, setEdits] = useState<Edits>({});
    const [errors, setErrors] = useState<RowErrors>({});
    const [search, setSearch] = useState("");
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [banner, setBanner] = useState<Banner>(null);
    const [prodAuthOpen, setProdAuthOpen] = useState(false);
    const [publishDiff, setPublishDiff] = useState<AppCopyDoc[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadAppCopy()
            .then(loaded => {
                if (!cancelled) setDocs(loaded);
            })
            .catch(err => {
                if (!cancelled) setLoadError(String(err?.message ?? err));
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const docByKey = useMemo(
        () => new Map((docs ?? []).map(d => [d.key, d])),
        [docs]
    );

    /** הערך המוצג של שדה: העריכה אם קיימת, אחרת הערך השמור */
    function valueOf(doc: AppCopyDoc, field: "he" | "en"): string {
        return edits[doc.key]?.[field] ?? doc[field];
    }

    function isDirty(doc: AppCopyDoc): boolean {
        const edit = edits[doc.key];
        return edit !== undefined && (edit.he !== doc.he || edit.en !== doc.en);
    }

    const dirtyDocs = useMemo(
        () => (docs ?? []).filter(isDirty),
        // edits משתנה בכל הקלדה – זה בדיוק הטריגר הרצוי
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [docs, edits]
    );

    function onFieldChange(doc: AppCopyDoc, field: "he" | "en", value: string) {
        setEdits(prev => {
            const current = prev[doc.key] ?? { he: doc.he, en: doc.en };
            return { ...prev, [doc.key]: { ...current, [field]: value } };
        });
        // שגיאה ישנה של השורה נמחקת עם ההקלדה – תיבדק שוב בשמירה
        if (errors[doc.key]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[doc.key];
                return next;
            });
        }
    }

    function revertRow(key: string) {
        setEdits(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setErrors(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    // ---- שמירה ל-Stage ------------------------------------------------------

    async function onSave() {
        if (!docs || dirtyDocs.length === 0 || saving) return;

        // ולידציה על כל השורות שהשתנו
        const newErrors: RowErrors = {};
        for (const doc of dirtyDocs) {
            const rowErrors = validateCopyEdit(
                { he: doc.he, en: doc.en },
                { he: valueOf(doc, "he"), en: valueOf(doc, "en") }
            );
            if (rowErrors.length > 0) newErrors[doc.key] = rowErrors;
        }
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setBanner({
                kind: "error",
                text: `לא נשמר: ${Object.keys(newErrors).length} מפתח(ות) עם שגיאות placeholders/ריקון – ראו סימון אדום`,
            });
            return;
        }

        setSaving(true);
        setBanner(null);
        try {
            const toSave = dirtyDocs.map(doc => ({
                key: doc.key,
                he: valueOf(doc, "he"),
                en: valueOf(doc, "en"),
                category: doc.category,
                description: doc.description,
                order: doc.order,
            }));
            const timestamp = await saveAppCopyChanges(toSave);

            // תיעוד בלוג השינויים
            const copyChanges = dirtyDocs.map(doc => {
                const changes: FieldChange[] = [];
                if (valueOf(doc, "he") !== doc.he)
                    changes.push({ field: "he", oldValue: doc.he, newValue: valueOf(doc, "he") });
                if (valueOf(doc, "en") !== doc.en)
                    changes.push({ field: "en", oldValue: doc.en, newValue: valueOf(doc, "en") });
                return { key: doc.key, changes };
            });
            appendChangeLog({
                timestamp,
                action: "save_app_copy",
                context: {},
                details: { copyChanges },
                savedToFirestore: true,
            });

            // עדכון ה-state המקומי לערכים השמורים
            setDocs(prev =>
                (prev ?? []).map(doc => {
                    const edit = edits[doc.key];
                    return edit ? { ...doc, he: edit.he, en: edit.en, timestamp } : doc;
                })
            );
            setEdits({});
            setErrors({});
            setBanner({ kind: "success", text: `נשמרו ${toSave.length} מפתח(ות) ל-Stage` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה בשמירה: ${err?.message ?? err}` });
        } finally {
            setSaving(false);
        }
    }

    // ---- פרסום לפרוד ---------------------------------------------------------

    async function startPublish() {
        if (!docs || publishing) return;
        if (dirtyDocs.length > 0) {
            setBanner({ kind: "error", text: "יש שינויים שלא נשמרו – יש לשמור ל-Stage לפני פרסום לפרוד" });
            return;
        }
        if (!isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        await computePublishDiff();
    }

    async function computePublishDiff() {
        if (!docs) return;
        setPublishing(true);
        setBanner({ kind: "info", text: "משווה מול פרוד..." });
        try {
            const prodDocs = await loadProdAppCopy();
            const diff = diffForPublish(docs, prodDocs);
            setBanner(null);
            if (diff.length === 0) {
                setBanner({ kind: "success", text: "פרוד כבר מעודכן – אין מה לפרסם" });
            } else {
                setPublishDiff(diff);
            }
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה בקריאת פרוד: ${err?.message ?? err}` });
        } finally {
            setPublishing(false);
        }
    }

    async function confirmPublish() {
        if (!publishDiff) return;
        setPublishing(true);
        try {
            const timestamp = await publishAppCopyToProd(
                publishDiff.map(({ timestamp: _ts, ...rest }) => rest)
            );
            appendChangeLog({
                timestamp,
                action: "publish_app_copy",
                context: {},
                details: { publishedCopyKeys: publishDiff.map(d => d.key) },
                savedToFirestore: true,
            });
            setBanner({
                kind: "success",
                text: `פורסמו ${publishDiff.length} מפתח(ות) לפרוד – האפליקציה תמשוך את השינוי בסנכרון הבא`,
            });
            setPublishDiff(null);
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה בפרסום לפרוד: ${err?.message ?? err}` });
        } finally {
            setPublishing(false);
        }
    }

    // ---- סינון וקיבוץ ---------------------------------------------------------

    const visibleByCategory = useMemo(() => {
        const q = search.trim().toLowerCase();
        const visible = (docs ?? []).filter(doc => {
            if (!q) return true;
            return (
                doc.key.toLowerCase().includes(q) ||
                doc.he.toLowerCase().includes(q) ||
                doc.en.toLowerCase().includes(q) ||
                doc.description.toLowerCase().includes(q) ||
                doc.category.toLowerCase().includes(q) ||
                (edits[doc.key]?.he ?? "").toLowerCase().includes(q) ||
                (edits[doc.key]?.en ?? "").toLowerCase().includes(q)
            );
        });
        const groups = new Map<string, AppCopyDoc[]>();
        for (const doc of visible) {
            const category = doc.category || "כללי";
            const list = groups.get(category);
            if (list) list.push(doc);
            else groups.set(category, [doc]);
        }
        return groups;
    }, [docs, search, edits]);

    // ---- רינדור ---------------------------------------------------------------

    if (loadError) {
        return (
            <div style={styles.page}>
                <p style={{ color: "#d32f2f" }}>שגיאה בטעינת הטקסטים: {loadError}</p>
            </div>
        );
    }
    if (!docs) {
        return (
            <div style={styles.page}>
                <p>טוען טקסטים...</p>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>עריכת טקסטים באפליקציה</h2>
                    <p style={styles.subtitle}>
                        {docs.length} מפתחות · כל שינוי נשמר ל-Stage; "פרסום לפרוד" שולח לאפליקציה
                    </p>
                </div>
                <div style={styles.actions}>
                    <input
                        style={styles.search}
                        placeholder="חיפוש טקסט / מפתח..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <button
                        style={{
                            ...styles.saveBtn,
                            opacity: dirtyDocs.length === 0 || saving ? 0.5 : 1,
                        }}
                        disabled={dirtyDocs.length === 0 || saving}
                        onClick={onSave}
                    >
                        {saving ? "שומר..." : `שמירה ל-Stage (${dirtyDocs.length})`}
                    </button>
                    <button
                        style={{ ...styles.publishBtn, opacity: publishing ? 0.5 : 1 }}
                        disabled={publishing}
                        onClick={startPublish}
                    >
                        {publishing ? "מפרסם..." : "פרסום לפרוד"}
                    </button>
                </div>
            </div>

            {banner && (
                <div
                    style={{
                        ...styles.banner,
                        background:
                            banner.kind === "error"
                                ? "#fdecea"
                                : banner.kind === "success"
                                    ? "#e8f5e9"
                                    : "#e3f2fd",
                        color:
                            banner.kind === "error"
                                ? "#c62828"
                                : banner.kind === "success"
                                    ? "#2e7d32"
                                    : "#1565c0",
                    }}
                >
                    {banner.text}
                </div>
            )}

            {[...visibleByCategory.entries()].map(([category, categoryDocs]) => (
                <div key={category} style={styles.categoryBlock}>
                    <button
                        style={styles.categoryHeader}
                        onClick={() =>
                            setCollapsed(prev => ({ ...prev, [category]: !prev[category] }))
                        }
                    >
                        <span style={styles.categoryArrow}>{collapsed[category] ? "◀" : "▼"}</span>
                        <span style={styles.categoryName}>{category}</span>
                        <span style={styles.categoryCount}>{categoryDocs.length}</span>
                    </button>
                    {!collapsed[category] &&
                        categoryDocs.map(doc => {
                            const dirty = isDirty(doc);
                            const rowErrors = errors[doc.key] ?? [];
                            return (
                                <div
                                    key={doc.key}
                                    style={{
                                        ...styles.row,
                                        borderColor:
                                            rowErrors.length > 0
                                                ? "#d32f2f"
                                                : dirty
                                                    ? "#f9a825"
                                                    : "#e0e0e0",
                                    }}
                                >
                                    <div style={styles.rowMeta}>
                                        <code style={styles.rowKey}>{doc.key}</code>
                                        {doc.description && (
                                            <span style={styles.rowDescription}>{doc.description}</span>
                                        )}
                                        {dirty && (
                                            <button style={styles.revertBtn} onClick={() => revertRow(doc.key)}>
                                                בטל שינוי
                                            </button>
                                        )}
                                    </div>
                                    <div style={styles.rowFields}>
                                        <label style={styles.fieldLabel}>
                                            עברית
                                            <textarea
                                                style={{ ...styles.textarea, direction: "rtl" }}
                                                rows={heightFor(valueOf(doc, "he"))}
                                                value={valueOf(doc, "he")}
                                                onChange={e => onFieldChange(doc, "he", e.target.value)}
                                            />
                                        </label>
                                        <label style={styles.fieldLabel}>
                                            English
                                            <textarea
                                                style={{ ...styles.textarea, direction: "ltr" }}
                                                rows={heightFor(valueOf(doc, "en"))}
                                                value={valueOf(doc, "en")}
                                                onChange={e => onFieldChange(doc, "en", e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    {rowErrors.map((error, i) => (
                                        <p key={i} style={styles.rowError}>
                                            {error.field === "he" ? "עברית: " : "אנגלית: "}
                                            {error.message}
                                        </p>
                                    ))}
                                </div>
                            );
                        })}
                </div>
            ))}

            {visibleByCategory.size === 0 && (
                <p style={{ color: "#777" }}>לא נמצאו טקסטים לחיפוש "{search}"</p>
            )}

            <ProdAuthModal
                open={prodAuthOpen}
                email={currentUserEmail}
                onSuccess={() => {
                    setProdAuthOpen(false);
                    void computePublishDiff();
                }}
                onClose={() => setProdAuthOpen(false)}
            />

            {publishDiff && (
                <div style={styles.overlay} onClick={() => setPublishDiff(null)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>פרסום לפרוד</h3>
                        <p style={styles.modalText}>
                            {publishDiff.length} מפתח(ות) שונים מפרוד ויפורסמו עכשיו:
                        </p>
                        <div style={styles.modalKeys}>
                            {publishDiff.slice(0, 30).map(d => (
                                <code key={d.key} style={styles.modalKey}>
                                    {d.key}
                                </code>
                            ))}
                            {publishDiff.length > 30 && (
                                <span style={{ color: "#777" }}>
                                    ...ועוד {publishDiff.length - 30}
                                </span>
                            )}
                        </div>
                        <div style={styles.modalButtons}>
                            <button style={styles.cancelBtn} onClick={() => setPublishDiff(null)}>
                                ביטול
                            </button>
                            <button
                                style={{ ...styles.publishBtn, opacity: publishing ? 0.5 : 1 }}
                                disabled={publishing}
                                onClick={confirmPublish}
                            >
                                {publishing ? "מפרסם..." : "אישור ופרסום"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** מספר שורות ל-textarea לפי אורך הטקסט (1–5) */
function heightFor(text: string): number {
    const lines = text.split("\n").length;
    return Math.max(1, Math.min(5, Math.max(lines, Math.ceil(text.length / 60))));
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        direction: "rtl",
        padding: "20px 24px 60px",
        maxWidth: 1200,
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
        minWidth: 260,
    },
    saveBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "none",
        background: "#2e7d32",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
    publishBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "none",
        background: "#1565c0",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
    banner: {
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 14,
        marginBottom: 12,
    },
    categoryBlock: { marginBottom: 10 },
    categoryHeader: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        border: "none",
        background: "#f5f5f5",
        borderRadius: 6,
        padding: "8px 12px",
        cursor: "pointer",
        fontSize: 14,
        textAlign: "right",
    },
    categoryArrow: { fontSize: 10, color: "#888" },
    categoryName: { fontWeight: 700 },
    categoryCount: {
        background: "#e0e0e0",
        borderRadius: 10,
        padding: "1px 8px",
        fontSize: 12,
        color: "#555",
    },
    row: {
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        padding: "10px 14px",
        margin: "8px 0",
        background: "#fff",
    },
    rowMeta: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 6,
        flexWrap: "wrap",
    },
    rowKey: {
        fontSize: 12,
        background: "#f0f0f0",
        borderRadius: 4,
        padding: "1px 6px",
        direction: "ltr",
    },
    rowDescription: { fontSize: 12, color: "#777" },
    revertBtn: {
        marginInlineStart: "auto",
        border: "1px solid #ccc",
        background: "#fff",
        borderRadius: 5,
        padding: "2px 10px",
        fontSize: 12,
        cursor: "pointer",
        color: "#555",
    },
    rowFields: { display: "flex", gap: 12, flexWrap: "wrap" },
    fieldLabel: {
        flex: "1 1 320px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        fontSize: 12,
        fontWeight: 600,
        color: "#444",
    },
    textarea: {
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 14,
        fontFamily: "inherit",
        resize: "vertical",
    },
    rowError: { margin: "6px 0 0", color: "#c62828", fontSize: 13 },
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
        padding: "24px 28px",
        minWidth: 380,
        maxWidth: 560,
        maxHeight: "80vh",
        overflow: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        direction: "rtl",
    },
    modalTitle: { margin: "0 0 8px", fontSize: 18, fontWeight: 700 },
    modalText: { margin: "0 0 12px", fontSize: 14, color: "#444" },
    modalKeys: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 18,
    },
    modalKey: {
        fontSize: 12,
        background: "#f0f0f0",
        borderRadius: 4,
        padding: "1px 6px",
        direction: "ltr",
    },
    modalButtons: { display: "flex", justifyContent: "flex-end", gap: 10 },
    cancelBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
    },
};
