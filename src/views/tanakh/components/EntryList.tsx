/**
 * EntryList – רשימת הערכים: חיפוש, סינון לפי קטגוריה, מסננים מהירים, ושורה
 * לכל ערך עם סמלי מצב. הסינון כולו בדפדפן (utils/search.ts).
 */

import React, { useMemo, useState } from "react";
import type { Category, Entry } from "../model/types";
import { hasTranslation } from "../model/entryOps";
import { filterEntries, QUICK_FILTER_LABELS, sortEntries, type ListFilters, type QuickFilter } from "../utils/search";
import { AMBER, RED, ts } from "./tanakhStyles";

/** הסבר לסימון EN בשורה */
const EN_STATUS_LABELS: Record<string, string> = {
    machine: "תורגם במכונה, טרם נבדק",
    reviewed: "נבדק",
    approved: "מאושר",
    stale: "לא מעודכן: העברית השתנתה",
    none: "טרם סומן",
};

export interface EntryListProps {
    entries: Entry[];
    categories: Category[];
    selectedId: string | null;
    /** מזהי ערכים שיש להם שינויים שלא נשמרו (מסומנים ברשימה) */
    dirtyId?: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onReload: () => void;
    onManageCategories?: () => void;
    loading?: boolean;
}

const PAGE = 300;

export function EntryList({ entries, categories, selectedId, dirtyId, onSelect, onNew, onReload, onManageCategories, loading }: EntryListProps) {
    const [filters, setFilters] = useState<ListFilters>({ query: "", cat: "all", quick: null });
    const [limit, setLimit] = useState(PAGE);

    const catOrder = useMemo(() => new Map(categories.map(c => [c.key, c.order])), [categories]);
    const catName = useMemo(() => new Map(categories.map(c => [c.key, c.name.he])), [categories]);
    const filtered = useMemo(() => sortEntries(filterEntries(entries, filters), catOrder), [entries, filters, catOrder]);
    const shown = filtered.slice(0, limit);

    const reviewCount = useMemo(() => entries.filter(e => e.review.length).length, [entries]);

    function update(patch: Partial<ListFilters>) {
        setFilters(f => ({ ...f, ...patch }));
        setLimit(PAGE);
    }

    return (
        <div style={{ ...ts.card, position: "sticky", top: 8, maxHeight: "calc(100vh - 90px)", overflow: "hidden" }}>
            <div style={ts.row}>
                <input
                    id="tlm-search"
                    style={{ ...ts.input, flex: 1 }}
                    placeholder="חיפוש לפי כותרת, שם נוסף או מזהה…"
                    value={filters.query}
                    onChange={e => update({ query: e.target.value })}
                />
                <button style={ts.primaryBtn} onClick={onNew} title="ערך חדש">+ ערך</button>
            </div>
            <div style={ts.row}>
                <select id="tlm-cat-filter" style={{ ...ts.select, flex: 1 }} value={filters.cat} onChange={e => update({ cat: e.target.value })}>
                    <option value="all">כל הקטגוריות</option>
                    {categories.map(c => <option key={c.key} value={c.key}>{c.name.he}</option>)}
                </select>
                <button style={ts.secondaryBtn} onClick={onReload} disabled={loading} title="טעינה מחדש מהשרת">{loading ? "טוען…" : "רענון"}</button>
                {onManageCategories && <button style={ts.secondaryBtn} onClick={onManageCategories} title="ניהול הקטגוריות">קטגוריות</button>}
            </div>
            <div style={{ ...ts.row, gap: 6 }}>
                {(Object.keys(QUICK_FILTER_LABELS) as QuickFilter[]).map(q => (
                    <button
                        key={q}
                        style={{ ...ts.chip, cursor: "pointer", ...(filters.quick === q ? ts.chipActive : {}) }}
                        onClick={() => update({ quick: filters.quick === q ? null : q })}
                    >
                        {QUICK_FILTER_LABELS[q]}{q === "review" && reviewCount ? ` (${reviewCount})` : ""}
                    </button>
                ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={ts.muted}>{filtered.length === entries.length ? `${entries.length} ערכים` : `${filtered.length} מתוך ${entries.length} ערכים`}</span>
                <span style={{ ...ts.muted, fontSize: 11, lineHeight: 1.5 }} title="הסימונים שמופיעים בסוף כל שורה ברשימה">
                    סימונים: מוסתר · לבדיקה · 📍 מיקום · 🖼 תמונות · EN תרגום
                </span>
            </div>

            <ul style={{ ...ts.list, overflowY: "auto", flex: 1, minHeight: 200 }}>
                {shown.map(e => {
                    const active = e.id === selectedId;
                    return (
                        <li
                            key={e.id}
                            style={{ ...ts.listRow, ...(active ? ts.listRowActive : {}) }}
                            onClick={() => onSelect(e.id)}
                            title={`${e.id} · ${catName.get(e.cat) ?? e.cat}`}
                        >
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: e.visible ? 1 : 0.55 }}>
                                {e.title.he || <span style={{ color: "#999" }}>(ללא כותרת)</span>}
                                {e.see && <span style={ts.muted}> ← הפניה</span>}
                            </span>
                            <span style={{ display: "flex", gap: 4, fontSize: 11, flexShrink: 0, alignItems: "center" }}>
                                {dirtyId === e.id && <span title="יש בערך הזה שינויים שלא נשמרו" style={{ color: "#e65100", fontSize: 13 }}>●</span>}
                                {e.review.length > 0 && <span title={`${e.review.length} הערות לבדיקה בערך הזה`} style={{ ...ts.badge, background: "#fff3e0", color: AMBER }}>לבדיקה</span>}
                                {!e.visible && <span title="מוסתר: לא ייכנס לאפליקציה בפרסום הבא" style={{ ...ts.badge, background: "#f0f0f0", color: "#777" }}>מוסתר</span>}
                                {e.location && <span title="לערך יש נקודת ציון על המפה" style={{ color: "#2e7d32", fontSize: 12 }}>📍</span>}
                                {e.images.length > 0 && <span title={`${e.images.length} תמונות`} style={{ color: "#555", fontSize: 12 }}>🖼</span>}
                                {hasTranslation(e, "en") && (
                                    <span
                                        title={`יש תרגום לאנגלית (${EN_STATUS_LABELS[e.i18n.en?.status ?? "none"] ?? "טרם סומן"})`}
                                        style={{ ...ts.badge, background: e.i18n.en?.status === "stale" ? "#fdecea" : "#e3f2fd", color: e.i18n.en?.status === "stale" ? RED : "#0d47a1" }}
                                    >
                                        EN
                                    </span>
                                )}
                            </span>
                        </li>
                    );
                })}
                {filtered.length > limit && (
                    <li style={{ padding: 8, textAlign: "center" }}>
                        <button style={ts.secondaryBtn} onClick={() => setLimit(l => l + PAGE)}>הצג עוד ({filtered.length - limit})</button>
                    </li>
                )}
                {!filtered.length && <li style={{ ...ts.muted, padding: 12, textAlign: "center" }}>{entries.length ? "אין ערכים שמתאימים לסינון" : "המסד ריק – התוכן נטען בשלב 3, או לחצו + ערך"}</li>}
            </ul>
        </div>
    );
}
