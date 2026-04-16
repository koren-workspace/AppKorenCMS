/**
 * EditPartModal – מודל עריכת חלק תפילה קיים
 *
 * בבסיס (0-*): שם עברית + אנגלית, dateSetIds, hazan, minyan.
 * בתרגום (1-*, 2-*): שם בתרגום הנוכחי בלבד.
 */

import React, { useEffect, useState } from "react";

export type EditPartInitial =
    | {
          id: string;
          mode: "base";
          nameHe: string;
          nameEn: string;
          dateSetIds: string[];
          hazan: boolean | null;
          minyan: boolean | null;
      }
    | { id: string; mode: "translation"; name: string };

export type EditPartModalProps = {
    open: boolean;
    onClose: () => void;
    initialPart: EditPartInitial | null;
    onSubmit: (params: {
        nameHe?: string;
        nameEn?: string;
        name?: string;
        dateSetIds?: string[];
        hazan?: boolean | null;
        minyan?: boolean | null;
    }) => void;
    saving: boolean;
};

export function EditPartModal({
    open,
    onClose,
    initialPart,
    onSubmit,
    saving,
}: EditPartModalProps) {
    const [nameHe, setNameHe] = useState("");
    const [nameEn, setNameEn] = useState("");
    const [name, setName] = useState("");
    const [dateSetIds, setDateSetIds] = useState<string[]>(["100"]);
    const [hazan, setHazan] = useState<boolean | null>(null);
    const [minyan, setMinyan] = useState<boolean | null>(null);

    useEffect(() => {
        if (!open) return;
        if (initialPart) {
            if (initialPart.mode === "base") {
                setNameHe(initialPart.nameHe);
                setNameEn(initialPart.nameEn);
                setDateSetIds(initialPart.dateSetIds?.length ? initialPart.dateSetIds : ["100"]);
                setHazan(initialPart.hazan ?? null);
                setMinyan(initialPart.minyan ?? null);
                setName("");
            } else {
                setName(initialPart.name);
                setNameHe("");
                setNameEn("");
                setDateSetIds(["100"]);
                setHazan(null);
                setMinyan(null);
            }
        } else {
            setNameHe("");
            setNameEn("");
            setName("");
            setDateSetIds(["100"]);
            setHazan(null);
            setMinyan(null);
        }
    }, [open, initialPart]);

    if (!open) return null;

    const isBase = initialPart?.mode === "base";
    const canSubmit =
        initialPart != null &&
        (isBase ? nameHe.trim() !== "" && nameEn.trim() !== "" : name.trim() !== "") &&
        !saving;

    const handleSubmit = () => {
        if (!canSubmit) return;
        if (isBase) {
            onSubmit({
                nameHe: nameHe.trim(),
                nameEn: nameEn.trim(),
                dateSetIds,
                hazan,
                minyan,
            });
        } else {
            onSubmit({ name: name.trim() });
        }
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
                    <h2 className="font-bold text-sm">עריכת חלק תפילה: {initialPart?.id ?? ""}</h2>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isBase ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold mb-1">שם חלק התפילה (עברית) *</label>
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
                        </>
                    ) : (
                        <div>
                            <label className="block text-[10px] font-semibold mb-1">שם החלק תפילה בתרגום זה *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="שם..."
                                className="w-full border rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                                dir="auto"
                            />
                        </div>
                    )}
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
                        {saving ? "שומר..." : "שמור שינויים"}
                    </button>
                </div>
            </div>
        </div>
    );
}
