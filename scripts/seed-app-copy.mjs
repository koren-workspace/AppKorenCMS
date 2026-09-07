/**
 * seed-app-copy – הוספת מפתחות חדשים לקולקציית `app-copy` מקבצי ה-i18n של
 * האפליקציה, והשוואה בין מה שיושב ב-CMS לבין מה שכתוב בקוד.
 *
 * קורא את en.ts + he.ts מריפו koren-tefilla, מחלץ לכל מפתח:
 *   - הטקסטים בשתי השפות (טרנספילציה אמיתית עם typescript – לא regex על ערכים)
 *   - category: כותרת המדור (שורות `// ---- X ----` בקובץ en.ts)
 *   - description: שורות ההערה שמעל המפתח (אם יש)
 *   - order: סדר ההופעה בקובץ (לתצוגה יציבה ב-CMS)
 *
 * ואז כותב מסמך לכל מפתח שעדיין לא קיים בקולקציה, עם timestamp = Date.now().
 *
 * מסמכים קיימים לעולם לא נדרסים. זה מכוון ולא אופטימיזציה: ברגע שמפתח נזרע,
 * ה-CMS הוא הסמכות עליו והערך שבקוד משמש רק כגיבוי עד לסנכרון הראשון. גרסה
 * קודמת של הסקריפט כתבה מחדש כל מסמך שתוכנו שונה מהקוד — כלומר בדיוק את
 * המסמכים שנערכו ידנית — והרצה שלה הייתה מוחקת כל עריכה שנעשתה אי פעם ב-CMS.
 *
 * --compare מדפיס את הפער בין הקוד ל-CMS בלי לכתוב כלום: מפתחות שחסרים
 * ב-CMS, מפתחות שהטקסט שלהם שונה (שם שינוי בקוד לא מגיע למשתמשים — ה-CMS
 * גובר), ומפתחות שכבר לא קיימים בקוד.
 *
 * שימוש:
 *   node scripts/seed-app-copy.mjs --dry-run
 *   SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-app-copy.mjs --compare
 *   SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-app-copy.mjs
 *   SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-app-copy.mjs --env prod
 *   node scripts/seed-app-copy.mjs --app-repo /path/to/koren-tefilla --dry-run
 *
 * קונפיגורציה: קורא את .env.local (או .env) של ה-CMS —
 *   stage: VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_AUTH_DOMAIN
 *   prod:  VITE_PROD_FIREBASE_API_KEY / VITE_PROD_FIREBASE_PROJECT_ID
 * והזדהות עם משתמש CMS: SEED_EMAIL + SEED_PASSWORD (משתני סביבה).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmsRoot = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const compare = args.includes("--compare");
const envIndex = args.indexOf("--env");
const targetEnv = envIndex >= 0 ? args[envIndex + 1] : "stage";
const repoIndex = args.indexOf("--app-repo");
const appRepo =
    repoIndex >= 0
        ? resolve(args[repoIndex + 1])
        : resolve(cmsRoot, "..", "koren-tefilla");

if (targetEnv !== "stage" && targetEnv !== "prod") {
    console.error(`--env חייב להיות stage או prod (התקבל: ${targetEnv})`);
    process.exit(1);
}

const enPath = resolve(appRepo, "src/i18n/en.ts");
const hePath = resolve(appRepo, "src/i18n/he.ts");
if (!existsSync(enPath) || !existsSync(hePath)) {
    console.error(`קבצי i18n לא נמצאו תחת ${appRepo} — העבירו --app-repo לנתיב של koren-tefilla`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// .env loading (אין תלות ב-dotenv)
// ---------------------------------------------------------------------------

function loadEnvFile(path) {
    if (!existsSync(path)) return {};
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[match[1]] = value;
    }
    return out;
}

const fileEnv = {
    ...loadEnvFile(resolve(cmsRoot, ".env")),
    ...loadEnvFile(resolve(cmsRoot, ".env.local")),
};
const env = { ...fileEnv, ...process.env };

// ---------------------------------------------------------------------------
// i18n extraction — טרנספילציה של המודולים + פירוק הערות מהמקור
// ---------------------------------------------------------------------------

/** טרנספילציה של מודול TS ל-CJS והרצתו — מחזיר את ה-exports */
function loadTsModule(path) {
    const source = readFileSync(path, "utf8");
    const transpiled = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const moduleShim = { exports: {} };
    // ל-he.ts יש רק import type (נמחק בטרנספילציה) — require לא אמור להיקרא
    const fn = new Function("exports", "module", "require", transpiled);
    fn(moduleShim.exports, moduleShim, () => ({}));
    return moduleShim.exports;
}

/**
 * מחלץ מ-en.ts לכל מפתח את המדור (category) ואת התיאור (שורות ההערה שמעליו).
 * מזהה: `// ---- Section ----` כמדור; הערות `//` רצופות מעל מפתח כתיאור.
 */
function extractMetadata(sourcePath) {
    const lines = readFileSync(sourcePath, "utf8").split("\n");
    const meta = new Map(); // key → { category, description, order }
    let category = "General";
    let pendingComment = [];
    let order = 0;

    for (const rawLine of lines) {
        const line = rawLine.trim();

        const section = line.match(/^\/\/\s*----\s*(.+?)\s*----/);
        if (section) {
            category = section[1];
            pendingComment = [];
            continue;
        }
        if (line.startsWith("//")) {
            pendingComment.push(line.replace(/^\/\/\s?/, ""));
            continue;
        }
        const keyMatch = line.match(/^([a-z0-9_]+)\s*:/i);
        if (keyMatch) {
            meta.set(keyMatch[1], {
                category,
                description: pendingComment.join(" ").trim(),
                order: order++,
            });
        }
        if (line !== "") pendingComment = [];
    }
    return meta;
}

const { en } = loadTsModule(enPath);
const { he } = loadTsModule(hePath);
if (!en || !he) {
    console.error("טעינת en/he נכשלה — בדקו את קבצי ה-i18n");
    process.exit(1);
}
const metadata = extractMetadata(enPath);

const docs = Object.keys(en).map(key => {
    const meta = metadata.get(key) ?? { category: "General", description: "", order: 9999 };
    return {
        key,
        he: he[key] ?? "",
        en: en[key] ?? "",
        category: meta.category,
        description: meta.description,
        order: meta.order,
    };
});

console.log(`נמצאו ${docs.length} מפתחות ב-${enPath}`);
const categories = [...new Set(docs.map(d => d.category))];
console.log(`מדורים (${categories.length}): ${categories.join(" | ")}`);

if (dryRun && !compare) {
    console.log("\n--dry-run: שלושת המסמכים הראשונים לדוגמה:\n");
    console.log(JSON.stringify(docs.slice(0, 3), null, 2));
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Firebase write
// ---------------------------------------------------------------------------

const prefix = targetEnv === "prod" ? "VITE_PROD_FIREBASE" : "VITE_FIREBASE";
const firebaseConfig = {
    apiKey: env[`${prefix}_API_KEY`],
    authDomain: env[`${prefix}_AUTH_DOMAIN`],
    projectId: env[`${prefix}_PROJECT_ID`],
};
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error(`חסרים ${prefix}_API_KEY / ${prefix}_PROJECT_ID (ב-.env.local או בסביבה)`);
    process.exit(1);
}
const email = env.SEED_EMAIL;
const password = env.SEED_PASSWORD;
if (!email || !password) {
    console.error("חסרים SEED_EMAIL + SEED_PASSWORD (משתמש CMS מורשה)");
    process.exit(1);
}

const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const { getFirestore, collection, getDocs, writeBatch, doc } = await import("firebase/firestore");

const app = initializeApp(firebaseConfig);
console.log(`מתחבר ל-${targetEnv} (${firebaseConfig.projectId}) בתור ${email}...`);
await signInWithEmailAndPassword(getAuth(app), email, password);
const db = getFirestore(app);

const existing = new Map();
const snapshot = await getDocs(collection(db, "app-copy"));
for (const d of snapshot.docs) existing.set(d.id, d.data());

const missing = docs.filter(d => !existing.has(d.key));
const drifted = docs.filter(d => {
    const cur = existing.get(d.key);
    return cur && (cur.he !== d.he || cur.en !== d.en);
});

if (compare) {
    const codeKeys = new Set(docs.map(d => d.key));
    const orphans = [...existing.keys()].filter(key => !codeKeys.has(key));
    const short = value => (value.length > 70 ? `${value.slice(0, 70)}…` : value);

    console.log(`\nב-CMS: ${existing.size} מפתחות | בקוד: ${docs.length}`);

    console.log(`\n— חסרים ב-CMS (${missing.length}) — הרצה רגילה תוסיף אותם:`);
    for (const d of missing) console.log(`    ${d.key}  [${d.category}]`);

    console.log(`\n— טקסט שונה בין ה-CMS לקוד (${drifted.length}) — ה-CMS גובר, ולכן שינוי בקוד לא מגיע למשתמשים:`);
    for (const d of drifted) {
        const cur = existing.get(d.key);
        console.log(`    ${d.key}`);
        if (cur.he !== d.he) {
            console.log(`        he | CMS: ${short(cur.he)}`);
            console.log(`           | קוד: ${short(d.he)}`);
        }
        if (cur.en !== d.en) {
            console.log(`        en | CMS: ${short(cur.en)}`);
            console.log(`           | קוד: ${short(d.en)}`);
        }
    }

    console.log(`\n— ב-CMS אבל כבר לא קיימים בקוד (${orphans.length}):`);
    for (const key of orphans) console.log(`    ${key}`);

    process.exit(0);
}

console.log(`${existing.size} מסמכים קיימים; ${missing.length} מפתחות חדשים ייכתבו`);
if (drifted.length > 0) {
    console.log(`${drifted.length} מסמכים קיימים שהטקסט שלהם שונה מהקוד — לא נוגעים בהם (--compare לפירוט)`);
}

const now = Date.now();
const BATCH = 450;
for (let i = 0; i < missing.length; i += BATCH) {
    const batch = writeBatch(db);
    for (const d of missing.slice(i, i + BATCH)) {
        batch.set(doc(db, "app-copy", d.key), { ...d, timestamp: now });
    }
    await batch.commit();
    console.log(`נכתבו ${Math.min(i + BATCH, missing.length)}/${missing.length}`);
}

console.log(`הסתיים: ${missing.length} מפתחות חדשים נוספו (timestamp=${now}).`);
process.exit(0);
