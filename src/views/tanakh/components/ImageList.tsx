/**
 * ImageList – תמונות הערך (שלב 4, חלק ב').
 *
 * כרגע כל התמונות הן `baked`: קבצים שיושבים בריפו של האפליקציה
 * (assets/content/media/<src>.webp) ונקראים ממנו. אין להן כתובת שאפשר להציג
 * ממנה תצוגה מקדימה ב-CMS, ולכן מוצג המזהה בלבד.
 *
 * העלאת תמונות חדשות דורשת Firebase Storage, שעדיין לא הופעל בפרויקט (מצריך
 * תוכנית Blaze). הכפתור מוצג מושבת עם הסבר, במקום להיעלם – כדי שיהיה ברור
 * שזה שלב שממתין ולא יכולת חסרה.
 */

import React from "react";
import type { EntryImage, Localized } from "../model/types";
import { ts } from "./tanakhStyles";

export interface ImageListProps {
    images: EntryImage[];
    /** האם Firebase Storage מוגדר (כרגע תמיד false – ראו docs/tanakh-lametayel.md) */
    storageEnabled?: boolean;
    onChange: (next: EntryImage[]) => void;
}

export function ImageList({ images, storageEnabled = false, onChange }: ImageListProps) {
    function patch(i: number, next: Partial<EntryImage>) {
        onChange(images.map((img, j) => (j === i ? { ...img, ...next } : img)));
    }
    function setCaption(i: number, lang: "he" | "en", text: string) {
        const current: Localized = images[i].caption ?? { he: "" };
        const caption: Localized = { ...current, [lang]: lang === "he" ? text : text || undefined };
        patch(i, { caption: caption.he || caption.en ? caption : undefined });
    }
    function move(i: number, delta: number) {
        const j = i + delta;
        if (j < 0 || j >= images.length) return;
        const next = [...images];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
    }
    function remove(i: number) {
        if (!window.confirm(`להסיר את התמונה "${images[i].src}" מהערך? הקובץ עצמו לא נמחק.`)) return;
        onChange(images.filter((_, j) => j !== i));
    }

    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>תמונות</h4>
                <span style={ts.muted}>{images.length}</span>
            </div>

            {images.length ? (
                <ul style={{ ...ts.list, gap: 8 }}>
                    {images.map((img, i) => (
                        <li key={`${img.src}-${i}`} style={{ ...ts.listRow, cursor: "default", alignItems: "flex-start", flexDirection: "column", gap: 6, border: "1px solid #eee" }}>
                            <div style={{ ...ts.row, width: "100%", justifyContent: "space-between" }}>
                                <div style={{ ...ts.row, gap: 8 }}>
                                    <span style={ts.code}>{img.src}</span>
                                    <span style={{ ...ts.badge, background: img.kind === "baked" ? "#eceff1" : "#e3f2fd", color: "#455a64" }}>
                                        {img.kind === "baked" ? "בקובצי האפליקציה" : "ב-Storage"}
                                    </span>
                                </div>
                                <div style={{ ...ts.row, gap: 4 }}>
                                    <button style={ts.smallBtn} onClick={() => move(i, -1)} disabled={i === 0} title="העלאה למעלה">↑</button>
                                    <button style={ts.smallBtn} onClick={() => move(i, 1)} disabled={i === images.length - 1} title="הורדה למטה">↓</button>
                                    <button style={ts.smallBtn} onClick={() => remove(i)} title="הסרה מהערך">×</button>
                                </div>
                            </div>
                            <div style={{ ...ts.twoCol, width: "100%" }}>
                                <label style={ts.label}>
                                    כיתוב (עברית)
                                    <input style={ts.input} value={img.caption?.he ?? ""} onChange={e => setCaption(i, "he", e.target.value)} />
                                </label>
                                <label style={ts.label}>
                                    Caption (English)
                                    <input style={{ ...ts.input, ...ts.inputLtr }} value={img.caption?.en ?? ""} onChange={e => setCaption(i, "en", e.target.value)} />
                                </label>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <span style={ts.muted}>אין תמונות בערך הזה.</span>
            )}

            <div style={{ ...ts.row, gap: 8 }}>
                <button style={ts.secondaryBtn} disabled={!storageEnabled} title={storageEnabled ? "" : "דורש Firebase Storage"}>
                    העלאת תמונה
                </button>
                {!storageEnabled && (
                    <span style={ts.muted}>
                        העלאה תיפתח כשיופעל Firebase Storage בפרויקט (מצריך תוכנית Blaze). עד אז אפשר
                        לערוך כיתובים, לשנות סדר ולהסיר תמונות; הקבצים עצמם יושבים בריפו של האפליקציה.
                    </span>
                )}
            </div>
        </section>
    );
}
