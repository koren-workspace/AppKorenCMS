/**
 * migrate – העברת תוכן התנ"ך למטייל מהגיליון ל-Firestore (שלב 3, חד-פעמי).
 *
 * מקור האמת: הגיליון "ערכים" (Google Sheet, משותף לקריאה). מריפו האפליקציה
 * נלקח רק מה שאין בגיליון: הקישורים מהפסוקים לערכים (anchors.json), רמת
 * הביטחון של מיקומים שכבר היו באפליקציה (locations.json), וטקסט התנ"ך
 * לזיהוי ציטוטים בלי הפניה (tanakh/*.json).
 *
 * הרצה (מתיקיית ה-CMS, אחרי npm install):
 *
 *   npx vite-node scripts/tanakh/migrate.ts                     # דוח בלבד, בלי כתיבה
 *   npx vite-node scripts/tanakh/migrate.ts --report out.txt    # אותו דוח לקובץ
 *   SEED_EMAIL=... SEED_PASSWORD=... npx vite-node scripts/tanakh/migrate.ts --write
 *
 * אפשרויות:
 *   --app-repo <path>   ריפו האפליקציה (ברירת מחדל: ../Tanakh-LaMetayel)
 *   --sheet-id <id>     מזהה גיליון אחר (ברירת מחדל: הגיליון של המדריך)
 *   --csv <file>        קובץ CSV מקומי במקום הורדה מהגיליון
 *   --write             לכתוב ל-Firestore (בלי זה: דוח בלבד)
 *   --overwrite         לדרוס ערכים שכבר קיימים (ברירת מחדל: מדלג עליהם)
 *   --report <file>     לכתוב את הדוח המלא לקובץ
 *
 * שורות בלי מזהה: לשורה שיש לה כותרת ואין לה id בגיליון מוקצה מזהה. אם
 * הכותרת קיימת בתוכן האפוי של האפליקציה, המזהה הישן משמש (כך הקישורים
 * מהפסוקים והתמונות נשמרים); אחרת מזהה חדש ברצף (e0695, e0696, …). הדוח
 * מפרט את ההקצאות כדי להעתיק אותן לגיליון, והערך מסומן review.
 *
 * בטיחות: בלי --write שום דבר לא נכתב. עם --write, ערך שכבר קיים ב-Firestore
 * לא נדרס (אלא עם --overwrite) – כך הרצה חוזרת לא מוחקת עריכות שנעשו ב-CMS.
 *
 * קונפיגורציה: VITE_TLM_FIREBASE_* מ-.env.local (או .env) של ה-CMS, והזדהות
 * עם משתמש CMS של פרויקט התנ"ך: SEED_EMAIL + SEED_PASSWORD (משתני סביבה).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { GUIDE_SHEET_ID, GUIDE_SHEET_TAB, parseCsv, parseSheetRows, sheetCsvUrl } from "../../src/views/tanakh/model/fromSheet";
import {
    anchorsByEntry,
    buildTitleIndex,
    convertLegacyEntry,
    type LegacyAnchorMap,
    type LegacyEntry,
    type LegacyLocation,
} from "../../src/views/tanakh/model/fromLegacy";
import { applyAnchorFixes } from "../../src/views/tanakh/model/anchorFixes";
import { QuoteResolver, type TanakhBookText } from "../../src/views/tanakh/model/quoteResolver";
import { validateEntry } from "../../src/views/tanakh/model/validate";
import { LEGACY_CATEGORIES } from "../../src/views/tanakh/model/categories";
import { TANAKH_BOOKS } from "../../src/views/tanakh/model/tanakhBooks";
import { CATEGORIES_COLLECTION, ENTRIES_COLLECTION, type Entry } from "../../src/views/tanakh/model/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmsRoot = resolve(__dirname, "..", "..");

// ── ארגומנטים ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const write = flag("--write");
const overwrite = flag("--overwrite");
const appRepo = resolve(opt("--app-repo") ?? resolve(cmsRoot, "..", "Tanakh-LaMetayel"));
const sheetId = opt("--sheet-id") ?? GUIDE_SHEET_ID;
const csvFile = opt("--csv");
const reportFile = opt("--report");

const contentDir = resolve(appRepo, "assets", "content");
if (!existsSync(resolve(contentDir, "anchors.json"))) {
    console.error(`ריפו האפליקציה לא נמצא תחת ${appRepo} – העבירו --app-repo /path/to/Tanakh-LaMetayel`);
    process.exit(1);
}

// ── .env ──────────────────────────────────────────────────────────────────

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

// ── 1. הגיליון ────────────────────────────────────────────────────────────

const log = (s = "") => console.log(s);
log("התנ\"ך למטייל – העברת תוכן מהגיליון ל-Firestore");
log(`מצב: ${write ? (overwrite ? "כתיבה עם דריסה" : "כתיבה (ערכים קיימים לא נדרסים)") : "דוח בלבד"}`);
log();

let csvText: string;
if (csvFile) {
    csvText = readFileSync(resolve(csvFile), "utf8");
    log(`הגיליון נקרא מקובץ: ${csvFile}`);
} else {
    const url = sheetCsvUrl(sheetId, GUIDE_SHEET_TAB);
    log(`מוריד את הגיליון (טאב "${GUIDE_SHEET_TAB}")...`);
    const res = await fetch(url);
    if (!res.ok) {
        console.error(`ההורדה נכשלה: HTTP ${res.status}. הגיליון חייב להיות משותף "לכל מי שיש לו את הקישור – צפייה".`);
        process.exit(1);
    }
    csvText = await res.text();
}
// ── 2. מריפו האפליקציה: קישורים, מיקומים אפויים, טקסט התנ"ך ───────────────

const readJson = (f: string) => JSON.parse(readFileSync(resolve(contentDir, f), "utf8"));
const anchorMap: LegacyAnchorMap = readJson("anchors.json");
const bakedLocations = new Map<string, LegacyLocation>((readJson("locations.json") as LegacyLocation[]).map(l => [l.id, l]));
const bakedEntries = readJson("entries.json") as LegacyEntry[];
const bakedIds = new Set<string>(bakedEntries.map(e => e.id));
const anchorFixes = applyAnchorFixes(anchorMap);
const anchorsById = anchorsByEntry(anchorFixes.map);

// ── 3. הגיליון → ערכים; הקצאת מזהים לשורות בלי מזהה ───────────────────────

const allRows = parseCsv(csvText);
const usedIds = new Set<string>();
{
    // מזהים שכבר מופיעים בגיליון (כדי לא להקצות מזהה תפוס)
    const header = allRows[0] ?? [];
    const idCol = header.findIndex(h => h.includes("id") || h.includes("ID"));
    for (const r of allRows.slice(1)) if (r[idCol]?.trim()) usedIds.add(r[idCol].trim());
}
// זיהוי לפי כותרת מול התוכן האפוי, סלחני לכתיב מלא/חסר (אותו אלגוריתם של
// האפליקציה). גם ערכי הפניה ("ראה") נכללים: שורה בגיליון שמחליפה הפניה
// אפויה בערך מלא שומרת על המזהה הישן.
const findBakedByTitle = buildTitleIndex(bakedEntries.map(e => ({ ...e, see: undefined })));
const numericMax = Math.max(0, ...[...usedIds, ...bakedIds].map(id => Number((id.match(/^e(\d{4})$/) ?? [])[1] ?? 0)));
let nextNumber = numericMax + 1;
const assigned: { rowNumber: number; title: string; id: string; reused: boolean }[] = [];

const parsed = parseSheetRows(allRows, {
    idForRow: row => {
        const reused = findBakedByTitle(row.titleClean);
        let id: string;
        if (reused && !usedIds.has(reused)) {
            id = reused;
        } else {
            do id = `e${String(nextNumber++).padStart(4, "0")}`; while (usedIds.has(id));
        }
        usedIds.add(id);
        assigned.push({ rowNumber: row.rowNumber, title: row.title, id, reused: Boolean(reused && id === reused) });
        return id;
    },
});
log(`שורות תקינות: ${parsed.rows.length} (מהן ${assigned.length} בלי מזהה בגיליון – הוקצה מזהה)` + (parsed.skipped.length ? ` · דולגו (בלי כותרת): שורות ${parsed.skipped.join(", ")}` : ""));

const books: TanakhBookText[] = TANAKH_BOOKS.map(b => readJson(`tanakh/${b.id}.json`));
const resolver = new QuoteResolver(books);
log(`טקסט התנ"ך נטען: ${books.length} ספרים · קישורים מהפסוקים: ${[...anchorsById.values()].reduce((n, a) => n + a.length, 0)}`);
log(`תיקוני עוגנים: ${anchorFixes.applied.length} בוצעו` + (anchorFixes.missing.length ? ` · ${anchorFixes.missing.length} לא נמצאו (ראו דוח)` : ""));

// ── 4. המרה ───────────────────────────────────────────────────────────────

const legacyEntries = parsed.rows.map(r => r.entry);
const findByTitle = buildTitleIndex(legacyEntries);
const now = Date.now();
let quotesResolvedByText = 0;
const entries: Entry[] = parsed.rows.map(row => {
    const sheetLoc = row.location;
    const baked = bakedLocations.get(row.entry.id);
    let location: LegacyLocation | undefined = sheetLoc;
    if (sheetLoc && baked && Math.abs(baked.lat - sheetLoc.lat) < 1e-5 && Math.abs(baked.lng - sheetLoc.lng) < 1e-5) {
        location = { ...sheetLoc, conf: baked.conf }; // אותו מיקום – שומרים את רמת הביטחון שהייתה
    }
    const entry = convertLegacyEntry(
        row.entry,
        { findByTitle, location, anchors: anchorsById.get(row.entry.id), notes: row.notes },
        {
            now,
            updatedBy: "migration",
            resolveQuote: text => {
                const ref = resolver.resolve(text);
                if (ref) quotesResolvedByText++;
                return ref;
            },
        },
    );
    if (row.assignedId) entry.review.unshift(`המזהה ${entry.id} הוקצה בהעברה (שורה ${row.rowNumber} בגיליון הייתה בלי מזהה) – להעתיק לגיליון`);
    return entry;
});

// ── 5. דוח ────────────────────────────────────────────────────────────────

const ctx = { entryIds: new Set(entries.map(e => e.id)), categoryKeys: new Set(LEGACY_CATEGORIES.map(c => c.key)) };
const catName = new Map(LEGACY_CATEGORIES.map(c => [c.key, c.name.he]));
const report: string[] = [];
let errors = 0, warnings = 0, withReview = 0;
const summary = { quotes: 0, quotesInBody: 0, xrefsMissing: 0, locations: 0, images: 0, anchors: 0, redirects: 0 };
for (const e of entries) {
    const issues = validateEntry(e, ctx);
    const errs = issues.filter(i => i.level === "error");
    const warns = issues.filter(i => i.level === "warning");
    errors += errs.length;
    warnings += warns.length;
    if (e.review.length) withReview++;
    summary.quotes += e.quotes.length;
    summary.xrefsMissing += e.review.filter(r => r.startsWith("ערך קשור")).length;
    summary.quotesInBody += e.review.filter(r => r.startsWith("ציטוט")).length;
    if (e.location) summary.locations++;
    summary.images += e.images.length;
    summary.anchors += e.anchors.length;
    if (e.see) summary.redirects++;
    const rowWarnings = parsed.rows.find(r => r.entry.id === e.id)?.warnings ?? [];
    if (errs.length || warns.length || e.review.length || rowWarnings.length) {
        report.push(`\n${e.id} · ${e.title.he} · ${catName.get(e.cat)} · עמ' ${e.page ?? "?"}`);
        for (const x of errs) report.push(`  ✗ שגיאה (${x.field}): ${x.message}`);
        for (const x of rowWarnings) report.push(`  ! ${x}`);
        for (const x of e.review) report.push(`  - ${x}`);
        for (const x of warns) report.push(`  - אזהרה (${x.field}): ${x.message}`);
    }
}
const notInSheet = [...bakedIds].filter(id => !ctx.entryIds.has(id));
const newInSheet = entries.filter(e => !bakedIds.has(e.id)).map(e => e.id);

const bookHe = new Map(TANAKH_BOOKS.map(b => [b.id, b.he]));
const fixLine = (f: (typeof anchorFixes.applied)[number]) => {
    const at = `${bookHe.get(f.book) ?? f.book} ${f.ch}:${f.v}`;
    const to = f.to ? `→ ${f.to.entry ?? f.from}${f.to.ch || f.to.v ? ` ${f.to.ch ?? f.ch}:${f.to.v ?? f.v}` : ""}` : "→ ירד";
    return `  ${at} (${f.from}) ${to}  ${f.why}`;
};
const anchorFixLines = [
    "",
    `תיקוני עוגנים: ${anchorFixes.applied.length} בוצעו${anchorFixes.missing.length ? `, ${anchorFixes.missing.length} לא נמצאו` : ""}`,
    ...anchorFixes.applied.map(fixLine),
    ...(anchorFixes.missing.length ? ["", "תיקונים שלא נמצא להם עוגן (ייתכן ש-anchors.json השתנה):", ...anchorFixes.missing.map(fixLine)] : []),
];

const assignedLines = assigned.length
    ? ["", `מזהים שהוקצו לשורות בלי מזהה (להעתיק לעמודת id בגיליון):`, ...assigned.map(a => `  שורה ${a.rowNumber}: ${a.id}  ${a.title}${a.reused ? "  (מזהה קיים באפליקציה)" : ""}`)]
    : [];
const head = [
    `ערכים: ${entries.length} · הפניות ("ראה"): ${summary.redirects} · מיקומים: ${summary.locations} · תמונות: ${summary.images} · קישורים מהפסוקים: ${summary.anchors}`,
    `פסוקים כהפניה: ${summary.quotes} (מהם ${quotesResolvedByText} זוהו לפי טקסט) · ציטוטים שנשארו בגוף לבדיקה: ${summary.quotesInBody}`,
    `ערכים קשורים שלא נמצאו: ${summary.xrefsMissing} · ערכים עם הערת בדיקה: ${withReview} · אזהרות אימות: ${warnings} · שגיאות אימות: ${errors}`,
    `חדשים בגיליון (אין באפליקציה): ${newInSheet.length}${newInSheet.length ? " – " + newInSheet.join(", ") : ""}`,
    `באפליקציה ואין בגיליון (לא יועברו): ${notInSheet.length}${notInSheet.length ? " – " + notInSheet.join(", ") : ""}`,
];
log();
head.forEach(l => log(l));
if (reportFile) {
    writeFileSync(resolve(reportFile), [...head, ...anchorFixLines, ...assignedLines, "", "פירוט לפי ערך:", ...report, ""].join("\n"));
    log(`\nהדוח המלא נכתב ל-${reportFile}`);
} else {
    log(`\n(להדפסת הפירוט לפי ערך: --report out.txt)`);
}

if (errors > 0) {
    console.error(`\nיש ${errors} שגיאות אימות – לא כותבים. ראו את הדוח.`);
    process.exit(1);
}
if (!write) {
    log("\nדוח בלבד. להרצה עם כתיבה: --write");
    process.exit(0);
}

// ── 6. כתיבה ל-Firestore ──────────────────────────────────────────────────

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
log(`\nמתחבר ל-${firebaseConfig.projectId} בתור ${email}...`);
await signInWithEmailAndPassword(getAuth(app), email, password);
const db = getFirestore(app);

const existingEntries = new Set((await getDocs(collection(db, ENTRIES_COLLECTION))).docs.map(d => d.id));
const existingCategories = new Set((await getDocs(collection(db, CATEGORIES_COLLECTION))).docs.map(d => d.id));

const categoriesToWrite = LEGACY_CATEGORIES.filter(c => overwrite || !existingCategories.has(c.key));
const entriesToWrite = entries.filter(e => overwrite || !existingEntries.has(e.id));
log(`קטגוריות: ${categoriesToWrite.length} לכתיבה (${existingCategories.size} קיימות) · ערכים: ${entriesToWrite.length} לכתיבה (${existingEntries.size} קיימים${overwrite ? ", נדרסים" : ", מדולגים"})`);

/** Firestore לא מקבל undefined – מסירים שדות ריקים */
function stripUndefined<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

const BATCH = 400;
let written = 0;
let batch = writeBatch(db);
let inBatch = 0;
const flush = async () => {
    if (!inBatch) return;
    await batch.commit();
    written += inBatch;
    log(`נכתבו ${written}/${categoriesToWrite.length + entriesToWrite.length}`);
    batch = writeBatch(db);
    inBatch = 0;
};
for (const c of categoriesToWrite) {
    batch.set(doc(db, CATEGORIES_COLLECTION, c.key), stripUndefined(c));
    if (++inBatch >= BATCH) await flush();
}
for (const e of entriesToWrite) {
    batch.set(doc(db, ENTRIES_COLLECTION, e.id), stripUndefined(e));
    if (++inBatch >= BATCH) await flush();
}
await flush();

log(`\nהסתיים: ${categoriesToWrite.length} קטגוריות ו-${entriesToWrite.length} ערכים נכתבו ל-${firebaseConfig.projectId}.`);
process.exit(0);
