/**
 * bagelUpdateTimeService – קריאה ועדכון של זמני עדכון בקולקציית updateTime ב-BagelDB
 *
 * שתי פונקציות נפרדות:
 *   - fetchBagelUpdateTimes: שליפת כל הפריטים (ID + timestamp)
 *   - updateBagelTimestamp: עדכון timestamp לפריט ספציפי לזמן UNIX הנוכחי
 */

import BagelDB from "@bageldb/bagel-db";

const COLLECTION_ID = "updateTime";

export type BagelUpdateTimeItem = {
    _id: string;
    timestamp: number;
    _lastUpdateDate?: string;
    _createdDate?: string;
};

function getBagelToken(): string {
    const token = (import.meta as any).env.VITE_BAGEL_TOKEN;
    if (!token?.trim()) {
        throw new Error("חסר טוקן Bagel (VITE_BAGEL_TOKEN) – בדוק את קובץ .env");
    }
    return token;
}

function createClient(): BagelDB {
    return new BagelDB(getBagelToken());
}

/**
 * שליפת כל הפריטים מקולקציית updateTime ב-Bagel.
 * מחזיר מערך של { _id, timestamp }.
 */
export async function fetchBagelUpdateTimes(): Promise<BagelUpdateTimeItem[]> {
    const db = createClient();
    const { data } = await db.collection(COLLECTION_ID).everything().get();
    return data as BagelUpdateTimeItem[];
}

/**
 * עדכון ה-timestamp של פריט ספציפי לזמן UNIX הנוכחי (Date.now()).
 * @param id – מזהה הפריט בקולקציה (למשל "sefard", "ashkenaz")
 * @returns ה-timestamp החדש שהוגדר
 */
export async function updateBagelTimestamp(id: string, timestamp: number): Promise<void> {
    const db = createClient();
    await db.collection(COLLECTION_ID).item(id).put({ timestamp });
}
