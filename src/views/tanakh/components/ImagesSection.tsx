/**
 * ImagesSection – תמונות הערך: העלאה ל-Storage, כיתוב בשתי שפות, סדר ומחיקה.
 *
 * שני סוגים:
 *   storage  תמונה שהועלתה כאן. מוצגת בתצוגה מקדימה ואפשר למחוק אותה.
 *   baked    תמונה שנסרקה מהספר ומוטמעת בקוד האפליקציה. אין לה תצוגה מקדימה
 *            כאן (הקובץ לא ב-Storage), אבל אפשר לערוך כיתוב, לסדר ולהסיר.
 */

import React, { useEffect, useRef, useState } from "react";
import type { EntryImage, Localized } from "../model/types";
import type { ValidationIssue } from "../model/validate";
import { deleteEntryImage, imageDownloadUrl, isMediaPath, uploadEntryImage } from "../services/mediaService";
import { ACCEPTED_TYPES, formatBytes } from "../utils/imageFile";
import { ts } from "./tanakhStyles";

export interface ImagesSectionProps {
    entryId: string;
    images: EntryImage[];
    onChange: (images: EntryImage[]) => void;
    issues?: ValidationIssue[];
    disabled?: boolean;
    /** הודעה לרמה העליונה (הצלחה/שגיאה) */
    onNotice?: (kind: "success" | "error", text: string) => void;
}

export function ImagesSection({ entryId, images, onChange, issues = [], disabled, onNotice }: ImagesSectionProps) {
    const fileRef = useRef<HTMLInputElement | null>(null);
    const [busy, setBusy] = useState(0);
    const [dragOver, setDragOver] = useState(false);
    /**
     * קבצים שהועלו בעריכה הנוכחית. רק אותם מוחקים מהאחסון כשמסירים אותם
     * מהרשימה: קובץ שכבר נשמר בערך נשאר, כדי ש"ביטול שינויים" לא ישאיר
     * ערך שמצביע לקובץ שנמחק. קבצים יתומים ינוקו בשלב הפרסום.
     */
    const sessionUploads = useRef<Set<string>>(new Set());

    async function addFiles(files: FileList | File[]) {
        const list = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (!list.length) {
            onNotice?.("error", "לא נבחרו קובצי תמונה.");
            return;
        }
        setBusy(b => b + list.length);
        const added: EntryImage[] = [];
        for (const file of list) {
            try {
                const { image, prepared } = await uploadEntryImage(entryId, file);
                sessionUploads.current.add(image.src);
                added.push(image);
                onNotice?.(
                    "success",
                    prepared.original
                        ? `הועלה ${file.name} (${formatBytes(prepared.sourceBytes)}).`
                        : `הועלה ${file.name}: הוקטן ל-${prepared.width}×${prepared.height} והומר ל-WebP (${formatBytes(prepared.sourceBytes)} ← ${formatBytes(prepared.blob.size)}).`,
                );
            } catch (err: any) {
                onNotice?.("error", `העלאת ${file.name} נכשלה: ${err?.message ?? err}`);
            } finally {
                setBusy(b => b - 1);
            }
        }
        if (added.length) onChange([...images, ...added]);
    }

    function move(index: number, delta: number) {
        const next = [...images];
        const to = index + delta;
        if (to < 0 || to >= next.length) return;
        [next[index], next[to]] = [next[to], next[index]];
        onChange(next);
    }

    async function remove(index: number) {
        const img = images[index];
        const justUploaded = img.kind === "storage" && isMediaPath(img.src) && sessionUploads.current.has(img.src);
        const message = justUploaded
            ? "למחוק את התמונה שהעליתם עכשיו? הקובץ יימחק מהאחסון."
            : img.kind === "storage"
                ? "להסיר את התמונה מהערך? השינוי ייכנס לתוקף בשמירה; הקובץ נשאר באחסון עד לניקוי."
                : "להסיר את התמונה מהערך? הקובץ עצמו נשאר בקוד האפליקציה.";
        if (!window.confirm(message)) return;
        onChange(images.filter((_, i) => i !== index));
        if (!justUploaded) return;
        sessionUploads.current.delete(img.src);
        try {
            await deleteEntryImage(img.src);
        } catch (err: any) {
            onNotice?.("error", `הקובץ הוסר מהערך אך מחיקתו מהאחסון נכשלה: ${err?.message ?? err}`);
        }
    }

    function setCaption(index: number, lang: "he" | "en", value: string) {
        const next = images.map((img, i) => {
            if (i !== index) return img;
            const caption: Localized = { he: img.caption?.he ?? "", ...(img.caption ?? {}) };
            const updated: Localized = { ...caption, [lang]: lang === "he" ? value : value || undefined };
            const empty = !updated.he?.trim() && !updated.en?.trim();
            return { ...img, caption: empty ? undefined : updated };
        });
        onChange(next);
    }

    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>תמונות</h4>
                <span style={ts.muted}>{images.length ? `${images.length} תמונות` : "אין תמונות"}{busy ? ` · מעלה ${busy}…` : ""}</span>
            </div>
            <p style={ts.hint}>
                התמונה הראשונה היא הראשית. התמונות מוקטנות ומומרות ל-WebP לפני ההעלאה, כדי שהאפליקציה תיטען מהר.
                שינוי ברשימה נשמר רק בלחיצה על "שמירה", אבל הקובץ עולה לאחסון מיד.
            </p>

            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    if (!disabled && e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
                }}
                style={{
                    borderWidth: 2,
                    borderStyle: "dashed",
                    borderColor: dragOver ? "#1565c0" : "#ccc",
                    borderRadius: 8,
                    padding: "14px 16px",
                    textAlign: "center",
                    background: dragOver ? "#e3f2fd" : "#fafafa",
                    color: "#666",
                    fontSize: 13,
                }}
            >
                גררו לכאן קובצי תמונה, או{" "}
                <button style={ts.secondaryBtn} disabled={disabled || busy > 0} onClick={() => fileRef.current?.click()}>
                    בחירת קבצים
                </button>
                <input
                    ref={fileRef}
                    id="tlm-image-input"
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    multiple
                    style={{ display: "none" }}
                    onChange={e => {
                        if (e.target.files?.length) void addFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>

            <ul style={{ ...ts.list, gap: 10 }}>
                {images.map((img, i) => (
                    <li
                        key={`${img.src}-${i}`}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "120px minmax(0,1fr) auto",
                            gap: 10,
                            alignItems: "start",
                            borderWidth: 1,
                            borderStyle: "solid",
                            borderColor: "#e0e0e0",
                            borderRadius: 8,
                            padding: 8,
                        }}
                    >
                        <ImageThumb image={img} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                            <div style={{ ...ts.row, gap: 6 }}>
                                <span style={{ ...ts.badge, background: i === 0 ? "#e8f5e9" : "#f0f0f0", color: i === 0 ? "#1b5e20" : "#666" }}>
                                    {i === 0 ? "ראשית" : `תמונה ${i + 1}`}
                                </span>
                                <span style={{ ...ts.badge, background: img.kind === "storage" ? "#e3f2fd" : "#fff3e0", color: img.kind === "storage" ? "#0d47a1" : "#8a4b00" }}>
                                    {img.kind === "storage" ? "הועלתה כאן" : "מהספר הסרוק"}
                                </span>
                                <code style={{ ...ts.code, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{img.src}</code>
                            </div>
                            <input
                                style={ts.input}
                                placeholder="כיתוב (עברית)"
                                value={img.caption?.he ?? ""}
                                disabled={disabled}
                                onChange={e => setCaption(i, "he", e.target.value)}
                            />
                            <input
                                style={{ ...ts.input, ...ts.inputLtr }}
                                placeholder="Caption (English)"
                                value={img.caption?.en ?? ""}
                                disabled={disabled}
                                onChange={e => setCaption(i, "en", e.target.value)}
                            />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <button style={ts.smallBtn} disabled={disabled || i === 0} onClick={() => move(i, -1)} title="העלאה בסדר">↑</button>
                            <button style={ts.smallBtn} disabled={disabled || i === images.length - 1} onClick={() => move(i, 1)} title="הורדה בסדר">↓</button>
                            <button style={{ ...ts.smallBtn, color: "#b71c1c", borderColor: "#e57373" }} disabled={disabled} onClick={() => void remove(i)} title="מחיקה">×</button>
                        </div>
                    </li>
                ))}
            </ul>

            {issues.map((iss, k) => (
                <p key={k} style={iss.level === "error" ? ts.fieldError : ts.fieldWarn}>{iss.message}</p>
            ))}
        </section>
    );
}

/** תצוגה מקדימה. תמונה אפויה אינה ב-Storage ולכן מוצגת כתיבה עם המזהה. */
function ImageThumb({ image }: { image: EntryImage }) {
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (image.kind !== "storage") return;
        let alive = true;
        setUrl(null);
        setFailed(false);
        imageDownloadUrl(image.src)
            .then(u => { if (alive) setUrl(u); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [image.kind, image.src]);

    const box: React.CSSProperties = {
        width: 120,
        height: 90,
        borderRadius: 6,
        background: "#f2f2f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        color: "#888",
        textAlign: "center",
        padding: 4,
        boxSizing: "border-box",
        overflow: "hidden",
    };

    if (image.kind !== "storage") return <div style={box}>תמונה מהספר הסרוק<br />(אין תצוגה כאן)</div>;
    if (failed) return <div style={{ ...box, color: "#b71c1c" }}>הקובץ לא נמצא באחסון</div>;
    if (!url) return <div style={box}>טוען…</div>;
    return <img src={url} alt="" style={{ ...box, objectFit: "cover", display: "block" }} />;
}
