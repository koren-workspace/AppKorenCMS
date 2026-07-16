/**
 * appCopyService – טעינה, שמירה ופרסום של טקסטי האפליקציה (קולקציית app-copy)
 *
 * פונקציות "טהורות" ללא state/UI (בתבנית partEditService):
 *  - loadAppCopy:          טוען את כל המסמכים מ-Stage
 *  - saveAppCopyChanges:   שומר מפתחות שהשתנו ל-Stage (batch, timestamp חדש)
 *  - loadProdAppCopy:      טוען את כל המסמכים מפרוד (אחרי אימות פרוד)
 *  - diffForPublish:       מחשב אילו מפתחות שונים בין Stage לפרוד
 *  - publishAppCopyToProd: כותב את המפתחות השונים לפרוד עם timestamp חדש
 *
 * חשוב: האפליקציה מסתנכרנת מ-פרוד לפי `timestamp >= watermark`, לכן כל
 * כתיבה (Stage או פרוד) מציבה timestamp = Date.now().
 */

import {
    collection,
    doc as firestoreDoc,
    getDocs,
    getFirestore,
    writeBatch,
    type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { getProdFirestore } from "../../toc-translations/services/prodAuthService";
import type { AppCopyDoc } from "../types";

export const APP_COPY_COLLECTION = "app-copy";

const FIRESTORE_BATCH_LIMIT = 450;

/** Firestore של סביבת ה-Stage (זו שה-CMS מחובר אליה) */
export function getStageFirestore(): Firestore {
    return getFirestore(getFirebaseApp());
}

function coerceDoc(id: string, data: Record<string, unknown>): AppCopyDoc {
    return {
        key: typeof data.key === "string" && data.key ? data.key : id,
        he: typeof data.he === "string" ? data.he : "",
        en: typeof data.en === "string" ? data.en : "",
        category: typeof data.category === "string" ? data.category : "",
        description: typeof data.description === "string" ? data.description : "",
        order: typeof data.order === "number" ? data.order : 0,
        timestamp: typeof data.timestamp === "number" ? data.timestamp : 0,
    };
}

/** טוען את כל מסמכי app-copy מ-DB נתון, ממוינים לפי order (ואז לפי key) */
async function loadFrom(db: Firestore): Promise<AppCopyDoc[]> {
    const snapshot = await getDocs(collection(db, APP_COPY_COLLECTION));
    const docs = snapshot.docs.map(d => coerceDoc(d.id, d.data() as Record<string, unknown>));
    docs.sort((a, b) => (a.order - b.order) || a.key.localeCompare(b.key));
    return docs;
}

/** טוען את כל טקסטי האפליקציה מ-Stage */
export function loadAppCopy(): Promise<AppCopyDoc[]> {
    return loadFrom(getStageFirestore());
}

/** טוען את כל טקסטי האפליקציה מפרוד (דורש אימות פרוד קודם) */
export function loadProdAppCopy(): Promise<AppCopyDoc[]> {
    return loadFrom(getProdFirestore());
}

/** שינוי של מפתח בודד לשמירה */
export type AppCopyChange = {
    /** המסמך המלא כפי שצריך להישמר (בלי timestamp – מוצב בשמירה) */
    doc: Omit<AppCopyDoc, "timestamp">;
};

/**
 * כותב רשימת מסמכים ל-DB נתון עם timestamp אחיד (Date.now()).
 * מחזיר את ה-timestamp שהוצב (לעדכון ה-state המקומי אחרי שמירה).
 */
async function writeDocs(
    db: Firestore,
    docs: ReadonlyArray<Omit<AppCopyDoc, "timestamp">>,
    now: number
): Promise<number> {
    for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(db);
        for (const docData of docs.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
            const ref = firestoreDoc(db, APP_COPY_COLLECTION, docData.key);
            batch.set(ref, { ...docData, timestamp: now });
        }
        await batch.commit();
    }
    return now;
}

/** שומר מפתחות שהשתנו ל-Stage; מחזיר את ה-timestamp שהוצב */
export function saveAppCopyChanges(
    docs: ReadonlyArray<Omit<AppCopyDoc, "timestamp">>
): Promise<number> {
    return writeDocs(getStageFirestore(), docs, Date.now());
}

/**
 * מחשב אילו מסמכי Stage שונים מפרוד (טקסטים/קטגוריה/תיאור/סדר) –
 * אלה המסמכים שפרסום יכתוב. ההשוואה מתעלמת מ-timestamp (הוא שונה תמיד).
 */
export function diffForPublish(
    stageDocs: ReadonlyArray<AppCopyDoc>,
    prodDocs: ReadonlyArray<AppCopyDoc>
): AppCopyDoc[] {
    const prodByKey = new Map(prodDocs.map(d => [d.key, d]));
    return stageDocs.filter(stage => {
        const prod = prodByKey.get(stage.key);
        if (!prod) return true; // חדש – לא קיים בפרוד
        return (
            stage.he !== prod.he ||
            stage.en !== prod.en ||
            stage.category !== prod.category ||
            stage.description !== prod.description ||
            stage.order !== prod.order
        );
    });
}

/** כותב את המסמכים הנתונים לפרוד עם timestamp חדש; מחזיר את ה-timestamp */
export function publishAppCopyToProd(
    docs: ReadonlyArray<Omit<AppCopyDoc, "timestamp">>
): Promise<number> {
    return writeDocs(getProdFirestore(), docs, Date.now());
}
