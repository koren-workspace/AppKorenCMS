/**
 * PartItemRow – שורת פריט בודדת ברשימת העריכה
 *
 * מציג:
 *   - כרטיס: itemId, MIT, זמן עדכון + textarea לתוכן (עם עיצוב לפי type)
 *   - בלוק "תרגומים מקושרים": פריטים מתרגומים אחרים שמקושרים ל-itemId (linkedItem)
 *   - כפתור "הוסף מקטע כאן" (מופיע ב-hover)
 *
 * קומפוננטה תצוגתית – כל הנתונים וה-callbacks ב-props.
 */

import React from "react";
import { Entity } from "@firecms/cloud";
import { getItemStyle } from "../utils/itemUtils";

/** פריט מתרגום אחר שמקושר לפריט הנוכחי (לפי linkedItem); tId = מזהה התרגום */
export type RelatedEntry = { id: string; tId: string; values: any };

type PartItemRowProps = {
    item: Entity<any>;
    localVal: Record<string, any>;
    isChanged: boolean;
    related: RelatedEntry[];
    onContentChange: (itemId: string, value: string) => void;
    /** מוחק את המקטע ואת כל התרגומים המקושרים */
    onDelete?: (item: Entity<any>, itemId: string) => void;
    /** מוצג רק בנוסח הבסיסי (0-*); בשאר הנוסחים – עריכה בלבד */
    onAddAfter?: () => void;
};

export function PartItemRow({
    item,
    localVal,
    isChanged,
    related,
    onContentChange,
    onDelete,
    onAddAfter,
}: PartItemRowProps) {
    const curId = localVal.itemId;

    return (
        <React.Fragment>
            <div
                className={`p-2 border rounded ${isChanged ? "border-orange-300" : "border-gray-200"}`}
            >
                <div className="flex justify-between items-center text-[7px] text-gray-400 mb-1 uppercase tracking-tighter">
                    <span>itemId: {curId} | MIT: {localVal.mit_id}</span>
                    <div className="flex items-center gap-2">
                        {onDelete && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm("למחוק את המקטע ואת כל התרגומים המקושרים אליו?"))
                                        onDelete(item, curId ?? item.id);
                                }}
                                className="px-1.5 py-0.5 text-red-500 hover:bg-red-50 border border-red-200 rounded text-[8px] font-bold"
                                title="מחק מקטע וכל התרגומים המקושרים"
                            >
                                מחק מקטע
                            </button>
                        )}
                        <span>
                            Update:{" "}
                            {localVal.timestamp
                                ? new Date(localVal.timestamp).toLocaleTimeString()
                                : "Never"}
                        </span>
                    </div>
                </div>
                <textarea
                    className={getItemStyle(localVal.type)}
                    value={localVal.content ?? ""}
                    onChange={(e) => onContentChange(item.id, e.target.value)}
                    dir="rtl"
                />
            </div>

            {/* תרגומים מקושרים מאותו פריט בתרגומים אחרים */}
            {related.length > 0 && (
                <div className="mr-8 border-r-4 border-blue-400 pr-3 space-y-1">
                    {related.map((enh) => (
                        <div
                            key={enh.id}
                            className="p-2 bg-blue-50 border border-blue-100 rounded text-[10px]"
                        >
                            <div className="font-bold text-blue-600 mb-1">
                                {enh.tId}
                            </div>
                            <div>{enh.values?.content}</div>
                        </div>
                    ))}
                </div>
            )}
            {onAddAfter && (
                <button
                    type="button"
                    onClick={onAddAfter}
                    className="w-full py-1 opacity-0 hover:opacity-100 bg-green-50 text-green-500 border border-dashed border-green-200 text-[8px] font-bold"
                >
                    + הוסף מקטע כאן
                </button>
            )}
        </React.Fragment>
    );
}
