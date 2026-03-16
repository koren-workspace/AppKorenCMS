/**
 * changeLogService – תיעוד שינויים לפיתוח (לא קשור לממשק)
 *
 * מתעד אוטומטית את כל השינויים במערכת (שמירת מקטע, מחיקה, הוספת תרגום, פרסום ל-Bagel,
 * הוספת/מחיקת TOC/תרגום/קטגוריה/תפילה/מקטע) בפורמט מובנה.
 *
 * במצב פיתוח (npm run dev): הלוג נשמר גם בקובץ docs/cms-changelog.json – ניתן לפתוח אותו ישירות.
 * בנוסף נשמר ב-localStorage. בקונסולה: __CMS_CHANGELOG_EXPORT__('json') או __CMS_CHANGELOG_EXPORT__('text')
 */

const STORAGE_KEY = "cms_changelog_entries";
/** מקסימום רשומות לשמירה (מגביל גודל localStorage) */
const MAX_ENTRIES = 2500;

export type ChangeLogAction =
    | "save_part_items"      // שמירת פריטי מקטע (עדכון שדות)
    | "delete_part_item"    // מחיקת פריט מקטע (soft delete)
    | "create_translation_item"  // הוספת פריט תרגום חדש
    | "publish_to_bagel"    // פרסום ל-Bagel
    | "add_toc"             // הוספת נוסח (TOC)
    | "add_translation"     // הוספת תרגום לנוסח
    | "add_category"        // הוספת קטגוריה
    | "add_prayer"          // הוספת תפילה
    | "add_part"            // הוספת מקטע
    | "update_part"         // עריכת מקטע (שם, מאפיינים)
    | "delete_toc"          // מחיקת נוסח
    | "delete_translation"  // מחיקת תרגום
    | "delete_category"     // מחיקת קטגוריה
    | "delete_prayer"       // מחיקת תפילה
    | "delete_part"         // מחיקת מקטע
    | "move_items_to_part"; // העברת פריטים בין מקטעים

/** הקשר – איפה בוצעה הפעולה */
export type ChangeLogContext = {
    tocId?: string | null;
    translationId?: string | null;
    prayerId?: string | null;
    partId?: string | null;
    categoryName?: string | null;
    categoryId?: string | null;
};

/** שינוי שדה בודד (לשמירת מקטע) */
export type FieldChange = {
    field: string;
    oldValue: unknown;
    newValue: unknown;
};

/** רשומת לוג אחת – פורמט אחיד */
export type ChangeLogEntry = {
    id: string;
    timestamp: number;
    timestampIso: string;
    action: ChangeLogAction;
    context: ChangeLogContext;
    /** פרטים לפי סוג פעולה */
    details: {
        /** save_part_items: רשימת שינויי שדות לפי entity */
        fieldChanges?: Array<{
            entityId: string;
            itemId?: string;
            mitId?: string;
            isEnhancement?: boolean;
            enhancementTranslationId?: string;
            changes: FieldChange[];
        }>;
        /** delete_part_item: מזהה פריט ונקודות מקושרות */
        deletedItemId?: string;
        deletedEntityId?: string;
        relatedTranslationIds?: string[];
        /** create_translation_item: פרטי הפריט שנוצר */
        newItemId?: string;
        newMitId?: string;
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
        afterCategoryId?: string | null;
        /** add_prayer */
        newPrayerId?: string;
        prayerName?: string;
        afterPrayerId?: string | null;
        /** add_part */
        newPartId?: string;
        partName?: string;
        afterPartId?: string | null;
        /** move_items_to_part */
        fromPartId?: string;
        toPartId?: string;
        movedItemIds?: string[];
        /** delete_* */
        deletedId?: string;
        deletedName?: string;
    };
    /** האם נשמר ל-Firestore */
    savedToFirestore?: boolean;
    /** האם פורסם ל-Bagel (רק ל-save_part_items שאחריהם publish) */
    publishedToBagel?: boolean;
};

const entries: ChangeLogEntry[] = [];
let loadedFromStorage = false;

function makeId(): string {
    return `chg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
 * מוסיף רשומת לוג אחת ושומר ב-localStorage + Excel (במצב dev)
 */
export function appendChangeLog(entry: Omit<ChangeLogEntry, "id" | "timestampIso">): ChangeLogEntry {
    loadFromStorage();
    const full: ChangeLogEntry = {
        ...entry,
        id: makeId(),
        timestampIso: toIso(entry.timestamp),
    };
    entries.push(full);
    trimIfNeeded();
    saveToStorage();
    sendEntryToExcel(full);
    return full;
}

/**
 * מוסיף מספר רשומות (למשל כל שינויי השדות משמירה אחת)
 */
export function appendChangeLogBatch(entryList: Omit<ChangeLogEntry, "id" | "timestampIso">[]): void {
    for (const e of entryList) {
        appendChangeLog(e);
    }
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
        if (e.details?.newTranslationId) lines.push(`  new translation: id=${e.details.newTranslationId}`);
        if (e.details?.newCategoryId) lines.push(`  new category: id=${e.details.newCategoryId} name=${e.details.categoryName ?? "-"} after=${e.details.afterCategoryId ?? "-"}`);
        if (e.details?.newPrayerId) lines.push(`  new prayer: id=${e.details.newPrayerId} name=${e.details.prayerName ?? "-"} after=${e.details.afterPrayerId ?? "-"}`);
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
