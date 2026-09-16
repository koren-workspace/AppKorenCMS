/**
 * תיקוני עוגנים חד-פעמיים לקראת ההעברה (שלב 3).
 *
 * העוגנים (הקישורים מפסוקי התנ"ך לערכים) נלקחים מ-`anchors.json` של
 * האפליקציה. רובם תקינים, אבל יש בהם קבוצה שהוצמדה לערך הלא נכון. הטבלה
 * כאן מתקנת אותם לפני שהעוגנים מקובצים לפי ערך, כך שהתוכן שנכתב ל-Firestore
 * כבר נקי. זהו תיקון נתונים בלבד: `anchors.json` באפליקציה לא משתנה.
 *
 * הקבוצה הראשונה: 13 עוגנים שהוצמדו ל-e0516 "לוח העמים" – ערך שאין בו תוכן
 * כלל (לא טקסט ולא תמונות) ולכן אינו עובר. כולם פסוקי אדום/שעיר ששייכים
 * ל-e0517 "אֱדוֹם, שֵׂעִיר". שלושה מהם הוצמדו לכותרת המזמור במקום לפסוק
 * שמזכיר את אדום, ואחד (יהושע טו, י) מדבר על הר שעיר אחר לגמרי – שעל גבול
 * יהודה ליד כסלון – ולכן יורד.
 *
 * שני עוגנים נוספים של e0516 – דה"א א, ד ("נֹחַ שֵׁם חָם וָיָפֶת") ודה"א
 * א, כח – הם באמת של לוח העמים, ולכן לא נוגעים בהם: הם יורדים יחד עם הערך.
 */

import type { LegacyAnchorMap } from "./fromLegacy";

export interface AnchorFix {
    /** מיקום העוגן היום */
    book: string;
    ch: number;
    v: number;
    /** הערך שאליו הוא מקושר היום */
    from: string;
    /** היעד; בלי `to` – העוגן יורד */
    to?: {
        /** ערך חדש (ברירת מחדל: אותו ערך) */
        entry?: string;
        /** פרק/פסוק חדשים (ברירת מחדל: אותם פרק/פסוק) */
        ch?: number;
        v?: number;
        /** מילה לעיגון בתוך הפסוק; `null` מוחק את הקיימת */
        w?: string | null;
    };
    /** למה – מופיע בדוח ההעברה */
    why: string;
}

const TO_EDOM = { entry: "e0517" } as const;

/** 13 העוגנים של e0516 "לוח העמים" */
export const ANCHOR_FIXES: readonly AnchorFix[] = [
    { book: "bereshit",         ch: 33, v: 15, from: "e0516", to: TO_EDOM, why: "עשו – שייך ל\"אדום, שעיר\"" },
    { book: "devarim",          ch: 2,  v: 12, from: "e0516", to: TO_EDOM, why: "\"וּבְשֵׂעִיר יָשְׁבוּ הַחֹרִים\"" },
    { book: "yehoshua",         ch: 15, v: 10, from: "e0516", why: "הר שעיר שעל גבול יהודה, לא שעיר של אדום – אין לו ערך" },
    { book: "yehoshua",         ch: 24, v: 4,  from: "e0516", to: TO_EDOM, why: "\"וָאֶתֵּן לְעֵשָׂו אֶת הַר שֵׂעִיר\"" },
    { book: "melakhim-a",       ch: 22, v: 48, from: "e0516", to: TO_EDOM, why: "\"וּמֶלֶךְ אֵין בֶּאֱדוֹם\"" },
    { book: "yirmiyahu",        ch: 9,  v: 25, from: "e0516", to: TO_EDOM, why: "\"וְעַל אֱדוֹם\"" },
    { book: "yirmiyahu",        ch: 25, v: 21, from: "e0516", to: TO_EDOM, why: "\"אֶת אֱדוֹם וְאֶת מוֹאָב\"" },
    { book: "yoel",             ch: 4,  v: 19, from: "e0516", to: TO_EDOM, why: "\"וֶאֱדוֹם לְמִדְבַּר שְׁמָמָה\"" },
    { book: "tehillim",         ch: 52, v: 1,  from: "e0516", to: { ...TO_EDOM, v: 2 }, why: "כותרת המזמור → נב, ב \"דּוֹאֵג הָאֲדֹמִי\"" },
    { book: "tehillim",         ch: 60, v: 1,  from: "e0516", to: { ...TO_EDOM, v: 2 }, why: "כותרת המזמור → ס, ב \"וַיַּךְ אֶת אֱדוֹם\"" },
    { book: "tehillim",         ch: 83, v: 15, from: "e0516", to: { ...TO_EDOM, v: 7 }, why: "פסוק בלי אדום → פג, ז \"אׇהֳלֵי אֱדוֹם\"" },
    { book: "tehillim",         ch: 108, v: 11, from: "e0516", to: TO_EDOM, why: "\"מִי נָחַנִי עַד אֱדוֹם\"" },
    { book: "divrei-hayamim-b", ch: 25, v: 15, from: "e0516", to: { ...TO_EDOM, w: null }, why: "אמציה ואלוהי שעיר (המילה \"לו\" שהייתה מעוגנת אינה במקומה)" },
];

export interface AnchorFixResult {
    /** מפת העוגנים אחרי התיקון (העותק המקורי לא משתנה) */
    map: LegacyAnchorMap;
    /** תיקונים שבוצעו, לפי סדר הטבלה */
    applied: AnchorFix[];
    /** תיקונים שלא נמצא להם עוגן מתאים – הנתונים באפליקציה השתנו */
    missing: AnchorFix[];
}

function cloneMap(map: LegacyAnchorMap): LegacyAnchorMap {
    const out: LegacyAnchorMap = {};
    for (const [book, chapters] of Object.entries(map)) {
        out[book] = {};
        for (const [ch, verses] of Object.entries(chapters)) {
            out[book][ch] = {};
            for (const [v, list] of Object.entries(verses)) out[book][ch][v] = list.map(a => ({ ...a }));
        }
    }
    return out;
}

/**
 * מחיל את טבלת התיקונים על מפת העוגנים. תיקון שלא נמצא לו עוגן תואם מדווח
 * ב-`missing` ולא מפיל את ההעברה – כך שאם `anchors.json` יתוקן בעתיד, הטבלה
 * פשוט תהפוך למיותרת.
 */
export function applyAnchorFixes(map: LegacyAnchorMap, fixes: readonly AnchorFix[] = ANCHOR_FIXES): AnchorFixResult {
    const out = cloneMap(map);
    const applied: AnchorFix[] = [];
    const missing: AnchorFix[] = [];

    for (const fix of fixes) {
        const list = out[fix.book]?.[String(fix.ch)]?.[String(fix.v)];
        const i = list?.findIndex(a => a.e === fix.from) ?? -1;
        if (!list || i < 0) {
            missing.push(fix);
            continue;
        }
        const [anchor] = list.splice(i, 1);
        if (list.length === 0) delete out[fix.book][String(fix.ch)][String(fix.v)];

        if (fix.to) {
            const entry = fix.to.entry ?? anchor.e;
            const ch = String(fix.to.ch ?? fix.ch);
            const v = String(fix.to.v ?? fix.v);
            const moved = { ...anchor, e: entry };
            if (fix.to.w === null) delete moved.w;
            else if (fix.to.w !== undefined) moved.w = fix.to.w;

            out[fix.book] ??= {};
            out[fix.book][ch] ??= {};
            const target = (out[fix.book][ch][v] ??= []);
            if (!target.some(a => a.e === entry)) target.push(moved);
        }
        applied.push(fix);
    }

    return { map: out, applied, missing };
}
