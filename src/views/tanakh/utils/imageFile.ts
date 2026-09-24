/**
 * הכנת קובץ תמונה להעלאה: הקטנה לרוחב/גובה סביר והמרה ל-WebP.
 *
 * העורכות מעלות סריקות וצילומים במגה-בייטים; באפליקציה מוצגת תמונה ברוחב
 * מסך טלפון. ההקטנה כאן חוסכת נפח אחסון, תעבורה בטלפון של המשתמש, וזמן
 * טעינה. הפונקציות שאינן נוגעות ב-DOM מיוצאות בנפרד כדי שיהיו נבדקות.
 */

/** הצלע הארוכה המרבית אחרי ההקטנה */
export const MAX_IMAGE_DIM = 1600;
/** גודל קובץ מרבי לקליטה (לפני ההקטנה) */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
/** איכות ה-WebP */
export const WEBP_QUALITY = 0.85;

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

/** ממדי היעד בשמירה על יחס הצדדים. תמונה קטנה מהמקסימום לא גדלה. */
export function targetSize(width: number, height: number, max: number = MAX_IMAGE_DIM): { width: number; height: number } {
    const longest = Math.max(width, height);
    if (!Number.isFinite(longest) || longest <= 0) return { width: 0, height: 0 };
    if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
    const scale = max / longest;
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * שם קובץ בטוח לאחסון: אותיות לטיניות קטנות, ספרות, מקף ונקודה. שם בעברית
 * או עם רווחים הופך למחרוזת ריקה ואז מוחלף ב-"image".
 */
export function slugifyFileName(name: string): string {
    const base = (name ?? "").replace(/\.[^.]*$/, "");
    const slug = base
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return slug || "image";
}

/** שם ייחודי בתוך תיקיית הערך: חותמת זמן + שם מנוקה + סיומת */
export function uniqueFileName(originalName: string, ext: string, now: number = Date.now()): string {
    return `${now.toString(36)}-${slugifyFileName(originalName)}.${ext}`;
}

/** האם הדפדפן יודע לייצר WebP מ-canvas */
export function canEncodeWebp(): boolean {
    try {
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        return c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
        return false;
    }
}

export interface PreparedImage {
    blob: Blob;
    fileName: string;
    width: number;
    height: number;
    /** גודל הקובץ המקורי בבתים */
    sourceBytes: number;
    /** true = הקובץ המקורי הועלה כמות שהוא (הקטנה לא הייתה אפשרית או לא נדרשה) */
    original: boolean;
}

function extensionOf(type: string): string {
    if (type === "image/webp") return "webp";
    if (type === "image/png") return "png";
    if (type === "image/gif") return "gif";
    if (type === "image/avif") return "avif";
    return "jpg";
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
    if (typeof createImageBitmap === "function") return await createImageBitmap(file);
    const url = URL.createObjectURL(file);
    try {
        return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("לא ניתן לקרוא את קובץ התמונה"));
            img.src = url;
        });
    } finally {
        // הכתובת משוחררת רק אחרי שהציור הסתיים; ראו prepareImage
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
}

/**
 * מקטין וממיר ל-WebP. אם משהו נכשל (פורמט שהדפדפן לא מפענח, GIF מונפש,
 * דפדפן בלי WebP) הקובץ המקורי מוחזר כמות שהוא, כדי שהעלאה לא תיחסם.
 */
export async function prepareImage(file: File, now: number = Date.now()): Promise<PreparedImage> {
    if (file.size > MAX_SOURCE_BYTES) {
        throw new Error(`הקובץ גדול מדי (${Math.round(file.size / 1024 / 1024)}MB). המקסימום הוא ${MAX_SOURCE_BYTES / 1024 / 1024}MB.`);
    }
    const fallback = (): PreparedImage => ({
        blob: file,
        fileName: uniqueFileName(file.name, extensionOf(file.type), now),
        width: 0,
        height: 0,
        sourceBytes: file.size,
        original: true,
    });

    // GIF מונפש מאבד את ההנפשה בהמרה – מעלים כמות שהוא
    if (file.type === "image/gif" || !canEncodeWebp()) return fallback();

    try {
        const bitmap = await loadBitmap(file);
        const sw = "width" in bitmap ? bitmap.width : 0;
        const sh = "height" in bitmap ? bitmap.height : 0;
        const size = targetSize(sw, sh);
        if (!size.width || !size.height) return fallback();

        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return fallback();
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap as CanvasImageSource, 0, 0, size.width, size.height);
        if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
        if (!blob) return fallback();
        // המרה שיצאה גדולה יותר מהמקור (תמונה קטנה שכבר דחוסה) – עדיף המקור
        if (blob.size >= file.size && sw <= MAX_IMAGE_DIM && sh <= MAX_IMAGE_DIM) return fallback();

        return {
            blob,
            fileName: uniqueFileName(file.name, "webp", now),
            width: size.width,
            height: size.height,
            sourceBytes: file.size,
            original: false,
        };
    } catch {
        return fallback();
    }
}

/** "1.2MB" / "340KB" */
export function formatBytes(n: number): string {
    if (!Number.isFinite(n) || n < 0) return "";
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
