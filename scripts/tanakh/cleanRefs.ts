/**
 * cleanRefs – ניקוי מראי מקום שההעברה הביאה מהספר הסרוק.
 *
 * שלוש פעולות, כולן ודאיות (ראו src/views/tanakh/model/cleanRefs.ts):
 *
 *   תיקון  – שורה שקידומת הסתירה בה את שם הספר ("534 יחזקאל מז, טז",
 *            "כ- מלכים ב׳ ג, ט") מתוקנת במקום והופכת להפניה לחיצה.
 *   העברה  – שורה שאין בה שום שם ספר (כיתוב תמונה שנחת בעמודה הלא נכונה)
 *            ומראי מקום שיושבים על ערך הפניה ריק.
 *   דיווח  – כל השאר, כולל שם ספר שנפגם בסריקה. בספק, לא נוגעים.
 *
 * שום שורה לא נמחקת: מה שמועבר עובר לשדה ההערות הפנימיות, שאינו מתפרסם.
 *
 * כל השאר – פרק או פסוק מחוץ לטווח, ושברים כמו "308 מח" – רק מדווח. תיקון
 * שלהם דורש להבין על מה הערך מדבר, וניחוש גרוע מלהשאיר שבור.
 *
 * הרצה (מתיקיית ה-CMS):
 *
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/cleanRefs.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/cleanRefs.ts --write
 *
 * ב-Windows (PowerShell): $env:SEED_EMAIL="..."; $env:SEED_PASSWORD="..."; npx vite-node ...
 *
 * אפשרויות:
 *   --write            להחיל בפועל (בלי זה: דוח בלבד, שום דבר לא נכתב)
 *   --report <file>    הדוח המלא לקובץ
 *   --backup <file>    קובץ הגיבוי (ברירת מחדל: tanakh-backup-<תאריך>.json)
 *   --no-backup        לוותר על הגיבוי (לא מומלץ)
 *
 * בטיחות: עם --write נכתב קודם גיבוי של **כל** הערכים כפי שהם עכשיו, ורק
 * אחר כך מתבצעת הכתיבה. נכתבים רק ערכים שהשתנו.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { cleanEntryRefs, MOVE_REASON_LABELS, PROBLEM_LABELS, type MovedRef, type ProblemRef, type RepairedRef } from "../../src/views/tanakh/model/cleanRefs";
import { prepareEntryForSave } from "../../src/views/tanakh/model/entryOps";
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
log("התנ\"ך למטייל – ניקוי מראי מקום");
log(`מצב: ${write ? "כתיבה" : "דוח בלבד"}`);
log();

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

// ── ניקוי ─────────────────────────────────────────────────────────────────

const now = Date.now();
type Change = { entry: Entry; moved: MovedRef[]; repaired: RepairedRef[]; problems: ProblemRef[]; title: string };
const changes: Change[] = [];
const problemsOnly: Change[] = [];
let movedCaption = 0, movedFragment = 0, movedRedirect = 0, repairedTotal = 0, problemsTotal = 0;

for (const entry of entries) {
    const r = cleanEntryRefs(entry, now);
    for (const m of r.moved) {
        if (m.reason === "caption") movedCaption++;
        else if (m.reason === "fragment") movedFragment++;
        else movedRedirect++;
    }
    repairedTotal += r.repaired.length;
    problemsTotal += r.problems.length;
    const change: Change = { entry: r.entry, moved: r.moved, repaired: r.repaired, problems: r.problems, title: entry.title?.he ?? entry.id };
    if (r.changed) changes.push(change);
    else if (r.problems.length) problemsOnly.push(change);
}

const head = [
    `ערכים שישתנו: ${changes.length} מתוך ${entries.length}`,
    `שורות שיתוקנו והופכות להפניה לחיצה: ${repairedTotal}`,
    `שורות שיעברו להערות: ${movedCaption + movedFragment + movedRedirect} (${movedCaption} כיתובי תמונות · ${movedFragment} שברים · ${movedRedirect} מערכי הפניה)`,
    `נשארות לבדיקה ידנית: ${problemsTotal} שורות, ב-${changes.filter(c => c.problems.length).length + problemsOnly.length} ערכים`,
];
head.forEach(l => log(l));

const report: string[] = [];
const repairs = changes.filter(c => c.repaired.length);
if (repairs.length) {
    report.push("", "── מה יתוקן במקום ──────────────────────────────────────");
    for (const c of repairs) {
        report.push(`\n${c.entry.id} · ${c.title}`);
        for (const r of c.repaired) report.push(`  ✓ ${r.from}   →   ${r.to}`);
    }
}
if (changes.some(c => c.moved.length)) {
    report.push("", "── מה יעבור להערות ─────────────────────────────────────");
    for (const c of changes.filter(x => x.moved.length)) {
        report.push(`\n${c.entry.id} · ${c.title}`);
        for (const m of c.moved) report.push(`  ← ${m.raw}   (${MOVE_REASON_LABELS[m.reason]})`);
    }
}
const withProblems = [...changes, ...problemsOnly].filter(c => c.problems.length);
if (withProblems.length) {
    report.push("", "── נשאר לבדיקה ידנית (לא שונה) ─────────────────────────");
    for (const c of withProblems) {
        report.push(`\n${c.entry.id} · ${c.title}`);
        for (const p of c.problems) report.push(`  ? ${p.raw}   (${PROBLEM_LABELS[p.kind]})`);
    }
}

if (reportFile) {
    writeFileSync(resolve(reportFile), [...head, ...report, ""].join("\n"));
    log(`\nהדוח המלא נכתב ל-${reportFile}`);
} else {
    log("\n(לדוח מפורט: --report out.txt)");
}

if (!write) {
    log("\nדוח בלבד. להחלה: --write");
    process.exit(0);
}
if (!changes.length) {
    log("\nאין מה לשנות.");
    process.exit(0);
}

// ── גיבוי ואז כתיבה ───────────────────────────────────────────────────────

if (!noBackup) {
    writeFileSync(resolve(backupFile), JSON.stringify(entries, null, 1));
    log(`\nגיבוי של ${entries.length} הערכים נכתב ל-${backupFile}`);
}

/** Firestore לא מקבל undefined */
const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const BATCH = 400;
let written = 0;
let batch = writeBatch(db);
let inBatch = 0;
const flush = async () => {
    if (!inBatch) return;
    await batch.commit();
    written += inBatch;
    log(`נכתבו ${written}/${changes.length}`);
    batch = writeBatch(db);
    inBatch = 0;
};
for (const c of changes) {
    const prepared = prepareEntryForSave(c.entry, email, now);
    batch.set(doc(db, ENTRIES_COLLECTION, prepared.id), stripUndefined(prepared));
    if (++inBatch >= BATCH) await flush();
}
await flush();

log(`\nהסתיים: ${written} ערכים עודכנו.`);
log(noBackup ? "" : `לשחזור, אם משהו השתבש: הקובץ ${backupFile} מכיל את המצב הקודם.`);
process.exit(0);
