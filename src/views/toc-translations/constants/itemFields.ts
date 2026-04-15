/**
 * ערכי סוג פריט (type) וסוג כותרת (titleType) – תואמים ל־Android RemoteMapper.
 * משמשים ב־select בעריכת מאפייני פריט.
 */

/** הסבר לכל מאפיין – מוצג ב-tooltip (hover) ליד השם */
export const ITEM_FIELD_HELP: Record<string, string> = {
    type: "סוג הפריט: קובע איך הפריט מוצג באפליקציה (גוף תפילה, כותרת, הוראות, פירוש וכו').",
    titleType: "רמת הכותרת כשהסוג הוא כותרת: H1 הכי בולט, H4 הכי קטן.",
    title: "כותרת משנה – מוצג באפליקציה כשהסוג הוא כותרת.",
    /** רלוונטי רק לפריט בסיווג פירוש: הדיבור המתחיל שמוצג בהדגשה לפני הפירוש. */
    titleCommentary: "דיבור המתחיל של הפירוש (טייטל): מכיוון שהפירוש מופיע בתחתית המסך, לא תמיד ברור על איזו מילה או משפט הפירוש מתייחס. השדה הזה מוצג בהדגשה לפני הפירוש כדי לציין את המקום בתוכן.",
    fontTanach: "הצגת הפריט בגופן תנ\"ך באפליקציה (רלוונטי לגוף עברית בלבד).",
    bold: "הצגת הפריט בגופן מודגש (רלוונטי לגוף עברית בלבד).",
    centerAlign: "יישור תוכן לאמצע במקום לימין/שמאל (רלוונטי לגוף עברית בלבד).",
    lineLine: "תצוגת שורה-שורה (שורות לסירוגין לימין/שמאל) – תשתית לפיצ'ר עתידי (רלוונטי לגוף עברית בלבד).",
    red: "הצגת טקסט אדום להדגשת קטעים משתנים (רלוונטי לגוף עברית בלבד).",
    justifyBlock: "יישור בלוק מלא לשני הצדדים (רלוונטי לגוף עברית בלבד).",
    noSpace: "ללא רווח אחרי הפריט – הצגה צמודה לשורה הבאה.",
    block: "פיסקה: הפריט ממשיך ברצף עם הפריט הבא כחלק מפיסקה אחת (רלוונטי לגוף עברית בלבד).",
    firstInPage: "מסומן כראשון בעמוד – משמש לדפדוף ולשבירת עמודים.",
    specialDate: "הפריט קשור לתאריכים מיוחדים בלוח (למשל ימים מיוחדים).",
    cohanim: "כהנים: 'כן' = מוצג רק לכהן, 'לא' = מוצג רק ללא-כהן, 'לא מוגדר' = מוצג תמיד.",
    hazan: "חזן: 'כן' = מוצג רק לחזן, 'לא' = מוצג רק ללא-חזן, 'לא מוגדר' = מוצג תמיד.",
    minyan: "מניין: 'כן' = מוצג רק במניין, 'לא' = מוצג רק ביחיד, 'לא מוגדר' = מוצג תמיד.",
    role: "תפקיד הפריט (למשל ש\"ץ, שליח ציבור) – מוצג באפליקציה ליד התוכן.",
    reference: "מקורות (למשל מקור מהמקרא) – מוצג בהתאם להגדרות התצוגה.",
    specialSign: "סימן מיוחד להצגה ליד הפריט (למשל סימן מוזיקלי או הערה).",
    mit_id: "מזהה לוגי לקשרי פסקה ולקיבוץ בין פריטים. אינו קובע את סדר התצוגה ב-CMS.",
    dateSetId: "מזהה סט תאריכים: לאילו תאריכים בלוח הפריט רלוונטי (למשל ימים שאומרים את הפריט).",
};

export const ITEM_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "body", label: "גוף (body)" },
    { value: "title", label: "כותרת (title)" },
    { value: "instructions", label: "הוראות (instructions)" },
    { value: "smallInstructions", label: "הוראות קצרות (smallInstructions)" },
    { value: "identedBody", label: "גוף עם הזחה (identedBody)" },
    { value: "commentary", label: "פירוש (commentary)" },
    { value: "baruchSheamar", label: "ברוך שאמר (baruchSheamar)" },
    { value: "shiratHayam", label: "שירת הים (shiratHayam)" },
];

/** סוגי הוראות בלבד – בתרגום (לא בסיס) במאפיינים מותר לשנות סוג רק בין אלה */
export const INSTRUCTION_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "instructions", label: "הוראות (instructions)" },
    { value: "smallInstructions", label: "הוראות קצרות (smallInstructions)" },
];

export const TITLE_TYPE_OPTIONS: { value: string; label: string }[] = [
    { value: "", label: "—" },
    { value: "H1", label: "H1" },
    { value: "H2", label: "H2" },
    { value: "H3", label: "H3" },
    { value: "H4", label: "H4" },
];

/** תוויות עבריות לשדות – לתצוגה ביומן השינויים */
export const FIELD_LABELS: Record<string, string> = {
    content: "תוכן",
    type: "סוג",
    titleType: "סוג כותרת",
    title: "כותרת",
    fontTanach: 'גופן תנ"ך',
    bold: "גופן מודגש",
    centerAlign: "מיושר לאמצע",
    lineLine: "שורה שורה",
    red: "טקסט אדום",
    justifyBlock: "יישור בלוק",
    noSpace: "ללא רווח",
    block: "פיסקה",
    firstInPage: "ראשון בעמוד",
    specialDate: "תאריך מיוחד",
    cohanim: "כהנים",
    hazan: "חזן",
    minyan: "מניין",
    role: "תפקיד",
    reference: "מקורות",
    specialSign: "סימן מיוחד",
    dateSetId: "dateSetId",
    mit_id: "MIT ID",
};

/** שדות שמועמדים לתיעוד ביומן (לא כוללים שדות מבניים כמו timestamp, itemId, partId) */
export const LOGGED_FIELDS = new Set([
    "content", "type", "titleType", "title",
    "fontTanach", "bold", "centerAlign", "lineLine", "red", "justifyBlock",
    "noSpace", "block", "firstInPage", "specialDate",
    "cohanim", "hazan", "minyan", "role", "reference", "specialSign",
    "dateSetId", "mit_id",
]);

/** סוגי תוכן שנחשבים "גוף תפילה" לצורך כללי רלוונטיות של מאפייני עיצוב. */
const BODY_LIKE_TYPES = new Set([
    "body",
    "identedBody",
    "baruchSheamar",
    "shiratHayam",
]);

/** האם הסוג הוא גוף תפילה (ולא כותרת/הוראות/פירוש). */
export function isBodyLikeType(type: string | null | undefined): boolean {
    return BODY_LIKE_TYPES.has(type ?? "body");
}

/** מאפיינים שרלוונטיים רק ל"תוכן" בעברית (גוף בבסיס). */
export function supportsHebrewBodyOnlyFields(
    type: string | null | undefined,
    isBaseTranslation: boolean
): boolean {
    return isBaseTranslation && isBodyLikeType(type);
}

/** ללא רווח זמין לכל סוג מלבד פירוש. */
export function supportsNoSpace(type: string | null | undefined): boolean {
    return (type ?? "body") !== "commentary";
}

/** ראשון בעמוד זמין לכל סוג מלבד פירוש. */
export function supportsFirstInPage(type: string | null | undefined): boolean {
    return (type ?? "body") !== "commentary";
}

/** תפקיד/מקורות/סימן מיוחד רלוונטיים רק לתוכן/תרגום (גוף). */
export function supportsAttachedMeta(type: string | null | undefined): boolean {
    return isBodyLikeType(type);
}

/** תרגום פירוש = מזהה שמתחיל בשתי ספרות (למשל 10-ashkenaz, 11-...). */
export function isCommentaryTranslation(translationId: string | null | undefined): boolean {
    if (!translationId || typeof translationId !== "string") return false;
    return /^\d{2}-/.test(translationId);
}

/** האם להציג את שדה דיבור המתחיל: רק בפריט מסוג פירוש ורק בתרגום פירוש (2 ספרות). */
export function showDiburHamatkhilField(
    type: string | null | undefined,
    translationId: string | null | undefined
): boolean {
    return (type ?? "body") === "commentary" && isCommentaryTranslation(translationId);
}
