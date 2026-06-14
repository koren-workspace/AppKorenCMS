/**
 * bagelUpdateTimeService – עדכון זמני עדכון בקולקציית updateTime ב-BagelDB
 *
 * קריאות Bagel עוברות דרך /api/bagel/update-time (Vercel Function / Vite dev middleware)
 * כדי שלא ייחשפו טוקני Bagel בדפדפן.
 */

import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "../../../firebase_config";
import { getProdCurrentUser } from "./prodAuthService";

export type BagelUpdateTimeItem = {
    _id: string;
    timestamp: number;
    _lastUpdateDate?: string;
    _createdDate?: string;
};

export type BagelEnv = "stage" | "prod";

const UPDATE_TIME_ENDPOINT = "/api/bagel/update-time";

async function getFirebaseIdToken(env: BagelEnv): Promise<string> {
    const user =
        env === "prod"
            ? getProdCurrentUser()
            : getAuth(getFirebaseApp()).currentUser;

    if (!user) {
        throw new Error(
            env === "prod"
                ? "יש להתחבר לפרוד לפני פרסום ל-Bagel"
                : "יש להתחבר ל-CMS לפני פרסום ל-Bagel"
        );
    }

    return user.getIdToken();
}

async function callBagelUpdateTimeApi(
    id: string,
    timestamp: number,
    env: BagelEnv
): Promise<void> {
    const idToken = await getFirebaseIdToken(env);
    const response = await fetch(UPDATE_TIME_ENDPOINT, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, timestamp, env }),
    });

    if (!response.ok) {
        let message = `Bagel update failed (${response.status})`;
        try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) message = payload.error;
        } catch {
            // ignore JSON parse errors
        }
        throw new Error(message);
    }
}

/**
 * עדכון ה-timestamp של פריט ספציפי לזמן UNIX.
 * @param id – מזהה הפריט בקולקציה (למשל "sefard", "ashkenaz")
 * @param env – stage (ברירת מחדל) או prod
 */
export async function updateBagelTimestamp(
    id: string,
    timestamp: number,
    env: BagelEnv = "stage"
): Promise<void> {
    await callBagelUpdateTimeApi(id, timestamp, env);
}
