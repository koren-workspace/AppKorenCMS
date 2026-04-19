/**
 * EditTocModal – מודל עריכת נוסח (TOC)
 *
 * מאפשר לשנות את שם התצוגה של הנוסח (nusach)
 */

import React, { useEffect, useState } from "react";

export type EditTocModalProps = {
    open: boolean;
    onClose: () => void;
    /** נוסח לעריכה – לאתחול הערכים */
    initialToc: { id: string; nusach: string } | null;
    onSubmit: (params: { nusach: string }) => void;
    saving: boolean;
};

export function EditTocModal({
    open,
    onClose,
    initialToc,
    onSubmit,
    saving,
}: EditTocModalProps) {
    const [nusach, setNusach] = useState("");

    useEffect(() => {
        if (!open) return;
        if (initialToc) {
            setNusach(initialToc.nusach ?? "");
        } else {
            setNusach("");
        }
    }, [open, initialToc]);

    if (!open) return null;

    const canSubmit =
        initialToc != null &&
        nusach.trim() !== "" &&
        !saving;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({ nusach: nusach.trim() });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
            <div className="bg-white rounded-lg shadow-xl w-[400px] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                    <h2 className="font-bold text-lg">עריכת נוסח: {initialToc?.id ?? ""}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 text-base">
                    <div>
                        <label className="block text-sm font-semibold mb-1">שם הנוסח *</label>
                        <input
                            type="text"
                            value={nusach}
                            onChange={(e) => setNusach(e.target.value)}
                            placeholder="שם הנוסח..."
                            className="w-full border rounded px-2 py-1.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-400"
                            dir="rtl"
                        />
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
                        {saving ? "שומר..." : "שמור שינויים"}
                    </button>
                </div>
            </div>
        </div>
    );
}
