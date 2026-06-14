/**
 * prodAuthService – ניהול חיבור ל-Firebase Auth של סביבת Prod
 *
 * הפעם הראשונה שמשתמש לוחץ "שמור לפרוד" הוא מתבקש להזין סיסמה.
 * לאחר כניסה מוצלחת, ה-session שמור עד לסגירת הטאב (Firebase Auth persistence).
 *
 * פונקציות:
 *   - isProdAuthenticated: האם המשתמש מחובר כרגע לפרויקט פרוד
 *   - signInToProd:        כניסה עם email + password לפרויקט פרוד
 *   - getProdCurrentUser:  המשתמש הנוכחי בפרויקט פרוד (לשם תצוגה)
 *   - getProdFirestore:    Firestore instance של פרוד (לכתיבה)
 */

import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getProdFirebaseApp } from "../../../firebase_config";

function getProdAuth() {
    return getAuth(getProdFirebaseApp());
}

/** האם המשתמש מחובר כרגע לפרויקט פרוד */
export function isProdAuthenticated(): boolean {
    return getProdAuth().currentUser !== null;
}

/** המשתמש הנוכחי בפרויקט פרוד (null אם לא מחובר) */
export function getProdCurrentUser() {
    return getProdAuth().currentUser;
}

/**
 * כניסה עם email + password לפרויקט פרוד.
 * זורק שגיאה אם הפרטים לא נכונים.
 */
export async function signInToProd(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(getProdAuth(), email, password);
}

/** Firestore instance של פרוד — לשימוש לאחר אימות */
export function getProdFirestore(): Firestore {
    return getFirestore(getProdFirebaseApp());
}
