/**
 * applyTextFixes – החלת תיקוני הטקסט מגיליון ההשוואה מול הספר המודפס.
 *
 * הגיליון (pdf-compare-reviewed.xlsx, בריפו של האפליקציה) נבנה ב-
 * scripts/compare_pdf.py ונבדק שורה-שורה. הסקריפט לוקח מהגיליון "טקסט" את
 * השורות שהוחלט בהן "לתקן", ובכל אחת מחליף את "טקסט באפליקציה (לתיקון)"
 * ב"טקסט מתוקן". ההיגיון עצמו ב-src/views/tanakh/model/textFixes.ts.
 *
 * בטיחות:
 *   - בלי --write: דוח בלבד, שום דבר לא נכתב.
 *   - תיקון מוחל רק אם הטקסט הישן נמצא בערך בדיוק פעם אחת. אם עורך כבר שינה
 *     את המקום, התיקון לא נמצא ומדווח – לא דורסים.
 *   - לפני כתיבה נשמר גיבוי של כל הערכים.
 *   - כל ערך נכתב בטרנזקציה שבודקת שלא השתנה מאז הקריאה. אם השתנה – מדלגים.
 *   - רק ערכים שתוקנו נכתבים, ורק השדה שתוקן משתנה בהם.
 *   - האפליקציה רואה את השינוי רק אחרי "פרסום" ב-CMS, כמו כל עריכה.
 *
 * הרצה (מתיקיית ה-CMS):
 *
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/applyTextFixes.ts
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/applyTextFixes.ts --write
 *
 * ב-Windows (PowerShell): $env:SEED_EMAIL="..."; $env:SEED_PASSWORD="..."; npx vite-node ...
 *
 * אפשרויות:
 *   --write            לכתוב ל-CMS (בלי זה: דוח בלבד)
 *   --sheet <file>     הגיליון (ברירת מחדל: ../Tanakh-LaMetayel/deliverables/pdf-compare-reviewed.xlsx)
 *   --from <file>      לבדוק מול קובץ גיבוי במקום מול ה-CMS (בלי התחברות; דוח בלבד)
 *   --report <file>    הדוח המלא (ברירת מחדל: text-fixes-report.txt)
 *   --backup <file>    קובץ הגיבוי (ברירת מחדל: tanakh-backup-<תאריך>-<שעה>.json)
 */

import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type * as XLSXTypes from "xlsx";

import { prepareEntryForSave } from "../../src/views/tanakh/model/entryOps";
import { applyTextFixes, type FixResult, type FixStatus, type TextFix } from "../../src/views/tanakh/model/textFixes";
import { ENTRIES_COLLECTION, type Entry } from "../../src/views/tanakh/model/types";

const XLSX = createRequire(import.meta.url)("xlsx") as typeof XLSXTypes;

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmsRoot = resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const fromFile = opt("--from");
const write = flag("--write");
const sheetFile = resolve(opt("--sheet") ?? resolve(cmsRoot, "..", "Tanakh-LaMetayel", "deliverables", "pdf-compare-reviewed.xlsx"));
const reportFile = resolve(opt("--report") ?? "text-fixes-report.txt");
const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
const backupFile = resolve(opt("--backup") ?? `tanakh-backup-${stamp}.json`);

if (write && fromFile) {
    console.error("--write לא עובד עם --from: הכתיבה היא תמיד מול ה-CMS עצמו.");
    process.exit(1);
}

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
log("התנ\"ך למטייל – תיקוני טקסט מול הספר המודפס");
log(`מצב: ${write ? "כתיבה ל-CMS" : "דוח בלבד"}`);
log();

// ── הגיליון ───────────────────────────────────────────────────────────────

if (!existsSync(sheetFile)) {
    console.error(`לא נמצא הגיליון: ${sheetFile}`);
    process.exit(1);
}
const wb = XLSX.read(readFileSync(sheetFile));
const ws = wb.Sheets["טקסט"];
if (!ws) {
    console.error(`אין בגיליון לשונית בשם "טקסט": ${sheetFile}`);
    process.exit(1);
}
const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
const header = (rows[0] ?? []).map(String);
const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) {
        console.error(`חסרה עמודה "${name}" בלשונית "טקסט"`);
        process.exit(1);
    }
    return i;
};
const cId = col("ערך");
const cDecision = col("החלטה");
const cFind = col("טקסט באפליקציה (לתיקון)");
const cReplace = col("טקסט מתוקן");

const fixes: TextFix[] = [];
rows.slice(1).forEach((r, i) => {
    if (String(r[cDecision] ?? "").trim() !== "לתקן") return;
    fixes.push({
        row: i + 2, // שורה 1 היא הכותרת
        entryId: String(r[cId] ?? "").trim(),
        find: String(r[cFind] ?? ""),
        replace: String(r[cReplace] ?? ""),
    });
});
log(`בגיליון ${fixes.length} שורות "לתקן" (${sheetFile})`);

// ── הערכים ────────────────────────────────────────────────────────────────

let entries: Entry[];
type Db = import("firebase/firestore").Firestore;
let db: Db | undefined;
let email: string | undefined;

if (fromFile) {
    entries = JSON.parse(readFileSync(resolve(fromFile), "utf8")) as Entry[];
    log(`נטענו ${entries.length} ערכים מהקובץ ${fromFile} (לא מה-CMS)`);
} else {
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
    email = env.SEED_EMAIL;
    const password = env.SEED_PASSWORD;
    if (!email || !password) {
        console.error("חסרים SEED_EMAIL + SEED_PASSWORD (משתמש CMS בפרויקט התנ\"ך)");
        process.exit(1);
    }
    const { initializeApp } = await import("firebase/app");
    const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
    const { getFirestore, collection, getDocs } = await import("firebase/firestore");
    const app = initializeApp(firebaseConfig);
    log(`מתחבר ל-${firebaseConfig.projectId} בתור ${email}...`);
    await signInWithEmailAndPassword(getAuth(app), email, password);
    db = getFirestore(app);
    const snap = await getDocs(collection(db, ENTRIES_COLLECTION));
    entries = snap.docs.map(d => ({ ...(d.data() as Entry), id: d.id }));
    log(`נטענו ${entries.length} ערכים מה-CMS.`);
}
log();

// ── התיקונים ──────────────────────────────────────────────────────────────

const { changed, results } = applyTextFixes(entries, fixes);

const LABEL: Record<FixStatus, string> = {
    applied: "✓ יוחל",
    already: "= כבר תוקן",
    "not-found": "✗ הטקסט הישן לא נמצא",
    ambiguous: "✗ הטקסט הישן נמצא יותר מפעם אחת",
    "no-entry": "✗ אין ערך כזה",
    empty: "✗ חסר טקסט לתיקון בשורה",
};
const ORDER: FixStatus[] = ["not-found", "ambiguous", "empty", "no-entry", "already", "applied"];
const titleOf = new Map(entries.map(e => [e.id, e.title?.he ?? ""]));

const counts = ORDER.map(s => [s, results.filter(r => r.status === s).length] as const);
const head = [
    `שורות "לתקן": ${results.length}`,
    ...counts.filter(([, n]) => n).map(([s, n]) => `  ${LABEL[s]}: ${n}`),
    `ערכים שישתנו: ${changed.size}`,
];
head.forEach(l => log(l));

const report: string[] = [];
for (const status of ORDER) {
    const group = results.filter(r => r.status === status);
    if (!group.length) continue;
    report.push("", `── ${LABEL[status]} (${group.length}) ─────────────────────────────`);
    if (status !== "applied" && status !== "already") report.push("לא נוגעים בשורות האלה. לתקן בגיליון או ידנית ב-CMS.");
    for (const r of group as FixResult[]) {
        report.push(`\nשורה ${r.fix.row} · ${r.fix.entryId} · ${titleOf.get(r.fix.entryId) ?? ""}${r.field && r.field !== "body" ? `  [${r.field === "caption" ? "כיתוב תמונה" : "כותרת"}]` : ""}`);
        if (status === "applied") {
            report.push(`  לפני: ${r.before}`);
            report.push(`  אחרי: ${r.after}`);
        } else {
            report.push(`  מחפש: ${r.fix.find || "(ריק)"}`);
            if (r.fix.replace) report.push(`  מתוקן: ${r.fix.replace}`);
            if (r.before) report.push(`  נמצא ב: ${r.before}`);
        }
    }
}
writeFileSync(reportFile, [...head, ...report, ""].join("\n"));
log(`\nהדוח המלא: ${reportFile}`);

if (!write) {
    log("\nדוח בלבד, שום דבר לא נכתב. לכתיבה: --write");
    process.exit(0);
}
if (!changed.size) {
    log("\nאין מה לכתוב.");
    process.exit(0);
}

// ── גיבוי ואז כתיבה ───────────────────────────────────────────────────────

writeFileSync(backupFile, JSON.stringify(entries, null, 1));
log(`\nגיבוי של ${entries.length} הערכים: ${backupFile}`);

const { doc, runTransaction } = await import("firebase/firestore");
/** Firestore לא מקבל undefined */
const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const loadedAt = new Map(entries.map(e => [e.id, e.updatedAt]));

const now = Date.now();
let written = 0;
const skipped: string[] = [];
for (const entry of changed.values()) {
    const ref = doc(db!, ENTRIES_COLLECTION, entry.id);
    const ok = await runTransaction(db!, async tx => {
        const cur = await tx.get(ref);
        if (!cur.exists() || (cur.data() as Entry).updatedAt !== loadedAt.get(entry.id)) return false;
        tx.set(ref, stripUndefined(prepareEntryForSave(entry, email, now)));
        return true;
    });
    if (ok) written++;
    else skipped.push(entry.id);
    if (written % 25 === 0 && ok) log(`נכתבו ${written}/${changed.size}`);
}

log(`\nהסתיים: ${written} ערכים עודכנו.`);
if (skipped.length) log(`דולגו ${skipped.length} ערכים שהשתנו בזמן הריצה (להריץ שוב): ${skipped.join(", ")}`);
log(`לשחזור, אם משהו השתבש: ${backupFile}`);
log("כדי שהשינויים יגיעו לאפליקציה: לפרסם מה-CMS.");
process.exit(0);
