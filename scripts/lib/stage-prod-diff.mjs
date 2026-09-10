/**
 * הלוגיקה הטהורה של compare-stage-prod-items: מה נחשב הפרש "רעש" ומה התנגשות
 * אמיתית בין סטייג' לפרוד. מופרד מהסקריפט כדי שיהיה אפשר לבדוק אותו ביחידה —
 * סיווג שגוי כאן פירושו דוח שמטעה, וזה בדיוק מה שהסקריפט אמור למנוע.
 */

/**
 * שכפול מכוון של הרשימות ב-src/views/toc-translations/services/partEditService.ts
 * (NULLABLE_FILTER_FIELDS / BOOLEAN_ITEM_FIELDS / OPTIONAL_STRING_FIELDS) — זהו
 * קוד node עצמאי שלא יכול לייבא TS. אם הרשימות שם משתנות, לעדכן גם כאן.
 */
export const NULLABLE_FIELDS = new Set(["cohanim", "hazan", "minyan"]);
export const BOOLEAN_FIELDS = new Set([
    "fontTanach", "bold", "centerAlign", "lineLine", "red",
    "justifyBlock", "block", "noSpace", "firstInPage", "specialDate",
]);
export const OPTIONAL_STRING_FIELDS = new Set([
    "titleType", "title", "role", "reference", "specialSign",
]);

/** האם `value` הוא ערך ברירת המחדל של השדה — כלומר שקול להיעדרו */
export function isDefaultValue(field, value) {
    if (NULLABLE_FIELDS.has(field)) return value === null;
    if (BOOLEAN_FIELDS.has(field)) return value === false;
    if (OPTIONAL_STRING_FIELDS.has(field)) {
        return value === "" || (typeof value === "string" && value.trim() === "");
    }
    return false;
}

export function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((v, i) => deepEqual(v, b[i]));
    }
    if (a !== null && b !== null && typeof a === "object") {
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every((k) => deepEqual(a[k], b[k]));
    }
    return false;
}

/**
 * משווה שני מסמכים ומחזיר את השדות שנבדלים, כשכל הפרש מסומן כרעש
 * (ברירת מחדל בצד אחד מול היעדר בשני) או כהתנגשות אמיתית.
 * timestamp מוחרג — כל כתיבה מטביעה חותמת אחרת.
 */
export function diffDocs(stageData, prodData) {
    const fields = new Set([...Object.keys(stageData), ...Object.keys(prodData)]);
    fields.delete("timestamp");

    const diffs = [];
    for (const field of fields) {
        const inStage = field in stageData;
        const inProd = field in prodData;
        const sv = stageData[field];
        const pv = prodData[field];

        if (inStage && inProd) {
            if (!deepEqual(sv, pv)) {
                diffs.push({ field, stage: sv, prod: pv, noise: false });
            }
            continue;
        }
        // קיים בצד אחד בלבד: רעש רק אם הערך הוא ברירת מחדל
        const present = inStage ? sv : pv;
        diffs.push({
            field,
            stage: inStage ? sv : undefined,
            prod: inProd ? pv : undefined,
            noise: isDefaultValue(field, present),
        });
    }
    return diffs;
}

/**
 * מה הפרסום הבא יעשה למסמך, לפי אותו כלל שב-prodReconcileService.shouldCopyToProd:
 * סטייג' לא ישן יותר → נדרס; פרוד חדש יותר → הפרסום מדלג ומתריע.
 */
export function nextPublishOutcome(stageTimestamp, prodTimestamp) {
    return Number(stageTimestamp ?? 0) >= Number(prodTimestamp ?? 0)
        ? "סטייג' ידרוס את פרוד"
        : "הפרסום ידלג (פרוד חדש יותר)";
}
