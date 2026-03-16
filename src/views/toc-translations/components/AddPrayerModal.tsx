/**
 * AddPrayerModal – מודל הוספת תפילה חדשה
 *
 * מאפשר למשתמש להזין שם עברית + תרגום אנגלית (לתרגום 1-nusach)
 */

import React, { useEffect, useState } from "react";

export type AddPrayerModalProps = {
    open: boolean;
    onClose: () => void;
    onSubmit: (params: { nameHe: string; nameEn: string }) => void;
    saving: boolean;
};

export function AddPrayerModal({
    open,
    onClose,
    onSubmit,
    saving,
}: AddPrayerModalProps) {
    const [nameHe, setNameHe] = useState("");
    const [nameEn, setNameEn] = useState("");

    useEffect(() => {
        if (!open) return;
        setNameHe("");
        setNameEn("");
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
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[450px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-sm">הוספת תפילה חדשה</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-semibold mb-1">שם התפילה (עברית) *</label>
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
                        {saving ? "מוסיף..." : "הוסף תפילה"}
                    </button>
                </div>
            </div>
        </div>
    );
}
