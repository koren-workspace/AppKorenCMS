/**
 * MoveToPartModal – מודל העברת פריטים למקטע אחר
 *
 * בשונה מפיצול (שדורש חתך רציף), כאן בוחרים פריטים בודדים בחירה חופשית (checkboxes).
 * הסיבה: המקטע היעד כבר קיים, ואין מניעה שפריטים בודדים יועברו אליו.
 *
 * תהליך:
 *  1. בחירת מקטע יעד (dropdown)
 *  2. סימון פריטים להעברה (checkboxes – בחירה חופשית)
 *  3. בחירת מיקום הכנסה במקטע היעד (תחילה / סוף / אחרי פריט מסוים)
 */

import React, { useEffect, useState } from "react";
import { Entity } from "@firecms/cloud";

export type MoveToPartModalProps = {
    open: boolean;
    onClose: () => void;
    /** פריטי המקטע הנוכחי (ממוינים לפי mit_id) */
    items: Entity<any>[];
    /** ערכים מקומיים (לתצוגת content) */
    localValues: Record<string, any>;
    /** רשימת המקטעים בתפילה (לבחירת יעד) */
    currentParts: any[];
    /** המקטע הנוכחי */
    currentPartId: string | null;
    /** פריטי מקטע היעד (נטענים בבחירת יעד) */
    targetPartItems: Entity<any>[];
    onLoadTargetPartItems: (partId: string) => Promise<void>;
    onSubmit: (params: {
        movedItemIds: string[];
        targetPartId: string;
        insertAfterItemId: string | null;
    }) => void;
    saving: boolean;
};

export function MoveToPartModal({
    open,
    onClose,
    items,
    localValues,
    currentParts,
    currentPartId,
    targetPartItems,
    onLoadTargetPartItems,
    onSubmit,
    saving,
}: MoveToPartModalProps) {
    const [targetPartId, setTargetPartId] = useState<string | null>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [insertAfterItemId, setInsertAfterItemId] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setTargetPartId(null);
        setSelectedItemIds(new Set());
        setInsertAfterItemId(null);
    }, [open]);

    useEffect(() => {
        if (targetPartId) {
            onLoadTargetPartItems(targetPartId);
            setInsertAfterItemId(null);
        }
    }, [targetPartId]);

    if (!open) return null;

    const otherParts = (currentParts ?? []).filter((p: any) => p.id !== currentPartId);

    const toggleItem = (itemId: string) => {
        setSelectedItemIds((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedItemIds.size === items.length) {
            setSelectedItemIds(new Set());
        } else {
            const allIds = items
                .map((e) => (localValues[e.id]?.itemId ?? e.values?.itemId) as string)
                .filter(Boolean);
            setSelectedItemIds(new Set(allIds));
        }
    };

    const movedItemIds = Array.from(selectedItemIds);
    const canSubmit = targetPartId !== null && movedItemIds.length > 0 && !saving;

    const handleSubmit = () => {
        if (!canSubmit || !targetPartId) return;
        onSubmit({ movedItemIds, targetPartId, insertAfterItemId });
    };

    // ערך "סוף" בתפריט המיקום
    const endSentinel =
        targetPartItems.length > 0
            ? (targetPartItems[targetPartItems.length - 1].values?.itemId ??
               targetPartItems[targetPartItems.length - 1].id)
            : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden">
                {/* כותרת */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-sm">העברת פריטים למקטע אחר</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* בחירת מקטע יעד */}
                    <div>
                        <label className="block text-[10px] font-semibold mb-1">מקטע יעד *</label>
                        {otherParts.length === 0 ? (
                            <div className="text-gray-400 text-[10px]">אין מקטעים אחרים בתפילה זו</div>
                        ) : (
                            <select
                                className="border rounded px-2 py-1 text-[11px] w-full"
                                value={targetPartId ?? ""}
                                onChange={(e) => setTargetPartId(e.target.value || null)}
                            >
                                <option value="">— בחר מקטע יעד —</option>
                                {otherParts.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.id} – {p.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* מיקום הכנסה במקטע היעד */}
                    {targetPartId && (
                        <div>
                            <label className="block text-[10px] font-semibold mb-1">מיקום הכנסה במקטע היעד</label>
                            <select
                                className="border rounded px-2 py-1 text-[11px] w-full"
                                value={insertAfterItemId ?? "__beginning__"}
                                onChange={(e) =>
                                    setInsertAfterItemId(
                                        e.target.value === "__beginning__" || e.target.value === "__end__"
                                            ? (e.target.value === "__end__" ? endSentinel : null)
                                            : e.target.value
                                    )
                                }
                            >
                                <option value="__beginning__">בתחילת המקטע</option>
                                {targetPartItems.map((item) => {
                                    const vals = item.values ?? {};
                                    const iId = vals.itemId ?? item.id;
                                    const cnt = (vals.content ?? "") as string;
                                    return (
                                        <option key={item.id} value={iId}>
                                            אחרי {iId}: {cnt.slice(0, 30)}{cnt.length > 30 ? "…" : ""}
                                        </option>
                                    );
                                })}
                                <option value="__end__">בסוף המקטע</option>
                            </select>
                        </div>
                    )}

                    {/* בחירת פריטים */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="text-[10px] font-semibold text-gray-700">
                                בחר פריטים להעברה (בחירה חופשית)
                            </div>
                            {items.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    className="text-[9px] text-blue-600 hover:underline"
                                >
                                    {selectedItemIds.size === items.length ? "בטל הכל" : "בחר הכל"}
                                </button>
                            )}
                        </div>
                        {items.length === 0 ? (
                            <div className="text-gray-400 text-[10px]">אין פריטים במקטע</div>
                        ) : (
                            <div className="border rounded overflow-hidden divide-y max-h-64 overflow-y-auto">
                                {items.map((item) => {
                                    const vals = localValues[item.id] ?? item.values ?? {};
                                    const itemId: string = vals.itemId ?? item.id;
                                    const content: string = vals.content ?? "";
                                    const type: string = vals.type ?? "";
                                    const checked = selectedItemIds.has(itemId);

                                    return (
                                        <label
                                            key={item.id}
                                            className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                                                checked
                                                    ? "bg-orange-50 hover:bg-orange-100"
                                                    : "bg-white hover:bg-gray-50"
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleItem(itemId)}
                                                className="mt-0.5 shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] text-gray-400 font-mono shrink-0">{itemId}</span>
                                                    <span className={`text-[9px] px-1 rounded shrink-0 ${
                                                        type === "title" ? "bg-purple-100 text-purple-700" :
                                                        type === "instructions" ? "bg-yellow-100 text-yellow-700" :
                                                        "bg-gray-100 text-gray-500"
                                                    }`}>{type}</span>
                                                    {checked && (
                                                        <span className="text-[9px] bg-orange-200 text-orange-700 px-1 rounded shrink-0">
                                                            → {targetPartId ?? "יעד"}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-800 truncate mt-0.5" dir="rtl">
                                                    {content || <span className="text-gray-300 italic">(ריק)</span>}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        {selectedItemIds.size > 0 && (
                            <div className="mt-1 text-[10px] text-orange-700 font-medium">
                                {selectedItemIds.size} פריטים נבחרו להעברה
                                {targetPartId ? ` למקטע ${targetPartId}` : ""}
                            </div>
                        )}
                    </div>
                </div>

                {/* כפתורים */}
                <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="px-5 py-1.5 bg-orange-600 text-white rounded font-bold text-sm disabled:opacity-30 hover:bg-orange-700"
                    >
                        {saving
                            ? "מעביר..."
                            : `העבר ${movedItemIds.length > 0 ? movedItemIds.length + " פריטים" : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
