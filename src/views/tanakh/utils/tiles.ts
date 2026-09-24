/**
 * מפת אריחים (slippy map) – החישובים בלבד, בלי DOM ובלי ספרייה חיצונית.
 *
 * הרכיב MapPicker בונה מפה מאריחי OpenStreetMap ישירות, בלי Leaflet ובלי
 * טעינה מ-CDN: רשתות ארגוניות חוסמות לפעמים CDN, ותוספת תלות ב-npm מיותרת
 * כאן. כל החישובים שמרכיבים את המפה יושבים בקובץ הזה כדי שיהיו ניתנים
 * לבדיקה.
 *
 * ההיטל הוא Web Mercator (EPSG:3857), כמו בכל שרתי האריחים: העולם הוא ריבוע
 * של 256·2^z פיקסלים, הצפון למעלה, והקווים מעל 85.05 מעלות נחתכים.
 */

export const TILE_SIZE = 256;
export const MIN_ZOOM = 2;
export const MAX_ZOOM = 18;
/** הגבול שבו ההיטל נחתך (הריבוע של מרקטור) */
export const MERCATOR_LAT_LIMIT = 85.05112878;

/** רוחב העולם בפיקסלים ברמת הזום הנתונה */
export function worldSize(z: number): number {
    return TILE_SIZE * Math.pow(2, z);
}

export function clampZoom(z: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z)));
}

export function lngToWorldX(lng: number, z: number): number {
    return ((lng + 180) / 360) * worldSize(z);
}

export function latToWorldY(lat: number, z: number): number {
    const clamped = Math.max(-MERCATOR_LAT_LIMIT, Math.min(MERCATOR_LAT_LIMIT, lat));
    const s = Math.sin((clamped * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize(z);
}

export function worldXToLng(x: number, z: number): number {
    const size = worldSize(z);
    const wrapped = ((x % size) + size) % size;
    return (wrapped / size) * 360 - 180;
}

export function worldYToLat(y: number, z: number): number {
    const n = Math.PI - (2 * Math.PI * y) / worldSize(z);
    return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

/** אריח אחד שצריך לצייר, עם מיקומו בפיקסלים בתוך המסגרת */
export interface TileSpec {
    z: number;
    /** אינדקס האריח אחרי גלישה סביב העולם (מה שנשלח לשרת) */
    x: number;
    y: number;
    left: number;
    top: number;
    /** מפתח ייחודי לרשימת React (לפני הגלישה, כדי שלא יחזור פעמיים) */
    key: string;
}

/**
 * האריחים שמכסים מסגרת ברוחב/גובה נתונים, שמרכזה בנקודת העולם (centerX,
 * centerY). מזרח־מערב גולש סביב העולם; מעל/מתחת לקצה פשוט אין אריחים.
 */
export function visibleTiles(centerX: number, centerY: number, width: number, height: number, z: number): TileSpec[] {
    const n = Math.pow(2, z);
    const originX = centerX - width / 2;
    const originY = centerY - height / 2;
    const x0 = Math.floor(originX / TILE_SIZE);
    const x1 = Math.floor((originX + width - 1) / TILE_SIZE);
    const y0 = Math.max(0, Math.floor(originY / TILE_SIZE));
    const y1 = Math.min(n - 1, Math.floor((originY + height - 1) / TILE_SIZE));
    const out: TileSpec[] = [];
    for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
            out.push({
                z,
                x: ((tx % n) + n) % n,
                y: ty,
                left: tx * TILE_SIZE - originX,
                top: ty * TILE_SIZE - originY,
                key: `${z}/${tx}/${ty}`,
            });
        }
    }
    return out;
}

/** כתובת האריח בשרת האריחים של OpenStreetMap */
export function tileUrl(t: { z: number; x: number; y: number }): string {
    return `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`;
}

/** עיגול לשש ספרות אחרי הנקודה (כ-10 ס"מ) – בלי אפסים מיותרים */
export function roundCoord(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}

export function isValidLat(n: number): boolean {
    return Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLng(n: number): boolean {
    return Number.isFinite(n) && n >= -180 && n <= 180;
}

/**
 * מפרק טקסט לקואורדינטות. מקבל "31.7, 35.2", "31.7 35.2", וגם כתובת של
 * Google Maps שהועתקה מהדפדפן (הצורה `@lat,lng,15z` או `?q=lat,lng`).
 * מחזיר null אם לא זוהה זוג תקין.
 */
export function parseCoordinates(raw: string): { lat: number; lng: number } | null {
    const s = (raw ?? "").trim();
    if (!s) return null;

    const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const q = s.match(/[?&](?:q|ll|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const plain = s.match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/);
    const m = at ?? q ?? plain;
    if (!m) return null;

    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!isValidLat(lat) || !isValidLng(lng)) return null;
    return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

/** מרכז ברירת המחדל כשאין עדיין מיקום: ארץ ישראל */
export const DEFAULT_CENTER = { lat: 31.7, lng: 35.1 };
export const DEFAULT_ZOOM = 8;
/** הזום שאליו קופצים כשבוחרים מיקום קיים */
export const FOCUS_ZOOM = 13;
