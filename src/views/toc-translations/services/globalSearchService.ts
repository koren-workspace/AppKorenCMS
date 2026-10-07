/**
 * globalSearchService – חיפוש מורחב: חיפוש טקסט בפריטים על פני כל הקטגוריות,
 * ולפי בחירה גם על פני כל התרגומים וכל הנוסחים.
 *
 * Firestore לא תומך בחיפוש תת-מחרוזת, ולכן טוענים את כל הפריטים של כל צמד
 * תרגום/תפילה בטווח החיפוש (translations/{translationId}/prayers/{prayerId}/items)
 * ומחפשים בזיכרון. הטעינה נשמרת במטמון לכל הסשן – חיפוש נוסף באותו טווח לא
 * קורא שוב מהשרת (כפתור "רענון" מנקה את המטמון).
 *
 * ההשוואה מתעלמת מניקוד וטעמים, מתגיות HTML ומרווחים כפולים; מקף עברי (מקף)
 * נחשב רווח, כך ש"על כן" מוצא גם "עַל־כֵּן".
 *
 * נוסחים/תרגומים/קטגוריות/תפילות/מקטעים/פריטים שסומנו deleted לא נסרקים.
 */

import { collection, getDocs, getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "../../../firebase_config";
import { getNusachDisplayLabel } from "../utils/nusachDisplay";
import { getTranslationDisplayLabel, getTranslationIdPrefix } from "../utils/translationDisplayLabels";

export type GlobalSearchScope = {
    /** "current" – רק הנוסח הנבחר; "all" – כל הנוסחים */
    nusach: "current" | "all";
    /** "current" – רק התרגום הנבחר (ובשאר הנוסחים: התרגום מאותו סוג); "all" – כל התרגומים */
    translation: "current" | "all";
    currentTocId: string | null;
    currentTranslationId: string | null;
};

/** צמד תרגום/תפילה לטעינה, עם כל מה שצריך כדי להציג מיקום ולנווט אליו */
export type SearchTarget = {
    tocId: string;
    nusachLabel: string;
    translationId: string;
    translationLabel: string;
    categoryId: string;
    categoryName: string;
    prayerId: string;
    prayerName: string;
    /** partId → שם המקטע (רק מקטעים שלא נמחקו) */
    partNames: Map<string, string>;
};

export type CachedItem = {
    docId: string;
    itemId: string;
    partId: string;
    type: string;
    /** שדות טקסט מוצגים (ללא HTML), לפי סדר העדיפות לחיפוש */
    fields: { name: "content" | "title" | "reference"; text: string }[];
};

export type SearchHit = {
    tocId: string;
    nusachLabel: string;
    translationId: string;
    translationLabel: string;
    categoryId: string;
    categoryName: string;
    prayerId: string;
    prayerName: string;
    partId: string;
    partName: string;
    docId: string;
    itemId: string;
    type: string;
    field: "content" | "title" | "reference" | "itemId";
    before: string;
    match: string;
    after: string;
};

const CONCURRENCY = 8;
const SNIPPET_CONTEXT = 40;

function isDeleted(values: any): boolean {
    return values?.deleted === true || values?.deleted === "true" || values?.deleted === 1;
}

// —— נרמול טקסט ——

const DIACRITIC = /[֑-ׇ]/;
const MAQAF = "־";

/** מסיר תגיות HTML ומפענח את הישויות הנפוצות – הטקסט כפי שהעורך רואה אותו */
export function stripHtml(text: string): string {
    return text
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

/**
 * מנרמל טקסט להשוואה ומחזיר גם מיפוי: map[i] = האינדקס בטקסט המקורי של התו ה-i
 * בטקסט המנורמל. כך אפשר לסמן את ההתאמה בטקסט המקורי (עם הניקוד).
 */
export function normalizeWithMap(raw: string): { norm: string; map: number[] } {
    let norm = "";
    const map: number[] = [];
    let lastWasSpace = true; // מסיר רווחים בתחילת הטקסט
    for (let i = 0; i < raw.length; i++) {
        const decomposed = raw[i].normalize("NFKD");
        for (const ch of decomposed) {
            const isSpace = ch === MAQAF || /\s/.test(ch);
            if (isSpace) {
                if (lastWasSpace) continue;
                norm += " ";
                map.push(i);
                lastWasSpace = true;
                continue;
            }
            if (DIACRITIC.test(ch)) continue;
            for (const lower of ch.toLowerCase()) {
                norm += lower;
                map.push(i);
            }
            lastWasSpace = false;
        }
    }
    if (norm.endsWith(" ")) {
        norm = norm.slice(0, -1);
        map.pop();
    }
    return { norm, map };
}

export function normalizeForSearch(text: string): string {
    return normalizeWithMap(text).norm;
}

// —— טווח החיפוש ——

/** כל צמדי התרגום/תפילה בטווח, ללא כפילויות (מזהה תרגום ייחודי בין הנוסחים) */
export function buildSearchTargets(
    tocs: { id: string; values: any }[],
    scope: GlobalSearchScope
): SearchTarget[] {
    const currentPrefix = getTranslationIdPrefix(scope.currentTranslationId);
    const targets: SearchTarget[] = [];
    const seen = new Set<string>();

    for (const toc of tocs) {
        if (isDeleted(toc.values)) continue;
        if (scope.nusach === "current" && toc.id !== scope.currentTocId) continue;
        const nusachLabel = getNusachDisplayLabel(toc.id, toc.values?.nusach);

        for (const trans of toc.values?.translations ?? []) {
            const translationId = String(trans?.translationId ?? "");
            if (!translationId || isDeleted(trans)) continue;
            if (scope.translation === "current") {
                const sameTranslation = translationId === scope.currentTranslationId;
                const samePrefix =
                    scope.nusach === "all" &&
                    currentPrefix != null &&
                    getTranslationIdPrefix(translationId) === currentPrefix;
                if (!sameTranslation && !samePrefix) continue;
            }
            const translationLabel = getTranslationDisplayLabel(translationId, { storedLabel: trans?.label });

            for (const cat of trans.categories ?? []) {
                if (isDeleted(cat)) continue;
                for (const prayer of cat.prayers ?? []) {
                    if (!prayer?.id || isDeleted(prayer)) continue;
                    const key = `${translationId}/${prayer.id}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    const partNames = new Map<string, string>();
                    for (const part of prayer.parts ?? []) {
                        if (!part?.id || isDeleted(part)) continue;
                        partNames.set(String(part.id), String(part.nameHe ?? part.name ?? part.id));
                    }
                    targets.push({
                        tocId: toc.id,
                        nusachLabel,
                        translationId,
                        translationLabel,
                        categoryId: String(cat.id ?? ""),
                        categoryName: String(cat.nameHe ?? cat.name ?? cat.id ?? ""),
                        prayerId: String(prayer.id),
                        prayerName: String(prayer.nameHe ?? prayer.name ?? prayer.id),
                        partNames,
                    });
                }
            }
        }
    }
    return targets;
}

// —— חיפוש בזיכרון ——

/** קטע טקסט סביב ההתאמה, עם ההתאמה עצמה בנפרד (לסימון) */
function snippetAround(raw: string, start: number, end: number) {
    let from = Math.max(0, start - SNIPPET_CONTEXT);
    let to = Math.min(raw.length, end + SNIPPET_CONTEXT);
    // לא לחתוך באמצע מילה
    if (from > 0) {
        const space = raw.indexOf(" ", from);
        if (space >= 0 && space < start) from = space + 1;
    }
    if (to < raw.length) {
        const space = raw.lastIndexOf(" ", to);
        if (space > end) to = space;
    }
    return {
        before: (from > 0 ? "…" : "") + raw.slice(from, start),
        match: raw.slice(start, end),
        after: raw.slice(end, to) + (to < raw.length ? "…" : ""),
    };
}

/**
 * מחזיר את ההתאמה הראשונה בפריט (פריט מופיע פעם אחת בתוצאות), או null.
 * q – שאילתה מנורמלת (normalizeForSearch).
 */
export function matchItem(
    item: CachedItem,
    q: string
): Pick<SearchHit, "field" | "before" | "match" | "after"> | null {
    if (!q) return null;
    for (const field of item.fields) {
        if (!field.text) continue;
        const { norm, map } = normalizeWithMap(field.text);
        const idx = norm.indexOf(q);
        if (idx < 0) continue;
        const start = map[idx];
        const end = map[idx + q.length - 1] + 1;
        // כולל ניקוד שצמוד לאות האחרונה של ההתאמה
        let endWithMarks = end;
        while (
            endWithMarks < field.text.length &&
            field.text[endWithMarks] !== MAQAF &&
            DIACRITIC.test(field.text[endWithMarks])
        ) {
            endWithMarks++;
        }
        return { field: field.name, ...snippetAround(field.text, start, endWithMarks) };
    }
    if (item.itemId && normalizeForSearch(item.itemId).includes(q)) {
        const preview = item.fields.find((f) => f.text)?.text ?? "";
        return {
            field: "itemId",
            before: "",
            match: "",
            after: preview.length > SNIPPET_CONTEXT * 2 ? `${preview.slice(0, SNIPPET_CONTEXT * 2)}…` : preview,
        };
    }
    return null;
}

export function searchLoaded(
    targets: SearchTarget[],
    itemsByTarget: Map<string, CachedItem[]>,
    query: string
): SearchHit[] {
    const q = normalizeForSearch(query);
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const target of targets) {
        const items = itemsByTarget.get(targetKey(target)) ?? [];
        for (const item of items) {
            // פריט שהמקטע שלו נמחק/לא קיים במבנה – האפליקציה לא מציגה אותו
            const partName = target.partNames.get(item.partId);
            if (partName == null) continue;
            const m = matchItem(item, q);
            if (!m) continue;
            hits.push({
                tocId: target.tocId,
                nusachLabel: target.nusachLabel,
                translationId: target.translationId,
                translationLabel: target.translationLabel,
                categoryId: target.categoryId,
                categoryName: target.categoryName,
                prayerId: target.prayerId,
                prayerName: target.prayerName,
                partId: item.partId,
                partName,
                docId: item.docId,
                itemId: item.itemId,
                type: item.type,
                ...m,
            });
        }
    }
    return hits;
}

// —— טעינה + מטמון ——

export function targetKey(t: { translationId: string; prayerId: string }): string {
    return `${t.translationId}/${t.prayerId}`;
}

/**
 * מטמון: translationId/prayerId → פריטים. רשומה פגה אחרי CACHE_TTL_MS כדי
 * שעריכות (שלנו או של עורכים אחרים) ייכנסו לחיפוש בלי רענון ידני.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const itemCache = new Map<string, { items: CachedItem[]; loadedAt: number }>();

function getCached(key: string): CachedItem[] | null {
    const entry = itemCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.loadedAt > CACHE_TTL_MS) {
        itemCache.delete(key);
        return null;
    }
    return entry.items;
}

export function clearGlobalSearchCache(): void {
    itemCache.clear();
}

/** מוחק מהמטמון תפילה אחת (למשל זו שנערכה עכשיו) */
export function invalidateGlobalSearchCache(translationId: string, prayerId: string): void {
    itemCache.delete(targetKey({ translationId, prayerId }));
}

export function toCachedItem(docId: string, values: any): CachedItem | null {
    if (isDeleted(values)) return null;
    const text = (v: unknown) => (typeof v === "string" ? stripHtml(v).trim() : "");
    return {
        docId,
        itemId: String(values?.itemId ?? docId),
        partId: String(values?.partId ?? ""),
        type: String(values?.type ?? ""),
        fields: [
            { name: "content", text: text(values?.content) },
            { name: "title", text: text(values?.title) },
            { name: "reference", text: text(values?.reference) },
        ],
    };
}

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            await fn(items[next++]);
        }
    });
    await Promise.all(workers);
}

/** טוען (או לוקח מהמטמון) את הפריטים של כל היעדים. onProgress(done, total) */
export async function loadTargets(
    targets: SearchTarget[],
    onProgress?: (done: number, total: number) => void,
    isCancelled?: () => boolean
): Promise<Map<string, CachedItem[]>> {
    const db = getFirestore(getFirebaseApp());
    const result = new Map<string, CachedItem[]>();
    const missing = targets.filter((t) => {
        const cached = getCached(targetKey(t));
        if (cached) result.set(targetKey(t), cached);
        return !cached;
    });

    let done = targets.length - missing.length;
    onProgress?.(done, targets.length);
    await mapWithConcurrency(missing, CONCURRENCY, async (target) => {
        if (isCancelled?.()) return;
        const key = targetKey(target);
        const snap = await getDocs(
            collection(db, `translations/${target.translationId}/prayers/${target.prayerId}/items`)
        );
        const items: CachedItem[] = [];
        for (const d of snap.docs) {
            const item = toCachedItem(d.id, d.data());
            if (item) items.push(item);
        }
        items.sort((a, b) => a.itemId.localeCompare(b.itemId, undefined, { numeric: true }));
        itemCache.set(key, { items, loadedAt: Date.now() });
        result.set(key, items);
        onProgress?.(++done, targets.length);
    });
    return result;
}

/** כמה מהיעדים כבר טעונים (להצגת "יטען X תפילות") */
export function countUncachedTargets(targets: SearchTarget[]): number {
    return targets.filter((t) => getCached(targetKey(t)) == null).length;
}
