/**
 * CopyItemsToPartModal – מודל העתקת פריטים לחלק תפילה אחר
 *
 * בניגוד ל-MoveToPartModal, כאן:
 *  - היעד יכול להיות **נוסח** אחר (אשכנז → ספרד וכו')
 *  - היעד יכול להיות תפילה אחרת
 *  - היעד יכול להיות אותו חלק (שכפול)
 *  - פריטי המקור נשארים (העתקה ולא העברה)
 *  - checkbox "העתק גם תרגומים מקושרים" – מעתיק אנגלית/הרב זקס וכו' לנוסח היעד
 *
 * הערה: אין כאן העתקה בין **תרגומים** (עברית↔אנגלית) – רק בין **נוסחים**.
 * העריכה מתבצעת תמיד בנוסח הבסיס (0-*).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Entity } from "@firecms/core";
import { getNusachDisplayLabel } from "../utils/nusachDisplay";

function getBaseTranslationTree(tocItem: Entity<any> | undefined): any | null {
    if (!tocItem?.values?.translations) return null;
    const tocId = tocItem.id;
    const translations: any[] = tocItem.values.translations;
    return (
        translations.find((t: any) => t.translationId === `0-${tocId}`) ??
        translations.find((t: any) => String(t.translationId ?? "").startsWith("0-")) ??
        null
    );
}

export type CopyItemsToPartModalProps = {
    open: boolean;
    onClose: () => void;
    /** פריטי חלק התפילה הנוכחי (ממוינים לפי itemId) */
    items: Entity<any>[];
    /** ערכים מקומיים (לתצוגת content) */
    localValues: Record<string, any>;
    /** מזהה נוסח נוכחי (ashkenaz, sefard וכו') – ברירת מחדל ליעד */
    currentTocId: string;
    /** מזהה תפילה נוכחית – ברירת מחדל ליעד */
    currentPrayerId: string;
    /** מזהה חלק תפילה נוכחי – ברירת מחדל ליעד */
    currentPartId: string;
    /** כל מסמכי ה-TOC (נוסחים) */
    tocItems: Entity<any>[];
    /** פריטי חלק תפילה היעד (נטענים בבחירת חלק יעד) */
    targetPartItems: Entity<any>[];
    /** נקרא בכל שינוי של נוסח/תפילה/חלק יעד; טוען פריטי בסיס (0-*) */
    onLoadTargetPartItems: (params: {
        targetTocId: string;
        targetPrayerId: string;
        targetPartId: string;
    }) => Promise<void>;
    onSubmit: (params: {
        sourceItemIds: string[];
        targetTocId: string;
        targetPrayerId: string;
        targetPartId: string;
        insertAfterItemId: string | null;
        copyLinkedTranslations: boolean;
    }) => void;
    saving: boolean;
};

export function CopyItemsToPartModal({
    open,
    onClose,
    items,
    localValues,
    currentTocId,
    currentPrayerId,
    currentPartId,
    tocItems,
    targetPartItems,
    onLoadTargetPartItems,
    onSubmit,
    saving,
}: CopyItemsToPartModalProps) {
    const [targetTocId, setTargetTocId] = useState<string>(currentTocId);
    const [targetPrayerId, setTargetPrayerId] = useState<string>(currentPrayerId);
    const [targetPartId, setTargetPartId] = useState<string>("");
    const [insertAfterItemId, setInsertAfterItemId] = useState<string | null>(null);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [copyLinkedTranslations, setCopyLinkedTranslations] = useState<boolean>(true);

    const targetTocItem = useMemo(
        () => tocItems.find((t) => t.id === targetTocId),
        [tocItems, targetTocId]
    );
    const targetBaseTree = useMemo(
        () => getBaseTranslationTree(targetTocItem),
        [targetTocItem]
    );

    // איפוס בכל פתיחה
    useEffect(() => {
        if (!open) return;
        setTargetTocId(currentTocId);
        setTargetPrayerId(currentPrayerId);
        setTargetPartId("");
        setInsertAfterItemId(null);
        setSelectedItemIds(new Set());
        setCopyLinkedTranslations(true);
    }, [open, currentTocId, currentPrayerId]);

    // טעינה אוטומטית של פריטי חלק היעד כשבוחרים נוסח+תפילה+חלק
    useEffect(() => {
        if (!open || !targetTocId || !targetPrayerId || !targetPartId) return;
        onLoadTargetPartItems({
            targetTocId,
            targetPrayerId,
            targetPartId,
        });
        setInsertAfterItemId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, targetTocId, targetPrayerId, targetPartId]);

    /** כשנבחר נוסח, אם התפילה הנוכחית לא קיימת בו – מאפסים תפילה/חלק */
    useEffect(() => {
        if (!targetTocId || !targetBaseTree) {
            setTargetPrayerId("");
            setTargetPartId("");
            return;
        }
        const prayerExists = (targetBaseTree.categories ?? []).some((cat: any) =>
            (cat.prayers ?? []).some((p: any) => p.id === targetPrayerId)
        );
        if (!prayerExists) {
            setTargetPrayerId("");
            setTargetPartId("");
        }
    }, [targetTocId, targetBaseTree, targetPrayerId]);

    /** כשנבחרת תפילה, אם החלק הנוכחי לא קיים בה – מאפסים חלק */
    useEffect(() => {
        if (!targetBaseTree || !targetPrayerId) return;
        let prayer: any = null;
        for (const cat of targetBaseTree.categories ?? []) {
            const found = (cat.prayers ?? []).find((p: any) => p.id === targetPrayerId);
            if (found) {
                prayer = found;
                break;
            }
        }
        if (!prayer) return;
        const partExists = (prayer.parts ?? []).some((pt: any) => pt.id === targetPartId);
        if (!partExists) setTargetPartId("");
    }, [targetBaseTree, targetPrayerId, targetPartId]);

    const availablePrayers: any[] = useMemo(() => {
        if (!targetBaseTree) return [];
        const out: any[] = [];
        for (const cat of targetBaseTree.categories ?? []) {
            for (const prayer of cat.prayers ?? []) {
                out.push({ ...prayer, categoryName: cat.name ?? "" });
            }
        }
        return out;
    }, [targetBaseTree]);

    const availableParts: any[] = useMemo(() => {
        if (!targetBaseTree || !targetPrayerId) return [];
        for (const cat of targetBaseTree.categories ?? []) {
            const prayer = (cat.prayers ?? []).find((p: any) => p.id === targetPrayerId);
            if (prayer) return prayer.parts ?? [];
        }
        return [];
    }, [targetBaseTree, targetPrayerId]);

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

    const sourceItemIds = Array.from(selectedItemIds);
    const canSubmit =
        !!targetTocId &&
        !!targetPrayerId &&
        !!targetPartId &&
        sourceItemIds.length > 0 &&
        !saving;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({
            sourceItemIds,
            targetTocId,
            targetPrayerId,
            targetPartId,
            insertAfterItemId,
            copyLinkedTranslations,
        });
    };

    const endSentinel =
        targetPartItems.length > 0
            ? (targetPartItems[targetPartItems.length - 1].values?.itemId ??
                  targetPartItems[targetPartItems.length - 1].id)
            : null;

    const targetNusachLabel = (tocId: string): string => {
        const toc = tocItems.find((t) => t.id === tocId);
        return getNusachDisplayLabel(tocId, toc?.values?.nusach);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[680px] max-h-[92vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-lg">📋 העתקת פריטים לחלק תפילה</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-base">
                    <div className="space-y-2 p-3 bg-blue-50/40 border border-blue-100 rounded">
                        <div className="text-sm font-bold text-blue-800 mb-1">יעד</div>

                        <label className="block">
                            <span className="text-sm font-semibold mb-0.5 block">נוסח יעד *</span>
                            <select
                                className="border rounded px-2 py-1 text-base w-full"
                                value={targetTocId}
                                onChange={(e) => setTargetTocId(e.target.value)}
                            >
                                {tocItems.map((toc) => (
                                    <option key={toc.id} value={toc.id}>
                                        {toc.id === currentTocId ? "(הנוכחי) " : ""}
                                        {targetNusachLabel(toc.id)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block">
                            <span className="text-sm font-semibold mb-0.5 block">תפילה יעד *</span>
                            {availablePrayers.length === 0 ? (
                                <div className="text-gray-400 text-sm border rounded px-2 py-1 bg-white">
                                    אין תפילות בנוסח זה
                                </div>
                            ) : (
                                <select
                                    className="border rounded px-2 py-1 text-base w-full"
                                    value={targetPrayerId}
                                    onChange={(e) => setTargetPrayerId(e.target.value)}
                                >
                                    <option value="">— בחר תפילה יעד —</option>
                                    {availablePrayers.map((p: any) => (
                                        <option key={p.id} value={p.id}>
                                            {p.id === currentPrayerId && targetTocId === currentTocId
                                                ? "(הנוכחית) "
                                                : ""}
                                            {p.name ?? p.id}
                                            {p.categoryName ? ` — ${p.categoryName}` : ""}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </label>

                        <label className="block">
                            <span className="text-sm font-semibold mb-0.5 block">חלק תפילה יעד *</span>
                            {!targetPrayerId ? (
                                <div className="text-gray-400 text-sm border rounded px-2 py-1 bg-white">
                                    יש לבחור תפילה תחילה
                                </div>
                            ) : availableParts.length === 0 ? (
                                <div className="text-gray-400 text-sm border rounded px-2 py-1 bg-white">
                                    אין חלקי תפילה בתפילה זו
                                </div>
                            ) : (
                                <select
                                    className="border rounded px-2 py-1 text-base w-full"
                                    value={targetPartId}
                                    onChange={(e) => setTargetPartId(e.target.value)}
                                >
                                    <option value="">— בחר חלק תפילה יעד —</option>
                                    {availableParts.map((p: any) => (
                                        <option key={p.id} value={p.id}>
                                            {p.id === currentPartId &&
                                            targetPrayerId === currentPrayerId &&
                                            targetTocId === currentTocId
                                                ? "(הנוכחי) "
                                                : ""}
                                            {p.id} – {p.nameHe ?? p.name ?? ""}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </label>

                        {targetPartId && (
                            <label className="block">
                                <span className="text-sm font-semibold mb-0.5 block">מיקום הכנסה בחלק יעד</span>
                                <select
                                    className="border rounded px-2 py-1 text-base w-full"
                                    value={insertAfterItemId ?? "__beginning__"}
                                    onChange={(e) =>
                                        setInsertAfterItemId(
                                            e.target.value === "__beginning__" || e.target.value === "__end__"
                                                ? e.target.value === "__end__"
                                                    ? endSentinel
                                                    : null
                                                : e.target.value
                                        )
                                    }
                                >
                                    <option value="__beginning__">בתחילת חלק התפילה</option>
                                    {targetPartItems.map((item) => {
                                        const vals = item.values ?? {};
                                        const iId = vals.itemId ?? item.id;
                                        const cnt = (vals.content ?? "") as string;
                                        return (
                                            <option key={item.id} value={iId}>
                                                אחרי {iId}: {cnt.slice(0, 30)}
                                                {cnt.length > 30 ? "…" : ""}
                                            </option>
                                        );
                                    })}
                                    <option value="__end__">בסוף חלק התפילה</option>
                                </select>
                            </label>
                        )}
                    </div>

                    <div className="p-3 bg-amber-50/40 border border-amber-100 rounded">
                        <label
                            className="flex items-start gap-2 cursor-pointer"
                            title="אם מסומן: גם פריטי התרגומים המקושרים (אנגלית, הרב זקס וכו') יועתקו לנוסח היעד"
                        >
                            <input
                                type="checkbox"
                                checked={copyLinkedTranslations}
                                onChange={(e) => setCopyLinkedTranslations(e.target.checked)}
                                className="mt-0.5 shrink-0"
                            />
                            <span className="flex-1 text-sm">
                                <span className="font-semibold text-gray-700">
                                    העתק גם את כל התרגומים המקושרים
                                </span>
                                <span className="block text-xs text-gray-500 mt-0.5">
                                    פריטים באנגלית, הרב זקס וכו' שמקושרים לפריטי המקור יועתקו גם לנוסח
                                    היעד (אם קיימים שם)
                                </span>
                            </span>
                        </label>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="text-sm font-bold text-gray-700">
                                בחר פריטים להעתקה (בחירה חופשית)
                            </div>
                            {items.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleAll}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    {selectedItemIds.size === items.length ? "בטל הכל" : "בחר הכל"}
                                </button>
                            )}
                        </div>
                        {items.length === 0 ? (
                            <div className="text-gray-400 text-sm">אין פריטים בחלק תפילה</div>
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
                                                    ? "bg-blue-50 hover:bg-blue-100"
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
                                                    <span className="text-sm text-gray-400 font-mono shrink-0">
                                                        {itemId}
                                                    </span>
                                                    <span
                                                        className={`text-sm px-1 rounded shrink-0 ${
                                                            type === "title"
                                                                ? "bg-purple-100 text-purple-700"
                                                                : type === "instructions"
                                                                  ? "bg-yellow-100 text-yellow-700"
                                                                  : "bg-gray-100 text-gray-500"
                                                        }`}
                                                    >
                                                        {type}
                                                    </span>
                                                    {checked && targetPartId && (
                                                        <span className="text-sm bg-blue-200 text-blue-800 px-1 rounded shrink-0">
                                                            📋 → {targetPartId}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className="text-sm text-gray-800 mt-0.5 max-h-16 overflow-y-auto whitespace-pre-wrap break-words"
                                                    dir="rtl"
                                                >
                                                    {content || (
                                                        <span className="text-gray-300 italic">(ריק)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        {selectedItemIds.size > 0 && (
                            <div className="mt-1.5 text-sm text-blue-700 font-medium">
                                {selectedItemIds.size} פריטים נבחרו להעתקה
                                {targetPartId && targetPrayerId
                                    ? ` → ${targetNusachLabel(targetTocId)}, תפילה ${targetPrayerId}, חלק ${targetPartId}`
                                    : ""}
                                {copyLinkedTranslations && (
                                    <span className="block text-xs text-blue-600">
                                        כולל תרגומים מקושרים בנוסח היעד
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 py-3 border-t bg-gray-50 flex justify-between items-center">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded border border-gray-300 text-base hover:bg-gray-100"
                    >
                        ביטול
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="px-5 py-2 bg-blue-600 text-white rounded font-bold text-base disabled:opacity-30 hover:bg-blue-700"
                    >
                        {saving
                            ? "מעתיק..."
                            : `📋 העתק ${sourceItemIds.length > 0 ? sourceItemIds.length + " פריטים" : ""}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
