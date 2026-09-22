import { describe, expect, it } from "vitest";

import { buildImageLibrary, findImages, MAX_RESULTS, type LibraryImage } from "./imageLibrary";
import type { Entry, EntryImage } from "./types";

const img = (src: string, he?: string): EntryImage => ({ kind: "baked", src, ...(he ? { caption: { he } } : {}) });

function entry(id: string, he: string, images: EntryImage[]): Entry {
    return { id, title: { he }, images } as unknown as Entry;
}

const entries = [
    entry("e0149", "סָלְעָם", [img("e0149_169_798", "עש הבגדים (בהגדלה)")]),
    entry("e0150", "סָס, עָש", []),
    entry("e0498", "שָׁרוֹן", [img("e0499_428_1866", "גן לאומי חוף השרון")]),
    entry("e0700", "בלי כיתוב", [img("e0700_1_1")]),
];
const library = buildImageLibrary(entries);

describe("buildImageLibrary", () => {
    it("אוסף כל תמונה עם הערך שמחזיק אותה", () => {
        expect(library).toHaveLength(3);
        expect(library[0]).toMatchObject({ entryId: "e0149", entryTitle: "סָלְעָם" });
    });

    it("ערך בלי תמונות לא מוסיף דבר", () => {
        expect(library.some(r => r.entryId === "e0150")).toBe(false);
    });
});

describe("findImages", () => {
    // המקרה שהבורר נבנה בשבילו: התמונה נתלתה על ערך ההפניה, והעורך
    // מחפש אותה לפי מה שכתוב מתחתיה.
    it("מוצא לפי כיתוב", () => {
        expect(findImages(library, "עש הבגדים").map(r => r.img.src)).toEqual(["e0149_169_798"]);
    });

    it("מוצא לפי שם הערך שמחזיק, ולפי מזהה הקובץ", () => {
        expect(findImages(library, "שרון")).toHaveLength(1);
        expect(findImages(library, "e0499_428")).toHaveLength(1);
    });

    it("חיפוש קצר מדי לא מחזיר דבר", () => {
        expect(findImages(library, "ע")).toEqual([]);
        expect(findImages(library, "  ")).toEqual([]);
    });

    it("מדלג על תמונה שכבר על הערך הזה", () => {
        const current = [img("e0149_169_798")];
        expect(findImages(library, "עש", current)).toEqual([]);
    });

    it("תמונה שיושבת על כמה ערכים מוצגת פעם אחת", () => {
        const shared = img("shared_1_1", "תמונה משותפת");
        const lib = buildImageLibrary([entry("a", "ערך א", [shared]), entry("b", "ערך ב", [shared])]);
        expect(findImages(lib, "משותפת")).toHaveLength(1);
    });

    it("תמונה בלי כיתוב עדיין נמצאת לפי הערך שמחזיק אותה", () => {
        expect(findImages(library, "בלי כיתוב").map(r => r.img.src)).toEqual(["e0700_1_1"]);
    });

    it("הרשימה נעצרת כדי שאפשר יהיה לסרוק אותה", () => {
        const many: LibraryImage[] = Array.from({ length: 40 }, (_, i) => ({
            img: img(`x_${i}`, "נוף"),
            entryId: `e${i}`,
            entryTitle: "ערך",
        }));
        expect(findImages(many, "נוף")).toHaveLength(MAX_RESULTS);
    });
});
