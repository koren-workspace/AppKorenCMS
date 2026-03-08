/**
 * סקריפט החזרת שינויים מבדיקת STAGE:
 * קורא את הגיבוי מ-.stage-test-backup.json ומחזיר כל פריט לערכו המקורי.
 *
 * הרצה: npm run stage-revert
 * דרוש: GOOGLE_APPLICATION_CREDENTIALS (כמו ב-run-stage-test)
 */

import { readFileSync, existsSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BACKUP_FILE = join(ROOT, "scripts", ".stage-test-backup.json");

function initFirebase(projectId) {
    if (admin.apps.length > 0) return admin.app();
    const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!cred || !existsSync(cred)) {
        console.error("הגדר GOOGLE_APPLICATION_CREDENTIALS.");
        process.exit(1);
    }
    return admin.initializeApp({ projectId: projectId || "koren-stage" });
}

async function main() {
    if (!existsSync(BACKUP_FILE)) {
        console.error("לא נמצא קובץ גיבוי. הרץ קודם: npm run stage-test");
        process.exit(1);
    }

    const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8"));
    const { projectId, items } = backup;
    if (!items || !items.length) {
        console.error("קובץ הגיבוי ריק או לא תקין.");
        process.exit(1);
    }

    initFirebase(projectId);
    const db = admin.firestore();

    console.log(`מחזיר ${items.length} פריטים למצב המקורי...`);
    for (const { id, path, values } of items) {
        const ref = db.doc(`${path}`);
        await ref.set({ ...values, timestamp: Date.now() }, { merge: true });
    }

    unlinkSync(BACKUP_FILE);
    console.log("ההחזרה הושלמה. קובץ הגיבוי נמחק.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
