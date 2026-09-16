/**
 * EntryEditor – טופס העריכה של ערך אחד.
 *
 * הטופס עובד על עותק מקומי של הערך (draft) ומדווח למעלה על שינויים. השמירה,
 * המחיקה והאימות מגיעים מלמעלה (TanakhView), כדי שהרשימה תתעדכן.
 *
 * שדות: כותרת ושמות נוספים (עברית/אנגלית), גוף הערך עם תצוגה מקדימה, פסוקי
 * פתיחה, מראי מקום, ערכים קשורים, הפניה, מיקום על מפה, תמונות, קישורים
 * מהפסוקים, אזור, עמוד, הערות פנימיות, הערות לבדיקה, מצב תרגום.
 */

import React, { useMemo, useState } from "react";
import type { Category, Entry, RefItem, VerseRef } from "../model/types";
import { isValidVerseRef, parseHebrewRef, TANAKH_BOOKS } from "../model/tanakhBooks";
import { formatVerseRef, toHebrewNumeral } from "../model/hebnum";
import type { ValidationIssue } from "../model/validate";
import { hasTranslation } from "../model/entryOps";
import { matchesQuery } from "../utils/search";
import { BodyPreview } from "./BodyPreview";
import { AnchorEditor } from "./AnchorEditor";
import { ImageList } from "./ImageList";
import { MapPicker } from "./MapPicker";
import { AMBER, BLUE, GREEN, RED, ts } from "./tanakhStyles";

export interface EntryEditorProps {
    draft: Entry;
    isNew: boolean;
    dirty: boolean;
    busy: boolean;
    categories: Category[];
    /** כל הערכים (לבחירת ערכים קשורים והפניה) */
    allEntries: Entry[];
    issues: ValidationIssue[];
    onChange: (next: Entry) => void;
    onSave: () => void;
    onDelete: () => void;
    onRevert: () => void;
    onMarkTranslation: (status: "reviewed" | "approved") => void;
}

export function EntryEditor(p: EntryEditorProps) {
    const { draft, categories, issues } = p;
    const set = (patch: Partial<Entry>) => p.onChange({ ...draft, ...patch });
    const errorsFor = (field: string) => issues.filter(i => i.field === field || i.field.startsWith(field + "["));
    const hasError = issues.some(i => i.level === "error");
    const byId = useMemo(() => new Map(p.allEntries.map(e => [e.id, e])), [p.allEntries]);

    return (
        <div style={{ ...ts.card, gap: 14 }}>
            {/* ── כותרת עליונה ─────────────────────────────────────────── */}
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <div style={{ ...ts.row, gap: 12 }}>
                    <span style={ts.code}>{draft.id}</span>
                    <label style={{ ...ts.row, gap: 6, fontSize: 13 }}>
                        קטגוריה
                        <select id="tlm-cat" style={ts.select} value={draft.cat} onChange={e => set({ cat: e.target.value })}>
                            {categories.map(c => <option key={c.key} value={c.key}>{c.name.he}</option>)}
                        </select>
                    </label>
                    <label style={{ ...ts.row, gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input id="tlm-visible" type="checkbox" checked={draft.visible} onChange={e => set({ visible: e.target.checked })} />
                        מוצג באפליקציה
                    </label>
                </div>
                <div style={{ ...ts.row, gap: 8 }}>
                    <span style={{ fontSize: 12, color: hasError ? RED : p.dirty ? "#e65100" : GREEN, fontWeight: 600 }}>
                        {hasError ? "יש שגיאות" : p.isNew ? "ערך חדש" : p.dirty ? "שינויים שלא נשמרו" : "נשמר"}
                    </span>
                    {p.dirty && !p.isNew && <button style={ts.secondaryBtn} onClick={p.onRevert} disabled={p.busy}>ביטול שינויים</button>}
                    <button style={ts.successBtn} onClick={p.onSave} disabled={p.busy || hasError || (!p.dirty && !p.isNew)}>{p.busy ? "שומר…" : "שמירה"}</button>
                </div>
            </div>
            {!draft.visible && <div style={{ ...ts.banner, ...ts.bannerWarn }}>הערך מוסתר: לא ייכנס לקובץ התוכן בפרסום.</div>}
            <IssueList issues={issues.filter(i => !i.field.includes("[") && !["title.he", "body.he", "see", "location", "cat"].includes(i.field))} />

            {/* ── לבדיקה ───────────────────────────────────────────────── */}
            {draft.review.length > 0 && (
                <div style={{ ...ts.banner, ...ts.bannerWarn, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...ts.row, justifyContent: "space-between" }}>
                        <b>לבדיקה ({draft.review.length})</b>
                        {draft.review.length > 1 && (
                            <button style={ts.smallBtn} onClick={() => set({ review: [] })}>טופל להכול</button>
                        )}
                    </div>
                    {draft.review.map((r, i) => (
                        <div key={i} style={{ ...ts.row, justifyContent: "space-between" }}>
                            <span>{r}</span>
                            <button style={ts.smallBtn} onClick={() => set({ review: draft.review.filter((_, j) => j !== i) })}>טופל</button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── כותרת ושמות ──────────────────────────────────────────── */}
            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>כותרת ושמות נוספים</h4>
                <div style={ts.twoCol}>
                    <label style={ts.label}>
                        כותרת (עברית) *
                        <input id="tlm-title-he" style={ts.input} value={draft.title.he} onChange={e => set({ title: { ...draft.title, he: e.target.value } })} />
                        <Issues list={errorsFor("title.he")} />
                    </label>
                    <label style={ts.label}>
                        Title (English)
                        <input id="tlm-title-en" style={{ ...ts.input, ...ts.inputLtr }} value={draft.title.en ?? ""} onChange={e => set({ title: { ...draft.title, en: e.target.value || undefined } })} />
                    </label>
                    <label style={ts.label}>
                        שמות נוספים (מופרדים בפסיק)
                        <input id="tlm-alt-he" style={ts.input} value={draft.altTitles.he.join(", ")} onChange={e => set({ altTitles: { ...draft.altTitles, he: splitList(e.target.value) } })} />
                    </label>
                    <label style={ts.label}>
                        Alternative names
                        <input id="tlm-alt-en" style={{ ...ts.input, ...ts.inputLtr }} value={(draft.altTitles.en ?? []).join(", ")} onChange={e => set({ altTitles: { ...draft.altTitles, en: splitList(e.target.value) } })} />
                    </label>
                </div>
            </section>

            {/* ── גוף הערך ─────────────────────────────────────────────── */}
            <BodySection draft={draft} set={set} issues={errorsFor("body.he")} />

            {/* ── פסוקי פתיחה ──────────────────────────────────────────── */}
            <QuotesSection quotes={draft.quotes} onChange={quotes => set({ quotes })} issues={errorsFor("quotes")} />

            {/* ── מראי מקום ────────────────────────────────────────────── */}
            <RefsSection refs={draft.refs} onChange={refs => set({ refs })} />

            {/* ── ערכים קשורים והפניה ──────────────────────────────────── */}
            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>ערכים קשורים</h4>
                <EntryPicker
                    id="tlm-xrefs"
                    entries={p.allEntries}
                    exclude={new Set([draft.id, ...draft.xrefs])}
                    placeholder="הוספת ערך קשור – חיפוש לפי כותרת…"
                    onPick={id => set({ xrefs: [...draft.xrefs, id] })}
                />
                <div style={{ ...ts.row, gap: 6 }}>
                    {draft.xrefs.map(id => (
                        <span key={id} style={ts.chip}>
                            {byId.get(id)?.title.he ?? <span style={{ color: RED }}>{id} (לא קיים)</span>}
                            <button style={{ ...ts.smallBtn, border: "none", padding: "0 2px" }} onClick={() => set({ xrefs: draft.xrefs.filter(x => x !== id) })} title="הסרה">×</button>
                        </span>
                    ))}
                    {!draft.xrefs.length && <span style={ts.muted}>אין ערכים קשורים</span>}
                </div>
                <Issues list={errorsFor("xrefs")} />
            </section>

            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>הפניה ("ראה ערך אחר")</h4>
                <p style={ts.hint}>ערך עם הפניה הוא כותרת בלבד שמובילה לערך אחר. גוף הערך לא מוצג.</p>
                {draft.see ? (
                    <div style={ts.row}>
                        <span style={ts.chip}>ראה: {byId.get(draft.see)?.title.he ?? <span style={{ color: RED }}>{draft.see} (לא קיים)</span>}</span>
                        <button style={ts.smallBtn} onClick={() => set({ see: undefined })}>הסרת ההפניה</button>
                    </div>
                ) : (
                    <EntryPicker id="tlm-see" entries={p.allEntries} exclude={new Set([draft.id])} placeholder="בחירת ערך יעד…" onPick={id => set({ see: id })} />
                )}
                <Issues list={errorsFor("see")} />
            </section>

            {/* ── מיקום ────────────────────────────────────────────────── */}
            <section style={ts.section}>
                <div style={{ ...ts.row, justifyContent: "space-between" }}>
                    <h4 style={ts.sectionTitle}>מיקום</h4>
                    {!draft.location && <span style={ts.muted}>אין מיקום – לחיצה על המפה תוסיף אחד</span>}
                </div>
                <MapPicker
                    entryId={draft.id}
                    value={draft.location}
                    label={draft.title.he || draft.id}
                    onChange={location => set({ location })}
                />
                <Issues list={errorsFor("location")} />
            </section>

            {/* ── תמונות ───────────────────────────────────────────────── */}
            <ImageList images={draft.images} onChange={images => set({ images })} />

            {/* ── קישורים מהפסוקים ─────────────────────────────────────── */}
            <AnchorEditor anchors={draft.anchors} onChange={anchors => set({ anchors })} />

            {/* ── אזור, עמוד, הערות ────────────────────────────────────── */}
            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>פרטים נוספים</h4>
                <div style={ts.twoCol}>
                    <label style={ts.label}>
                        אזור (עברית)
                        <input id="tlm-region-he" style={ts.input} value={draft.region?.he ?? ""} onChange={e => set({ region: e.target.value ? { ...(draft.region ?? { he: "" }), he: e.target.value } : undefined })} />
                    </label>
                    <label style={ts.label}>
                        Region (English)
                        <input id="tlm-region-en" style={{ ...ts.input, ...ts.inputLtr }} value={draft.region?.en ?? ""} disabled={!draft.region} onChange={e => set({ region: { ...(draft.region ?? { he: "" }), en: e.target.value || undefined } })} />
                    </label>
                    <label style={ts.label}>
                        עמוד במדריך המודפס
                        <input id="tlm-page" style={{ ...ts.input, ...ts.inputLtr, maxWidth: 120 }} type="number" min={0} value={draft.page ?? ""} onChange={e => set({ page: e.target.value === "" ? undefined : Number(e.target.value) })} />
                        <Issues list={errorsFor("page")} />
                    </label>
                </div>
                <label style={ts.label}>
                    הערות פנימיות לעורכים (לא מתפרסם)
                    <textarea id="tlm-notes" style={{ ...ts.textarea, minHeight: 60 }} value={draft.notes ?? ""} onChange={e => set({ notes: e.target.value || undefined })} />
                </label>
            </section>

            {/* ── תרגום ────────────────────────────────────────────────── */}
            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>תרגום לאנגלית</h4>
                <TranslationStatus draft={draft} onMark={p.onMarkTranslation} disabled={p.busy || p.dirty} />
            </section>

            {/* ── תחתית ────────────────────────────────────────────────── */}
            <section style={{ ...ts.section, ...ts.row, justifyContent: "space-between" }}>
                <span style={ts.muted}>
                    {draft.updatedAt ? `עודכן ${new Date(draft.updatedAt).toLocaleString("he-IL")}${draft.updatedBy ? ` על ידי ${draft.updatedBy}` : ""}` : "טרם נשמר"}
                </span>
                {!p.isNew && <button style={ts.dangerBtn} onClick={p.onDelete} disabled={p.busy}>מחיקת הערך</button>}
            </section>
        </div>
    );
}

// ── חלקים ──────────────────────────────────────────────────────────────────

function splitList(s: string): string[] {
    return s.split(",").map(x => x.trim()).filter(Boolean);
}

function Issues({ list }: { list: ValidationIssue[] }) {
    if (!list.length) return null;
    return <>{list.map((i, k) => <p key={k} style={i.level === "error" ? ts.fieldError : ts.fieldWarn}>{i.message}</p>)}</>;
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
    if (!issues.length) return null;
    return (
        <div style={{ ...ts.banner, ...(issues.some(i => i.level === "error") ? ts.bannerError : ts.bannerWarn) }}>
            {issues.map((i, k) => <div key={k}>{i.level === "error" ? "✗" : "!"} {i.message}</div>)}
        </div>
    );
}

function BodySection({ draft, set, issues }: { draft: Entry; set: (p: Partial<Entry>) => void; issues: ValidationIssue[] }) {
    const [preview, setPreview] = useState(false);
    const [lang, setLang] = useState<"he" | "en">("he");
    const value = lang === "he" ? draft.body.he : draft.body.en ?? "";
    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>גוף הערך</h4>
                <div style={{ ...ts.row, gap: 6 }}>
                    <button style={{ ...ts.chip, cursor: "pointer", ...(lang === "he" ? ts.chipActive : {}) }} onClick={() => setLang("he")}>עברית</button>
                    <button style={{ ...ts.chip, cursor: "pointer", ...(lang === "en" ? ts.chipActive : {}) }} onClick={() => setLang("en")}>English{hasTranslation(draft, "en") ? "" : " (ריק)"}</button>
                    <button style={{ ...ts.chip, cursor: "pointer", ...(preview ? ts.chipActive : {}) }} onClick={() => setPreview(v => !v)}>תצוגה מקדימה</button>
                </div>
            </div>
            <p style={ts.hint}>
                פסקאות מופרדות בשורה ריקה. שורה שמתחילה ב-<code style={ts.code}>## </code> היא כותרת משנה,
                ב-<code style={ts.code}>&gt; </code> ציטוט (שאינו פסוק מזוהה), ב-<code style={ts.code}>~ </code> הערה מדעית.
                פסוקי הפתיחה מוזנים בנפרד למטה.
            </p>
            <div style={preview ? ts.twoCol : undefined}>
                <textarea
                    id={`tlm-body-${lang}`}
                    style={{ ...ts.textarea, minHeight: 260, ...(lang === "en" ? ts.inputLtr : {}) }}
                    value={value}
                    onChange={e => set({ body: { ...draft.body, [lang]: lang === "he" ? e.target.value : e.target.value || undefined } })}
                />
                {preview && <BodyPreview body={value} dir={lang === "he" ? "rtl" : "ltr"} />}
            </div>
            <Issues list={issues} />
        </section>
    );
}

function QuotesSection({ quotes, onChange, issues }: { quotes: VerseRef[]; onChange: (q: VerseRef[]) => void; issues: ValidationIssue[] }) {
    const [text, setText] = useState("");
    const parsed = useMemo(() => {
        const r = parseHebrewRef(text);
        return r.book && r.ch && r.v ? { book: r.book, ch: r.ch, v: r.v, ...(r.v2 ? { v2: r.v2 } : {}) } as VerseRef : null;
    }, [text]);
    const valid = parsed ? isValidVerseRef(parsed) : false;
    function add() {
        if (!parsed || !valid) return;
        onChange([...quotes, parsed]);
        setText("");
    }
    return (
        <section style={ts.section}>
            <h4 style={ts.sectionTitle}>פסוקי פתיחה</h4>
            <p style={ts.hint}>הפניות בלבד. טקסט הפסוק נשלף מהתנ"ך בזמן הפרסום, ולכן אין להקליד אותו. לדוגמה: <code style={ts.code}>יהושע יח, א</code> או <code style={ts.code}>תהלים כג, א–ג</code>.</p>
            <div style={ts.row}>
                <input
                    id="tlm-quote-add"
                    style={{ ...ts.input, flex: 1, borderColor: text && !valid ? RED : undefined }}
                    placeholder="ספר פרק, פסוק"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                />
                <button style={ts.secondaryBtn} onClick={add} disabled={!valid}>הוספה</button>
            </div>
            {text && !valid && <p style={ts.fieldError}>{parsed ? "הפרק או הפסוק מחוץ לטווח הספר" : "לא זוהה: צריך שם ספר, פרק ופסוק בעברית"}</p>}
            <div style={{ ...ts.row, gap: 6 }}>
                {quotes.map((q, i) => (
                    <span key={i} style={{ ...ts.chip, borderColor: isValidVerseRef(q) ? undefined : RED }}>
                        {formatVerseRef(q)}
                        <button style={{ ...ts.smallBtn, border: "none", padding: "0 2px" }} onClick={() => onChange(quotes.filter((_, j) => j !== i))} title="הסרה">×</button>
                    </span>
                ))}
                {!quotes.length && <span style={ts.muted}>אין פסוקי פתיחה</span>}
            </div>
            <Issues list={issues} />
        </section>
    );
}

function RefsSection({ refs, onChange }: { refs: RefItem[]; onChange: (r: RefItem[]) => void }) {
    const text = refs.map(r => r.raw).join("\n");
    const [local, setLocal] = useState<string | null>(null);
    const shown = local ?? text;
    function commit(value: string) {
        const next: RefItem[] = value.split("\n").map(l => l.trim()).filter(Boolean).map(raw => {
            const prev = refs.find(r => r.raw === raw);
            if (prev) return prev;
            const p = parseHebrewRef(raw);
            const item: RefItem = { raw };
            if (p.book) item.book = p.book;
            if (p.ch) item.ch = p.ch;
            if (p.v) item.v = p.v;
            if (p.v2) item.v2 = p.v2;
            return item;
        });
        onChange(next);
        setLocal(null);
    }
    const resolved = refs.filter(r => r.book && r.ch && r.v && isValidVerseRef({ book: r.book, ch: r.ch, v: r.v, v2: r.v2 })).length;
    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>מראי מקום</h4>
                <span style={ts.muted}>{refs.length} · מזוהים כהפניה לתנ"ך: <b style={{ color: GREEN }}>{resolved}</b> · לא מזוהים: <b style={{ color: refs.length - resolved ? AMBER : undefined }}>{refs.length - resolved}</b></span>
            </div>
            <p style={ts.hint}>מראה מקום בכל שורה. מה שמזוהה כהפניה לתנ"ך יהפוך לקישור באפליקציה; השאר מוצג כטקסט. כיתוב תמונה או משפט חופשי כאן הוא כנראה טעות מההעברה.</p>
            <textarea
                id="tlm-refs"
                style={{ ...ts.textarea, minHeight: 90 }}
                value={shown}
                onChange={e => setLocal(e.target.value)}
                onBlur={e => commit(e.target.value)}
            />
            {refs.length > 0 && (
                <div style={{ ...ts.row, gap: 4 }}>
                    {refs.map((r, i) => {
                        const ok = r.book && r.ch && r.v && isValidVerseRef({ book: r.book, ch: r.ch, v: r.v, v2: r.v2 });
                        return <span key={i} style={{ ...ts.badge, background: ok ? "#e8f5e9" : "#f5f5f5", color: ok ? GREEN : "#777" }} title={ok ? "מזוהה" : "לא מזוהה"}>{r.raw}</span>;
                    })}
                </div>
            )}
        </section>
    );
}

/** חיפוש ערך לפי כותרת ובחירה – לערכים קשורים ולהפניה */
function EntryPicker({ id, entries, exclude, placeholder, onPick }: { id: string; entries: Entry[]; exclude: Set<string>; placeholder: string; onPick: (id: string) => void }) {
    const [q, setQ] = useState("");
    const matches = useMemo(() => {
        if (q.trim().length < 2) return [];
        return entries.filter(e => !exclude.has(e.id) && !e.see && matchesQuery(e, q)).slice(0, 8);
    }, [q, entries, exclude]);
    return (
        <div style={{ position: "relative" }}>
            <input id={id} style={ts.input} placeholder={placeholder} value={q} onChange={e => setQ(e.target.value)} />
            {matches.length > 0 && (
                <ul style={{ ...ts.list, position: "absolute", zIndex: 5, top: "100%", right: 0, left: 0, background: "#fff", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", padding: 4, maxHeight: 260, overflowY: "auto" }}>
                    {matches.map(e => (
                        <li key={e.id} style={ts.listRow} onMouseDown={ev => { ev.preventDefault(); onPick(e.id); setQ(""); }}>
                            <span style={{ flex: 1 }}>{e.title.he}</span>
                            <span style={ts.muted}>{e.id}</span>
                        </li>
                    ))}
                </ul>
            )}
            {q.trim().length >= 2 && !matches.length && <p style={ts.muted}>אין ערך מתאים</p>}
        </div>
    );
}

function TranslationStatus({ draft, onMark, disabled }: { draft: Entry; onMark: (s: "reviewed" | "approved") => void; disabled: boolean }) {
    const state = draft.i18n.en;
    const exists = hasTranslation(draft, "en");
    const label: Record<string, string> = { machine: "תורגם במכונה, טרם נבדק", reviewed: "נבדק", approved: "מאושר", stale: "לא מעודכן – העברית השתנתה אחרי התרגום" };
    const color: Record<string, string> = { machine: AMBER, reviewed: BLUE, approved: GREEN, stale: RED };
    return (
        <div style={{ ...ts.row, justifyContent: "space-between" }}>
            <span style={{ fontSize: 14 }}>
                {!exists ? <span style={ts.muted}>אין תרגום. התרגום האוטומטי מגיע בשלב 5; אפשר גם להקליד ידנית בשדות האנגלית.</span>
                    : state ? <b style={{ color: color[state.status] }}>{label[state.status]}</b>
                    : <b style={{ color: AMBER }}>הוזן ידנית, טרם סומן</b>}
                {state?.updatedAt ? <span style={ts.muted}> · {new Date(state.updatedAt).toLocaleDateString("he-IL")}{state.updatedBy ? ` · ${state.updatedBy}` : ""}</span> : null}
            </span>
            {exists && (
                <div style={{ ...ts.row, gap: 6 }}>
                    <button style={ts.secondaryBtn} disabled={disabled || state?.status === "reviewed"} onClick={() => onMark("reviewed")} title={disabled ? "יש לשמור קודם" : ""}>סימון: נבדק</button>
                    <button style={ts.secondaryBtn} disabled={disabled || state?.status === "approved"} onClick={() => onMark("approved")} title={disabled ? "יש לשמור קודם" : ""}>סימון: מאושר</button>
                </div>
            )}
        </div>
    );
}

/** לתצוגת עזר במקומות אחרים */
export function bookOptions() {
    return TANAKH_BOOKS.map(b => ({ id: b.id, he: b.he, chapters: b.chapters }));
}
export { toHebrewNumeral };
