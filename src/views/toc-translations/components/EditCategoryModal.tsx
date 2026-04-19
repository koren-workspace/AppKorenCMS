/**
 * EditCategoryModal – מודל עריכת קטגוריה קיימת
 *
 * בבסיס (0-*): שם עברית + אנגלית (ל-1-nusach).
 * בתרגום (1-*, 2-*): שם בתרגום הנוכחי בלבד.
 */

import React, { useEffect, useState } from "react";

export type EditCategoryInitial =
    | { id: string; mode: "base"; nameHe: string; nameEn: string }
    | { id: string; mode: "translation"; name: string };

export type EditCategoryModalProps = {
    open: boolean;
    onClose: () => void;
    initialCategory: EditCategoryInitial | null;
    onSubmit: (params: { nameHe?: string; nameEn?: string; name?: string }) => void;
    saving: boolean;
};

export function EditCategoryModal({
    open,
    onClose,
    initialCategory,
    onSubmit,
    saving,
}: EditCategoryModalProps) {
    const [nameHe, setNameHe] = useState("");
    const [nameEn, setNameEn] = useState("");
    const [name, setName] = useState("");

    useEffect(() => {
        if (!open) return;
        if (initialCategory) {
            if (initialCategory.mode === "base") {
                setNameHe(initialCategory.nameHe);
                setNameEn(initialCategory.nameEn);
                setName("");
            } else {
                setName(initialCategory.name);
                setNameHe("");
                setNameEn("");
            }
        } else {
            setNameHe("");
            setNameEn("");
            setName("");
        }
    }, [open, initialCategory]);

    if (!open) return null;

    const isBase = initialCategory?.mode === "base";
    const canSubmit =
        initialCategory != null &&
        (isBase ? nameHe.trim() !== "" && nameEn.trim() !== "" : name.trim() !== "") &&
        !saving;

    const handleSubmit = () => {
        if (!canSubmit) return;
        if (isBase) {
            onSubmit({ nameHe: nameHe.trim(), nameEn: nameEn.trim() });
        } else {
            onSubmit({ name: name.trim() });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[450px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-lg">עריכת קטגוריה: {initialCategory?.id ?? ""}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-base">
                    {isBase ? (
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
                    ) : (
                        <div>
                            <label className="block text-sm font-semibold mb-1">שם הקטגוריה בתרגום זה *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="שם..."
                                className="w-full border rounded px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
                                dir="auto"
                            />
                        </div>
                    )}
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
                        {saving ? "שומר..." : "שמור שינויים"}
                    </button>
                </div>
            </div>
        </div>
    );
}
