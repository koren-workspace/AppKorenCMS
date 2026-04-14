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
import { EditPartModal } from "./toc-translations/components/EditPartModal";
import { AddPrayerModal } from "./toc-translations/components/AddPrayerModal";
import { EditPrayerModal } from "./toc-translations/components/EditPrayerModal";
import { AddCategoryModal } from "./toc-translations/components/AddCategoryModal";
import { EditCategoryModal } from "./toc-translations/components/EditCategoryModal";
import { SplitPartModal } from "./toc-translations/components/SplitPartModal";
import { MoveToPartModal } from "./toc-translations/components/MoveToPartModal";
import { TocAndTranslationColumns } from "./toc-translations/components/TocAndTranslationColumns";
// ─── מושבת זמנית: עריכת נוסח ב־TOC — להפעלה בטל הערות ────────────────────────
// import { EditTocModal } from "./toc-translations/components/EditTocModal";
import { EditorGuideBanner } from "./toc-translations/components/EditorGuideBanner";
import { useTocNavigation } from "./toc-translations/hooks/useTocNavigation";
import { usePartEdit } from "./toc-translations/hooks/usePartEdit";
import { isBaseTranslation, isTranslationEditable } from "./toc-translations/services/navigationService";

export function TocTranslationsView() {
    const nav = useTocNavigation();
    const isBase = isBaseTranslation(nav.currentTranslationData?.translationId);
    const canEditNames = isTranslationEditable(nav.currentTranslationData?.translationId);

    const [addPartModalOpen, setAddPartModalOpen] = useState(false);
    const [addPartAfterPartId, setAddPartAfterPartId] = useState<string | null>(null);
    const [addPrayerModalOpen, setAddPrayerModalOpen] = useState(false);
    const [addPrayerAfterPrayerId, setAddPrayerAfterPrayerId] = useState<string | null>(null);
    const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
    const [addCategoryAfterId, setAddCategoryAfterId] = useState<string | null>(null);
    const [editPartModalOpen, setEditPartModalOpen] = useState(false);
    const [editPartId, setEditPartId] = useState<string | null>(null);
    const [editPrayerModalOpen, setEditPrayerModalOpen] = useState(false);
    const [editPrayerId, setEditPrayerId] = useState<string | null>(null);
    const [editCategoryModalOpen, setEditCategoryModalOpen] = useState(false);
    const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
    // ─── מושבת זמנית: עריכת נוסח (מודל) — להפעלה בטל הערות ───────────────────
    // const [editTocModalOpen, setEditTocModalOpen] = useState(false);
    // const [editTocId, setEditTocId] = useState<string | null>(null);

    const allowAddPart = isBase;
    const allowAddInstruction = !isBase;
    const partEdit = usePartEdit({
        currentTocData: nav.currentTocData,
        currentTranslationData: nav.currentTranslationData,
        selectedPrayerId: nav.selectedPrayerId,
        selectedTocId: nav.selectedTocId,
        currentParts: nav.currentParts,
        currentPrayers: nav.currentPrayers,
        addPart: nav.addPart,
    });

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

    const openEditPartModal = (partId: string) => {
        setEditPartId(partId);
        setEditPartModalOpen(true);
    };

    const handleEditPartSubmit = async (params: {
        nameHe?: string;
        nameEn?: string;
        name?: string;
        dateSetIds?: string[];
        hazan?: boolean | null;
        minyan?: boolean | null;
    }) => {
        if (!editPartId) return;
        const dateSetIds = params.dateSetIds?.length ? params.dateSetIds : ["100"];
        const ok = await nav.updatePart(editPartId, {
            ...params,
            dateSetIds,
        });
        if (!ok) return;
        setEditPartModalOpen(false);
        setEditPartId(null);
        if (partEdit.selectedGroupId === editPartId) {
            const hasUnsavedInPart =
                partEdit.changedIds.size > 0 ||
                partEdit.enhancementChangedIds.size > 0 ||
                partEdit.pendingDeletes.length > 0;
            if (
                hasUnsavedInPart &&
                !window.confirm("יש שינויים לא שמורים בפריטים. לרענן בכל זאת?\n(השינויים יאבדו)")
            ) {
                return;
            }
            await partEdit.fetchItemsWithEnhancements(editPartId);
        }
    };

    const openEditPrayerModal = (prayerId: string) => {
        setEditPrayerId(prayerId);
        setEditPrayerModalOpen(true);
    };

    // const openEditTocModal = (tocId: string) => {
    //     setEditTocId(tocId);
    //     setEditTocModalOpen(true);
    // };

    // const handleEditTocSubmit = async (params: { nusach: string }) => {
    //     if (!editTocId) return;
    //     await nav.updateToc(editTocId, params);
    //     setEditTocModalOpen(false);
    //     setEditTocId(null);
    // };

    const openEditCategoryModal = (categoryId: string) => {
        setEditCategoryId(categoryId);
        setEditCategoryModalOpen(true);
    };

    const handleEditCategorySubmit = async (params: { nameHe?: string; nameEn?: string; name?: string }) => {
        if (!editCategoryId) return;
        await nav.updateCategory(editCategoryId, params);
        setEditCategoryModalOpen(false);
        setEditCategoryId(null);
    };

    const handleEditPrayerSubmit = async (params: { nameHe?: string; nameEn?: string; name?: string }) => {
        if (!editPrayerId) return;
        await nav.updatePrayer(editPrayerId, params);
        setEditPrayerModalOpen(false);
        setEditPrayerId(null);
    };

    const openAddCategoryModal = (afterCategoryId: string | null) => {
        setAddCategoryAfterId(afterCategoryId);
        setAddCategoryModalOpen(true);
    };

    const handleAddCategorySubmit = async (params: { nameHe: string; nameEn: string }) => {
        await nav.addCategory(params.nameHe, addCategoryAfterId, {
            nameEn: params.nameEn,
            tocId: nav.selectedTocId ?? undefined,
        });
        setAddCategoryModalOpen(false);
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

    /** כל הפריטים שמקושרים לפריט הבסיס – מכל התרגומים (להצגה במודל הוספת תרגום לפריט בודד) */
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
            {/*
              מושבת זמנית: ניהול נוסח/תרגום שלמים בעמודות 1–2 (הוספת נוסח, עריכת נוסח, מחיקה,
              הוספת/מחיקת תרגום לרשימת התרגומים). הוספת תרגום *לפריט בודד* נשארת פעילה מעמודת העריכה.
              להפעלה בטל הערות וחבר:
              onAddToc={nav.addToc}
              onEditToc={openEditTocModal}
              onDeleteToc={nav.deleteToc}
              onAddTranslation={nav.addTranslation}
              getSuggestedTranslationId={nav.getSuggestedTranslationId}
              onDeleteTranslation={nav.deleteTranslation}
            */}
            <TocAndTranslationColumns
                tocItems={nav.tocItems}
                selectedTocId={nav.selectedTocId}
                onSelectToc={withUnsavedCheck(nav.onSelectToc)}
                translations={nav.currentTocData?.translations ?? []}
                selectedTranslationIndex={nav.selectedTranslationIndex}
                onSelectTranslation={withUnsavedCheck(nav.onSelectTranslation)}
                isSaving={nav.isSaving}
            />
            {/* עמודה 3–5: קטגוריה → תפילה → מקטע; בחירת מקטע טוענת את הפריטים */}
            <PrayerNavigationColumns
                currentCategories={nav.currentCategories}
                selectedCategoryId={nav.selectedCategoryId}
                onSelectCategory={nav.onSelectCategory}
                onAddCategoryClick={openAddCategoryModal}
                onEditCategory={canEditNames ? openEditCategoryModal : undefined}
                onDeleteCategory={allowAddPart ? nav.deleteCategory : undefined}
                showAddCategory={!!nav.selectedTocId && nav.selectedTranslationIndex != null && allowAddPart}
                currentPrayers={nav.currentPrayers}
                selectedPrayerId={nav.selectedPrayerId}
                onSelectPrayer={withUnsavedCheck(nav.onSelectPrayer)}
                onAddPrayerClick={openAddPrayerModal}
                onEditPrayer={canEditNames ? openEditPrayerModal : undefined}
                onDeletePrayer={allowAddPart ? nav.deletePrayer : undefined}
                showAddPrayer={
                    !!nav.selectedTocId &&
                    nav.selectedTranslationIndex != null &&
                    !!nav.selectedCategoryId &&
                    allowAddPart
                }
                currentParts={nav.currentParts}
                selectedGroupId={partEdit.selectedGroupId}
                onSelectPart={withUnsavedCheck(partEdit.fetchItemsWithEnhancements)}
                onAddPartClick={openAddPartModal}
                onEditPart={canEditNames ? openEditPartModal : undefined}
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
                selectedTocId={nav.selectedTocId}
                publishNusachLabel={nav.currentTocData?.nusach ?? nav.selectedTocId}
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
                isAddTranslationBlockedForItem={partEdit.isAddTranslationBlockedForBaseItem}
                restrictTypeToInstructions={!isBase}
                isBaseTranslation={isBase}
                currentTranslationId={nav.currentTranslationData?.translationId ?? null}
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
                isBaseTranslation={isBase}
                translationId={nav.currentTranslationData?.translationId ?? null}
                form={partEdit.addItemForm}
                onFormChange={partEdit.setAddItemFormField}
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
            {/*
            מושבת זמנית: מודל עריכת נוסח — להפעלה בטל הערות ושחזר state/handlers למעלה
            <EditTocModal
                open={editTocModalOpen}
                onClose={() => { setEditTocModalOpen(false); setEditTocId(null); }}
                initialToc={
                    editTocId
                        ? {
                              id: editTocId,
                              nusach: nav.tocItems.find((t) => t.id === editTocId)?.values?.nusach ?? "",
                          }
                        : null
                }
                onSubmit={handleEditTocSubmit}
                saving={nav.isSaving}
            />
            */}
            {/* מודל הוספת קטגוריה */}
            <AddCategoryModal
                open={addCategoryModalOpen}
                onClose={() => setAddCategoryModalOpen(false)}
                onSubmit={handleAddCategorySubmit}
                saving={nav.isSaving}
            />
            {/* מודל עריכת קטגוריה */}
            <EditCategoryModal
                open={editCategoryModalOpen}
                onClose={() => { setEditCategoryModalOpen(false); setEditCategoryId(null); }}
                initialCategory={editCategoryId ? nav.getCategoryForEdit(editCategoryId) : null}
                onSubmit={handleEditCategorySubmit}
                saving={nav.isSaving}
            />
            {/* מודל עריכת תפילה */}
            <EditPrayerModal
                open={editPrayerModalOpen}
                onClose={() => { setEditPrayerModalOpen(false); setEditPrayerId(null); }}
                initialPrayer={editPrayerId ? nav.getPrayerForEdit(editPrayerId) : null}
                onSubmit={handleEditPrayerSubmit}
                saving={nav.isSaving}
            />
            {/* מודל הוספת תפילה */}
            <AddPrayerModal
                open={addPrayerModalOpen}
                onClose={() => setAddPrayerModalOpen(false)}
                onSubmit={handleAddPrayerSubmit}
                saving={nav.isSaving}
            />
            {/* מודל עריכת מקטע */}
            <EditPartModal
                open={editPartModalOpen}
                onClose={() => { setEditPartModalOpen(false); setEditPartId(null); }}
                initialPart={editPartId ? nav.getPartForEdit(editPartId) : null}
                onSubmit={handleEditPartSubmit}
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
