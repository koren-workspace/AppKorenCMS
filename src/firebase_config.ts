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