/**
 * catalogService – קריאה וכתיבה של `catalog/{storeId}` ב-Firestore, לפי סביבה.
 *
 *  - listCatalog(env):        כל התוספות, לפי סדר תצוגה
 *  - saveItem(env, item):     כותב את המסמך כולו (מזהה = storeId)
 *  - deleteItem(env, storeId)
 *
 * הצורה של המסמך היא מה שהאפליקציה מפענחת (koren-tefilla,
 * services/remote/enhancements.ts): שדות ריקים לא נכתבים, כדי שהאפליקציה
 * תקרא "חסר" ולא מחרוזת ריקה. `coerceItem` ו-`toDocument` הפוכות זו לזו
 * ומכוסות בבדיקה.
 */

import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    setDoc,
    Timestamp,
    type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { getProdFirestore } from "../../toc-translations/services/prodAuthService";
import {
    EMPTY_LOCALIZED,
    KINDS,
    type CatalogEnv,
    type CatalogItem,
    type Kind,
    type Localized,
    type Track,
} from "../types";

export const CATALOG_COLLECTION = "catalog";

export function catalogDb(env: CatalogEnv): Firestore {
    return env === "prod" ? getProdFirestore() : getFirestore(getFirebaseApp());
}

// ---------------------------------------------------------------------------
// Firestore → CatalogItem
// ---------------------------------------------------------------------------

function str(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function localized(value: unknown): Localized {
    if (typeof value !== "object" || value === null) return { ...EMPTY_LOCALIZED };
    const record = value as Record<string, unknown>;
    return { default: str(record.default), he: str(record.he) };
}

function track(value: unknown): Track | null {
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    const type = str(record.type).toLowerCase();
    return {
        id: str(record.id),
        rank: str(record.rank),
        title: localized(record.title),
        type: type === "video" ? "video" : "audio",
        url: str(record.url),
        thumbnail: str(record.thumbnail),
    };
}

export function coerceItem(id: string, data: Record<string, unknown>): CatalogItem {
    const kind = str(data.kind).toLowerCase();
    const order = data.order;
    const tracks = Array.isArray(data.preparationContent) ? data.preparationContent : [];
    return {
        storeId: str(data.storeId) || id,
        kind: (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : "translation",
        order: typeof order === "number" && Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
        title: localized(data.title),
        author: localized(data.author),
        description: localized(data.description),
        nusach: localized(data.nusach),
        nusachId: str(data.nusachId),
        contentId: str(data.contentId),
        backgroundColor: str(data.backgroundColor),
        thumbnail: str(data.thumbnail),
        preparationContent: tracks.map(track).filter((t): t is Track => t !== null),
    };
}

// ---------------------------------------------------------------------------
// CatalogItem → Firestore
// ---------------------------------------------------------------------------

function localizedOut(value: Localized): Record<string, string> | undefined {
    const def = value.default.trim();
    if (!def) return undefined;
    const he = value.he.trim();
    return he ? { default: def, he } : { default: def };
}

function put(out: Record<string, unknown>, key: string, value: unknown) {
    if (value !== undefined && value !== "") out[key] = value;
}

/** מה נכתב למסמך. שדות ריקים לא נכתבים. זורק על שגיאות שהמסך צריך להציג. */
export function toDocument(item: CatalogItem, editorEmail: string): Record<string, unknown> {
    const storeId = item.storeId.trim();
    if (!/^[A-Za-z0-9._-]+$/.test(storeId)) throw new Error("storeId: אותיות לטיניות, ספרות, נקודה, מקף או קו תחתון בלבד");
    const title = localizedOut(item.title);
    if (!title) throw new Error("כותרת באנגלית היא חובה");
    if (!Number.isInteger(item.order) || item.order < 0) throw new Error("סדר תצוגה: מספר שלם, 0 או יותר");
    if (item.backgroundColor.trim() && !/^#[0-9a-fA-F]{6}$/.test(item.backgroundColor.trim())) {
        throw new Error("צבע כרטיס: בפורמט #rrggbb, או ריק");
    }
    const out: Record<string, unknown> = {
        storeId,
        kind: item.kind,
        order: item.order,
        title,
    };
    put(out, "author", localizedOut(item.author));
    put(out, "description", localizedOut(item.description));
    put(out, "nusach", localizedOut(item.nusach));
    put(out, "nusachId", item.nusachId.trim());
    put(out, "contentId", item.contentId.trim());
    put(out, "backgroundColor", item.backgroundColor.trim());
    put(out, "thumbnail", item.thumbnail.trim());
    if (item.kind === "preparation") {
        out.preparationContent = item.preparationContent.map((t, index) => {
            const trackTitle = localizedOut(t.title);
            if (!t.id.trim()) throw new Error(`רצועה ${index + 1}: מזהה חובה`);
            if (!trackTitle) throw new Error(`רצועה ${index + 1}: כותרת באנגלית חובה`);
            if (!t.url.trim()) throw new Error(`רצועה ${index + 1}: כתובת המדיה חובה`);
            const row: Record<string, unknown> = {
                id: t.id.trim(),
                rank: t.rank.trim(),
                title: trackTitle,
                type: t.type,
                url: t.url.trim(),
            };
            put(row, "thumbnail", t.thumbnail.trim());
            return row;
        });
    }
    out.updatedAt = Timestamp.now();
    out.updatedBy = editorEmail;
    return out;
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/** תוספת + השדות ההיסטוריים של המסמך שלה, שהשמירה המלאה חייבת לשמר */
export type CatalogRow = { item: CatalogItem; keep: Record<string, unknown> };

export async function listCatalog(env: CatalogEnv): Promise<CatalogRow[]> {
    const snapshot = await getDocs(collection(catalogDb(env), CATALOG_COLLECTION));
    return snapshot.docs
        .map(d => {
            const data = d.data() as Record<string, unknown>;
            return { item: coerceItem(d.id, data), keep: historicalFields(data) };
        })
        .sort((a, b) => a.item.order - b.item.order || a.item.storeId.localeCompare(b.item.storeId));
}

/**
 * שמירה. `merge: false` בכוונה: המסמך נכתב כולו, כך ששדה שרוקנו במסך באמת
 * נעלם מהמסמך. השדות ההיסטוריים (bagelId, migratedFromBagelAt) נשמרים
 * מהמסמך הקודם דרך `keep`.
 */
export async function saveItem(env: CatalogEnv, item: CatalogItem, editorEmail: string, keep: Record<string, unknown> = {}) {
    const data = { ...keep, ...toDocument(item, editorEmail) };
    await setDoc(doc(catalogDb(env), CATALOG_COLLECTION, item.storeId.trim()), data);
}

/**
 * העתקת תוספת אחת מסטייג' לפרוד, כפי שהיא (אותם שדות, כולל ההיסטוריים),
 * בדריסה של המסמך עם אותו storeId. מחזירה האם המסמך היה קיים בפרוד.
 */
export async function copyToProd(storeId: string, editorEmail: string): Promise<{ existed: boolean }> {
    const source = await getDoc(doc(catalogDb("stage"), CATALOG_COLLECTION, storeId));
    if (!source.exists()) throw new Error(`התוספת ${storeId} לא נמצאה בסטייג'`);
    const target = doc(catalogDb("prod"), CATALOG_COLLECTION, storeId);
    const existed = (await getDoc(target)).exists();
    const data = { ...(source.data() as Record<string, unknown>), copiedFromStageAt: Timestamp.now(), copiedFromStageBy: editorEmail };
    await setDoc(target, data);
    return { existed };
}

export async function deleteItem(env: CatalogEnv, storeId: string) {
    await deleteDoc(doc(catalogDb(env), CATALOG_COLLECTION, storeId));
}

/** השדות ההיסטוריים שיש לשמר בכתיבה מלאה */
export function historicalFields(data: Record<string, unknown>): Record<string, unknown> {
    const keep: Record<string, unknown> = {};
    for (const key of ["bagelId", "migratedFromBagelAt"]) {
        if (data[key] !== undefined) keep[key] = data[key];
    }
    return keep;
}
