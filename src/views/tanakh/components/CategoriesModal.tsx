/**
 * CategoriesModal – ניהול הקטגוריות (החטיבות של המדריך).
 *
 * שמונה הקטגוריות המקוריות באות מהספר. אפשר לשנות שמות ולסדר מחדש, וגם
 * להוסיף חטיבה חדשה. מפתח הקטגוריה אינו ניתן לשינוי אחרי היצירה, כי הערכים
 * מצביעים אליו.
 */

import React, { useMemo, useState } from "react";
import type { Category, Entry } from "../model/types";
import { RED, ts } from "./tanakhStyles";

export interface CategoriesModalProps {
    open: boolean;
    categories: Category[];
    entries: readonly Entry[];
    busy?: boolean;
    onSave: (category: Category) => Promise<void> | void;
    onClose: () => void;
}

export const CATEGORY_KEY_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;

/** המפתח המספרי הבא לקטגוריה חדשה (האפליקציה עובדת לפי מספרים) */
export function nextLegacyId(categories: readonly Category[]): number {
    return categories.reduce((max, c) => Math.max(max, c.legacyId), 0) + 1;
}

export function CategoriesModal({ open, categories, entries, busy, onSave, onClose }: CategoriesModalProps) {
    const [editing, setEditing] = useState<Record<string, Category>>({});
    const [newKey, setNewKey] = useState("");
    const [newNameHe, setNewNameHe] = useState("");
    const [error, setError] = useState<string | null>(null);

    const counts = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of entries) m.set(e.cat, (m.get(e.cat) ?? 0) + 1);
        return m;
    }, [entries]);

    if (!open) return null;

    const rows = [...categories].sort((a, b) => a.order - b.order);
    const value = (c: Category): Category => editing[c.key] ?? c;
    const changed = (c: Category) => JSON.stringify(value(c)) !== JSON.stringify(c);

    function edit(c: Category, patch: Partial<Category>) {
        setEditing(m => ({ ...m, [c.key]: { ...value(c), ...patch } }));
    }

    async function save(c: Category) {
        setError(null);
        const next = value(c);
        if (!next.name.he.trim()) {
            setError("שם הקטגוריה בעברית הוא שדה חובה.");
            return;
        }
        await onSave(next);
        setEditing(m => {
            const { [c.key]: _drop, ...rest } = m;
            return rest;
        });
    }

    async function addCategory() {
        setError(null);
        const key = newKey.trim().toLowerCase();
        if (!CATEGORY_KEY_PATTERN.test(key)) {
            setError("מפתח הקטגוריה: אותיות לטיניות קטנות, ספרות ומקפים, מתחיל באות.");
            return;
        }
        if (categories.some(c => c.key === key)) {
            setError(`הקטגוריה ${key} כבר קיימת.`);
            return;
        }
        if (!newNameHe.trim()) {
            setError("שם הקטגוריה בעברית הוא שדה חובה.");
            return;
        }
        await onSave({
            key,
            legacyId: nextLegacyId(categories),
            name: { he: newNameHe.trim() },
            icon: "bookmark",
            iconOutline: "bookmark-outline",
            order: rows.length,
        });
        setNewKey("");
        setNewNameHe("");
    }

    return (
        <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            onClick={onClose}
        >
            <div
                style={{ ...ts.card, direction: "rtl", width: "min(900px, 100%)", maxHeight: "90vh", overflowY: "auto", gap: 12 }}
                onClick={e => e.stopPropagation()}
                data-testid="tlm-categories-modal"
            >
                <div style={{ ...ts.row, justifyContent: "space-between" }}>
                    <h3 style={ts.cardTitle}>קטגוריות המדריך</h3>
                    <button style={ts.secondaryBtn} onClick={onClose}>סגירה</button>
                </div>
                <p style={ts.hint}>
                    המפתח משמש את הערכים ואת האפליקציה ולכן אינו ניתן לשינוי. הסדר קובע את סדר ההצגה. אין כאן מחיקה:
                    קטגוריה שיש בה ערכים אי אפשר להסיר בלי להעביר אותם קודם.
                </p>
                {error && <div style={{ ...ts.banner, ...ts.bannerError }}>{error}</div>}

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                        <tr style={{ textAlign: "start", color: "#555" }}>
                            <th style={th}>מפתח</th>
                            <th style={th}>שם בעברית</th>
                            <th style={th}>שם באנגלית</th>
                            <th style={th}>סדר</th>
                            <th style={th}>ערכים</th>
                            <th style={th} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(c => {
                            const v = value(c);
                            return (
                                <tr key={c.key}>
                                    <td style={td}><code style={ts.code}>{c.key}</code></td>
                                    <td style={td}>
                                        <input style={ts.input} value={v.name.he} disabled={busy} onChange={e => edit(c, { name: { ...v.name, he: e.target.value } })} />
                                    </td>
                                    <td style={td}>
                                        <input style={{ ...ts.input, ...ts.inputLtr }} value={v.name.en ?? ""} disabled={busy} onChange={e => edit(c, { name: { ...v.name, en: e.target.value || undefined } })} />
                                    </td>
                                    <td style={td}>
                                        <input style={{ ...ts.input, width: 64, ...ts.inputLtr }} type="number" value={v.order} disabled={busy} onChange={e => edit(c, { order: Number(e.target.value) })} />
                                    </td>
                                    <td style={{ ...td, color: "#666" }}>{counts.get(c.key) ?? 0}</td>
                                    <td style={td}>
                                        <button style={ts.smallBtn} disabled={busy || !changed(c)} onClick={() => void save(c)}>שמירה</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <section style={ts.section}>
                    <h4 style={ts.sectionTitle}>הוספת קטגוריה</h4>
                    <div style={ts.row}>
                        <label style={{ ...ts.label, width: 180 }}>
                            מפתח (באנגלית)
                            <input style={{ ...ts.input, ...ts.inputLtr }} placeholder="for-example" value={newKey} disabled={busy} onChange={e => setNewKey(e.target.value)} />
                        </label>
                        <label style={{ ...ts.label, flex: 1 }}>
                            שם בעברית
                            <input style={ts.input} value={newNameHe} disabled={busy} onChange={e => setNewNameHe(e.target.value)} />
                        </label>
                        <button style={ts.primaryBtn} disabled={busy} onClick={() => void addCategory()}>הוספה</button>
                    </div>
                    <p style={{ ...ts.hint, color: RED }}>
                        קטגוריה חדשה מחייבת גם עדכון באפליקציה (אייקון ותצוגה) לפני שהיא מוצגת למשתמשים.
                    </p>
                </section>
            </div>
        </div>
    );
}

const th: React.CSSProperties = { textAlign: "start", padding: "4px 6px", borderBottom: "1px solid #e0e0e0", fontWeight: 600 };
const td: React.CSSProperties = { padding: "4px 6px", verticalAlign: "middle" };
