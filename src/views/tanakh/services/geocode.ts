/**
 * geocode – שמות מקומות למפה של בוחר המיקום (Nominatim של OpenStreetMap).
 *
 * שני שימושים: תרגום נקודה לשם מקום ("איפה הפין הזה?") וחיפוש מקום לפי שם
 * ("קפוץ למרג' עיון"). שניהם מבקשים תשובה בעברית ונופלים לאנגלית.
 *
 * מדיניות השימוש של Nominatim מתירה בקשה אחת בשנייה לכל היותר. הקריאות כאן
 * נעשות רק בפעולת עורך (הזזת פין או חיפוש מפורש), והצד הקורא משהה אותן. אין
 * להפעיל אותן בלולאה על כל הערכים.
 */

const BASE = "https://nominatim.openstreetmap.org";
/** עברית קודם, ואם אין – אנגלית */
const LANGS = "he,en";

export interface NominatimAddress {
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
    [key: string]: string | undefined;
}

export interface PlaceResult {
    lat: number;
    lng: number;
    /** השם המלא כפי ש-Nominatim מחזיר */
    displayName: string;
    address?: NominatimAddress;
}

export function reverseUrl(lat: number, lng: number): string {
    const q = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        zoom: "14",             // יישוב, לא בית ספציפי
        "accept-language": LANGS,
    });
    return `${BASE}/reverse?${q}`;
}

export function searchUrl(query: string): string {
    const q = new URLSearchParams({
        format: "jsonv2",
        q: query,
        limit: "6",
        addressdetails: "1",
        "accept-language": LANGS,
    });
    return `${BASE}/search?${q}`;
}

/**
 * שם קצר וקריא מתוך רכיבי הכתובת: יישוב, מחוז, מדינה. אם אין רכיבים –
 * שלושת החלקים הראשונים של השם המלא, שהוא ארוך מדי לשורה אחת.
 */
export function shortPlaceName(place: PlaceResult): string {
    const a = place.address;
    if (!a) return place.displayName.split(",").slice(0, 3).join(",").trim();
    const settlement = a.village ?? a.town ?? a.city ?? a.municipality;
    const area = a.county ?? a.state ?? a.region;
    const parts = [settlement, area, a.country].filter(Boolean) as string[];
    return parts.length ? parts.join(", ") : place.displayName.split(",").slice(0, 3).join(",").trim();
}

function toPlace(raw: any): PlaceResult | null {
    const lat = Number(raw?.lat);
    const lng = Number(raw?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, displayName: String(raw.display_name ?? ""), address: raw.address };
}

/** מה נמצא בנקודה הזו; null = אין תשובה (ים פתוח, מדבר, שירות לא זמין) */
export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<PlaceResult | null> {
    const res = await fetch(reverseUrl(lat, lng), { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    if (raw?.error) return null;
    return toPlace(raw);
}

/** חיפוש מקום לפי שם, בעברית או באנגלית */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
    const q = query.trim();
    if (!q) return [];
    const res = await fetch(searchUrl(q), { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return Array.isArray(raw) ? (raw.map(toPlace).filter(Boolean) as PlaceResult[]) : [];
}
