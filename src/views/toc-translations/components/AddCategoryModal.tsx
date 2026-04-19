/**
 * AddCategoryModal – מודל הוספת קטגוריה חדשה
 *
 * מאפשר למשתמש להזין שם עברית + תרגום אנגלית (לתרגום 1-nusach)
 */

import React, { useEffect, useState } from "react";
import { INSERT_AT_START } from "../utils/insertPosition";

export type AddCategoryModalProps = {
    open: boolean;
    onClose: () => void;
    existingCategories: Array<{ id: string; name: string }>;
    initialAfterId?: string | null;
    onSubmit: (params: { nameHe: string; nameEn: string; afterCategoryId: string | null }) => void;
    saving: boolean;
};

export function AddCategoryModal({
    open,
    onClose,
    existingCategories,
    initialAfterId = null,
    onSubmit,
    saving,
}: AddCategoryModalProps) {
    const [nameHe, setNameHe] = useState("");
    const [nameEn, setNameEn] = useState("");
    const [afterCategoryId, setAfterCategoryId] = useState<string | null>(initialAfterId);

    useEffect(() => {
        if (!open) return;
        setNameHe("");
        setNameEn("");
        setAfterCategoryId(initialAfterId);
    }, [open, initialAfterId]);

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
            afterCategoryId,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[450px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-lg">הוספת קטגוריה חדשה</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-base">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold mb-1">שם הקטגוריה (עברית) *</label>
                            <input
                                type="text"
                                value={nameHe}
                                onChange={(e) => setNameHe(e.target.value)}
                                placeholder="שם עברי..."
                                className="w-full border rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
                                dir="rtl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">English name (for 1-nusach) *</label>
                            <input
                                type="text"
                                value={nameEn}
                                onChange={(e) => setNameEn(e.target.value)}
                                placeholder="English name..."
                                className="w-full border rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
                                dir="ltr"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1">מיקום ההוספה</label>
                        <select
                            value={afterCategoryId ?? ""}
                            onChange={(e) => setAfterCategoryId(e.target.value || null)}
                            className="w-full border rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                            <option value={INSERT_AT_START}>בתחילת הרשימה</option>
                            <option value="">בסוף הרשימה</option>
                            {existingCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    אחרי {category.name}
                                </option>
                            ))}
                        </select>
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
                        {saving ? "מוסיף..." : "הוסף קטגוריה"}
                    </button>
                </div>
            </div>
        </div>
    );
}
