/**
 * מדיניות מזהים לפי נוסח (תבנית אקסל: אשכנז 10…, ספרד 20…, עה״מ 30…)
 */

export const DEFAULT_ID_GAP = 10;

/** סף קטגוריה ראשונה: X018010 */
export function categoryFirstId(digitMillions: number): string {
    return String(digitMillions * 1_000_000 + 18_010);
}

/** סף תפילה בתחום ה-X015… */
export function prayerMinFloor(digitMillions: number): number {
    return digitMillions * 1_000_000 + 15_010;
}

/** סף פריט בלוק 11 / 12 */
export function partMinFloor(digitMillions: number, block: "11" | "12"): number {
    const mid = block === "11" ? 11 : 12;
    return digitMillions * 1_000_000 + mid * 1_000 + 10;
}

/**
 * רצפל מספרי לפריט ריק: מבוסס על דפוס 12 ספרות (20100… בנוסח 2) + זנב מזהה הפריט,
 * נמוך מכל פריט אמיתי באותו פריט כדי ש-minIdBefore יזניק את idBetween.
 */
/** 12 ספרות: (X01)*1e9 + מרווח + "1"+זנב4 של הפריט — נמוך מפריטים אמיתיים באותו פריט */
export function itemMinIdBefore(digitMillions: number, partId: string): string {
    const p = Number(partId);
    if (!Number.isFinite(p) || p <= 0) {
        const head = digitMillions * 100 + 1;
        return String(head * 1_000_000_000 + 2_200_000 + 10_000);
    }
    const tail4 = p % 10_000;
    const head = digitMillions * 100 + 1;
    return String(head * 1_000_000_000 + 2_200_000 + (10_000 + tail4));
}

function num(id: string | null | undefined): number {
    if (id == null || id === "") return NaN;
    return Number(id);
}

/** האם המספר שייך לטווח תפילות X015… של הנוסח */
export function isPrayerIdInBand(idStr: string, digitMillions: number): boolean {
    const n = num(idStr);
    if (Number.isNaN(n)) return false;
    const lo = digitMillions * 1_000_000 + 15_000;
    const hi = digitMillions * 1_000_000 + 199_999;
    return n >= lo && n <= hi;
}

/** האם המספר בטווח קטגוריה X018… */
export function isCategoryIdInBand(idStr: string, digitMillions: number): boolean {
    const n = num(idStr);
    if (Number.isNaN(n)) return false;
    const lo = digitMillions * 1_000_000 + 18_000;
    const hi = digitMillions * 1_000_000 + 199_999;
    return n >= lo && n <= hi;
}

/** בלוק פריט 11 או 12 לפי מזהה 7 ספרות */
export function partBlockOf(partId: string, digitMillions: number): "11" | "12" | null {
    const n = num(partId);
    if (Number.isNaN(n)) return null;
    const lo11 = digitMillions * 1_000_000 + 11_000;
    const hi11 = digitMillions * 1_000_000 + 11_999;
    const lo12 = digitMillions * 1_000_000 + 12_000;
    const hi12 = digitMillions * 1_000_000 + 12_999;
    if (n >= lo11 && n <= hi11) return "11";
    if (n >= lo12 && n <= hi12) return "12";
    return null;
}

/** מסנן מזהי תפילה לפי טווח הנוסח */
export function filterPrayerIdsInBand(ids: string[], digitMillions: number): string[] {
    return ids.filter((id) => isPrayerIdInBand(id, digitMillions));
}

function maxNumeric(ids: string[]): number {
    let m = -Infinity;
    for (const id of ids) {
        const n = num(id);
        if (!Number.isNaN(n)) m = Math.max(m, n);
    }
    return m;
}

export function maxPrayerIdInBand(ids: string[], digitMillions: number): number {
    const band = filterPrayerIdsInBand(ids, digitMillions);
    if (band.length === 0) return -Infinity;
    return maxNumeric(band);
}

/**
 * חצי בין שכנים עם מרווח ברירת מחדל; ללא 1000000 — אם אין גבולות, משתמש ב-fallbackAfterMax.
 */
export function midIdBetweenWithGap(
    idBefore: string | null | undefined,
    idAfter: string | null | undefined,
    gap: number,
    fallbackAfterMax: number
): string {
    const before = idBefore != null && idBefore !== "" ? Number(idBefore) : NaN;
    const after = idAfter != null && idAfter !== "" ? Number(idAfter) : NaN;
    if (!Number.isNaN(before) && !Number.isNaN(after)) {
        const mid = (before + after) / 2;
        return mid === Math.floor(mid) ? String(Math.floor(mid)) : String(mid);
    }
    if (!Number.isNaN(before)) {
        return String(before + gap);
    }
    if (!Number.isNaN(after)) {
        return String(after - gap);
    }
    return String(fallbackAfterMax);
}

/** מחשב מזהה חדש + פותר התנגשות ע″י +1 */
export function allocateIdWithCollision(
    candidate: string,
    taken: Set<string>
): string {
    let id = candidate;
    while (taken.has(id)) {
        id = String((Number(id) || 0) + 1);
    }
    return id;
}

/**
 * מסיק ספרת מיליונים 1/2/3 ממזהה TOC ראשון (קטגוריה / תפילה / פריט).
 */
export function inferDigitMillionsFromBaseTranslation(baseTrans: any): number | null {
    const cats = baseTrans?.categories ?? [];
    for (const c of cats) {
        const tryId = (raw: unknown) => {
            if (raw == null || raw === "") return null;
            const n = Number(raw);
            if (Number.isNaN(n)) return null;
            const d = Math.floor(n / 1_000_000);
            return d === 1 || d === 2 || d === 3 ? d : null;
        };
        const dCat = tryId(c?.id);
        if (dCat != null) return dCat;
        for (const p of c?.prayers ?? []) {
            const dP = tryId(p?.id);
            if (dP != null) return dP;
            for (const part of p?.parts ?? []) {
                const dPart = tryId(part?.id);
                if (dPart != null) return dPart;
            }
        }
    }
    return null;
}

/** נפילה לאחור לפי מזהה מסמך TOC (שם slug) */
export function inferDigitMillionsFallback(tocDocumentId: string): number {
    const s = String(tocDocumentId).toLowerCase();
    if (s.includes("ashkenaz") || s.includes("אשכנז")) return 1;
    if (s.includes("mizrah") || s.includes("מזרח") || s.includes("edot")) return 3;
    return 2;
}

export function resolveDigitMillions(baseTrans: any, tocDocumentId: string): number {
    return inferDigitMillionsFromBaseTranslation(baseTrans) ?? inferDigitMillionsFallback(tocDocumentId);
}

/** פריטים באותו בלוק ובאותה תפילה */
export function filterPartsInBlock(
    parts: Array<{ id?: string }>,
    digitMillions: number,
    block: "11" | "12"
): Array<{ id?: string }> {
    return parts.filter((p) => p?.id != null && partBlockOf(String(p.id), digitMillions) === block);
}

export function allocateNewCategoryId(
    existingIds: string[],
    digitMillions: number
): string {
    const inBand = existingIds.filter((id) => isCategoryIdInBand(id, digitMillions));
    if (inBand.length === 0) {
        if (existingIds.length === 0) return categoryFirstId(digitMillions);
        return String(maxNumeric(existingIds) + DEFAULT_ID_GAP);
    }
    const m = maxNumeric(inBand);
    return String(m + DEFAULT_ID_GAP);
}

export function allocateNewPrayerId(
    idAfter: string | null | undefined,
    idNext: string | null | undefined,
    allPrayerDocIds: string[],
    digitMillions: number
): string {
    const bandIds = filterPrayerIdsInBand(allPrayerDocIds, digitMillions);
    const maxBand = maxNumeric(bandIds);
    const fallback = (Number.isFinite(maxBand) && maxBand > -Infinity ? maxBand : prayerMinFloor(digitMillions) - DEFAULT_ID_GAP) + DEFAULT_ID_GAP;
    return midIdBetweenWithGap(idAfter ?? null, idNext ?? null, DEFAULT_ID_GAP, fallback);
}

export function allocateNewPartId(
    allParts: Array<{ id?: string }>,
    afterPartId: string | null,
    digitMillions: number
): string {
    const withIds = allParts.map((p) => String(p.id)).filter(Boolean);
    if (withIds.length === 0) {
        return String(partMinFloor(digitMillions, "11"));
    }

    let block: "11" | "12" = "11";
    if (afterPartId != null) {
        const b = partBlockOf(String(afterPartId), digitMillions);
        if (b) block = b;
    } else {
        let has11 = false;
        let has12 = false;
        for (const id of withIds) {
            const pb = partBlockOf(id, digitMillions);
            if (pb === "11") has11 = true;
            if (pb === "12") has12 = true;
        }
        const block11 = filterPartsInBlock(allParts, digitMillions, "11");
        const block12 = filterPartsInBlock(allParts, digitMillions, "12");
        if (has12 && !has11) block = "12";
        else if (has11 && has12) {
            const max11 = block11.length ? maxNumeric(block11.map((p) => String(p.id))) : -Infinity;
            const max12 = block12.length ? maxNumeric(block12.map((p) => String(p.id))) : -Infinity;
            block = max11 >= max12 ? "11" : "12";
        } else block = "11";
    }

    const inBlock = filterPartsInBlock(allParts, digitMillions, block)
        .map((p) => String(p.id))
        .filter(Boolean);
    const sorted = [...inBlock].sort((a, b) => Number(a) - Number(b));

    if (afterPartId == null) {
        const maxInBlock = sorted.length ? maxNumeric(sorted) : -Infinity;
        const floor = partMinFloor(digitMillions, block);
        const fallback = (Number.isFinite(maxInBlock) && maxInBlock > -Infinity ? maxInBlock : floor - DEFAULT_ID_GAP) + DEFAULT_ID_GAP;
        return String(fallback);
    }

    let idx = sorted.indexOf(String(afterPartId));
    let idBefore = String(afterPartId);
    let idNext: string | undefined =
        idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : undefined;
    if (idx < 0) {
        const allSorted = [...withIds].sort((a, b) => Number(a) - Number(b));
        const pi = allSorted.indexOf(String(afterPartId));
        if (pi >= 0) {
            const nextGlobal = pi < allSorted.length - 1 ? allSorted[pi + 1] : undefined;
            if (nextGlobal && partBlockOf(nextGlobal, digitMillions) === block) {
                idNext = nextGlobal;
            }
        }
    }
    const maxInBlock = sorted.length ? maxNumeric(sorted) : -Infinity;
    const floor = partMinFloor(digitMillions, block);
    const fallback = (Number.isFinite(maxInBlock) ? maxInBlock : floor - DEFAULT_ID_GAP) + DEFAULT_ID_GAP;
    return midIdBetweenWithGap(idBefore, idNext ?? null, DEFAULT_ID_GAP, fallback);
}
