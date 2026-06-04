import React, { useEffect, useMemo, useState } from "react";
import { Entity } from "@firecms/core";
import type {
    WarehouseEntry,
    WarehouseFieldSelection,
} from "../types/itemWarehouse";
import { DEFAULT_WAREHOUSE_FIELD_SELECTION } from "../types/itemWarehouse";

type WarehousePasteModalProps = {
    open: boolean;
    entries: WarehouseEntry[];
    selectedEntryId: string | null;
    onSelectEntry: (id: string) => void;
    items: Entity<any>[];
    localValues: Record<string, any>;
    saving: boolean;
    onClose: () => void;
    onSubmit: (params: {
        entryId: string;
        insertAfterItemId: string | null;
        selection: WarehouseFieldSelection;
    }) => void;
    /** כשמוגדר: יעד נעול (מודאל בחירה בלבד) */
    fixedInsertAfterItemId?: string | null;
};

type TargetMode = "start" | "end" | "after";

export function WarehousePasteModal({
    open,
    entries,
    selectedEntryId,
    onSelectEntry,
    items,
    localValues,
    saving,
    onClose,
    onSubmit,
    fixedInsertAfterItemId,
}: WarehousePasteModalProps) {
    const [targetMode, setTargetMode] = useState<TargetMode>("end");
    const [afterItemId, setAfterItemId] = useState<string>("");
    const [copyLinkedTranslations, setCopyLinkedTranslations] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (!open) return;
        setTargetMode("end");
        setAfterItemId("");
        setCopyLinkedTranslations(true);
        setSearchQuery("");
    }, [open]);

    const normalizedItems = useMemo(
        () =>
            items
                .map((item) => ({
                    entityId: item.id,
                    itemId: String(
                        localValues[item.id]?.itemId ?? item.values?.itemId ?? ""
                    ).trim(),
                    content: String(
                        localValues[item.id]?.content ?? item.values?.content ?? ""
                    )
                        .trim()
                        .slice(0, 40),
                }))
                .filter((x) => x.itemId !== ""),
        [items, localValues]
    );

    const selectedEntry =
        entries.find((e) => e.id === selectedEntryId) ?? null;
    const filteredEntries = entries.filter((entry) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const label = String(entry.label ?? "").toLowerCase();
        const content = String(entry.baseItems[0]?.values?.content ?? "").toLowerCase();
        const type = String(entry.baseItems[0]?.values?.type ?? "").toLowerCase();
        return label.includes(q) || content.includes(q) || type.includes(q);
    });

    const insertAfterItemId = (() => {
        if (fixedInsertAfterItemId !== undefined) return fixedInsertAfterItemId;
        if (targetMode === "start") return null;
        if (targetMode === "end") {
            return normalizedItems[normalizedItems.length - 1]?.itemId ?? null;
        }
        return afterItemId || null;
    })();

    const canSubmit =
        !!selectedEntry &&
        !saving &&
        (fixedInsertAfterItemId !== undefined || targetMode !== "after" || !!afterItemId);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
            dir="rtl"
        >
            <div className="bg-white rounded-lg shadow-xl w-[min(860px,96vw)] max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-lg">הדבקה מהמחסן</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg"
                        aria-label="סגור"
                    >
                        ✕
                    </button>
                </div>
                <div className="p-4 overflow-y-auto space-y-4">
                    <section className="border rounded p-3 bg-violet-50/40">
                        <h3 className="text-sm font-bold text-violet-900 mb-2">
                            1) בחר פריט מהמחסן
                        </h3>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="חיפוש לפי שם/תוכן/סוג"
                            className="w-full mb-2 border rounded px-2 py-1 text-sm bg-white"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                            {filteredEntries.length === 0 && (
                                <div className="text-sm text-gray-500">
                                    לא נמצאו פריטים במחסן.
                                </div>
                            )}
                            {filteredEntries.map((entry) => {
                                const selected = selectedEntryId === entry.id;
                                const enhCount = Object.values(
                                    entry.enhancementsByTranslationId
                                ).reduce((n, list) => n + list.length, 0);
                                return (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => onSelectEntry(entry.id)}
                                        className={`text-right border rounded p-2 text-sm ${
                                            selected
                                                ? "border-violet-400 bg-violet-100"
                                                : "border-gray-200 bg-white hover:border-violet-200"
                                        }`}
                                    >
                                        <div className="font-semibold line-clamp-2">{entry.label}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {entry.baseItems[0]?.values?.type ?? "body"}
                                            {enhCount > 0 ? ` · +${enhCount} תרגומים` : ""}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        {selectedEntry && (
                            <div className="mt-2 rounded border border-violet-200 bg-white p-2 text-xs text-gray-700">
                                <div className="font-semibold text-violet-900">{selectedEntry.label}</div>
                                <div className="mt-1">
                                    סוג: {String(selectedEntry.baseItems[0]?.values?.type ?? "body")}
                                </div>
                                <div className="mt-0.5 line-clamp-2">
                                    {String(selectedEntry.baseItems[0]?.values?.content ?? "").trim().slice(0, 120)}
                                </div>
                            </div>
                        )}
                    </section>

                    {fixedInsertAfterItemId === undefined && (
                        <section className="border rounded p-3">
                            <h3 className="text-sm font-bold text-gray-900 mb-2">
                                2) בחר יעד הדבקה
                            </h3>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <label className="inline-flex items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="target-mode"
                                        checked={targetMode === "start"}
                                        onChange={() => setTargetMode("start")}
                                    />
                                    תחילת המקטע
                                </label>
                                <label className="inline-flex items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="target-mode"
                                        checked={targetMode === "end"}
                                        onChange={() => setTargetMode("end")}
                                    />
                                    סוף המקטע
                                </label>
                                <label className="inline-flex items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="target-mode"
                                        checked={targetMode === "after"}
                                        onChange={() => setTargetMode("after")}
                                    />
                                    אחרי פריט מסוים
                                </label>
                            </div>
                            {targetMode === "after" && (
                                <select
                                    className="mt-2 w-full border rounded px-2 py-1 text-sm"
                                    value={afterItemId}
                                    onChange={(e) => setAfterItemId(e.target.value)}
                                >
                                    <option value="">בחר פריט</option>
                                    {normalizedItems.map((item) => (
                                        <option key={item.entityId} value={item.itemId}>
                                            {item.itemId}
                                            {item.content ? ` — ${item.content}` : ""}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </section>
                    )}

                    <section className="border rounded p-3">
                        <h3 className="text-sm font-bold text-gray-900 mb-2">
                            הגדרות העתקה
                        </h3>
                        <label className="inline-flex items-center gap-1.5 text-sm">
                            <input
                                type="checkbox"
                                checked={copyLinkedTranslations}
                                onChange={(e) => setCopyLinkedTranslations(e.target.checked)}
                            />
                            העתק גם תרגומים מקושרים
                        </label>
                    </section>
                </div>
                <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between gap-2">
                    <div className="text-xs text-gray-500">
                        יעד:{" "}
                        {insertAfterItemId == null
                            ? "תחילת המקטע"
                            : `אחרי itemId ${insertAfterItemId}`}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                        >
                            ביטול
                        </button>
                        <button
                            type="button"
                            disabled={!canSubmit}
                            onClick={() =>
                                selectedEntry &&
                                onSubmit({
                                    entryId: selectedEntry.id,
                                    insertAfterItemId,
                                    selection: {
                                        ...DEFAULT_WAREHOUSE_FIELD_SELECTION,
                                        copyLinkedTranslations,
                                    },
                                })
                            }
                            className="px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                            {saving ? "יוצר..." : "צור עותק מהמחסן"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

