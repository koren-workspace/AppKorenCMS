import { describe, expect, it } from "vitest";
import { MAX_IMAGE_DIM, slugifyFileName, targetSize, uniqueFileName } from "./imageFile";
import { formatBytes, isRemoteImage, mediaPath } from "../services/mediaService";

describe("targetSize", () => {
    it("תמונה קטנה מהמקסימום לא גדלה", () => {
        expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 });
        expect(targetSize(MAX_IMAGE_DIM, 900)).toEqual({ width: MAX_IMAGE_DIM, height: 900 });
    });

    it("מקטין לפי הצלע הארוכה ושומר על יחס הצדדים", () => {
        expect(targetSize(3200, 2400)).toEqual({ width: 1600, height: 1200 });
        expect(targetSize(2400, 3200)).toEqual({ width: 1200, height: 1600 });
        expect(targetSize(4000, 1000, 1000)).toEqual({ width: 1000, height: 250 });
    });

    it("ממדים לא תקינים מחזירים אפס, ולא NaN", () => {
        expect(targetSize(0, 0)).toEqual({ width: 0, height: 0 });
        expect(targetSize(NaN, 10)).toEqual({ width: 0, height: 0 });
    });
});

describe("שמות קבצים", () => {
    it("מנקה שם לאותיות לטיניות, ספרות ומקפים", () => {
        expect(slugifyFileName("Tel Shiloh 2024.JPG")).toBe("tel-shiloh-2024");
        expect(slugifyFileName("צילום מהתל.png")).toBe("image");
        expect(slugifyFileName("")).toBe("image");
        expect(slugifyFileName("--a--b--.webp")).toBe("a-b");
    });

    it("uniqueFileName מוסיף חותמת זמן וסיומת", () => {
        expect(uniqueFileName("Tel Shiloh.jpg", "webp", 1700000000000)).toBe("loyw3v28-tel-shiloh.webp");
    });

    it("אותו שם בזמנים שונים אינו מתנגש", () => {
        expect(uniqueFileName("a.jpg", "webp", 1)).not.toBe(uniqueFileName("a.jpg", "webp", 2));
    });

    it("mediaPath בונה נתיב תחת media/ ותיקיית הערך", () => {
        expect(mediaPath("e0203", "abc.webp")).toBe("media/e0203/abc.webp");
    });
});

describe("isRemoteImage", () => {
    it("מבדיל בין כתובת לבין מזהה של תמונה ארוזה", () => {
        expect(isRemoteImage("https://firebasestorage.googleapis.com/v0/b/x/o/media%2Fe0203%2Fa.webp?alt=media")).toBe(true);
        expect(isRemoteImage("e0203_1_1")).toBe(false);
        expect(isRemoteImage("media/e0203/a.webp")).toBe(false);
    });
});

describe("formatBytes", () => {
    it("מציג יחידות קריאות", () => {
        expect([formatBytes(500), formatBytes(2048), formatBytes(3 * 1024 * 1024)]).toEqual(["500B", "2KB", "3.0MB"]);
    });
});
