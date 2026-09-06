/**
 * =============================================================================
 * CatalogView – מסך "קטלוג תוספות": המוצרים הנמכרים באפליקציה
 * =============================================================================
 *
 * עורך את קולקציית `catalog/{storeId}` ב-Firestore, בסטייג' או בפרוד (מתג
 * למעלה, כמו במסך "הגדרות אפליקציה"; פרוד דורש סיסמה). ראו docs/catalog.md.
 *
 * מזהה המסמך = storeId = מזהה המוצר בחנויות = מפתח הבעלות באפליקציה. לכן
 * storeId נעול בעריכה של תוספת קיימת; מוצר חדש דורש גם מוצר בחנויות.
 *
 * זרימת העבודה המומלצת: עורכים ובודקים בסטייג', ואז "העתקה לפרוד" על
 * התוספת הבודדת (מעתיק את המסמך כפי שהוא, דורס לפי storeId). אין העתקה של
 * כל הקטלוג בבת אחת, בכוונה.
 *
 * האפליקציות הישנות קוראות את הקטלוג מ-Bagel; שינוי כאן לא מגיע אליהן.
 */

import React, { useEffect, useState } from "react";
import { useAuthController } from "@firecms/core";
import { isProdConfigured } from "../firebase_config";
import { ProdAuthModal } from "./toc-translations/components/ProdAuthModal";
import { isProdAuthenticated } from "./toc-translations/services/prodAuthService";
import {
    copyToProd,
    deleteItem,
    listCatalog,
    saveItem,
    type CatalogRow,
} from "./catalog/services/catalogService";
import {
    emptyItem,
    emptyTrack,
    KIND_LABELS,
    KINDS,
    NUSACH_IDS,
    NUSACH_LABELS,
    type CatalogEnv,
    type CatalogItem,
    type Localized,
    type Track,
} from "./catalog/types";

type Banner = { kind: "info" | "success" | "error"; text: string } | null;

/** מה שנערך כרגע: תוספת קיימת (עם השדות ההיסטוריים שלה) או חדשה */
type Editing = { item: CatalogItem; keep: Record<string, unknown>; isNew: boolean };

function envLabel(env: CatalogEnv) {
    return env === "prod" ? "פרוד" : "Stage";
}

// ---------------------------------------------------------------------------
// שדות
// ---------------------------------------------------------------------------

function LocalizedField({
    label,
    value,
    onChange,
    required,
}: {
    label: string;
    value: Localized;
    onChange: (next: Localized) => void;
    required?: boolean;
}) {
    return (
        <div style={styles.localized}>
            <span style={styles.fieldLabel}>{label}{required ? " *" : ""}</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={styles.field}>
                    עברית
                    <input style={styles.input} value={value.he} onChange={e => onChange({ ...value, he: e.target.value })} />
                </label>
                <label style={styles.field}>
                    אנגלית
                    <input
                        style={{ ...styles.input, direction: "ltr" }}
                        value={value.default}
                        onChange={e => onChange({ ...value, default: e.target.value })}
                    />
                </label>
            </div>
        </div>
    );
}

function TrackEditor({ track, index, onChange, onRemove }: { track: Track; index: number; onChange: (t: Track) => void; onRemove: () => void }) {
    return (
        <div style={styles.track}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 13 }}>רצועה {index + 1}</b>
                <button type="button" style={styles.linkBtn} onClick={onRemove}>
                    הסרה
                </button>
            </div>
            <LocalizedField label="כותרת" required value={track.title} onChange={title => onChange({ ...track, title })} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={styles.field}>
                    מזהה *
                    <input style={{ ...styles.input, direction: "ltr" }} value={track.id} onChange={e => onChange({ ...track, id: e.target.value })} />
                </label>
                <label style={styles.field}>
                    rank (מיון יורד)
                    <input style={{ ...styles.input, direction: "ltr" }} value={track.rank} onChange={e => onChange({ ...track, rank: e.target.value })} />
                </label>
                <label style={styles.field}>
                    סוג מדיה
                    <select style={styles.input} value={track.type} onChange={e => onChange({ ...track, type: e.target.value as Track["type"] })}>
                        <option value="audio">אודיו</option>
                        <option value="video">וידאו</option>
                    </select>
                </label>
            </div>
            <label style={{ ...styles.field, minWidth: 0 }}>
                כתובת המדיה (Cloudinary) *
                <input style={{ ...styles.input, direction: "ltr" }} value={track.url} onChange={e => onChange({ ...track, url: e.target.value })} />
            </label>
            <label style={{ ...styles.field, minWidth: 0 }}>
                תמונה (URL)
                <input style={{ ...styles.input, direction: "ltr" }} value={track.thumbnail} onChange={e => onChange({ ...track, thumbnail: e.target.value })} />
            </label>
        </div>
    );
}

// ---------------------------------------------------------------------------
// המסך
// ---------------------------------------------------------------------------

export function CatalogView() {
    const auth = useAuthController();
    const currentUserEmail = (auth.user as any)?.email ?? "";
    const prodConfigured = isProdConfigured();

    const [env, setEnv] = useState<CatalogEnv>("stage");
    const [rows, setRows] = useState<CatalogRow[] | undefined>(undefined); // undefined = טוען
    const [loadError, setLoadError] = useState<string | null>(null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [banner, setBanner] = useState<Banner>(null);
    const [busy, setBusy] = useState(false);
    const [prodAuthOpen, setProdAuthOpen] = useState(false);
    /** העתקה לפרוד שממתינה לסיסמת פרוד */
    const [pendingCopy, setPendingCopy] = useState<CatalogRow | null>(null);

    async function reload(target: CatalogEnv) {
        setRows(undefined);
        setLoadError(null);
        try {
            setRows(await listCatalog(target));
        } catch (err: any) {
            setLoadError(String(err?.message ?? err));
        }
    }

    useEffect(() => {
        void reload("stage");
    }, []);

    function switchEnv(target: CatalogEnv) {
        if (target === env) return;
        if (target === "prod" && !prodConfigured) {
            setBanner({ kind: "error", text: "פרוד לא מוגדר בסביבה הזו (חסרים משתני VITE_PROD_FIREBASE_* – קיימים ב-Vercel, לא ב-.env.local המקומי)." });
            return;
        }
        if (target === "prod" && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        setEnv(target);
        setEditing(null);
        setBanner(null);
        void reload(target);
    }

    function onProdAuthSuccess() {
        setProdAuthOpen(false);
        if (pendingCopy) {
            const row = pendingCopy;
            setPendingCopy(null);
            void onCopyToProd(row);
            return;
        }
        setEnv("prod");
        setEditing(null);
        setBanner(null);
        void reload("prod");
    }

    /** העתקת תוספת אחת מסטייג' לפרוד, כפי שהיא. נשאר בסטייג' אחרי ההעתקה. */
    async function onCopyToProd(row: CatalogRow) {
        if (busy) return;
        if (!prodConfigured) {
            setBanner({ kind: "error", text: "פרוד לא מוגדר בסביבה הזו (חסרים משתני VITE_PROD_FIREBASE_* – קיימים ב-Vercel, לא ב-.env.local המקומי)." });
            return;
        }
        if (!isProdAuthenticated()) {
            setPendingCopy(row);
            setProdAuthOpen(true);
            return;
        }
        const name = row.item.title.he || row.item.title.default;
        if (!window.confirm(`להעתיק את "${name}" (${row.item.storeId}) מסטייג' לפרוד? אם יש בפרוד תוספת עם אותו storeId היא תידרס, וכל המשתמשים בגרסה החדשה יראו את השינוי בכניסה הבאה לחנות.`)) return;
        setBusy(true);
        setBanner(null);
        try {
            const { existed } = await copyToProd(row.item.storeId, currentUserEmail);
            setBanner({ kind: "success", text: `${row.item.storeId} הועתק לפרוד (${existed ? "דרס את הקיים" : "נוצר"}).` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `ההעתקה נכשלה: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    const isProd = env === "prod";

    function startEdit(row: CatalogRow) {
        setBanner(null);
        setEditing({ item: structuredClone(row.item), keep: row.keep, isNew: false });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function startNew() {
        setBanner(null);
        const nextOrder = rows && rows.length > 0 ? Math.max(...rows.map(r => r.item.order)) + 1 : 0;
        setEditing({ item: emptyItem(nextOrder), keep: {}, isNew: true });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function patch(partial: Partial<CatalogItem>) {
        setEditing(e => (e ? { ...e, item: { ...e.item, ...partial } } : e));
    }

    async function onSave() {
        if (!editing || busy) return;
        if (isProd && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        const storeId = editing.item.storeId.trim();
        if (editing.isNew && rows?.some(r => r.item.storeId === storeId)) {
            setBanner({ kind: "error", text: `כבר יש תוספת עם storeId ${storeId} בסביבה הזו.` });
            return;
        }
        if (isProd && !window.confirm(`לשמור את "${editing.item.title.he || editing.item.title.default}" לפרוד? כל המשתמשים בגרסה החדשה יראו את השינוי בכניסה הבאה לחנות.`)) return;
        setBusy(true);
        setBanner(null);
        try {
            await saveItem(env, editing.item, currentUserEmail, editing.keep);
            setEditing(null);
            setBanner({ kind: "success", text: `נשמר ל-${envLabel(env)}: ${storeId}` });
            await reload(env);
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה בשמירה: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    async function onDelete(row: CatalogRow) {
        if (busy) return;
        if (isProd && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        const label = envLabel(env);
        if (!window.confirm(`למחוק את "${row.item.title.he || row.item.title.default}" (${row.item.storeId}) מ-${label}? מי שכבר קנה יאבד את הגישה במסך החנות.`)) return;
        const typed = window.prompt(`לאישור, יש להקליד: ${row.item.storeId}`);
        if (typed?.trim() !== row.item.storeId) {
            setBanner({ kind: "info", text: "בוטל." });
            return;
        }
        setBusy(true);
        try {
            await deleteItem(env, row.item.storeId);
            setEditing(null);
            setBanner({ kind: "success", text: `נמחק מ-${label}: ${row.item.storeId}` });
            await reload(env);
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה במחיקה: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    const item = editing?.item;
    const isStream = item?.kind === "translation" || item?.kind === "commentary";

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>קטלוג תוספות</h2>
                    <p style={styles.subtitle}>
                        המוצרים שמוצגים בחנות "שערים לתפילה" · נשמרים ב-Firestore (האפליקציה החדשה) · האפליקציות הישנות קוראות מ-Bagel ולא
                        מושפעות
                    </p>
                </div>
                <div style={styles.envSwitch}>
                    <button style={{ ...styles.envBtn, ...(env === "stage" ? styles.envBtnActive : {}) }} onClick={() => switchEnv("stage")}>
                        Stage
                    </button>
                    <button
                        style={{ ...styles.envBtn, ...(env === "prod" ? { ...styles.envBtnActive, background: "#c62828" } : {}) }}
                        onClick={() => switchEnv("prod")}
                        title={prodConfigured ? undefined : "פרוד לא מוגדר בסביבה הזו"}
                    >
                        פרוד{prodConfigured ? "" : " (לא מוגדר)"}
                    </button>
                </div>
            </div>

            {isProd && (
                <div style={{ ...styles.banner, background: "#fdecea", color: "#c62828" }}>
                    סביבת פרוד – כל שינוי כאן מופיע אצל כל המשתמשים בגרסה החדשה בכניסה הבאה לחנות.
                </div>
            )}
            {banner && (
                <div
                    style={{
                        ...styles.banner,
                        background: banner.kind === "error" ? "#fdecea" : banner.kind === "success" ? "#e8f5e9" : "#e3f2fd",
                        color: banner.kind === "error" ? "#c62828" : banner.kind === "success" ? "#2e7d32" : "#1565c0",
                    }}
                >
                    {banner.text}
                </div>
            )}

            {/* ---- טופס ---- */}
            {item && (
                <div style={{ ...styles.card, borderColor: isProd ? "#c62828" : "#1565c0" }}>
                    <h3 style={styles.cardTitle}>{editing?.isNew ? "תוספת חדשה" : `עריכה: ${item.storeId}`}</h3>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <label style={styles.field}>
                            storeId *
                            <input
                                style={{ ...styles.input, direction: "ltr", background: editing?.isNew ? "#fff" : "#f5f5f5" }}
                                value={item.storeId}
                                readOnly={!editing?.isNew}
                                onChange={e => patch({ storeId: e.target.value })}
                                placeholder="למשל commentary50"
                            />
                            <span style={styles.hint}>מזהה המוצר ב-Google Play / App Store. לא ניתן לשינוי אחרי היצירה.</span>
                        </label>
                        <label style={styles.field}>
                            סוג
                            <select style={styles.input} value={item.kind} onChange={e => patch({ kind: e.target.value as CatalogItem["kind"] })}>
                                {KINDS.map(k => (
                                    <option key={k} value={k}>
                                        {KIND_LABELS[k]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label style={styles.field}>
                            סדר תצוגה
                            <input
                                style={{ ...styles.input, direction: "ltr", width: 90 }}
                                type="number"
                                min={0}
                                value={item.order}
                                onChange={e => patch({ order: Number(e.target.value) })}
                            />
                            <span style={styles.hint}>0 ראשון</span>
                        </label>
                        <label style={styles.field}>
                            נוסח
                            <select style={styles.input} value={item.nusachId} onChange={e => patch({ nusachId: e.target.value })}>
                                {NUSACH_IDS.map(n => (
                                    <option key={n} value={n}>
                                        {NUSACH_LABELS[n]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <LocalizedField label="כותרת" required value={item.title} onChange={title => patch({ title })} />
                    <LocalizedField label="מחבר / כותרת משנה" value={item.author} onChange={author => patch({ author })} />
                    <LocalizedField label="תיאור" value={item.description} onChange={description => patch({ description })} />
                    <LocalizedField label="תווית נוסח (לתצוגה)" value={item.nusach} onChange={nusach => patch({ nusach })} />

                    {isStream && (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <label style={styles.field}>
                                contentId
                                <input style={{ ...styles.input, direction: "ltr" }} value={item.contentId} onChange={e => patch({ contentId: e.target.value })} placeholder="למשל 10-ashkenaz" />
                                <span style={styles.hint}>שורש התוכן ב-Firestore: translations/{"{contentId}"}</span>
                            </label>
                            <label style={styles.field}>
                                צבע כרטיס
                                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <input
                                        style={{ ...styles.input, direction: "ltr", flex: 1 }}
                                        value={item.backgroundColor}
                                        onChange={e => patch({ backgroundColor: e.target.value })}
                                        placeholder="#771144"
                                    />
                                    <span style={{ width: 24, height: 24, borderRadius: 4, border: "1px solid #ccc", background: item.backgroundColor || "#fff" }} />
                                </span>
                            </label>
                        </div>
                    )}

                    <label style={{ ...styles.field, minWidth: 0 }}>
                        תמונה (URL)
                        <input style={{ ...styles.input, direction: "ltr" }} value={item.thumbnail} onChange={e => patch({ thumbnail: e.target.value })} />
                        <span style={styles.hint}>כתובת ציבורית ב-Firebase Storage (mods/thumbnails). מוצגת במסך הנגן של הכנה לתפילה.</span>
                    </label>

                    {item.kind === "preparation" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            <b style={{ fontSize: 14 }}>רצועות ({item.preparationContent.length})</b>
                            <span style={styles.hint}>האפליקציה מציגה לפי rank בסדר יורד: הרצועה עם ה-rank הגדול ביותר ראשונה.</span>
                            {item.preparationContent.map((t, index) => (
                                <TrackEditor
                                    key={index}
                                    track={t}
                                    index={index}
                                    onChange={next => patch({ preparationContent: item.preparationContent.map((x, i) => (i === index ? next : x)) })}
                                    onRemove={() => patch({ preparationContent: item.preparationContent.filter((_, i) => i !== index) })}
                                />
                            ))}
                            <button type="button" style={{ ...styles.secondaryBtn, alignSelf: "flex-start" }} onClick={() => patch({ preparationContent: [...item.preparationContent, emptyTrack()] })}>
                                + רצועה
                            </button>
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <button style={{ ...styles.primaryBtn, opacity: busy ? 0.5 : 1, ...(isProd ? { background: "#c62828" } : {}) }} disabled={busy} onClick={() => void onSave()}>
                            {busy ? "שומר..." : `שמירה ל-${envLabel(env)}`}
                        </button>
                        <button style={styles.secondaryBtn} disabled={busy} onClick={() => setEditing(null)}>
                            ביטול
                        </button>
                    </div>
                </div>
            )}

            {/* ---- רשימה ---- */}
            <h3 style={styles.cardTitle}>
                כל התוספות {rows ? `(${rows.length})` : ""}
                <button style={styles.linkBtn} onClick={() => void reload(env)}>
                    רענון
                </button>
                {!editing && (
                    <button style={styles.linkBtn} onClick={startNew}>
                        + תוספת חדשה
                    </button>
                )}
            </h3>
            {loadError && <p style={{ color: "#d32f2f" }}>שגיאה בטעינה: {loadError}</p>}
            {!rows && !loadError && <p>טוען...</p>}
            {rows && rows.length === 0 && (
                <p style={styles.hint}>
                    הקולקציה ריקה בסביבה הזו. יוצרים אותה פעם אחת מ-Bagel: <code style={styles.code}>node tools/migrate-catalog.mjs --env {env} --write</code> (בריפו koren-tefilla).
                </p>
            )}
            {rows && rows.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>#</th>
                                <th style={styles.th}>storeId</th>
                                <th style={styles.th}>סוג</th>
                                <th style={styles.th}>כותרת</th>
                                <th style={styles.th}>מחבר</th>
                                <th style={styles.th}>נוסח</th>
                                <th style={styles.th}>תוכן</th>
                                <th style={styles.th}>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => {
                                const it = row.item;
                                const active = editing?.item.storeId === it.storeId && !editing?.isNew;
                                return (
                                    <tr key={it.storeId} style={active ? { background: "#e3f2fd" } : undefined}>
                                        <td style={styles.td}>{it.order === Number.MAX_SAFE_INTEGER ? "—" : it.order}</td>
                                        <td style={{ ...styles.td, direction: "ltr", textAlign: "right" }}>
                                            <code style={styles.code}>{it.storeId}</code>
                                        </td>
                                        <td style={styles.td}>{KIND_LABELS[it.kind]}</td>
                                        <td style={styles.td}>
                                            <div>{it.title.he}</div>
                                            <div style={styles.en}>{it.title.default}</div>
                                        </td>
                                        <td style={styles.td}>
                                            <div>{it.author.he}</div>
                                            <div style={styles.en}>{it.author.default}</div>
                                        </td>
                                        <td style={styles.td}>{NUSACH_LABELS[it.nusachId] ?? it.nusachId}</td>
                                        <td style={{ ...styles.td, direction: "ltr", textAlign: "right" }}>
                                            {it.kind === "preparation" ? `${it.preparationContent.length} רצועות` : it.contentId}
                                        </td>
                                        <td style={styles.td}>
                                            <button style={styles.linkBtn} disabled={busy} onClick={() => startEdit(row)}>
                                                עריכה
                                            </button>
                                            {!isProd && (
                                                <button style={styles.linkBtn} disabled={busy} onClick={() => void onCopyToProd(row)} title="מעתיק את המסמך כפי שהוא לפרוד">
                                                    העתקה לפרוד
                                                </button>
                                            )}
                                            <button style={{ ...styles.linkBtn, color: "#c62828" }} disabled={busy} onClick={() => void onDelete(row)}>
                                                מחיקה
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ProdAuthModal
                open={prodAuthOpen}
                email={currentUserEmail}
                onSuccess={onProdAuthSuccess}
                onClose={() => {
                    setProdAuthOpen(false);
                    setPendingCopy(null);
                }}
            />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: { direction: "rtl", padding: "20px 24px 60px", maxWidth: 1200, margin: "0 auto", fontFamily: "inherit" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 12 },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    subtitle: { margin: "4px 0 0", fontSize: 13, color: "#666" },
    envSwitch: { display: "flex", gap: 6 },
    envBtn: { padding: "8px 18px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", color: "#444", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    envBtnActive: { background: "#1565c0", color: "#fff", borderColor: "transparent" },
    banner: { borderRadius: 6, padding: "10px 14px", fontSize: 14, marginBottom: 12 },
    card: { border: "2px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", background: "#fff", display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 },
    cardTitle: { margin: "0 0 10px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 },
    localized: { display: "flex", flexDirection: "column", gap: 4 },
    fieldLabel: { fontSize: 13, fontWeight: 700, color: "#333" },
    field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#444", minWidth: 200, flex: "1 1 200px" },
    input: { border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", fontSize: 14, fontWeight: 400, width: "100%", boxSizing: "border-box" },
    track: { border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", background: "#fafafa", display: "flex", flexDirection: "column", gap: 8 },
    code: { fontSize: 12, background: "#f0f0f0", borderRadius: 4, padding: "1px 6px", direction: "ltr" },
    hint: { fontSize: 12, color: "#777", margin: 0, fontWeight: 400 },
    en: { fontSize: 12, color: "#777", direction: "ltr", textAlign: "right" },
    primaryBtn: { padding: "8px 18px", borderRadius: 6, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    secondaryBtn: { border: "1px solid #ccc", background: "#fff", borderRadius: 5, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#555" },
    linkBtn: { border: "none", background: "none", color: "#1565c0", cursor: "pointer", fontSize: 13, padding: "2px 6px", fontWeight: 400 },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #e0e0e0", fontWeight: 700 },
    td: { padding: "8px 10px", borderBottom: "1px solid #eee", verticalAlign: "top" },
};
