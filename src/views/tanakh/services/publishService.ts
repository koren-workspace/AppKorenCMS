/**
 * publishService – בניית קובץ התוכן, מצב הפרסום, וההורדה שלו (שלב 7).
 *
 * העלאה ל-Firebase Storage עדיין לא כאן: Storage מצריך תוכנית Blaze ולא
 * הופעל בפרויקט. עד אז הקובץ נבנה בדפדפן ויורד למחשב, וזה מספיק כדי לוודא
 * שהוא נכון. כשיופעל Storage תתווסף כאן פונקציית העלאה אחת, בלי לגעת
 * בהמרה, במסך או בצד האפליקציה.
 *
 * מסמך `meta/publish` נכתב בכל פרסום ומחזיק את מספר הגרסה, מתי ועל ידי מי.
 * הוא קטן, ולכן יושב ב-Firestore גם בלי Storage.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getTanakhFirestore } from "./tanakhAuthService";
import { META_COLLECTION, PUBLISH_DOC_ID, type PublishMeta } from "../model/types";
import type { ContentPack } from "../model/publish";
import { stripUndefined } from "../model/entryOps";
import { appendChangeLog } from "../../toc-translations/services/changeLogService";

/**
 * האם יעד ההעלאה זמין. Storage דורש Blaze; עד שיופעל, המסך מציג את ההעלאה
 * מושבתת עם הסבר במקום להעלים אותה.
 */
export function isStorageEnabled(): boolean {
    return import.meta.env.VITE_TLM_STORAGE_ENABLED === "true";
}

export async function loadPublishMeta(): Promise<PublishMeta | null> {
    const snap = await getDoc(doc(getTanakhFirestore(), META_COLLECTION, PUBLISH_DOC_ID));
    return snap.exists() ? (snap.data() as PublishMeta) : null;
}

export async function savePublishMeta(meta: PublishMeta): Promise<void> {
    await setDoc(doc(getTanakhFirestore(), META_COLLECTION, PUBLISH_DOC_ID), stripUndefined(meta));
    appendChangeLog({
        timestamp: meta.publishedAt,
        action: "publish_tanakh_content",
        context: {},
        details: { tanakh: { summary: `פורסמה גרסה ${meta.version} של קובץ התוכן (${meta.entryCount} ערכים)` } },
        savedToFirestore: true,
    });
}

/** גודל הקובץ בבתים, לתצוגה לפני ההורדה */
export function packSize(pack: ContentPack): number {
    return new Blob([JSON.stringify(pack)]).size;
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} ב׳`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** הורדת הקובץ למחשב של העורך */
export function downloadPack(pack: ContentPack, fileName: string): void {
    const blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/^published\//, "");
    document.body.appendChild(a);
    a.click();
    a.remove();
    // שחרור מיידי היה מבטל הורדה שעוד לא התחילה בחלק מהדפדפנים
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
