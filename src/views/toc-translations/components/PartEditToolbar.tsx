/**
 * PartEditToolbar – סרגל פעולות באזור העריכה
 *
 * מציג את שם החלק תפילה הנבחר (או הודעת מצב) + כפתורים:
 *   - "שמור חלק תפילה": רק כשחלק תפילה נבחר — שומר שינויים ל-Firestore (מושבת אם אין שינויים או במצב saving)
 *   - פיצול / העברה (בנוסח בסיסי)
 *
 * פרסום לאפליקציה — בסרגל הסינון העליון (DateFilterBar).
 */

import React from "react";
import { getNusachPalette } from "../utils/nusachPalette";

export type PartEditToolbarProps = {
    selectedGroupId: string | null;
    selectedTocId: string | null;
    saving: boolean;
    hasChanges: boolean;
    onSaveGroup: () => void;
    /** מציג כפתורי פיצול / העברה / העתקה – רק בנוסח הבסיסי */
    allowSplitAndMove?: boolean;
    onSplitPart?: () => void;
    onMoveItemsToPart?: () => void;
    onCopyItemsToPart?: () => void;
    /** Prod dual-write */
    onSavePartToProd?: () => void;
    pendingProdCount?: number;
};

export function PartEditToolbar({
    selectedGroupId,
    selectedTocId,
    saving,
    hasChanges,
    onSaveGroup,
    allowSplitAndMove,
    onSplitPart,
    onMoveItemsToPart,
    onCopyItemsToPart,
    onSavePartToProd,
    pendingProdCount = 0,
}: PartEditToolbarProps) {
    const hasPart = !!selectedGroupId;

    const p = getNusachPalette(selectedTocId);
    const btn = (i: 0|1|2|3|4) => ({
        backgroundColor: p.selectedColors[i],
        color: p.darkText[i] ? '#1a1a1a' : '#ffffff',
        borderColor: p.selectedColors[i],
    });

    const actionBtn =
        "inline-flex items-center justify-center px-2 py-1 rounded text-xs font-semibold leading-none whitespace-nowrap disabled:opacity-30";

    return (
        <div className="mb-2 pb-2 border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-base text-gray-800 truncate min-w-0 flex-1">
                    {hasPart ? selectedGroupId : "בחר חלק תפילה לעריכת פריטים"}
                </h3>
                {hasPart && (
                    <div
                        className="flex items-center gap-1 shrink-0 flex-nowrap"
                        role="toolbar"
                        aria-label="פעולות חלק תפילה"
                    >
                        <button
                            type="button"
                            onClick={onSaveGroup}
                            disabled={saving || !hasChanges}
                            className={`${actionBtn} font-bold px-2.5`}
                            style={btn(1)}
                            title="שמור שינויים בחלק זה ל-Firestore של סטייג'"
                        >
                            {saving ? "שומר · סטייג'…" : "שמור · סטייג'"}
                        </button>
                        {onSavePartToProd && (
                            <button
                                type="button"
                                onClick={onSavePartToProd}
                                disabled={saving || pendingProdCount === 0}
                                className={`${actionBtn} font-bold px-2.5`}
                                style={{
                                    backgroundColor: pendingProdCount > 0 ? "#1565c0" : "#90a4ae",
                                    color: "#fff",
                                    borderColor: pendingProdCount > 0 ? "#1565c0" : "#90a4ae",
                                    position: "relative",
                                }}
                                title={
                                    pendingProdCount > 0
                                        ? `שמור ${pendingProdCount} פריטים שכבר נשמרו בסטייג' — ל-Firestore של פרוד`
                                        : "אין פריטים שממתינים לשמירה בפרוד (קודם שמור בסטייג')"
                                }
                            >
                                שמור · פרוד
                                {pendingProdCount > 0 && (
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            marginRight: 4,
                                            minWidth: 16,
                                            height: 16,
                                            borderRadius: 8,
                                            background: "#fff",
                                            color: "#1565c0",
                                            fontSize: 10,
                                            fontWeight: 700,
                                            padding: "0 3px",
                                        }}
                                    >
                                        {pendingProdCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {allowSplitAndMove && (
                            <>
                                <button
                                    type="button"
                                    onClick={onSplitPart}
                                    disabled={saving}
                                    className={actionBtn}
                                    style={btn(2)}
                                    title="פצל חלק תפילה – יצירת חלק תפילה חדש מחלק מהפריטים"
                                >
                                    ✂ פצל
                                </button>
                                <button
                                    type="button"
                                    onClick={onMoveItemsToPart}
                                    disabled={saving}
                                    className={actionBtn}
                                    style={btn(3)}
                                    title="העבר פריטים לחלק תפילה אחר"
                                >
                                    ↔ העבר
                                </button>
                                {onCopyItemsToPart && (
                                    <button
                                        type="button"
                                        onClick={onCopyItemsToPart}
                                        disabled={saving}
                                        className={actionBtn}
                                        style={btn(4)}
                                        title="העתק פריטים לחלק תפילה אחר (יכול להיות תפילה/נוסח שונים) – המקור נשאר"
                                    >
                                        📋 העתק
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
