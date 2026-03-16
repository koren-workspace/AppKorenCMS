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

import React, { useState } from "react";
import { PrayerNavigationColumns } from "./toc-translations/components/PrayerNavigationColumns";
import { PartEditPanel } from "./toc-translations/components/PartEditPanel";
import { AddTranslationModal } from "./toc-translations/components/AddTranslationModal";
import { DateSetIdConfigModal } from "./toc-translations/components/DateSetIdConfigModal";
import { AddItemModal } from "./toc-translations/components/AddItemModal";
import { AddPartModal } from "./toc-translations/components/AddPartModal";
import { AddPrayerModal } from "./toc-translations/components/AddPrayerModal";
import { SplitPartModal } from "./toc-translations/components/SplitPartModal";
import { MoveToPartModal } from "./toc-translations/components/MoveToPartModal";
import { TocAndTranslationColumns } from "./toc-translations/components/TocAndTranslationColumns";
import { EditorGuideBanner } from "./toc-translations/components/EditorGuideBanner";
import { useTocNavigation } from "./toc-translations/hooks/useTocNavigation";
import { usePartEdit } from "./toc-translations/hooks/usePartEdit";
import { isBaseTranslation } from "./toc-translations/services/navigationService";

export function TocTranslationsView() {
    const nav = useTocNavigation();
    const isBase = isBaseTranslation(nav.currentTranslationData?.translationId);

    const [addPartModalOpen, setAddPartModalOpen] = useState(false);
    const [addPartAfterPartId, setAddPartAfterPartId] = useState<string | null>(null);
    const [addPrayerModalOpen, setAddPrayerModalOpen] = useState(false);
    const [addPrayerAfterPrayerId, setAddPrayerAfterPrayerId] = useState<string | null>(null);

    const openAddPartModal = (afterPartId: string | null) => {
        setAddPartAfterPartId(afterPartId);
        setAddPartModalOpen(true);
    };

    const handleAddPartSubmit = async (params: {
        nameHe: string;
        nameEn: string;
        dateSetIds: string[];
        hazan: boolean | null;
        minyan: boolean | null;
    }) => {
        const tocId = nav.selectedTocId;
        if (!tocId) return;
        const dateSetIds = params.dateSetIds.length ? params.dateSetIds : ["100"];
        const result = await nav.addPart(params.nameHe, addPartAfterPartId, {
            nameEn: params.nameEn,
            tocId,
            dateSetIds,
            hazan: params.hazan,
            minyan: params.minyan,
        });
        if (result !== null) setAddPartModalOpen(false);
    };

    const openAddPrayerModal = (afterPrayerId: string | null) => {
        setAddPrayerAfterPrayerId(afterPrayerId);
        setAddPrayerModalOpen(true);
    };

    const handleAddPrayerSubmit = async (params: { nameHe: string; nameEn: string }) => {
        await nav.addPrayer(params.nameHe, addPrayerAfterPrayerId, {
            nameEn: params.nameEn,
            tocId: nav.selectedTocId ?? undefined,
        });
        setAddPrayerModalOpen(false);
    };
    /** בסיס: מותר להוסיף מקטעים בלבד (ללא הבחנה בין מקטע להוראה). תרגום: מותר להוסיף רק הוראות */
    const allowAddPart = isBase;
    const allowAddInstruction = !isBase;
    const partEdit = usePartEdit({
        currentTocData: nav.currentTocData,
        currentTranslationData: nav.currentTranslationData,
        selectedPrayerId: nav.selectedPrayerId,
        selectedTocId: nav.selectedTocId,
        currentParts: nav.currentParts,
        addPart: nav.addPart,
    });

    const hasUnsaved = partEdit.changedIds.size > 0 || partEdit.enhancementChangedIds.size > 0 || partEdit.pendingDeletes.length > 0;

    /** עוטף פונקציית ניווט – שואל לאישור אם יש שינויים לא שמורים */
    function withUnsavedCheck<T extends unknown[]>(fn: (...args: T) => void) {
        return (...args: T) => {
            if (
                hasUnsaved &&
                !window.confirm("יש שינויים שלא נשמרו. לעבור בכל זאת?\n(השינויים יאבדו)")
            )
                return;
            fn(...args);
        };
    }

    const hasTranslationSelection =
        !!nav.selectedTocId && nav.selectedTranslationIndex != null;

    /** כל הפריטים שמקושרים לפריט הבסיס – מכל התרגומים (להצגה במודל הוספת תרגום) */
    const addTranslationExistingLinked = (() => {
        const item = partEdit.addTranslationBaseItem;
        if (!item || !partEdit.enhancements) return [];
        const baseItemId = partEdit.localValues[item.id]?.itemId ?? item.values?.itemId;
        if (!baseItemId) return [];
        const out: { id: string; tId: string; values: any }[] = [];
        Object.entries(partEdit.enhancements).forEach(([tId, list]) => {
            list.forEach((e: any) => {
                const link = e.values?.linkedItem;
                const linked = Array.isArray(link) ? link.includes(baseItemId) : link === baseItemId;
                if (linked) out.push({ id: e.id, tId, values: e.values });
            });
        });
        return out;
    })();

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
                onSelectToc={withUnsavedCheck(nav.onSelectToc)}
                onAddToc={nav.addToc}
                onDeleteToc={nav.deleteToc}
                translations={nav.currentTocData?.translations ?? []}
                selectedTranslationIndex={nav.selectedTranslationIndex}
                onSelectTranslation={withUnsavedCheck(nav.onSelectTranslation)}
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
                onDeleteCategory={allowAddPart ? nav.deleteCategory : undefined}
                showAddCategory={!!nav.selectedTocId && nav.selectedTranslationIndex != null && allowAddPart}
                currentPrayers={nav.currentPrayers}
                selectedPrayerId={nav.selectedPrayerId}
                onSelectPrayer={withUnsavedCheck(nav.onSelectPrayer)}
                onAddPrayerClick={openAddPrayerModal}
                onDeletePrayer={allowAddPart ? nav.deletePrayer : undefined}
                showAddPrayer={
                    !!nav.selectedTocId &&
                    nav.selectedTranslationIndex != null &&
                    !!nav.selectedCategoryName &&
                    allowAddPart
                }
                currentParts={nav.currentParts}
                selectedGroupId={partEdit.selectedGroupId}
                onSelectPart={withUnsavedCheck(partEdit.fetchItemsWithEnhancements)}
                onAddPartClick={openAddPartModal}
                onDeletePart={allowAddPart ? nav.deletePart : undefined}
                onReorderParts={allowAddPart ? nav.reorderParts : undefined}
                showAddPart={
                    !!nav.selectedTocId &&
                    nav.selectedTranslationIndex != null &&
                    !!nav.selectedPrayerId &&
                    allowAddPart
                }
                isSaving={nav.isSaving}
            />
            {/* אזור העריכה: toolbar + רשימת פריטים (לאחר טעינה) */}
            <PartEditPanel
                selectedGroupId={partEdit.selectedGroupId}
                saving={partEdit.saving}
                changedIds={partEdit.changedIds}
                pendingDeletesCount={partEdit.pendingDeletes.length}
                loading={partEdit.loading}
                allItems={partEdit.allItems}
                localValues={partEdit.localValues}
                enhancements={partEdit.enhancements}
                onSaveGroup={partEdit.handleSaveGroup}
                onFinalPublish={partEdit.handleFinalPublish}
                onContentChange={(id, value) =>
                    partEdit.updateLocalItem(id, "content", value)
                }
                onFieldChange={(id, field, value) =>
                    partEdit.updateLocalItem(id, field, value)
                }
                onEnhancementFieldChange={partEdit.updateEnhancementLocalItem}
                enhancementLocalValues={partEdit.enhancementLocalValues}
                enhancementChangedIds={partEdit.enhancementChangedIds}
                onAddNewItemAt={partEdit.addNewItemAt}
                onDeleteItem={partEdit.handleDeleteItem}
                pendingDeletes={partEdit.pendingDeletes}
                onRestoreItem={partEdit.handleRestoreItem}
                allowAddPart={allowAddPart}
                allowAddInstruction={allowAddInstruction}
                onAddNewInstructionAt={partEdit.addNewInstructionAt}
                onAddTranslation={partEdit.openAddTranslation}
                restrictTypeToInstructions={!isBase}
                isBaseTranslation={isBase}
                lastAddedItemId={partEdit.lastAddedItemId}
                onOpenDateSetIdForItem={partEdit.openDateSetIdModalForEdit}
                allowSplitAndMove={allowAddPart}
                onSplitPart={partEdit.openSplitPartModal}
                onMoveItemsToPart={partEdit.openMoveToPartModal}
                onReorderItems={partEdit.reorderItemsWithinPart}
            />
            <AddItemModal
                open={partEdit.addItemModalOpen}
                onClose={partEdit.closeAddItemModal}
                isInstruction={partEdit.addItemIsInstruction}
                form={partEdit.addItemForm}
                onFormChange={partEdit.setAddItemFormField}
                showParagraphQuestion={partEdit.addItemShowParagraphQuestion}
                prevItemContent={partEdit.addItemPrevItemContent}
                onConfirm={partEdit.confirmAddItemModal}
                onOpenDateSetIdConfig={partEdit.openDateSetIdFromAddItemModal}
                saving={partEdit.saving}
            />
            <DateSetIdConfigModal
                open={partEdit.dateSetIdModalOpen}
                onClose={partEdit.closeDateSetIdModal}
                dataSource={partEdit.dataSource}
                onSelect={partEdit.onDateSetIdSelected}
                title={partEdit.dateSetIdModalTitle}
                initialDateSetId={partEdit.dateSetIdInitialForEdit}
                showParagraphQuestion={partEdit.showParagraphQuestionInModal}
                prevItemContent={partEdit.paragraphModalPrevItemContent}
            />
            <AddTranslationModal
                open={partEdit.addTranslationOpen}
                onClose={partEdit.closeAddTranslation}
                baseItemId={
                    partEdit.addTranslationBaseItem
                        ? (partEdit.localValues[partEdit.addTranslationBaseItem.id]?.itemId ??
                           partEdit.addTranslationBaseItem.values?.itemId) ?? ""
                        : ""
                }
                baseContentPreview={
                    partEdit.addTranslationBaseItem
                        ? (partEdit.localValues[partEdit.addTranslationBaseItem.id]?.content ??
                           partEdit.addTranslationBaseItem.values?.content) ?? ""
                        : ""
                }
                baseItemMitId={
                    partEdit.addTranslationBaseItem
                        ? (partEdit.localValues[partEdit.addTranslationBaseItem.id]?.mit_id ??
                           partEdit.addTranslationBaseItem.values?.mit_id) ?? undefined
                        : undefined
                }
                existingLinked={addTranslationExistingLinked}
                translations={nav.currentTocData?.translations ?? []}
                currentTranslationId={nav.currentTranslationData?.translationId ?? null}
                targetPartItemsLinkedToBase={partEdit.addTranslationTargetLinkedItems}
                onLoadTargetPartItems={partEdit.loadTargetPartItemsForAddTranslation}
                targetTranslationId={partEdit.addTranslationTargetId}
                onSelectTargetTranslation={partEdit.setAddTranslationTargetId}
                insertAfterItemId={partEdit.addTranslationInsertAfterId}
                onInsertAfterChange={partEdit.setAddTranslationInsertAfterId}
                form={partEdit.addTranslationForm}
                onFormFieldChange={partEdit.setAddTranslationFormField}
                onSubmit={partEdit.submitAddTranslation}
                saving={partEdit.saving}
                onOpenDateSetIdConfig={partEdit.openDateSetIdModalForAddTranslation}
            />
            {/* מודל הוספת תפילה */}
            <AddPrayerModal
                open={addPrayerModalOpen}
                onClose={() => setAddPrayerModalOpen(false)}
                onSubmit={handleAddPrayerSubmit}
                saving={nav.isSaving}
            />
            {/* מודל הוספת מקטע */}
            <AddPartModal
                open={addPartModalOpen}
                onClose={() => setAddPartModalOpen(false)}
                onSubmit={handleAddPartSubmit}
                saving={nav.isSaving}
            />
            {/* מודל פיצול מקטע */}
            <SplitPartModal
                open={partEdit.splitPartModalOpen}
                onClose={partEdit.closeSplitPartModal}
                items={partEdit.allItems}
                localValues={partEdit.localValues}
                currentPart={
                    partEdit.selectedGroupId
                        ? (nav.currentParts.find((p: any) => p.id === partEdit.selectedGroupId) ?? null)
                        : null
                }
                onSubmit={partEdit.handleSplitPart}
                saving={partEdit.saving}
            />
            {/* מודל העברת פריטים למקטע אחר */}
            <MoveToPartModal
                open={partEdit.moveToPartModalOpen}
                onClose={partEdit.closeMoveToPartModal}
                items={partEdit.allItems}
                localValues={partEdit.localValues}
                currentParts={nav.currentParts}
                currentPartId={partEdit.selectedGroupId}
                targetPartItems={partEdit.moveTargetPartItems}
                onLoadTargetPartItems={partEdit.loadMoveTargetPartItems}
                onSubmit={partEdit.handleMoveItemsToPart}
                saving={partEdit.saving}
            />
            </div>
        </div>
    );
}
