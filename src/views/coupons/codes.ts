/**
 * codes – יצירת קודי קופון וחישוב ה-hash שלהם, בדפדפן.
 *
 * ===========================================================================
 * הנרמול כאן הוא חוזה עם שני קבצים אחרים, וחייב להישאר זהה בייט-לבייט:
 *   - koren-tefilla  src/services/coupons.ts      (normaliseCouponCode)
 *   - koren-tefilla  tools/coupon-codes.mjs       (normalise)
 * הוא מה שהופך את "abcd-1234", "ABCD 1234" ו-"ABCD1234" לאותו קופון. אם צד
 * אחד ישתנה בלי השני, כל קוד שהונפק מפסיק לעבוד – בשקט, ונראה כמו קוד שגוי.
 * ===========================================================================
 *
 * האלפבית ואורך הקוד זהים לכלי המקורי: 31 תווים בלי O/0 ו-I/1/L (קודים
 * מוקראים בטלפון ומועתקים ביד), 8 תווים ≈ 8.5e11 צירופים, מוצג כ-XXXX-XXXX.
 */

/** אלפבית חד-משמעי: בלי O/0, בלי I/1/L */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
const GROUP_SIZE = 4;

/** אותיות גדולות, ורק A–Z 0–9. מסיר מקף, רווחים ותווים בלתי-נראים מהדבקה. */
export function normaliseCouponCode(input: string): string {
    return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** SHA-256 hex של הקוד המנורמל – מזהה המסמך ב-Firestore. */
export async function couponCodeHash(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(normaliseCouponCode(input));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/** XXXXXXXX → XXXX-XXXX (המקף קוסמטי; הנרמול מסיר אותו) */
export function formatCouponCode(raw: string): string {
    return raw.replace(new RegExp(`(.{${GROUP_SIZE}})(?=.)`, "g"), "$1-");
}

/**
 * קוד אקראי חדש. דגימה עם דחייה (rejection sampling) כדי שכל אות תהיה
 * שוות-הסתברות – 256 אינו כפולה של 31, ולכן `byte % 31` היה מטה את ההתפלגות.
 */
export function mintCouponCode(randomBytes: (n: number) => Uint8Array = defaultRandom): string {
    const limit = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length; // 248
    let out = "";
    while (out.length < CODE_LENGTH) {
        const bytes = randomBytes(CODE_LENGTH * 2);
        for (const b of bytes) {
            if (b < limit) {
                out += CODE_ALPHABET[b % CODE_ALPHABET.length];
                if (out.length === CODE_LENGTH) break;
            }
        }
    }
    return formatCouponCode(out);
}

function defaultRandom(n: number): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(n));
}

/** האם הקלט נראה כמו hash (64 תווי hex) – לחיפוש ישיר לפי hash */
export function looksLikeHash(input: string): boolean {
    return /^[0-9a-f]{64}$/i.test(input.trim());
}
