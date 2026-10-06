import { Entity } from "@firecms/core";
import type {
    WarehouseFieldSelection,
    WarehouseEntry,
    WarehouseItemSnapshot,
    WarehouseSourceMeta,
} from "../types/itemWarehouse";
import { ITEM_WAREHOUSE_SCHEMA_VERSION as WAREHOUSE_SCHEMA_VERSION } from "../types/itemWarehouse";
import { makeWarehouseEntryId } from "../services/itemWarehouseStorage";

const idNorm = (v: unknown) =>
    v != null && String(v).trim() !== "" ? String(v).trim() : "";

const STYLE_FIELDS = [
    "fontTanach",
    "bold",
    "centerAlign",
    "lineLine",
    "red",
    "justifyBlock",
    "noSpace",
    "block",
    "firstInPage",
    "specialDate",
] as const;

const ROLE_META_FIELDS = [
    "cohanim",
    "hazan",
    "minyan",
    "role",
    "reference",
    "specialSign",
] as const;

function pruneValuesBySelection(
    values: Record<string, any>,
    selection: WarehouseFieldSelection
): Record<string, any> {
    const next = { ...values };
    if (!selection.content) next.content = "";
    if (!selection.type) next.type = "body";
    if (!selection.title) {
        delete next.title;
        delete next.titleType;
    }
    if (!selection.style) {
        STYLE_FIELDS.forEach((f) => delete next[f]);
    }
    if (!selection.roleMeta) {
        ROLE_META_FIELDS.forEach((f) => delete next[f]);
    }
    if (!selection.dateSetId) {
        delete next.dateSetId;
    }
    return next;
}

/** ממיר snapshot למבנה Entity לשימוש ב-copyItemsToPart */
export function warehouseSnapshotsToEntities(
    snapshots: WarehouseItemSnapshot[]
): Entity<any>[] {
    return snapshots.map((s) => ({
        id: s.entityId,
        values: { ...s.values },
    })) as Entity<any>[];
}

export function warehouseEnhancementsToEntityMap(
    byTid: Record<string, WarehouseItemSnapshot[]>
): Record<string, Entity<any>[]> {
    const out: Record<string, Entity<any>[]> = {};
    for (const [tid, list] of Object.entries(byTid)) {
        out[tid] = warehouseSnapshotsToEntities(list);
    }
    return out;
}

export type BuildWarehouseEntryParams = {
    label?: string;
    copyLinkedTranslations?: boolean;
    sourceMeta: WarehouseSourceMeta;
    baseEntity: Entity<any>;
    baseLocalValues: Record<string, any>;
    relatedEnhancements: Array<{ id: string; tId: string; values: any }>;
    enhancementLocalValues: Record<string, any>;
};

/** בונה רשומת מחסן מפריט שורה נוכחי + תרגומים מקושרים */
export function buildWarehouseEntryFromRow(params: BuildWarehouseEntryParams): WarehouseEntry {
    const { baseEntity, baseLocalValues, ...rest } = params;
    return buildWarehouseEntryFromRows({
        ...rest,
        baseRows: [{ baseEntity, baseLocalValues }],
    });
}

export type BuildWarehouseEntryFromRowsParams = Omit<
    BuildWarehouseEntryParams,
    "baseEntity" | "baseLocalValues"
> & {
    /** שורות בסיס לשמירה כרשומה אחת (נשמרות לפי סדר itemId) */
    baseRows: Array<{ baseEntity: Entity<any>; baseLocalValues: Record<string, any> }>;
};

/** בונה רשומת מחסן אחת מכמה שורות בסיס + התרגומים המקושרים שלהן */
export function buildWarehouseEntryFromRows(
    params: BuildWarehouseEntryFromRowsParams
): WarehouseEntry {
    const {
        label: labelOverride,
        copyLinkedTranslations = true,
        sourceMeta,
        baseRows,
        relatedEnhancements,
        enhancementLocalValues,
    } = params;

    const baseItems: WarehouseItemSnapshot[] = baseRows
        .map(({ baseEntity, baseLocalValues }) => ({
            entityId: baseEntity.id,
            values: { ...baseEntity.values, ...baseLocalValues },
        }))
        .sort((a, b) =>
            idNorm(a.values.itemId).localeCompare(idNorm(b.values.itemId), undefined, {
                numeric: true,
            })
        );

    const first = baseItems[0]?.values ?? {};
    const contentPreview = String(first.content ?? "").trim().slice(0, 60);
    const itemId = idNorm(first.itemId);
    const defaultLabel = contentPreview || (itemId ? `itemId ${itemId}` : "פריט");
    const label =
        labelOverride?.trim() ||
        (baseItems.length > 1 ? `${baseItems.length} פריטים: ${defaultLabel}` : defaultLabel);

    // תרגום המקושר לכמה פריטים נבחרים נשמר פעם אחת בלבד – אחרת יועתק פעמיים
    const enhancementsByTranslationId: Record<string, WarehouseItemSnapshot[]> = {};
    const seenEnhancementIds = new Set<string>();
    for (const enh of relatedEnhancements) {
        if (seenEnhancementIds.has(enh.id)) continue;
        seenEnhancementIds.add(enh.id);
        const merged = { ...enh.values, ...enhancementLocalValues[enh.id] };
        if (!enhancementsByTranslationId[enh.tId]) {
            enhancementsByTranslationId[enh.tId] = [];
        }
        enhancementsByTranslationId[enh.tId].push({
            entityId: enh.id,
            values: { ...merged },
        });
    }

    return {
        id: makeWarehouseEntryId(),
        schemaVersion: WAREHOUSE_SCHEMA_VERSION,
        label,
        savedAt: Date.now(),
        copyLinkedTranslations,
        sourceMeta: {
            ...sourceMeta,
            sourceTocId: sourceMeta.sourceTocId || sourceMeta.tocId,
            tocId: sourceMeta.tocId || sourceMeta.sourceTocId,
        },
        baseItems,
        enhancementsByTranslationId,
    };
}

/** itemIds מה-snapshot לשימוש ב-copyItemsToPart */
export function warehouseEntrySourceItemIds(entry: WarehouseEntry): string[] {
    return entry.baseItems
        .map((b) => idNorm(b.values?.itemId))
        .filter((id) => id !== "");
}

/** יוצר עותק רשומת מחסן עם שדות מסוננים לפי בחירת המשתמש */
export function filterWarehouseEntryBySelection(
    entry: WarehouseEntry,
    selection: WarehouseFieldSelection
): WarehouseEntry {
    const baseItems = entry.baseItems.map((b) => ({
        ...b,
        values: pruneValuesBySelection(b.values ?? {}, selection),
    }));
    const enhancementsByTranslationId: Record<string, WarehouseItemSnapshot[]> = {};
    if (selection.copyLinkedTranslations) {
        for (const [tid, list] of Object.entries(entry.enhancementsByTranslationId)) {
            enhancementsByTranslationId[tid] = list.map((s) => ({
                ...s,
                values: pruneValuesBySelection(s.values ?? {}, selection),
            }));
        }
    }
    return {
        ...entry,
        baseItems,
        enhancementsByTranslationId,
        copyLinkedTranslations: entry.copyLinkedTranslations && selection.copyLinkedTranslations,
    };
}
