/**
 * PublishPanel – בניית קובץ התוכן ופרסומו לאפליקציה (שלב 7).
 *
 * הזרימה: בונים את הקובץ, רואים מה נכנס ומה לא, ורק אז מפרסמים. שגיאת
 * אימות בערך שאמור להיכנס חוסמת; אזהרות (הפניה לערך מוסתר, ערך קשור שנעלם)
 * מוצגות ולא חוסמות – הן לגיטימיות בזמן עבודה.
 *
 * העלאה ל-Storage עדיין מושבתת (מצריך Blaze). עד אז ההורדה למחשב היא היעד,
 * והיא מספיקה כדי לוודא שהקובץ נכון.
 */

import React, { useEffect, useMemo, useState } from "react";
import type { Category, Entry, PublishMeta } from "../model/types";
import { buildContentPack, packFileName, type ContentPack, type PublishResult } from "../model/publish";
import { validateEntry } from "../model/validate";
import { downloadPack, formatBytes, isStorageEnabled, loadPublishMeta, packSize } from "../services/publishService";
import { ts, GREEN, RED } from "./tanakhStyles";

export interface PublishPanelProps {
    entries: Entry[];
    categories: Category[];
    busy: boolean;
    /** שמירת מסמך הפרסום; מוחזר מלמעלה כדי שהבאנר והמצב יתעדכנו */
    onPublish: (pack: ContentPack, result: PublishResult) => Promise<void>;
    onClose: () => void;
}

export function PublishPanel({ entries, categories, busy, onPublish, onClose }: PublishPanelProps) {
    const [preview, setPreview] = useState(false);
    const [meta, setMeta] = useState<PublishMeta | null | undefined>(undefined);
    const [built, setBuilt] = useState<{ pack: ContentPack; result: PublishResult; size: number } | null>(null);

    useEffect(() => {
        // getTanakhFirestore עלול לזרוק סינכרונית (סביבה בלי הגדרות), ולכן try
        (async () => {
            try {
                setMeta(await loadPublishMeta());
            } catch {
                setMeta(null);
            }
        })();
    }, []);

    // איזה ערכים ייכנסו, וכמה מהם לא תקינים
    const candidates = useMemo(() => entries.filter(e => preview || e.visible), [entries, preview]);
    const blocking = useMemo(() => {
        const ctx = { entryIds: new Set(entries.map(e => e.id)), categoryKeys: new Set(categories.map(c => c.key)) };
        return candidates
            .map(e => ({ entry: e, errors: validateEntry(e, ctx).filter(i => i.level === "error") }))
            .filter(x => x.errors.length > 0);
    }, [candidates, entries, categories]);

    // בניית הקובץ מחדש כשמשנים ערוץ
    useEffect(() => { setBuilt(null); }, [preview]);

    function build() {
        const result = buildContentPack(entries, categories, {
            preview,
            previousVersion: meta?.version ?? 0,
            lang: "he",
        });
        setBuilt({ pack: result.pack, result, size: packSize(result.pack) });
    }

    const storage = isStorageEnabled();

    return (
        <div style={{ ...ts.card, gap: 12 }}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h3 style={ts.cardTitle}>פרסום לאפליקציה</h3>
                <button style={ts.secondaryBtn} onClick={onClose}>חזרה לערכים</button>
            </div>

            {/* ── מצב הפרסום האחרון ─────────────────────────────────────── */}
            <div style={{ ...ts.banner, ...ts.bannerInfo }}>
                {meta === undefined ? "בודק מה פורסם…"
                    : meta === null ? "עוד לא פורסם קובץ תוכן. הפרסום הראשון ייצור גרסה 1."
                    : <>פורסם לאחרונה: <b>גרסה {meta.version}</b> · {new Date(meta.publishedAt).toLocaleString("he-IL")}
                        {meta.publishedBy ? ` · ${meta.publishedBy}` : ""} · {meta.entryCount} ערכים</>}
            </div>

            {/* ── ערוץ ─────────────────────────────────────────────────── */}
            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>ערוץ</h4>
                <div style={{ ...ts.row, gap: 6 }}>
                    <button style={{ ...ts.chip, cursor: "pointer", ...(preview ? {} : ts.chipActive) }} onClick={() => setPreview(false)}>
                        חי – רק ערכים מוצגים
                    </button>
                    <button style={{ ...ts.chip, cursor: "pointer", ...(preview ? ts.chipActive : {}) }} onClick={() => setPreview(true)}>
                        תצוגה מקדימה – כולל מוסתרים
                    </button>
                </div>
                <p style={ts.hint}>
                    הערוץ החי הוא מה שהקוראים מקבלים. תצוגה מקדימה כוללת גם ערכים מוסתרים, והיא
                    מיועדת לבדיקה באפליקציה לפני שמסמנים "מוצג באפליקציה".
                </p>
            </section>

            {/* ── מה ייכנס ──────────────────────────────────────────────── */}
            <section style={ts.section}>
                <h4 style={ts.sectionTitle}>מה ייכנס לקובץ</h4>
                <div style={{ ...ts.row, gap: 16 }}>
                    <Stat label="ערכים" value={candidates.length} />
                    <Stat label={preview ? "כולל מוסתרים" : "מוסתרים – לא ייכנסו"} value={entries.length - candidates.length} />
                    <Stat label="שגיאות אימות" value={blocking.length} tone={blocking.length ? RED : GREEN} />
                </div>

                {blocking.length > 0 && (
                    <div style={{ ...ts.banner, ...ts.bannerError }}>
                        <b>{blocking.length} ערכים עם שגיאת אימות – לא מפרסמים עד שיתוקנו:</b>
                        <ul style={{ margin: "6px 0", paddingInlineStart: 22 }}>
                            {blocking.slice(0, 10).map(({ entry, errors }) => (
                                <li key={entry.id}>{entry.title.he || entry.id} ({entry.id}): {errors[0].message}</li>
                            ))}
                            {blocking.length > 10 && <li>ועוד {blocking.length - 10}…</li>}
                        </ul>
                    </div>
                )}

                <div style={ts.row}>
                    <button style={ts.primaryBtn} onClick={build} disabled={busy || blocking.length > 0}>
                        בניית קובץ התוכן
                    </button>
                    {built && <span style={ts.muted}>נבנה: {formatBytes(built.size)} · גרסה {built.pack.version}</span>}
                </div>
            </section>

            {/* ── תוצאת הבנייה ──────────────────────────────────────────── */}
            {built && (
                <section style={ts.section}>
                    <h4 style={ts.sectionTitle}>הקובץ</h4>
                    <div style={{ ...ts.row, gap: 16 }}>
                        <Stat label="ערכים" value={built.result.included} />
                        <Stat label="מיקומים" value={built.result.stats.locations} />
                        <Stat label="תמונות" value={built.result.stats.images} />
                        <Stat label="קישורים מהפסוקים" value={built.result.stats.anchors} />
                        <Stat label="פסוקי פתיחה" value={built.result.stats.quotes} />
                        <Stat label="הפניות" value={built.result.stats.redirects} />
                    </div>

                    {built.result.warnings.length > 0 && (
                        <div style={{ ...ts.banner, ...ts.bannerWarn }}>
                            <b>{built.result.warnings.length} אזהרות – לא חוסמות:</b>
                            <ul style={{ margin: "6px 0", paddingInlineStart: 22, maxHeight: 180, overflowY: "auto" }}>
                                {built.result.warnings.slice(0, 20).map((w, i) => (
                                    <li key={i}>{w.title || w.entryId}: {w.message}</li>
                                ))}
                                {built.result.warnings.length > 20 && <li>ועוד {built.result.warnings.length - 20}…</li>}
                            </ul>
                        </div>
                    )}

                    <div style={{ ...ts.row, gap: 8 }}>
                        <button style={ts.secondaryBtn} onClick={() => downloadPack(built.pack, packFileName(preview))}>
                            הורדת הקובץ
                        </button>
                        <button
                            style={{ ...ts.successBtn, ...(busy || !storage ? ts.btnDisabled : {}) }}
                            disabled={busy || !storage}
                            title={storage ? "" : "דורש Firebase Storage"}
                            onClick={() => void onPublish(built.pack, built.result)}
                        >
                            {preview ? "העלאת תצוגה מקדימה" : "פרסום לאפליקציה"}
                        </button>
                        {!storage && (
                            <span style={ts.muted}>
                                ההעלאה תיפתח כשיופעל Firebase Storage בפרויקט (מצריך תוכנית Blaze).
                                עד אז אפשר להוריד את הקובץ ולבדוק אותו.
                            </span>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: tone }}>{value}</span>
            <span style={ts.muted}>{label}</span>
        </div>
    );
}
