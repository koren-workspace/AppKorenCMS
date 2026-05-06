/**
 * useDateFilter – Hook לניהול סינון התצוגה לפי תאריך עברי.
 *
 * מטרה: לדמות מה האפליקציה הציגה ביום נתון —
 *   - סינון מקטעים (parts) ברשימה לפי dateSetIds
 *   - סינון פריטים בתוך מקטע לפי dateSetId של כל פריט
 *
 * זרימה:
 *   1. טוען את כל רשומות `calendar` מ-Firestore (פעם אחת לכל dataSource)
 *   2. שומר state ל-filterDate (ברירת מחדל: היום) ו-showAll (ברירת מחדל: false)
 *   3. ב-useMemo מחשב את relevantDateSetIds לפי התאריך הנבחר
 *   4. כש-showAll=true, מחזיר relevantDateSetIds=null (= הצג הכל ללא סינון)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Entity } from "@firecms/core";
import { fetchAllCalendar } from "../services/calendarService";
import {
    getHebrewDateInfo,
    getRelevantDateSetIds,
    type CalendarFlags,
} from "../utils/hebrewDateUtils";

type DataSource = {
    fetchCollection: (opts: any) => Promise<any[]>;
    saveEntity: (opts: any) => Promise<any>;
};

export type DateFilterState = {
    /** התאריך הגרגוריאני הנבחר (ברירת מחדל: היום) */
    filterDate: Date;
    setFilterDate: (date: Date) => void;
    /** true = ללא סינון (הצג הכל) */
    showAll: boolean;
    setShowAll: (v: boolean) => void;
    /**
     * דגלים בוליאניים (simha/beitEvel/abroad/yad/tv) – ברירת מחדל כולם false.
     * נחשפים כדי לאפשר הרחבה עתידית; כרגע ה-CMS לא חושף UI לשנות אותם.
     */
    flags: CalendarFlags;
    setFlags: (flags: CalendarFlags) => void;
    /** רשימת dateSetIds פעילים לתאריך — או null כשהסינון מבוטל */
    relevantDateSetIds: string[] | null;
    /** תווית עברית לתצוגה (לדוגמה: "ו' ניסן תשפ"ד") */
    hebrewLabel: string;
    /** האם הרשומות עדיין נטענות */
    isLoading: boolean;
};

export function useDateFilter(dataSource: DataSource | null | undefined): DateFilterState {
    const [calendarEntries, setCalendarEntries] = useState<Entity<any>[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [filterDate, setFilterDate] = useState<Date>(() => new Date());
    const [showAll, setShowAll] = useState(false);
    const [flags, setFlags] = useState<CalendarFlags>({});

    const loadedForRef = useRef<DataSource | null | undefined>(undefined);

    useEffect(() => {
        if (!dataSource || loadedForRef.current === dataSource) return;
        loadedForRef.current = dataSource;
        setIsLoading(true);
        fetchAllCalendar(dataSource)
            .then((entries) => {
                setCalendarEntries(entries);
            })
            .catch((err) => {
                console.error("[useDateFilter] failed to load calendar entries:", err);
                setCalendarEntries([]);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [dataSource]);

    const hebrewLabel = useMemo(() => {
        try {
            return getHebrewDateInfo(filterDate).label;
        } catch {
            return "";
        }
    }, [filterDate]);

    const relevantDateSetIds = useMemo<string[] | null>(() => {
        if (showAll) return null;
        if (calendarEntries.length === 0) {
            // לפני טעינה / כשאין רשומות לוח – מסתכלים רק על "תמיד"
            return ["100"];
        }
        return getRelevantDateSetIds(calendarEntries, filterDate, flags);
    }, [showAll, calendarEntries, filterDate, flags]);

    return {
        filterDate,
        setFilterDate,
        showAll,
        setShowAll,
        flags,
        setFlags,
        relevantDateSetIds,
        hebrewLabel,
        isLoading,
    };
}
