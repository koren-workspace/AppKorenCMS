/**
 * בדיקות ל-itemUtils – הקצאת itemId בהכנסה/העברה/העתקה
 *
 * מתמקד בהפרדה בין extraTakenIds (אילוץ מיקום: מרימים idBefore כשהם ברווח)
 * לבין collisionOnlyIds (מניעת התנגשות בלבד: לעולם לא משפיעים על הגבולות).
 */

import { describe, it, expect } from "vitest";
import {
    computeItemIdForInsert,
    computeInsertSlotBounds,
    allocateLinearItemIds,
} from "./itemUtils";

describe("itemUtils – collisionOnlyIds לעומת extraTakenIds", () => {
    it("אין idAfter: ה-IDs הישנים של פריטים מועברים (collisionOnlyIds) לא מרימים את idBefore", () => {
        // מקטע יעד ריק, המקטע הקודם מסתיים ב-2011138000, כל המקטעים הבאים ריקים → אין idAfter.
        // הפריטים המועברים מגיעים מטווח רחוק מאוד למעלה (203231715802...).
        const oldMovedIds = ["2032317158", "2032317159", "2032317160"];
        const id = computeItemIdForInsert([], 0, {
            neighborBounds: { prevLastItemId: "2011138000" },
            collisionOnlyIds: oldMovedIds,
        });
        // idBefore + MIT_ID_GAP – צמוד למקטע הקודם, לא מעל ה-IDs הישנים
        expect(id).toBe("2011139000");
        expect(Number(id)).toBeLessThan(Number(oldMovedIds[0]));
    });

    it("אין idAfter: extraTakenIds (מיקומיים) ממשיכים להרים את idBefore – התנהגות קיימת", () => {
        const id = computeItemIdForInsert(["100"], 1, {
            extraTakenIds: ["105"],
        });
        expect(id).toBe("1105");
    });

    it("collisionOnlyIds נשארים ב-takenIds: ID חדש לא מתנגש בהם", () => {
        // ללא collisionOnlyIds היינו מקבלים 1100; 1100 תפוס → 1101
        const id = computeItemIdForInsert(["100"], 1, {
            collisionOnlyIds: ["1100"],
        });
        expect(id).toBe("1101");
    });

    it("computeInsertSlotBounds: עם שני גבולות התוצאה ללא שינוי (מקרה רגיל)", () => {
        const bounds = computeInsertSlotBounds(["100", "200"], 1, {
            neighborBounds: { prevLastItemId: "50", nextFirstItemId: "300" },
            extraTakenIds: ["999999"],
        });
        expect(bounds).toEqual({ idBefore: "100", idAfter: "200" });
    });

    it("הקצאה לינארית: IDs של פריטים מועברים נשמרים כתפוסים אך לא מזיזים את החריץ", () => {
        const oldMovedIds = ["2032317158", "2032317159"];
        const bounds = computeInsertSlotBounds([], 0, {
            neighborBounds: { prevLastItemId: "2000", nextFirstItemId: "5000" },
        });
        expect(bounds).toEqual({ idBefore: "2000", idAfter: "5000" });
        const taken = new Set<string>(oldMovedIds);
        const ids = allocateLinearItemIds(bounds.idBefore, bounds.idAfter, 2, taken);
        expect(ids).toEqual(["3000", "4000"]);
    });
});
