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
