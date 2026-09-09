/**
 * compare-stage-prod-items – סורק את סטייג' ואת פרוד ומדווח על פריטים שנבדלים
 * ביניהם. קריאה בלבד: הסקריפט לא כותב כלום, בשום סביבה.
 *
 * למה זה קיים
 * ------------
 * עד לתיקון של ספטמבר 2026 היו שני מסלולי כתיבה שלא הסכימו ביניהם:
 *
 *   1. הכתיבה לסטייג' ניקתה שדות ברירת מחדל על ידי *מחיקת המפתח*. כל הכתיבות
 *      הן merge, ולכן השמטת מפתח אומרת "אל תיגע בשדה" — והערך הישן שרד.
 *      כלומר הורדת ✓ מפריט קיים לא נשמרה בסטייג' בכלל.
 *   2. העותק לפרוד לא ניקה כלום, ושלח למשל noSpace: false במפורש — ולכן דווקא
 *      *הוא* קלט את הכוונה של העורך.
 *
 * התוצאה: פריטים שבסטייג' נשאר בהם הערך הישן ובפרוד יושב הערך החדש. הפרסום
 * מיישר פרוד לפי סטייג', אז ברגע שמישהו יערוך שוב פריט כזה — הערך הישן יחזור
 * לפרוד והעריכה תתבטל, חודשים אחרי שנעשתה.
 *
 * הסקריפט מוצא בדיוק את הפריטים האלה כדי שאפשר יהיה לתקן אותם ביד לפני שזה
 * קורה. הוא לא מתקן — התיקון הוא לפתוח את הפריט ב-CMS, לקבוע את הערך הנכון
 * ולשמור, עכשיו כשהכתיבה עובדת.
 *
 * הקטגוריות בדוח
 * ---------------
 *   conflict     שדה קיים בשני הצדדים עם ערכים שונים (למשל noSpace: true מול
 *                false), או קיים בצד אחד עם ערך אמיתי וחסר בשני. ← אלה שחשובים.
 *   default-only הפרש רק בשדות ברירת מחדל שנשארו בצד אחד (bold: false מול
 *                היעדר השדה). שקול מבחינת האפליקציה — היא מסננת אותם בסנכרון
 *                (sync.ts, isBool/isNonEmptyString) — ורק רעש.
 *   stage-only   המסמך קיים בסטייג' ולא בפרוד (טרם פורסם, או פרסום שנכשל).
 *   prod-only    המסמך קיים בפרוד ולא בסטייג'. נדיר; שווה בדיקה ידנית.
 *
 * לכל conflict מודפס גם מה הפרסום הבא יעשה, לפי אותו כלל שב-prodReconcileService:
 * סטייג' לא ישן יותר → סטייג' ידרוס את פרוד; פרוד חדש יותר → הפרסום ידלג ויתריע.
 *
 * שימוש
 * ------
 *   SEED_EMAIL=... SEED_PASSWORD=... node scripts/compare-stage-prod-items.mjs
 *   ... node scripts/compare-stage-prod-items.mjs --nusach ashkenaz
 *   ... node scripts/compare-stage-prod-items.mjs --samples 40
 *   ... node scripts/compare-stage-prod-items.mjs --json /tmp/diff.json
 *
 * הדוח הקריא נכתב ל-stdout, והודעות המצב וההתקדמות ל-stderr.
 *
 * לכתיבה לקובץ העדיפו את --out על פני הפניה של המעטפת: ב-PowerShell הפניה
 * עם `>` מקודדת UTF-16 ומשבשת את העברית, ו---out כותב UTF-8 בכל מערכת:
 *   node scripts/compare-stage-prod-items.mjs --nusach ashkenaz --samples 1000 --out report.txt
 *
 * קונפיגורציה: נקרא מ-.env.local (או .env) של ה-CMS —
 *   stage: VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_AUTH_DOMAIN
 *   prod:  VITE_PROD_FIREBASE_API_KEY / VITE_PROD_FIREBASE_PROJECT_ID / VITE_PROD_FIREBASE_AUTH_DOMAIN
 * הזדהות: SEED_EMAIL + SEED_PASSWORD לסטייג'. לפרוד — PROD_SEED_EMAIL +
 * PROD_SEED_PASSWORD, ואם אינם מוגדרים נעשה שימוש באותם פרטים.
 *
 * עלות: קריאת כל הפריטים בשני הפרויקטים. לנוסח שלם זה עשרות אלפי קריאות
 * מסמכים, אז עדיף להתחיל עם --nusach אחד. הסקריפט מדפיס בסוף כמה מסמכים קרא.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    diffDocs,
    nextPublishOutcome,
} from "./lib/stage-prod-diff.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cmsRoot = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
    console.log(
        [
            "compare-stage-prod-items – משווה פריטים בין סטייג' לפרוד (קריאה בלבד)",
            "",
            "  --nusach <id>    להשוות נוסח אחד בלבד (אפשר לחזור על הדגל)",
            "  --samples <n>    כמה דוגמאות להדפיס לכל קטגוריה (ברירת מחדל 20)",
            "  --out <path>     לכתוב את הדוח הקריא לקובץ (UTF-8)",
            "  --json <path>    לכתוב את הדוח המלא כ-JSON",
            "  --help           העזרה הזו",
        ].join("\n")
    );
    process.exit(0);
}

function argValues(flag) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === flag && args[i + 1]) out.push(args[i + 1]);
    }
    return out;
}

const onlyNusachim = argValues("--nusach");
const samplesArg = argValues("--samples")[0];
const sampleLimit = samplesArg ? Number(samplesArg) : 20;
const jsonPath = argValues("--json")[0];
const outPath = argValues("--out")[0];

if (!Number.isFinite(sampleLimit) || sampleLimit < 0) {
    console.error(`--samples חייב להיות מספר (התקבל: ${samplesArg})`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------

function loadEnvFile(path) {
    if (!existsSync(path)) return {};
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        let value = match[2];
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[match[1]] = value;
    }
    return out;
}

const env = {
    ...loadEnvFile(resolve(cmsRoot, ".env")),
    ...loadEnvFile(resolve(cmsRoot, ".env.local")),
    ...process.env,
};

function firebaseConfigFor(prefix) {
    return {
        apiKey: env[`${prefix}_API_KEY`],
        authDomain: env[`${prefix}_AUTH_DOMAIN`],
        projectId: env[`${prefix}_PROJECT_ID`],
    };
}

const stageConfig = firebaseConfigFor("VITE_FIREBASE");
const prodConfig = firebaseConfigFor("VITE_PROD_FIREBASE");

for (const [label, config, prefix] of [
    ["סטייג'", stageConfig, "VITE_FIREBASE"],
    ["פרוד", prodConfig, "VITE_PROD_FIREBASE"],
]) {
    if (!config.apiKey || !config.projectId) {
        console.error(`חסרה קונפיגורציה ל-${label}: ${prefix}_API_KEY / ${prefix}_PROJECT_ID`);
        process.exit(1);
    }
}

const stageEmail = env.SEED_EMAIL;
const stagePassword = env.SEED_PASSWORD;
const prodEmail = env.PROD_SEED_EMAIL || stageEmail;
const prodPassword = env.PROD_SEED_PASSWORD || stagePassword;

if (!stageEmail || !stagePassword) {
    console.error("חסרים SEED_EMAIL + SEED_PASSWORD (משתמש CMS מורשה)");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Firebase
// ---------------------------------------------------------------------------

const { initializeApp } = await import("firebase/app");
const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
const { getFirestore, collection, getDocs } = await import("firebase/firestore");

const stageApp = initializeApp(stageConfig, "stage");
const prodApp = initializeApp(prodConfig, "prod");

// הודעות מצב והתקדמות ל-stderr, כדי ש-`> report.txt` יקבל את הדוח בלבד
console.error(`מתחבר לסטייג' (${stageConfig.projectId}) בתור ${stageEmail}...`);
await signInWithEmailAndPassword(getAuth(stageApp), stageEmail, stagePassword);
console.error(`מתחבר לפרוד (${prodConfig.projectId}) בתור ${prodEmail}...`);
await signInWithEmailAndPassword(getAuth(prodApp), prodEmail, prodPassword);

const stageDb = getFirestore(stageApp);
const prodDb = getFirestore(prodApp);

let docsRead = 0;

async function readCollection(db, path) {
    const snap = await getDocs(collection(db, path));
    docsRead += snap.size;
    const map = new Map();
    snap.forEach((d) => map.set(d.id, d.data()));
    return map;
}

async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return results;
}

// ---------------------------------------------------------------------------
// איסוף תתי-האוספים להשוואה, מתוך מסמכי ה-TOC של סטייג'
// ---------------------------------------------------------------------------

const tocDocs = await readCollection(stageDb, "toc");
const nusachim = [...tocDocs.entries()]
    .filter(([, values]) => values?.deleted !== true)
    .filter(([id]) => onlyNusachim.length === 0 || onlyNusachim.includes(id));

if (nusachim.length === 0) {
    console.error(
        onlyNusachim.length > 0
            ? `לא נמצא נוסח בשם ${onlyNusachim.join(", ")} ב-toc של סטייג'`
            : "לא נמצאו נוסחים ב-toc של סטייג'"
    );
    process.exit(1);
}

const pairs = [];
for (const [tocId, tocData] of nusachim) {
    for (const trans of tocData?.translations ?? []) {
        const translationId = trans?.translationId;
        if (!translationId) continue;
        const seen = new Set();
        for (const cat of trans.categories ?? []) {
            for (const prayer of cat.prayers ?? []) {
                const prayerId = prayer?.id;
                if (prayerId && !seen.has(prayerId)) {
                    seen.add(prayerId);
                    pairs.push({ tocId, translationId, prayerId });
                }
            }
        }
    }
}

console.error(
    `\nמשווה ${nusachim.length} נוסחים (${nusachim.map(([id]) => id).join(", ")}) — ` +
        `${pairs.length} תתי־אוספים. זה עשוי לקחת כמה דקות.\n`
);

// ---------------------------------------------------------------------------
// ההשוואה
// ---------------------------------------------------------------------------

const findings = { conflict: [], defaultOnly: [], stageOnly: [], prodOnly: [] };
let comparedDocs = 0;
let identicalDocs = 0;

function record(entry, diffs) {
    const real = diffs.filter((d) => !d.noise);
    if (real.length === 0) {
        findings.defaultOnly.push({ ...entry, diffs });
        return;
    }
    findings.conflict.push({
        ...entry,
        diffs: real,
        noiseCount: diffs.length - real.length,
        nextPublish: nextPublishOutcome(entry.stageTimestamp, entry.prodTimestamp),
    });
}

async function comparePath(path, label) {
    const [stageMap, prodMap] = await Promise.all([
        readCollection(stageDb, path),
        readCollection(prodDb, path),
    ]);

    for (const [docId, stageData] of stageMap) {
        const prodData = prodMap.get(docId);
        const entry = {
            ...label,
            path,
            docId,
            stageTimestamp: stageData?.timestamp,
            prodTimestamp: prodData?.timestamp,
            content:
                typeof stageData?.content === "string"
                    ? stageData.content.slice(0, 60)
                    : undefined,
        };
        if (prodData === undefined) {
            findings.stageOnly.push(entry);
            continue;
        }
        comparedDocs++;
        const diffs = diffDocs(stageData, prodData);
        if (diffs.length === 0) identicalDocs++;
        else record(entry, diffs);
    }

    for (const [docId, prodData] of prodMap) {
        if (stageMap.has(docId)) continue;
        findings.prodOnly.push({
            ...label,
            path,
            docId,
            prodTimestamp: prodData?.timestamp,
        });
    }
}

let done = 0;
await mapWithConcurrency(pairs, 5, async (pair) => {
    await comparePath(
        `translations/${pair.translationId}/prayers/${pair.prayerId}/items`,
        { tocId: pair.tocId, translationId: pair.translationId, prayerId: pair.prayerId }
    );
    done++;
    if (done % 25 === 0 || done === pairs.length) {
        process.stderr.write(`\r  נסרקו ${done}/${pairs.length} תתי־אוספים…`);
    }
});
process.stderr.write("\n");

// לוח שנה – קולקציה אחת, גלובלית לכל הנוסחים
await comparePath("calendar", { kind: "calendar" });

// ---------------------------------------------------------------------------
// הדוח
// ---------------------------------------------------------------------------

/**
 * כותב שורת דוח למסך, ואוגר אותה לכתיבה ל---out.
 * הכתיבה לקובץ נעשית כאן ולא בהפניה של המעטפת (`> report.txt`) בכוונה:
 * ב-PowerShell הפניה כזו מקודדת ב-UTF-16 ומשבשת את העברית. writeFileSync
 * כותב UTF-8 בכל מערכת הפעלה.
 */
const reportLines = [];
const say = (line = "") => {
    reportLines.push(line);
    console.log(line);
};

const short = (v) => {
    if (v === undefined) return "(אין שדה)";
    if (typeof v === "string") return v.length > 40 ? `"${v.slice(0, 40)}…"` : `"${v}"`;
    return JSON.stringify(v);
};

say(`\n${"=".repeat(72)}`);
say(`נקראו ${docsRead} מסמכים | הושוו ${comparedDocs} | זהים ${identicalDocs}`);
say(`${"=".repeat(72)}\n`);

say(`⚠  התנגשויות אמיתיות: ${findings.conflict.length}`);
say(`   רעש ברירת מחדל בלבד: ${findings.defaultOnly.length}`);
say(`   קיימים רק בסטייג': ${findings.stageOnly.length}`);
say(`   קיימים רק בפרוד: ${findings.prodOnly.length}\n`);

if (findings.conflict.length > 0) {
    say("— התנגשויות אמיתיות (אלה שדורשות טיפול) —\n");
    for (const f of findings.conflict.slice(0, sampleLimit)) {
        const where = f.kind === "calendar" ? "calendar" : `${f.translationId} · ${f.prayerId}`;
        say(`  ${where} · ${f.docId}`);
        if (f.content) say(`    ${f.content}`);
        for (const d of f.diffs) {
            say(`    ${d.field}:  סטייג' ${short(d.stage)}  |  פרוד ${short(d.prod)}`);
        }
        say(`    → ${f.nextPublish}`);
        if (f.noiseCount > 0) say(`    (ועוד ${f.noiseCount} הפרשי ברירת מחדל)`);
        say("");
    }
    if (findings.conflict.length > sampleLimit) {
        say(`  … ועוד ${findings.conflict.length - sampleLimit}. השתמשו ב---json לרשימה המלאה.\n`);
    }
}

if (findings.stageOnly.length > 0) {
    say(`— קיימים רק בסטייג' (${findings.stageOnly.length}) — יועתקו בפרסום הבא —\n`);
    for (const f of findings.stageOnly.slice(0, sampleLimit)) {
        const where = f.kind === "calendar" ? "calendar" : `${f.translationId} · ${f.prayerId}`;
        say(`  ${where} · ${f.docId}${f.content ? `  ${f.content}` : ""}`);
    }
    if (findings.stageOnly.length > sampleLimit) {
        say(`  … ועוד ${findings.stageOnly.length - sampleLimit}`);
    }
    say("");
}

if (findings.prodOnly.length > 0) {
    say(`— קיימים רק בפרוד (${findings.prodOnly.length}) — לא ימחקו בפרסום —\n`);
    for (const f of findings.prodOnly.slice(0, sampleLimit)) {
        const where = f.kind === "calendar" ? "calendar" : `${f.translationId} · ${f.prayerId}`;
        say(`  ${where} · ${f.docId}`);
    }
    if (findings.prodOnly.length > sampleLimit) {
        say(`  … ועוד ${findings.prodOnly.length - sampleLimit}`);
    }
    say("");
}

if (findings.conflict.length === 0) {
    say("אין התנגשויות אמיתיות בין סטייג' לפרוד. ✓");
}

if (outPath) {
    writeFileSync(resolve(outPath), `${reportLines.join("\n")}\n`, "utf8");
    console.error(`הדוח הקריא נכתב ל-${resolve(outPath)}`);
}

if (jsonPath) {
    writeFileSync(
        resolve(jsonPath),
        JSON.stringify(
            {
                generatedAt: new Date().toISOString(),
                stageProject: stageConfig.projectId,
                prodProject: prodConfig.projectId,
                nusachim: nusachim.map(([id]) => id),
                stats: { docsRead, comparedDocs, identicalDocs },
                findings,
            },
            null,
            2
        ),
        "utf8"
    );
    console.error(`הדוח המלא נכתב ל-${resolve(jsonPath)}`);
}

process.exit(0);
