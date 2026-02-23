/**
 * TocAndTranslationColumns – עמודות ניווט 1 ו-2
 *
 * עמודה 1: רשימת נוסחים (TOC) – כפתור לכל toc.id
 * עמודה 2: רשימת תרגומים של הנוסח הנבחר – כפתור לפי index
 *
 * מקבל את הרשימות וה-handlers מה-parent (useTocNavigation).
 */

import React from "react";

type TocAndTranslationColumnsProps = {
    tocItems: any[];
    selectedTocId: string | null;
    onSelectToc: (tocId: string) => void;
    onAddToc?: (nusachName: string) => void;
    onDeleteToc?: (tocId: string) => void;
    translations: any[];
    selectedTranslationIndex: number | null;
    onSelectTranslation: (index: number) => void;
};

export function TocAndTranslationColumns({
    tocItems,
    selectedTocId,
    onSelectToc,
    onAddToc,
    onDeleteToc,
    translations,
    selectedTranslationIndex,
    onSelectTranslation
}: TocAndTranslationColumnsProps) {
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

    return (
        <>
            <div className="w-24 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">1. נוסח</h4>
                {tocItems.map((toc: any) => (
                    <div key={toc.id} className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => onSelectToc(toc.id)}
                            className={`flex-1 text-right p-1.5 rounded border ${selectedTocId === toc.id ? "bg-blue-600 text-white" : "bg-gray-50"}`}
                            title={toc.id}
                        >
                            {toc.values?.nusach ?? toc.id}
                        </button>
                        {onDeleteToc && (
                            <button
                                type="button"
                                onClick={(e) => handleDeleteToc(e, toc.id)}
                                className="shrink-0 p-1 rounded border border-red-200 text-red-600 hover:bg-red-50 text-[8px]"
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
                        className="mt-1 py-1.5 rounded border-2 border-dashed border-blue-200 text-blue-600 font-bold text-[9px] hover:bg-blue-50"
                    >
                        + הוסף נוסח
                    </button>
                )}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">2. תרגום</h4>
                {translations.map((translation: any, index: number) => (
                    <button
                        key={index}
                        onClick={() => onSelectTranslation(index)}
                        className={`text-right p-1.5 rounded border ${selectedTranslationIndex === index ? "bg-purple-600 text-white" : "bg-gray-50"}`}
                    >
                        {translation.translationId}
                    </button>
                ))}
            </div>
        </>
    );
}
