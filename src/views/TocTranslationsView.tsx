import React, { useCallback, useEffect, useState } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
    EntityValues,
} from "@firecms/cloud";
import { buildCollection } from "@firecms/cloud";

// הגדרות אוספים
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

type TocEntity = Entity<{ title?: string; [key: string]: unknown }>;
type TranslationEntity = Entity<{ content?: string; [key: string]: unknown }>;

export function TocTranslationsView() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();
    
    const [tocItems, setTocItems] = useState<TocEntity[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    
    // רשימת כל התרגומים שמתאימים לסיומת שנבחרה
    const [filteredTranslations, setFilteredTranslations] = useState<TranslationEntity[]>([]);
    const [selectedTranslation, setSelectedTranslation] = useState<TranslationEntity | null>(null);
    
    const [contentValue, setContentValue] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // 1. שליפת רשימת ה-Toc
    const fetchToc = useCallback(async () => {
        setLoading(true);
        try {
            const entities = await dataSource.fetchCollection({
                path: "toc",
                collection: tocCollection,
            });
            setTocItems(entities as TocEntity[]);
        } catch (err) {
            snackbar.open({ type: "error", message: `שגיאה בשליפת Toc: ${err}` });
        } finally {
            setLoading(false);
        }
    }, [dataSource, snackbar]);

    useEffect(() => {
        fetchToc();
    }, [fetchToc]);

    // 2. פונקציית הסינון לפי ה-ID שנבחר (למשל ashkenaz)
    const fetchTranslationForToc = useCallback(
        async (tocId: string) => {
            setLoading(true);
            setFilteredTranslations([]);
            setSelectedTranslation(null);
            setContentValue("");

            try {
                const entities = await dataSource.fetchCollection({
                    path: "translations",
                    collection: translationsCollection,
                });
                const list = entities as TranslationEntity[];

                // סינון: מחפשים את כל המסמכים שה-ID שלהם מסתיים ב-tocId שנבחר
                // לדוגמה: אם tocId הוא "ashkenaz", זה ימצא את "0-ashkenaz", "1-ashkenaz" וכו'
                const matches = list.filter((e) => e.id.endsWith(tocId));
                
                setFilteredTranslations(matches);

                // אם יש רק התאמה אחת, נבחר אותה אוטומטית
                if (matches.length === 1) {
                    handleSelectTranslation(matches[0]);
                }
            } catch (err) {
                snackbar.open({ type: "error", message: `שגיאה בשליפת תרגומים: ${err}` });
            } finally {
                setLoading(false);
            }
        },
        [dataSource, snackbar]
    );

    const onSelectToc = (toc: TocEntity) => {
        setSelectedTocId(toc.id);
        fetchTranslationForToc(toc.id);
    };

    const handleSelectTranslation = (translation: TranslationEntity) => {
        setSelectedTranslation(translation);
        const c = (translation.values as Record<string, unknown>)?.content;
        setContentValue(typeof c === "string" ? c : "");
    };

    // 3. שמירה
    const handleSave = async () => {
        if (!selectedTranslation) return;
        setSaving(true);
        try {
            await dataSource.saveEntity({
                path: "translations",
                entityId: selectedTranslation.id,
                values: { ...selectedTranslation.values, content: contentValue } as EntityValues<Record<string, unknown>>,
                status: "existing",
                collection: translationsCollection,
            });
            snackbar.open({ type: "success", message: "נשמר בהצלחה" });
        } catch (err) {
            snackbar.open({ type: "error", message: `שגיאה בשמירה: ${err}` });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex w-full h-full p-6 gap-6">
            {/* שלב 1: רשימת ה-TOC */}
            <div className="w-64 shrink-0 flex flex-col gap-2 border-l pl-4">
                <h3 className="text-lg font-semibold border-b pb-2">בחר קטגוריה</h3>
                <div className="flex flex-col gap-1 max-h-[70vh] overflow-auto">
                    {tocItems.map((toc) => (
                        <button
                            key={toc.id}
                            onClick={() => onSelectToc(toc)}
                            className={`text-right px-3 py-2 rounded border transition-all ${
                                selectedTocId === toc.id ? "bg-blue-600 text-white" : "hover:bg-gray-100"
                            }`}
                        >
                            {toc.id} {/* מציג את המזהה כמו ashkenaz */}
                        </button>
                    ))}
                </div>
            </div>

            {/* שלב 2: בחירת מסמך ספציפי (Checkboxes/List) */}
            <div className="w-64 shrink-0 flex flex-col gap-2 border-l pl-4">
                <h3 className="text-lg font-semibold border-b pb-2">מסמכים שנמצאו</h3>
                {loading ? <p>טוען...</p> : (
                    <div className="flex flex-col gap-2 overflow-auto">
                        {filteredTranslations.map((t) => (
                            <label key={t.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={selectedTranslation?.id === t.id}
                                    onChange={() => handleSelectTranslation(t)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">{t.id}</span>
                            </label>
                        ))}
                        {filteredTranslations.length === 0 && selectedTocId && (
                            <p className="text-gray-400 text-sm">לא נמצאו מסמכים לסיומת זו</p>
                        )}
                    </div>
                )}
            </div>

            {/* שלב 3: עריכת התוכן */}
            <div className="flex-1 flex flex-col gap-4">
                <h3 className="text-lg font-semibold border-b pb-2">עריכת תוכן</h3>
                {selectedTranslation ? (
                    <>
                        <p className="text-sm font-mono text-blue-600">עורך כעת את: {selectedTranslation.id}</p>
                        <textarea
                            className="w-full flex-1 p-4 border rounded font-mono text-sm dark:bg-gray-800"
                            value={contentValue}
                            onChange={(e) => setContentValue(e.target.value)}
                            placeholder="הקלד תוכן כאן..."
                        />
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:opacity-50"
                        >
                            {saving ? "שומר שינויים..." : "שמור עדכון"}
                        </button>
                    </>
                ) : (
                    <div className="flex h-64 items-center justify-center border-2 border-dashed rounded text-gray-400">
                        בחר מסמך מהרשימה כדי להתחיל לערוך
                    </div>
                )}
            </div>
        </div>
    );
}