/**
 * ImageList – תמונות הערך (שלב 4, חלק ב').
 *
 * לתמונה של ערך יש שני מוצאות, ולכל אחד מהם דרך אחרת להציג אותה:
 *
 * - `baked` – קובץ שיושב בריפו של האפליקציה (assets/content/media/<src>.webp)
 *   ונארז לתוך ה-bundle כדי שיעבוד בלי אינטרנט. אין לו כתובת שלו,
 *   ולכן מוצגת תמונה ממוזערת מתוך public/tanakh-media של ה-CMS עצמו.
 *   הקבצים שם נוצרים בריפו של האפליקציה על ידי `npm run cms-thumbs`.
 * - `storage` – תמונה שהועלתה דרך ה-CMS. יש לה כתובת מלאה, והיא נטענת
 *   ישירות ממנה – בלי שום תחזוקה.
 *
 * תמונה ממוזערת שחסרה (למשל תמונה ארוזה שנוספה והסקריפט עוד לא הורץ)
 * מחזירה את התצוגה למזהה בלבד, כמו קודם, ולא לריבוע שבור.
 *
 * העלאה של תמונה חדשה מקטינה וממירה ל-WebP בדפדפן (utils/imageFile.ts)
 * ואז מעלה ל-Storage. הכפתור מושבת רק אם הפרויקט לא מוגדר.
 *
 * הסרת תמונה מנתקת אותה מהערך בלבד ואינה מוחקת את הקובץ: כך "ביטול
 * שינויים" לא משאיר ערך שמצביע לקובץ שנמחק, ותמונה שנתלתה בטעות על הערך
 * הלא נכון נשארת זמינה לצירוף מ"תמונה קיימת".
 */

import React, { useMemo, useRef, useState } from "react";
import { findImages, MIN_QUERY, type LibraryImage } from "../model/imageLibrary";
import type { EntryImage, Localized } from "../model/types";
import { formatBytes, uploadEntryImage } from "../services/mediaService";
import { ACCEPTED_TYPES } from "../utils/imageFile";
import { ts } from "./tanakhStyles";

/** התמונות הממוזערות ש- `npm run cms-thumbs` כותב אל public/ של ה-CMS */
const THUMB_DIR = "/tanakh-media";

function thumbUrl(img: EntryImage): string {
    return img.kind === "storage" ? img.src : `${THUMB_DIR}/${img.src}.webp`;
}

/** תצוגה מקדימה שנסוגה בשקט למזהה בלבד כשהקובץ חסר */
function Thumb({ img }: { img: EntryImage }) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
        <img
            src={thumbUrl(img)}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            style={{ width: 88, height: 66, objectFit: "cover", borderRadius: 4, background: "#f0f0f0", flexShrink: 0 }}
        />
    );
}

export interface ImageListProps {
    /** מזהה הערך – תיקיית היעד של ההעלאה */
    entryId: string;
    images: EntryImage[];
    /** כל התמונות שכבר קיימות במערכת, לצירוף תמונה שנתלתה על הערך הלא נכון */
    library?: LibraryImage[];
    /** האם Firebase Storage זמין (ראו publishService.isStorageEnabled) */
    storageEnabled?: boolean;
    disabled?: boolean;
    onChange: (next: EntryImage[]) => void;
    /** הודעה למשתמש על תוצאת ההעלאה */
    onNotice?: (kind: "success" | "error", text: string) => void;
}

function ImagePicker({ library, current, onPick }: { library: LibraryImage[]; current: EntryImage[]; onPick: (img: EntryImage) => void }) {
    const [q, setQ] = useState("");
    const matches = useMemo(() => findImages(library, q, current), [q, library, current]);

    return (
        <div style={{ width: "100%", border: "1px solid #eee", borderRadius: 6, padding: 8, marginTop: 8 }}>
            <input
                id="tlm-image-picker"
                style={ts.input}
                placeholder="חיפוש לפי כיתוב, שם ערך או מזהה תמונה"
                value={q}
                onChange={e => setQ(e.target.value)}
                autoFocus
            />
            {q.trim().length >= MIN_QUERY && !matches.length && <p style={ts.muted}>אין תמונה מתאימה</p>}
            {matches.map(row => (
                <div
                    key={row.img.src}
                    style={{ ...ts.listRow, alignItems: "center", gap: 8 }}
                    onClick={() => onPick(row.img)}
                    title="צירוף לערך הזה"
                >
                    <Thumb img={row.img} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div>{row.img.caption?.he || <span style={ts.muted}>בלי כיתוב</span>}</div>
                        <div style={ts.muted}>
                            <span style={ts.code}>{row.img.src}</span> · כרגע ב{row.entryTitle}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function ImageList({ entryId, images, library = [], storageEnabled = false, disabled, onChange, onNotice }: ImageListProps) {
    const [picking, setPicking] = useState(false);
    const [uploading, setUploading] = useState(0);
    const fileRef = useRef<HTMLInputElement | null>(null);

    async function upload(files: FileList | File[]) {
        const list = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (!list.length) {
            onNotice?.("error", "לא נבחרו קובצי תמונה.");
            return;
        }
        setUploading(n => n + list.length);
        const added: EntryImage[] = [];
        for (const file of list) {
            try {
                const { image, prepared } = await uploadEntryImage(entryId, file);
                added.push(image);
                onNotice?.("success", prepared.original
                    ? `הועלה ${file.name} (${formatBytes(prepared.sourceBytes)}).`
                    : `הועלה ${file.name}: הוקטן ל-${prepared.width}×${prepared.height} (${formatBytes(prepared.sourceBytes)} ← ${formatBytes(prepared.blob.size)}).`);
            } catch (err: any) {
                onNotice?.("error", `העלאת ${file.name} נכשלה: ${err?.message ?? err}`);
            } finally {
                setUploading(n => n - 1);
            }
        }
        // התמונות נוספות לטיוטה; הן ייכנסו לערך רק בשמירה
        if (added.length) onChange([...images, ...added]);
    }
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
                <span style={ts.muted}>{images.length}{uploading ? ` · מעלה ${uploading}…` : ""}</span>
            </div>

            {images.length ? (
                <ul style={{ ...ts.list, gap: 8 }}>
                    {images.map((img, i) => (
                        <li key={`${img.src}-${i}`} style={{ ...ts.listRow, cursor: "default", alignItems: "flex-start", flexDirection: "column", gap: 6, border: "1px solid #eee" }}>
                            <div style={{ ...ts.row, width: "100%", justifyContent: "space-between" }}>
                                <div style={{ ...ts.row, gap: 8 }}>
                                    <Thumb img={img} />
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
                <button
                    style={{ ...ts.secondaryBtn, ...(storageEnabled && !disabled && !uploading ? {} : ts.btnDisabled) }}
                    disabled={!storageEnabled || disabled || uploading > 0}
                    title={storageEnabled ? "" : "דורש Firebase Storage"}
                    onClick={() => fileRef.current?.click()}
                >
                    {uploading ? "מעלה…" : "העלאת תמונה"}
                </button>
                <input
                    ref={fileRef}
                    id="tlm-image-upload"
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    multiple
                    style={{ display: "none" }}
                    onChange={e => {
                        if (e.target.files?.length) void upload(e.target.files);
                        e.target.value = "";
                    }}
                />
                {library.length > 0 && (
                    <button style={ts.secondaryBtn} onClick={() => setPicking(v => !v)}>
                        {picking ? "ביטול" : "צירוף תמונה קיימת"}
                    </button>
                )}
                {storageEnabled ? (
                    <span style={ts.muted}>
                        התמונה מוקטנת ומומרת ל-WebP בדפדפן לפני ההעלאה. היא נוספת לטיוטה, ונכנסת לערך
                        בלחיצה על "שמירה".
                    </span>
                ) : (
                    <span style={ts.muted}>
                        העלאה דורשת שהדלי של Firebase Storage יהיה מוגדר במשתני הסביבה של הפרויקט.
                    </span>
                )}
            </div>

            {picking && (
                <ImagePicker
                    library={library}
                    current={images}
                    onPick={img => {
                        // הכיתוב נוסע עם התמונה: הוא נכתב עבורה, לא עבור הערך שהחזיק אותה
                        onChange([...images, { ...img }]);
                        setPicking(false);
                    }}
                />
            )}
        </section>
    );
}
