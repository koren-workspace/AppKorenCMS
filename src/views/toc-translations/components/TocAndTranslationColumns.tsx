/**
 * TocAndTranslationColumns – עמודות ניווט 1 ו-2
 *
 * עמודה 1: רשימת נוסחים (TOC) – כפתור לכל toc.id
 * עמודה 2: רשימת תרגומים של הנוסח הנבחר – כפתור לפי index
 *
 * מקבל את הרשימות וה-handlers מה-parent (useTocNavigation).
 */

import React from "react";
import { getNusachDisplayLabel } from "../utils/nusachDisplay";
import { getTranslationDisplayLabel } from "../utils/translationDisplayLabels";

type TocAndTranslationColumnsProps = {
    tocItems: any[];
    selectedTocId: string | null;
    onSelectToc: (tocId: string) => void;
    onAddToc?: (nusachName: string) => void;
    onEditToc?: (tocId: string) => void;
    onDeleteToc?: (tocId: string) => void;
    translations: any[];
    selectedTranslationIndex: number | null;
    onSelectTranslation: (index: number) => void;
    onAddTranslation?: (translationId: string) => void;
    getSuggestedTranslationId?: () => string;
    onDeleteTranslation?: (translationId: string) => void;
    /** במהלך שמירה – כפתורי הפעולה מושבתים ומציגים מצב טעינה */
    isSaving?: boolean;
};

export function TocAndTranslationColumns({
    tocItems,
    selectedTocId,
    onSelectToc,
    onAddToc,
    onEditToc,
    onDeleteToc,
    translations,
    selectedTranslationIndex,
    onSelectTranslation,
    onAddTranslation,
    getSuggestedTranslationId,
    onDeleteTranslation,
    isSaving = false,
}: TocAndTranslationColumnsProps) {
    const savingClass = "opacity-60 cursor-not-allowed pointer-events-none";
    const handleDeleteToc = (e: React.MouseEvent, tocId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את הנוסח? (רק הרשומה ב-TOC, לא התרגומים)")) {
            onDeleteToc?.(tocId);
        }
    };

    const handleAddToc = () => {
        const name = window.prompt("הזן שם לנוסח:");
        if (name?.trim()) onAddToc?.(name.trim());
    };

    const handleAddTranslation = () => {
        const suggested = getSuggestedTranslationId?.() ?? "";
        const raw = window.prompt(
            "מזהה התרגום מתחיל בנוסח הנבחר. הזן מזהה (או השאר למוצע):",
            suggested
        );
        if (raw === null) return;
        const id = raw?.trim() || suggested;
        if (id) onAddTranslation?.(id);
    };

    const handleDeleteTranslation = (e: React.MouseEvent, translationId: string) => {
        e.stopPropagation();
        if (window.confirm("למחוק את התרגום?")) {
            onDeleteTranslation?.(translationId);
        }
    };

    return (
        <>
            <div className="w-36 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">1. נוסח</h4>
                {tocItems.map((toc: any) => (
                    <div key={toc.id} className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => onSelectToc(toc.id)}
                            disabled={isSaving}
                            className={`flex-1 text-right p-1.5 rounded border ${selectedTocId === toc.id ? "bg-blue-600 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
                            title={toc.id}
                        >
                            {getNusachDisplayLabel(toc.id, toc.values?.nusach)}
                        </button>
                        {onEditToc && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEditToc(toc.id); }}
                                disabled={isSaving}
                                className={`shrink-0 p-1 rounded border border-blue-200 text-blue-600 text-sm ${isSaving ? savingClass : "hover:bg-blue-50"}`}
                                title="ערוך נוסח"
                            >
                                ✎
                            </button>
                        )}
                        {onDeleteToc && (
                            <button
                                type="button"
                                onClick={(e) => handleDeleteToc(e, toc.id)}
                                disabled={isSaving}
                                className={`shrink-0 p-1 rounded border border-red-200 text-red-600 text-sm ${isSaving ? savingClass : "hover:bg-red-50"}`}
                                title="מחק נוסח"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
                {onAddToc && (
                    <button
                        type="button"
                        onClick={handleAddToc}
                        disabled={isSaving}
                        className={`mt-1 py-1 px-1 rounded border border-dashed border-blue-200 font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "text-blue-600 hover:bg-blue-50"}`}
                    >
                        {isSaving ? "שומר…" : "+ הוסף נוסח"}
                    </button>
                )}
            </div>
            <div className="w-36 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">2. תרגום/ פירוש</h4>
                {translations.map((translation: any, index: number) => (
                    <div key={translation.translationId ?? index} className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => onSelectTranslation(index)}
                            disabled={isSaving}
                            title={translation.translationId}
                            className={`flex-1 text-right p-1.5 rounded border ${selectedTranslationIndex === index ? "bg-purple-600 text-white" : "bg-gray-50"} ${isSaving ? savingClass : ""}`}
                        >
                            {getTranslationDisplayLabel(translation.translationId, {
                                storedLabel: translation.label,
                            })}
                        </button>
                        {onDeleteTranslation && (
                            <button
                                type="button"
                                onClick={(e) => handleDeleteTranslation(e, translation.translationId)}
                                disabled={isSaving}
                                className={`shrink-0 p-1 rounded border border-red-200 text-red-600 text-sm ${isSaving ? savingClass : "hover:bg-red-50"}`}
                                title="מחק תרגום"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
                {selectedTocId && onAddTranslation && getSuggestedTranslationId && (
                    <button
                        type="button"
                        onClick={handleAddTranslation}
                        disabled={isSaving}
                        className={`mt-1 py-1 px-1 rounded border border-dashed border-purple-200 font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : "text-purple-600 hover:bg-purple-50"}`}
                    >
                        {isSaving ? "שומר…" : "+ הוסף תרגום"}
                    </button>
                )}
            </div>
        </>
    );
}
