/**
 * =============================================================================
 * AppFlagsView – מסך "הגדרות אפליקציה": שלושת דגלי השרת
 * =============================================================================
 *
 * עורך את המסמך `app-config/flags` ב-Firestore, ומשקף כל שמירה ל-Bagel
 * (לאפליקציות הישנות). ראו docs/app-flags.md.
 *
 *   freeEnhancements  המודים חינם / בתשלום. כיבוי = מתחילים לגבות, ושדה
 *                     הקופון מופיע באפליקציה.
 *   minAppVersion     מספר build מינימלי לכל פלטפורמה. מכשיר עם build נמוך
 *                     יותר רואה מסך "חובה לעדכן" חוסם. ריק = אין חסימה.
 *   clearTime         פקודת מחיקה: כל מכשיר שרואה חותמת חדשה מזו ששמר מוחק
 *                     את כל התוכן המקומי ומסנכרן מאפס. כפתור מסוכן – מאחורי
 *                     אישור כפול.
 */

import React, { useEffect, useState } from "react";
import { useAuthController } from "@firecms/core";
import type { AppFlags, FlagsEnv, MirrorResult } from "./app-flags/types";
import { loadFlags, MirrorError, mirrorFlagsToBagel, saveFlags } from "./app-flags/services/flagsService";
import { isProdConfigured } from "../firebase_config";
import { ProdAuthModal } from "./toc-translations/components/ProdAuthModal";
import { isProdAuthenticated } from "./toc-translations/services/prodAuthService";

type Banner = { kind: "info" | "success" | "error"; text: string } | null;

/** מה שהטופס מחזיק – מחרוזות, כדי לאפשר שדה ריק */
type Form = { freeEnhancements: boolean; android: string; ios: string };

function formOf(flags: AppFlags): Form {
    return {
        freeEnhancements: flags.freeEnhancements,
        android: flags.minAppVersion.android?.toString() ?? "",
        ios: flags.minAppVersion.ios?.toString() ?? "",
    };
}

function parseBuild(value: string, label: string): number | null {
    const text = value.trim();
    if (!text) return null;
    if (!/^\d+$/.test(text)) throw new Error(`${label}: חייב להיות מספר שלם (מספר build), או ריק`);
    const n = Number(text);
    if (n <= 0) return null;
    return n;
}

function describeMirror(results: MirrorResult): string {
    return Object.entries(results)
        .map(([collection, status]) => `${collection}: ${status === "ok" ? "עודכן" : "נכשל"}`)
        .join(" · ");
}

export function AppFlagsView() {
    const auth = useAuthController();
    const currentUserEmail = (auth.user as any)?.email ?? "";
    const prodConfigured = isProdConfigured();

    const [env, setEnv] = useState<FlagsEnv>("stage");
    const [flags, setFlags] = useState<AppFlags | null | undefined>(undefined); // undefined = טוען
    const [loadError, setLoadError] = useState<string | null>(null);
    const [form, setForm] = useState<Form>({ freeEnhancements: false, android: "", ios: "" });
    const [banner, setBanner] = useState<Banner>(null);
    const [busy, setBusy] = useState(false);
    const [prodAuthOpen, setProdAuthOpen] = useState(false);
    /** true אחרי שמירה שנכתבה ל-Firestore אבל השיקוף ל-Bagel נכשל */
    const [mirrorFailed, setMirrorFailed] = useState(false);

    async function reload(target: FlagsEnv) {
        setFlags(undefined);
        setLoadError(null);
        try {
            const loaded = await loadFlags(target);
            setFlags(loaded);
            if (loaded) setForm(formOf(loaded));
        } catch (err: any) {
            setLoadError(String(err?.message ?? err));
        }
    }

    useEffect(() => {
        void reload("stage");
    }, []);

    function switchEnv(target: FlagsEnv) {
        if (target === env) return;
        if (target === "prod" && !prodConfigured) {
            setBanner({ kind: "error", text: "פרוד לא מוגדר בסביבה הזו (חסרים משתני VITE_PROD_FIREBASE_*)." });
            return;
        }
        if (target === "prod" && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        setEnv(target);
        setBanner(null);
        setMirrorFailed(false);
        void reload(target);
    }

    function onProdAuthSuccess() {
        setProdAuthOpen(false);
        setEnv("prod");
        setBanner(null);
        void reload("prod");
    }

    const isProd = env === "prod";
    const dirty =
        flags !== null &&
        flags !== undefined &&
        (form.freeEnhancements !== flags.freeEnhancements ||
            form.android !== (flags.minAppVersion.android?.toString() ?? "") ||
            form.ios !== (flags.minAppVersion.ios?.toString() ?? ""));

    /** שמירה של הדגלים הרגילים (בלי clearTime – הוא נשמר כפי שהוא) */
    async function onSave() {
        if (!flags || busy) return;
        if (isProd && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        let next: AppFlags;
        try {
            next = {
                clearTime: flags.clearTime,
                freeEnhancements: form.freeEnhancements,
                minAppVersion: { android: parseBuild(form.android, "אנדרואיד"), ios: parseBuild(form.ios, "iOS") },
            };
        } catch (err: any) {
            setBanner({ kind: "error", text: err.message });
            return;
        }
        if (isProd && flags.freeEnhancements && !next.freeEnhancements) {
            if (!window.confirm("לכבות 'מודים חינם' בפרוד? מרגע השמירה המודים בתשלום לכל המשתמשים ושדה הקופון מופיע.")) return;
        }
        await persist(next, "ההגדרות נשמרו");
    }

    /** clearTime = עכשיו. מאחורי אישור כפול, כי זה מוחק תוכן אצל כל המשתמשים. */
    async function onClearContent() {
        if (!flags || busy) return;
        if (isProd && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        const envLabel = isProd ? "פרוד" : "Stage";
        if (!window.confirm(`למחוק את התוכן המקומי אצל כל משתמשי ${envLabel}? כל מכשיר יוריד את כל התוכן מחדש בפתיחה הבאה.`)) return;
        const typed = window.prompt(`לאישור, יש להקליד: ${envLabel}`);
        if (typed?.trim() !== envLabel) {
            setBanner({ kind: "info", text: "בוטל." });
            return;
        }
        await persist({ ...flags, clearTime: Date.now() }, "פקודת המחיקה נשלחה");
    }

    async function persist(next: AppFlags, successText: string) {
        setBusy(true);
        setBanner(null);
        try {
            const results = await saveFlags(env, next, currentUserEmail);
            setFlags(next);
            setForm(formOf(next));
            setMirrorFailed(false);
            setBanner({ kind: "success", text: `${successText} · Bagel: ${describeMirror(results)}` });
        } catch (err: any) {
            if (err instanceof MirrorError) {
                // Firestore כבר נשמר – האפליקציה החדשה רואה את הערך; הישנות לא.
                setFlags(next);
                setForm(formOf(next));
                setMirrorFailed(true);
                setBanner({
                    kind: "error",
                    text: `נשמר ל-Firestore (האפליקציה החדשה רואה את הערך), אבל השיקוף ל-Bagel נכשל (${err.message}${
                        Object.keys(err.results).length ? " · " + describeMirror(err.results) : ""
                    }). האפליקציות הישנות עדיין עם הערך הקודם – ראו "שליחה חוזרת ל-Bagel" למטה.`,
                });
            } else {
                setBanner({ kind: "error", text: `שגיאה בשמירה: ${err?.message ?? err}` });
            }
        } finally {
            setBusy(false);
        }
    }

    /** שיקוף חוזר של הערכים השמורים ל-Bagel, בלי לשנות את Firestore */
    async function onRemirror() {
        if (!flags || busy) return;
        if (isProd && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        setBusy(true);
        setBanner(null);
        try {
            const results = await mirrorFlagsToBagel(env, flags);
            setMirrorFailed(false);
            setBanner({ kind: "success", text: `Bagel עודכן · ${describeMirror(results)}` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `השיקוף נכשל: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>הגדרות אפליקציה</h2>
                    <p style={styles.subtitle}>
                        שלושת דגלי השרת · נשמרים ב-Firestore ומשוקפים אוטומטית ל-Bagel · Bagel לא נערך ידנית
                    </p>
                </div>
                <div style={styles.envSwitch}>
                    <button style={{ ...styles.envBtn, ...(env === "stage" ? styles.envBtnActive : {}) }} onClick={() => switchEnv("stage")}>
                        Stage
                    </button>
                    <button
                        style={{ ...styles.envBtn, ...(env === "prod" ? { ...styles.envBtnActive, background: "#c62828" } : {}) }}
                        onClick={() => switchEnv("prod")}
                        title={prodConfigured ? undefined : "פרוד לא מוגדר בסביבה הזו"}
                    >
                        פרוד{prodConfigured ? "" : " (לא מוגדר)"}
                    </button>
                </div>
            </div>

            {isProd && (
                <div style={{ ...styles.banner, background: "#fdecea", color: "#c62828" }}>
                    סביבת פרוד – כל שינוי כאן משפיע מיד על כל המשתמשים, בגרסה החדשה ובישנות.
                </div>
            )}
            {banner && (
                <div
                    style={{
                        ...styles.banner,
                        background: banner.kind === "error" ? "#fdecea" : banner.kind === "success" ? "#e8f5e9" : "#e3f2fd",
                        color: banner.kind === "error" ? "#c62828" : banner.kind === "success" ? "#2e7d32" : "#1565c0",
                    }}
                >
                    {banner.text}
                </div>
            )}

            {loadError && <p style={{ color: "#d32f2f" }}>שגיאה בטעינה: {loadError}</p>}
            {flags === undefined && !loadError && <p>טוען...</p>}
            {flags === null && (
                <div style={styles.card}>
                    <p style={{ margin: 0 }}>
                        המסמך <code style={styles.code}>app-config/flags</code> עדיין לא קיים בסביבה הזו. יוצרים אותו פעם אחת
                        מהערכים הנוכחיים ב-Bagel: <code style={styles.code}>node tools/migrate-flags.mjs --env {env} --write</code>{" "}
                        (בריפו koren-tefilla), ואז "רענון".
                    </p>
                    <button style={styles.secondaryBtn} onClick={() => void reload(env)}>
                        רענון
                    </button>
                </div>
            )}

            {flags && (
                <>
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>מודים</h3>
                        <div style={styles.radioGroup}>
                            <label style={{ ...styles.radioOption, ...(form.freeEnhancements ? styles.radioOptionActive : {}) }}>
                                <input
                                    type="radio"
                                    name="freeEnhancements"
                                    checked={form.freeEnhancements}
                                    onChange={() => setForm(f => ({ ...f, freeEnhancements: true }))}
                                    style={styles.radioInput}
                                />
                                <span>
                                    <b>חינם</b>
                                    <br />
                                    <span style={styles.radioHint}>כל מוד נפתח בלי תשלום. שדה הקופון מוסתר.</span>
                                </span>
                            </label>
                            <label style={{ ...styles.radioOption, ...(!form.freeEnhancements ? styles.radioOptionActive : {}) }}>
                                <input
                                    type="radio"
                                    name="freeEnhancements"
                                    checked={!form.freeEnhancements}
                                    onChange={() => setForm(f => ({ ...f, freeEnhancements: false }))}
                                    style={styles.radioInput}
                                />
                                <span>
                                    <b>בתשלום</b>
                                    <br />
                                    <span style={styles.radioHint}>המודים נקנים בחנות. שדה הקופון מופיע.</span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>גרסה מינימלית (minAppVersion)</h3>
                        <p style={styles.hint}>
                            מספר build. מכשיר עם build נמוך יותר רואה מסך "חובה לעדכן" חוסם. ריק = אין חסימה.
                        </p>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <label style={styles.field}>
                                אנדרואיד
                                <input
                                    style={{ ...styles.input, direction: "ltr" }}
                                    value={form.android}
                                    onChange={e => setForm(f => ({ ...f, android: e.target.value }))}
                                    placeholder="למשל 10106"
                                />
                            </label>
                            <label style={styles.field}>
                                iOS
                                <input
                                    style={{ ...styles.input, direction: "ltr" }}
                                    value={form.ios}
                                    onChange={e => setForm(f => ({ ...f, ios: e.target.value }))}
                                    placeholder="למשל 10106"
                                />
                            </label>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
                        <button style={{ ...styles.primaryBtn, opacity: !dirty || busy ? 0.5 : 1 }} disabled={!dirty || busy} onClick={() => void onSave()}>
                            {busy ? "שומר..." : `שמירה ל-${isProd ? "פרוד" : "Stage"}`}
                        </button>
                        <button style={styles.secondaryBtn} disabled={busy} onClick={() => void reload(env)}>
                            רענון
                        </button>
                    </div>

                    {mirrorFailed && (
                        <div style={{ ...styles.card, borderColor: "#f9a825", background: "#fffde7" }}>
                            <h3 style={styles.cardTitle}>שליחה חוזרת ל-Bagel</h3>
                            <p style={styles.hint}>
                                השמירה האחרונה נכתבה ל-Firestore אבל לא הגיעה ל-Bagel, ולכן האפליקציות הישנות עדיין עם הערך הקודם.
                                הכפתור שולח שוב את הערכים השמורים, בלי לשנות כלום. אם זה נכשל שוב, הבעיה ב-Bagel או בטוקן שבשרת.
                            </p>
                            <button style={{ ...styles.primaryBtn, background: "#f9a825", color: "#000", alignSelf: "flex-start" }} disabled={busy} onClick={() => void onRemirror()}>
                                שליחה חוזרת ל-Bagel
                            </button>
                        </div>
                    )}

                    <div style={{ ...styles.card, borderColor: "#c62828" }}>
                        <h3 style={{ ...styles.cardTitle, color: "#c62828" }}>מחיקת תוכן מקומי (clearTime)</h3>
                        <p style={styles.hint}>
                            שליחה מציבה חותמת זמן חדשה. כל מכשיר שיפתח את האפליקציה ימחק את כל התוכן המקומי ויסנכרן מאפס. משתמשים
                            עם חיבור איטי ירגישו בזה. פעולה חד-פעמית, אין "ביטול".
                        </p>
                        <p style={styles.hint}>
                            נשלח לאחרונה:{" "}
                            {flags.clearTime ? new Date(flags.clearTime).toLocaleString("he-IL") : "אף פעם"}
                        </p>
                        <button style={{ ...styles.primaryBtn, background: "#c62828" }} disabled={busy} onClick={() => void onClearContent()}>
                            מחיקת תוכן אצל כל המשתמשים ({isProd ? "פרוד" : "Stage"})
                        </button>
                    </div>
                </>
            )}

            <ProdAuthModal open={prodAuthOpen} email={currentUserEmail} onSuccess={onProdAuthSuccess} onClose={() => setProdAuthOpen(false)} />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: { direction: "rtl", padding: "20px 24px 60px", maxWidth: 900, margin: "0 auto", fontFamily: "inherit" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 12 },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    subtitle: { margin: "4px 0 0", fontSize: 13, color: "#666" },
    envSwitch: { display: "flex", gap: 6 },
    envBtn: { padding: "8px 18px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", color: "#444", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    envBtnActive: { background: "#1565c0", color: "#fff", borderColor: "transparent" },
    banner: { borderRadius: 6, padding: "10px 14px", fontSize: 14, marginBottom: 12 },
    card: { border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", background: "#fff", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
    radioGroup: { display: "flex", gap: 12, flexWrap: "wrap" },
    radioOption: { flex: "1 1 240px", display: "flex", alignItems: "flex-start", gap: 10, border: "2px solid #e0e0e0", borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 14, lineHeight: 1.5 },
    radioOptionActive: { borderColor: "#1565c0", background: "#e3f2fd" },
    radioInput: { width: 18, height: 18, marginTop: 4, cursor: "pointer" },
    radioHint: { fontSize: 12, color: "#555" },
    field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#444", minWidth: 200 },
    input: { border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", fontSize: 14, fontWeight: 400 },
    code: { fontSize: 11, background: "#f0f0f0", borderRadius: 4, padding: "1px 6px", direction: "ltr" },
    hint: { fontSize: 12, color: "#777", margin: 0 },
    primaryBtn: { padding: "8px 18px", borderRadius: 6, border: "none", background: "#2e7d32", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    secondaryBtn: { border: "1px solid #ccc", background: "#fff", borderRadius: 5, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#555" },
};
