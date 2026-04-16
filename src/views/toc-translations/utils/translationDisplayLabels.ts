/**
 * תוויות תצוגה לפי קידומת מזהה תרגום (החלק לפני המקף הראשון ב־translationId).
 * דוגמה: `0-ashkenaz` → קידומת `0`, `10-sefard` → קידומת `10`.
 *
 * להרחבה: הוסיפו רשומה ל־TRANSLATION_PREFIX_LABELS. אם אין התאמה — משתמשים ב־label
 * מהמסמך (אם קיים) או במזהה המלא.
 */

/** קידומת מספרית (מחרוזת) → שם תצוגה בעברית */
export const TRANSLATION_PREFIX_LABELS: Readonly<Record<string, string>> = {
    "0": "עברית (בסיס)",
    "1": "אנגלית",
    "10": "הרב זקס עברית",
    "11": "הרב זקס אנגלית",
};

/**
 * מחלץ את קידומת המספר ממזהה תרגום (עד המקף הראשון).
 * לדוגמה: `10-nusach` → `10`, `0-x` → `0`.
 */
export function getTranslationIdPrefix(translationId: string | undefined | null): string | undefined {
    const id = (translationId ?? "").trim();
    if (!id) return undefined;
    const dash = id.indexOf("-");
    if (dash <= 0) return undefined;
    return id.slice(0, dash);
}

/**
 * תווית קצרת לכפתורי תרגום / רשימות — לפי המילון, או label שמור, או המזהה המלא.
 */
export function getTranslationDisplayLabel(
    translationId: string | undefined | null,
    options?: { storedLabel?: string | null }
): string {
    const id = (translationId ?? "").trim();
    if (!id) return "";

    const prefix = getTranslationIdPrefix(id);
    if (prefix != null) {
        const fromMap = TRANSLATION_PREFIX_LABELS[prefix];
        if (fromMap) return fromMap;
    }

    const stored = options?.storedLabel?.trim();
    if (stored) return stored;

    return id;
}
