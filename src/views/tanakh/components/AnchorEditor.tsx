/**
 * AnchorEditor – הקישורים מהפסוקים לערך (שלב 4, חלק ב').
 *
 * עוגן = פסוק בתנ"ך שלחיצה עליו באפליקציה מובילה לערך הזה. אופציונלית גם
 * מילה מסוימת בפסוק, שאליה נצמד הקישור; בלי מילה הקישור נצמד למספר הפסוק.
 *
 * העוגנים יושבים בתוך הערך (ולא בקובץ נפרד כמו באפליקציה היום), ולכן מחיקת
 * ערך מוחקת גם את הקישורים אליו.
 */

import React, { useMemo, useState } from "react";
import type { Anchor } from "../model/types";
import { isValidVerseRef, parseHebrewRef, tanakhBook, TANAKH_BOOKS } from "../model/tanakhBooks";
import { formatVerseRef } from "../model/hebnum";
import { ts, RED } from "./tanakhStyles";

const BOOK_ORDER = new Map(TANAKH_BOOKS.map((b, i) => [b.id, i]));

export function sortAnchors(anchors: readonly Anchor[]): Anchor[] {
    return [...anchors].sort((a, b) =>
        (BOOK_ORDER.get(a.book) ?? 99) - (BOOK_ORDER.get(b.book) ?? 99) || a.ch - b.ch || a.v - b.v,
    );
}

/** מפתח לזיהוי כפילות: אותו פסוק ואותה מילה */
export function anchorKey(a: Anchor): string {
    return `${a.book}|${a.ch}|${a.v}|${a.w ?? ""}`;
}

export interface AnchorEditorProps {
    anchors: Anchor[];
    onChange: (next: Anchor[]) => void;
}

export function AnchorEditor({ anchors, onChange }: AnchorEditorProps) {
    const [text, setText] = useState("");
    const [word, setWord] = useState("");

    const parsed = useMemo(() => {
        const r = parseHebrewRef(text);
        return r.book && r.ch && r.v ? ({ book: r.book, ch: r.ch, v: r.v } as Anchor) : null;
    }, [text]);
    const valid = parsed ? isValidVerseRef(parsed) : false;

    const sorted = useMemo(() => sortAnchors(anchors), [anchors]);
    const duplicates = useMemo(() => {
        const seen = new Set<string>();
        const dup = new Set<string>();
        for (const a of anchors) {
            const k = anchorKey(a);
            if (seen.has(k)) dup.add(k);
            seen.add(k);
        }
        return dup;
    }, [anchors]);

    const candidate: Anchor | null = parsed && valid ? { ...parsed, ...(word.trim() ? { w: word.trim() } : {}) } : null;
    const alreadyThere = candidate ? anchors.some(a => anchorKey(a) === anchorKey(candidate)) : false;

    function add() {
        if (!candidate || alreadyThere) return;
        onChange([...anchors, candidate]);
        setText("");
        setWord("");
    }

    function removeAt(target: Anchor) {
        const i = anchors.findIndex(a => a === target);
        onChange(anchors.filter((_, j) => j !== i));
    }

    function setWordOf(target: Anchor, w: string) {
        onChange(anchors.map(a => (a === target ? { ...a, ...(w.trim() ? { w: w.trim() } : { w: undefined }) } : a)));
    }

    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>קישורים מהפסוקים</h4>
                <span style={ts.muted}>{anchors.length} קישורים</span>
            </div>
            <p style={ts.hint}>
                פסוקים שמהם הקורא יגיע לערך הזה. המילה היא לא חובה: בלעדיה הקישור נצמד למספר
                הפסוק. אם מילה מוזנת והיא לא נמצאת בפסוק, האפליקציה נופלת חזרה למספר הפסוק.
                ההשוואה מתעלמת מניקוד וממקפים.
            </p>

            <div style={ts.row}>
                <input
                    id="tlm-anchor-ref"
                    style={{ ...ts.input, flex: 1, minWidth: 180, borderColor: text && !valid ? RED : undefined }}
                    placeholder="ספר פרק, פסוק – למשל: דברים ב, יב"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                />
                <input
                    id="tlm-anchor-word"
                    style={{ ...ts.input, width: 160 }}
                    placeholder="מילה בפסוק (רשות)"
                    value={word}
                    onChange={e => setWord(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
                />
                <button style={ts.secondaryBtn} onClick={add} disabled={!valid || alreadyThere}>הוספה</button>
            </div>
            {text && !valid && <p style={ts.fieldError}>{parsed ? "הפרק או הפסוק מחוץ לטווח הספר" : "לא זוהה: צריך שם ספר, פרק ופסוק בעברית"}</p>}
            {alreadyThere && <p style={ts.fieldWarn}>הקישור הזה כבר קיים ברשימה.</p>}

            {sorted.length > 0 ? (
                <ul style={{ ...ts.list, maxHeight: 260, overflowY: "auto" }}>
                    {sorted.map((a, i) => {
                        const ok = tanakhBook(a.book) && isValidVerseRef(a);
                        return (
                            <li key={`${anchorKey(a)}-${i}`} style={{ ...ts.listRow, cursor: "default", background: duplicates.has(anchorKey(a)) ? "#fff8e1" : undefined }}>
                                <span style={{ flex: 1, color: ok ? undefined : RED }}>
                                    {ok ? formatVerseRef(a) : `${a.book} ${a.ch}:${a.v} (לא תקין)`}
                                </span>
                                <input
                                    style={{ ...ts.input, width: 150, padding: "3px 8px", fontSize: 13 }}
                                    placeholder="מילה בפסוק"
                                    value={a.w ?? ""}
                                    onChange={e => setWordOf(a, e.target.value)}
                                />
                                <button style={ts.smallBtn} onClick={() => removeAt(a)} title="הסרת הקישור">×</button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <span style={ts.muted}>אין קישורים מהפסוקים לערך הזה.</span>
            )}
            {duplicates.size > 0 && <p style={ts.fieldWarn}>יש קישורים כפולים (מסומנים בצהוב) – כדאי להסיר.</p>}
        </section>
    );
}
