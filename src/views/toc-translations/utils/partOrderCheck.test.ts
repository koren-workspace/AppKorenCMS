import { describe, expect, it } from "vitest";
import {
    findReorderConflicts,
    itemIdRange,
    partsToCheck,
    swappedPartPairs,
    type PartIdRange,
} from "./partOrderCheck";

// שחרית ספרד – המצב האמיתי שגרם לבאג (מזהים מתוך Firestore).
const ranges = new Map<string, PartIdRange>([
    ["2011130", { min: 201410911130, max: 201443711130 }], // סדר הלל
    ["2011135", { min: 201443811130, max: 201470777802 }], // שיר של יום (אחרי הלל)
    ["2011140", { min: 201470811140, max: 201574711140 }], // הושענות
    ["2011250", { min: 203175611250, max: 203209411250 }], // שיר של יום (סוף)
    ["2011546", { min: 203231711398, max: 203231714802 }], // קדיש יתום
    ["2011255", { min: 203232211250, max: 203253011250 }], // אין כאלוקינו
]);
const consistent = ["2011130", "2011135", "2011140", "2011250", "2011546", "2011255"];
const draggedKaddish = ["2011130", "2011135", "2011546", "2011140", "2011250", "2011255"];

describe("partOrderCheck", () => {
    it("swappedPartPairs lists only pairs whose relative order flipped", () => {
        expect(swappedPartPairs(["a", "b", "c", "d"], ["a", "d", "b", "c"])).toEqual([
            ["d", "b"],
            ["d", "c"],
        ]);
        expect(swappedPartPairs(["a", "b"], ["a", "b"])).toEqual([]);
    });

    it("partsToCheck covers the dragged part and the parts it crossed", () => {
        expect(partsToCheck(consistent, draggedKaddish).sort()).toEqual(
            ["2011140", "2011250", "2011546"].sort()
        );
    });

    it("itemIdRange is numeric, skips empty values and handles decimal ids", () => {
        expect(itemIdRange(["900", "1000", "", null, "950.5"])).toEqual({ min: 900, max: 1000 });
        expect(itemIdRange([])).toBeNull();
    });

    it("blocks dragging kaddish past parts whose item ids come before it", () => {
        expect(findReorderConflicts(consistent, draggedKaddish, ranges)).toEqual([
            { beforePartId: "2011546", afterPartId: "2011140" },
            { beforePartId: "2011546", afterPartId: "2011250" },
        ]);
    });

    it("allows dragging a broken order back to the item-id order", () => {
        expect(findReorderConflicts(draggedKaddish, consistent, ranges)).toEqual([]);
    });

    it("ignores empty parts (no items yet)", () => {
        const withEmpty = new Map(ranges);
        withEmpty.set("2011999", null);
        expect(
            findReorderConflicts(["2011130", "2011999"], ["2011999", "2011130"], withEmpty)
        ).toEqual([]);
    });

    it("does not report pairs whose ranges already overlapped before the drag", () => {
        const overlap = new Map<string, PartIdRange>([
            ["a", { min: 100, max: 300 }],
            ["b", { min: 200, max: 400 }],
        ]);
        expect(findReorderConflicts(["a", "b"], ["b", "a"], overlap)).toEqual([]);
    });
});
