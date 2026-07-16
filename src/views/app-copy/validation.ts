/**
 * validation – בדיקת placeholders לפני שמירת טקסטים של האפליקציה.
 *
 * חלק מהטקסטים מכילים placeholders בסגנון אנדרואיד שהאפליקציה ממלאת בזמן
 * ריצה: `%s` (רציף) ו-`%1$s`/`%2$s` (מיקומי) – ראו i18n של האפליקציה
 * (koren-tefilla/src/i18n/index.ts, הפונקציה format).
 *
 * הקוד של האפליקציה קובע אילו ארגומנטים מועברים לכל מפתח, ולכן סט
 * ה-placeholders הוא חוזה שאסור לעורך לשבור:
 *  - placeholder שנמחק → הארגומנט פשוט לא יוצג (טקסט חסר מידע);
 *  - placeholder שנוסף → יוצג באפליקציה כטקסט גולמי ("%s").
 *
 * לכן שמירה נחסמת אם סט ה-placeholders בטקסט החדש שונה מהסט של הטקסט
 * המקורי באותה שפה.
 */

/**
 * מחלץ את רשימת ה-placeholders מטקסט, כרשימה ממוינת וניתנת להשוואה.
 * `%s` רציפים נספרים ("%s","%s"), מיקומיים מנורמלים ("%1$s","%2$s").
 */
export function extractPlaceholders(text: string): string[] {
    const tokens: string[] = [];
    // מיקומיים: %1$s, %2$s ...
    for (const match of text.matchAll(/%(\d+)\$s/g)) {
        tokens.push(`%${match[1]}$s`);
    }
    // רציפים: %s שאינו חלק ממיקומי (המיקומיים כבר נתפסו לעיל)
    const withoutPositional = text.replace(/%\d+\$s/g, "");
    for (const _match of withoutPositional.matchAll(/%s/g)) {
        tokens.push("%s");
    }
    return tokens.sort();
}

/** true אם לשני הטקסטים אותו סט placeholders (כולל כפילויות) */
export function placeholdersMatch(a: string, b: string): boolean {
    const ta = extractPlaceholders(a);
    const tb = extractPlaceholders(b);
    if (ta.length !== tb.length) return false;
    return ta.every((token, i) => token === tb[i]);
}

export type CopyValidationError = {
    /** 'he' | 'en' – השדה הבעייתי */
    field: "he" | "en";
    /** הודעה בעברית לתצוגה בממשק */
    message: string;
};

/**
 * בודק עריכה של מפתח בודד מול הערכים המקוריים (כפי שנטענו מה-DB).
 * מחזיר רשימת שגיאות ריקה כשהעריכה תקינה.
 *
 * כללים:
 *  1. אסור לרוקן שדה שהיה מלא (ריקון = ביטול הדריסה, מה שיחזיר את
 *     המשתמשים לטקסט הישן שמקומפל באפליקציה – כמעט תמיד טעות עורך).
 *  2. סט ה-placeholders של הטקסט החדש חייב להיות זהה לזה של הטקסט
 *     המקורי באותה שפה (וכשאין מקור באותה שפה – לזה של השפה השנייה).
 */
export function validateCopyEdit(
    original: { he: string; en: string },
    edited: { he: string; en: string }
): CopyValidationError[] {
    const errors: CopyValidationError[] = [];

    for (const field of ["he", "en"] as const) {
        const before = original[field];
        const after = edited[field];

        if (before.trim() !== "" && after.trim() === "") {
            errors.push({
                field,
                message:
                    field === "he"
                        ? "אסור לרוקן את הטקסט בעברית – יש להזין טקסט חלופי"
                        : "אסור לרוקן את הטקסט באנגלית – יש להזין טקסט חלופי",
            });
            continue;
        }

        if (after.trim() === "") continue; // היה ריק ונשאר ריק – תקין

        // החוזה: ה-placeholders של המקור באותה שפה, ואם אין – של השפה השנייה
        const contractSource = before.trim() !== "" ? before : original[field === "he" ? "en" : "he"];
        if (!placeholdersMatch(contractSource, after)) {
            const expected = extractPlaceholders(contractSource);
            errors.push({
                field,
                message:
                    expected.length === 0
                        ? "אסור להוסיף placeholders (%s) – הטקסט המקורי לא מכיל כאלה"
                        : `ה-placeholders חייבים להישאר בדיוק: ${expected.join(" , ")}`,
            });
        }
    }

    return errors;
}
