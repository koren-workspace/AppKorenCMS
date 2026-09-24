import { describe, expect, it } from "vitest";
import {
    clampZoom,
    latToWorldY,
    lngToWorldX,
    parseCoordinates,
    roundCoord,
    tileUrl,
    TILE_SIZE,
    visibleTiles,
    worldSize,
    worldXToLng,
    worldYToLat,
} from "./tiles";

describe("היטל מרקטור", () => {
    it("קו גריניץ' והמשווה נופלים במרכז העולם", () => {
        expect(lngToWorldX(0, 0)).toBeCloseTo(TILE_SIZE / 2, 6);
        expect(latToWorldY(0, 0)).toBeCloseTo(TILE_SIZE / 2, 6);
    });

    it("הקצוות נופלים על גבולות הריבוע", () => {
        expect(lngToWorldX(-180, 3)).toBeCloseTo(0, 6);
        expect(lngToWorldX(180, 3)).toBeCloseTo(worldSize(3), 6);
        // הצפון למעלה: קו הרוחב העליון נופל על y=0 והתחתון על קצה הריבוע
        expect(latToWorldY(85.05112878, 3)).toBeCloseTo(0, 3);
        expect(latToWorldY(-85.05112878, 3)).toBeCloseTo(worldSize(3), 3);
    });

    it("המרה הלוך ושוב מחזירה את אותה נקודה", () => {
        for (const z of [4, 8, 13, 18]) {
            for (const [lat, lng] of [[31.7683, 35.2137], [32.0556, 35.2897], [-33.87, 151.21]]) {
                expect(worldYToLat(latToWorldY(lat, z), z)).toBeCloseTo(lat, 6);
                expect(worldXToLng(lngToWorldX(lng, z), z)).toBeCloseTo(lng, 6);
            }
        }
    });

    it("רוחב גיאוגרפי גדול יותר נמצא גבוה יותר במפה", () => {
        expect(latToWorldY(33, 10)).toBeLessThan(latToWorldY(31, 10));
    });

    it("clampZoom מגביל לטווח המותר", () => {
        expect([clampZoom(-3), clampZoom(8.4), clampZoom(99)]).toEqual([2, 8, 18]);
    });
});

describe("visibleTiles", () => {
    it("מכסה את כל המסגרת ומציב את האריחים ברצף", () => {
        const z = 8;
        const cx = lngToWorldX(35, z);
        const cy = latToWorldY(31.7, z);
        const tiles = visibleTiles(cx, cy, 600, 320, z);
        expect(tiles.length).toBeGreaterThan(0);
        // הפינה הימנית-תחתונה של האריח האחרון מכסה את קצה המסגרת
        expect(Math.min(...tiles.map(t => t.left))).toBeLessThanOrEqual(0);
        expect(Math.min(...tiles.map(t => t.top))).toBeLessThanOrEqual(0);
        expect(Math.max(...tiles.map(t => t.left)) + TILE_SIZE).toBeGreaterThanOrEqual(600);
        expect(Math.max(...tiles.map(t => t.top)) + TILE_SIZE).toBeGreaterThanOrEqual(320);
        expect(new Set(tiles.map(t => t.key)).size).toBe(tiles.length);
    });

    it("לא מבקש אריחים מעל או מתחת לעולם", () => {
        const z = 3;
        const tiles = visibleTiles(worldSize(z) / 2, 0, 400, 400, z);
        expect(tiles.every(t => t.y >= 0 && t.y < Math.pow(2, z))).toBe(true);
    });

    it("גולש סביב קו התאריך: אינדקס האריח תמיד בטווח", () => {
        const z = 2;
        const tiles = visibleTiles(0, worldSize(z) / 2, 600, 200, z);
        expect(tiles.every(t => t.x >= 0 && t.x < Math.pow(2, z))).toBe(true);
    });

    it("tileUrl בונה כתובת של OpenStreetMap", () => {
        expect(tileUrl({ z: 8, x: 147, y: 103 })).toBe("https://tile.openstreetmap.org/8/147/103.png");
    });
});

describe("parseCoordinates", () => {
    it("זוג מספרים בפסיק או ברווח", () => {
        expect(parseCoordinates("31.7683, 35.2137")).toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(parseCoordinates("31.7683 35.2137")).toEqual({ lat: 31.7683, lng: 35.2137 });
        expect(parseCoordinates("  -3.5,-45  ")).toEqual({ lat: -3.5, lng: -45 });
    });

    it("כתובת של Google Maps", () => {
        expect(parseCoordinates("https://www.google.com/maps/@32.0556,35.2897,15z")).toEqual({ lat: 32.0556, lng: 35.2897 });
        expect(parseCoordinates("https://maps.google.com/?q=32.0556,35.2897")).toEqual({ lat: 32.0556, lng: 35.2897 });
    });

    it("דוחה קלט לא תקין או מחוץ לטווח", () => {
        expect(parseCoordinates("")).toBeNull();
        expect(parseCoordinates("שילה")).toBeNull();
        expect(parseCoordinates("31.7683")).toBeNull();
        expect(parseCoordinates("120, 35")).toBeNull();
        expect(parseCoordinates("31, 200")).toBeNull();
    });

    it("roundCoord מקצר לשש ספרות", () => {
        expect(roundCoord(31.76831234567)).toBe(31.768312);
        expect(roundCoord(35)).toBe(35);
    });
});
