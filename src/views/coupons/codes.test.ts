/**
 * codes.test – מגן על חוזה הנרמול/hash מול האפליקציה והכלי.
 *
 * ה-digest של ABCD-2345 להלן הוא הערך ש-tools/coupon-codes.mjs (Node crypto)
 * הפיק, ושהאפליקציה בודקת מולו ב-src/services/__tests__/coupons.test.ts.
 * אם הבדיקה הזו נשברת, קודים שנוצרו ב-CMS לא ייפדו באפליקציה.
 */

import { describe, expect, it } from "vitest";
import {
    CODE_ALPHABET,
    CODE_LENGTH,
    couponCodeHash,
    formatCouponCode,
    looksLikeHash,
    mintCouponCode,
    normaliseCouponCode,
} from "./codes";

const ABCD_2345 = "a00d76646eba91b057841554d5c8334f498dc592ed744bce404f21fe271cd36e";

describe("normaliseCouponCode", () => {
    it("makes spelling, spacing and dashes irrelevant", () => {
        for (const spelling of ["ABCD-2345", "abcd-2345", " abcd 2345 ", "ABCD2345"]) {
            expect(normaliseCouponCode(spelling)).toBe("ABCD2345");
        }
    });

    it("strips zero-width characters that ride along in a paste", () => {
        expect(normaliseCouponCode("‏ABCD​-2345‎")).toBe("ABCD2345");
    });
});

describe("couponCodeHash", () => {
    it("reproduces the digest tools/coupon-codes.mjs produced for ABCD-2345", async () => {
        expect(await couponCodeHash("ABCD-2345")).toBe(ABCD_2345);
        expect(await couponCodeHash("abcd 2345")).toBe(ABCD_2345);
    });

    it("is 64 lowercase hex characters", async () => {
        expect(await couponCodeHash("ZZZZ-9999")).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe("mintCouponCode", () => {
    it("produces XXXX-XXXX out of the ambiguity-free alphabet", () => {
        for (let i = 0; i < 50; i += 1) {
            const code = mintCouponCode();
            expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
            for (const ch of normaliseCouponCode(code)) {
                expect(CODE_ALPHABET).toContain(ch);
            }
            expect(normaliseCouponCode(code)).toHaveLength(CODE_LENGTH);
        }
    });

    it("rejects bytes outside the unbiased range instead of folding them", () => {
        // 250..255 must be skipped (248 = 8 * 31 is the limit); 0 maps to 'A'.
        const bytes = Uint8Array.from([255, 250, 0, 1, 2, 3, 4, 5, 6, 7, 254, 30]);
        let served = false;
        const code = mintCouponCode(() => {
            if (served) return Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]);
            served = true;
            return bytes;
        });
        expect(code).toBe("ABCD-EFGH");
    });

    it("formats an 8-character string as two groups", () => {
        expect(formatCouponCode("ABCDEFGH")).toBe("ABCD-EFGH");
    });
});

describe("looksLikeHash", () => {
    it("tells a pasted hash from a code", () => {
        expect(looksLikeHash(ABCD_2345)).toBe(true);
        expect(looksLikeHash("ABCD-2345")).toBe(false);
    });
});
