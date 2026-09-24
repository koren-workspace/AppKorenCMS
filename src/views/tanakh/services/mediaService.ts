/**
 * mediaService – תמונות הערכים ב-Firebase Storage של פרויקט התנ"ך.
 *
 * מבנה: `media/{entryId}/{fileName}`. הקידומת `media/` פתוחה לקריאה לכל
 * (האפליקציה בטלפון מציגה את התמונות בלי התחברות) ולכתיבה למשתמשי ה-CMS
 * בלבד – ראו firebase/tanakh-lametayel/storage.rules.
 *
 * הקובץ הנשמר הוא WebP מוקטן (utils/imageFile.ts), לא המקור.
 */

import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getTanakhStorage } from "./tanakhAuthService";
import { prepareImage, type PreparedImage } from "../utils/imageFile";
import type { EntryImage } from "../model/types";

export const MEDIA_PREFIX = "media";

/** הנתיב שנשמר בערך (EntryImage.src) עבור תמונה חדשה */
export function mediaPath(entryId: string, fileName: string): string {
    return `${MEDIA_PREFIX}/${entryId}/${fileName}`;
}

/** האם הנתיב שייך לתיקיית המדיה של הפרויקט (ולא מזהה של תמונה אפויה) */
export function isMediaPath(src: string): boolean {
    return typeof src === "string" && src.startsWith(`${MEDIA_PREFIX}/`);
}

/**
 * כתובת ההורדה של תמונה ב-Storage. התוצאה נשמרת במטמון לכל החיים של הדף:
 * הכתובת כוללת token קבוע ולא משתנה כל עוד הקובץ לא נמחק.
 */
const urlCache = new Map<string, Promise<string>>();

export function imageDownloadUrl(src: string): Promise<string> {
    const cached = urlCache.get(src);
    if (cached) return cached;
    const p = getDownloadURL(ref(getTanakhStorage(), src)).catch(err => {
        urlCache.delete(src);
        throw err;
    });
    urlCache.set(src, p);
    return p;
}

export interface UploadResult {
    image: EntryImage;
    prepared: PreparedImage;
}

/** מקטין, ממיר ומעלה קובץ אחד. מחזיר את פריט התמונה להוספה לערך. */
export async function uploadEntryImage(entryId: string, file: File): Promise<UploadResult> {
    const prepared = await prepareImage(file);
    const path = mediaPath(entryId, prepared.fileName);
    await uploadBytes(ref(getTanakhStorage(), path), prepared.blob, {
        contentType: prepared.blob.type || file.type || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
    });
    return { image: { kind: "storage", src: path }, prepared };
}

/**
 * מחיקת קובץ מ-Storage. קובץ שכבר לא קיים אינו שגיאה – הסרה מהערך היא
 * העיקר, והקובץ עלול להימחק פעמיים אם הערך נשמר בשני טאבים.
 */
export async function deleteEntryImage(src: string): Promise<void> {
    if (!isMediaPath(src)) return;
    urlCache.delete(src);
    try {
        await deleteObject(ref(getTanakhStorage(), src));
    } catch (err: any) {
        if (err?.code === "storage/object-not-found") return;
        throw err;
    }
}
