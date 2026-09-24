/**
 * =============================================================================
 * TanakhView – מסך "התנ"ך למטייל"
 * =============================================================================
 *
 * ניהול תוכן המדריך בפרויקט Firebase הנפרד (ראו docs/tanakh-lametayel.md).
 *
 * זרימה: אם חסרים משתני סביבה – רשימה של מה חסר. אחרת, אם לא מחוברים – מודל
 * סיסמה (אותו מייל כמו ב-CMS, סיסמה של פרויקט התנ"ך). כשמחוברים – סביבת
 * העבודה: רשימת ערכים (חיפוש, סינון) וטופס עריכה לערך הנבחר.
 *
 * כל שמירה היא טיוטה. משתמשי האפליקציה רואים רק מה שמתפרסם (שלב 7).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthController } from "@firecms/core";
import type { User } from "firebase/auth";
import { isTanakhConfigured, missingTanakhEnvVars, tanakhProjectId } from "../firebase_config";
import { ProdAuthModal } from "./toc-translations/components/ProdAuthModal";
import { setChangeLogUser } from "./toc-translations/services/changeLogService";
import { onTanakhAuthChanged, signInToTanakh, signOutOfTanakh } from "./tanakh/services/tanakhAuthService";
import { deleteEntry, loadContent, saveCategory, saveEntry, seedCategories, type TanakhContent } from "./tanakh/services/entriesService";
import { emptyEntry, type Category, type Entry } from "./tanakh/model/types";
import { entriesEqual, nextEntryId, setTranslationStatus } from "./tanakh/model/entryOps";
import { validateEntry } from "./tanakh/model/validate";
import { EntryList } from "./tanakh/components/EntryList";
import { EntryEditor } from "./tanakh/components/EntryEditor";
import { CategoriesModal } from "./tanakh/components/CategoriesModal";
import { ts } from "./tanakh/components/tanakhStyles";

type Banner = { kind: "info" | "success" | "error"; text: string } | null;

export function TanakhView() {
    const auth = useAuthController();
    const currentUserEmail: string = (auth.user as any)?.email ?? "";
    const currentUserUid: string = (auth.user as any)?.uid ?? "";
    const configured = isTanakhConfigured();

    /** undefined = Firebase עוד לא החזיר את מצב הסשן */
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [authOpen, setAuthOpen] = useState(false);
    const [banner, setBanner] = useState<Banner>(null);

    const [content, setContent] = useState<TanakhContent | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Entry | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [categoriesOpen, setCategoriesOpen] = useState(false);

    useEffect(() => {
        setChangeLogUser({ email: currentUserEmail, uid: currentUserUid });
    }, [currentUserEmail, currentUserUid]);

    // מעקב אחרי כניסה/יציאה לפרויקט התנ"ך (כולל שחזור סשן בטעינת הדף)
    useEffect(() => {
        if (!configured) return;
        return onTanakhAuthChanged(u => {
            setUser(u);
            if (!u) {
                setContent(null);
                setDraft(null);
                setSelectedId(null);
                setAuthOpen(true);
            }
        });
    }, [configured]);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const c = await loadContent();
            setContent(c);
        } catch (err: any) {
            setBanner({ kind: "error", text: `קריאת Firestore נכשלה: ${err?.message ?? err}. בדקו את חוקי האבטחה (docs/tanakh-lametayel.md).` });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user) void reload();
    }, [user, reload]);

    const entries = content?.entries ?? [];
    const categories = content?.categories ?? [];
    const original = useMemo(() => (selectedId ? entries.find(e => e.id === selectedId) ?? null : null), [entries, selectedId]);
    const dirty = Boolean(draft && (isNew || (original && !entriesEqual(draft, original))));
    const issues = useMemo(() => {
        if (!draft) return [];
        return validateEntry(draft, {
            entryIds: new Set(entries.map(e => e.id)),
            categoryKeys: new Set(categories.map(c => c.key)),
        });
    }, [draft, entries, categories]);

    function confirmDiscard(): boolean {
        return !dirty || window.confirm("יש שינויים שלא נשמרו בערך הנוכחי. לעזוב בלי לשמור?");
    }

    function select(id: string) {
        if (id === selectedId) return;
        if (!confirmDiscard()) return;
        const e = entries.find(x => x.id === id);
        if (!e) return;
        setSelectedId(id);
        setDraft(structuredClone(e));
        setIsNew(false);
        setBanner(null);
    }

    function startNew() {
        if (!confirmDiscard()) return;
        const id = nextEntryId(entries.map(e => e.id));
        const cat = categories[0]?.key ?? "places";
        setSelectedId(id);
        setDraft(emptyEntry(id, cat));
        setIsNew(true);
        setBanner(null);
    }

    async function onSave() {
        if (!draft || busy) return;
        if (issues.some(i => i.level === "error")) return;
        setBusy(true);
        try {
            // ערך ראשון במסד ריק: הקטגוריות המובנות נכתבות כדי שהקטגוריה של הערך תהיה קיימת
            if (content && !content.categoriesFromDb) {
                await seedCategories();
                setContent(c => (c ? { ...c, categoriesFromDb: true } : c));
            }
            const saved = await saveEntry(draft, currentUserEmail || undefined, isNew);
            setContent(c => {
                if (!c) return c;
                const others = c.entries.filter(e => e.id !== saved.id);
                return { ...c, entries: [...others, saved] };
            });
            setDraft(structuredClone(saved));
            setIsNew(false);
            const warnings = issues.filter(i => i.level === "warning").length;
            setBanner({ kind: "success", text: `נשמר: ${saved.title.he}${warnings ? ` (${warnings} אזהרות – לא חוסמות)` : ""}. זו טיוטה; משתמשים יראו אותה רק אחרי פרסום.` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `השמירה נכשלה: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    async function onDelete() {
        if (!draft || busy || isNew) return;
        const linking = entries.filter(e => e.xrefs.includes(draft.id) || e.see === draft.id);
        const warning = linking.length ? `\n\nשימו לב: ${linking.length} ערכים מקשרים לערך הזה (${linking.slice(0, 5).map(e => e.title.he).join(", ")}${linking.length > 5 ? "…" : ""}). הקישורים יישברו. עדיף להסתיר במקום למחוק.` : "";
        if (!window.confirm(`למחוק את הערך "${draft.title.he}" (${draft.id})?${warning}`)) return;
        if (!window.confirm("המחיקה סופית ואינה ניתנת לשחזור. להמשיך?")) return;
        setBusy(true);
        try {
            await deleteEntry(draft);
            setContent(c => (c ? { ...c, entries: c.entries.filter(e => e.id !== draft.id) } : c));
            setDraft(null);
            setSelectedId(null);
            setBanner({ kind: "info", text: `הערך ${draft.id} נמחק.` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `המחיקה נכשלה: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    async function onMarkTranslation(status: "reviewed" | "approved") {
        if (!draft || busy || dirty) return;
        const marked = setTranslationStatus(draft, "en", status, currentUserEmail || undefined);
        setBusy(true);
        try {
            const saved = await saveEntry(marked, currentUserEmail || undefined, false);
            setContent(c => (c ? { ...c, entries: c.entries.map(e => (e.id === saved.id ? saved : e)) } : c));
            setDraft(structuredClone(saved));
            setBanner({ kind: "success", text: `התרגום לאנגלית סומן: ${status === "approved" ? "מאושר" : "נבדק"}.` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `הסימון נכשל: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    async function onSaveCategory(category: Category) {
        setBusy(true);
        try {
            // מסד ריק: הקטגוריות המובנות עדיין לא נכתבו, והעריכה תיצור מסמך בודד
            if (content && !content.categoriesFromDb) await seedCategories();
            await saveCategory(category);
            setContent(c => {
                if (!c) return c;
                const others = c.categories.filter(x => x.key !== category.key);
                return { ...c, categories: [...others, category].sort((a, b) => a.order - b.order), categoriesFromDb: true };
            });
            setBanner({ kind: "success", text: `הקטגוריה "${category.name.he}" נשמרה.` });
        } catch (err: any) {
            setBanner({ kind: "error", text: `שמירת הקטגוריה נכשלה: ${err?.message ?? err}` });
        } finally {
            setBusy(false);
        }
    }

    async function onSignOut() {
        if (!confirmDiscard()) return;
        await signOutOfTanakh();
        setBanner({ kind: "info", text: "התנתקתם מפרויקט התנ\"ך. הכניסה ל-CMS עצמו לא השתנתה." });
    }

    // ── תצוגה ─────────────────────────────────────────────────────────────

    if (!configured) {
        return (
            <div style={ts.page}>
                <Header />
                <div style={{ ...ts.banner, ...ts.bannerWarn }}>
                    פרויקט התנ"ך למטייל לא מוגדר בסביבה הזו. חסרים משתני הסביבה הבאים
                    (ב-Vercel, או ב-<code style={ts.code}>.env.local</code> בפיתוח):
                    <ul style={{ margin: "6px 0", paddingInlineStart: 22 }}>
                        {missingTanakhEnvVars().map(name => <li key={name}><code style={ts.code}>{name}</code></li>)}
                    </ul>
                    הערכים נמצאים בקונסולת Firebase של הפרויקט, Project settings ← Your apps ← SDK setup.
                    הוראות מלאות ב-<code style={ts.code}>docs/tanakh-lametayel.md</code>.
                </div>
            </div>
        );
    }

    return (
        <div style={ts.page}>
            <Header
                right={
                    <div style={{ ...ts.row, fontSize: 13 }}>
                        <span style={ts.code}>{tanakhProjectId()}</span>
                        {user === undefined ? <span style={ts.muted}>בודק חיבור…</span>
                            : user ? <><span style={{ color: "#2e7d32", fontWeight: 600 }}>מחובר כ-{user.email}</span><button style={ts.secondaryBtn} onClick={() => void onSignOut()}>התנתקות</button></>
                            : <><span style={{ color: "#b71c1c", fontWeight: 600 }}>לא מחובר</span><button style={ts.primaryBtn} onClick={() => setAuthOpen(true)}>התחברות</button></>}
                    </div>
                }
            />

            {banner && (
                <div style={{ ...ts.banner, ...(banner.kind === "error" ? ts.bannerError : banner.kind === "success" ? ts.bannerSuccess : ts.bannerInfo) }}>
                    {banner.text}
                </div>
            )}

            {user && content && (
                <div style={ts.workspace}>
                    <EntryList
                        entries={entries}
                        categories={categories}
                        selectedId={selectedId}
                        dirtyId={dirty ? selectedId : null}
                        onSelect={select}
                        onNew={startNew}
                        onReload={() => { if (confirmDiscard()) { setDraft(null); setSelectedId(null); void reload(); } }}
                        onManageCategories={() => setCategoriesOpen(true)}
                        loading={loading}
                    />
                    {draft ? (
                        <EntryEditor
                            draft={draft}
                            isNew={isNew}
                            dirty={dirty}
                            busy={busy}
                            categories={categories}
                            allEntries={entries}
                            issues={issues}
                            onChange={setDraft}
                            onSave={() => void onSave()}
                            onDelete={() => void onDelete()}
                            onRevert={() => original && setDraft(structuredClone(original))}
                            onMarkTranslation={s => void onMarkTranslation(s)}
                            onNotice={(kind, text) => setBanner({ kind, text })}
                        />
                    ) : (
                        <div style={{ ...ts.card, alignItems: "center", justifyContent: "center", minHeight: 240, color: "#777" }}>
                            {entries.length ? "בחרו ערך מהרשימה, או לחצו + ערך" : "המסד ריק. התוכן הקיים נטען בשלב 3; אפשר כבר ליצור ערך ראשון עם + ערך."}
                        </div>
                    )}
                </div>
            )}
            {user && !content && !loading && !banner && <div style={{ ...ts.banner, ...ts.bannerInfo }}>טוען…</div>}
            {user && loading && !content && <div style={{ ...ts.banner, ...ts.bannerInfo }}>טוען את הערכים…</div>}

            <CategoriesModal
                open={categoriesOpen}
                categories={categories}
                entries={entries}
                busy={busy}
                onSave={onSaveCategory}
                onClose={() => setCategoriesOpen(false)}
            />

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

function Header({ right }: { right?: React.ReactNode }) {
    return (
        <div style={ts.header}>
            <div>
                <h2 style={ts.title}>התנ"ך למטייל</h2>
                <p style={ts.subtitle}>ניהול תוכן המדריך: ערכים, מיקומים, תמונות ותרגומים. כל שמירה היא טיוטה עד לפרסום.</p>
            </div>
            {right}
        </div>
    );
}
