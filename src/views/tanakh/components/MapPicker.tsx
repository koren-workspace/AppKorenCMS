/**
 * MapPicker – מפה לבחירת נקודה, בנויה מאריחי OpenStreetMap ישירות.
 *
 * בלי Leaflet ובלי טעינה מ-CDN (ראו utils/tiles.ts). גרירה מזיזה את המפה,
 * לחיצה קובעת את הנקודה, והזום בכפתורים ובלחיצה כפולה. גלגלת העכבר לא
 * נתפסת בכוונה, כדי שגלילת הטופס הארוך לא תיתקע על המפה.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    clampZoom,
    DEFAULT_CENTER,
    DEFAULT_ZOOM,
    FOCUS_ZOOM,
    latToWorldY,
    lngToWorldX,
    MAX_ZOOM,
    MIN_ZOOM,
    roundCoord,
    tileUrl,
    visibleTiles,
    worldXToLng,
    worldYToLat,
} from "../utils/tiles";
import { ts } from "./tanakhStyles";

export interface MapMarker {
    lat: number;
    lng: number;
    title: string;
    /** נקודת העזר הנוכחית מודגשת */
    kind?: "primary" | "context";
}

export interface MapPickerProps {
    /** הנקודה הנבחרת (undefined = עדיין לא נבחרה) */
    lat?: number;
    lng?: number;
    /** נקודות נוספות לרקע, למשל ערכים שכנים */
    context?: MapMarker[];
    onPick: (lat: number, lng: number) => void;
    height?: number;
    disabled?: boolean;
}

/** מרחק בפיקסלים שמעליו תנועת עכבר נחשבת גרירה ולא לחיצה */
const DRAG_SLOP = 4;

export function MapPicker({ lat, lng, context = [], onPick, height = 320, disabled }: MapPickerProps) {
    const boxRef = useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(640);
    const [zoom, setZoom] = useState(() => (lat !== undefined && lng !== undefined ? FOCUS_ZOOM : DEFAULT_ZOOM));
    const [center, setCenter] = useState(() => ({
        lat: lat ?? DEFAULT_CENTER.lat,
        lng: lng ?? DEFAULT_CENTER.lng,
    }));
    const drag = useRef<{ id: number; x: number; y: number; moved: number } | null>(null);
    /** כשהנקודה משתנה מבחוץ (בחירת ערך אחר) המפה מתמרכזת מחדש */
    const lastExternal = useRef<string>("");

    useLayoutEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => setWidth(Math.max(200, Math.round(el.clientWidth)));
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const key = lat !== undefined && lng !== undefined ? `${lat},${lng}` : "";
        if (key === lastExternal.current) return;
        lastExternal.current = key;
        if (lat !== undefined && lng !== undefined) {
            setCenter({ lat, lng });
            setZoom(z => (z < FOCUS_ZOOM ? FOCUS_ZOOM : z));
        }
    }, [lat, lng]);

    const centerPx = useMemo(() => ({ x: lngToWorldX(center.lng, zoom), y: latToWorldY(center.lat, zoom) }), [center, zoom]);
    const tiles = useMemo(() => visibleTiles(centerPx.x, centerPx.y, width, height, zoom), [centerPx, width, height, zoom]);

    /** מיקום נקודה בפיקסלים בתוך המסגרת (או null אם היא מחוץ לה) */
    const project = useCallback(
        (pLat: number, pLng: number) => {
            const x = lngToWorldX(pLng, zoom) - (centerPx.x - width / 2);
            const y = latToWorldY(pLat, zoom) - (centerPx.y - height / 2);
            return { x, y, inside: x >= -20 && x <= width + 20 && y >= -40 && y <= height + 20 };
        },
        [centerPx, width, height, zoom],
    );

    function pointToLatLng(clientX: number, clientY: number) {
        const rect = boxRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const wx = centerPx.x - width / 2 + (clientX - rect.left);
        const wy = centerPx.y - height / 2 + (clientY - rect.top);
        return { lat: roundCoord(worldYToLat(wy, zoom)), lng: roundCoord(worldXToLng(wx, zoom)) };
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        if (disabled || e.button !== 0) return;
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!dx && !dy) return;
        d.moved += Math.abs(dx) + Math.abs(dy);
        d.x = e.clientX;
        d.y = e.clientY;
        setCenter(c => ({
            lat: worldYToLat(latToWorldY(c.lat, zoom) - dy, zoom),
            lng: worldXToLng(lngToWorldX(c.lng, zoom) - dx, zoom),
        }));
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        const d = drag.current;
        drag.current = null;
        if (!d || d.id !== e.pointerId) return;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (disabled || d.moved > DRAG_SLOP) return;
        const p = pointToLatLng(e.clientX, e.clientY);
        if (p) onPick(p.lat, p.lng);
    }

    function zoomBy(delta: number, anchor?: { lat: number; lng: number }) {
        const next = clampZoom(zoom + delta);
        if (next === zoom) return;
        setZoom(next);
        if (anchor) setCenter(anchor);
    }

    const markers: MapMarker[] = [
        ...context.filter(m => !(m.lat === lat && m.lng === lng)).map(m => ({ ...m, kind: "context" as const })),
        ...(lat !== undefined && lng !== undefined ? [{ lat, lng, title: "המיקום של הערך", kind: "primary" as const }] : []),
    ];

    return (
        <div>
            <div
                ref={boxRef}
                data-testid="tlm-map"
                style={{
                    position: "relative",
                    height,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "#ccc",
                    borderRadius: 6,
                    background: "#e8eef2",
                    cursor: disabled ? "default" : "crosshair",
                    touchAction: "none",
                    userSelect: "none",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => { drag.current = null; }}
                onDoubleClick={e => {
                    if (disabled) return;
                    const p = pointToLatLng(e.clientX, e.clientY);
                    zoomBy(1, p ?? undefined);
                }}
            >
                {tiles.map(t => (
                    <img
                        key={t.key}
                        src={tileUrl(t)}
                        alt=""
                        draggable={false}
                        style={{ position: "absolute", left: t.left, top: t.top, width: 256, height: 256, pointerEvents: "none" }}
                        loading="lazy"
                        // אריח שלא נטען (רשת חסומה) – רקע ריק ולא סמל תמונה שבורה
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                ))}

                {markers.map((m, i) => {
                    const p = project(m.lat, m.lng);
                    if (!p.inside) return null;
                    const primary = m.kind === "primary";
                    return (
                        <div
                            key={`${m.lat},${m.lng},${i}`}
                            title={m.title}
                            style={{
                                position: "absolute",
                                left: p.x,
                                top: p.y,
                                width: primary ? 16 : 10,
                                height: primary ? 16 : 10,
                                marginLeft: primary ? -8 : -5,
                                marginTop: primary ? -8 : -5,
                                borderRadius: "50%",
                                background: primary ? "#d32f2f" : "#1565c0",
                                borderWidth: 2,
                                borderStyle: "solid",
                                borderColor: "#fff",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                                pointerEvents: "none",
                                zIndex: primary ? 3 : 2,
                            }}
                        />
                    );
                })}

                <div style={{ position: "absolute", top: 8, insetInlineStart: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 4 }}>
                    <button type="button" style={mapBtn} onClick={() => zoomBy(1)} disabled={zoom >= MAX_ZOOM} title="התקרבות">+</button>
                    <button type="button" style={mapBtn} onClick={() => zoomBy(-1)} disabled={zoom <= MIN_ZOOM} title="התרחקות">−</button>
                </div>

                <div
                    style={{
                        position: "absolute",
                        bottom: 0,
                        insetInlineEnd: 0,
                        background: "rgba(255,255,255,0.8)",
                        fontSize: 10,
                        padding: "1px 5px",
                        direction: "ltr",
                        zIndex: 4,
                    }}
                >
                    © OpenStreetMap
                </div>
            </div>
            <p style={{ ...ts.hint, marginTop: 4 }}>
                לחיצה על המפה קובעת את המיקום. גרירה מזיזה, לחיצה כפולה מתקרבת. זום {zoom}.
            </p>
        </div>
    );
}

const mapBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    lineHeight: "26px",
    textAlign: "center",
    padding: 0,
    fontSize: 18,
    fontWeight: 700,
    background: "#fff",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "#aaa",
    borderRadius: 4,
    cursor: "pointer",
    color: "#333",
};
