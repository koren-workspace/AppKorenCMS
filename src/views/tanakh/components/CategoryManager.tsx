/**
 * CategoryManager – ניהול שמונה הקטגוריות של המדריך (שלב 4, חלק ב').
 *
 * מה שניתן לערוך: השם בעברית ובאנגלית, סדר התצוגה, ושמות אייקוני Ionicons.
 * המפתח (`key`) ו-`legacyId` לא ניתנים לעריכה: הערכים מצביעים על הקטגוריה
 * לפי המפתח, והמזהה המספרי נשמר לתאימות עם האפליקציה בזמן הפרסום.
 *
 * מחיקת קטגוריה לא נתמכת כאן בכוונה – קטגוריה שנמחקת מייתמת את כל הערכים
 * שבה. קטגוריה שלא רוצים להציג עדיף להשאיר ריקה.
 */

import React, { useMemo, useState } from "react";
import type { Category, Entry } from "../model/types";
import { ts } from "./tanakhStyles";

export interface CategoryManagerProps {
    categories: Category[];
    entries: Entry[];
    busy: boolean;
    onSave: (category: Category) => void;
    onClose: () => void;
}

export function CategoryManager({ categories, entries, busy, onSave, onClose }: CategoryManagerProps) {
    const [drafts, setDrafts] = useState<Record<string, Category>>(() => Object.fromEntries(categories.map(c => [c.key, structuredClone(c)])));

    const counts = useMemo(() => {
        const m = new Map<string, number>();
        for (const e of entries) m.set(e.cat, (m.get(e.cat) ?? 0) + 1);
        return m;
    }, [entries]);

    const original = useMemo(() => new Map(categories.map(c => [c.key, c])), [categories]);
    const sorted = useMemo(() => Object.values(drafts).sort((a, b) => a.order - b.order), [drafts]);

    function patch(key: string, next: Partial<Category>) {
        setDrafts(d => ({ ...d, [key]: { ...d[key], ...next } }));
    }
    function changed(c: Category): boolean {
        return JSON.stringify(c) !== JSON.stringify(original.get(c.key));
    }

    return (
        <div style={{ ...ts.card, gap: 12 }}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h3 style={ts.cardTitle}>ניהול קטגוריות</h3>
                <button style={ts.secondaryBtn} onClick={onClose}>סגירה</button>
            </div>
            <p style={ts.hint}>
                המפתח והמזהה המספרי קבועים – הערכים מצביעים עליהם. שמות האייקונים הם שמות של
                Ionicons, כפי שהאפליקציה משתמשת בהם (למשל <code style={ts.code}>location</code> ו-
                <code style={ts.code}>location-outline</code>).
            </p>

            <ul style={{ ...ts.list, gap: 10 }}>
                {sorted.map(c => (
                    <li key={c.key} style={{ ...ts.listRow, cursor: "default", flexDirection: "column", alignItems: "stretch", gap: 8, border: "1px solid #eee" }}>
                        <div style={{ ...ts.row, justifyContent: "space-between" }}>
                            <div style={{ ...ts.row, gap: 8 }}>
                                <span style={ts.code}>{c.key}</span>
                                <span style={ts.muted}>מזהה באפליקציה: {c.legacyId} · {counts.get(c.key) ?? 0} ערכים</span>
                            </div>
                            <button style={ts.successBtn} disabled={busy || !changed(c)} onClick={() => onSave(c)}>
                                {changed(c) ? "שמירה" : "נשמר"}
                            </button>
                        </div>
                        <div style={ts.twoCol}>
                            <label style={ts.label}>
                                שם (עברית)
                                <input style={ts.input} value={c.name.he} onChange={e => patch(c.key, { name: { ...c.name, he: e.target.value } })} />
                            </label>
                            <label style={ts.label}>
                                Name (English)
                                <input style={{ ...ts.input, ...ts.inputLtr }} value={c.name.en ?? ""} onChange={e => patch(c.key, { name: { ...c.name, en: e.target.value || undefined } })} />
                            </label>
                            <label style={ts.label}>
                                סדר תצוגה
                                <input style={{ ...ts.input, ...ts.inputLtr, maxWidth: 90 }} type="number" min={0} value={c.order} onChange={e => patch(c.key, { order: Number(e.target.value) })} />
                            </label>
                            <div style={ts.twoCol}>
                                <label style={ts.label}>
                                    אייקון
                                    <input style={{ ...ts.input, ...ts.inputLtr }} value={c.icon} onChange={e => patch(c.key, { icon: e.target.value })} />
                                </label>
                                <label style={ts.label}>
                                    אייקון (קו מתאר)
                                    <input style={{ ...ts.input, ...ts.inputLtr }} value={c.iconOutline} onChange={e => patch(c.key, { iconOutline: e.target.value })} />
                                </label>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
