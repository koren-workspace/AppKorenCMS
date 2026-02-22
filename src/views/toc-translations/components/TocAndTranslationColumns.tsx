import React from "react";

type TocAndTranslationColumnsProps = {
    tocItems: any[];
    selectedTocId: string | null;
    onSelectToc: (tocId: string) => void;
    translations: any[];
    selectedTranslationIndex: number | null;
    onSelectTranslation: (index: number) => void;
};

export function TocAndTranslationColumns({
    tocItems,
    selectedTocId,
    onSelectToc,
    translations,
    selectedTranslationIndex,
    onSelectTranslation
}: TocAndTranslationColumnsProps) {
    return (
        <>
            <div className="w-24 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">1. נוסח</h4>
                {tocItems.map((toc: any) => (
                    <button
                        key={toc.id}
                        onClick={() => onSelectToc(toc.id)}
                        className={`text-right p-1.5 rounded border ${selectedTocId === toc.id ? "bg-blue-600 text-white" : "bg-gray-50"}`}
                    >
                        {toc.id}
                    </button>
                ))}
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
