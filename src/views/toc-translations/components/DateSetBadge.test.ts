import { describe, expect, it } from "vitest";
import { getDateSetProblem } from "./DateSetBadge";

const labels = {
    "650": { short: "a", full: "a" },
    "651": { short: "b", full: "b", deleted: true },
};

describe("getDateSetProblem", () => {
    it("flags a deleted entry", () => expect(getDateSetProblem("651", labels)).toBe("deleted"));
    it("flags an id with no calendar entry", () => expect(getDateSetProblem("12", labels)).toBe("missing"));
    it("passes a live entry", () => expect(getDateSetProblem("650", labels)).toBeNull());
    it("says nothing before the calendar has loaded", () => expect(getDateSetProblem("12", {})).toBeNull());
});
