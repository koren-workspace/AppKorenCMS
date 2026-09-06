/**
 * handleBagelFlags – mirror the app flags from the CMS to BagelDB.
 *
 * The flags live in Firestore `app-config/flags` (the new app reads them
 * there). The legacy apps still read three Bagel collections, so every save
 * in the CMS "הגדרות אפליקציה" screen calls PUT /api/bagel/flags, and this
 * handler writes the same values to Bagel:
 *
 *   clearTime         → collection `clearTime`,      field `timestamp`
 *   freeEnhancements  → collection `appPreferences`, field `freeEnhancements`
 *   minAppVersion     → collection `minAppVersion`,  fields `android`, `ios`
 *
 * Each collection holds ONE item (the legacy apps take the first). The
 * handler finds it by listing, then does a whole-item PUT with a partial
 * body; an empty collection gets a POST. Only the flags present in the
 * request are written, so the screen can mirror a single field.
 *
 * "Absent" values: the app treats a missing clearTime as "no switch" and a
 * missing / non-positive minAppVersion as "no floor", and so does the legacy
 * code — so null is written as 0, which every reader ignores.
 *
 * Auth is the same as update-time: a Firebase idToken of the environment's
 * project, optionally restricted to ALLOWED_EMAILS.
 */

import {
    listBagelItems,
    postBagelItem,
    putBagelItem,
    type BagelEnv,
    type BagelTokens,
    type FetchLike,
} from "./bagelProxy.js";
import { isEmailAllowed, verifyFirebaseToken } from "./verifyFirebaseToken.js";

export type FlagsBody = {
    env?: BagelEnv;
    clearTime?: number | null;
    freeEnhancements?: boolean;
    minAppVersion?: { android?: number | null; ios?: number | null };
};

export type FlagsServerConfig = {
    firebaseProjectId: string;
    prodFirebaseProjectId?: string;
    bagelToken?: string;
    prodBagelToken?: string;
    allowedEmails?: string;
};

export type MirrorResult = Record<string, "ok" | "error">;

type Plan = Array<{ collection: string; body: Record<string, unknown> }>;

function isInt(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

/** Validate the body and turn it into the Bagel writes to make. Pure. */
export function planFlagWrites(body: FlagsBody): { plan: Plan } | { error: string } {
    const plan: Plan = [];
    if (body.clearTime !== undefined) {
        if (body.clearTime !== null && (!isInt(body.clearTime) || body.clearTime < 0)) {
            return { error: "clearTime must be a non-negative integer (ms) or null" };
        }
        plan.push({ collection: "clearTime", body: { timestamp: body.clearTime ?? 0 } });
    }
    if (body.freeEnhancements !== undefined) {
        if (typeof body.freeEnhancements !== "boolean") {
            return { error: "freeEnhancements must be a boolean" };
        }
        plan.push({ collection: "appPreferences", body: { freeEnhancements: body.freeEnhancements } });
    }
    if (body.minAppVersion !== undefined) {
        const v = body.minAppVersion;
        if (typeof v !== "object" || v === null) {
            return { error: "minAppVersion must be an object" };
        }
        const out: Record<string, unknown> = {};
        for (const platform of ["android", "ios"] as const) {
            const value = v[platform];
            if (value === undefined) continue;
            if (value !== null && (!isInt(value) || value < 0)) {
                return { error: `minAppVersion.${platform} must be a non-negative integer or null` };
            }
            out[platform] = value ?? 0;
        }
        if (Object.keys(out).length > 0) {
            plan.push({ collection: "minAppVersion", body: out });
        }
    }
    if (plan.length === 0) {
        return { error: "No flags in request" };
    }
    return { plan };
}

/** Write one collection: PUT the first item, or POST when there is none. */
async function mirrorOne(
    collection: string,
    body: Record<string, unknown>,
    env: BagelEnv,
    tokens: BagelTokens,
    fetchImpl: FetchLike
): Promise<boolean> {
    const listed = await listBagelItems(collection, env, tokens, fetchImpl);
    if (!listed.ok) return false;
    const first = listed.items[0];
    const id = typeof first?._id === "string" ? first._id : undefined;
    const result = id
        ? await putBagelItem(collection, id, body, env, tokens, fetchImpl)
        : await postBagelItem(collection, body, env, tokens, fetchImpl);
    return result.ok;
}

export async function handleBagelFlagsRequest(
    method: string,
    authHeader: string | undefined,
    body: FlagsBody,
    config: FlagsServerConfig,
    fetchImpl: FetchLike = fetch
): Promise<{ status: number; body?: { error?: string; results?: MirrorResult } }> {
    if (method !== "PUT") {
        return { status: 405, body: { error: "Method not allowed" } };
    }

    const env: BagelEnv = body.env === "prod" ? "prod" : "stage";
    const planned = planFlagWrites(body);
    if ("error" in planned) {
        return { status: 400, body: { error: planned.error } };
    }

    if (env === "prod" && !config.prodFirebaseProjectId?.trim()) {
        return { status: 400, body: { error: "Prod Firebase is not configured" } };
    }
    const firebaseProjectId = config.firebaseProjectId.trim();
    if (!firebaseProjectId) {
        return { status: 500, body: { error: "Missing FIREBASE_PROJECT_ID on server" } };
    }

    const bearerPrefix = "Bearer ";
    const idToken = authHeader?.startsWith(bearerPrefix) ? authHeader.slice(bearerPrefix.length).trim() : "";
    if (!idToken) {
        return { status: 401, body: { error: "Missing authorization" } };
    }
    const projectId = env === "prod" ? config.prodFirebaseProjectId!.trim() : firebaseProjectId;
    try {
        const user = await verifyFirebaseToken(idToken, projectId);
        if (!isEmailAllowed(user.email, config.allowedEmails)) {
            return { status: 403, body: { error: "Forbidden" } };
        }
    } catch {
        return { status: 401, body: { error: "Invalid token" } };
    }

    const tokens: BagelTokens = { stage: config.bagelToken, prod: config.prodBagelToken };
    if (!(env === "prod" ? tokens.prod?.trim() : tokens.stage?.trim())) {
        return { status: 500, body: { error: "Missing Bagel token on server" } };
    }

    const results: MirrorResult = {};
    let failed = false;
    for (const write of planned.plan) {
        let ok = false;
        try {
            ok = await mirrorOne(write.collection, write.body, env, tokens, fetchImpl);
        } catch {
            ok = false;
        }
        results[write.collection] = ok ? "ok" : "error";
        if (!ok) failed = true;
    }

    return failed
        ? { status: 502, body: { error: "Bagel mirror failed for some flags", results } }
        : { status: 200, body: { results } };
}
