import { describe, expect, it } from "vitest";
import { reverseUrl, searchUrl, shortPlaceName, type PlaceResult } from "./geocode";

const place = (address: PlaceResult["address"], displayName = ""): PlaceResult => ({ lat: 33.3486, lng: 35.568, displayName, address });

describe("reverseUrl", () => {
    it("מבקש תשובה בעברית ברמת יישוב", () => {
        const url = new URL(reverseUrl(33.3486, 35.568));
        expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/reverse");
        expect(url.searchParams.get("lat")).toBe("33.3486");
        expect(url.searchParams.get("lon")).toBe("35.568");
        expect(url.searchParams.get("accept-language")).toBe("he,en");
        expect(url.searchParams.get("zoom")).toBe("14");
    });
});

describe("searchUrl", () => {
    it("מקודד שאילתה בעברית ומבקש פרטי כתובת", () => {
        const url = new URL(searchUrl("מרג' עיון"));
        expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search");
        expect(url.searchParams.get("q")).toBe("מרג' עיון");
        expect(url.searchParams.get("addressdetails")).toBe("1");
        expect(url.searchParams.get("accept-language")).toBe("he,en");
    });
});

describe("shortPlaceName", () => {
    it("יישוב, מחוז ומדינה", () => {
        expect(shortPlaceName(place({ town: "מרג' עיון", state: "נבטייה", country: "לבנון" }))).toBe("מרג' עיון, נבטייה, לבנון");
    });

    it("כפר קודם לעיר, ומדלג על רכיבים חסרים", () => {
        expect(shortPlaceName(place({ village: "שילה", city: "לא אמור להופיע", country: "ישראל" }))).toBe("שילה, ישראל");
    });

    it("בלי רכיבי כתובת – שלושת החלקים הראשונים של השם המלא", () => {
        expect(shortPlaceName({ lat: 0, lng: 0, displayName: "תל דיבין, מרג' עיון, נבטייה, לבנון" })).toBe("תל דיבין, מרג' עיון, נבטייה");
    });

    it("כתובת בלי יישוב ובלי מחוז – נופל לשם המלא", () => {
        expect(shortPlaceName(place({}, "שטח פתוח, לבנון"))).toBe("שטח פתוח, לבנון");
    });
});
