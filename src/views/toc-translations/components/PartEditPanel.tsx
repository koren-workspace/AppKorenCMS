/**
 * PartEditPanel – אזור העריכה הראשי במסך
 *
 * מציג:
 *   - PartEditToolbar: כותרת המקטע + כפתורי "שמור מקטע" ו"פרסום"
 *   - במצב טעינה: "טוען..."
 *   - לאחר טעינה: רשימת פריטים (PartItemRow) + כפתור "הוסף בראש המקטע"
 *
 * כל הנתונים והפעולות מגיעים ב-props (controlled) – ה-state נמצא ב-usePartEdit.
 */

import React from "react";
import { Entity } from "@firecms/cloud";
import { PartEditToolbar } from "./PartEditToolbar";
import { PartItemRow } from "./PartItemRow";

export type PartEditPanelProps = {
    selectedGroupId: string | null;
    saving: boolean;
    changedIds: Set<string>;
    loading: boolean;
    allItems: Entity<any>[];
    localValues: Record<string, any>;
    enhancements: Record<string, Entity<any>[]>;
    onSaveGroup: () => void;
    onFinalPublish: () => void;
    onContentChange: (itemId: string, value: string) => void;
    onAddNewItemAt: (index: number) => void;
};

export function PartEditPanel({
    selectedGroupId,
    saving,
    changedIds,
    loading,
    allItems,
    localValues,
    enhancements,
    onSaveGroup,
    onFinalPublish,
    onContentChange,
    onAddNewItemAt,
}: PartEditPanelProps) {
    return (
        <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
            <PartEditToolbar
                selectedGroupId={selectedGroupId}
                saving={saving}
                hasChanges={changedIds.size > 0}
                onSaveGroup={onSaveGroup}
                onFinalPublish={onFinalPublish}
            />
            {loading ? (
                <div className="m-auto font-bold text-blue-500 animate-pulse text-lg">
                    טוען...
                </div>
            ) : (
                selectedGroupId && (
                    <div className="overflow-auto space-y-4 px-2 pb-10">
                        {/* הוספת פריט בתחילת הרשימה */}
                        <button
                            type="button"
                            onClick={() => onAddNewItemAt(0)}
                            className="w-full py-2 border-2 border-dashed border-blue-100 text-blue-300 font-bold hover:bg-blue-50"
                        >
                            + הוסף בראש המקטע
                        </button>
                        {/* לכל פריט: ערכים מקומיים + תרגומים מקושרים (לפי itemId/linkedItem) */}
                        {allItems.map((item, index) => {
                            const val = localValues[item.id] || {};
                            const curId = val.itemId;
                            const related = Object.entries(enhancements).flatMap(
                                ([tId, list]) =>
                                    list
                                        .filter((e) => {
                                            const link = e.values?.linkedItem;
                                            return Array.isArray(link)
                                                ? link.includes(curId)
                                                : link === curId;
                                        })
                                        .map((e) => ({ ...e, tId }))
                            );
                            return (
                                <PartItemRow
                                    key={item.id}
                                    item={item}
                                    localVal={val}
                                    isChanged={changedIds.has(item.id)}
                                    related={related}
                                    onContentChange={onContentChange}
                                    onAddAfter={() =>
                                        onAddNewItemAt(index + 1)
                                    }
                                />
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
