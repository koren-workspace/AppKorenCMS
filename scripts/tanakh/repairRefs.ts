/**
 * repairRefs – הצעת תיקון למראי מקום ששברה הסריקה.
 *
 * מה שנשאר אחרי cleanRefs הן שורות ששם הספר בהן נכון והמספרים שבורים
 * ("חבקוק ה, ח" – לחבקוק שלושה פרקים; "דברי הימים א" בלי פרק). הסקריפט
 * מצליב כל שורה כזו מול טקסט התנ"ך עצמו, ומדרג:
 *
 *   ✓ ודאי    – מועמד יחיד. עם --write מוחל.
 *   ~ לבדיקה  – עד ארבעה מועמדים, עם הפסוקים עצמם. נשאר לעורך.
 *   ✗ ידני    – הכותרת כללית מדי, או שהמספר הוא עמוד מהמפתח ולא פרק.
 *
 * ההיגיון עצמו ב-src/views/tanakh/model/repairRefs.ts, ושם גם ההסבר למה
 * הצטלבות של שתי ראיות נחשבת ודאית.
 *
 * טקסט התנ"ך אינו בריפו הזה: הוא אפוי באפליקציה, ב-assets/content/tanakh.
 * ברירת המחדל מחפשת אותו ב-../Tanakh-LaMetayel, ואפשר להצביע עליו ידנית.
 *
 * הרצה (מתיקיית ה-CMS):
 *
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/repairRefs.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/repairRefs.ts --write
 *
 * ב-Windows (PowerShell): $env:SEED_EMAIL="..."; $env:SEED_PASSWORD="..."; npx vite-node ...
 *
 * אפשרויות:
 *   --write            להחיל את הוודאיים בלבד (בלי זה: דוח, שום דבר לא נכתב)
 *   --report <file>    הדוח המלא לקובץ
 *   --tanakh <dir>     תיקיית טקסט התנ"ך (ברירת מחדל: ../Tanakh-LaMetayel/assets/content/tanakh)
 *   --backup <file>    קובץ הגיבוי (ברירת מחדל: tanakh-backup-<תאריך>.json)
 *   --no-backup        לוותר על הגיבוי (לא מומלץ)
 *
 * בטיחות: --write נוגע **רק** בשורות הוודאיות, ורק בשורה עצמה – שאר הערך
 * לא זז. לפני הכתיבה נשמר גיבוי של כל הערכים כפי שהם עכשיו.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareEntryForSave } from "../../src/views/tanakh/model/entryOps";
import { proposeRepairs, type Confidence, type RefProposal, type TanakhText } from "../../src/views/tanakh/model/repairRefs";
import { toHebrewNumeral } from "../../src/views/tanakh/model/hebnum";
import { tanakhBook } from "../../src/views/tanakh/model/tanakhBooks";
import { ENTRIES_COLLECTION, type Entry } from "../../src/views/tanakh/model/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmsRoot = resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const write = flag("--write");
const reportFile = opt("--report");
const noBackup = flag("--no-backup");
const backupFile = opt("--backup") ?? `tanakh-backup-${new Date().toISOString().slice(0, 10)}.json`;
const tanakhDir = resolve(opt("--tanakh") ?? resolve(cmsRoot, "..", "Tanakh-LaMetayel", "assets", "content", "tanakh"));

function loadEnvFile(path: string): Record<string, string> {
    if (!existsSync(path)) return {};
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        out[m[1]] = v;
    }
    return out;
}
const env: Record<string, string | undefined> = {
    ...loadEnvFile(resolve(cmsRoot, ".env")),
    ...loadEnvFile(resolve(cmsRoot, ".env.local")),
    ...process.env,
};

const log = (s = "") => console.log(s);
log("התנ\"ך למטייל – תיקון מראי מקום מול טקסט התנ\"ך");
log(`מצב: ${write ? "כתיבה (ודאיים בלבד)" : "דוח בלבד"}`);
log();

// ── טקסט התנ"ך ────────────────────────────────────────────────────────────

if (!existsSync(tanakhDir)) {
    console.error(`לא נמצאה תיקיית טקסט התנ"ך: ${tanakhDir}`);
    console.error("היא יושבת בריפו של האפליקציה. אפשר להצביע עליה עם --tanakh <dir>");
    process.exit(1);
}
const chapters = new Map<string, string[][]>();
for (const file of readdirSync(tanakhDir)) {
    if (!file.endsWith(".json") || file === "index.json") continue;
    const book = JSON.parse(readFileSync(resolve(tanakhDir, file), "utf8")) as {
        id?: string;
        chapters?: { t: string }[][];
    };
    if (!book.id || !Array.isArray(book.chapters)) continue;
    chapters.set(book.id, book.chapters.map(verses => verses.map(v => v.t)));
}
if (!chapters.size) {
    console.error(`אין קובצי ספרים ב-${tanakhDir}`);
    process.exit(1);
}
const text: TanakhText = { verses: (book, ch) => chapters.get(book)?.[ch - 1] };
log(`נטענו ${chapters.size} ספרים מ-${tanakhDir}`);

// ── התחברות וקריאה ────────────────────────────────────────────────────────

const firebaseConfig = {
    apiKey: env.VITE_TLM_FIREBASE_API_KEY,
    authDomain: env.VITE_TLM_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_TLM_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_TLM_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_TLM_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_TLM_FIREBASE_APP_ID,
};
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error("חסרים VITE_TLM_FIREBASE_* ב-.env.local (ראו docs/tanakh-lametayel.md)");
    process.exit(1);
}
const email = env.SEED_EMAIL;
const password = env.SEED_PASSWORD;
if (!email || !password) {
    console.error("חסרים SEED_EMAIL + SEED_PASSWORD (משתמש CMS בפרויקט התנ\"ך)");
    process.exit(1);
}

const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const { getFirestore, collection, getDocs, writeBatch, doc } = await import("firebase/firestore");

const app = initializeApp(firebaseConfig);
log(`מתחבר ל-${firebaseConfig.projectId} בתור ${email}...`);
await signInWithEmailAndPassword(getAuth(app), email, password);
const db = getFirestore(app);

const snap = await getDocs(collection(db, ENTRIES_COLLECTION));
const entries: Entry[] = snap.docs.map(d => ({ ...(d.data() as Entry), id: d.id }));
log(`נטענו ${entries.length} ערכים.`);
log();

// ── הצעות ─────────────────────────────────────────────────────────────────

const { proposals, counts } = proposeRepairs(entries, text);

/** "יהושע יח, א" – איך השורה תיראה אחרי התיקון */
function refText(p: RefProposal, i = 0): string {
    const c = p.candidates[i];
    const he = tanakhBook(c.book)?.he ?? c.book;
    return `${he} ${toHebrewNumeral(c.ch)}, ${toHebrewNumeral(c.v!)}`;
}

const head = [
    `שורות שבורות: ${proposals.length}`,
    `  ✓ ודאי (הצעה יחידה): ${counts.certain}`,
    `  ~ לבדיקה (עד ארבעה מועמדים): ${counts.review}`,
    `  ✗ ידני (צריך את הספר המודפס): ${counts.manual}`,
];
head.forEach(l => log(l));

const byConfidence = (c: Confidence) => proposals.filter(p => p.confidence === c);
const report: string[] = [];

const certain = byConfidence("certain");
if (certain.length) {
    report.push("", "── ודאי ─────────────────────────────────────────────────");
    report.push(write ? "השורות האלה מוחלות עכשיו." : "עם --write השורות האלה יוחלפו.");
    for (const p of certain) {
        report.push(`\n${p.entryId} · ${p.entryTitle}`);
        report.push(`  ✓ ${p.raw}   →   ${refText(p)}`);
        report.push(`      ${p.candidates[0].text}`);
    }
}

const review = byConfidence("review");
if (review.length) {
    report.push("", "── לבדיקה ───────────────────────────────────────────────");
    report.push("הסקריפט לא נוגע בהן. לבחור מועמד ולהקליד אותו ב-CMS.");
    for (const p of review) {
        report.push(`\n${p.entryId} · ${p.entryTitle}`);
        report.push(`  ~ ${p.raw}`);
        p.candidates.forEach((_, i) => {
            report.push(`      ${i + 1}. ${refText(p, i)}${p.candidates[i].structural ? "  (גם לפי מבנה המספרים)" : ""}`);
            report.push(`         ${p.candidates[i].text}`);
        });
    }
}

const manual = byConfidence("manual");
if (manual.length) {
    report.push("", "── ידני ─────────────────────────────────────────────────");
    for (const p of manual) {
        report.push(`\n${p.entryId} · ${p.entryTitle}`);
        report.push(`  ✗ ${p.raw}${p.note ? `   (${p.note})` : ""}`);
        p.candidates.forEach((c, i) => report.push(`      ${i + 1}. ${refText(p, i)} – ${c.text.slice(0, 60)}`));
    }
}

if (reportFile) {
    writeFileSync(resolve(reportFile), [...head, ...report, ""].join("\n"));
    log(`\nהדוח המלא נכתב ל-${reportFile}`);
} else {
    log("\n(לדוח מפורט: --report out.txt)");
}

if (!write) {
    log("\nדוח בלבד. להחלת הוודאיים: --write");
    process.exit(0);
}
if (!certain.length) {
    log("\nאין שורות ודאיות להחיל.");
    process.exit(0);
}

// ── גיבוי ואז כתיבה ───────────────────────────────────────────────────────

if (!noBackup) {
    writeFileSync(resolve(backupFile), JSON.stringify(entries, null, 1));
    log(`\nגיבוי של ${entries.length} הערכים נכתב ל-${backupFile}`);
}

const byId = new Map(entries.map(e => [e.id, e]));
const touched = new Map<string, Entry>();
for (const p of certain) {
    const entry = touched.get(p.entryId) ?? byId.get(p.entryId);
    if (!entry) continue;
    const c = p.candidates[0];
    const refs = entry.refs.map((r, i) => (i === p.index ? { raw: refText(p), book: c.book, ch: c.ch, v: c.v } : r));
    touched.set(p.entryId, { ...entry, refs });
}

/** Firestore לא מקבל undefined */
const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const now = Date.now();
const BATCH = 400;
let written = 0;
let batch = writeBatch(db);
let inBatch = 0;
const flush = async () => {
    if (!inBatch) return;
    await batch.commit();
    written += inBatch;
    log(`נכתבו ${written}/${touched.size}`);
    batch = writeBatch(db);
    inBatch = 0;
};
for (const entry of touched.values()) {
    const prepared = prepareEntryForSave(entry, email, now);
    batch.set(doc(db, ENTRIES_COLLECTION, prepared.id), stripUndefined(prepared));
    if (++inBatch >= BATCH) await flush();
}
await flush();

log(`\nהסתיים: ${written} ערכים עודכנו, ${certain.length} שורות תוקנו.`);
log(noBackup ? "" : `לשחזור, אם משהו השתבש: הקובץ ${backupFile} מכיל את המצב הקודם.`);
process.exit(0);
