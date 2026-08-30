/**
 * changeLogService – תיעוד שינויים
 *
 * מתעד אוטומטית את כל השינויים במערכת (שמירת פריט, מחיקה, הוספת תרגום, פרסום ל-Bagel,
 * הוספת/מחיקת TOC/תרגום/קטגוריה/תפילה/פריט) בפורמט מובנה, כולל מי ביצע את הפעולה.
 *
 * יעדי שמירה:
 *  - Firestore (קולקציית cms_change_log) – היומן המשותף לכל העורכים, נצפה במסך "יומן שינויים".
 *  - localStorage – עותק מקומי בדפדפן של העורך.
 *  - במצב פיתוח (npm run dev) גם docs/cms-changelog.json ו-docs/cms-changes.xlsx.
 *
 * זהות המשתמש נקבעת פעם אחת בעליית המסך דרך setChangeLogUser, ומוטבעת אוטומטית
 * על כל רשומה – נקודות הקריאה ל-appendChangeLog אינן צריכות להעביר אותה.
 *
 * בקונסולה: __CMS_CHANGELOG_EXPORT__('json') או __CMS_CHANGELOG_EXPORT__('text')
 */

import {
    collection,
    doc as firestoreDoc,
    getDocs,
    getFirestore,
    limit as firestoreLimit,
    orderBy,
    query,
    setDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirebaseApp } from "../../../firebase_config";
import type { WarehouseFieldSelection } from "../types/itemWarehouse";

const STORAGE_KEY = "cms_changelog_entries";
/** מקסימום רשומות לשמירה (מגביל גודל localStorage) */
const MAX_ENTRIES = 2500;

/** קולקציית היומן המשותף ב-Firestore */
export const CHANGE_LOG_COLLECTION = "cms_change_log";

/**
 * אורך מקסימלי למחרוזת בודדת שנכתבת ל-Firestore. טקסטי תפילה בשדות "לפני/אחרי"
 * עלולים להיות ארוכים מאוד, ומסמך Firestore מוגבל ל-1MB.
 */
const MAX_FIELD_LENGTH = 2000;

/** מעל גודל זה (תווים ב-JSON) נשמור את הרשומה בלי details כדי שלא תיפסל כולה */
const MAX_DETAILS_LENGTH = 700_000;

/** סביבת העבודה – מאפשר להבחין בין רישום ב-Stage לרישום ב-Prod */
const ENVIRONMENT: "STAGE" | "PROD" = [
    (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ?? "",
    (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN ?? "",
].some((value: string) => String(value).toLowerCase().includes("stage"))
    ? "STAGE"
    : "PROD";

export type ChangeLogAction =
    | "save_part_items"      // שמירת פריטי מקטע (עדכון שדות)
    | "delete_part_item"    // מחיקת פריט פריט (soft delete)
    | "create_translation_item"  // הוספת פריט תרגום חדש
    | "publish_to_bagel"    // פרסום ל-Bagel
    | "add_toc"             // הוספת נוסח (TOC)
    | "update_toc"          // עריכת נוסח (שם)
    | "add_translation"     // הוספת תרגום לנוסח
    | "update_translation"  // עריכת תרגום (תווית)
    | "add_category"        // הוספת קטגוריה
    | "update_category"      // עריכת קטגוריה (שם)
    | "add_prayer"          // הוספת תפילה
    | "update_prayer"       // עריכת תפילה (שם)
    | "add_part"            // הוספת פריט
    | "update_part"         // עריכת פריט (שם, מאפיינים)
    | "reorder_parts"       // שינוי סדר פריטים
    | "delete_toc"          // מחיקת נוסח
    | "delete_translation"  // מחיקת תרגום
    | "delete_category"     // מחיקת קטגוריה
    | "delete_prayer"       // מחיקת תפילה
    | "delete_part"         // מחיקת פריט
    | "move_items_to_part"  // העברת פריטים בין פריטים
    | "copy_items_to_part"  // העתקת פריטים לחלק תפילה אחר (יכול להיות תפילה/נוסח שונים)
    | "split_part"          // פיצול פריט לשני פריטים
    | "save_app_copy"       // שמירת טקסטים של האפליקציה (app-copy) ל-Stage
    | "publish_app_copy";   // פרסום טקסטים של האפליקציה לפרוד

/** הקשר – איפה בוצעה הפעולה */
export type ChangeLogContext = {
    tocId?: string | null;
    translationId?: string | null;
    prayerId?: string | null;
    partId?: string | null;
    categoryName?: string | null;
    categoryId?: string | null;
    /** שמות להצגה באקסל (לצד ה-IDs) */
    tocName?: string | null;
    translationName?: string | null;
    prayerName?: string | null;
    partName?: string | null;
};

/** שינוי שדה בודד (לשמירת פריט) */
export type FieldChange = {
    field: string;
    oldValue: unknown;
    newValue: unknown;
};

/** מי ביצע את הפעולה */
export type ChangeLogUser = {
    email: string;
    uid: string;
};

/** רשומת לוג אחת – פורמט אחיד */
export type ChangeLogEntry = {
    id: string;
    timestamp: number;
    timestampIso: string;
    action: ChangeLogAction;
    /** מי ביצע – מוטבע אוטומטית מ-setChangeLogUser */
    user: ChangeLogUser;
    /** הסביבה שבה בוצעה הפעולה – מוטבע אוטומטית */
    env: "STAGE" | "PROD";
    context: ChangeLogContext;
    /** פרטים לפי סוג פעולה */
    details: {
        /** save_part_items: רשימת שינויי שדות לפי entity */
        fieldChanges?: Array<{
            entityId: string;
            itemId?: string;
            mitId?: string;
            itemContent?: string;
            isEnhancement?: boolean;
            enhancementTranslationId?: string;
            changes: FieldChange[];
        }>;
        /** delete_part_item: מזהה פריט ונקודות מקושרות */
        deletedItemId?: string;
        deletedEntityId?: string;
        deletedItemContent?: string;
        relatedTranslationIds?: string[];
        /** create_translation_item: פרטי הפריט שנוצר */
        newItemId?: string;
        newMitId?: string;
        newItemContent?: string;
        baseItemId?: string;
        targetTranslationId?: string;
        /** publish_to_bagel */
        selectedTocId?: string;
        /** add_toc */
        newTocId?: string;
        nusachName?: string;
        /** add_translation */
        newTranslationId?: string;
        /** add_category */
        newCategoryId?: string;
        categoryName?: string;
        categoryNameEn?: string;
        afterCategoryId?: string | null;
        /** update_category */
        categoryId?: string;
        nameHe?: string;
        nameEn?: string;
        /** update_toc */
        tocId?: string;
        nusach?: string;
        /** update_translation */
        translationId?: string;
        label?: string;
        /** add_prayer */
        newPrayerId?: string;
        prayerName?: string;
        afterPrayerId?: string | null;
        /** update_prayer / update_part */
        prayerId?: string;
        partId?: string;
        /** add_part */
        newPartId?: string;
        partName?: string;
        afterPartId?: string | null;
        /** reorder_parts */
        orderedPartIds?: string[];
        /** move_items_to_part */
        fromPartId?: string;
        toPartId?: string;
        movedItemIds?: string[];
        /** copy_items_to_part */
        sourceTranslationId?: string;
        sourcePrayerId?: string;
        sourcePartId?: string;
        targetPrayerId?: string;
        targetPartId?: string;
        copiedItemIds?: string[];
        copiedItemsCount?: number;
        copyLinkedTranslations?: boolean;
        baseIdMap?: Record<string, string>;
        /** copy_items_to_part מתוך מחסן הפריטים */
        fromWarehouse?: boolean;
        warehouseEntryId?: string;
        warehouseLabel?: string;
        sourceTocId?: string;
        selectedFields?: WarehouseFieldSelection;
        /** delete_* */
        deletedId?: string;
        deletedName?: string;
        /** save_app_copy: שינויי טקסטים לפי מפתח */
        copyChanges?: Array<{ key: string; changes: FieldChange[] }>;
        /** publish_app_copy: המפתחות שפורסמו לפרוד */
        publishedCopyKeys?: string[];
    };
    /** האם נשמר ל-Firestore */
    savedToFirestore?: boolean;
    /** האם פורסם ל-Bagel (רק ל-save_part_items שאחריהם publish) */
    publishedToBagel?: boolean;
};

/** קלט ל-appendChangeLog – id/timestampIso/user/env מוצבים אוטומטית */
export type ChangeLogInput = Omit<ChangeLogEntry, "id" | "timestampIso" | "user" | "env">;

const entries: ChangeLogEntry[] = [];
let loadedFromStorage = false;

const UNKNOWN_USER: ChangeLogUser = { email: "", uid: "" };
let currentUser: ChangeLogUser = UNKNOWN_USER;

/**
 * קובע את המשתמש שייחתם על כל הרשומות הבאות.
 * נקרא פעם אחת בעליית כל מסך ראשי, עם המשתמש המחובר ל-CMS.
 */
export function setChangeLogUser(user: { email?: string | null; uid?: string | null } | null): void {
    currentUser = {
        email: user?.email ?? "",
        uid: user?.uid ?? "",
    };
}

/**
 * המשתמש שייחתם על הרשומה: מה שנקבע ב-setChangeLogUser, ואם לא נקבע (מסך
 * ששכח לקרוא לו) – המשתמש המחובר ב-Firebase Auth, כדי שרשומות לא יירשמו
 * עם משתמש ריק בשקט.
 */
function resolveChangeLogUser(): ChangeLogUser {
    if (currentUser.email || currentUser.uid) return currentUser;
    try {
        const authUser = getAuth(getFirebaseApp()).currentUser;
        return { email: authUser?.email ?? "", uid: authUser?.uid ?? "" };
    } catch {
        // Firebase לא אותחל (למשל בטסטים) – נשארים עם משתמש ריק
        return currentUser;
    }
}

function makeId(): string {
    const id = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    console.log("[CMS-ID] makeId (changeLog) => id=", id);
    return id;
}

function toIso(ts: number): string {
    return new Date(ts).toISOString();
}

function loadFromStorage(): void {
    if (loadedFromStorage || typeof localStorage === "undefined") return;
    loadedFromStorage = true;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as ChangeLogEntry[];
        if (Array.isArray(parsed)) {
            entries.length = 0;
            entries.push(...parsed);
        }
    } catch {
        // נתונים פגומים – מתחילים רשימה ריקה
    }
}

const CHANGELOG_DEV_ENDPOINT = "/__cms_changelog__";
const EXCEL_DEV_ENDPOINT = "/__cms_excel__";

function saveToStorage(): void {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
        // localStorage מלא או לא זמין
    }
    if (typeof window !== "undefined" && (import.meta as any).env?.DEV) {
        const payload = JSON.stringify(entries, null, 2);
        fetch(CHANGELOG_DEV_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
        }).catch(() => {});
    }
}

function trimIfNeeded(): void {
    if (entries.length <= MAX_ENTRIES) return;
    entries.splice(0, entries.length - MAX_ENTRIES);
}

/**
 * שולח entry בודד לשרת Vite לכתיבה ל-Excel (רק במצב dev).
 * נקרא אחרי כל appendChangeLog – כלומר אחרי כל שמירה, מחיקה, הוספה וכו'.
 */
function sendEntryToExcel(entry: ChangeLogEntry): void {
    if (typeof window === "undefined" || !(import.meta as any).env?.DEV) return;
    fetch(EXCEL_DEV_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
    }).catch(() => {});
}

/**
 * מכין ערך לכתיבה ל-Firestore:
 *  - גוזם מחרוזות ארוכות (מסמך מוגבל ל-1MB)
 *  - משמיט undefined (Firestore דוחה אותו)
 *  - ממיר מערך בתוך מערך למחרוזת (Firestore אינו תומך בקינון כזה)
 * (מיוצא לצורך בדיקות יחידה בלבד)
 */
export function sanitizeForFirestore(value: unknown, depth = 0): unknown {
    if (depth > 12) return null;

    if (typeof value === "string") {
        return value.length > MAX_FIELD_LENGTH
            ? `${value.slice(0, MAX_FIELD_LENGTH)}…[נגזם, ${value.length} תווים במקור]`
            : value;
    }

    if (Array.isArray(value)) {
        return value.map(item =>
            Array.isArray(item)
                ? JSON.stringify(item).slice(0, MAX_FIELD_LENGTH)
                : sanitizeForFirestore(item, depth + 1) ?? null
        );
    }

    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined) continue;
            result[key] = sanitizeForFirestore(item, depth + 1);
        }
        return result;
    }

    return value === undefined ? null : value;
}

/**
 * כותב רשומה ל-Firestore. "שגר ושכח" בכוונה: כשל ברישום היומן לעולם לא
 * אמור להיכשל או לעכב שמירה של עורך, ולכן אין await ואין זריקת שגיאה.
 */
function writeEntryToFirestore(entry: ChangeLogEntry): void {
    if (typeof window === "undefined") return;
    try {
        const sanitized = sanitizeForFirestore(entry) as Record<string, unknown>;

        const detailsJson = JSON.stringify(sanitized.details ?? {});
        if (detailsJson.length > MAX_DETAILS_LENGTH) {
            sanitized.details = { omitted: true, reason: `details גדול מדי (${detailsJson.length} תווים)` };
        }

        const db = getFirestore(getFirebaseApp());
        void setDoc(firestoreDoc(db, CHANGE_LOG_COLLECTION, entry.id), sanitized).catch(err => {
            console.warn("[changeLog] כתיבת רשומה ל-Firestore נכשלה:", err);
        });
    } catch (err) {
        console.warn("[changeLog] כתיבת רשומה ל-Firestore נכשלה:", err);
    }
}

/**
 * מוסיף רשומת לוג אחת ושומר ב-Firestore + localStorage + Excel (במצב dev)
 */
export function appendChangeLog(entry: ChangeLogInput): ChangeLogEntry {
    loadFromStorage();
    const full: ChangeLogEntry = {
        ...entry,
        id: makeId(),
        timestampIso: toIso(entry.timestamp),
        user: resolveChangeLogUser(),
        env: ENVIRONMENT,
    };
    entries.push(full);
    trimIfNeeded();
    saveToStorage();
    writeEntryToFirestore(full);
    sendEntryToExcel(full);
    return full;
}

/**
 * מוסיף מספר רשומות (למשל כל שינויי השדות משמירה אחת)
 */
export function appendChangeLogBatch(entryList: ChangeLogInput[]): void {
    for (const e of entryList) {
        appendChangeLog(e);
    }
}

/**
 * טוען את הרשומות האחרונות מהיומן המשותף ב-Firestore (החדשות ביותר קודם).
 * מיון לפי שדה יחיד – אינו דורש אינדקס מורכב.
 */
export async function fetchChangeLogEntries(max = 200): Promise<ChangeLogEntry[]> {
    const db = getFirestore(getFirebaseApp());
    const snapshot = await getDocs(
        query(
            collection(db, CHANGE_LOG_COLLECTION),
            orderBy("timestamp", "desc"),
            firestoreLimit(max)
        )
    );
    return snapshot.docs.map(entryDoc => entryDoc.data() as ChangeLogEntry);
}

/**
 * מחזיר עותק של כל רשומות הלוג (לפי סדר כרונולוגי). טוען מ-localStorage בפעם הראשונה.
 */
export function getChangeLogEntries(): ChangeLogEntry[] {
    loadFromStorage();
    return [...entries];
}

/**
 * מנקה את כל רשומות הלוג ואת השמירה ב-localStorage
 */
export function clearChangeLog(): void {
    loadFromStorage();
    entries.length = 0;
    saveToStorage();
}

/**
 * מייצא את הלוג כ-JSON ומוריד קובץ
 */
export function exportChangeLogAsJson(filename?: string): void {
    loadFromStorage();
    const name = filename ?? `cms-changelog-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * מייצא את הלוג כטקסט קריא (שורה לכל רשומה, עם פירוט)
 */
export function exportChangeLogAsText(filename?: string): void {
    loadFromStorage();
    const lines: string[] = [
        "=== CMS Change Log ===",
        `Export: ${new Date().toISOString()}`,
        `Total entries: ${entries.length}`,
        "",
    ];
    for (const e of entries) {
        lines.push(`--- ${e.timestampIso} | ${e.action} | id=${e.id} ---`);
        lines.push(`  context: tocId=${e.context.tocId ?? "-"} translationId=${e.context.translationId ?? "-"} prayerId=${e.context.prayerId ?? "-"} partId=${e.context.partId ?? "-"}`);
        if (e.details?.fieldChanges?.length) {
            for (const fc of e.details.fieldChanges) {
                lines.push(`  entity: ${fc.entityId} itemId=${fc.itemId ?? "-"} mitId=${fc.mitId ?? "-"}${fc.isEnhancement ? " [enhancement " + (fc.enhancementTranslationId ?? "") + "]" : ""}`);
                for (const c of fc.changes) {
                    lines.push(`    ${c.field}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`);
                }
            }
        }
        if (e.details?.deletedItemId) lines.push(`  deleted: itemId=${e.details.deletedItemId} entityId=${e.details.deletedEntityId ?? "-"} related=${(e.details.relatedTranslationIds ?? []).join(", ") || "-"}`);
        if (e.details?.newItemId) lines.push(`  created: itemId=${e.details.newItemId} mitId=${e.details.newMitId ?? "-"} baseItemId=${e.details.baseItemId ?? "-"} targetTranslationId=${e.details.targetTranslationId ?? "-"}`);
        if (e.details?.selectedTocId) lines.push(`  publish: tocId=${e.details.selectedTocId}`);
        if (e.details?.newTocId) lines.push(`  new TOC: id=${e.details.newTocId} name=${e.details.nusachName ?? "-"}`);
        if (e.action === "update_toc" && (e.details as any)?.tocId) lines.push(`  updated TOC: id=${(e.details as any).tocId} nusach=${(e.details as any)?.nusach ?? "-"}`);
        if (e.details?.newTranslationId) lines.push(`  new translation: id=${e.details.newTranslationId}`);
        if (e.action === "update_translation" && (e.details as any)?.translationId) lines.push(`  updated translation: id=${(e.details as any).translationId} label=${(e.details as any)?.label ?? "-"}`);
        if (e.details?.newCategoryId) lines.push(`  new category: id=${e.details.newCategoryId} name=${e.details.categoryName ?? "-"} after=${e.details.afterCategoryId ?? "-"}`);
        if (e.action === "update_category" && (e.details as any)?.categoryId) lines.push(`  updated category: id=${(e.details as any).categoryId} nameHe=${(e.details as any)?.nameHe ?? "-"} nameEn=${(e.details as any)?.nameEn ?? "-"}`);
        if (e.details?.newPrayerId) lines.push(`  new prayer: id=${e.details.newPrayerId} name=${e.details.prayerName ?? "-"} after=${e.details.afterPrayerId ?? "-"}`);
        if (e.action === "update_prayer" && (e.details as any)?.prayerId) lines.push(`  updated prayer: id=${(e.details as any).prayerId} nameHe=${(e.details as any)?.nameHe ?? "-"} nameEn=${(e.details as any)?.nameEn ?? "-"}`);
        if (e.details?.newPartId) lines.push(`  new part: id=${e.details.newPartId} name=${e.details.partName ?? "-"} after=${e.details.afterPartId ?? "-"}`);
        if (e.action === "update_part" && (e.details as any)?.partId) lines.push(`  updated part: id=${(e.details as any).partId} nameHe=${(e.details as any)?.nameHe ?? "-"} nameEn=${(e.details as any)?.nameEn ?? "-"}`);
        if (e.details?.fromPartId) lines.push(`  move_items: from=${e.details.fromPartId} to=${e.details.toPartId ?? "-"} items=${(e.details.movedItemIds ?? []).join(", ") || "-"}`);
        if (e.details?.deletedId) lines.push(`  deleted: id=${e.details.deletedId} name=${e.details.deletedName ?? "-"}`);
        if (e.savedToFirestore != null) lines.push(`  savedToFirestore: ${e.savedToFirestore}`);
        if (e.publishedToBagel != null) lines.push(`  publishedToBagel: ${e.publishedToBagel}`);
        lines.push("");
    }
    const name = filename ?? `cms-changelog-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.txt`;
    const blob = new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

/** מחשוף לפיתוח: ייצוא הלוג לקובץ מהקונסולה (json / text) */
function exposeExportForDev(): void {
    if (typeof window === "undefined") return;
    (window as unknown as { __CMS_CHANGELOG_EXPORT__?: (format: "json" | "text") => void }).__CMS_CHANGELOG_EXPORT__ =
        (format: "json" | "text") => {
            if (format === "json") exportChangeLogAsJson();
            else exportChangeLogAsText();
        };
}
exposeExportForDev();
