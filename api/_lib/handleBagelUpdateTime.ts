import { updateBagelTimestampOnServer, type BagelEnv } from "./bagelProxy.js";
import { isEmailAllowed, verifyFirebaseToken } from "./verifyFirebaseToken.js";

export type BagelUpdateTimeBody = {
    id?: string;
    timestamp?: number;
    env?: BagelEnv;
};

export type BagelServerConfig = {
    firebaseProjectId: string;
    prodFirebaseProjectId?: string;
    bagelToken?: string;
    prodBagelToken?: string;
    allowedEmails?: string;
};

export async function handleBagelUpdateTimeRequest(
    method: string,
    authHeader: string | undefined,
    body: BagelUpdateTimeBody,
    config: BagelServerConfig
): Promise<{ status: number; body?: { error: string } }> {
    if (method !== "PUT") {
        return { status: 405, body: { error: "Method not allowed" } };
    }

    const env: BagelEnv = body.env === "prod" ? "prod" : "stage";
    const id = body.id?.trim();
    const timestamp = body.timestamp;

    if (!id || typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
        return { status: 400, body: { error: "Missing id or timestamp" } };
    }

    if (env === "prod" && !config.prodFirebaseProjectId?.trim()) {
        return { status: 400, body: { error: "Prod Firebase is not configured" } };
    }

    const firebaseProjectId = config.firebaseProjectId.trim();
    if (!firebaseProjectId) {
        return { status: 500, body: { error: "Missing FIREBASE_PROJECT_ID on server" } };
    }

    const bearerPrefix = "Bearer ";
    if (!authHeader?.startsWith(bearerPrefix)) {
        return { status: 401, body: { error: "Missing authorization" } };
    }

    const idToken = authHeader.slice(bearerPrefix.length).trim();
    if (!idToken) {
        return { status: 401, body: { error: "Missing authorization" } };
    }

    const projectId =
        env === "prod" ? config.prodFirebaseProjectId!.trim() : firebaseProjectId;

    try {
        const user = await verifyFirebaseToken(idToken, projectId);
        if (!isEmailAllowed(user.email, config.allowedEmails)) {
            return { status: 403, body: { error: "Forbidden" } };
        }
    } catch {
        return { status: 401, body: { error: "Invalid token" } };
    }

    try {
        const result = await updateBagelTimestampOnServer(id, timestamp, env, {
            stage: config.bagelToken,
            prod: config.prodBagelToken,
        });

        if (!result.ok) {
            if (result.status === 500) {
                return { status: 500, body: { error: "Missing Bagel token on server" } };
            }
            return { status: result.status, body: { error: `Bagel API error (${result.status})` } };
        }
    } catch {
        return { status: 502, body: { error: "Bagel API unreachable" } };
    }

    return { status: 200 };
}
