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
import { DeleteTrashIcon } from "./DeleteTrashIcon";
import { TrashIcon } from "./TrashIcon";
import { getNusachPalette } from "../utils/nusachPalette";

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

    /** גובה אחיד לשורות ניווט: עמודת ✎/פח (~שני כפתורי 24px) + מגבלת שורות לטקסט */
    const navRowShell = "min-h-[3.5rem]";
    const navLabelBtn = "flex min-w-0 flex-1 items-center border-0 bg-transparent p-1.5 text-right shadow-none";
    const navLabelText = "block w-full min-w-0 text-right leading-snug line-clamp-2 break-words";

    return (
        <>
            <div className="w-36 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">1. נוסח</h4>
                {tocItems.map((toc: any) => {
                    const sel = selectedTocId === toc.id;
                    const tocLabel = getNusachDisplayLabel(toc.id, toc.values?.nusach);
                    const p = getNusachPalette(toc.id);
                    const c0 = p.selectedColors[0];
                    const dark0 = p.darkText[0];
                    const selText = dark0 ? "text-gray-900" : "text-white";
                    const selHover = dark0 ? "hover:bg-black/5" : "hover:bg-white/10";
                    return (
                        <div
                            key={toc.id}
                            className={`flex min-w-0 items-stretch overflow-hidden rounded border ${navRowShell} ${sel ? selText : "border-gray-200 bg-gray-50"}`}
                            style={sel ? { backgroundColor: c0, borderColor: c0 } : undefined}
                        >
                            <button
                                type="button"
                                onClick={() => onSelectToc(toc.id)}
                                disabled={isSaving}
                                className={`${navLabelBtn} ${sel ? `${selText} ${selHover}` : "text-gray-900 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
                                title={`${tocLabel} (${toc.id})`}
                            >
                                <span className={navLabelText}>{tocLabel}</span>
                            </button>
                            {(onEditToc || onDeleteToc) && (
                                <div
                                    className={`flex shrink-0 flex-col justify-center gap-px border-l p-px ${sel ? "border-white/30" : "border-gray-200"}`}
                                >
                                    {onEditToc && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onEditToc(toc.id); }}
                                            disabled={isSaving}
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border-0 text-xs leading-none ${sel ? `${selText} hover:bg-white/15` : "text-blue-600 hover:bg-blue-50"} ${isSaving ? savingClass : ""}`}
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
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border-0 text-xs leading-none ${sel ? "text-red-100 hover:bg-red-500/25" : "text-red-600 hover:bg-red-50"} ${isSaving ? savingClass : ""}`}
                                            title="מחק נוסח"
                                        >
                                            <DeleteTrashIcon />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
                {onAddToc && (
                    <button
                        type="button"
                        onClick={handleAddToc}
                        disabled={isSaving}
                        className={`mt-1 py-1 px-1 rounded border border-dashed font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : ""}`}
                        style={!isSaving ? { borderColor: getNusachPalette(selectedTocId).colors[0], color: getNusachPalette(selectedTocId).colors[0] } : undefined}
                    >
                        {isSaving ? "שומר…" : "+ הוסף נוסח"}
                    </button>
                )}
            </div>
            <div className="w-36 shrink-0 flex flex-col gap-1.5 bg-white p-1.5 border-l overflow-auto">
                <h4 className="font-bold text-gray-500 text-lg mb-2">2. תרגום/ פירוש</h4>
                {(() => {
                    const activePalette = getNusachPalette(selectedTocId);
                    const c1 = activePalette.selectedColors[1];
                    const dark1 = activePalette.darkText[1];
                    const selText1 = dark1 ? "text-gray-900" : "text-white";
                    const selHover1 = dark1 ? "hover:bg-black/5" : "hover:bg-white/10";
                    return translations.map((translation: any, index: number) => {
                        const sel = selectedTranslationIndex === index;
                        const trLabel = getTranslationDisplayLabel(translation.translationId, {
                            storedLabel: translation.label,
                        });
                        return (
                            <div
                                key={translation.translationId ?? index}
                                className={`flex min-w-0 items-stretch overflow-hidden rounded border ${navRowShell} ${sel ? selText1 : "border-gray-200 bg-gray-50"}`}
                                style={sel ? { backgroundColor: c1, borderColor: c1 } : undefined}
                            >
                                <button
                                    type="button"
                                    onClick={() => onSelectTranslation(index)}
                                    disabled={isSaving}
                                    title={`${trLabel} — ${translation.translationId}`}
                                    className={`${navLabelBtn} ${sel ? `${selText1} ${selHover1}` : "text-gray-900 hover:bg-gray-100"} ${isSaving ? savingClass : ""}`}
                                >
                                    <span className={navLabelText}>{trLabel}</span>
                                </button>
                                {onDeleteTranslation && (
                                    <div
                                        className={`flex shrink-0 flex-col justify-center border-l p-px ${sel ? "border-white/30" : "border-gray-200"}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteTranslation(e, translation.translationId)}
                                            disabled={isSaving}
                                            className={`inline-flex h-6 w-6 items-center justify-center rounded border-0 text-xs leading-none ${sel ? "text-red-100 hover:bg-red-500/25" : "text-red-600 hover:bg-red-50"} ${isSaving ? savingClass : ""}`}
                                        title="מחק תרגום"
                                    >
                                        <DeleteTrashIcon />
                                    </button>
                                    </div>
                                )}
                            </div>
                        );
                    });
                })()}
                {selectedTocId && onAddTranslation && getSuggestedTranslationId && (
                    <button
                        type="button"
                        onClick={handleAddTranslation}
                        disabled={isSaving}
                        className={`mt-1 py-1 px-1 rounded border border-dashed font-medium text-sm leading-tight ${isSaving ? "border-gray-300 text-gray-400 " + savingClass : ""}`}
                        style={!isSaving ? { borderColor: getNusachPalette(selectedTocId).colors[1], color: getNusachPalette(selectedTocId).colors[1] } : undefined}

                    >
                        {isSaving ? "שומר…" : "+ הוסף תרגום"}
                    </button>
                )}
            </div>
        </>
    );
}
