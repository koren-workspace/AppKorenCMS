import { describe, expect, it } from "vitest";
import { emptyEntry, type Entry } from "../model/types";
import { filterEntries, matchesQuery, matchesQuickFilter, queryRank, rankEntries, searchKey, skeletonKey, sortEntries } from "./search";

function make(id: string, he: string, cat = "places", extra: Partial<Entry> = {}): Entry {
    const e = emptyEntry(id, cat, 1);
    e.title.he = he;
    e.visible = true;
    return { ...e, ...extra };
}

describe("search keys", () => {
    it("מסיר ניקוד ופיסוק; skeleton מסיר ו/י", () => {
        expect(searchKey("שִׁילֹה, ")).toBe("שילה");
        expect(skeletonKey("גיא בן הינום")).toBe("גאבןהנם");
    });
});

describe("matchesQuery", () => {
    const e = make("e0203", "שִׁילֹה", "places", { altTitles: { he: ["שילו"], en: ["Shiloh"] } });
    it("לפי כותרת, שם נוסף, מזהה, ואנגלית", () => {
        expect(matchesQuery(e, "שילה")).toBe(true);
        expect(matchesQuery(e, "שילו")).toBe(true);
        expect(matchesQuery(e, "e0203")).toBe(true);
        expect(matchesQuery(e, "shiloh")).toBe(true);
        expect(matchesQuery(e, "ירושלים")).toBe(false);
    });
    it("כתיב מלא/חסר", () => {
        const g = make("e1", "גיא בן הינום");
        expect(matchesQuery(g, "גיא בן הנם")).toBe(true);
    });
    it("שאילתה ריקה מתאימה לכולם", () => {
        expect(matchesQuery(e, "  ")).toBe(true);
    });
});

describe("quick filters and sorting", () => {
    const a = make("e1", "אלף", "land", { review: ["x"] });
    const b = make("e2", "בית", "places", { visible: false, location: { lat: 32, lng: 35, conf: 1 } });
    const c = make("e3", "גמל", "places", { see: "e1" });
    const d = make("e4", "דלת", "places", { title: { he: "דלת", en: "Door" }, i18n: { en: { status: "stale", updatedAt: 1 } } });
    it("מסננים", () => {
        expect(matchesQuickFilter(a, "review")).toBe(true);
        expect(matchesQuickFilter(b, "hidden")).toBe(true);
        expect(matchesQuickFilter(a, "noLocation")).toBe(true);
        expect(matchesQuickFilter(b, "noLocation")).toBe(false);
        expect(matchesQuickFilter(c, "noLocation")).toBe(false); // הפניה לא צריכה מיקום
        expect(matchesQuickFilter(c, "redirect")).toBe(true);
        expect(matchesQuickFilter(a, "untranslated")).toBe(true);
        expect(matchesQuickFilter(d, "untranslated")).toBe(false);
        expect(matchesQuickFilter(d, "stale")).toBe(true);
    });
    it("filterEntries משלב קטגוריה, מסנן וחיפוש", () => {
        expect(filterEntries([a, b, c, d], { query: "", cat: "places", quick: null }).map(e => e.id)).toEqual(["e2", "e3", "e4"]);
        expect(filterEntries([a, b, c, d], { query: "ב", cat: "all", quick: "hidden" }).map(e => e.id)).toEqual(["e2"]);
    });
    it("sortEntries לפי סדר קטגוריה ואז כותרת", () => {
        const order = new Map([["places", 3], ["land", 0]]);
        expect(sortEntries([d, c, b, a], order).map(e => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
    });
});

describe("queryRank / rankEntries", () => {
    const shor = make("e0483", "שׁוּר");
    const tashur = make("e0092", "תַּאְשׁוּר");
    const bakar = make("e0107", "בָּקָר, עֵגֶל, פָּר, שׁוֹר");
    const nesher = make("e0146", "נֶשֶׁר");
    const sharon = make("e0498", "שָׁרוֹן");
    const telShilo = make("e0632", "תל שילה");
    const shilo = make("e0486", "שִׁלֹה");
    it("התאמה מדויקת ראשונה, אחריה תחילת שם, מילה, הכלה, ולבסוף כתיב מלא/חסר", () => {
        expect(queryRank(shor, "שור")).toBe(0);
        expect(queryRank(tashur, "שור")).toBe(3);
        expect(queryRank(bakar, "שור")).toBe(2);
        expect(queryRank(nesher, "שור")).toBe(5);
        expect(queryRank(sharon, "שור")).toBe(5);
        expect(queryRank(telShilo, "שילה")).toBe(2);
        expect(queryRank(shilo, "שילה")).toBe(4); // כתיב חסר בכותרת, מלא בשאילתה
        expect(queryRank(shilo, "שלה")).toBe(0);
        expect(queryRank(shilo, "ירושלים")).toBeNull();
    });
    it("rankEntries: הטובים קודם, ובתוך אותו דירוג בסדר המקורי; total לפני החיתוך", () => {
        const all = [tashur, bakar, nesher, sharon, shor];
        const { matches, total } = rankEntries(all, "שור", 3);
        expect(matches.map(e => e.id)).toEqual(["e0483", "e0107", "e0092"]);
        expect(total).toBe(5);
    });
    it("שאילתה ריקה: הכול בדירוג 0", () => {
        expect(rankEntries([shor, nesher], "", 10).matches.map(e => e.id)).toEqual(["e0483", "e0146"]);
    });
});
