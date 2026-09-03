/**
 * couponService – קריאה וכתיבה של קולקציית `coupons` ב-Firestore, לפי סביבה.
 *
 * פונקציות "טהורות" ללא state/UI (בתבנית appCopyService):
 *  - loadCoupons:       כל הקופונים בסביבה, חדשים ראשונים
 *  - createCoupon:      יצירת מסמך חדש (נכשל אם ה-hash כבר קיים)
 *  - setCouponActive:   הדלקה/כיבוי
 *  - resetCouponUsed:   מחיקת `usedAt` – מחזיר קופון לשימוש (בדיקות בעיקר)
 *  - deleteCoupon:      מחיקה
 *
 * בניגוד ל-app-copy, אין כאן "שמירה ל-Stage ואז פרסום לפרוד": קופון הוא
 * רשומה של סביבה אחת. קופון אמיתי נוצר ישירות בפרוד (אחרי אימות פרוד);
 * Stage משמש לבדיקות עם build של סטייג'.
 */

import {
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    setDoc,
    Timestamp,
    updateDoc,
    type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { getProdFirestore } from "../../toc-translations/services/prodAuthService";
import type { CouponDoc, CouponEnv, NewCoupon } from "../types";

export const COUPONS_COLLECTION = "coupons";

/** ה-Firestore של הסביבה המבוקשת (פרוד מחייב אימות פרוד לפני כן) */
export function couponsDb(env: CouponEnv): Firestore {
    return env === "prod" ? getProdFirestore() : getFirestore(getFirebaseApp());
}

function asDate(value: unknown): Date | null {
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === "string" && value) {
        const ms = Date.parse(value);
        return Number.isFinite(ms) ? new Date(ms) : null;
    }
    return null;
}

function coerce(id: string, data: Record<string, unknown>): CouponDoc {
    const storeIds = Array.isArray(data.storeIds)
        ? data.storeIds.filter((s): s is string => typeof s === "string" && s.length > 0)
        : [];
    return {
        id,
        name: typeof data.name === "string" ? data.name : "",
        storeIds,
        expiresAt: asDate(data.expiresAt),
        active: data.active === true,
        usedAt: asDate(data.usedAt),
        createdAt: asDate(data.createdAt),
    };
}

/** כל הקופונים, ממוינים: חדשים ראשונים (מסמך בלי createdAt – בסוף) */
export async function loadCoupons(env: CouponEnv): Promise<CouponDoc[]> {
    const snapshot = await getDocs(collection(couponsDb(env), COUPONS_COLLECTION));
    const docs = snapshot.docs.map(d => coerce(d.id, d.data() as Record<string, unknown>));
    docs.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
    return docs;
}

/**
 * יצירת קופון. ה-hash הוא מזהה המסמך; אם כבר קיים – שגיאה, כדי שלא נדרוס
 * קופון (אולי מנוצל) בטעות. `usedAt` לא נכתב בכלל – היעדרו = טרם נוצל.
 */
export async function createCoupon(env: CouponEnv, input: NewCoupon): Promise<CouponDoc> {
    const ref = doc(couponsDb(env), COUPONS_COLLECTION, input.codeHash);
    const existing = await getDoc(ref);
    if (existing.exists()) {
        throw new Error("קופון עם אותו קוד כבר קיים – יש להנפיק קוד אחר");
    }
    const now = new Date();
    await setDoc(ref, {
        name: input.name,
        storeIds: input.storeIds,
        expiresAt: Timestamp.fromDate(input.expiresAt),
        active: input.active,
        createdAt: Timestamp.fromDate(now),
    });
    return {
        id: input.codeHash,
        name: input.name,
        storeIds: input.storeIds,
        expiresAt: input.expiresAt,
        active: input.active,
        usedAt: null,
        createdAt: now,
    };
}

export async function setCouponActive(env: CouponEnv, id: string, active: boolean): Promise<void> {
    await updateDoc(doc(couponsDb(env), COUPONS_COLLECTION, id), { active });
}

/** מוחק את `usedAt` – הקופון חוזר להיות ניתן לפדיון (לבדיקות, או לפי החלטה) */
export async function resetCouponUsed(env: CouponEnv, id: string): Promise<void> {
    await updateDoc(doc(couponsDb(env), COUPONS_COLLECTION, id), { usedAt: deleteField() });
}

export async function deleteCoupon(env: CouponEnv, id: string): Promise<void> {
    await deleteDoc(doc(couponsDb(env), COUPONS_COLLECTION, id));
}
