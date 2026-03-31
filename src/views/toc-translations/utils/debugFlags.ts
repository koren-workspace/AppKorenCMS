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
