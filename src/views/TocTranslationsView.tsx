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
import { useTocNavigation } from "./toc-translations/hooks/useTocNavigation";
import { usePartEdit } from "./toc-translations/hooks/usePartEdit";

export function TocTranslationsView() {
    const nav = useTocNavigation();
    const partEdit = usePartEdit({
        currentTocData: nav.currentTocData,
        currentTranslationData: nav.currentTranslationData,
        selectedPrayerId: nav.selectedPrayerId,
        selectedTocId: nav.selectedTocId,
    });

    return (
        <div className="flex w-full h-full p-1 gap-1 bg-gray-200 overflow-hidden font-sans text-[10px]" dir="rtl">
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
            />
            {/* עמודה 3–5: קטגוריה → תפילה → מקטע; בחירת מקטע טוענת את הפריטים */}
            <PrayerNavigationColumns
                currentCategories={nav.currentCategories}
                selectedCategoryName={nav.selectedCategoryName}
                onSelectCategory={nav.onSelectCategory}
                currentPrayers={nav.currentPrayers}
                selectedPrayerId={nav.selectedPrayerId}
                onSelectPrayer={nav.onSelectPrayer}
                currentParts={nav.currentParts}
                selectedGroupId={partEdit.selectedGroupId}
                onSelectPart={partEdit.fetchItemsWithEnhancements}
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
            />
        </div>
    );
}
