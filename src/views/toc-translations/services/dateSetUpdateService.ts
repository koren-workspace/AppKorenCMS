/**
 * dateSetUpdateService – עדכון סט תאריכים קיים *במקום* ופרסומו לכל הנוסחים.
 *
 * בשונה מ"מצא או צור" (calendarService.resolveDateSetId), כאן ה-ID נשאר אותו
 * ID והרשומה עצמה משתנה – ולכן כל פריט ומקטע שמפנה אליו, בכל נוסח, משתנה.
 *
 * שני שלבים נפרדים, כדי שאפשר יהיה לנסות שוב רק את הפרסום אם נכשל באמצעו:
 *
 *   1. saveDateSetToStage – transaction על calendar/{id} בסטייג':
 *        - חוסם ID 100, רשומה שלא קיימת, ורשומה מחוקה.
 *        - נעילה אופטימית: ה-timestamp חייב להיות זה שנטען כשנפתח החלון –
 *          אחרת מישהו אחר שינה את הסט בינתיים.
 *        - set בלי merge: שדה שהוסר בטופס נמחק גם במסמך (האפליקציה מחליפה
 *          את כל הכלל, syncStore.upsertCalendarRules). שדות שהטופס לא מנהל
 *          (למשל roshHodesh) נשמרים כמו שהם.
 *
 *   2. publishDateSetEverywhere – רק הסט הזה, לא שום שינוי אחר שממתין בסטייג':
 *        - חותמת זמן טרייה על המסמך בסטייג' ובפרוד (set בלי merge בפרוד) –
 *          כדי שכל מכשיר ימשוך אותו, גם אם ה-watermark שלו מאוחר מהשמירה.
 *        - db-update-time/{nusach}.maxTimestamp לכל נוסח, בסטייג' ובפרוד.
 *          הסנכרון באפליקציה נעול לפי נוסח, והסט גלובלי – בלי זה מתפללי
 *          נוסח אחר לא היו מקבלים את התיקון. lastReconcileTimestamp לא נוגעים
 *          (העוגן של הפרסום הרגיל לפרוד).
 *        - Bagel updateTime לכל נוסח – לאפליקציות הישנות (native).
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    runTransaction,
    setDoc,
    updateDoc,
    type Firestore,
} from "firebase/firestore";
import { getFirebaseApp, isProdConfigured } from "../../../firebase_config";
import { getProdFirestore, isProdAuthenticated } from "./prodAuthService";
import { updateBagelTimestamp, type BagelEnv } from "./bagelUpdateTimeService";
import { buildCalendarEntryValues } from "./calendarService";
import {
    validateCalendarPayload,
    type CalendarEntryPayload,
} from "../constants/calendarTypes";

const CALENDAR_PATH = "calendar";
const UPDATE_TIME_PATH = "db-update-time";
export const ALWAYS_DATE_SET_ID = "100";

/** השדות שהטופס מנהל – כל השאר במסמך נשמר כמו שהוא */
const MANAGED_FIELDS = new Set([
    "dateSetId",
    "timestamp",
    "label",
    "simha",
    "beitEvel",
    "abroad",
    "yad",
    "tv",
    "dates_when_we_say_prayer",
    "dates_when_we_say_prayer_abroad",
    "dates_when_we_dont_say_prayer",
    "dates_when_we_dont_say_prayer_abroad",
    "weekdays",
]);

export class DateSetUpdateError extends Error {}

/**
 * בונה את המסמך החדש: שדות לא־מנוהלים מהמסמך הקיים + הערכים מהטופס.
 * טהור – נבדק ביחידה.
 */
export function buildUpdatedCalendarDoc(
    existing: Record<string, any>,
    dateSetId: string,
    payload: CalendarEntryPayload,
    timestamp: number
): Record<string, any> {
    const kept: Record<string, any> = {};
    for (const [key, value] of Object.entries(existing ?? {})) {
        if (!MANAGED_FIELDS.has(key)) kept[key] = value;
    }
    return { ...kept, ...buildCalendarEntryValues(dateSetId, payload), timestamp };
}

/** בדיקות שלא תלויות ב-Firestore – אם מחזיר הודעה, אסור לעדכן */
export function whyCannotUpdate(dateSetId: string | undefined | null, values?: Record<string, any> | null): string | null {
    if (!dateSetId) return "אין סט תאריכים קיים לעדכן";
    if (dateSetId === ALWAYS_DATE_SET_ID) return "סט 100 (תמיד) הוא קבוע ואי אפשר לשנות אותו";
    if (values && values.deleted === true) return `סט ${dateSetId} מסומן כמחוק – אי אפשר לעדכן אותו`;
    return null;
}

export async function saveDateSetToStage(params: {
    dateSetId: string;
    payload: CalendarEntryPayload;
    /** ה-timestamp של הרשומה כפי שנטענה בפתיחת החלון */
    expectedTimestamp: number | null;
}): Promise<{ before: Record<string, any>; after: Record<string, any> }> {
    const { dateSetId, payload, expectedTimestamp } = params;
    const blocked = whyCannotUpdate(dateSetId);
    if (blocked) throw new DateSetUpdateError(blocked);
    const { errors } = validateCalendarPayload(payload);
    if (errors.length > 0) throw new DateSetUpdateError(errors.join("\n"));

    const db = getFirestore(getFirebaseApp());
    const ref = doc(db, CALENDAR_PATH, dateSetId);
    return runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new DateSetUpdateError(`סט ${dateSetId} לא נמצא בסטייג'`);
        const before = snap.data() as Record<string, any>;
        const deletedReason = whyCannotUpdate(dateSetId, before);
        if (deletedReason) throw new DateSetUpdateError(deletedReason);
        const currentTs = Number(before.timestamp ?? 0);
        if (expectedTimestamp != null && currentTs !== expectedTimestamp) {
            throw new DateSetUpdateError(
                `סט ${dateSetId} שונה על ידי מישהו אחר מאז שפתחת את החלון. סגרו ופתחו מחדש כדי לראות את הערכים העדכניים.`
            );
        }
        const after = buildUpdatedCalendarDoc(before, dateSetId, payload, Date.now());
        transaction.set(ref, after);
        return { before, after };
    });
}

export type PublishStepKey =
    | "stage-doc"
    | "stage-update-time"
    | "stage-bagel"
    | "prod-doc"
    | "prod-update-time"
    | "prod-bagel";

export type PublishStepStatus = "pending" | "running" | "done" | "error" | "skipped";

export type PublishStep = {
    key: PublishStepKey;
    label: string;
    status: PublishStepStatus;
    detail?: string;
};

export function initialPublishSteps(prodEnabled: boolean): PublishStep[] {
    const steps: PublishStep[] = [
        { key: "stage-doc", label: "שמירת הסט בסטייג'", status: "pending" },
        { key: "stage-update-time", label: "סימון כל הנוסחים כמעודכנים בסטייג'", status: "pending" },
        { key: "stage-bagel", label: "עדכון Bagel סטייג' (אפליקציות ישנות)", status: "pending" },
        { key: "prod-doc", label: "העתקת הסט לפרוד", status: "pending" },
        { key: "prod-update-time", label: "סימון כל הנוסחים כמעודכנים בפרוד – המתפללים יקבלו את השינוי", status: "pending" },
        { key: "prod-bagel", label: "עדכון Bagel פרוד (אפליקציות ישנות)", status: "pending" },
    ];
    if (!prodEnabled) {
        for (const s of steps) {
            if (s.key.startsWith("prod-")) {
                s.status = "skipped";
                s.detail = "פרוד לא מוגדר בסביבה הזו";
            }
        }
    }
    return steps;
}

async function listNusachIds(db: Firestore): Promise<string[]> {
    const snap = await getDocs(collection(db, UPDATE_TIME_PATH));
    return snap.docs.map((d) => d.id).sort();
}

async function bumpUpdateTimes(db: Firestore, ids: string[], timestamp: number): Promise<void> {
    await Promise.all(
        ids.map((id) => setDoc(doc(db, UPDATE_TIME_PATH, id), { maxTimestamp: timestamp }, { merge: true }))
    );
}

async function bumpBagel(ids: string[], timestamp: number, env: BagelEnv): Promise<void> {
    const failures: string[] = [];
    for (const id of ids) {
        try {
            await updateBagelTimestamp(id, timestamp, env);
        } catch (err) {
            failures.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    if (failures.length > 0) throw new Error(failures.join("; "));
}

export type PublishResult = {
    ok: boolean;
    steps: PublishStep[];
    stageNusachIds: string[];
    prodNusachIds: string[];
    timestamp: number;
};

/**
 * מפרסם את הסט (כפי שהוא שמור עכשיו בסטייג') לכל הנוסחים. בטוח להריץ שוב
 * אחרי כשל – כל השלבים אידמפוטנטיים. עוצר בשלב הראשון שנכשל, חוץ מ-Bagel:
 * כשל ב-Bagel לא עוצר את פרוד (האפליקציה החדשה לא תלויה בו).
 */
export async function publishDateSetEverywhere(
    dateSetId: string,
    onSteps: (steps: PublishStep[]) => void
): Promise<PublishResult> {
    const prodEnabled = isProdConfigured();
    const steps = initialPublishSteps(prodEnabled);
    const timestamp = Date.now();
    let stageNusachIds: string[] = [];
    let prodNusachIds: string[] = [];
    let ok = true;

    const set = (key: PublishStepKey, status: PublishStepStatus, detail?: string) => {
        const step = steps.find((s) => s.key === key)!;
        step.status = status;
        step.detail = detail;
        onSteps(steps.map((s) => ({ ...s })));
    };
    const run = async (key: PublishStepKey, fn: () => Promise<string | void>): Promise<boolean> => {
        set(key, "running");
        try {
            const detail = await fn();
            set(key, "done", detail || undefined);
            return true;
        } catch (err) {
            ok = false;
            set(key, "error", err instanceof Error ? err.message : String(err));
            return false;
        }
    };
    const skipRest = (keys: PublishStepKey[], why: string) => {
        for (const key of keys) {
            const step = steps.find((s) => s.key === key)!;
            if (step.status === "pending") set(key, "skipped", why);
        }
    };

    onSteps(steps.map((s) => ({ ...s })));
    const stageDb = getFirestore(getFirebaseApp());
    let docData: Record<string, any> = {};

    const stageOk = await run("stage-doc", async () => {
        const ref = doc(stageDb, CALENDAR_PATH, dateSetId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error(`סט ${dateSetId} לא נמצא בסטייג'`);
        await updateDoc(ref, { timestamp });
        docData = { ...(snap.data() as Record<string, any>), timestamp };
    });
    if (!stageOk) {
        skipRest(["stage-update-time", "stage-bagel", "prod-doc", "prod-update-time", "prod-bagel"], "דולג – השלב הקודם נכשל");
        return { ok, steps, stageNusachIds, prodNusachIds, timestamp };
    }

    const stageTimeOk = await run("stage-update-time", async () => {
        stageNusachIds = await listNusachIds(stageDb);
        await bumpUpdateTimes(stageDb, stageNusachIds, timestamp);
        return stageNusachIds.join(", ");
    });
    if (stageTimeOk) {
        await run("stage-bagel", async () => {
            await bumpBagel(stageNusachIds, timestamp, "stage");
        });
    } else {
        skipRest(["stage-bagel"], "דולג – השלב הקודם נכשל");
    }

    if (!prodEnabled) return { ok, steps, stageNusachIds, prodNusachIds, timestamp };
    if (!isProdAuthenticated()) {
        ok = false;
        set("prod-doc", "error", "לא מחוברים לפרוד – התחברו ונסו שוב");
        skipRest(["prod-update-time", "prod-bagel"], "דולג – השלב הקודם נכשל");
        return { ok, steps, stageNusachIds, prodNusachIds, timestamp };
    }

    const prodDb = getProdFirestore();
    const prodDocOk = await run("prod-doc", async () => {
        await setDoc(doc(prodDb, CALENDAR_PATH, dateSetId), docData);
    });
    if (!prodDocOk) {
        skipRest(["prod-update-time", "prod-bagel"], "דולג – השלב הקודם נכשל");
        return { ok, steps, stageNusachIds, prodNusachIds, timestamp };
    }

    const prodTimeOk = await run("prod-update-time", async () => {
        prodNusachIds = await listNusachIds(prodDb);
        await bumpUpdateTimes(prodDb, prodNusachIds, timestamp);
        return prodNusachIds.join(", ");
    });
    if (prodTimeOk) {
        await run("prod-bagel", async () => {
            await bumpBagel(prodNusachIds, timestamp, "prod");
        });
    } else {
        skipRest(["prod-bagel"], "דולג – השלב הקודם נכשל");
    }

    return { ok, steps, stageNusachIds, prodNusachIds, timestamp };
}
