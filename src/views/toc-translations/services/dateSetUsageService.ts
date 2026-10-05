/**
 * dateSetUsageService – "איפה הסט הזה בשימוש": סורק את כל הנוסחים בסטייג'
 * ומחזיר כל פריט וכל מקטע שמפנים ל-dateSetId נתון.
 *
 * משמש את מסך האישור של "עדכון סט קיים" – עדכון במקום משנה את כל המקומות
 * האלה בבת אחת, ולכן המשתמש חייב לראות אותם לפני שהוא מאשר.
 *
 *   - מקטעים: toc/{tocId} → translations[].categories[].prayers[].parts[].dateSetIds
 *   - פריטים: translations/{translationId}/prayers/{prayerId}/items where dateSetId == id
 *     (שאילתה לכל צמד תרגום/תפילה – אותה רשימת צמדים שהפרסום לפרוד סורק;
 *     בלי collectionGroup, שהיה דורש אינדקס וחוקי אבטחה חדשים).
 *
 * פריטים/מקטעים/נוסחים שסומנו deleted לא נספרים – האפליקציה לא מציגה אותם.
 */

import {
    collection,
    getDocs,
    getFirestore,
    query,
    where,
} from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { collectTranslationPrayerPairs } from "./prodReconcileService";
import { getNusachDisplayLabel } from "../utils/nusachDisplay";

export type DateSetItemUsage = {
    translationId: string;
    prayerId: string;
    prayerName: string;
    itemId: string;
    snippet: string;
};

export type DateSetPartUsage = {
    translationId: string;
    prayerName: string;
    partName: string;
};

export type DateSetTocUsage = {
    tocId: string;
    nusachLabel: string;
    items: DateSetItemUsage[];
    parts: DateSetPartUsage[];
};

export type DateSetUsage = {
    dateSetId: string;
    tocs: DateSetTocUsage[];
    totalItems: number;
    totalParts: number;
};

const CONCURRENCY = 8;
const SNIPPET_MAX = 50;

function isDeleted(values: any): boolean {
    return values?.deleted === true || values?.deleted === "true" || values?.deleted === 1;
}

/** מקטעים בנוסח שה-dateSetIds שלהם כולל את ה-ID (טהור – נבדק ביחידה) */
export function findPartUsagesInToc(tocData: any, dateSetId: string): DateSetPartUsage[] {
    const usages: DateSetPartUsage[] = [];
    for (const trans of tocData?.translations ?? []) {
        if (isDeleted(trans)) continue;
        for (const cat of trans?.categories ?? []) {
            if (isDeleted(cat)) continue;
            for (const prayer of cat?.prayers ?? []) {
                if (isDeleted(prayer)) continue;
                for (const part of prayer?.parts ?? []) {
                    if (isDeleted(part)) continue;
                    const ids: unknown[] = Array.isArray(part?.dateSetIds) ? part.dateSetIds : [];
                    if (ids.some((v) => String(v).trim() === dateSetId)) {
                        usages.push({
                            translationId: String(trans.translationId ?? ""),
                            prayerName: String(prayer.name ?? prayer.id ?? ""),
                            partName: String(part.name ?? part.id ?? ""),
                        });
                    }
                }
            }
        }
    }
    return usages;
}

function prayerNamesByTranslation(tocData: any): Map<string, string> {
    const names = new Map<string, string>();
    for (const trans of tocData?.translations ?? []) {
        for (const cat of trans?.categories ?? []) {
            for (const prayer of cat?.prayers ?? []) {
                if (prayer?.id) names.set(`${trans.translationId}/${prayer.id}`, String(prayer.name ?? prayer.id));
            }
        }
    }
    return names;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

export async function findDateSetUsages(
    dateSetId: string,
    onProgress?: (done: number, total: number) => void
): Promise<DateSetUsage> {
    const db = getFirestore(getFirebaseApp());
    const tocSnap = await getDocs(collection(db, "toc"));
    const tocs = tocSnap.docs
        .filter((d) => !isDeleted(d.data()))
        .map((d) => ({ tocId: d.id, data: d.data() as any }));

    type Job = { tocIndex: number; translationId: string; prayerId: string; prayerName: string };
    const jobs: Job[] = [];
    const seen = new Set<string>();
    tocs.forEach((toc, tocIndex) => {
        const names = prayerNamesByTranslation(toc.data);
        for (const pair of collectTranslationPrayerPairs(toc.data)) {
            const key = `${pair.translationId}/${pair.prayerId}`;
            if (seen.has(key)) continue;
            seen.add(key);
            jobs.push({ tocIndex, ...pair, prayerName: names.get(key) ?? pair.prayerId });
        }
    });

    const result: DateSetTocUsage[] = tocs.map((toc) => ({
        tocId: toc.tocId,
        nusachLabel: getNusachDisplayLabel(toc.tocId, toc.data?.nusach),
        items: [],
        parts: findPartUsagesInToc(toc.data, dateSetId),
    }));

    // dateSetId נשמר כמחרוזת, אבל בודקים גם מספר – שאילתת Firestore רגישה לטיפוס.
    const idValues: Array<string | number> = [dateSetId];
    if (/^\d+$/.test(dateSetId)) idValues.push(Number(dateSetId));

    let done = 0;
    onProgress?.(0, jobs.length);
    await mapWithConcurrency(jobs, CONCURRENCY, async (job) => {
        const snap = await getDocs(
            query(
                collection(db, `translations/${job.translationId}/prayers/${job.prayerId}/items`),
                where("dateSetId", "in", idValues)
            )
        );
        for (const d of snap.docs) {
            const values = d.data();
            if (isDeleted(values)) continue;
            const content = typeof values.content === "string" ? values.content.replace(/<[^>]*>/g, "").trim() : "";
            result[job.tocIndex].items.push({
                translationId: job.translationId,
                prayerId: job.prayerId,
                prayerName: job.prayerName,
                itemId: String(values.itemId ?? d.id),
                snippet: content.length > SNIPPET_MAX ? `${content.slice(0, SNIPPET_MAX)}…` : content,
            });
        }
        onProgress?.(++done, jobs.length);
    });

    const used = result.filter((t) => t.items.length > 0 || t.parts.length > 0);
    return {
        dateSetId,
        tocs: used,
        totalItems: used.reduce((n, t) => n + t.items.length, 0),
        totalParts: used.reduce((n, t) => n + t.parts.length, 0),
    };
}
