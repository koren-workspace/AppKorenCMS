/**
 * PublishConfirmModal – אישור לפני פרסום נוסח לבייגל (סטייג' / פרוד)
 */

import React from "react";

export type PublishEnvironment = "stage" | "prod";

export type PublishConfirmModalProps = {
    open: boolean;
    environment: PublishEnvironment;
    nusachLabel?: string | null;
    saving?: boolean;
    onConfirm: () => void;
    onClose: () => void;
};

export function PublishConfirmModal({
    open,
    environment,
    nusachLabel,
    saving = false,
    onConfirm,
    onClose,
}: PublishConfirmModalProps) {
    if (!open) return null;

    const isProd = environment === "prod";
    const envLabel = isProd ? "פרוד" : "סטייג'";
    const trimmedNusach = nusachLabel?.trim() ?? "";
    const nusachText = trimmedNusach.length > 0 ? `«${trimmedNusach}»` : "הנוסח הנבחר";

    return (
        <div style={styles.overlay} onClick={saving ? undefined : onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h3 style={styles.title}>אישור פרסום · {envLabel}</h3>
                <p style={styles.subtitle}>
                    לפרסם את {nusachText} לבייגל של <strong>{envLabel}</strong>?
                </p>
                <p style={styles.detail}>
                    {isProd
                        ? "האפליקציה בפרוד תסנכרן את כל התרגומים של נוסח זה. פעולה זו משפיעה על משתמשים אמיתיים."
                        : "האפליקציה בסטייג' תסנכרן את כל התרגומים של נוסח זה."}
                </p>

                <div style={styles.buttons}>
                    <button
                        type="button"
                        style={styles.cancelBtn}
                        onClick={onClose}
                        disabled={saving}
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        style={{
                            ...styles.confirmBtn,
                            background: isProd ? "#1565c0" : "#2e7d32",
                        }}
                        onClick={onConfirm}
                        disabled={saving}
                    >
                        {saving ? "מפרסם…" : `פרסם · ${envLabel}`}
                    </button>
                </div>
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
        maxWidth: 440,
        boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
        direction: "rtl",
    },
    title: {
        margin: "0 0 8px",
        fontSize: 18,
        fontWeight: 700,
        color: "#1a1a2e",
    },
    subtitle: {
        margin: "0 0 10px",
        fontSize: 15,
        color: "#333",
        lineHeight: 1.5,
    },
    detail: {
        margin: "0 0 20px",
        fontSize: 13,
        color: "#666",
        lineHeight: 1.5,
    },
    buttons: {
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
    },
    cancelBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer",
        fontSize: 14,
    },
    confirmBtn: {
        padding: "8px 20px",
        borderRadius: 6,
        border: "none",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
};
