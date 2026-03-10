/**
 * SplitPartModal – מודל פיצול מקטע
 *
 * תהליך:
 *  1. המשתמש מזין שם עברי + אנגלי למקטע החדש
 *  2. בוחר dateSetIds / hazan / minyan (ממולאים מהמקטע הנוכחי)
 *  3. בוחר מיקום המקטע החדש: אחרי הנוכחי / לפני הנוכחי
 *  4. בוחר פריט חתך ברשימת הפריטים (radio button)
 *     – הפריטים הנבחרים מסומנים בצבע שונה לפי הכלל:
 *       "אחרי" → מהחתך עד הסוף עוברים; "לפני" → מהתחלה עד החתך עוברים.
 */

import React, { useEffect, useState } from "react";
import { Entity } from "@firecms/cloud";

export type SplitPartModalProps = {
    open: boolean;
    onClose: () => void;
    /** פריטי המקטע הנוכחי (ממוינים לפי mit_id) */
    items: Entity<any>[];
    /** ערכים מקומיים (לתצוגת content) */
    localValues: Record<string, any>;
    /** מקטע נוכחי – לאתחול dateSetIds / hazan / minyan */
    currentPart: { id: string; name: string; dateSetIds?: string[]; hazan?: boolean | null; minyan?: boolean | null } | null;
    onSubmit: (params: {
        splitAtItemId: string;
        newPartNameHe: string;
        newPartNameEn: string;
        newPartDateSetIds: string[];
        newPartHazan: boolean | null;
        newPartMinyan: boolean | null;
        insertBefore: boolean;
    }) => void;
    saving: boolean;
};

export function SplitPartModal({
    open,
    onClose,
    items,
    localValues,
    currentPart,
    onSubmit,
    saving,
}: SplitPartModalProps) {
    const [nameHe, setNameHe] = useState("");
    const [nameEn, setNameEn] = useState("");
    const [dateSetIds, setDateSetIds] = useState<string[]>(["100"]);
    const [hazan, setHazan] = useState<boolean | null>(null);
    const [minyan, setMinyan] = useState<boolean | null>(null);
    const [insertBefore, setInsertBefore] = useState(false);
    const [splitAtItemId, setSplitAtItemId] = useState<string | null>(null);

    // אתחול ערכי dateSetIds / hazan / minyan מהמקטע הנוכחי בכל פתיחה
    useEffect(() => {
        if (!open) return;
        setNameHe("");
        setNameEn("");
        setDateSetIds(currentPart?.dateSetIds?.length ? currentPart.dateSetIds : ["100"]);
        setHazan(currentPart?.hazan ?? null);
        setMinyan(currentPart?.minyan ?? null);
        setInsertBefore(false);
        setSplitAtItemId(null);
    }, [open, currentPart]);

    if (!open) return null;

    const canSubmit =
        nameHe.trim() !== "" &&
        nameEn.trim() !== "" &&
        splitAtItemId !== null &&
        !saving;

    // חישוב אילו פריטים יעברו
    const splitIdx = splitAtItemId
        ? items.findIndex((e) => (localValues[e.id]?.itemId ?? e.values?.itemId) === splitAtItemId)
        : -1;

    const isMoving = (i: number): boolean => {
        if (splitIdx < 0) return false;
        return insertBefore ? i <= splitIdx : i >= splitIdx;
    };

    const handleSubmit = () => {
        if (!canSubmit || !splitAtItemId) return;
        onSubmit({
            splitAtItemId,
            newPartNameHe: nameHe.trim(),
            newPartNameEn: nameEn.trim(),
            newPartDateSetIds: dateSetIds,
            newPartHazan: hazan,
            newPartMinyan: minyan,
            insertBefore,
        });
    };

    const toggleDateSetId = (id: string) => {
        setDateSetIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const triState = (value: boolean | null, onChange: (v: boolean | null) => void) => (
        <select
            className="border rounded px-1 py-0.5 text-[10px]"
            value={value === null ? "null" : String(value)}
            onChange={(e) => onChange(e.target.value === "null" ? null : e.target.value === "true")}
        >
            <option value="null">לא מוגדר</option>
            <option value="true">כן</option>
            <option value="false">לא</option>
        </select>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col overflow-hidden">
                {/* כותרת */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-sm">פיצול מקטע: {currentPart?.id}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* שמות */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold mb-1">שם המקטע החדש (עברית) *</label>
                            <input
                                type="text"
                                value={nameHe}
                                onChange={(e) => setNameHe(e.target.value)}
                                placeholder="שם עברי..."
                                className="w-full border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold mb-1">English name (for 1-nusach) *</label>
                            <input
                                type="text"
                                value={nameEn}
                                onChange={(e) => setNameEn(e.target.value)}
                                placeholder="English name..."
                                className="w-full border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    {/* תנאי תצוגה */}
                    <div className="border rounded p-3 space-y-2">
                        <div className="text-[10px] font-semibold text-gray-600">תנאי תצוגה (ממוקם מהמקטע הנוכחי)</div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px]">dateSetIds:</span>
                                <input
                                    type="text"
                                    value={dateSetIds.join(",")}
                                    onChange={(e) =>
                                        setDateSetIds(
                                            e.target.value
                                                .split(",")
                                                .map((s) => s.trim())
                                                .filter(Boolean)
                                        )
                                    }
                                    className="border rounded px-1 py-0.5 text-[10px] w-24"
                                    placeholder="100"
                                />
                                <span className="text-[9px] text-gray-400">(מופרד בפסיקים)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px]">חזן:</span>
                                {triState(hazan, setHazan)}
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px]">מניין:</span>
                                {triState(minyan, setMinyan)}
                            </div>
                        </div>
                    </div>

                    {/* מיקום המקטע החדש */}
                    <div className="flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="insertPos"
                                checked={!insertBefore}
                                onChange={() => setInsertBefore(false)}
                            />
                            <span className="text-[11px]">המקטע החדש <strong>אחרי</strong> הנוכחי</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="radio"
                                name="insertPos"
                                checked={insertBefore}
                                onChange={() => setInsertBefore(true)}
                            />
                            <span className="text-[11px]">המקטע החדש <strong>לפני</strong> הנוכחי</span>
                        </label>
                    </div>

                    {/* בחירת פריט חתך */}
                    <div>
                        <div className="text-[10px] font-semibold text-gray-700 mb-1.5">
                            {insertBefore
                                ? "בחר פריט חתך — מהתחלה עד פריט זה (כולל) יעברו למקטע החדש:"
                                : "בחר פריט חתך — מפריט זה עד הסוף יעברו למקטע החדש:"}
                        </div>
                        {items.length === 0 && (
                            <div className="text-gray-400 text-[10px]">אין פריטים במקטע</div>
                        )}
                        <div className="border rounded overflow-hidden divide-y max-h-64 overflow-y-auto">
                            {items.map((item, i) => {
                                const vals = localValues[item.id] ?? item.values ?? {};
                                const itemId: string = vals.itemId ?? item.id;
                                const content: string = vals.content ?? "";
                                const type: string = vals.type ?? "";
                                const moving = isMoving(i);
                                const isSelected = splitAtItemId === itemId;

                                return (
                                    <label
                                        key={item.id}
                                        className={`flex items-start gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                                            moving
                                                ? "bg-blue-50 hover:bg-blue-100"
                                                : "bg-white hover:bg-gray-50"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="splitAtItem"
                                            checked={isSelected}
                                            onChange={() => setSplitAtItemId(itemId)}
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
                                                {moving && (
                                                    <span className="text-[9px] bg-blue-200 text-blue-700 px-1 rounded shrink-0">
                                                        → מקטע חדש
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
                        {splitAtItemId && (
                            <div className="mt-1 text-[10px] text-blue-700 font-medium">
                                {insertBefore
                                    ? `${items.slice(0, splitIdx + 1).length} פריטים יעברו למקטע החדש, ${items.slice(splitIdx + 1).length} יישארו`
                                    : `${items.slice(splitIdx).length} פריטים יעברו למקטע החדש, ${items.slice(0, splitIdx).length} יישארו`}
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
                        className="px-5 py-1.5 bg-blue-600 text-white rounded font-bold text-sm disabled:opacity-30 hover:bg-blue-700"
                    >
                        {saving ? "מפצל..." : "פצל מקטע"}
                    </button>
                </div>
            </div>
        </div>
    );
}
