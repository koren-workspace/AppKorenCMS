/**
 * =============================================================================
 * מודל הנתונים של התנ"ך למטייל (שלב 2)
 * =============================================================================
 *
 * כל מה שיושב בפרויקט Firebase `koren-tanakh-lametayel`. ראו
 * docs/tanakh-lametayel.md, פרק "מודל הנתונים", להסבר מלא ולהחלטות.
 *
 * קולקציות:
 *   entries/{entryId}     ערך במדריך (Entry)
 *   categories/{key}      קטגוריה (Category)
 *   glossary/{termId}     מונח במילון התעתיק (GlossaryTerm)
 *   meta/publish          מצב הפרסום האחרון (PublishMeta)
 *
 * עקרונות:
 *   - עברית היא המקור. כל שדה טקסט דו-לשוני הוא מפה של שפות (Localized)
 *     שבה `he` חובה ושאר השפות אופציונליות. שפה חסרה = האפליקציה מציגה עברית.
 *   - גוף הערך נשמר כטקסט עם סימונים (ראו body.ts), לא כבלוקים. ההמרה
 *     לבלוקים של האפליקציה נעשית בזמן הפרסום.
 *   - פסוקים נשמרים כהפניה בלבד (VerseRef). הטקסט נשלף בזמן הפרסום.
 *   - הקישורים מהפסוקים לערך (anchors) יושבים בתוך הערך, לא בקובץ נפרד.
 */

/** השפות הנתמכות. הוספת שפה = הוספת מפתח כאן ובכל Localized. */
export type Lang = "he" | "en";
export const LANGS: readonly Lang[] = ["he", "en"] as const;
export const SOURCE_LANG: Lang = "he";
/** שפות היעד לתרגום (כל השפות חוץ מהמקור) */
export type TargetLang = Exclude<Lang, "he">;
export const TARGET_LANGS: readonly TargetLang[] = LANGS.filter((l): l is TargetLang => l !== SOURCE_LANG);

/** טקסט דו-לשוני: עברית חובה, שאר השפות אופציונליות */
export type Localized = { he: string } & Partial<Record<TargetLang, string>>;
/** רשימת טקסטים דו-לשונית (למשל שמות נוספים) */
export type LocalizedList = { he: string[] } & Partial<Record<TargetLang, string[]>>;

/**
 * מצב התרגום של שפת יעד אחת בערך:
 *   machine   תורגם במכונה, טרם נבדק
 *   reviewed  נבדק על ידי אדם
 *   approved  מאושר לפרסום
 *   stale     העברית השתנתה אחרי התרגום – דורש רענון
 */
export type TranslationStatus = "machine" | "reviewed" | "approved" | "stale";

export interface TranslationState {
    status: TranslationStatus;
    /** ms */
    updatedAt: number;
    updatedBy?: string;
    /** hash של שדות המקור (עברית) בזמן התרגום – לזיהוי stale (ראו hash.ts) */
    sourceHash?: string;
}

/**
 * הפניה לפסוק/פסוקים בתנ"ך. `book` הוא מזהה ספר (slug) מתוך tanakhIndex.json,
 * למשל "yehoshua". פרק ופסוק 1-based. `v2` = סוף טווח (כולל).
 */
export interface VerseRef {
    book: string;
    ch: number;
    v: number;
    v2?: number;
}

/**
 * מראה מקום כפי שנדפס ("יהושע יח, א"). `raw` תמיד קיים; שאר השדות מולאו
 * אם ההפניה זוהתה. מראה מקום שלא זוהה נשאר טקסט ומסומן לבדיקה.
 */
export interface RefItem extends Partial<VerseRef> {
    raw: string;
    /** מספר הערת שוליים במדריך המודפס, אם יש */
    n?: number;
}

/** מיקום גיאוגרפי. conf: 1 = מאומת, 2 = גבוה, 3 = בינוני */
export interface EntryLocation {
    lat: number;
    lng: number;
    conf: 1 | 2 | 3;
}

/**
 * תמונה של ערך.
 *   kind "baked"    תמונה אפויה באפליקציה; `src` = מזהה כמו "e0002_7_98"
 *   kind "storage"  תמונה ב-Firebase Storage; `src` = נתיב כמו "media/e0002/abc.webp"
 */
export interface EntryImage {
    kind: "baked" | "storage";
    src: string;
    caption?: Localized;
}

/** מילה/פסוק בתנ"ך שלחיצה עליהם מובילה לערך. `w` = המילה המודגשת (ללא ניקוד) */
export interface Anchor extends VerseRef {
    w?: string;
}

/** ערך במדריך – מסמך entries/{id} */
export interface Entry {
    /** מזהה יציב, למשל "e0203". לא משתנה אחרי יצירה. */
    id: string;
    /** מפתח הקטגוריה (categories/{key}), למשל "places" */
    cat: string;
    /** כותרת כפי שנדפסה (בעברית מנוקדת) */
    title: Localized;
    /** שמות נוספים לחיפוש ולקישור */
    altTitles: LocalizedList;
    /** גוף הערך – טקסט עם סימונים (ראו body.ts). ריק בערכי הפניה. */
    body: Localized;
    /** פסוקי הפתיחה – הפניות בלבד; הטקסט נשלף בפרסום */
    quotes: VerseRef[];
    /** מראי מקום */
    refs: RefItem[];
    /** ערכים קשורים – מזהי ערכים */
    xrefs: string[];
    /** "ראה ערך אחר" – מזהה ערך. ערך עם `see` הוא הפניה בלבד. */
    see?: string;
    /** אזור/קיבוץ (למשל אזורי מסלולי הטיול) */
    region?: Localized;
    /** עמוד במדריך המודפס */
    page?: number;
    location?: EntryLocation;
    images: EntryImage[];
    anchors: Anchor[];
    /** false = מוסתר באפליקציה (טיוטה) */
    visible: boolean;
    /** הערות פנימיות לעורכים (עמודת "הערות" בגיליון). לא מתפרסם. */
    notes?: string;
    /** מצב תרגום לכל שפת יעד */
    i18n: Partial<Record<TargetLang, TranslationState>>;
    /**
     * הערות לבדיקה אנושית (למשל מההעברה: ציטוט שלא זוהה כפסוק, ערך קשור
     * שלא נמצא). ריק = אין מה לבדוק.
     */
    review: string[];
    /** ms */
    createdAt: number;
    /** ms */
    updatedAt: number;
    updatedBy?: string;
}

/** קטגוריה – מסמך categories/{key} */
export interface Category {
    /** מפתח יציב באנגלית, למשל "places" */
    key: string;
    /** המזהה המספרי באפליקציה (1..8). נשמר לתאימות בפרסום. */
    legacyId: number;
    name: Localized;
    /** שם אייקון Ionicons (למשל "location") */
    icon: string;
    iconOutline: string;
    /** סדר תצוגה (0 ראשון) */
    order: number;
    /** טווח עמודים במדריך המודפס */
    pages?: [number, number];
}

/** מונח במילון התעתיק – מסמך glossary/{id} */
export interface GlossaryTerm {
    id: string;
    /** המונח בעברית (ללא ניקוד) */
    he: string;
    /** התרגום/תעתיק הקבוע לכל שפת יעד */
    translations: Partial<Record<TargetLang, string>>;
    notes?: string;
    updatedAt: number;
    updatedBy?: string;
}

/** מצב הפרסום – מסמך meta/publish */
export interface PublishMeta {
    /** מספר גרסה עולה; נכנס לקובץ התוכן */
    version: number;
    /** ms */
    publishedAt: number;
    publishedBy?: string;
    /** כמה ערכים גלויים נכנסו לקובץ */
    entryCount: number;
    /** ms של יצירת קובץ התצוגה המקדימה האחרון */
    previewAt?: number;
}

export const ENTRIES_COLLECTION = "entries";
export const CATEGORIES_COLLECTION = "categories";
export const GLOSSARY_COLLECTION = "glossary";
export const META_COLLECTION = "meta";
export const PUBLISH_DOC_ID = "publish";

/** ערך ריק תקין, לטופס "ערך חדש" */
export function emptyEntry(id: string, cat: string, now: number = Date.now()): Entry {
    return {
        id,
        cat,
        title: { he: "" },
        altTitles: { he: [] },
        body: { he: "" },
        quotes: [],
        refs: [],
        xrefs: [],
        images: [],
        anchors: [],
        visible: false,
        i18n: {},
        review: [],
        createdAt: now,
        updatedAt: now,
    };
}
