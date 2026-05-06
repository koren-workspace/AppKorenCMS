/**
 * useDateSetLabels – טוען את כל רשומות הלוח פעם אחת ובונה מפה dateSetId → תיאור קריא.
 * משמש להצגת badge ידידותי למשתמש בתצוגת פריטי מקטע.
 */

import { useState, useEffect, useRef } from "react";
import { fetchAllCalendar } from "../services/calendarService";
import { buildDateSetLabel, entityValuesToPayload } from "../constants/calendarTypes";

type DataSource = {
    fetchCollection: (opts: any) => Promise<any[]>;
    saveEntity: (opts: any) => Promise<any>;
};

export type DateSetLabelEntry = { short: string; full: string };

/**
 * מחזיר Record<dateSetId, { short, full }>.
 * short = שם קצר לbadge; full = תיאור מלא לtooltip.
 * נטען פעם אחת לפי dataSource – לא נטען מחדש אלא אם dataSource מוחלף.
 */
export function useDateSetLabels(
    dataSource: DataSource | null | undefined
): Record<string, DateSetLabelEntry> {
    const [labels, setLabels] = useState<Record<string, DateSetLabelEntry>>({});
    const loadedForRef = useRef<DataSource | null | undefined>(undefined);

    useEffect(() => {
        if (!dataSource || loadedForRef.current === dataSource) return;
        loadedForRef.current = dataSource;

        fetchAllCalendar(dataSource)
            .then((entries) => {
                const map: Record<string, DateSetLabelEntry> = {};
                for (const entry of entries) {
                    const payload = entityValuesToPayload(entry.values ?? {});
                    map[entry.id] = buildDateSetLabel(payload, entry.id);
                }
                setLabels(map);
            })
            .catch(() => {
                // במקרה של שגיאה – נשאיר מפה ריקה; ה-badge יציג את ה-ID הגולמי
            });
    }, [dataSource]);

    return labels;
}
