import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({}));
vi.mock("../../../firebase_config", () => ({ getFirebaseApp: vi.fn(), isProdConfigured: vi.fn(() => true) }));
vi.mock("./prodAuthService", () => ({ getProdFirestore: vi.fn(), isProdAuthenticated: vi.fn() }));
vi.mock("./bagelUpdateTimeService", () => ({ updateBagelTimestamp: vi.fn() }));
vi.mock("../collections", () => ({ calendarCollection: {} }));

import { buildUpdatedCalendarDoc, initialPublishSteps, whyCannotUpdate } from "./dateSetUpdateService";

describe("buildUpdatedCalendarDoc", () => {
    const existing = {
        dateSetId: "205",
        timestamp: 1,
        abroad: false,
        weekdays: [7],
        roshHodesh: true,
        dates_when_we_say_prayer: [{ startDate: 1, startMonth: 7, endDate: 1, endMonth: 7 }],
    };

    it("replaces managed fields fully – a field removed in the form is gone", () => {
        const next = buildUpdatedCalendarDoc(existing, "205", { abroad: false }, 99);
        expect(next.weekdays).toBeUndefined();
        expect(next.dates_when_we_say_prayer).toBeUndefined();
        expect(next.abroad).toBe(false);
    });

    it("keeps fields the form does not manage", () => {
        const next = buildUpdatedCalendarDoc(existing, "205", { abroad: false }, 99);
        expect(next.roshHodesh).toBe(true);
    });

    it("keeps the id and stamps the new timestamp", () => {
        const next = buildUpdatedCalendarDoc(existing, "205", { abroad: true }, 99);
        expect(next.dateSetId).toBe("205");
        expect(next.timestamp).toBe(99);
    });
});

describe("whyCannotUpdate", () => {
    it("blocks 100", () => expect(whyCannotUpdate("100")).toMatch("100"));
    it("blocks a deleted set", () => expect(whyCannotUpdate("651", { deleted: true })).toMatch("מחוק"));
    it("allows a live set", () => expect(whyCannotUpdate("651", { abroad: false })).toBeNull());
});

describe("initialPublishSteps", () => {
    it("marks prod steps skipped when prod is not configured", () => {
        const steps = initialPublishSteps(false);
        expect(steps.filter((s) => s.key.startsWith("prod-")).every((s) => s.status === "skipped")).toBe(true);
        expect(steps.filter((s) => s.key.startsWith("stage-")).every((s) => s.status === "pending")).toBe(true);
    });
});
