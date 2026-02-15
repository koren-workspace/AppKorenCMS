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

    // States לניהול ה-Items והעריכה החכמה
    const [allItems, setAllItems] = useState<GenericEntity[]>([]);
    const [localContents, setLocalContents] = useState<Record<string, string>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set()); // מעקב אחרי שינויים
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

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

            // מיון מספרי מדויק למניעת בלבול בין ID ארוכים
            const sorted = [...entities].sort((a, b) => {
                const idA = String(a.values.partId ?? "");
                const idB = String(b.values.partId ?? "");
                return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            });
            
            setAllItems(sorted);

            const contents: Record<string, string> = {};
            sorted.forEach(item => { contents[item.id] = String(item.values.content ?? ""); });
            setLocalContents(contents);
            setChangedIds(new Set()); // איפוס רשימת השינויים בטעינה חדשה
            setSelectedGroupId(null);
        } finally {
            setLoading(false);
        }
    };

    // --- שמירה חכמה (רק מה שהשתנה) ---

    const handleSaveGroup = async () => {
        if (!selectedGroupId || !selectedTranslationId || !selectedPrayerId) return;

        // סינון פריטים שגם שייכים לקבוצה וגם באמת עברו שינוי
        const itemsToUpdate = allItems.filter(item => 
            getGroupId(item.values.partId) === selectedGroupId && 
            changedIds.has(item.id)
        );

        if (itemsToUpdate.length === 0) {
            snackbar.open({ type: "info", message: "לא זוהו שינויים בקבוצה זו" });
            return;
        }

        setSaving(true);
        try {
            for (const item of itemsToUpdate) {
                await dataSource.saveEntity({
                    path: `translations/${selectedTranslationId}/prayers/${selectedPrayerId}/items`,
                    entityId: item.id,
                    values: { ...item.values, content: localContents[item.id] },
                    status: "existing",
                    collection: itemsCollection,
                });
            }
            
            // ניקוי הסטטוס "השתנה" עבור הפריטים שנשמרו
            setChangedIds(prev => {
                const next = new Set(prev);
                itemsToUpdate.forEach(item => next.delete(item.id));
                return next;
            });

            snackbar.open({ type: "success", message: `נשמרו בהצלחה ${itemsToUpdate.length} מקטעים` });
        } catch (err) {
            snackbar.open({ type: "error", message: "שגיאה בשמירת הנתונים" });
        } finally {
            setSaving(false);
        }
    };

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
                <h4 className="text-[10px] font-bold text-gray-400 uppercase">תפילה</h4>
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
                        const hasChanges = allItems.some(i => getGroupId(i.values.partId) === groupId && changedIds.has(i.id));
                        
                        return (
                            <button key={groupId} onClick={() => setSelectedGroupId(groupId)}
                                className={`text-right p-2 text-xs rounded border shadow-sm relative ${selectedGroupId === groupId ? "bg-orange-500 text-white" : "bg-white"}`}>
                                {firstItem?.values.partName || `קבוצה ${groupId}`}
                                {hasChanges && <span className="absolute left-1 top-1 w-2 h-2 bg-red-400 rounded-full"></span>}
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
                                <p className="text-[10px] text-gray-400">עריכה קבוצתית | {allItems.filter(i => getGroupId(i.values.partId) === selectedGroupId).length} מקטעים</p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {changedIds.size > 0 && <span className="text-xs text-orange-600 font-bold ml-2">יש שינויים לא שמורים</span>}
                                <button 
                                    onClick={handleSaveGroup} 
                                    disabled={saving} 
                                    className="px-8 py-2 bg-green-600 text-white rounded-md font-bold hover:bg-green-700 shadow-md disabled:opacity-50 transition-all"
                                >
                                    {saving ? "שומר..." : "שמור שינויים"}
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-8 overflow-auto pb-10">
                            {allItems
                                .filter(item => getGroupId(item.values.partId) === selectedGroupId)
                                .map((item, idx) => (
                                    <div key={item.id} className="group flex flex-col gap-2">
                                        <div className="flex justify-between text-[9px] font-mono">
                                            <span className={changedIds.has(item.id) ? "text-orange-600 font-bold" : "text-gray-400"}>
                                                מקטע {idx + 1} {changedIds.has(item.id) ? "(ערוך)" : ""}
                                            </span>
                                            <span className="text-gray-300">ID: {item.id} | partId: {item.values.partId}</span>
                                        </div>
                                        <textarea
                                            className={`w-full p-4 border rounded-md font-serif text-lg leading-relaxed shadow-sm outline-none transition-all min-h-[120px] 
                                                ${changedIds.has(item.id) ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-gray-50 group-hover:bg-white"}`}
                                            value={localContents[item.id] || ""}
                                            onChange={(e) => {
                                                setLocalContents({...localContents, [item.id]: e.target.value});
                                                setChangedIds(prev => new Set(prev).add(item.id));
                                            }}
                                            dir="rtl"
                                        />
                                    </div>
                                ))}
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-300 italic flex-col gap-2">
                        <span className="text-4xl">📝</span>
                        <span>בחר קבוצת מקטעים לעריכה</span>
                    </div>
                )}
            </div>
        </div>
    );
}