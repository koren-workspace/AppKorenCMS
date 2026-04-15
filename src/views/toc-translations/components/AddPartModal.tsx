/**
 * AddPartModal – מודל הוספת מקטע חדש
 *
 * מאפשר למשתמש להגדיר את כל המאפיינים כמו בפיצול מקטע:
 *   - שם עברית + אנגלית
 *   - dateSetIds / hazan / minyan (תנאי תצוגה)
 */

import React, { useEffect, useState } from "react";

export type AddPartModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (params: {
        nameHe: string;
        nameEn: string;
        dateSetIds: string[];
        hazan: boolean | null;
        minyan: boolean | null;
    }) => void;
    saving: boolean;
};

export function AddPartModal({
    open,
    onClose,
    onSubmit,
    saving,
}: AddPartModalProps) {
    const [nameHe, setNameHe] = useState("");
    const [nameEn, setNameEn] = useState("");
    const [dateSetIds, setDateSetIds] = useState<string[]>(["100"]);
    const [hazan, setHazan] = useState<boolean | null>(null);
    const [minyan, setMinyan] = useState<boolean | null>(null);

    useEffect(() => {
        if (!open) return;
        setNameHe("");
        setNameEn("");
        setDateSetIds(["100"]);
        setHazan(null);
        setMinyan(null);
    }, [open]);

    if (!open) return null;

    const canSubmit =
        nameHe.trim() !== "" &&
        nameEn.trim() !== "" &&
        !saving;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({
            nameHe: nameHe.trim(),
            nameEn: nameEn.trim(),
            dateSetIds,
            hazan,
            minyan,
        });
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
            <div className="bg-white rounded-lg shadow-xl w-[500px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-sm">הוספת מקטע חדש</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold mb-1">שם המקטע (עברית) *</label>
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

                    <div className="border rounded p-3 space-y-2">
                        <div className="text-[10px] font-semibold text-gray-600">תנאי תצוגה</div>
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
                </div>

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
                        {saving ? "מוסיף..." : "הוסף מקטע"}
                    </button>
                </div>
            </div>
        </div>
    );
}
