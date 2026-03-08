/**
 * סקריפט בדיקה על Firebase STAGE:
 * 1. מתחבר ל-Firestore (פרויקט koren-stage)
 * 2. טוען פריטים ממקטע נתון (לפי config)
 * 3. שומר גיבוי מלא לקובץ (.stage-test-backup.json)
 * 4. מבצע שינוי מדומה (עדכון תוכן פריט ראשון)
 * 5. קורא מחדש מ-Firestore ומאמת שהשינוי נשמר
 *
 * הרצה: npm run stage-test
 * דרוש: GOOGLE_APPLICATION_CREDENTIALS מצביע לקובץ Service Account של koren-stage
 * תצורה: scripts/stage-test-config.json (העתק מ-stage-test-config.example.json)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BACKUP_FILE = join(ROOT, "scripts", ".stage-test-backup.json");
const CONFIG_FILE = join(ROOT, "scripts", "stage-test-config.json");

function loadConfig() {
    if (!existsSync(CONFIG_FILE)) {
        console.error(
            "חסר קובץ תצורה. העתק את scripts/stage-test-config.example.json ל-stage-test-config.json וערוך לפי הנתונים ב-STAGE."
        );
        process.exit(1);
    }
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
}

function initFirebase(projectId) {
    if (admin.apps.length > 0) return admin.app();
    const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!cred || !existsSync(cred)) {
        console.error(
            "הגדר GOOGLE_APPLICATION_CREDENTIALS לנתיב לקובץ Service Account (JSON) של פרויקט koren-stage."
        );
        process.exit(1);
    }
    return admin.initializeApp({ projectId: projectId || "koren-stage" });
}

async function getItemsInPart(db, translationId, prayerId, partId) {
    const col = db
        .collection("translations")
        .doc(translationId)
        .collection("prayers")
        .doc(prayerId)
        .collection("items");
    const snap = await col.where("partId", "==", partId).get();
    const items = [];
    snap.docs.forEach((d) => {
        items.push({ id: d.id, path: d.ref.path, values: d.data() });
    });
    return items;
}

async function updateDoc(db, docPath, values) {
    const ref = db.doc(docPath);
    await ref.set({ ...values, timestamp: Date.now() }, { merge: true });
}

async function main() {
    const config = loadConfig();
    const { projectId, translationId, prayerId, partId } = config;
    if (!translationId || !prayerId || !partId) {
        console.error("בקובץ התצורה חסרים: translationId, prayerId, partId");
        process.exit(1);
    }

    initFirebase(projectId);
    const db = admin.firestore();

    console.log("מתחבר ל-Firestore וטוען פריטים...");
    const items = await getItemsInPart(db, translationId, prayerId, partId);
    if (items.length === 0) {
        console.error("לא נמצאו פריטים במקטע המבוקש. בדוק translationId, prayerId, partId.");
        process.exit(1);
    }
    console.log(`נטענו ${items.length} פריטים.`);

    const backup = {
        savedAt: new Date().toISOString(),
        projectId,
        translationId,
        prayerId,
        partId,
        items: items.map(({ id, path, values }) => ({ id, path, values })),
    };
    writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), "utf8");
    console.log(`גיבוי נשמר ב־${BACKUP_FILE}`);

    const first = items[0];
    const originalContent = first.values.content;
    const testContent = (originalContent || "") + " [STAGE_TEST]";

    console.log(`מבצע שינוי: פריט ${first.id}, content ← "... [STAGE_TEST]"`);
    await updateDoc(db, first.path, { ...first.values, content: testContent });

    console.log("קורא מחדש מ-Firestore לאימות...");
    const after = await getItemsInPart(db, translationId, prayerId, partId);
    const firstAfter = after.find((i) => i.id === first.id);
    if (!firstAfter || firstAfter.values.content !== testContent) {
        console.error("אימות נכשל: השינוי לא התקבל ב-Firestore.");
        process.exit(1);
    }
    console.log("אימות הצליח: השינוי נשמר ב-Firestore.");
    console.log("להחזרת המצב להרץ: npm run stage-revert");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
