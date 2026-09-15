import type { FirebaseApp } from "firebase/app";
import { initializeApp } from "firebase/app";

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined
};

let firebaseApp: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
    if (!firebaseApp) {
        firebaseApp = initializeApp(firebaseConfig);
    }
 
    return firebaseApp;
}

// ── Prod environment (dual-write feature) ────────────────────────────────────

const prodFirebaseConfig = {
    apiKey:            import.meta.env.VITE_PROD_FIREBASE_API_KEY as string,
    authDomain:        import.meta.env.VITE_PROD_FIREBASE_AUTH_DOMAIN as string,
    projectId:         import.meta.env.VITE_PROD_FIREBASE_PROJECT_ID as string,
    storageBucket:     import.meta.env.VITE_PROD_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_PROD_FIREBASE_MESSAGING_SENDER_ID as string,
    appId:             import.meta.env.VITE_PROD_FIREBASE_APP_ID as string,
};

/** Returns true when all required Prod Firebase env vars are present */
export function isProdConfigured(): boolean {
    return !!(import.meta.env.VITE_PROD_FIREBASE_PROJECT_ID as string | undefined)?.trim();
}

let prodApp: FirebaseApp | undefined;

/** Lazily initializes and returns the Prod Firebase app (named "prod") */
export function getProdFirebaseApp(): FirebaseApp {
    if (!prodApp) {
        prodApp = initializeApp(prodFirebaseConfig, "prod");
    }
    return prodApp;
}

// ── Tanakh LaMetayel (התנ"ך למטייל) – separate Firebase project ──────────────
//
// The Tanakh guide content lives in its own Firebase project (one project, no
// stage/prod split – drafts vs. published content is handled by the publish
// step, see docs/tanakh-lametayel.md). The CMS connects to it as a third
// named Firebase app, driven by the VITE_TLM_FIREBASE_* env vars.

const tanakhFirebaseConfig = {
    apiKey:            import.meta.env.VITE_TLM_FIREBASE_API_KEY as string,
    authDomain:        import.meta.env.VITE_TLM_FIREBASE_AUTH_DOMAIN as string,
    projectId:         import.meta.env.VITE_TLM_FIREBASE_PROJECT_ID as string,
    storageBucket:     import.meta.env.VITE_TLM_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_TLM_FIREBASE_MESSAGING_SENDER_ID as string,
    appId:             import.meta.env.VITE_TLM_FIREBASE_APP_ID as string,
};

/** The env vars the Tanakh connection needs; listed in the UI when missing. */
export const TANAKH_ENV_VARS = [
    "VITE_TLM_FIREBASE_API_KEY",
    "VITE_TLM_FIREBASE_AUTH_DOMAIN",
    "VITE_TLM_FIREBASE_PROJECT_ID",
    "VITE_TLM_FIREBASE_STORAGE_BUCKET",
    "VITE_TLM_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_TLM_FIREBASE_APP_ID",
] as const;

/** Names of the Tanakh env vars that are missing or empty. */
export function missingTanakhEnvVars(): string[] {
    const values: Record<(typeof TANAKH_ENV_VARS)[number], string | undefined> = {
        VITE_TLM_FIREBASE_API_KEY: tanakhFirebaseConfig.apiKey,
        VITE_TLM_FIREBASE_AUTH_DOMAIN: tanakhFirebaseConfig.authDomain,
        VITE_TLM_FIREBASE_PROJECT_ID: tanakhFirebaseConfig.projectId,
        VITE_TLM_FIREBASE_STORAGE_BUCKET: tanakhFirebaseConfig.storageBucket,
        VITE_TLM_FIREBASE_MESSAGING_SENDER_ID: tanakhFirebaseConfig.messagingSenderId,
        VITE_TLM_FIREBASE_APP_ID: tanakhFirebaseConfig.appId,
    };
    return TANAKH_ENV_VARS.filter(name => !values[name]?.trim());
}

/** Returns true when all Tanakh Firebase env vars are present */
export function isTanakhConfigured(): boolean {
    return missingTanakhEnvVars().length === 0;
}

/** Project id of the Tanakh project (for display) */
export function tanakhProjectId(): string {
    return tanakhFirebaseConfig.projectId ?? "";
}

/** Storage bucket of the Tanakh project (for display) */
export function tanakhStorageBucket(): string {
    return tanakhFirebaseConfig.storageBucket ?? "";
}

let tanakhApp: FirebaseApp | undefined;

/** Lazily initializes and returns the Tanakh Firebase app (named "tanakh") */
export function getTanakhFirebaseApp(): FirebaseApp {
    if (!tanakhApp) {
        tanakhApp = initializeApp(tanakhFirebaseConfig, "tanakh");
    }
    return tanakhApp;
}
