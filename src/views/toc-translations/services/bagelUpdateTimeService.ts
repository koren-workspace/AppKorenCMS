/**
 * bagelUpdateTimeService – קריאה ועדכון של זמני עדכון בקולקציית updateTime ב-BagelDB
 *
 * הערה:
 * במקום להשתמש ב-SDK (@bageldb/bagel-db), אנחנו קוראים ישירות ל-REST API,
 * כי ה-SDK הנוכחי מבוסס על תלויות Node שאינן ניתנות לבאנדל בצד דפדפן (Vite build).
 *
 * שתי פונקציות נפרדות:
 *   - fetchBagelUpdateTimes: שליפת כל הפריטים (ID + timestamp)
 *   - updateBagelTimestamp: עדכון timestamp לפריט ספציפי
 */

const COLLECTION_ID = "updateTime";
const BAGEL_PUBLIC_API = "https://api.bagelstudio.co/api/public";

export type BagelUpdateTimeItem = {
    _id: string;
    timestamp: number;
    _lastUpdateDate?: string;
    _createdDate?: string;
};



function getBagelToken(): string {
    const token = (import.meta.env.VITE_BAGEL_TOKEN as string | undefined)?.trim();
    if (!token) {
        throw new Error("חסר טוקן Bagel (VITE_BAGEL_TOKEN) – בדוק את קובץ .env");
    }
    return token;
}

/** טוקן Bagel של פרוד — חובה כשיש 2 פרויקטים נפרדים */
export function getProdBagelToken(): string {
    const token = (import.meta.env.VITE_PROD_BAGEL_TOKEN as string | undefined)?.trim();
    if (!token) {
        throw new Error("חסר טוקן Bagel לפרוד (VITE_PROD_BAGEL_TOKEN) – בדוק את קובץ .env");
    }
    const parts = token.split(".");
    if (parts.length !== 3 || parts[2].length < 400) {
        throw new Error(
            "טוקן Bagel לפרוד (VITE_PROD_BAGEL_TOKEN) נראה קטוע — העתק את כל ה-token מ-Bagel Dashboard"
        );
    }
    return token;
}

function getHeaders(): HeadersInit {
    return {
        Authorization: `Bearer ${getBagelToken()}`,
        "Accept-Version": "v1",
        "Content-Type": "application/json",
    };
}

/**
 * שליפת כל הפריטים מקולקציית updateTime ב-Bagel.
 * מחזיר מערך של { _id, timestamp }.
 */
export async function fetchBagelUpdateTimes(): Promise<BagelUpdateTimeItem[]> {
    const url = `${BAGEL_PUBLIC_API}/collection/${COLLECTION_ID}/items?pageNumber=1&perPage=100&everything=true`;
    const response = await fetch(url, {
        method: "GET",
        headers: getHeaders(),
    });
    if (!response.ok) {
        throw new Error(`Bagel fetch failed (${response.status})`);
    }
    const payload = await response.json();
    return Array.isArray(payload?.data)
        ? (payload.data as BagelUpdateTimeItem[])
        : ((payload as BagelUpdateTimeItem[]) ?? []);
}

/**
 * עדכון ה-timestamp של פריט ספציפי לזמן UNIX הנוכחי (Date.now()).
 * @param id – מזהה הפריט בקולקציה (למשל "sefard", "ashkenaz")
 * @returns ה-timestamp החדש שהוגדר
 */
export async function updateBagelTimestamp(id: string, timestamp: number): Promise<void> {
    const url = `${BAGEL_PUBLIC_API}/collection/${COLLECTION_ID}/items/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ timestamp }),
    });
    if (!response.ok) {
        throw new Error(`Bagel update failed (${response.status})`);
    }
}

/**
 * עדכון timestamp עם token מפורש — לשימוש עם סביבת פרוד.
 * @param id        – מזהה הפריט
 * @param timestamp – timestamp UNIX
 * @param token     – Bearer token של פרויקט Bagel הרצוי (למשל VITE_PROD_BAGEL_TOKEN)
 */
export async function updateBagelTimestampWithToken(
    id: string,
    timestamp: number,
    token: string
): Promise<void> {
    const url = `${BAGEL_PUBLIC_API}/collection/${COLLECTION_ID}/items/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Accept-Version": "v1",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ timestamp }),
    });
    if (!response.ok) {
        throw new Error(`Bagel update failed (${response.status})`);
    }
}
