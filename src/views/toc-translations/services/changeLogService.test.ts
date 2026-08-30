import { describe, expect, it } from "vitest";
import { sanitizeForFirestore } from "./changeLogService";

describe("sanitizeForFirestore", () => {
    it("משמיט שדות undefined בתוך אובייקטים (Firestore דוחה אותם)", () => {
        const out = sanitizeForFirestore({
            action: "save_part_items",
            context: { tocId: undefined, prayerId: "2015010" },
        }) as any;
        expect(out).toEqual({
            action: "save_part_items",
            context: { prayerId: "2015010" },
        });
        expect("tocId" in out.context).toBe(false);
    });

    it("משאיר null כמו שהוא (ערך חוקי ב-Firestore)", () => {
        const out = sanitizeForFirestore({ context: { tocId: null } }) as any;
        expect(out.context.tocId).toBeNull();
    });

    it("גוזם מחרוזות ארוכות מ-2000 תווים עם ציון האורך המקורי", () => {
        const long = "א".repeat(2500);
        const out = sanitizeForFirestore({ content: long }) as any;
        expect(out.content).toBe("א".repeat(2000) + "…[נגזם, 2500 תווים במקור]");
        expect(out.content.length).toBeLessThan(2100);
    });

    it("לא נוגע במחרוזות קצרות, מספרים ובוליאנים", () => {
        const entry = {
            id: "chg_1",
            timestamp: 1782109240674,
            savedToFirestore: true,
            action: "delete_part_item",
        };
        expect(sanitizeForFirestore(entry)).toEqual(entry);
    });

    it("גוזם גם בתוך fieldChanges מקוננים (ערכי לפני/אחרי ארוכים)", () => {
        const out = sanitizeForFirestore({
            details: {
                fieldChanges: [
                    {
                        entityId: "e1",
                        changes: [
                            { field: "content", oldValue: "x".repeat(3000), newValue: "y" },
                        ],
                    },
                ],
            },
        }) as any;
        const change = out.details.fieldChanges[0].changes[0];
        expect(change.oldValue).toContain("…[נגזם, 3000 תווים במקור]");
        expect(change.newValue).toBe("y");
    });

    it("ממיר מערך-בתוך-מערך למחרוזת (Firestore אינו תומך בקינון כזה)", () => {
        const out = sanitizeForFirestore({
            details: { matrix: [["a", "b"], "c"] },
        }) as any;
        expect(out.details.matrix[0]).toBe(JSON.stringify(["a", "b"]));
        expect(out.details.matrix[1]).toBe("c");
    });

    it("עוצר קינון עמוק מ-12 רמות (מחזיר null במקום לולאה אינסופית)", () => {
        let nested: any = "value";
        for (let i = 0; i < 20; i++) nested = { a: nested };
        const out = sanitizeForFirestore(nested);
        expect(JSON.stringify(out)).toContain("null");
        expect(JSON.stringify(out)).not.toContain("value");
    });

    it("undefined בודד ובתוך מערך הופך ל-null (לא נמחק ממערכים)", () => {
        expect(sanitizeForFirestore(undefined)).toBeNull();
        const out = sanitizeForFirestore({ list: ["a", undefined, "b"] }) as any;
        expect(out.list).toEqual(["a", null, "b"]);
    });
});
