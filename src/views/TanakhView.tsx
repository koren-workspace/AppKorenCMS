/**
 * =============================================================================
 * TanakhView – מסך "התנ"ך למטייל"
 * =============================================================================
 *
 * שלב 1 (תשתית): המסך מתחבר לפרויקט Firebase הנפרד של התנ"ך למטייל ומראה
 * את מצב החיבור וכמות הערכים. מסכי העריכה, התרגום והפרסום נבנים מעליו
 * בשלבים הבאים. ראו docs/tanakh-lametayel.md.
 *
 * זרימה: אם חסרים משתני סביבה – רשימה של מה חסר. אחרת, אם לא מחוברים –
 * מודל סיסמה (אותו מייל כמו ב-CMS, סיסמה של פרויקט התנ"ך). כשמחוברים –
 * פרטי הפרויקט וספירת המסמכים בקולקציית `entries`.
 */

import React, { useEffect, useState } from "react";
import { useAuthController } from "@firecms/core";
import { collection, getCountFromServer } from "firebase/firestore";
import type { User } from "firebase/auth";
import { isTanakhConfigured, missingTanakhEnvVars, tanakhProjectId, tanakhStorageBucket } from "../firebase_config";
import { ProdAuthModal } from "./toc-translations/components/ProdAuthModal";
import {
    getTanakhFirestore,
    onTanakhAuthChanged,
    signInToTanakh,
    signOutOfTanakh,
} from "./tanakh/services/tanakhAuthService";

/** קולקציית הערכים בפרויקט התנ"ך (מוגדרת במלואה בשלב 2) */
export const TANAKH_ENTRIES_COLLECTION = "entries";

type Banner = { kind: "info" | "success" | "error"; text: string } | null;

export function TanakhView() {
    const auth = useAuthController();
    const currentUserEmail = (auth.user as any)?.email ?? "";
    const configured = isTanakhConfigured();

    /** undefined = Firebase עוד לא החזיר את מצב הסשן */
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [authOpen, setAuthOpen] = useState(false);
    const [entryCount, setEntryCount] = useState<number | null>(null);
    const [banner, setBanner] = useState<Banner>(null);

    // מעקב אחרי כניסה/יציאה לפרויקט התנ"ך (כולל שחזור סשן בטעינת הדף)
    useEffect(() => {
        if (!configured) return;
        return onTanakhAuthChanged(u => {
            setUser(u);
            if (!u) {
                setEntryCount(null);
                setAuthOpen(true);
            }
        });
    }, [configured]);

    // כשמחוברים – ספירת הערכים
    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            try {
                const snap = await getCountFromServer(collection(getTanakhFirestore(), TANAKH_ENTRIES_COLLECTION));
                if (!cancelled) setEntryCount(snap.data().count);
            } catch (err: any) {
                if (!cancelled) setBanner({ kind: "error", text: `החיבור הצליח, אבל קריאת Firestore נכשלה: ${err?.message ?? err}. בדקו את חוקי האבטחה (docs/tanakh-lametayel.md).` });
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    async function onSignOut() {
        await signOutOfTanakh();
        setBanner({ kind: "info", text: "התנתקתם מפרויקט התנ\"ך. הכניסה ל-CMS עצמו לא השתנתה." });
    }

    if (!configured) {
        return (
            <div style={styles.page}>
                <Header />
                <div style={{ ...styles.banner, background: "#fff3e0", color: "#8a4b00" }}>
                    פרויקט התנ"ך למטייל לא מוגדר בסביבה הזו. חסרים משתני הסביבה הבאים
                    (ב-Vercel, או ב-<code style={styles.code}>.env.local</code> בפיתוח):
                    <ul style={styles.list}>
                        {missingTanakhEnvVars().map(name => (
                            <li key={name}><code style={styles.code}>{name}</code></li>
                        ))}
                    </ul>
                    הערכים נמצאים בקונסולת Firebase של הפרויקט, Project settings ← Your apps ← SDK setup.
                    הוראות מלאות ב-<code style={styles.code}>docs/tanakh-lametayel.md</code>.
                </div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <Header />

            {banner && (
                <div style={{
                    ...styles.banner,
                    background: banner.kind === "error" ? "#fdecea" : banner.kind === "success" ? "#e8f5e9" : "#e3f2fd",
                    color: banner.kind === "error" ? "#b71c1c" : banner.kind === "success" ? "#1b5e20" : "#0d47a1",
                }}>
                    {banner.text}
                </div>
            )}

            <div style={styles.card}>
                <h3 style={styles.cardTitle}>חיבור לפרויקט</h3>
                <Row label="פרויקט Firebase"><code style={styles.code}>{tanakhProjectId()}</code></Row>
                <Row label="Storage"><code style={styles.code}>{tanakhStorageBucket() || "—"}</code></Row>
                <Row label="מצב">
                    {user === undefined ? "בודק חיבור..." : user ? (
                        <span style={{ color: "#2e7d32", fontWeight: 600 }}>מחובר כ-{user.email}</span>
                    ) : (
                        <span style={{ color: "#b71c1c", fontWeight: 600 }}>לא מחובר</span>
                    )}
                </Row>
                <Row label="ערכים ב-Firestore">
                    {user ? (entryCount === null ? "טוען..." : entryCount.toLocaleString("he-IL")) : "—"}
                </Row>
                <div style={styles.actions}>
                    {user ? (
                        <button style={styles.secondaryBtn} onClick={() => void onSignOut()}>התנתק מפרויקט התנ"ך</button>
                    ) : user === null ? (
                        <button style={styles.primaryBtn} onClick={() => setAuthOpen(true)}>התחבר</button>
                    ) : null}
                </div>
            </div>

            {user && entryCount === 0 && (
                <div style={{ ...styles.banner, background: "#e3f2fd", color: "#0d47a1" }}>
                    החיבור עובד. המסד עדיין ריק – התוכן הקיים נטען בשלב 3 (העברת הנתונים).
                </div>
            )}

            <ProdAuthModal
                open={authOpen}
                email={currentUserEmail}
                onSuccess={() => { setAuthOpen(false); setBanner(null); }}
                onClose={() => setAuthOpen(false)}
                authenticate={signInToTanakh}
                title="כניסה לפרויקט התנ״ך למטייל"
                subtitle={<>
                    התנ"ך למטייל יושב בפרויקט Firebase נפרד. הזינו את הסיסמה שלכם בפרויקט הזה
                    (אותו מייל כמו ב-CMS, הסיסמה נפרדת).
                    <br />
                    הכניסה תישמר עד לסגירת הטאב.
                </>}
                envLabel="בפרויקט התנ״ך"
            />
        </div>
    );
}

function Header() {
    return (
        <div style={styles.header}>
            <div>
                <h2 style={styles.title}>התנ"ך למטייל</h2>
                <p style={styles.subtitle}>
                    ניהול תוכן המדריך: ערכים, מיקומים, תמונות ותרגומים. פרויקט Firebase נפרד מהתפילה.
                </p>
            </div>
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={styles.row}>
            <span style={styles.rowLabel}>{label}</span>
            <span>{children}</span>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: { direction: "rtl", padding: "20px 24px 60px", maxWidth: 900, margin: "0 auto", fontFamily: "inherit" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 12 },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    subtitle: { margin: "4px 0 0", fontSize: 13, color: "#666" },
    banner: { borderRadius: 6, padding: "10px 14px", fontSize: 14, marginBottom: 12, lineHeight: 1.6 },
    list: { margin: "6px 0", paddingInlineStart: 22 },
    card: { border: "1px solid #e0e0e0", borderRadius: 8, padding: "12px 16px", background: "#fff", display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 },
    cardTitle: { margin: 0, fontSize: 16, fontWeight: 700 },
    row: { display: "flex", gap: 12, fontSize: 14, alignItems: "baseline" },
    rowLabel: { minWidth: 150, color: "#555", fontWeight: 600 },
    actions: { display: "flex", gap: 10, marginTop: 4 },
    code: { fontSize: 12, background: "#f0f0f0", borderRadius: 4, padding: "1px 6px", direction: "ltr", unicodeBidi: "isolate" },
    primaryBtn: { padding: "8px 18px", borderRadius: 6, border: "none", background: "#1565c0", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    secondaryBtn: { border: "1px solid #ccc", background: "#fff", borderRadius: 5, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#555" },
};
