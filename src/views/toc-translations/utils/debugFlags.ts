/**
 * דגלים לדיבוג – ברירת מחדל כבויה כדי לא להציף את הקונסולה ולא להאט עיבוד.
 *
 * itemId / מזהי פריט: VITE_DEBUG_CMS_ITEM_IDS=true ב־.env
 */

export function cmsDebugItemIdsEnabled(): boolean {
    try {
        if (typeof import.meta !== "undefined" && import.meta.env) {
            const v = (import.meta.env as Record<string, string | boolean | undefined>)
                .VITE_DEBUG_CMS_ITEM_IDS;
            if (v === true || String(v).toLowerCase() === "true") return true;
        }
    } catch {
        /* ignore */
    }
    return false;
}

/**
 * מפעיל את מסלול "חלון בסיס" לחישוב itemId.
 * ברירת מחדל: true. כדי לחזור מייד למסלול הישן – להגדיר false.
 */
export function cmsSimpleBaseIntervalEnabled(): boolean {
    try {
        if (typeof import.meta !== "undefined" && import.meta.env) {
            const v = (import.meta.env as Record<string, string | boolean | undefined>)
                .VITE_CMS_ITEM_ID_SIMPLE_BASE_INTERVAL;
            if (v == null || v === "") return true;
            const normalized = String(v).toLowerCase();
            if (normalized === "false" || normalized === "0" || normalized === "off")
                return false;
            return true;
        }
    } catch {
        /* ignore */
    }
    return true;
}
