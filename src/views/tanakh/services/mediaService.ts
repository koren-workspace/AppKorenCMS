/**
 * mediaService – העלאת תמונות הערכים ל-Firebase Storage.
 *
 * הנתיב באחסון: `media/{entryId}/{חותמת-זמן}-{שם}.webp`. הקידומת `media/`
 * פתוחה לקריאה לכל, כי האפליקציה בטלפון מציגה את התמונות בלי התחברות,
 * ולכתיבה למשתמשי ה-CMS בלבד (firebase/tanakh-lametayel/storage.rules).
 *
 * מה נשמר בערך: **כתובת ההורדה המלאה**, ולא הנתיב. כך התצוגה ב-CMS
 * וההצגה באפליקציה עובדות בלי לבנות כתובות ובלי להכיר את שם הדלי; הכלל
 * באפליקציה פשוט – `src` שמתחיל ב-http הוא תמונה מרוחקת, כל השאר הוא מזהה
 * של תמונה ארוזה.
 */

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getTanakhStorage } from "./tanakhAuthService";
import { prepareImage, type PreparedImage } from "../utils/imageFile";
import type { EntryImage } from "../model/types";

export const MEDIA_PREFIX = "media";

/** הנתיב באחסון עבור תמונה חדשה של ערך */
export function mediaPath(entryId: string, fileName: string): string {
    return `${MEDIA_PREFIX}/${entryId}/${fileName}`;
}

/** האם `src` הוא תמונה מרוחקת (כתובת) ולא מזהה של תמונה ארוזה */
export function isRemoteImage(src: string): boolean {
    return typeof src === "string" && /^https?:\/\//.test(src);
}

export interface UploadResult {
    image: EntryImage;
    prepared: PreparedImage;
}

/**
 * מקטין, ממיר ומעלה קובץ אחד. מחזיר את פריט התמונה להוספה לערך.
 * `cacheControl` ארוך בטוח כאן כי שם הקובץ ייחודי ולעולם אינו נכתב מחדש.
 */
export async function uploadEntryImage(entryId: string, file: File): Promise<UploadResult> {
    const prepared = await prepareImage(file);
    const path = mediaPath(entryId, prepared.fileName);
    const target = ref(getTanakhStorage(), path);
    await uploadBytes(target, prepared.blob, {
        contentType: prepared.blob.type || file.type || "application/octet-stream",
        cacheControl: "public, max-age=31536000, immutable",
    });
    const url = await getDownloadURL(target);
    return { image: { kind: "storage", src: url }, prepared };
}

/** "1.2MB" / "340KB" – לשימוש בהודעות על תוצאת ההעלאה */
export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
