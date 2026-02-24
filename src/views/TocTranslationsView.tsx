/**
 * =============================================================================
 * TocTranslationsView – מסך עריכת תרגומי TOC
 * =============================================================================
 *
 * המסך מחולק לשלוש עמודות:
 *   1. ניווט: נוסח (TOC) → תרגום → קטגוריה → תפילה → מקטע
 *   2. לאחר בחירת מקטע: אזור עריכה (פריטים + שמירה + פרסום)
 *
 * זרימת נתונים:
 *   - useTocNavigation: טוען רשימת נוסחים, שומר את הבחירות, ומחשב categories/prayers/parts
 *   - usePartEdit: טוען פריטי המקטע + תרגומים מקושרים, שומר שינויים, מפרסם ל-Bagel
 *   - הקומפוננטות מקבלות את כל הנתונים ב-props (controlled).
 */

import React from "react";
import { PrayerNavigationColumns } from "./toc-translations/components/PrayerNavigationColumns";
import { PartEditPanel } from "./toc-translations/components/PartEditPanel";
import { TocAndTranslationColumns } from "./toc-translations/components/TocAndTranslationColumns";
import { EditorGuideBanner } from "./toc-translations/components/EditorGuideBanner";
import { useTocNavigation } from "./toc-translations/hooks/useTocNavigation";
import { usePartEdit } from "./toc-translations/hooks/usePartEdit";
import { isBaseTranslation } from "./toc-translations/services/navigationService";

export function TocTranslationsView() {
    const nav = useTocNavigation();
    const allowAdditions = isBaseTranslation(nav.currentTranslationData?.translationId);
    const partEdit = usePartEdit({
        currentTocData: nav.currentTocData,
        currentTranslationData: nav.currentTranslationData,
        selectedPrayerId: nav.selectedPrayerId,
        selectedTocId: nav.selectedTocId,
    });

    const hasTranslationSelection =
        !!nav.selectedTocId && nav.selectedTranslationIndex != null;

    return (
        <div className="flex flex-col w-full h-full p-1 gap-1 bg-gray-200 overflow-hidden font-sans text-[10px]" dir="rtl">
            {nav.isSaving && (
                <div className="flex items-center justify-center gap-2 py-2 px-3 bg-blue-100 border border-blue-300 rounded text-blue-800 font-medium shrink-0" role="status" aria-live="polite">
                    <span className="inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                    <span>{nav.savingMessage ?? "שומר..."}</span>
                </div>
            )}
            <EditorGuideBanner
                translationId={nav.currentTranslationData?.translationId}
                hasSelection={hasTranslationSelection}
            />
            <div className="flex flex-1 min-h-0 gap-1">
            {/* עמודה 1–2: בחירת נוסח (TOC) ותרגום */}
            <TocAndTranslationColumns
                tocItems={nav.tocItems}
                selectedTocId={nav.selectedTocId}
                onSelectToc={nav.onSelectToc}
                onAddToc={nav.addToc}
                onDeleteToc={nav.deleteToc}
                translations={nav.currentTocData?.translations ?? []}
                selectedTranslationIndex={nav.selectedTranslationIndex}
                onSelectTranslation={nav.onSelectTranslation}
                onAddTranslation={nav.addTranslation}
                getSuggestedTranslationId={nav.getSuggestedTranslationId}
                onDeleteTranslation={nav.deleteTranslation}
                isSaving={nav.isSaving}
            />
            {/* עמודה 3–5: קטגוריה → תפילה → מקטע; בחירת מקטע טוענת את הפריטים */}
            <PrayerNavigationColumns
                currentCategories={nav.currentCategories}
                selectedCategoryName={nav.selectedCategoryName}
                onSelectCategory={nav.onSelectCategory}
                onAddCategory={nav.addCategory}
                onDeleteCategory={allowAdditions ? nav.deleteCategory : undefined}
                showAddCategory={!!nav.selectedTocId && nav.selectedTranslationIndex != null && allowAdditions}
                currentPrayers={nav.currentPrayers}
                selectedPrayerId={nav.selectedPrayerId}
                onSelectPrayer={nav.onSelectPrayer}
                onAddPrayer={nav.addPrayer}
                onDeletePrayer={allowAdditions ? nav.deletePrayer : undefined}
                showAddPrayer={
                    !!nav.selectedTocId &&
                    nav.selectedTranslationIndex != null &&
                    !!nav.selectedCategoryName &&
                    allowAdditions
                }
                currentParts={nav.currentParts}
                selectedGroupId={partEdit.selectedGroupId}
                onSelectPart={partEdit.fetchItemsWithEnhancements}
                isSaving={nav.isSaving}
            />
            {/* אזור העריכה: toolbar + רשימת פריטים (לאחר טעינה) */}
            <PartEditPanel
                selectedGroupId={partEdit.selectedGroupId}
                saving={partEdit.saving}
                changedIds={partEdit.changedIds}
                loading={partEdit.loading}
                allItems={partEdit.allItems}
                localValues={partEdit.localValues}
                enhancements={partEdit.enhancements}
                onSaveGroup={partEdit.handleSaveGroup}
                onFinalPublish={partEdit.handleFinalPublish}
                onContentChange={(id, value) =>
                    partEdit.updateLocalItem(id, "content", value)
                }
                onAddNewItemAt={partEdit.addNewItemAt}
                onDeleteItem={partEdit.handleDeleteItem}
                allowAddPart={allowAdditions}
            />
            </div>
        </div>
    );
}
