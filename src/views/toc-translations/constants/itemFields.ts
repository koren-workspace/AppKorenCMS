/**
 * ערכי סוג פריט (type) וסוג כותרת (titleType) – תואמים ל־Android RemoteMapper.
 * משמשים ב־select בעריכת מאפייני מקטע.
 */

/** הסבר לכל מאפיין – מוצג ב-tooltip (hover) ליד השם */
export const ITEM_FIELD_HELP: Record<string, string> = {
    type: "סוג הפריט: קובע איך המקטע מוצג באפליקציה (גוף תפילה, כותרת, הוראות, פירוש וכו').",
    titleType: "רמת הכותרת כשהסוג הוא כותרת: H1 הכי בולט, H4 הכי קטן.",
    title: "כותרת משנה (סוג כותרת) או כותרת פירוש (סוג פירוש) – מוצג באפליקציה בהתאם.",
    fontTanach: "הצגת המקטע בגופן תנ\"ך באפליקציה.",
    noSpace: "ללא רווח אחרי המקטע – הצגה צמודה לשורה הבאה.",
    block: "המקטע מוצג כבלוק (פסקה) עם מרווחים מתאימים.",
    firstInPage: "מסומן כראשון בעמוד – משמש לדפדוף ולשבירת עמודים.",
    specialDate: "המקטע קשור לתאריכים מיוחדים בלוח (למשל ימים מיוחדים).",
    cohanim: "המקטע קשור לברכת כהנים – יכול להיות מוצג/מוסתר בהתאם להגדרות.",
    hazan: "המקטע מופיע לחזן.",
    minyan: "המקטע מופיע כשמתפללים במניין.",
    role: "תפקיד המקטע (למשל ש\"ץ, שליח ציבור) – מוצג באפליקציה ליד התוכן.",
    reference: "הפניה או מקור (למשל מקור מהמקרא) – מוצג בהתאם להגדרות התצוגה.",
    specialSign: "סימן מיוחד להצגה ליד המקטע (למשל סימן מוזיקלי או הערה).",
    mit_id: "מזהה מיון: קובע את סדר המקטעים ברשימה (מיון מספרי). שינוי משפיע על המיקום.",
    dateSetId: "מזהה סט תאריכים: לאילו תאריכים בלוח המקטע רלוונטי (למשל ימים שאומרים את המקטע).",
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
