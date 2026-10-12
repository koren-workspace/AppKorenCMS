import { describe, expect, it } from "vitest";
import { getItemStyle } from "./itemUtils";

describe("getItemStyle – טקסט נפתח", () => {
    it("גוף מסומן כנפתח מקבל פס ירוק בצד", () => {
        expect(getItemStyle("body", undefined, undefined, false, true)).toContain("border-r-emerald-400");
        expect(getItemStyle("identedBody", undefined, undefined, false, true)).toContain("border-r-emerald-400");
    });

    it("גוף רגיל, וסוגים שאינם גוף, לא מקבלים את הסימון", () => {
        expect(getItemStyle("body")).not.toContain("emerald");
        expect(getItemStyle("smallInstructions", undefined, undefined, false, true)).not.toContain("emerald");
    });
});
