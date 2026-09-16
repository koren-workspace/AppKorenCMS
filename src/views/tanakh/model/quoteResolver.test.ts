import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeHebrew, QuoteResolver, type TanakhBookText } from "./quoteResolver";

const fake: TanakhBookText = {
    id: "demo",
    chapters: [
        [
            { t: "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃" },
            { t: "וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ וְחֹ֖שֶׁךְ עַל־פְּנֵ֣י תְה֑וֹם" },
            { t: "וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י א֑וֹר וַֽיְהִי־אֽוֹר׃" },
        ],
        [
            { t: "וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י רָקִ֖יעַ" },
            { t: "מילים אחרות לגמרי כאן" },
        ],
    ],
};

describe("normalizeHebrew", () => {
    it("מסיר ניקוד וטעמים, מקף → רווח, ﬠ → ע", () => {
        expect(normalizeHebrew("וַיֹּ֥אמֶר אֱלֹהִ֖ים")).toBe("ויאמר אלהים");
        expect(normalizeHebrew("עַל־פְּנֵ֣י")).toBe("על פני");
        expect(normalizeHebrew(".ﬠלוּ זֶה בַּנֶּגֶב")).toBe("עלו זה בנגב");
    });
});

describe("QuoteResolver", () => {
    const r = new QuoteResolver([fake]);

    it("פסוק שלם עם ניקוד שונה", () => {
        expect(r.resolve("בראשית ברא אלהים את השמים ואת הארץ")).toEqual({ book: "demo", ch: 1, v: 1 });
    });

    it("חלק מפסוק", () => {
        expect(r.resolve("וחשך על פני תהום")).toEqual({ book: "demo", ch: 1, v: 2 });
    });

    it("ציטוט שמשתרע על שני פסוקים → טווח", () => {
        expect(r.resolve("ואת הארץ והארץ היתה תהו ובהו")).toEqual({ book: "demo", ch: 1, v: 1, v2: 2 });
    });

    it("התאמות מרובות → לא מזוהה (ויאמר אלהים יהי מופיע פעמיים)", () => {
        expect(r.resolve("ויאמר אלהים יהי")).toBeUndefined();
    });

    it("התאמה יחידה גם כשההתחלה משותפת", () => {
        expect(r.resolve("ויאמר אלהים יהי רקיע")).toEqual({ book: "demo", ch: 2, v: 1 });
    });

    it("השמטה (...) בתוך פסוק ובין פסוקים", () => {
        expect(r.resolve("בראשית ברא... ואת הארץ")).toEqual({ book: "demo", ch: 1, v: 1 });
        expect(r.resolve("בראשית ברא אלהים... וחשך על פני תהום")).toEqual({ book: "demo", ch: 1, v: 1, v2: 2 });
        expect(r.resolve("...והארץ היתה תהו ובהו... יהי אור")).toEqual({ book: "demo", ch: 1, v: 2, v2: 3 });
        expect(r.resolve("בראשית ברא אלהים... מילים שלא קיימות")).toBeUndefined();
    });

    it("קיצור שם ה' מתאים לשם המלא בטקסט", () => {
        const book: TanakhBookText = { id: "d2", chapters: [[{ t: "וַיֵּרָא מַלְאַךְ יְהֹוָה אֵלָיו בְּלַבַּת־אֵשׁ" }]] };
        const r2 = new QuoteResolver([book]);
        expect(r2.resolve("וַיֵּרָא מַלְאַךְ ה' אֵלָיו")).toEqual({ book: "d2", ch: 1, v: 1 });
        expect(r2.resolve("וירא מלאך ה׳ אליו בלבת אש")).toEqual({ book: "d2", ch: 1, v: 1 });
    });

    it("ציטוט קצר מדי או לא קיים → לא מזוהה", () => {
        expect(r.resolve("ברא")).toBeUndefined();
        expect(r.resolve("טקסט שלא קיים בשום מקום")).toBeUndefined();
    });
});

const TANAKH_DIR = resolve(process.cwd(), "..", "Tanakh-LaMetayel", "assets", "content", "tanakh");

describe.skipIf(!existsSync(resolve(TANAKH_DIR, "yehoshua.json")))("QuoteResolver על הטקסט האמיתי", () => {
    const yehoshua: TanakhBookText = JSON.parse(readFileSync(resolve(TANAKH_DIR, "yehoshua.json"), "utf8"));
    const shemot: TanakhBookText = JSON.parse(readFileSync(resolve(TANAKH_DIR, "shemot.json"), "utf8"));
    const r = new QuoteResolver([yehoshua, shemot]);

    it("יהושע יח, א", () => {
        expect(r.resolve("וַיִּקָּהֲלוּ כָּל עֲדַת בְּנֵי יִשְׂרָאֵל שִׁלֹה וַיַּשְׁכִּינוּ שָׁם אֶת אֹהֶל מוֹעֵד")).toEqual({ book: "yehoshua", ch: 18, v: 1 });
    });

    it("שמות ג, ב עם ה' מקוצר", () => {
        expect(r.resolve("וַיֵּרָא מַלְאַךְ ה' אֵלָיו בְּלַבַּת אֵשׁ מִתּוֹךְ הַסְּנֶה")).toEqual({ book: "shemot", ch: 3, v: 2 });
    });

    it("שמות ג, ח (ציטוט מהגיליון עם מקפים)", () => {
        expect(r.resolve("וָאֵרֵד לְהַצִּילוֹ מִיַּד מִצְרַיִם וּלְהַעֲלֹתוֹ מִן־הָאָרֶץ הַהִוא אֶל־אֶרֶץ טוֹבָה וּרְחָבָה")).toEqual({ book: "shemot", ch: 3, v: 8 });
    });
});
