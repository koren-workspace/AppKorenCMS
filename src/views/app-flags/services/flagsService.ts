/**
 * flagsService – קריאה וכתיבה של `app-config/flags` ב-Firestore, ושיקוף ל-Bagel.
 *
 *  - loadFlags(env):          המסמך; null אם עדיין לא נוצר בסביבה
 *  - saveFlags(env, flags):   כותב ל-Firestore (מקור האמת) ואז מבקש מהשרת
 *                             לשקף ל-Bagel. אם השיקוף נכשל, הכתיבה ל-Firestore
 *                             כבר בוצעה – הפונקציה זורקת שגיאה שאומרת בדיוק את
 *                             זה, כדי שהמסך יציג "נשמר, אבל Bagel לא עודכן".
 *
 * ה-CMS לא מחזיק טוקן Bagel; השיקוף עובר דרך /api/bagel/flags (Vercel
 * Function, או ה-middleware של Vite בפיתוח), באותה תבנית של update-time.
 */

import { getAuth } from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc, Timestamp, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { getProdCurrentUser, getProdFirestore } from "../../toc-translations/services/prodAuthService";
import type { AppFlags, FlagsEnv, MirrorResult } from "../types";

export const FLAGS_COLLECTION = "app-config";
export const FLAGS_DOC_ID = "flags";
const FLAGS_ENDPOINT = "/api/bagel/flags";

export function flagsDb(env: FlagsEnv): Firestore {
    return env === "prod" ? getProdFirestore() : getFirestore(getFirebaseApp());
}

function positiveInt(value: unknown): number | null {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export function coerceFlags(data: Record<string, unknown>): AppFlags {
    const versions =
        typeof data.minAppVersion === "object" && data.minAppVersion !== null
            ? (data.minAppVersion as Record<string, unknown>)
            : {};
    const clearTime = data.clearTime;
    return {
        clearTime: typeof clearTime === "number" && Number.isFinite(clearTime) && clearTime > 0 ? clearTime : null,
        freeEnhancements: data.freeEnhancements === true,
        minAppVersion: { android: positiveInt(versions.android), ios: positiveInt(versions.ios) },
    };
}

/** המסמך של הסביבה, או null אם עדיין לא נוצר (ראו tools/migrate-flags.mjs) */
export async function loadFlags(env: FlagsEnv): Promise<AppFlags | null> {
    const snapshot = await getDoc(doc(flagsDb(env), FLAGS_COLLECTION, FLAGS_DOC_ID));
    if (!snapshot.exists()) return null;
    return coerceFlags(snapshot.data() as Record<string, unknown>);
}

/** מה נכתב למסמך: השדות החסרים (null) לא נכתבים – האפליקציה קוראת חסר כ"אין" */
function toDocument(flags: AppFlags, editorEmail: string): Record<string, unknown> {
    const minAppVersion: Record<string, number> = {};
    if (flags.minAppVersion.android !== null) minAppVersion.android = flags.minAppVersion.android;
    if (flags.minAppVersion.ios !== null) minAppVersion.ios = flags.minAppVersion.ios;
    const out: Record<string, unknown> = {
        freeEnhancements: flags.freeEnhancements,
        minAppVersion,
        updatedAt: Timestamp.now(),
        updatedBy: editorEmail,
    };
    if (flags.clearTime !== null) out.clearTime = flags.clearTime;
    return out;
}

async function idTokenFor(env: FlagsEnv): Promise<string> {
    const user = env === "prod" ? getProdCurrentUser() : getAuth(getFirebaseApp()).currentUser;
    if (!user) {
        throw new Error(env === "prod" ? "יש להתחבר לפרוד לפני השמירה" : "יש להתחבר ל-CMS לפני השמירה");
    }
    return user.getIdToken();
}

export class MirrorError extends Error {
    results: MirrorResult;
    constructor(message: string, results: MirrorResult) {
        super(message);
        this.name = "MirrorError";
        this.results = results;
    }
}

/** שיקוף ל-Bagel דרך השרת. זורק MirrorError עם התוצאה לכל קולקציה. */
export async function mirrorFlagsToBagel(env: FlagsEnv, flags: AppFlags): Promise<MirrorResult> {
    const idToken = await idTokenFor(env);
    const response = await fetch(FLAGS_ENDPOINT, {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            env,
            clearTime: flags.clearTime,
            freeEnhancements: flags.freeEnhancements,
            minAppVersion: flags.minAppVersion,
        }),
    });
    let payload: { error?: string; results?: MirrorResult } = {};
    try {
        payload = (await response.json()) as typeof payload;
    } catch {
        // no body
    }
    if (!response.ok) {
        throw new MirrorError(payload.error ?? `Bagel mirror failed (${response.status})`, payload.results ?? {});
    }
    return payload.results ?? {};
}

/**
 * שמירה: קודם Firestore (מקור האמת לאפליקציה החדשה), ואז שיקוף ל-Bagel.
 * מחזירה את תוצאת השיקוף; זורקת MirrorError אם Firestore נשמר אבל Bagel לא.
 */
export async function saveFlags(env: FlagsEnv, flags: AppFlags, editorEmail: string): Promise<MirrorResult> {
    await setDoc(doc(flagsDb(env), FLAGS_COLLECTION, FLAGS_DOC_ID), toDocument(flags, editorEmail));
    return mirrorFlagsToBagel(env, flags);
}
