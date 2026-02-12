import React, { useCallback, useEffect, useState } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
    EntityValues,
    buildCollection
} from "@firecms/cloud";

// 1. הגדרות אוספים (Collections)
const tocCollection = buildCollection({ 
    id: "toc", 
    path: "toc", 
    name: "TOC", 
    properties: { title: { dataType: "string" } } 
});

const translationsCollection = buildCollection({ 
    id: "translations", 
    path: "translations", 
    name: "Translations", 
    properties: { content: { dataType: "string" } } 
});

const prayersCollection = buildCollection({ 
    id: "prayers", 
    path: "prayers", 
    name: "Prayers", 
    properties: { type: { dataType: "string" } } 
});

const itemsCollection = buildCollection({
    id: "items",
    path: "items",
    name: "Items",
    properties: {
        content: { dataType: "string", name: "תוכן" },
        partName: { dataType: "string", name: "שם החלק" },
        partId: { dataType: "string", name: "מזהה חלק" }
    }
});

type GenericEntity = Entity<any>;

export function TocTranslationsView() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    // States לניהול הניווט
    const [tocItems, setTocItems] = useState<GenericEntity[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);

    const [filteredTranslations, setFilteredTranslations] = useState<GenericEntity[]>([]);
    const [selectedTranslationId, setSelectedTranslationId] = useState<string | null>(null);

    const [prayers, setPrayers] = useState<GenericEntity[]>([]);
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);

    // States לניהול ה-Items והעריכה
    const [allItems, setAllItems] = useState<GenericEntity[]>([]);
    const [localContents, setLocalContents] = useState<Record<string, string>>({});
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // פונקציית עזר לחילוץ קבוצה לפי 5 ספרות אחרונות
    const getGroupId = (partId: string) => partId ? partId.slice(-5) : "unknown";

    // --- שליפות נתונים ---

    const fetchToc = useCallback(async () => {
        const entities = await dataSource.fetchCollection({ path: "toc", collection: tocCollection });
        setTocItems(entities);
    }, [dataSource]);

    useEffect(() => { fetchToc(); }, [fetchToc]);

    const fetchTranslations = async (tocId: string) => {
        setLoading(true);
        const entities = await dataSource.fetchCollection({ path: "translations", collection: translationsCollection });
        setFilteredTranslations(entities.filter(e => e.id.endsWith(tocId)));
        setSelectedTranslationId(null);
        setPrayers([]);
        setLoading(false);
    };

    const fetchPrayers = async (translationId: string) => {
        setLoading(true);
        const entities = await dataSource.fetchCollection({ 
            path: `translations/${translationId}/prayers`, 
            collection: prayersCollection 
        });
        setPrayers(entities);
        setSelectedPrayerId(null);
        setAllItems([]);
        setLoading(false);
    };

    const fetchItems = async (translationId: string, prayerId: string) => {
        setLoading(true);
        try {
            const entities = await dataSource.fetchCollection({
                path: `translations/${translationId}/prayers/${prayerId}/items`,
                collection: itemsCollection
            });
            // מיון לפי ה-partId המלא כדי לשמור על סדר התפילה
          // מיון מדויק לפי ערך מספרי של ה-partId
const sorted = [...entities].sort((a, b) => {
    const idA = a.values.partId || "";
    const idB = b.values.partId || "";
    
    // שימוש ב-localeCompare עם הגדרה מספרית (numeric: true) 
    // זו הדרך הכי בטוחה למנוע שגיאות בטקסטים ארוכים
    return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
});

setAllItems(sorted);

            // יצירת עותק מקומי לעריכה
            const contents: Record<string, string> = {};
            sorted.forEach(item => {
                contents[item.id] = typeof item.values.content === "string" ? item.values.content : "";
            });
            setLocalContents(contents);
            setSelectedGroupId(null);
        } finally {
            setLoading(false);
        }
    };

    // --- שמירה ---

    const handleSaveGroup = async () => {
        if (!selectedGroupId || !selectedTranslationId || !selectedPrayerId) return;
        setSaving(true);
        try {
            const itemsInGroup = allItems.filter(item => getGroupId(item.values.partId) === selectedGroupId);
            
            for (const item of itemsInGroup) {
                await dataSource.saveEntity({
                    path: `translations/${selectedTranslationId}/prayers/${selectedPrayerId}/items`,
                    entityId: item.id,
                    values: { ...item.values, content: localContents[item.id] },
                    status: "existing",
                    collection: itemsCollection,
                });
            }
            snackbar.open({ type: "success", message: "הקבוצה נשמרה בהצלחה" });
        } catch (err) {
            snackbar.open({ type: "error", message: "שגיאה בשמירה" });
        } finally {
            setSaving(false);
        }
    };

    // הפקת רשימת קבוצות ייחודית לתצוגה בעמודה 4
    const uniqueGroupIds = Array.from(new Set(allItems.map(item => getGroupId(item.values.partId))));

    return (
        <div className="flex w-full h-full p-4 gap-3 bg-gray-100 overflow-hidden font-sans" dir="rtl">
            
            {/* 1. קטגוריה */}
            <div className="w-40 shrink-0 flex flex-col gap-2 border-l pl-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase">נוסח</h4>
                <div className="flex flex-col gap-1 overflow-auto">
                    {tocItems.map(toc => (
                        <button key={toc.id} onClick={() => { setSelectedTocId(toc.id); fetchTranslations(toc.id); }}
                            className={`text-right p-2 text-sm rounded border shadow-sm transition-all ${selectedTocId === toc.id ? "bg-blue-600 text-white" : "bg-white hover:bg-blue-50"}`}>
                            {toc.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. קובץ */}
            <div className="w-40 shrink-0 flex flex-col gap-2 border-l pl-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase">תרגום</h4>
                <div className="flex flex-col gap-1 overflow-auto">
                    {filteredTranslations.map(t => (
                        <button key={t.id} onClick={() => { setSelectedTranslationId(t.id); fetchPrayers(t.id); }}
                            className={`text-right p-2 text-sm rounded border shadow-sm ${selectedTranslationId === t.id ? "bg-indigo-600 text-white" : "bg-white"}`}>
                            {t.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. תפילה */}
            <div className="w-40 shrink-0 flex flex-col gap-2 border-l pl-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase"> תפילה</h4>
                <div className="flex flex-col gap-1 overflow-auto">
                    {prayers.map(p => (
                        <button key={p.id} onClick={() => { setSelectedPrayerId(p.id); fetchItems(selectedTranslationId!, p.id); }}
                            className={`text-right p-2 text-sm rounded border shadow-sm ${selectedPrayerId === p.id ? "bg-green-600 text-white" : "bg-white"}`}>
                            {p.values.type || p.id}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. קבוצת חלקים */}
            <div className="w-44 shrink-0 flex flex-col gap-2 border-l pl-2">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase">חלק בתפילה</h4>
                <div className="flex flex-col gap-1 overflow-auto">
                    {uniqueGroupIds.map(groupId => {
                        const firstItem = allItems.find(i => getGroupId(i.values.partId) === groupId);
                        return (
                            <button key={groupId} onClick={() => setSelectedGroupId(groupId)}
                                className={`text-right p-2 text-xs rounded border shadow-sm ${selectedGroupId === groupId ? "bg-orange-500 text-white" : "bg-white"}`}>
                                {firstItem?.values.partName || `קבוצה ${groupId}`}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 5. עורך רצף */}
            <div className="flex-1 flex flex-col gap-4 bg-white p-5 rounded-lg border shadow-inner overflow-hidden">
                {selectedGroupId ? (
                    <>
                        <div className="flex justify-between items-center border-b pb-3 sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">
                                    {allItems.find(i => getGroupId(i.values.partId) === selectedGroupId)?.values.partName}
                                </h3>
                                <p className="text-[10px] text-gray-400">עריכה של קבוצת מזהה: {selectedGroupId}</p>
                            </div>
                            <button 
                                onClick={handleSaveGroup} 
                                disabled={saving} 
                                className="px-8 py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 shadow-md disabled:opacity-50 transition-all"
                            >
                                {saving ? "שומר הכל..." : "שמור קבוצה"}
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-8 overflow-auto pb-10">
                            {allItems
                                .filter(item => getGroupId(item.values.partId) === selectedGroupId)
                                .map((item, idx) => (
                                    <div key={item.id} className="group flex flex-col gap-2">
                                        <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                                            <span>מקטע {idx + 1} | ID: {item.id}</span>
                                            <span>מזהה חלק: {item.values.partId}</span>
                                        </div>
                                        <textarea
                                            className="w-full p-4 border rounded-md font-serif text-lg leading-relaxed shadow-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none transition-all min-h-[120px] bg-gray-50 group-hover:bg-white"
                                            value={localContents[item.id] || ""}
                                            onChange={(e) => setLocalContents({...localContents, [item.id]: e.target.value})}
                                            dir="rtl"
                                        />
                                    </div>
                                ))}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-300 italic flex-col gap-2">
                        <span className="text-4xl">📂</span>
                        <span>בחר קבוצה מהתפריט כדי להציג את רצף הטקסט</span>
                    </div>
                )}
            </div>
        </div>
    );
}