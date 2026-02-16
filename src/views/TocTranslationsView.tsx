import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
    buildCollection
} from "@firecms/cloud";

// --- 1. הגדרות אוספים ---

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
        timestamp: { dataType: "number", name: "זמן עדכון" }
    }
});

const dbUpdateTimeCollection = buildCollection({
    id: "db-update-time",
    path: "db-update-time",
    name: "DB Update Time",
    properties: {
        maxTimestamp: { dataType: "number", name: "זמן עדכון מקסימלי" }
    }
});

const baseColl = buildCollection({ id: "base", path: "base", name: "base", properties: {} });

// --- 2. לוגיקת עיצוב ---
const getItemStyle = (type: string, titleType?: string, fontTanach?: boolean) => {
    let baseStyle = "w-full p-4 border rounded-b-md shadow-sm outline-none transition-all ";
    if (fontTanach) baseStyle += "font-serif text-2xl border-r-8 border-amber-200 pr-4 ";
    else baseStyle += "font-sans text-lg ";

    switch (type) {
        case "title":
            if (titleType === "H1") return baseStyle + "text-3xl font-black text-center bg-blue-100 border-blue-600 text-blue-900 border-b-4";
            if (titleType === "H2") return baseStyle + "text-xl font-black text-center bg-blue-50 border-blue-400 text-blue-900";
            return baseStyle + "font-bold border-r-4 border-gray-400 bg-gray-50";
        case "instructions":
            return baseStyle + "text-base italic text-blue-700 bg-blue-50/50 border-blue-200";
        default:
            return baseStyle + "leading-relaxed bg-white border-gray-200 min-h-[100px]";
    }
};

export function TocTranslationsView() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    const hasFetchedToc = useRef(false);
    const fetchingRef = useRef(false);

    // States ניווט
    const [tocItems, setTocItems] = useState<Entity<any>[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null); 
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // States עריכה
    const [allItems, setAllItems] = useState<Entity<any>[]>([]);
    const [entitiesToDelete, setEntitiesToDelete] = useState<Entity<any>[]>([]);
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    
    const [availableTypes] = useState<string[]>(["body", "title", "smallInstructions", "instructions"]);
    const [availableTitleTypes] = useState<string[]>(["H1", "H2", "H4"]);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // שליפת TOC
    useEffect(() => {
        const fetchTocOnce = async () => {
            if (hasFetchedToc.current || fetchingRef.current) return;
            fetchingRef.current = true;
            try {
                const entities = await dataSource.fetchCollection({ path: "toc", collection: baseColl });
                setTocItems(entities);
                hasFetchedToc.current = true;
            } catch (e) { snackbar.open({ type: "error", message: "שגיאה בטעינה" }); }
            finally { fetchingRef.current = false; }
        };
        fetchTocOnce();
    }, [dataSource, snackbar]);

    const currentTocData = useMemo(() => tocItems.find(t => t.id === selectedTocId)?.values as any, [tocItems, selectedTocId]);
    const currentTranslationData = useMemo(() => {
        if (selectedTranslationIndex === null || !currentTocData) return null;
        return currentTocData.translations?.[selectedTranslationIndex];
    }, [currentTocData, selectedTranslationIndex]);

    const currentSection = useMemo(() => {
        if (!currentTranslationData || !selectedCategoryName || !selectedPrayerId || !selectedGroupId) return null;
        return currentTranslationData.categories
            ?.find((c: any) => c.name === selectedCategoryName)
            ?.prayers?.find((p: any) => p.id === selectedPrayerId)
            ?.parts?.find((s: any) => s.id === selectedGroupId);
    }, [currentTranslationData, selectedCategoryName, selectedPrayerId, selectedGroupId]);

    const fetchItemsForGroup = async (partId: string) => {
        if (!currentTranslationData || !selectedPrayerId) return;
        setLoading(true);
        try {
            const entities = await dataSource.fetchCollection({
                path: `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`,
                collection: itemsCollection,
                filter: { partId: ["==", partId] }
            });
            const sorted = [...entities].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
            const initialValues: Record<string, any> = {};
            sorted.forEach(item => {
                initialValues[item.id] = { ...item.values };
            });
            setAllItems(sorted);
            setLocalValues(initialValues);
            setChangedIds(new Set());
            setEntitiesToDelete([]);
            setSelectedGroupId(partId);
        } catch (err) { snackbar.open({ type: "error", message: "שגיאה בטעינת פריטים" }); }
        finally { setLoading(false); }
    };

    const updateLocalItem = (id: string, field: string, value: any) => {
        setLocalValues(prev => ({ 
            ...prev, 
            [id]: { ...prev[id], [field]: value, timestamp: Date.now() } 
        }));
        setChangedIds(prev => new Set(prev).add(id));
    };

    const addNewItemAt = (index: number) => {
        if (!selectedGroupId || !currentSection) return;

        let newIdNum: number;
        if (index === -1) {
            const lastItem = allItems[allItems.length - 1];
            newIdNum = lastItem ? parseInt(lastItem.id) + 10 : parseInt(selectedGroupId + "00010");
        } else if (index === 0) {
            newIdNum = allItems.length > 0 ? parseInt(allItems[0].id) - 5 : parseInt(selectedGroupId + "00010");
        } else {
            const prevId = parseInt(allItems[index - 1].id);
            const nextId = parseInt(allItems[index].id);
            newIdNum = Math.floor((prevId + nextId) / 2);
        }

        const newId = newIdNum.toString();
        const newItemValues = {
            content: "", type: "body", titleType: "", fontTanach: false,
            noSpace: false, role: "", partId: selectedGroupId,
            partName: currentSection.name || "",
            partIdAndName: `${selectedGroupId} ${currentSection.name || ""}`,
            dateSetId: "100", itemId: newId, mit_id: newId,
            timestamp: Date.now()
        };

        const newEntity: any = { id: newId, values: newItemValues };
        const newAllItems = [...allItems];
        if (index === -1) newAllItems.push(newEntity); else newAllItems.splice(index, 0, newEntity);
        
        setAllItems(newAllItems);
        setLocalValues(prev => ({ ...prev, [newId]: newItemValues }));
        setChangedIds(prev => new Set(prev).add(newId));
    };

    const handleDeleteClick = (id: string) => {
        if (window.confirm(`למחוק את פריט #${id}?`)) {
            const entityToRemove = allItems.find(item => item.id === id);
            if (entityToRemove) {
                if (entityToRemove.path) setEntitiesToDelete(prev => [...prev, entityToRemove]);
                setAllItems(prev => prev.filter(item => item.id !== id));
                if (changedIds.has(id)) {
                    const newChanged = new Set(changedIds);
                    newChanged.delete(id);
                    setChangedIds(newChanged);
                }
            }
        }
    };

    // --- שמירה עם עדכון Timestamp סופי ---
    const handleSaveGroup = async () => {
        if (!currentTranslationData || (changedIds.size === 0 && entitiesToDelete.length === 0)) return;
        setSaving(true);
        const path = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
        const now = Date.now(); // חותמת זמן אחידה לכל השמירה הנוכחית

        try {
            // 1. מחיקות
            const deletePromises = entitiesToDelete.map(entity => dataSource.deleteEntity({ entity }));

            // 2. שמירות עם Timestamp מעודכן לרגע השמירה
            const savePromises = Array.from(changedIds).map(id => {
                const isNew = !allItems.find(i => i.id === id)?.path; 
                const valuesWithFreshTimestamp = {
                    ...localValues[id],
                    timestamp: now // הבטחת רעננות הנתון ב-DB
                };

                return dataSource.saveEntity({
                    path, 
                    entityId: id, 
                    values: valuesWithFreshTimestamp, 
                    status: isNew ? "new" : "existing", 
                    collection: itemsCollection,
                });
            });

            await Promise.all([...deletePromises, ...savePromises]);
            setChangedIds(new Set());
            setEntitiesToDelete([]);
            fetchItemsForGroup(selectedGroupId!);
            snackbar.open({ type: "success", message: "נשמר בהצלחה עם חותמת זמן מעודכנת" });
        } catch (err) { 
            console.error(err);
            snackbar.open({ type: "error", message: "שגיאה בשמירה" }); 
        } finally { setSaving(false); }
    };

    const handleFinalPublish = async () => {
        if (!selectedTocId) return;
        setSaving(true);
        const newTimestamp = Date.now();
        try {
            await dataSource.saveEntity({
                path: "db-update-time", entityId: selectedTocId,
                values: { maxTimestamp: newTimestamp }, status: "existing", collection: dbUpdateTimeCollection
            });
            const BAGEL_TOKEN = (import.meta as any).env.VITE_BAGEL_TOKEN;
            await fetch(`https://api.bageldb.com/v1/collection/update_time/items/${selectedTocId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${BAGEL_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ timestamp: newTimestamp })
            });
            snackbar.open({ type: "success", message: "פורסם בהצלחה!" });
        } catch (err) { snackbar.open({ type: "error", message: "נכשל הפרסום" }); }
        finally { setSaving(false); }
    };

    return (
        <div className="flex w-full h-full p-1 gap-1 bg-gray-200 overflow-hidden font-sans text-[10px]" dir="rtl">
            {/* ניווט (תפריטים צדדיים) */}
            <div className="w-24 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">1. נוסח</h4>
                {tocItems.map(toc => (
                    <button key={toc.id} onClick={() => { setSelectedTocId(toc.id); setSelectedTranslationIndex(null); setSelectedCategoryName(null); setSelectedPrayerId(null); setSelectedGroupId(null); setAllItems([]); setChangedIds(new Set()); }}
                        className={`text-right p-1.5 rounded border ${selectedTocId === toc.id ? "bg-blue-600 text-white shadow-md" : "bg-gray-50 hover:bg-blue-50"}`}>
                        {toc.id}
                    </button>
                ))}
            </div>
            {/* ... עמודות תרגום, קטגוריה, תפילה ... */}
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">2. תרגום</h4>
                {currentTocData?.translations?.map((trans: any, index: number) => (
                    <button key={index} onClick={() => { setSelectedTranslationIndex(index); setSelectedCategoryName(null); setSelectedPrayerId(null); setSelectedGroupId(null); setAllItems([]); setChangedIds(new Set()); }}
                        className={`text-right p-1.5 rounded border ${selectedTranslationIndex === index ? "bg-purple-600 text-white shadow-md" : "bg-gray-50 hover:bg-purple-50"}`}>
                        {trans.translationId}
                    </button>
                ))}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">3. קטגוריה</h4>
                {currentTranslationData?.categories?.map((cat: any) => (
                    <button key={cat.name} onClick={() => { setSelectedCategoryName(cat.name); setSelectedPrayerId(null); setSelectedGroupId(null); setAllItems([]); setChangedIds(new Set()); }}
                        className={`text-right p-1.5 rounded border ${selectedCategoryName === cat.name ? "bg-indigo-600 text-white shadow-md" : "bg-gray-50 hover:bg-indigo-50"}`}>
                        {cat.name}
                    </button>
                ))}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">4. תפילה</h4>
                {currentTranslationData?.categories?.find((c:any)=>c.name === selectedCategoryName)?.prayers?.map((p: any) => (
                    <button key={p.id} onClick={() => { setSelectedPrayerId(p.id); setSelectedGroupId(null); setAllItems([]); setChangedIds(new Set()); }}
                        className={`text-right p-1.5 rounded border ${selectedPrayerId === p.id ? "bg-green-600 text-white shadow-md" : "bg-gray-50 hover:bg-green-50"}`}>
                        {p.name}
                    </button>
                ))}
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">5. מקטע</h4>
                {currentTranslationData?.categories?.find((c:any)=>c.name === selectedCategoryName)?.prayers?.find((p:any)=>p.id === selectedPrayerId)?.parts?.map((s: any) => (
                    <button key={s.id} onClick={() => { if(changedIds.size > 0 && !window.confirm("שינויים לא נשמרו. להמשיך?")) return; fetchItemsForGroup(s.id); }}
                        className={`text-right p-1.5 rounded border ${selectedGroupId === s.id ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 hover:bg-orange-50"}`}>
                        {s.name}
                    </button>
                ))}
            </div>

            {/* אזור עריכה מרכזי */}
            <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
                {loading ? <div className="m-auto text-sm animate-pulse">טוען נתונים...</div> : selectedGroupId ? (
                    <>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                            <div>
                                <h3 className="font-bold text-base">{currentSection?.name}</h3>
                                <p className="text-[7px] text-gray-400 uppercase tracking-widest">{selectedGroupId}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSaveGroup} disabled={saving || (changedIds.size === 0 && entitiesToDelete.length === 0)} className="px-4 py-1.5 bg-green-600 text-white rounded font-bold hover:bg-green-700 disabled:opacity-30">
                                    {saving ? "שומר..." : "שמור מקטע"}
                                </button>
                                <button onClick={handleFinalPublish} disabled={saving} className="px-4 py-1.5 bg-blue-800 text-white rounded font-bold border-2 border-blue-400">
                                    🚀 פרסום סנכרון
                                </button>
                            </div>
                        </div>

                        <div className="overflow-auto space-y-2 pb-10 px-2">
                            <button onClick={() => addNewItemAt(0)} className="w-full py-1 opacity-0 hover:opacity-100 bg-blue-50 text-blue-500 border border-dashed border-blue-200 rounded transition-all font-bold">+ הוסף פריט בראש הרשימה</button>
                            
                            {allItems.map((item, index) => {
                                const localItem = localValues[item.id] || {};
                                const isChanged = changedIds.has(item.id);
                                return (
                                    <React.Fragment key={item.id}>
                                        <div className="flex flex-col group relative">
                                            <div className={`flex justify-between items-center p-1 rounded-t border border-b-0 ${isChanged ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                                                <div className="flex gap-2 items-center">
                                                    <select value={localItem.type} onChange={e => updateLocalItem(item.id, "type", e.target.value)} className="text-[9px] border rounded bg-white px-1">
                                                        {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                    {localItem.type === "title" && (
                                                        <select value={localItem.titleType} onChange={e => updateLocalItem(item.id, "titleType", e.target.value)} className="text-[9px] border rounded bg-white px-1 font-bold">
                                                            <option value="">רמה</option>
                                                            {availableTitleTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                                                        </select>
                                                    )}
                                                    <label className="flex items-center gap-1 text-[8px] cursor-pointer mr-2 border-r pr-2">
                                                        <input type="checkbox" checked={!!localItem.noSpace} onChange={e => updateLocalItem(item.id, "noSpace", e.target.checked)} /> ללא רווח
                                                    </label>
                                                    <button onClick={() => handleDeleteClick(item.id)} className="text-[10px] text-red-400 hover:text-red-700 font-bold px-2 transition-transform hover:scale-125">🗑️</button>
                                                </div>
                                                <div className="flex gap-2 items-center text-[7px] text-gray-400">
                                                    <span>MIT: {localItem.mit_id}</span>
                                                    <span className="opacity-30">|</span>
                                                    <span>ID: {item.id}</span>
                                                </div>
                                            </div>
                                            <textarea 
                                                className={getItemStyle(localItem.type, localItem.titleType, localItem.fontTanach) + (isChanged ? " border-orange-400 ring-1 ring-orange-100" : "")}
                                                value={localItem.content}
                                                onChange={e => updateLocalItem(item.id, "content", e.target.value)}
                                                dir="rtl"
                                            />
                                        </div>
                                        <button onClick={() => addNewItemAt(index + 1)} className="w-full py-1 opacity-0 hover:opacity-100 bg-blue-50 text-blue-500 border border-dashed border-blue-200 rounded transition-all font-bold">+ הוסף פריט כאן</button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </>
                ) : <div className="m-auto text-gray-300 italic border p-8 rounded-lg bg-gray-50/50">בחר מקטע מהתפריט הימני כדי להתחיל בעריכה</div>}
            </div>
        </div>
    );
}