/**
 * אחסון מתמיד של מחסן פריטים ב-localStorage.
 */

import {
    ITEM_WAREHOUSE_SCHEMA_VERSION,
    type WarehouseEntry,
} from "../types/itemWarehouse";

const STORAGE_KEY = "tocClipboard:v2";
const MAX_ENTRIES = 50;

function asString(v: unknown): string {
    return v != null ? String(v).trim() : "";
}

function isValidSnapshot(v: unknown): boolean {
    if (!v || typeof v !== "object") return false;
    const s = v as Record<string, unknown>;
    return asString(s.entityId) !== "" && !!s.values && typeof s.values === "object";
}

function isValidEntry(v: unknown): v is WarehouseEntry {
    if (!v || typeof v !== "object") return false;
    const e = v as Record<string, unknown>;
    const sourceMeta = (e.sourceMeta ?? {}) as Record<string, unknown>;
    const baseItems = Array.isArray(e.baseItems) ? e.baseItems : [];
    const enhancementsByTranslationId =
        e.enhancementsByTranslationId && typeof e.enhancementsByTranslationId === "object"
            ? (e.enhancementsByTranslationId as Record<string, unknown>)
            : null;

    if (asString(e.id) === "") return false;
    if (!Number.isFinite(Number(e.savedAt))) return false;
    if (!Array.isArray(baseItems) || baseItems.length === 0) return false;
    if (!baseItems.every(isValidSnapshot)) return false;
    if (!enhancementsByTranslationId) return false;
    if (
        Object.values(enhancementsByTranslationId).some(
            (list) => !Array.isArray(list) || !(list as unknown[]).every(isValidSnapshot)
        )
    ) {
        return false;
    }

    const sourceTocId =
        asString(sourceMeta.sourceTocId) || asString(sourceMeta.tocId);
    if (sourceTocId === "") return false;
    if (asString(sourceMeta.translationId) === "") return false;
    if (asString(sourceMeta.prayerId) === "") return false;
    if (asString(sourceMeta.partId) === "") return false;
    return true;
}

function normalizeEntry(entry: WarehouseEntry): WarehouseEntry {
    const sourceTocId = asString(entry.sourceMeta.sourceTocId) || asString(entry.sourceMeta.tocId);
    return {
        ...entry,
        schemaVersion: ITEM_WAREHOUSE_SCHEMA_VERSION,
        sourceMeta: {
            ...entry.sourceMeta,
            sourceTocId,
            tocId: asString(entry.sourceMeta.tocId) || sourceTocId,
        },
    };
}

function loadRaw(): WarehouseEntry[] {
    if (typeof localStorage === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isValidEntry).map((entry) => normalizeEntry(entry as WarehouseEntry));
    } catch {
        return [];
    }
}

function persist(entries: WarehouseEntry[]): void {
    if (typeof localStorage === "undefined") return;
    try {
        const normalized = entries
            .filter(isValidEntry)
            .map(normalizeEntry)
            .slice(0, MAX_ENTRIES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch {
        // localStorage מלא או לא זמין
    }
}

export function loadWarehouseEntries(): WarehouseEntry[] {
    return loadRaw().sort((a, b) => b.savedAt - a.savedAt);
}

export function addWarehouseEntry(entry: WarehouseEntry): WarehouseEntry[] {
    const next = [normalizeEntry(entry), ...loadRaw()].slice(0, MAX_ENTRIES);
    persist(next);
    return next;
}

export function removeWarehouseEntry(id: string): WarehouseEntry[] {
    const next = loadRaw().filter((e) => e.id !== id);
    persist(next);
    return next;
}

export function clearWarehouseEntries(): WarehouseEntry[] {
    persist([]);
    return [];
}

export function makeWarehouseEntryId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
