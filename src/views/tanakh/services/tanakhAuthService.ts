/**
 * tanakhAuthService – חיבור לפרויקט Firebase של התנ"ך למטייל
 *
 * התנ"ך למטייל יושב בפרויקט Firebase נפרד מהתפילה. בכניסה הראשונה למסך
 * המשתמש מזין את הסיסמה שלו בפרויקט הזה (אותו מייל כמו ב-CMS, סיסמה
 * נפרדת). Firebase Auth שומר את הכניסה עד לסגירת הטאב.
 *
 * אותו דפוס כמו prodAuthService, מול האפליקציה "tanakh".
 */

import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getTanakhFirebaseApp } from "../../../firebase_config";

function getTanakhAuth() {
    return getAuth(getTanakhFirebaseApp());
}

/** האם המשתמש מחובר כרגע לפרויקט התנ"ך */
export function isTanakhAuthenticated(): boolean {
    return getTanakhAuth().currentUser !== null;
}

/** המשתמש הנוכחי בפרויקט התנ"ך (null אם לא מחובר) */
export function getTanakhCurrentUser(): User | null {
    return getTanakhAuth().currentUser;
}

/** כניסה עם email + password לפרויקט התנ"ך. זורק שגיאה אם הפרטים לא נכונים. */
export async function signInToTanakh(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(getTanakhAuth(), email, password);
}

/** יציאה מפרויקט התנ"ך (לא נוגע בכניסה ל-CMS עצמו) */
export async function signOutOfTanakh(): Promise<void> {
    await signOut(getTanakhAuth());
}

/**
 * מאזין לשינויי כניסה/יציאה בפרויקט התנ"ך. מחזיר פונקציית ביטול.
 * Firebase קורא ל-callback פעם אחת גם בעליית הדף, אחרי שחזור הסשן.
 */
export function onTanakhAuthChanged(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(getTanakhAuth(), callback);
}

/** Firestore של פרויקט התנ"ך – לשימוש אחרי אימות */
export function getTanakhFirestore(): Firestore {
    return getFirestore(getTanakhFirebaseApp());
}

/** Storage של פרויקט התנ"ך (תמונות וקובצי התוכן המפורסמים) */
export function getTanakhStorage(): FirebaseStorage {
    return getStorage(getTanakhFirebaseApp());
}
