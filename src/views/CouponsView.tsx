/**
 * =============================================================================
 * CouponsView – מסך ניהול קופונים (קולקציית `coupons` ב-Firestore)
 * =============================================================================
 *
 * קופון מעניק מודים באפליקציה בלי עסקה בחנות (מתנות, קמפיינים). המסך:
 *   1. בוחר סביבה: Stage (ברירת מחדל, לבדיקות) או פרוד (דורש אימות פרוד,
 *      כמו "פרסום לפרוד" במסכים האחרים).
 *   2. מציג את כל הקופונים בסביבה ומצבם: פעיל / כבוי / נוצל / פג תוקף.
 *   3. יוצר קופון חדש: מנפיק קוד אקראי, מחשב את ה-hash, וכותב מסמך.
 *      הקוד הקריא מוצג פעם אחת בלבד – הוא לא נשמר בשרת. להעתיק ולשלוח.
 *   4. מאתר קופון לפי קוד (או hash) – כדי לכבות קוד שדלף.
 *
 * ראו docs/coupons.md לחוקי האבטחה שהמסך והאפליקציה נשענים עליהם.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useAuthController } from "@firecms/core";
import type { CouponDoc, CouponEnv } from "./coupons/types";
import { STORE_PRODUCTS } from "./coupons/types";
import { couponCodeHash, looksLikeHash, mintCouponCode } from "./coupons/codes";
import {
    createCoupon,
    deleteCoupon,
    loadCoupons,
    resetCouponUsed,
    setCouponActive,
} from "./coupons/services/couponService";
import { ProdAuthModal } from "./toc-translations/components/ProdAuthModal";
import { isProdAuthenticated } from "./toc-translations/services/prodAuthService";

type Banner = { kind: "info" | "success" | "error"; text: string } | null;

/** קופון שזה עתה נוצר – הקוד מוצג פעם אחת */
type Minted = { code: string; coupon: CouponDoc };

function statusOf(coupon: CouponDoc, now: number): { label: string; color: string } {
    if (coupon.usedAt) return { label: `נוצל ${coupon.usedAt.toLocaleString("he-IL")}`, color: "#6a1b9a" };
    if (!coupon.active) return { label: "כבוי", color: "#757575" };
    if (!coupon.expiresAt) return { label: "ללא תוקף – לא ייפדה", color: "#c62828" };
    if (coupon.expiresAt.getTime() <= now) return { label: "פג תוקף", color: "#c62828" };
    return { label: "פעיל", color: "#2e7d32" };
}

function defaultExpiry(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
}

export function CouponsView() {
    const auth = useAuthController();
    const currentUserEmail = (auth.user as any)?.email ?? "";

    const [env, setEnv] = useState<CouponEnv>("stage");
    const [coupons, setCoupons] = useState<CouponDoc[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [banner, setBanner] = useState<Banner>(null);
    const [prodAuthOpen, setProdAuthOpen] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    // טופס יצירה
    const [name, setName] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const [extraIds, setExtraIds] = useState("");
    const [expiry, setExpiry] = useState(defaultExpiry);
    const [creating, setCreating] = useState(false);
    const [minted, setMinted] = useState<Minted | null>(null);

    // חיפוש לפי קוד
    const [lookup, setLookup] = useState("");
    const [lookupHash, setLookupHash] = useState<string | null>(null);

    // ---- טעינה ---------------------------------------------------------------

    async function reload(target: CouponEnv) {
        setCoupons(null);
        setLoadError(null);
        try {
            setCoupons(await loadCoupons(target));
        } catch (err: any) {
            setLoadError(String(err?.message ?? err));
        }
    }

    useEffect(() => {
        void reload("stage");
    }, []);

    function switchEnv(target: CouponEnv) {
        if (target === env) return;
        if (target === "prod" && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        setEnv(target);
        setMinted(null);
        setBanner(null);
        void reload(target);
    }

    function onProdAuthSuccess() {
        setProdAuthOpen(false);
        setEnv("prod");
        setMinted(null);
        setBanner(null);
        void reload("prod");
    }

    // ---- חיפוש -----------------------------------------------------------------

    useEffect(() => {
        const value = lookup.trim();
        if (!value) {
            setLookupHash(null);
            return;
        }
        let cancelled = false;
        if (looksLikeHash(value)) {
            setLookupHash(value.toLowerCase());
        } else {
            void couponCodeHash(value).then(hash => {
                if (!cancelled) setLookupHash(hash);
            });
        }
        return () => {
            cancelled = true;
        };
    }, [lookup]);

    const found = useMemo(
        () => (lookupHash ? (coupons ?? []).find(c => c.id === lookupHash) ?? null : null),
        [coupons, lookupHash]
    );

    // ---- יצירה -----------------------------------------------------------------

    const storeIds = useMemo(() => {
        const extras = extraIds
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        return Array.from(new Set([...selected, ...extras]));
    }, [selected, extraIds]);

    function toggleProduct(id: string) {
        setSelected(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));
    }

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (creating) return;
        const label = name.trim();
        if (!label) {
            setBanner({ kind: "error", text: "חסר שם לקופון (למי / איזה קמפיין)" });
            return;
        }
        if (storeIds.length === 0) {
            setBanner({ kind: "error", text: "יש לבחור לפחות מוצר אחד" });
            return;
        }
        const expiresAt = new Date(`${expiry}T23:59:59`);
        if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
            setBanner({ kind: "error", text: "תאריך התפוגה חייב להיות בעתיד" });
            return;
        }
        if (env === "prod" && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }

        setCreating(true);
        setBanner(null);
        try {
            const code = mintCouponCode();
            const codeHash = await couponCodeHash(code);
            const coupon = await createCoupon(env, {
                codeHash,
                name: label,
                storeIds,
                expiresAt,
                active: true,
            });
            setCoupons(prev => [coupon, ...(prev ?? [])]);
            setMinted({ code, coupon });
            setName("");
            setSelected([]);
            setExtraIds("");
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה ביצירה: ${err?.message ?? err}` });
        } finally {
            setCreating(false);
        }
    }

    async function copyCode(code: string) {
        try {
            await navigator.clipboard.writeText(code);
            setBanner({ kind: "success", text: `הקוד ${code} הועתק` });
        } catch {
            setBanner({ kind: "info", text: "לא ניתן להעתיק אוטומטית – סמנו והעתיקו ידנית" });
        }
    }

    // ---- פעולות על שורה -------------------------------------------------------

    async function withRow(id: string, action: () => Promise<void>, onDone: () => void) {
        if (busyId) return;
        if (env === "prod" && !isProdAuthenticated()) {
            setProdAuthOpen(true);
            return;
        }
        setBusyId(id);
        setBanner(null);
        try {
            await action();
            onDone();
        } catch (err: any) {
            setBanner({ kind: "error", text: `שגיאה: ${err?.message ?? err}` });
        } finally {
            setBusyId(null);
        }
    }

    function onToggleActive(coupon: CouponDoc) {
        const next = !coupon.active;
        void withRow(
            coupon.id,
            () => setCouponActive(env, coupon.id, next),
            () => setCoupons(prev => (prev ?? []).map(c => (c.id === coupon.id ? { ...c, active: next } : c)))
        );
    }

    function onResetUsed(coupon: CouponDoc) {
        if (!window.confirm(`להחזיר את "${coupon.name}" למצב לא-מנוצל? הקוד יהיה ניתן לפדיון שוב.`)) return;
        void withRow(
            coupon.id,
            () => resetCouponUsed(env, coupon.id),
            () => setCoupons(prev => (prev ?? []).map(c => (c.id === coupon.id ? { ...c, usedAt: null } : c)))
        );
    }

    function onDelete(coupon: CouponDoc) {
        if (!window.confirm(`למחוק את "${coupon.name}" לצמיתות? הקוד שלו יפסיק לעבוד.`)) return;
        void withRow(
            coupon.id,
            () => deleteCoupon(env, coupon.id),
            () => setCoupons(prev => (prev ?? []).filter(c => c.id !== coupon.id))
        );
    }

    // ---- רינדור ---------------------------------------------------------------

    const now = Date.now();
    const isProd = env === "prod";

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>קופונים</h2>
                    <p style={styles.subtitle}>
                        קוד מעניק מודים בלי תשלום · חד-פעמי · הקוד הקריא מוצג פעם אחת ביצירה ולא נשמר
                    </p>
                </div>
                <div style={styles.envSwitch}>
                    <button
                        style={{ ...styles.envBtn, ...(env === "stage" ? styles.envBtnActive : {}) }}
                        onClick={() => switchEnv("stage")}
                    >
                        Stage
                    </button>
                    <button
                        style={{
                            ...styles.envBtn,
                            ...(env === "prod" ? { ...styles.envBtnActive, background: "#c62828" } : {}),
                        }}
                        onClick={() => switchEnv("prod")}
                    >
                        פרוד
                    </button>
                </div>
            </div>

            {isProd && (
                <div style={{ ...styles.banner, background: "#fdecea", color: "#c62828" }}>
                    סביבת פרוד – כל קופון שנוצר כאן ניתן לפדיון באפליקציה אצל משתמשים אמיתיים.
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

            {minted && (
                <div style={styles.mintedBox}>
                    <div style={styles.mintedTitle}>הקופון נוצר. זה הקוד – הוא לא יוצג שוב:</div>
                    <div style={styles.mintedCode}>{minted.code}</div>
                    <div style={styles.mintedMeta}>
                        {minted.coupon.name} · {minted.coupon.storeIds.join(", ")} · עד{" "}
                        {minted.coupon.expiresAt?.toLocaleDateString("he-IL")}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button style={styles.primaryBtn} onClick={() => void copyCode(minted.code)}>
                            העתקת הקוד
                        </button>
                        <button style={styles.secondaryBtn} onClick={() => setMinted(null)}>
                            סגירה (העתקתי)
                        </button>
                    </div>
                </div>
            )}

            <div style={styles.columns}>
                {/* ---- יצירה ---- */}
                <form style={styles.card} onSubmit={onCreate}>
                    <h3 style={styles.cardTitle}>קופון חדש {isProd ? "(פרוד)" : "(Stage)"}</h3>
                    <label style={styles.field}>
                        שם (למי / איזה קמפיין)
                        <input
                            style={styles.input}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="למשל: מתנה – משפחת כהן"
                        />
                    </label>
                    <div style={styles.field}>
                        מוצרים
                        <div style={styles.products}>
                            {STORE_PRODUCTS.map(p => (
                                <label key={p.id} style={styles.product}>
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(p.id)}
                                        onChange={() => toggleProduct(p.id)}
                                    />
                                    <span>{p.label}</span>
                                    <code style={styles.code}>{p.id}</code>
                                </label>
                            ))}
                        </div>
                    </div>
                    <label style={styles.field}>
                        מזהים נוספים (Stage / מוצר שאינו ברשימה, מופרדים בפסיק)
                        <input
                            style={{ ...styles.input, direction: "ltr" }}
                            value={extraIds}
                            onChange={e => setExtraIds(e.target.value)}
                            placeholder="test1id, test2id"
                        />
                    </label>
                    <label style={styles.field}>
                        תוקף עד
                        <input
                            type="date"
                            style={styles.input}
                            value={expiry}
                            onChange={e => setExpiry(e.target.value)}
                        />
                    </label>
                    <button
                        type="submit"
                        style={{ ...styles.primaryBtn, opacity: creating ? 0.5 : 1, marginTop: 6 }}
                        disabled={creating}
                    >
                        {creating ? "יוצר..." : "יצירת קופון והנפקת קוד"}
                    </button>
                </form>

                {/* ---- חיפוש ---- */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>איתור לפי קוד</h3>
                    <p style={styles.hint}>
                        הדביקו קוד (או hash) כדי למצוא את הקופון – למשל כדי לכבות קוד שדלף.
                    </p>
                    <input
                        style={{ ...styles.input, direction: "ltr" }}
                        value={lookup}
                        onChange={e => setLookup(e.target.value)}
                        placeholder="ABCD-2345"
                    />
                    {lookupHash && (
                        <p style={styles.hint}>
                            hash: <code style={styles.code}>{lookupHash}</code>
                        </p>
                    )}
                    {lookupHash && coupons && (
                        <p style={{ ...styles.hint, color: found ? "#2e7d32" : "#c62828" }}>
                            {found ? `נמצא: ${found.name} (מסומן בטבלה)` : "אין קופון כזה בסביבה הזו"}
                        </p>
                    )}
                </div>
            </div>

            {/* ---- רשימה ---- */}
            <h3 style={styles.cardTitle}>
                כל הקופונים {coupons ? `(${coupons.length})` : ""}
                <button style={styles.linkBtn} onClick={() => void reload(env)}>
                    רענון
                </button>
            </h3>
            {loadError && <p style={{ color: "#d32f2f" }}>שגיאה בטעינה: {loadError}</p>}
            {!coupons && !loadError && <p>טוען...</p>}
            {coupons && coupons.length === 0 && <p style={styles.hint}>אין קופונים בסביבה הזו עדיין.</p>}
            {coupons && coupons.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>שם</th>
                                <th style={styles.th}>מוצרים</th>
                                <th style={styles.th}>תוקף עד</th>
                                <th style={styles.th}>נוצר</th>
                                <th style={styles.th}>מצב</th>
                                <th style={styles.th}>פעולות</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.map(coupon => {
                                const status = statusOf(coupon, now);
                                const highlighted = found?.id === coupon.id;
                                const busy = busyId === coupon.id;
                                return (
                                    <tr
                                        key={coupon.id}
                                        style={{ background: highlighted ? "#fff8e1" : undefined, opacity: busy ? 0.5 : 1 }}
                                    >
                                        <td style={styles.td}>
                                            <div>{coupon.name || "(ללא שם)"}</div>
                                            <code style={{ ...styles.code, fontSize: 10 }} title={coupon.id}>
                                                {coupon.id.slice(0, 12)}…
                                            </code>
                                        </td>
                                        <td style={{ ...styles.td, direction: "ltr", textAlign: "right" }}>
                                            {coupon.storeIds.join(", ")}
                                        </td>
                                        <td style={styles.td}>{coupon.expiresAt?.toLocaleDateString("he-IL") ?? "—"}</td>
                                        <td style={styles.td}>{coupon.createdAt?.toLocaleDateString("he-IL") ?? "—"}</td>
                                        <td style={{ ...styles.td, color: status.color, fontWeight: 600 }}>{status.label}</td>
                                        <td style={styles.td}>
                                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                <button
                                                    style={styles.secondaryBtn}
                                                    disabled={busy}
                                                    onClick={() => onToggleActive(coupon)}
                                                >
                                                    {coupon.active ? "כיבוי" : "הפעלה"}
                                                </button>
                                                {coupon.usedAt && (
                                                    <button
                                                        style={styles.secondaryBtn}
                                                        disabled={busy}
                                                        onClick={() => onResetUsed(coupon)}
                                                    >
                                                        איפוס ניצול
                                                    </button>
                                                )}
                                                <button
                                                    style={{ ...styles.secondaryBtn, color: "#c62828" }}
                                                    disabled={busy}
                                                    onClick={() => onDelete(coupon)}
                                                >
                                                    מחיקה
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <ProdAuthModal
                open={prodAuthOpen}
                email={currentUserEmail}
                onSuccess={onProdAuthSuccess}
                onClose={() => setProdAuthOpen(false)}
            />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        direction: "rtl",
        padding: "20px 24px 60px",
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: "inherit",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 12,
    },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    subtitle: { margin: "4px 0 0", fontSize: 13, color: "#666" },
    envSwitch: { display: "flex", gap: 6 },
    envBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "1px solid #ccc",
        background: "#fff",
        color: "#444",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
    envBtnActive: { background: "#1565c0", color: "#fff", borderColor: "transparent" },
    banner: { borderRadius: 6, padding: "10px 14px", fontSize: 14, marginBottom: 12 },
    mintedBox: {
        border: "2px solid #2e7d32",
        borderRadius: 8,
        padding: "14px 18px",
        marginBottom: 16,
        background: "#f1f8e9",
    },
    mintedTitle: { fontSize: 14, fontWeight: 600, color: "#2e7d32" },
    mintedCode: {
        fontFamily: "monospace",
        fontSize: 32,
        letterSpacing: 4,
        direction: "ltr",
        textAlign: "center",
        margin: "10px 0",
        userSelect: "all",
    },
    mintedMeta: { fontSize: 13, color: "#555" },
    columns: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 },
    card: {
        flex: "1 1 360px",
        border: "1px solid #e0e0e0",
        borderRadius: 8,
        padding: "12px 16px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
    },
    cardTitle: { margin: "0 0 4px", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 },
    field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#444" },
    input: { border: "1px solid #ccc", borderRadius: 6, padding: "8px 12px", fontSize: 14, fontWeight: 400 },
    products: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 4 },
    product: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 },
    code: { fontSize: 11, background: "#f0f0f0", borderRadius: 4, padding: "1px 6px", direction: "ltr" },
    hint: { fontSize: 12, color: "#777", margin: 0 },
    primaryBtn: {
        padding: "8px 18px",
        borderRadius: 6,
        border: "none",
        background: "#2e7d32",
        color: "#fff",
        fontWeight: 600,
        cursor: "pointer",
        fontSize: 14,
    },
    secondaryBtn: {
        border: "1px solid #ccc",
        background: "#fff",
        borderRadius: 5,
        padding: "3px 10px",
        fontSize: 12,
        cursor: "pointer",
        color: "#555",
    },
    linkBtn: {
        border: "none",
        background: "none",
        color: "#1565c0",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 400,
    },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #e0e0e0", fontWeight: 700 },
    td: { padding: "8px 10px", borderBottom: "1px solid #eee", verticalAlign: "top" },
};
