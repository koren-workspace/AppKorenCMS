import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS = createRemoteJWKSet(
    new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export type VerifiedFirebaseUser = {
    uid: string;
    email?: string;
};

export async function verifyFirebaseToken(
    idToken: string,
    projectId: string
): Promise<VerifiedFirebaseUser> {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
    });

    return {
        uid: payload.sub as string,
        email: typeof payload.email === "string" ? payload.email : undefined,
    };
}

export function isEmailAllowed(email: string | undefined, allowedEmailsRaw: string | undefined): boolean {
    const allowed = (allowedEmailsRaw ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

    if (allowed.length === 0) return true;
    return allowed.includes((email ?? "").toLowerCase());
}
