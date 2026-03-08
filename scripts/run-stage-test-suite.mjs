/**
 * סוויטת בדיקות מול Firebase STAGE – כל סוגי השינויים + עומס
 *
 * ארגומנט אופציונלי: 1 = רק קטגוריה 1, 2 = רק קטגוריה 2, בלי ארגומנט = שתיהן.
 *
 * קטגוריה 1: שינוי אטומי, שינוי טקסט, שינוי מבנה (type), מחיקה רכה
 * קטגוריה 2: 1 / 5 / 20 / 100 עדכונים במקביל
 *
 * דרוש: GOOGLE_APPLICATION_CREDENTIALS, scripts/stage-test-config.json
 *
 * הרצה: npm run stage-test-suite [1|2]
 * או:   npm run stage-test-suite-1   /   npm run stage-test-suite-2
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BACKUP_FILE = join(ROOT, "scripts", ".stage-test-backup.json");
const CONFIG_FILE = join(ROOT, "scripts", "stage-test-config.json");

function loadConfig() {
    if (!existsSync(CONFIG_FILE)) {
        console.error("חסר קובץ תצורה. העתק stage-test-config.example.json ל-stage-test-config.json.");
        process.exit(1);
    }
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
}

function initFirebase(projectId) {
    if (admin.apps.length > 0) return admin.app();
    const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!cred || !existsSync(cred)) {
        console.error("הגדר GOOGLE_APPLICATION_CREDENTIALS.");
        process.exit(1);
    }
    return admin.initializeApp({ projectId: projectId || "koren-stage" });
}

async function getItemsInPart(db, translationId, prayerId, partId, excludeDeleted = false) {
    const col = db
        .collection("translations")
        .doc(translationId)
        .collection("prayers")
        .doc(prayerId)
        .collection("items");
    const snap = await col.where("partId", "==", partId).get();
    const items = [];
    snap.docs.forEach((d) => {
        const data = d.data();
        if (excludeDeleted && data?.deleted === true) return;
        items.push({ id: d.id, path: d.ref.path, values: data });
    });
    return items;
}

async function updateDoc(db, docPath, values) {
    const ref = db.doc(docPath);
    await ref.set({ ...values, timestamp: Date.now() }, { merge: true });
}

async function restoreDoc(db, backupItem) {
    await updateDoc(db, backupItem.path, backupItem.values);
}

function findBackup(backupItems, id) {
    return backupItems.find((b) => b.id === id);
}

async function runTest(name, fn) {
    process.stdout.write(`  ${name} ... `);
    try {
        await fn();
        console.log("OK");
    } catch (e) {
        console.log("FAIL");
        throw e;
    }
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
    
    // הוסיפו את השורה הזו כאן:
    db.settings({ preferRest: true }); 

    console.log("טוען פריטים ושומר גיבוי...");
    const allItems = await getItemsInPart(db, translationId, prayerId, partId, false);
    if (allItems.length === 0) {
        console.error("לא נמצאו פריטים במקטע. בדוק תצורה.");
        process.exit(1);
    }
    const activeItems = allItems.filter((i) => i.values?.deleted !== true);
    if (activeItems.length === 0) {
        console.error("אין פריטים פעילים (כולם deleted). בחר מקטע אחר.");
        process.exit(1);
    }

    const backup = {
        savedAt: new Date().toISOString(),
        projectId,
        translationId,
        prayerId,
        partId,
        items: allItems.map(({ id, path, values }) => ({ id, path, values })),
    };
    writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2), "utf8");
    const backupItems = backup.items;
    const mode = process.argv[2];
    const runCategory1 = !mode || mode === "1";
    const runCategory2 = !mode || mode === "2";
    if (!runCategory1 && !runCategory2) {
        console.error('ארגומנט לא תקין. השתמש ב-1 (קטגוריה 1), 2 (קטגוריה 2), או בלי ארגומנט (שתיהן).');
        process.exit(1);
    }
    console.log(`גיבוי: ${backupItems.length} פריטים (${activeItems.length} פעילים).`);

    const item0 = activeItems[0];
    const b0 = findBackup(backupItems, item0.id);
    if (!b0) throw new Error("פריט ראשון לא נמצא בגיבוי");

    if (runCategory1) {
        console.log("\n--- קטגוריה 1: תוכן ומבנה ---");
        // —— 1. שינוי אטומי (אות אחת)
        await runTest("שינוי אטומי (תיקון אות ב-content)", async () => {
        const prev = (item0.values.content || "").toString();
        const changed = prev.slice(0, 1) + "X" + (prev.length > 1 ? prev.slice(2) : "");
        await updateDoc(db, item0.path, { ...item0.values, content: changed });
        const after = await getItemsInPart(db, translationId, prayerId, partId, true);
        const found = after.find((i) => i.id === item0.id);
        if (!found || found.values.content !== changed) throw new Error("אימות נכשל");
        await restoreDoc(db, b0);
    });

    // —— 2. שינוי טקסט (הוספת מחרוזת)
    await runTest("שינוי טקסט (הוספת מחרוזת)", async () => {
        const suffix = " [STAGE_SUITE_STR]";
        const newContent = (item0.values.content || "") + suffix;
        await updateDoc(db, item0.path, { ...item0.values, content: newContent });
        const after = await getItemsInPart(db, translationId, prayerId, partId, true);
        const found = after.find((i) => i.id === item0.id);
        if (!found || found.values.content !== newContent) throw new Error("אימות נכשל");
        await restoreDoc(db, b0);
    });

    // —— 3. שינוי מבנה (שדה type)
    await runTest("שינוי מבנה (שדה type)", async () => {
        const newType = (item0.values.type === "title" ? "body" : "title");
        await updateDoc(db, item0.path, { ...item0.values, type: newType });
        const after = await getItemsInPart(db, translationId, prayerId, partId, true);
        const found = after.find((i) => i.id === item0.id);
        if (!found || found.values.type !== newType) throw new Error("אימות נכשל");
        await restoreDoc(db, b0);
    });

    // —— 4. מחיקה רכה
    await runTest("מחיקה רכה (deleted: true)", async () => {
        await updateDoc(db, item0.path, { ...item0.values, deleted: true });
        const afterDeleted = await getItemsInPart(db, translationId, prayerId, partId, true);
        if (afterDeleted.some((i) => i.id === item0.id)) throw new Error("פריט לא אמור להופיע אחרי מחיקה רכה");
        await updateDoc(db, item0.path, { ...item0.values, deleted: false });
        const afterRestore = await getItemsInPart(db, translationId, prayerId, partId, true);
        if (!afterRestore.find((i) => i.id === item0.id)) throw new Error("פריט אמור להופיע אחרי ביטול מחיקה");
        await restoreDoc(db, b0);
    });
    }

    if (runCategory2) {
        console.log("\n--- קטגוריה 2: עומס ---");
        const scaleCounts = [1, 5, 20, 100];
        for (const N of scaleCounts) {
            if (activeItems.length < N) {
                console.log(`  ${N} במקביל – דילוג (חסרים פריטים, יש ${activeItems.length})`);
                continue;
            }
            await runTest(`${N} עדכונים במקביל`, async () => {
            const toChange = activeItems.slice(0, N);
            const suffix = ` _scale_${N}_`;
            await Promise.all(
                toChange.map((item, i) => {
                    const newContent = (item.values.content || "") + suffix + i;
                    return updateDoc(db, item.path, { ...item.values, content: newContent });
                })
            );
            const after = await getItemsInPart(db, translationId, prayerId, partId, true);
            for (let i = 0; i < N; i++) {
                const item = toChange[i];
                const expected = (item.values.content || "") + suffix + i;
                const found = after.find((a) => a.id === item.id);
                if (!found || found.values.content !== expected) throw new Error(`אימות נכשל לפריט ${item.id}`);
            }
            const backupsToRestore = toChange.map((item) => findBackup(backupItems, item.id)).filter(Boolean);
            await Promise.all(backupsToRestore.map((b) => restoreDoc(db, b)));
            });
        }
    }

    console.log("\n--- החזרה מלאה ---");
    for (const b of backupItems) await restoreDoc(db, b);
    unlinkSync(BACKUP_FILE);
    console.log("הכל הוחזר. קובץ הגיבוי נמחק.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
