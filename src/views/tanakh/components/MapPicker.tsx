/**
 * MapPicker – בחירת מיקום הערך על מפה (שלב 4, חלק ב').
 *
 * Leaflet ו-OpenStreetMap נטענים מ-CDN בזמן ריצה, ולא כתלות npm: המפה היא
 * כלי עריכה פנימי, ואין סיבה שהיא תנפח את החבילה של ה-CMS כולו.
 *
 * המפה היא שכבת נוחות בלבד. שדות הקואורדינטות עובדים גם אם ה-CDN חסום, ולכן
 * כישלון טעינה מוצג כהודעה ולא חוסם עריכה. אותו כלל חל על שירות השמות: גם
 * בלעדיו אפשר להציב פין.
 *
 * תוויות המפה של OSM הן בשפה המקומית – בלבנון, סוריה ומצרים הן ערביות. לכן
 * יש כאן שלושה כלים לזיהוי המקום: קריאת שם הנקודה בעברית, חיפוש מקום לפי שם,
 * ושכבת לוויין בלי תוויות בכלל.
 */

import React, { useEffect, useRef, useState } from "react";
import type { EntryLocation } from "../model/types";
import { WORLD_BBOX } from "../model/validate";
import { reverseGeocode, searchPlaces, shortPlaceName, type PlaceResult } from "../services/geocode";
import { ts } from "./tanakhStyles";

const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;

export type LayerKey = "map" | "satellite";

export const TILE_LAYERS: Record<LayerKey, { label: string; url: string; attribution: string; maxZoom: number }> = {
    map: {
        label: "מפה",
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
    },
    satellite: {
        label: "לוויין",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxZoom: 18,
    },
};

/** מרכז ארץ ישראל – מבט התחלתי כשאין עדיין מיקום */
const DEFAULT_CENTER: [number, number] = [31.5, 35.0];
const DEFAULT_ZOOM = 7;
const PLACED_ZOOM = 12;
/** השהיה לפני שאילתת שם מקום, כדי שגרירת פין לא תייצר בקשה לכל פיקסל */
const REVERSE_DEBOUNCE_MS = 800;

export const CONF_LABELS: Record<1 | 2 | 3, string> = {
    1: "מאומת",
    2: "ביטחון גבוה",
    3: "ביטחון בינוני",
};

/**
 * סמן משלנו (divIcon עם SVG) במקום סמן ברירת המחדל של Leaflet: ברירת המחדל
 * טוענת קובצי PNG בנתיב יחסי ל-CSS, וזו נקודת שבירה ידועה. SVG מוטבע לא תלוי
 * בשום קובץ נוסף, וגם תואם לצבע הפין שברשימת הערכים.
 */
const MARKER_SVG = `
<svg width="26" height="34" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 0C6 0 2 4.6 2 10.2 2 18 12 32 12 32s10-14 10-21.8C22 4.6 18 0 12 0z" fill="#2e7d32" stroke="#fff" stroke-width="1.5"/>
  <circle cx="12" cy="10" r="3.6" fill="#fff"/>
</svg>`;

type Leaflet = any;

function markerIcon(L: Leaflet) {
    return L.divIcon({
        html: MARKER_SVG,
        className: "",          // בלי המחלקה של Leaflet, שמוסיפה רקע לבן
        iconSize: [26, 34],
        iconAnchor: [13, 34],   // קצה הפין יושב על הנקודה
        tooltipAnchor: [0, -30],
    });
}

let leafletPromise: Promise<Leaflet> | null = null;

/** טוען את Leaflet פעם אחת לכל הדף; קריאות נוספות מקבלות את אותה הבטחה */
export function loadLeaflet(): Promise<Leaflet> {
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise<Leaflet>((resolve, reject) => {
        const existing = (window as any).L;
        if (existing) return resolve(existing);

        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }
        const script = document.createElement("script");
        script.src = LEAFLET_JS;
        script.async = true;
        script.onload = () => {
            const L = (window as any).L;
            if (L) resolve(L);
            else reject(new Error("Leaflet נטען אבל לא נמצא ב-window.L"));
        };
        script.onerror = () => reject(new Error(`טעינת המפה מ-${LEAFLET_JS} נכשלה`));
        document.head.appendChild(script);
    });
    // כישלון רשת חד-פעמי לא צריך לנעול את המפה עד רענון הדף
    leafletPromise.catch(() => { leafletPromise = null; });
    return leafletPromise;
}

export interface MapPickerProps {
    value?: EntryLocation;
    /** מזהה הערך – מעבר לערך אחר ממרכז את המפה מחדש */
    entryId: string;
    /** שם לתווית הסמן */
    label?: string;
    onChange: (loc: EntryLocation | undefined) => void;
}

export function MapPicker({ value, entryId, label, onChange }: MapPickerProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const tileRef = useRef<any>(null);
    const onChangeRef = useRef(onChange);
    /** הערך העדכני, לשימוש מתוך מאזינים שנרשמים פעם אחת */
    const valueRef = useRef<EntryLocation | undefined>(value);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [layer, setLayer] = useState<LayerKey>("map");

    const [place, setPlace] = useState<{ state: "idle" | "loading" | "done" | "failed"; name?: string }>({ state: "idle" });
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PlaceResult[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    onChangeRef.current = onChange;
    valueRef.current = value;

    // ── יצירת המפה (פעם אחת) ──────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        void loadLeaflet().then(L => {
            if (cancelled || !containerRef.current || mapRef.current) return;
            const map = L.map(containerRef.current, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, scrollWheelZoom: false });
            map.on("click", (ev: any) => {
                const { lat, lng } = ev.latlng;
                onChangeRef.current({ lat: round6(lat), lng: round6(lng), conf: valueRef.current?.conf ?? 1 });
            });
            mapRef.current = map;
            setReady(true);
        }).catch(err => { if (!cancelled) setError(err?.message ?? String(err)); });
        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
                tileRef.current = null;
            }
        };
    }, []);

    // ── שכבת האריחים (מפה / לוויין) ───────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;
        const L = (window as any).L;
        const spec = TILE_LAYERS[layer];
        const next = L.tileLayer(spec.url, { attribution: spec.attribution, maxZoom: spec.maxZoom });
        next.addTo(map);
        if (tileRef.current) map.removeLayer(tileRef.current);
        tileRef.current = next;
    }, [layer, ready]);

    // ── סמן ומבט לפי הערך הנבחר ───────────────────────────────────────────
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;
        const L = (window as any).L;

        if (!value) {
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            return;
        }
        const latlng: [number, number] = [value.lat, value.lng];
        if (!markerRef.current) {
            markerRef.current = L.marker(latlng, { draggable: true, icon: markerIcon(L) }).addTo(map);
            markerRef.current.on("dragend", (ev: any) => {
                const { lat, lng } = ev.target.getLatLng();
                onChangeRef.current({ lat: round6(lat), lng: round6(lng), conf: valueRef.current?.conf ?? 1 });
            });
        } else {
            markerRef.current.setLatLng(latlng);
        }
        // "ערך:" ולא הכותרת לבדה – תווית צמודה לפין נקראת אחרת כשם המקום על המפה
        if (label) markerRef.current.bindTooltip(`ערך: ${label}`);
    }, [value, ready, label]);

    // מעבר לערך אחר: למרכז מחדש (ולא להישאר במבט של הערך הקודם)
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !ready) return;
        if (value) map.setView([value.lat, value.lng], PLACED_ZOOM);
        else map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        setResults(null);
        setSearchError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entryId, ready]);

    // ── שם המקום של הנקודה, בעברית ────────────────────────────────────────
    useEffect(() => {
        if (!value) {
            setPlace({ state: "idle" });
            return;
        }
        const controller = new AbortController();
        setPlace({ state: "loading" });
        const timer = window.setTimeout(() => {
            void reverseGeocode(value.lat, value.lng, controller.signal)
                .then(p => setPlace(p ? { state: "done", name: shortPlaceName(p) } : { state: "done" }))
                .catch(err => { if (err?.name !== "AbortError") setPlace({ state: "failed" }); });
        }, REVERSE_DEBOUNCE_MS);
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [value?.lat, value?.lng]);

    // ── חיפוש מקום ────────────────────────────────────────────────────────
    function runSearch() {
        const q = query.trim();
        if (!q || searching) return;
        setSearching(true);
        setSearchError(null);
        void searchPlaces(q)
            .then(rs => { setResults(rs); if (!rs.length) setSearchError(`לא נמצא מקום בשם "${q}"`); })
            .catch(err => setSearchError(`החיפוש נכשל: ${err?.message ?? err}`))
            .finally(() => setSearching(false));
    }

    function pick(p: PlaceResult) {
        onChange({ lat: round6(p.lat), lng: round6(p.lng), conf: value?.conf ?? 1 });
        mapRef.current?.setView([p.lat, p.lng], PLACED_ZOOM);
        setResults(null);
        setQuery("");
    }

    function setField(field: "lat" | "lng", raw: string) {
        const n = Number(raw);
        if (raw.trim() === "" || !Number.isFinite(n)) return;
        const base: EntryLocation = value ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1], conf: 1 };
        onChange({ ...base, [field]: n });
    }

    const outOfBox = value && (value.lat < WORLD_BBOX.latMin || value.lat > WORLD_BBOX.latMax || value.lng < WORLD_BBOX.lngMin || value.lng > WORLD_BBOX.lngMax);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...ts.row, gap: 8 }}>
                <label style={{ ...ts.label, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    קו רוחב
                    <input
                        id="tlm-lat"
                        style={{ ...ts.input, ...ts.inputLtr, width: 120 }}
                        type="number"
                        step="0.0001"
                        value={value?.lat ?? ""}
                        onChange={e => setField("lat", e.target.value)}
                        placeholder="31.7736"
                    />
                </label>
                <label style={{ ...ts.label, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    קו אורך
                    <input
                        id="tlm-lng"
                        style={{ ...ts.input, ...ts.inputLtr, width: 120 }}
                        type="number"
                        step="0.0001"
                        value={value?.lng ?? ""}
                        onChange={e => setField("lng", e.target.value)}
                        placeholder="35.2354"
                    />
                </label>
                <label style={{ ...ts.label, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    רמת ביטחון
                    <select
                        id="tlm-conf"
                        style={ts.select}
                        value={value?.conf ?? 1}
                        disabled={!value}
                        onChange={e => value && onChange({ ...value, conf: Number(e.target.value) as 1 | 2 | 3 })}
                    >
                        {([1, 2, 3] as const).map(c => <option key={c} value={c}>{CONF_LABELS[c]}</option>)}
                    </select>
                </label>
                {value && <button style={ts.smallBtn} onClick={() => onChange(undefined)}>הסרת המיקום</button>}
            </div>

            {outOfBox && <p style={ts.fieldWarn}>המיקום מחוץ לאזור המקרא – לבדוק שלא התהפכו קו הרוחב וקו האורך.</p>}

            {error ? (
                <div style={{ ...ts.banner, ...ts.bannerWarn }}>
                    המפה לא נטענה ({error}). אפשר להזין קואורדינטות ידנית בשדות שלמעלה.
                    {" "}<button style={ts.smallBtn} onClick={() => { setError(null); void loadLeaflet().then(() => setReady(true)).catch(err => setError(err?.message ?? String(err))); }}>ניסיון נוסף</button>
                </div>
            ) : (
                <>
                    {/* ── חיפוש מקום ושכבה ─────────────────────────────── */}
                    <div style={{ ...ts.row, gap: 8 }}>
                        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                            <div style={ts.row}>
                                <input
                                    id="tlm-place-search"
                                    style={{ ...ts.input, flex: 1 }}
                                    placeholder="חיפוש מקום – בעברית או באנגלית…"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runSearch(); } }}
                                />
                                <button style={ts.secondaryBtn} onClick={runSearch} disabled={searching || !query.trim()}>
                                    {searching ? "מחפש…" : "חיפוש"}
                                </button>
                            </div>
                            {results && results.length > 0 && (
                                <ul style={{ ...ts.list, position: "absolute", zIndex: 500, top: "100%", right: 0, left: 0, background: "#fff", border: "1px solid #ccc", borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", padding: 4, maxHeight: 220, overflowY: "auto" }}>
                                    {results.map((r, i) => (
                                        <li key={i} style={ts.listRow} onMouseDown={ev => { ev.preventDefault(); pick(r); }}>
                                            <span style={{ flex: 1 }}>{shortPlaceName(r)}</span>
                                            {/* בשורה מימין-לשמאל צמד מספרים מתהפך; isolate שומר על הסדר */}
                                            <span style={{ ...ts.muted, direction: "ltr", unicodeBidi: "isolate" }}>{r.lat.toFixed(3)}, {r.lng.toFixed(3)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div style={{ ...ts.row, gap: 4 }}>
                            {(Object.keys(TILE_LAYERS) as LayerKey[]).map(k => (
                                <button
                                    key={k}
                                    style={{ ...ts.chip, cursor: "pointer", ...(layer === k ? ts.chipActive : {}) }}
                                    onClick={() => setLayer(k)}
                                >
                                    {TILE_LAYERS[k].label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {searchError && <p style={ts.fieldWarn}>{searchError}</p>}

                    <div
                        ref={containerRef}
                        style={{ height: 320, borderRadius: 8, border: "1px solid #ddd", background: "#eef1f3" }}
                        aria-label="מפה לבחירת מיקום"
                    />

                    {/* ── שם המקום של הנקודה ───────────────────────────── */}
                    {value && (
                        <div style={{ ...ts.row, gap: 6, fontSize: 13 }}>
                            <b>הנקודה:</b>
                            {place.state === "loading" && <span style={ts.muted}>מזהה…</span>}
                            {place.state === "done" && (place.name
                                ? <span>{place.name}</span>
                                : <span style={ts.muted}>אין יישוב מזוהה בנקודה הזו (ים, מדבר או שטח פתוח)</span>)}
                            {place.state === "failed" && <span style={ts.muted}>שירות השמות לא זמין כרגע</span>}
                        </div>
                    )}

                    <p style={ts.hint}>
                        לחיצה על המפה מציבה את הסמן; אפשר גם לגרור אותו. תוויות המפה הן בשפה המקומית
                        (בלבנון ובסוריה – ערבית), ולכן שם הנקודה מוצג כאן בעברית, ושכבת "לוויין" מציגה
                        צילום אוויר בלי תוויות. גלגלת העכבר לא מזיזה את התצוגה – להתקרבות יש כפתורי + ו-−.
                    </p>
                </>
            )}
        </div>
    );
}

function round6(n: number): number {
    return Math.round(n * 1e6) / 1e6;
}
