import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
    buildCollection
} from "@firecms/cloud";

// --- 1. הגדרות אוספים מעודכנות ---
const itemsCollection = buildCollection({
    id: "items",
    path: "items",
    name: "Items",
    properties: {
        content: { dataType: "string", name: "תוכן" },
        type: { dataType: "string", name: "סוג" },
        titleType: { dataType: "string", name: "סוג כותרת" },
        fontTanach: { dataType: "boolean", name: "גופן תנך" },
        noSpace: { dataType: "boolean", name: "ללא רווח" },
        role: { dataType: "string", name: "תפקיד" },
        partId: { dataType: "string", name: "מזהה חלק" },
        partName: { dataType: "string", name: "שם חלק" },
        partIdAndName: { dataType: "string", name: "מזהה ושם" },
        itemId: { dataType: "string", name: "מזהה פריט" },
        mit_id: { dataType: "string", name: "MIT ID" },
        dateSetId: { dataType: "string", name: "Date Set ID" },
        timestamp: { dataType: "number", name: "זמן עדכון" },
        // שינוי שם השדה ל-linkedItem כדי למנוע שגיאות Type ושאילתה
        linkedItem: { dataType: "array", name: "פריטים מקושרים", of: { dataType: "string" } }
    }
});

const dbUpdateTimeCollection = buildCollection({
    id: "db-update-time",
    path: "db-update-time",
    name: "DB Update Time",
    properties: { maxTimestamp: { dataType: "number", name: "זמן עדכון" } }
});

const baseColl = buildCollection({ id: "base", path: "base", name: "base", properties: {} });

const chunkArray = (arr: any[], size: number) => {
    return Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
};

const getItemStyle = (type: string, titleType?: string, fontTanach?: boolean) => {
    let baseStyle = "w-full p-4 border rounded-b-md shadow-sm outline-none transition-all ";
    if (fontTanach) baseStyle += "font-serif text-2xl border-r-8 border-amber-200 pr-4 ";
    else baseStyle += "font-sans text-lg ";
    if (type === "title") return baseStyle + "font-bold bg-gray-50 border-r-4 border-gray-400";
    if (type === "instructions") return baseStyle + "text-base italic text-blue-700 bg-blue-50/50";
    return baseStyle + "leading-relaxed bg-white border-gray-200 min-h-[80px]";
};

export function TocTranslationsView() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    const [tocItems, setTocItems] = useState<Entity<any>[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const [allItems, setAllItems] = useState<Entity<any>[]>([]);
    const [enhancements, setEnhancements] = useState<Record<string, Entity<any>[]>>({});
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        dataSource.fetchCollection({ path: "toc", collection: baseColl }).then(setTocItems);
    }, [dataSource]);

    const currentTocData = useMemo(() => tocItems.find(t => t.id === selectedTocId)?.values as any, [tocItems, selectedTocId]);
    const currentTranslationData = useMemo(() => currentTocData?.translations?.[selectedTranslationIndex ?? -1], [currentTocData, selectedTranslationIndex]);

    const fetchItemsWithEnhancements = async (partId: string) => {
        if (!currentTranslationData || !selectedPrayerId || !currentTocData) return;
        setLoading(true);
        console.log("🚀 שליפה למקטע:", partId);

        try {
            const itemsPath = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
            const sourceEntities = await dataSource.fetchCollection({
                path: itemsPath, collection: itemsCollection, filter: { partId: ["==", partId] }
            });

            const sorted = [...sourceEntities].sort((a: any, b: any) => 
                (a.values?.mit_id || "").localeCompare(b.values?.mit_id || "", undefined, { numeric: true }));

            const sourceItemIds = sorted.map(i => i.values.itemId).filter(id => id);
            console.log("📍 מזהי מקור (itemIds):", sourceItemIds);

            const idChunks = chunkArray(sourceItemIds, 30);
            const enhancementsMap: Record<string, Entity<any>[]> = {};
            
            const enhancementPromises = currentTocData.translations.map(async (trans: any) => {
                if (trans.translationId === currentTranslationData.translationId) return;
                const tPath = `translations/${trans.translationId}/prayers/${selectedPrayerId}/items`;
                let allRelated: Entity<any>[] = [];

                for (const chunk of idChunks) {
                    const related = await dataSource.fetchCollection({
                        path: tPath, collection: itemsCollection,
                        filter: { linkedItem: ["array-contains-any", chunk] } // שימוש ב-linkedItem
                    });
                    allRelated = [...allRelated, ...related];
                }
                console.log(`📊 ${trans.translationId}: נמצאו ${allRelated.length}`);
                enhancementsMap[trans.translationId] = allRelated;
            });

            await Promise.all(enhancementPromises);

            const initialValues: Record<string, any> = {};
            sorted.forEach(item => { initialValues[item.id] = { ...item.values }; });

            setAllItems(sorted);
            setEnhancements(enhancementsMap);
            setLocalValues(initialValues);
            setSelectedGroupId(partId);
            setChangedIds(new Set());
        } catch (err) {
            console.error("❌ שגיאה:", err);
            snackbar.open({ type: "error", message: "שגיאה בטעינה" });
        } finally { setLoading(false); }
    };

    const updateLocalItem = (id: string, field: string, value: any) => {
        setLocalValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
        setChangedIds(prev => new Set(prev).add(id));
    };

    const addNewItemAt = (index: number) => {
        const newId = `new_${Date.now()}`;
        const newItem = { id: newId, values: { content: "", type: "body", partId: selectedGroupId, itemId: newId, mit_id: "" } };
        const updated = [...allItems];
        updated.splice(index, 0, newItem as any);
        setAllItems(updated);
        setLocalValues(prev => ({ ...prev, [newId]: newItem.values }));
        setChangedIds(prev => new Set(prev).add(newId));
    };

    return (
        <div className="flex w-full h-full p-1 gap-1 bg-gray-200 overflow-hidden font-sans text-[10px]" dir="rtl">
            {/* ניווט (מוצג במלואו כפי שביקשת) */}
            <div className="w-24 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">1. נוסח</h4>
                {tocItems.map(t => <button key={t.id} onClick={() => {setSelectedTocId(t.id); setSelectedTranslationIndex(null); setSelectedCategoryName(null); setSelectedPrayerId(null); setSelectedGroupId(null);}} className={`text-right p-1.5 rounded border ${selectedTocId === t.id ? "bg-blue-600 text-white" : "bg-gray-50"}`}>{t.id}</button>)}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">2. תרגום</h4>
                {currentTocData?.translations?.map((t:any, i:number) => <button key={i} onClick={() => {setSelectedTranslationIndex(i); setSelectedCategoryName(null); setSelectedPrayerId(null); setSelectedGroupId(null);}} className={`text-right p-1.5 rounded border ${selectedTranslationIndex === i ? "bg-purple-600 text-white" : "bg-gray-50"}`}>{t.translationId}</button>)}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">3. קטגוריה</h4>
                {currentTranslationData?.categories?.map((c:any) => <button key={c.name} onClick={() => {setSelectedCategoryName(c.name); setSelectedPrayerId(null); setSelectedGroupId(null);}} className={`text-right p-1.5 rounded border ${selectedCategoryName === c.name ? "bg-indigo-600 text-white" : "bg-gray-50"}`}>{c.name}</button>)}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">4. תפילה</h4>
                {currentTranslationData?.categories?.find((c:any) => c.name === selectedCategoryName)?.prayers?.map((p:any) => <button key={p.id} onClick={() => {setSelectedPrayerId(p.id); setSelectedGroupId(null);}} className={`text-right p-1.5 rounded border ${selectedPrayerId === p.id ? "bg-green-600 text-white" : "bg-gray-50"}`}>{p.name}</button>)}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 text-[8px] mb-1">5. מקטע</h4>
                {currentTranslationData?.categories?.flatMap((c:any) => c.prayers).find((p:any) => p.id === selectedPrayerId)?.parts?.map((s:any) => <button key={s.id} onClick={() => fetchItemsWithEnhancements(s.id)} className={`text-right p-1.5 rounded border ${selectedGroupId === s.id ? "bg-orange-500 text-white" : "bg-gray-50"}`}>{s.name}</button>)}
            </div>

            {/* אזור עריכה */}
            <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
                {loading ? <div className="m-auto font-bold text-blue-500 animate-pulse text-lg">טוען נתונים...</div> : selectedGroupId && (
                    <div className="overflow-auto space-y-4 px-2 pb-10">
                        <button onClick={() => addNewItemAt(0)} className="w-full py-2 border-2 border-dashed border-blue-100 text-blue-300 font-bold hover:bg-blue-50 transition-all">+ הוסף בראש המקטע</button>
                        
                        {allItems.map((item, index) => {
                            const val = localValues[item.id] || {};
                            const curItemId = val.itemId;
                            // חיפוש פירושים מקושרים לפי linkedItem
                            const related = Object.entries(enhancements).flatMap(([tId, list]) => 
                                list.filter(e => {
                                    const link = e.values?.linkedItem;
                                    return Array.isArray(link) ? link.includes(curItemId) : link === curItemId;
                                }).map(e => ({...e, tId}))
                            );

                            return (
                                <React.Fragment key={item.id}>
                                    <div className={`p-2 border rounded shadow-sm ${changedIds.has(item.id) ? "border-orange-300" : "border-gray-200"}`}>
                                        <div className="flex justify-between text-[8px] text-gray-400 mb-1">
                                            <span>itemId: {curItemId} | type: {val.type}</span>
                                            <span>MIT: {val.mit_id}</span>
                                        </div>
                                        <textarea className={getItemStyle(val.type)} value={val.content} onChange={e => updateLocalItem(item.id, "content", e.target.value)} dir="rtl" />
                                    </div>

                                    {related.length > 0 && (
                                        <div className="mr-10 border-r-4 border-blue-400 pr-3 space-y-1">
                                            {related.map(enh => (
                                                <div key={enh.id} className="p-2 bg-blue-50 border border-blue-100 rounded text-[10px] shadow-sm">
                                                    <div className="font-bold text-blue-600 text-[8px] border-b border-blue-100 mb-1 uppercase">{enh.tId}</div>
                                                    <div>{enh.values?.content}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <button onClick={() => addNewItemAt(index + 1)} className="w-full py-1 opacity-0 hover:opacity-100 bg-green-50 text-green-500 border border-dashed border-green-200 text-[8px] font-bold">+ הוסף מקטע כאן</button>
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}