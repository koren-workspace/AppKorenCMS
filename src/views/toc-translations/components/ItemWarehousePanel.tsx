/**
 * ItemWarehousePanel – מחסן פריטים צדדי ליצירת עותקים חוזרים.
 */

import React from "react";
import type { WarehouseEntry } from "../types/itemWarehouse";

export type ItemWarehousePanelProps = {
    open: boolean;
    onToggleOpen: () => void;
    entries: WarehouseEntry[];
    selectedEntryId: string | null;
    onSelectEntry: (id: string) => void;
    onRemoveEntry: (id: string) => void;
    onClearAll: () => void;
    disabled?: boolean;
};

export function ItemWarehousePanel({
    open,
    onToggleOpen,
    entries,
    selectedEntryId,
    onSelectEntry,
    onRemoveEntry,
    onClearAll,
    disabled = false,
}: ItemWarehousePanelProps) {
    if (!open) {
        return (
            <button
                type="button"
                onClick={onToggleOpen}
                className="shrink-0 w-10 bg-white border border-gray-200 rounded shadow-sm text-xs font-bold text-violet-700 hover:bg-violet-50 writing-mode-vertical"
                title="פתח מחסן פריטים"
                disabled={disabled}
            >
                מחסן
            </button>
        );
    }

    const selected = entries.find((e) => e.id === selectedEntryId);

    return (
        <div
            className="shrink-0 w-[280px] bg-white border border-violet-200 rounded shadow-lg flex flex-col min-h-0 max-h-full"
            dir="rtl"
        >
            <div className="flex items-center justify-between px-3 py-2 border-b bg-violet-50/80 shrink-0">
                <h3 className="font-bold text-violet-900 text-sm">מחסן פריטים</h3>
                <div className="flex items-center gap-1">
                    {entries.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("לנקות את כל המחסן?")) onClearAll();
                            }}
                            disabled={disabled}
                            className="text-xs text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded border border-red-200"
                            title="נקה הכל"
                        >
                            נקה
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onToggleOpen}
                        className="text-gray-400 hover:text-gray-600 text-sm px-1"
                        title="הסתר מחסן"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                {disabled && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                        המחסן זמין רק אחרי בחירת נוסח/תרגום/מקטע.
                    </div>
                )}
                {entries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4 px-1">
                        אין פריטים במחסן. לחץ «שמור במחסן» על פריט בסיס כדי לשמור תבנית מלאה.
                    </p>
                ) : (
                    entries.map((entry) => {
                        const isSel = entry.id === selectedEntryId;
                        const enhCount = Object.values(entry.enhancementsByTranslationId).reduce(
                            (n, list) => n + list.length,
                            0
                        );
                        const savedDate = new Date(entry.savedAt).toLocaleString("he-IL", {
                            dateStyle: "short",
                            timeStyle: "short",
                        });
                        return (
                            <div
                                key={entry.id}
                                className={`rounded border p-2 text-sm transition-colors ${
                                    disabled ? "opacity-70 cursor-not-allowed" :
                                    "cursor-pointer"
                                } ${
                                    isSel
                                        ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"
                                        : "border-gray-200 hover:border-violet-200 hover:bg-gray-50"
                                }`}
                                onClick={() => !disabled && onSelectEntry(entry.id)}
                                role="button"
                                tabIndex={disabled ? -1 : 0}
                                onKeyDown={(e) => {
                                    if (disabled) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onSelectEntry(entry.id);
                                    }
                                }}
                            >
                                <div className="font-semibold text-gray-900 line-clamp-2 mb-1">
                                    {entry.label}
                                </div>
                                <div className="text-xs text-gray-500 space-y-0.5">
                                    <div>
                                        סוג: {entry.baseItems[0]?.values?.type ?? "body"}
                                    </div>
                                    {entry.sourceMeta.partName && (
                                        <div className="truncate">
                                            מקור: {entry.sourceMeta.partName}
                                        </div>
                                    )}
                                    {enhCount > 0 && (
                                        <div>+ {enhCount} תרגומים מקושרים</div>
                                    )}
                                    <div className="text-gray-400">{savedDate}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (disabled) return;
                                        if (window.confirm("להסיר מהמחסן?")) onRemoveEntry(entry.id);
                                    }}
                                    disabled={disabled}
                                    className="mt-2 text-xs text-red-600 hover:underline"
                                >
                                    הסר
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {selected && (
                <div className="shrink-0 px-3 py-2 border-t bg-gray-50 text-xs text-gray-600">
                    <span className="font-semibold text-violet-800">נבחר:</span>{" "}
                    {selected.label}
                    <div className="mt-1 text-gray-500">
                        השתמש ב«צור מהמחסן» ליד המיקום הרצוי ברשימת הפריטים.
                    </div>
                </div>
            )}
        </div>
    );
}
