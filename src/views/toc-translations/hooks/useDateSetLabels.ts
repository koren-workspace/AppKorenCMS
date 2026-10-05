/**
 * useDateSetLabels – טוען את כל רשומות הלוח פעם אחת ובונה מפה dateSetId → תיאור קריא.
 * משמש להצגת badge ידידותי למשתמש בתצוגת פריטי מקטע.
 */

import { useState, useEffect, useRef } from "react";
import { fetchAllCalendar } from "../services/calendarService";
import { buildDateSetLabel, entityValuesToPayload, isCalendarEntryDeleted } from "../constants/calendarTypes";

type DataSource = {
    fetchCollection: (opts: any) => Promise<any[]>;
    saveEntity: (opts: any) => Promise<any>;
};

/** deleted = הרשומה מסומנת מחוקה ב-Firestore – האפליקציה לא תציג את מה שמפנה אליה. */
export type DateSetLabelEntry = { short: string; full: string; deleted?: boolean };

/**
 * מחזיר Record<dateSetId, { short, full }>.
 * short = שם קצר לbadge; full = תיאור מלא לtooltip; deleted = רשומה מחוקה.
 * מפה ריקה = עדיין לא נטען (או שגיאה) – אז אי אפשר לקבוע ש-ID "לא קיים".
 * נטען פעם אחת לפי dataSource – ונטען מחדש כש-reloadKey משתנה (אחרי עדכון סט קיים).
 */
export function useDateSetLabels(
    dataSource: DataSource | null | undefined,
    reloadKey = 0
): Record<string, DateSetLabelEntry> {
    const [labels, setLabels] = useState<Record<string, DateSetLabelEntry>>({});
    const loadedForRef = useRef<{ dataSource: DataSource; reloadKey: number } | null>(null);

    useEffect(() => {
        if (!dataSource) return;
        const loaded = loadedForRef.current;
        if (loaded && loaded.dataSource === dataSource && loaded.reloadKey === reloadKey) return;
        loadedForRef.current = { dataSource, reloadKey };

        fetchAllCalendar(dataSource)
            .then((entries) => {
                const map: Record<string, DateSetLabelEntry> = {};
                for (const entry of entries) {
                    const payload = entityValuesToPayload(entry.values ?? {});
                    map[entry.id] = {
                        ...buildDateSetLabel(payload, entry.id),
                        deleted: isCalendarEntryDeleted(entry.values),
                    };
                }
                setLabels(map);
            })
            .catch(() => {
                // במקרה של שגיאה – נשאיר מפה ריקה; ה-badge יציג את ה-ID הגולמי
            });
    }, [dataSource, reloadKey]);

    return labels;
}
