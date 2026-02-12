import React, { useCallback, useEffect, useState } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
    EntityValues,
    buildCollection
} from "@firecms/cloud";

// 1. הגדרות אוספים
const tocCollection = buildCollection({
    id: "toc",
    path: "toc",
    name: "TOC",
    properties: { title: { dataType: "string", name: "Title" } },
});

const translationsCollection = buildCollection({
    id: "translations",
    path: "translations",
    name: "Translations",
    properties: { content: { dataType: "string", name: "Content" } },
});

// הגדרת האוסף הפנימי של התפילות
const prayersCollection = buildCollection({
    id: "prayers",
    path: "prayers",
    name: "Prayers",
    properties: { 
        content: { dataType: "string", name: "Content" },
        type: { dataType: "string", name: "Type" } // הוספת השדה מה-Firebase
    },
});

type GenericEntity = Entity<{ content?: string; [key: string]: unknown }>;

export function TocTranslationsView() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    // States לניהול הבחירה
    const [tocItems, setTocItems] = useState<GenericEntity[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);

    const [filteredTranslations, setFilteredTranslations] = useState<GenericEntity[]>([]);
    const [selectedTranslationId, setSelectedTranslationId] = useState<string | null>(null);

    const [prayers, setPrayers] = useState<GenericEntity[]>([]);
    const [selectedPrayer, setSelectedPrayer] = useState<GenericEntity | null>(null);

    const [contentValue, setContentValue] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // א. שליפת רשימת ה-TOC הראשונית
    const fetchToc = useCallback(async () => {
        setLoading(true);
        try {
            const entities = await dataSource.fetchCollection({
                path: "toc",
                collection: tocCollection,
            });
            setTocItems(entities as GenericEntity[]);
        } catch (err) {
            snackbar.open({ type: "error", message: `שגיאה בשליפת TOC: ${err}` });
        } finally {
            setLoading(false);
        }
    }, [dataSource, snackbar]);

    useEffect(() => {
        fetchToc();
    }, [fetchToc]);

    // ב. סינון מסמכי תרגום לפי סיומת (למשל כל מה שנגמר ב-ashkenaz)
    const fetchTranslations = useCallback(async (tocId: string) => {
        setLoading(true);
        setFilteredTranslations([]);
        setSelectedTranslationId(null);
        setPrayers([]);
        try {
            const entities = await dataSource.fetchCollection({
                path: "translations",
                collection: translationsCollection,
            });
            const matches = (entities as GenericEntity[]).filter((e) => e.id.endsWith(tocId));
            setFilteredTranslations(matches);
        } catch (err) {
            snackbar.open({ type: "error", message: `שגיאה בסינון תרגומים: ${err}` });
        } finally {
            setLoading(false);
        }
    }, [dataSource, snackbar]);

    // ג. שליפת תפילות מתוך ה-Sub-collection של המסמך הנבחר
    const fetchPrayers = useCallback(async (translationId: string) => {
        setLoading(true);
        setPrayers([]);
        setSelectedPrayer(null);
        setContentValue("");
        try {
            const entities = await dataSource.fetchCollection({
                path: `translations/${translationId}/prayers`,
                collection: prayersCollection,
            });
            setPrayers(entities as GenericEntity[]);
        } catch (err) {
            snackbar.open({ type: "error", message: `שגיאה בשליפת תפילות: ${err}` });
        } finally {
            setLoading(false);
        }
    }, [dataSource, snackbar]);

    // ד. שמירת השינויים בתפילה הספציפית
    const handleSave = async () => {
        if (!selectedPrayer || !selectedTranslationId) return;
        setSaving(true);
        try {
            await dataSource.saveEntity({
                path: `translations/${selectedTranslationId}/prayers`,
                entityId: selectedPrayer.id,
                values: { ...selectedPrayer.values, content: contentValue } as EntityValues<any>,
                status: "existing",
                collection: prayersCollection,
            });
            snackbar.open({ type: "success", message: "התפילה נשמרה בהצלחה" });
        } catch (err) {
            snackbar.open({ type: "error", message: `שגיאה בשמירה: ${err}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex w-full h-full p-6 gap-4 bg-gray-50 dark:bg-gray-900">
            
            {/* עמודה 1: קטגוריות TOC */}
            <div className="w-48 shrink-0 flex flex-col gap-2 border-l pl-2">
                <h3 className="font-bold text-sm uppercase text-gray-500">toc</h3>
                <div className="flex flex-col gap-1">
                    {tocItems.map((toc) => (
                        <button
                            key={toc.id}
                            onClick={() => { setSelectedTocId(toc.id); fetchTranslations(toc.id); }}
                            className={`text-right p-2 text-sm rounded border ${selectedTocId === toc.id ? "bg-blue-600 text-white" : "bg-white hover:bg-blue-50"}`}
                        >
                            {toc.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* עמודה 2: מסמכי תרגום (למשל 0-ashkenaz) */}
            <div className="w-48 shrink-0 flex flex-col gap-2 border-l pl-2">
                <h3 className="font-bold text-sm uppercase text-gray-500">translations</h3>
                <div className="flex flex-col gap-1">
                    {filteredTranslations.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => { setSelectedTranslationId(t.id); fetchPrayers(t.id); }}
                            className={`text-right p-2 text-sm rounded border ${selectedTranslationId === t.id ? "bg-indigo-600 text-white" : "bg-white hover:bg-indigo-50"}`}
                        >
                            {t.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* עמודה 3: רשימת תפילות (Prayers) */}
<div className="w-48 shrink-0 flex flex-col gap-2 border-l pl-2">
    <h3 className="font-bold text-sm uppercase text-gray-500">prayer</h3>
    <div className="flex flex-col gap-1 overflow-auto max-h-[60vh]">
        {prayers.map((p) => {
            // חילוץ שם התפילה מתוך הערכים
            const prayerName = (p.values as any)?.type;
            
            return (
                <button
                    key={p.id}
                    onClick={() => {
                        setSelectedPrayer(p);
                        setContentValue((p.values as any)?.content || "");
                    }}
                    className={`text-right p-2 text-sm rounded border transition-colors ${
                        selectedPrayer?.id === p.id 
                        ? "bg-green-600 text-white shadow-md" 
                        : "bg-white hover:bg-green-50 text-gray-700"
                    }`}
                >
                    {/* כאן קורה השינוי: מציגים את השם, ואם אין שם - את ה-ID */}
                    {prayerName ? prayerName : `תפילה ${p.id}`}
                </button>
            );
        })}
    </div>
</div>

            {/* עמודה 4: עורך התוכן */}
            <div className="flex-1 flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-bold text-lg border-b pb-2">עריכת תוכן התפילה</h3>
                {selectedPrayer ? (
                    <>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">ID: {selectedPrayer.id}</span>
                        </div>
                        <textarea
                            className="w-full flex-1 p-4 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={contentValue}
                            onChange={(e) => setContentValue(e.target.value)}
                            placeholder="כאן כותבים את נוסח התפילה..."
                        />
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-3 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? "שומר..." : "שמור שינויים בתפילה"}
                        </button>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400 italic">
                        בחר תפילה מהרשימה כדי להתחיל לערוך
                    </div>
                )}
            </div>
        </div>
    );
}