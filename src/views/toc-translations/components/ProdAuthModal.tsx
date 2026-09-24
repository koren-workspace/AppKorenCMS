/**
 * ProdAuthModal – כניסה חד-פעמית לפרויקט Firebase Production
 *
 * מוצג כשמשתמש לוחץ "שמור לפרוד" / "פרסם לפרוד" לראשונה בסשן.
 * לאחר כניסה מוצלחת, Firebase Auth שומר את ה-session (AUTH_PERSISTENCE)
 * ולא יתבקש שוב עד לסגירת הטאב.
 */

import React, { useEffect, useRef, useState } from "react";
import { signInToProd } from "../services/prodAuthService";

export type ProdAuthModalProps = {
    open: boolean;
    /** כתובת המייל של המשתמש המחובר כרגע (Stage) – מוצגת read-only */
    email: string;
    onSuccess: () => void;
    onClose: () => void;
    /** מאפשר החלפת מנגנון הזדהות בבדיקות E2E */
    authenticate?: (email: string, password: string) => Promise<void>;
    /** טקסטים חלופיים – כשהמודל משמש לפרויקט אחר (למשל התנ"ך למטייל) */
    title?: string;
    subtitle?: React.ReactNode;
    /** שם הסביבה בהודעת "משתמש לא קיים" (ברירת מחדל: "בפרוד") */
    envLabel?: string;
    /** כשמוגדר – מוצג קישור "שכחתי סיסמה" ששולח מייל לקביעת סיסמה חדשה */
    resetPassword?: (email: string) => Promise<void>;
};

export function ProdAuthModal({
    open,
    email,
    onSuccess,
    onClose,
    authenticate,
    title,
    subtitle,
    envLabel = "בפרוד",
    resetPassword,
}: ProdAuthModalProps) {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetNote, setResetNote] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setPassword("");
            setError(null);
            setResetNote(null);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    if (!open) return null;

    async function handleReset() {
        if (!resetPassword) return;
        setError(null);
        setResetNote(null);
        setLoading(true);
        try {
            await resetPassword(email);
            setResetNote(`נשלח מייל ל-${email} עם קישור לקביעת סיסמה חדשה. אם הוא לא מגיע תוך כמה דקות, כדאי לבדוק בספאם.`);
        } catch (err: any) {
            const code: string = err?.code ?? "";
            setError(code.includes("too-many-requests")
                ? "יותר מדי בקשות. נסה שוב מאוחר יותר."
                : `שליחת המייל נכשלה: ${err?.message ?? code}`);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await (authenticate ?? signInToProd)(email, password);
            onSuccess();
        } catch (err: any) {
            const code: string = err?.code ?? "";
            if (code.includes("wrong-password") || code.includes("invalid-credential")) {
                setError("סיסמה שגויה – נסה שוב.");
            } else if (code.includes("user-not-found")) {
                setError(`משתמש לא קיים ${envLabel} עם מייל זה.`);
            } else if (code.includes("too-many-requests")) {
                setError("יותר מדי ניסיונות. נסה שוב מאוחר יותר.");
            } else {
                setError(`שגיאה: ${err?.message ?? code}`);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>{title ?? "כניסה לסביבת Production"}</h3>
                <p style={styles.subtitle}>
                    {subtitle ?? (
                        <>
                            כדי לשמור לפרוד, יש להתאמת עם פרויקט Production.
                            <br />
                            הכניסה תישמר עד לסגירת הטאב.
                        </>
                    )}
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <label style={styles.label}>
                        מייל
                        <input
                            style={{ ...styles.input, background: "#f5f5f5", color: "#888" }}
                            type="email"
                            value={email}
                            readOnly
                            tabIndex={-1}
                        />
                    </label>

                    <label style={styles.label}>
                        סיסמה
                        <input
                            ref={inputRef}
                            style={styles.input}
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="הזן סיסמה..."
                            autoComplete="current-password"
                            disabled={loading}
                        />
                    </label>

                    {resetPassword && (
                        <button type="button" style={styles.linkBtn} onClick={() => void handleReset()} disabled={loading}>
                            שכחתי סיסמה / שינוי סיסמה
                        </button>
                    )}

                    {error && <p style={styles.error}>{error}</p>}
                    {resetNote && <p style={styles.note}>{resetNote}</p>}

                    <div style={styles.buttons}>
                        <button
                            type="button"
                            style={styles.cancelBtn}
                            onClick={onClose}
                            disabled={loading}
                        >
                            ביטול
                        </button>
                        <button
                            type="submit"
                            style={styles.submitBtn}
                            disabled={loading || !password}
                        >
                            {loading ? "מתחבר..." : "התחבר"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
    },
    modal: {
        background: "#fff",
        borderRadius: 10,
        padding: "28px 32px",
        minWidth: 340,
        maxWidth: 420,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        direction: "rtl",
    },
    title: {
        margin: "0 0 6px",
        fontSize: 18,
        fontWeight: 700,
        color: "#1a1a2e",
    },
    subtitle: {
        margin: "0 0 20px",
        fontSize: 13,
        color: "#555",
        lineHeight: 1.5,
    },
    form: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
    },
    label: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 13,
        fontWeight: 600,
        color: "#333",
    },
    input: {
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "8px 10px",
        fontSize: 14,
        outline: "none",
        direction: "ltr",
    },
    error: {
        margin: 0,
        color: "#d32f2f",
        fontSize: 13,
    },
    note: {
        margin: 0,
        color: "#2e7d32",
        fontSize: 13,
        lineHeight: 1.5,
    },
    linkBtn: {
        alignSelf: "flex-start",
        margin: "-6px 0 0",
        padding: 0,
        border: "none",
        background: "none",
        color: "#1565c0",
        fontSize: 13,
        cursor: "pointer",
        textDecoration: "underline",
    },
    buttons: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 6,
    },
    cancelBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
    },
    submitBtn: {
        padding: "8px 20px",
        borderRadius: 6,
        border: "none",
        background: "#1565c0",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
};
