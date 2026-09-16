/**
 * BodyPreview – איך גוף הערך ייראה: כותרות משנה, פסקאות, ציטוט מודגש, הערה מדעית.
 * מבוסס על אותה המרה לבלוקים שהפרסום ישתמש בה (body.ts).
 */

import React from "react";
import { bodyToBlocks } from "../model/body";

export function BodyPreview({ body, dir = "rtl" }: { body: string; dir?: "rtl" | "ltr" }) {
    const blocks = bodyToBlocks(body);
    if (!blocks.length) return <p style={{ ...styles.p, color: "#999" }}>(ריק)</p>;
    return (
        <div style={{ ...styles.wrap, direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}>
            {blocks.map((b, i) => {
                switch (b.t) {
                    case "h": return <h4 key={i} style={styles.h}>{b.x}</h4>;
                    case "q": return <blockquote key={i} style={styles.q}>{b.x}</blockquote>;
                    case "sci": return <p key={i} style={styles.sci}>{b.x}</p>;
                    default: return <p key={i} style={styles.p}>{b.x}</p>;
                }
            })}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    wrap: { background: "#fbf8f2", border: "1px solid #eadfcd", borderRadius: 6, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, fontSize: 15, lineHeight: 1.7, minHeight: 80 },
    p: { margin: 0 },
    h: { margin: "6px 0 0", fontSize: 16, fontWeight: 700, color: "#80011F" },
    q: { margin: 0, padding: "4px 12px", borderInlineStart: "3px solid #80011F", fontStyle: "italic", color: "#3a2a2e", background: "#f6ede4", borderRadius: 4 },
    sci: { margin: 0, fontSize: 13, color: "#555", background: "#eef3ee", padding: "6px 10px", borderRadius: 4 },
};
