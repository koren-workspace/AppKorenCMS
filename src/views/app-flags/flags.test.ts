/**
 * flags.test – the server-side mirror plan and the CMS-side document coercion.
 *
 * The plan is what decides which Bagel collections get written and with what
 * body; a wrong body here silently breaks the LEGACY apps, which nobody
 * tests any more. So every shape is pinned.
 */

import { describe, expect, it } from "vitest";
import { handleBagelFlagsRequest, planFlagWrites } from "../../../api/_lib/handleBagelFlags";
import { coerceFlags } from "./services/flagsService";

describe("planFlagWrites", () => {
    it("writes every flag present, in Bagel's own field names", () => {
        const planned = planFlagWrites({
            clearTime: 1742757234000,
            freeEnhancements: false,
            minAppVersion: { android: 10106, ios: 10106 },
        });
        expect(planned).toEqual({
            plan: [
                { collection: "clearTime", body: { timestamp: 1742757234000 } },
                { collection: "appPreferences", body: { freeEnhancements: false } },
                { collection: "minAppVersion", body: { android: 10106, ios: 10106 } },
            ],
        });
    });

    it("writes only the flags present, so a single field can be mirrored", () => {
        expect(planFlagWrites({ freeEnhancements: true })).toEqual({
            plan: [{ collection: "appPreferences", body: { freeEnhancements: true } }],
        });
    });

    it("turns null into 0 — the value every reader treats as 'none'", () => {
        expect(planFlagWrites({ clearTime: null, minAppVersion: { android: null } })).toEqual({
            plan: [
                { collection: "clearTime", body: { timestamp: 0 } },
                { collection: "minAppVersion", body: { android: 0 } },
            ],
        });
    });

    it("rejects malformed values instead of writing them", () => {
        expect(planFlagWrites({ clearTime: 1.5 })).toHaveProperty("error");
        expect(planFlagWrites({ freeEnhancements: "true" as unknown as boolean })).toHaveProperty("error");
        expect(planFlagWrites({ minAppVersion: { android: "33" as unknown as number } })).toHaveProperty("error");
        expect(planFlagWrites({})).toHaveProperty("error");
    });
});

describe("handleBagelFlagsRequest — before touching Bagel", () => {
    const config = { firebaseProjectId: "koren-stage", bagelToken: "t" };

    it("refuses anything but PUT", async () => {
        const result = await handleBagelFlagsRequest("GET", "Bearer x", { freeEnhancements: true }, config);
        expect(result.status).toBe(405);
    });

    it("validates the body before checking auth", async () => {
        const result = await handleBagelFlagsRequest("PUT", undefined, {}, config);
        expect(result.status).toBe(400);
    });

    it("requires a bearer token", async () => {
        const result = await handleBagelFlagsRequest("PUT", undefined, { freeEnhancements: true }, config);
        expect(result.status).toBe(401);
    });

    it("refuses prod when prod is not configured", async () => {
        const result = await handleBagelFlagsRequest("PUT", "Bearer x", { env: "prod", freeEnhancements: true }, config);
        expect(result.status).toBe(400);
    });
});

describe("coerceFlags (CMS reading the document)", () => {
    it("reads the migrated prod shape", () => {
        expect(coerceFlags({ clearTime: 1742757234000, freeEnhancements: true, minAppVersion: { android: 1, ios: 1 } })).toEqual({
            clearTime: 1742757234000,
            freeEnhancements: true,
            minAppVersion: { android: 1, ios: 1 },
        });
    });

    it("treats missing, zero or malformed values as none / paid, like the app does", () => {
        expect(coerceFlags({})).toEqual({ clearTime: null, freeEnhancements: false, minAppVersion: { android: null, ios: null } });
        expect(coerceFlags({ minAppVersion: { android: 0, ios: "7" } }).minAppVersion).toEqual({ android: null, ios: null });
    });
});
