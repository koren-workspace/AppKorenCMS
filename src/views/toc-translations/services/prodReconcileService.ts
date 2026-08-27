/**
 * prodReconcileService – פרסום לפרוד מבוסס־השוואה (reconciliation).
 *
 * הבעיה שזה פותר: רשימת "ממתינים לפרוד" (pendingProdItems) חיה בזיכרון הטאב
 * בלבד. סשן שנסגר בין "שמור מקטע" ל"שמירה לפרוד" מאבד את הכתיבות לפרוד לתמיד,
 * והאפליקציה (שמסתנכרנת מפרוד) ממשיכה להציג תוכן שנמחק או לא־מעודכן.
 *
 * הפתרון: בכל "פרסום לפרוד", לפני קידום ה־watermark, משווים סטייג' מול פרוד
 * ומעתיקים כל מסמך שסטייג' חדש בו יותר — כך כל פער שנוצר מסשן אבוד נסגר
 * אוטומטית בפרסום הבא.
 *
 * אלגוריתם (לנוסח הנבחר):
 *   1. עוגן: `lastReconcileTimestamp` במסמך `db-update-time/{tocId}` בפרוד —
 *      מתעדכן רק אחרי שההעתקה הושלמה בפועל (בשונה מ־maxTimestamp שמתעדכן גם
 *      כשפריטים לא הועתקו — הכשל המקורי). ריצה ראשונה (אין עוגן) סורקת הכל.
 *   2. לכל (translationId, prayerId) מה־TOC: שולפים מסטייג' פריטים עם
 *      timestamp >= עוגן−חפיפה, ומשווים מול העותק בפרוד.
 *   3. כלל העתקה: הערכים שונים (בהתעלם מ־timestamp) וגם סטייג' לא ישן יותר
 *      (stage.timestamp >= prod.timestamp). פרוד חדש יותר = עריכת פרוד ישירה —
 *      לא דורסים, רק מדווחים.
 *   4. מסמכים מועתקים נכתבים עם timestamp טרי — כדי שמכשירים (שה־watermark
 *      שלהם הוא זמן הפרסום הקודם) ימשכו אותם בסנכרון הבא.
 *   5. אותו תהליך גם על קולקציית `calendar` ועל מסמך `toc/{tocId}` — שגם להם
 *      יש מנגנוני "ממתינים" בזיכרון עם אותה נקודת כשל.
 *
 * עלות: אחרי הריצה הראשונה, כל פרסום סורק רק מה שהשתנה מאז הפרסום המוצלח
 * הקודם — בדרך כלל 0 עד עשרות מסמכים, שניות בודדות.
 */

import {
    collection,
    doc,
    documentId,
    getDoc,
    getDocs,
    getFirestore,
    query,
    where,
    writeBatch,
    type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { getProdFirestore } from "./prodAuthService";

/** חפיפה אחורה מהעוגן – מגינה מפני הפרשי שעונים ופרסום שרץ תוך כדי שמירה */
const OVERLAP_MS = 10 * 60 * 1000;
/** מעל כמות זו של מסמכים שהשתנו בתת־אוסף, מושכים את כל תת־האוסף מפרוד בשאילתה אחת */
const FULL_FETCH_THRESHOLD = 100;
/** מגבלת Firestore ל־where(documentId(), "in", ...) */
const ID_IN_CHUNK = 30;
/** מתחת למגבלת 500 של writeBatch */
const WRITE_BATCH_SIZE = 450;
/** כמה תת־אוספים נסרקים במקביל */
const PAIR_CONCURRENCY = 5;

export type TranslationPrayerPair = { translationId: string; prayerId: string };

export type ReconcileResult = {
    /** כמה מסמכי סטייג' נבדקו (בטווח הזמן שנסרק) */
    scannedDocs: number;
    /** כמה מסמכי פריטים הועתקו לפרוד */
    copiedItems: number;
    /** כמה מסמכי לוח שנה הועתקו לפרוד */
    copiedCalendar: number;
    /** האם מסמך ה־TOC הועתק */
    copiedToc: boolean;
    /** מסמכים שנמצאו שונים אבל פרוד חדש יותר – לא נדרסו (עריכות פרוד ישירות) */
    skippedProdNewer: Array<{ path: string; docId: string }>;
    /** true בריצה הראשונה (אין עוגן – נסרק הכל) */
    firstRun: boolean;
};

export type ReconcileProgress = (message: string) => void;

/** אוסף את כל צמדי (translationId, prayerId) מתוך אובייקט ה־TOC של הנוסח */
export function collectTranslationPrayerPairs(tocData: any): TranslationPrayerPair[] {
    const pairs: TranslationPrayerPair[] = [];
    for (const trans of tocData?.translations ?? []) {
        const translationId = trans?.translationId;
        if (!translationId) continue;
        const seen = new Set<string>();
        for (const cat of trans.categories ?? []) {
            for (const prayer of cat.prayers ?? []) {
                const prayerId = prayer?.id;
                if (prayerId && !seen.has(prayerId)) {
                    seen.add(prayerId);
                    pairs.push({ translationId, prayerId });
                }
            }
        }
    }
    return pairs;
}

/** השוואה עמוקה של ערכי מסמך, בהתעלם מ־timestamp (כתיבה כפולה מטביעה חותמות שונות) */
export function itemValuesEqual(a: Record<string, any>, b: Record<string, any>): boolean {
    return deepEqual(stripTimestamp(a), stripTimestamp(b));
}

function stripTimestamp(values: Record<string, any>): Record<string, any> {
    const { timestamp: _timestamp, ...rest } = values ?? {};
    return rest;
}

function deepEqual(a: any, b: any): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => deepEqual(v, b[i]));
    }
    if (a !== null && b !== null && typeof a === "object") {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((k) => deepEqual(a[k], b[k]));
    }
    return false;
}

/**
 * כלל ההעתקה: מעתיקים כשפרוד חסר את המסמך, או כשהערכים שונים וסטייג' לא ישן
 * יותר. פרוד חדש יותר עם ערכים שונים = עריכת פרוד ישירה; לא דורסים.
 */
export function shouldCopyToProd(
    stageData: Record<string, any>,
    prodData: Record<string, any> | undefined
): "copy" | "skip-equal" | "skip-prod-newer" {
    if (prodData === undefined) return "copy";
    if (itemValuesEqual(stageData, prodData)) return "skip-equal";
    const stageTs = Number(stageData?.timestamp ?? 0);
    const prodTs = Number(prodData?.timestamp ?? 0);
    return stageTs >= prodTs ? "copy" : "skip-prod-newer";
}

type PendingCopy = { path: string; docId: string; data: Record<string, any> };

/** מריץ מיפוי אסינכרוני עם מגבלת מקביליות */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (nextIndex < items.length) {
            const i = nextIndex++;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

/** שולף מסמכי פרוד לפי מזהים (ב־chunks של documentId in) או את כל תת־האוסף אם המזהים רבים */
async function fetchProdDocsById(
    prodDb: Firestore,
    path: string,
    ids: string[]
): Promise<Map<string, Record<string, any>>> {
    const prodCol = collection(prodDb, path);
    const map = new Map<string, Record<string, any>>();
    if (ids.length > FULL_FETCH_THRESHOLD) {
        const all = await getDocs(prodCol);
        all.forEach((d) => map.set(d.id, d.data()));
        return map;
    }
    for (let i = 0; i < ids.length; i += ID_IN_CHUNK) {
        const chunk = ids.slice(i, i + ID_IN_CHUNK);
        const snap = await getDocs(query(prodCol, where(documentId(), "in", chunk)));
        snap.forEach((d) => map.set(d.id, d.data()));
    }
    return map;
}

/** משווה תת־אוסף אחד (סטייג' מול פרוד) ומחזיר את המסמכים שצריך להעתיק */
async function reconcileCollection(
    stageDb: Firestore,
    prodDb: Firestore,
    path: string,
    since: number,
    now: number,
    skippedProdNewer: Array<{ path: string; docId: string }>
): Promise<{ scanned: number; copies: PendingCopy[] }> {
    const stageCol = collection(stageDb, path);
    const stageSnap = await getDocs(
        since > 0 ? query(stageCol, where("timestamp", ">=", since)) : stageCol
    );
    if (stageSnap.empty) return { scanned: 0, copies: [] };

    const prodMap = await fetchProdDocsById(
        prodDb,
        path,
        stageSnap.docs.map((d) => d.id)
    );

    const copies: PendingCopy[] = [];
    for (const stageDoc of stageSnap.docs) {
        const stageData = stageDoc.data();
        const decision = shouldCopyToProd(stageData, prodMap.get(stageDoc.id));
        if (decision === "copy") {
            // timestamp טרי – כדי שמכשירים עם watermark מהפרסום הקודם ימשכו את המסמך
            copies.push({ path, docId: stageDoc.id, data: { ...stageData, timestamp: now } });
        } else if (decision === "skip-prod-newer") {
            skippedProdNewer.push({ path, docId: stageDoc.id });
        }
    }
    return { scanned: stageSnap.size, copies };
}

/**
 * סנכרון מבוסס־השוואה של נוסח שלם: פריטים + לוח שנה + מסמך TOC.
 * לא מעדכן את העוגן — זה באחריות הקורא (doPublishToProd), אחרי שגם ה־watermark
 * וה־Bagel עודכנו, כדי שכשל באמצע ישאיר את העוגן מאחור והריצה הבאה תשלים.
 */
export async function reconcileNusachToProd(params: {
    tocData: any;
    tocId: string;
    onProgress?: ReconcileProgress;
}): Promise<ReconcileResult> {
    const { tocData, tocId, onProgress } = params;
    const stageDb = getFirestore(getFirebaseApp());
    const prodDb = getProdFirestore();
    const now = Date.now();

    const anchorSnap = await getDoc(doc(prodDb, "db-update-time", tocId));
    const lastReconcile = Number(anchorSnap.data()?.lastReconcileTimestamp ?? 0);
    const firstRun = !(lastReconcile > 0);
    const since = firstRun ? 0 : lastReconcile - OVERLAP_MS;

    const pairs = collectTranslationPrayerPairs(tocData);
    onProgress?.(
        firstRun
            ? `השוואה מלאה ראשונה מול פרוד (${pairs.length} תתי־אוספים)...`
            : `משווה שינויים מול פרוד...`
    );

    const skippedProdNewer: Array<{ path: string; docId: string }> = [];
    let scannedDocs = 0;
    const itemCopies: PendingCopy[] = [];

    const pairResults = await mapWithConcurrency(pairs, PAIR_CONCURRENCY, (pair) =>
        reconcileCollection(
            stageDb,
            prodDb,
            `translations/${pair.translationId}/prayers/${pair.prayerId}/items`,
            since,
            now,
            skippedProdNewer
        )
    );
    for (const r of pairResults) {
        scannedDocs += r.scanned;
        itemCopies.push(...r.copies);
    }

    // לוח שנה – אותו כלל, קולקציה אחת
    const calendarResult = await reconcileCollection(
        stageDb,
        prodDb,
        "calendar",
        since,
        now,
        skippedProdNewer
    );
    scannedDocs += calendarResult.scanned;

    // מסמך ה־TOC של הנוסח
    let copiedToc = false;
    const stageTocSnap = await getDoc(doc(stageDb, "toc", tocId));
    if (stageTocSnap.exists()) {
        const prodTocSnap = await getDoc(doc(prodDb, "toc", tocId));
        const decision = shouldCopyToProd(
            stageTocSnap.data() as Record<string, any>,
            prodTocSnap.exists() ? (prodTocSnap.data() as Record<string, any>) : undefined
        );
        if (decision === "copy") copiedToc = true;
        else if (decision === "skip-prod-newer")
            skippedProdNewer.push({ path: "toc", docId: tocId });
    }

    const allCopies: PendingCopy[] = [...itemCopies, ...calendarResult.copies];
    if (copiedToc) {
        allCopies.push({
            path: "toc",
            docId: tocId,
            data: { ...(stageTocSnap.data() as Record<string, any>), timestamp: now },
        });
    }

    if (allCopies.length > 0) {
        onProgress?.(`מעתיק ${allCopies.length} מסמכים לפרוד...`);
        for (let i = 0; i < allCopies.length; i += WRITE_BATCH_SIZE) {
            const batch = writeBatch(prodDb);
            for (const copy of allCopies.slice(i, i + WRITE_BATCH_SIZE)) {
                // set ללא merge – פרוד הופך לעותק מדויק של סטייג' (כולל שדות שהוסרו)
                batch.set(doc(prodDb, copy.path, copy.docId), copy.data);
            }
            await batch.commit();
        }
    }

    if (skippedProdNewer.length > 0) {
        console.warn(
            `[CMS] reconcileNusachToProd: ${skippedProdNewer.length} docs differ but prod is newer (direct prod edits?) – NOT overwritten:`,
            skippedProdNewer
        );
    }

    return {
        scannedDocs,
        copiedItems: itemCopies.length,
        copiedCalendar: calendarResult.copies.length,
        copiedToc,
        skippedProdNewer,
        firstRun,
    };
}
