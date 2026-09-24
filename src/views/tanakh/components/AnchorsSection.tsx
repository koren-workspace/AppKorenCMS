/**
 * AnchorsSection – הקישורים מטקסט התנ"ך אל הערך.
 *
 * עוגן הוא פסוק (ואופציונלית מילה בתוכו) שבאפליקציה מקבל סימון, ולחיצה עליו
 * פותחת את הערך. בתוכן הקיים זה מה שיושב ב-anchors.json; כאן זה חלק מהערך.
 */

import React, { useMemo, useState } from "react";
import type { Anchor } from "../model/types";
import { isValidVerseRef, parseHebrewRef } from "../model/tanakhBooks";
import { formatVerseRef } from "../model/hebnum";
import type { ValidationIssue } from "../model/validate";
import { RED, ts } from "./tanakhStyles";

export interface AnchorsSectionProps {
    anchors: Anchor[];
    onChange: (anchors: Anchor[]) => void;
    issues: ValidationIssue[];
    disabled?: boolean;
}

export function AnchorsSection({ anchors, onChange, issues, disabled }: AnchorsSectionProps) {
    const [refText, setRefText] = useState("");
    const [word, setWord] = useState("");

    const parsed = useMemo(() => {
        const r = parseHebrewRef(refText);
        if (!r.book || !r.ch || !r.v) return null;
        return { book: r.book, ch: r.ch, v: r.v } as Anchor;
    }, [refText]);
    const valid = parsed ? isValidVerseRef(parsed) : false;
    const duplicate = Boolean(parsed && anchors.some(a => a.book === parsed.book && a.ch === parsed.ch && a.v === parsed.v && (a.w ?? "") === word.trim()));

    function add() {
        if (!parsed || !valid || duplicate) return;
        const w = word.trim();
        onChange([...anchors, w ? { ...parsed, w } : parsed]);
        setRefText("");
        setWord("");
    }

    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>קישורים מהפסוקים</h4>
                <span style={ts.muted}>{anchors.length ? `${anchors.length} קישורים` : "אין קישורים"}</span>
            </div>
            <p style={ts.hint}>
                פסוקים שבהם הערך יסומן בטקסט התנ"ך באפליקציה, כך שלחיצה עליהם תפתח אותו.
                המילה אינה חובה; בלעדיה מסומן הפסוק כולו. יש להזין את המילה בדיוק כפי שהיא מופיעה בפסוק, בלי ניקוד.
            </p>

            <div style={ts.row}>
                <input
                    id="tlm-anchor-ref"
                    style={{ ...ts.input, flex: 1, borderColor: refText && !valid ? RED : undefined }}
                    placeholder="ספר פרק, פסוק – למשל בראשית יב, ו"
                    value={refText}
                    disabled={disabled}
                    onChange={e => setRefText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                />
                <input
                    id="tlm-anchor-word"
                    style={{ ...ts.input, width: 180 }}
                    placeholder="מילה בפסוק (לא חובה)"
                    value={word}
                    disabled={disabled}
                    onChange={e => setWord(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                />
                <button style={ts.secondaryBtn} onClick={add} disabled={disabled || !valid || duplicate}>הוספה</button>
            </div>
            {refText && !valid && <p style={ts.fieldError}>{parsed ? "הפרק או הפסוק מחוץ לטווח הספר" : "לא זוהה: צריך שם ספר, פרק ופסוק בעברית"}</p>}
            {duplicate && <p style={ts.fieldWarn}>הקישור הזה כבר קיים ברשימה.</p>}

            <div style={{ ...ts.row, gap: 6 }}>
                {anchors.map((a, i) => (
                    <span key={`${a.book}-${a.ch}-${a.v}-${a.w ?? ""}-${i}`} style={{ ...ts.chip, borderColor: isValidVerseRef(a) ? undefined : RED }}>
                        {formatVerseRef(a)}
                        {a.w && <b style={{ color: "#0d47a1" }}>“{a.w}”</b>}
                        <button
                            style={{ ...ts.smallBtn, border: "none", padding: "0 2px" }}
                            disabled={disabled}
                            onClick={() => onChange(anchors.filter((_, j) => j !== i))}
                            title="הסרה"
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>

            {issues.map((iss, k) => (
                <p key={k} style={iss.level === "error" ? ts.fieldError : ts.fieldWarn}>{iss.message}</p>
            ))}
        </section>
    );
}
