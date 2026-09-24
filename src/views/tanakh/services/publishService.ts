/**
 * publishService – בניית קובץ התוכן, מצב הפרסום, וההורדה שלו (שלב 7).
 *
 * שני ערוצים, ושניהם קבצים ב-Storage שהאפליקציה מורידה:
 *   published/live.json      מה שהקוראים מקבלים
 *   published/preview.json   כולל ערכים מוסתרים, לבדיקה לפני שמסמנים אותם
 *
 * **כל גרסה חיה נשמרת.** לצד live.json נכתב עותק בלתי משתנה תחת
 * `published/archive/live-0007.json`. כך פרסום שגוי אינו אסון: אפשר להחזיר
 * גרסה קודמת חזרה לערוץ החי. עותקי הארכיון קטנים (כמה מגה-בייט) ומצטברים
 * לאט, ולכן אין סיבה למחוק אותם. תצוגה מקדימה אינה מגובה – היא ממילא זמנית.
 *
 * מסמך `meta/publish` נכתב בכל פרסום ומחזיק את מספר הגרסה, מתי ועל ידי מי.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getBytes, getDownloadURL, listAll, ref, uploadBytes, type StorageReference } from "firebase/storage";
import { getTanakhFirestore, getTanakhStorage } from "./tanakhAuthService";
import { tanakhStorageBucket } from "../../../firebase_config";
import { META_COLLECTION, PUBLISH_DOC_ID, type PublishMeta } from "../model/types";
import type { ContentPack } from "../model/publish";
import { stripUndefined } from "../model/entryOps";
import { appendChangeLog } from "../../toc-translations/services/changeLogService";

/** תיקיית עותקי הגרסאות של הערוץ החי */
export const ARCHIVE_DIR = "published/archive";

/**
 * האם יעד ההעלאה זמין. נגזר מההגדרות ולא מדגל ידני, כדי שלא ייווצר מצב שבו
 * Storage פעיל אבל המסך חושב שלא. `VITE_TLM_STORAGE_ENABLED=false` הוא מילוט
 * לכיבוי ידני אם יידרש.
 */
export function isStorageEnabled(): boolean {
    if (import.meta.env.VITE_TLM_STORAGE_ENABLED === "false") return false;
    return Boolean(tanakhStorageBucket());
}

/** `published/archive/live-0007.json` – מרופד כדי שמיון לפי שם יהיה מיון לפי גרסה */
export function archiveFileName(version: number): string {
    return `${ARCHIVE_DIR}/live-${String(version).padStart(4, "0")}.json`;
}

/** מספר הגרסה מתוך שם קובץ ארכיון; null אם השם אינו בתבנית */
export function archiveVersionOf(path: string): number | null {
    const m = path.match(/live-(\d+)\.json$/);
    return m ? Number(m[1]) : null;
}

function packBlob(pack: ContentPack): Blob {
    return new Blob([JSON.stringify(pack)], { type: "application/json" });
}

async function put(target: StorageReference, blob: Blob, immutable: boolean): Promise<void> {
    await uploadBytes(target, blob, {
        contentType: "application/json",
        // הערוץ נכתב מחדש בכל פרסום, ולכן אסור שיישמר במטמון לאורך זמן
        cacheControl: immutable ? "public, max-age=31536000, immutable" : "public, max-age=60",
    });
}

export interface UploadedPack {
    /** הנתיב שהאפליקציה קוראת */
    path: string;
    /** כתובת ההורדה, להצגה ולבדיקה */
    url: string;
    /** נתיב עותק הגרסה, בערוץ החי בלבד */
    archivePath?: string;
}

/**
 * מעלה את הקובץ לערוץ המבוקש. בערוץ החי נכתב קודם עותק הגרסה ורק אחריו
 * הערוץ עצמו: אם ההעלאה תיפול באמצע, עדיף ארכיון בלי ערוץ מאשר ערוץ שאין
 * לו גיבוי.
 */
export async function uploadPack(pack: ContentPack, preview: boolean, fileName: string): Promise<UploadedPack> {
    const storage = getTanakhStorage();
    const blob = packBlob(pack);
    let archivePath: string | undefined;

    if (!preview) {
        archivePath = archiveFileName(pack.version);
        await put(ref(storage, archivePath), blob, true);
    }
    const target = ref(storage, fileName);
    await put(target, blob, false);
    return { path: fileName, url: await getDownloadURL(target), ...(archivePath ? { archivePath } : {}) };
}

export interface ArchivedVersion {
    version: number;
    path: string;
}

/** הגרסאות השמורות, מהחדשה לישנה */
export async function listArchivedVersions(): Promise<ArchivedVersion[]> {
    const listing = await listAll(ref(getTanakhStorage(), ARCHIVE_DIR));
    return listing.items
        .map(item => ({ version: archiveVersionOf(item.fullPath), path: item.fullPath }))
        .filter((v): v is ArchivedVersion => v.version !== null)
        .sort((a, b) => b.version - a.version);
}

/**
 * מחזיר גרסה שמורה לערוץ החי. הקובץ מועתק כמות שהוא, כולל מספר הגרסה
 * שבתוכו, כדי שמה שהאפליקציה תקבל יהיה בדיוק מה שפורסם אז.
 *
 * זו הפעולה היחידה כאן שקוראת קובץ מהאחסון אל הדפדפן, ולכן היחידה שעלולה
 * להיחסם ב-CORS של הדלי. העלאה, רשימת הגרסאות והצגת תמונות אינן מושפעות.
 */
export async function restoreArchivedVersion(path: string, liveFileName: string): Promise<ContentPack> {
    const storage = getTanakhStorage();
    let bytes: ArrayBuffer;
    try {
        bytes = await getBytes(ref(storage, path));
    } catch (err: any) {
        const code = String(err?.code ?? "");
        if (code.includes("unauthorized") || code.includes("retry-limit") || code.includes("unknown")) {
            throw new Error(
                "קריאת הגרסה השמורה נחסמה. זה קורה כשלא הוגדר CORS בדלי ה-Storage. " +
                "ראו docs/tanakh-lametayel.md, פרק הפרסום, להגדרה החד-פעמית.",
            );
        }
        throw err;
    }
    const pack = JSON.parse(new TextDecoder().decode(bytes)) as ContentPack;
    await put(ref(storage, liveFileName), new Blob([bytes], { type: "application/json" }), false);
    return pack;
}

export async function loadPublishMeta(): Promise<PublishMeta | null> {
    const snap = await getDoc(doc(getTanakhFirestore(), META_COLLECTION, PUBLISH_DOC_ID));
    return snap.exists() ? (snap.data() as PublishMeta) : null;
}

export async function savePublishMeta(meta: PublishMeta, note?: string): Promise<void> {
    await setDoc(doc(getTanakhFirestore(), META_COLLECTION, PUBLISH_DOC_ID), stripUndefined(meta));
    appendChangeLog({
        timestamp: meta.publishedAt,
        action: "publish_tanakh_content",
        context: {},
        details: { tanakh: { summary: note ?? `פורסמה גרסה ${meta.version} של קובץ התוכן (${meta.entryCount} ערכים)` } },
        savedToFirestore: true,
    });
}

/** גודל הקובץ בבתים, לתצוגה לפני ההורדה */
export function packSize(pack: ContentPack): number {
    return new Blob([JSON.stringify(pack)]).size;
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} ב׳`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** הורדת הקובץ למחשב של העורך */
export function downloadPack(pack: ContentPack, fileName: string): void {
    const blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/^published\//, "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    // שחרור מיידי היה מבטל הורדה שעוד לא התחילה בחלק מהדפדפנים
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
