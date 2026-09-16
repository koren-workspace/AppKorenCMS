/**
 * EntryList – רשימת הערכים: חיפוש, סינון לפי קטגוריה, מסננים מהירים, ושורה
 * לכל ערך עם סמלי מצב. הסינון כולו בדפדפן (utils/search.ts).
 */

import React, { useMemo, useState } from "react";
import type { Category, Entry } from "../model/types";
import { hasTranslation } from "../model/entryOps";
import { filterEntries, QUICK_FILTER_LABELS, sortEntries, type ListFilters, type QuickFilter } from "../utils/search";
import { ts } from "./tanakhStyles";

export interface EntryListProps {
    entries: Entry[];
    categories: Category[];
    selectedId: string | null;
    /** מזהי ערכים שיש להם שינויים שלא נשמרו (מסומנים ברשימה) */
    dirtyId?: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onReload: () => void;
    loading?: boolean;
}

const PAGE = 300;

export function EntryList({ entries, categories, selectedId, dirtyId, onSelect, onNew, onReload, loading }: EntryListProps) {
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
            <div style={ts.muted}>{filtered.length === entries.length ? `${entries.length} ערכים` : `${filtered.length} מתוך ${entries.length} ערכים`}</div>

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
                            <span style={{ display: "flex", gap: 3, fontSize: 12, flexShrink: 0 }}>
                                {dirtyId === e.id && <span title="שינויים שלא נשמרו" style={{ color: "#e65100" }}>●</span>}
                                {e.review.length > 0 && <span title={`לבדיקה (${e.review.length})`} style={{ color: "#e65100" }}>!</span>}
                                {!e.visible && <span title="מוסתר" style={{ color: "#999" }}>👁</span>}
                                {e.location && <span title="יש מיקום" style={{ color: "#2e7d32" }}>📍</span>}
                                {e.images.length > 0 && <span title={`${e.images.length} תמונות`} style={{ color: "#555" }}>🖼</span>}
                                {hasTranslation(e, "en") && <span title={`אנגלית: ${e.i18n.en?.status ?? "קיים"}`} style={{ color: e.i18n.en?.status === "stale" ? "#e65100" : "#1565c0", fontWeight: 700 }}>EN</span>}
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
