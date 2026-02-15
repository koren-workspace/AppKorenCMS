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
        partId: { dataType: "string", name: "מזהה חלק" } 
    }
});

const baseColl = buildCollection({ id: "base", path: "base", name: "base", properties: {} });

type GenericEntity = Entity<any>;

// --- 2. לוגיקת עיצוב לפי סוג (כולל תמיכה ב-H1) ---
const getItemStyle = (type: string, titleType?: string, fontTanach?: boolean) => {
    let baseStyle = "w-full p-4 border rounded-b-md shadow-sm outline-none transition-all ";
    
    if (fontTanach) baseStyle += "font-serif text-2xl border-r-8 border-amber-200 pr-4 ";
    else baseStyle += "font-sans text-lg ";

    switch (type) {
        case "title":
            if (titleType === "H1") return baseStyle + "text-3xl font-black text-center bg-blue-100 border-blue-600 text-blue-900 border-b-4 min-h-[80px]";
            if (titleType === "H2") return baseStyle + "text-xl font-black text-center bg-blue-50 border-blue-400 text-blue-900 min-h-[60px]";
            if (titleType === "H4") return baseStyle + "text-lg font-bold border-r-4 border-blue-300 bg-slate-50 min-h-[50px]";
            return baseStyle + "font-bold border-r-4 border-gray-400 bg-gray-50";
        case "smallInstructions":
            return baseStyle + "text-sm italic text-gray-500 bg-gray-50 border-dashed border-gray-300 min-h-[40px] leading-tight";
        case "instructions":
            return baseStyle + "text-base italic text-blue-700 bg-blue-50/50 border-blue-200 min-h-[60px]";
        case "body":
        default:
            return baseStyle + "leading-relaxed bg-white border-gray-200 min-h-[120px]";
    }
};

export function TocTranslationsView() {
    const dataSource = useDataSource();
    const snackbar = useSnackbarController();

    const hasFetchedToc = useRef(false);
    const fetchingRef = useRef(false);

    // States ניווט
    const [tocItems, setTocItems] = useState<GenericEntity[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = useState<number | null>(null);
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // States עריכה
    const [allItems, setAllItems] = useState<GenericEntity[]>([]);
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    
    // רשימות סוגים דינמיות
    const [availableTypes, setAvailableTypes] = useState<string[]>(["body", "title", "smallInstructions", "instructions"]);
    const [availableTitleTypes, setAvailableTitleTypes] = useState<string[]>(["H1", "H2", "H4"]);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // 1. שליפת TOC (💰 קריאה אחת בלבד)
    useEffect(() => {
        const fetchTocOnce = async () => {
            if (hasFetchedToc.current || fetchingRef.current) return;
            fetchingRef.current = true;
            console.log("💰 קריאה ל-DB: שליפת TOC");
            try {
                const entities = await dataSource.fetchCollection({ path: "toc", collection: baseColl });
                setTocItems(entities);
                hasFetchedToc.current = true;
            } catch (e) { console.error(e); } finally { fetchingRef.current = false; }
        };
        fetchTocOnce();
    }, [dataSource]);

    const currentTocData = useMemo(() => tocItems.find(t => t.id === selectedTocId)?.values as any, [tocItems, selectedTocId]);
    const currentTranslationData = useMemo(() => {
        if (selectedTranslationIndex === null || !currentTocData) return null;
        return currentTocData.translations?.[selectedTranslationIndex];
    }, [currentTocData, selectedTranslationIndex]);

    const sections = useMemo(() => {
        if (!currentTranslationData || !selectedPrayerId) return [];
        let foundParts: any[] = [];
        (currentTranslationData.categories || []).forEach((cat: any) => {
            const prayer = (cat.prayers || []).find((p: any) => p.id === selectedPrayerId);
            if (prayer && prayer.parts) foundParts = prayer.parts;
        });
        return foundParts.map(p => ({ id: p.id, name: p.name || "ללא שם" }));
    }, [currentTranslationData, selectedPrayerId]);

    // 2. שליפת פריטים + זיהוי סוגים דינמי
    const fetchItemsForGroup = async (partId: string) => {
        if (!currentTranslationData || !selectedPrayerId) return;
        const transId = currentTranslationData.translationId;
        console.log(`💰 קריאה ל-DB: שליפת פריטים עבור ${partId}`);
        setLoading(true);
        try {
            const entities = await dataSource.fetchCollection({
                path: `translations/${transId}/prayers/${selectedPrayerId}/items`,
                collection: itemsCollection,
                filter: { partId: ["==", partId] }
            });
            
            const sorted = [...entities].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

            // עדכון רשימת הסוגים לפי מה שיש ב-DB באמת
            const foundTypes = new Set(availableTypes);
            const foundTitleTypes = new Set(availableTitleTypes);
            
            sorted.forEach(item => {
                const v = item.values as any;
                if (v.type) foundTypes.add(v.type);
                if (v.titleType) foundTitleTypes.add(v.titleType);
            });
            setAvailableTypes(Array.from(foundTypes));
            setAvailableTitleTypes(Array.from(foundTitleTypes).filter(t => t));

            const initialValues: Record<string, any> = {};
            sorted.forEach(item => {
                const v = item.values as any;
                initialValues[item.id] = {
                    content: v.content || "", type: v.type || "body",
                    titleType: v.titleType || "", fontTanach: !!v.fontTanach,
                    noSpace: !!v.noSpace, role: v.role || ""
                };
            });
            setAllItems(sorted);
            setLocalValues(initialValues);
            setChangedIds(new Set());
        } finally { setLoading(false); }
    };

    const updateLocalItem = (id: string, field: string, value: any) => {
        setLocalValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
        setChangedIds(prev => new Set(prev).add(id));
    };

    const handleSaveGroup = async () => {
        if (!currentTranslationData || changedIds.size === 0) return;
        setSaving(true);
        try {
            const transId = currentTranslationData.translationId;
            const promises = Array.from(changedIds).map(id => dataSource.saveEntity({
                path: `translations/${transId}/prayers/${selectedPrayerId}/items`,
                entityId: id, values: localValues[id], status: "existing", collection: itemsCollection,
            }));
            await Promise.all(promises);
            setChangedIds(new Set());
            snackbar.open({ type: "success", message: "נשמר בהצלחה" });
        } catch (err) { snackbar.open({ type: "error", message: "שגיאה בשמירה" }); } finally { setSaving(false); }
    };

    return (
        <div className="flex w-full h-full p-2 gap-2 bg-gray-100 overflow-hidden font-sans text-[11px]" dir="rtl">
            {/* עמודות ניווט */}
            <div className="w-32 shrink-0 flex flex-col gap-1 border-l pl-1 overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[9px]">1. נוסח</h4>
                {tocItems.map(toc => (
                    <button key={toc.id} onClick={() => { setSelectedTocId(toc.id); setSelectedTranslationIndex(null); setSelectedPrayerId(null); setSelectedGroupId(null); }}
                        className={`text-right p-2 rounded border transition-all ${selectedTocId === toc.id ? "bg-blue-600 text-white shadow-sm" : "bg-white hover:bg-blue-50"}`}>
                        {toc.id}
                    </button>
                ))}
            </div>

            <div className="w-32 shrink-0 flex flex-col gap-1 border-l pl-1 overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[9px]">2. תרגום</h4>
                {currentTocData?.translations?.map((trans: any, index: number) => (
                    <button key={index} onClick={() => { setSelectedTranslationIndex(index); setSelectedPrayerId(null); setSelectedGroupId(null); }}
                        className={`text-right p-2 rounded border transition-all ${selectedTranslationIndex === index ? "bg-purple-600 text-white shadow-sm" : "bg-white hover:bg-purple-50"}`}>
                        {trans.translationId}
                    </button>
                ))}
            </div>

            <div className="w-32 shrink-0 flex flex-col gap-1 border-l pl-1 overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[9px]">3. תפילה</h4>
                {currentTranslationData?.categories?.map((cat: any) => 
                    cat.prayers?.map((p: any) => (
                        <button key={p.id} onClick={() => { setSelectedPrayerId(p.id); setSelectedGroupId(null); }}
                            className={`text-right p-2 rounded border transition-all ${selectedPrayerId === p.id ? "bg-green-600 text-white shadow-sm" : "bg-white hover:bg-green-50"}`}>
                            {p.name}
                        </button>
                    ))
                )}
            </div>

            <div className="w-36 shrink-0 flex flex-col gap-1 border-l pl-1 overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[9px]">4. מקטע</h4>
                {sections.map(s => (
                    <button key={s.id} onClick={() => { setSelectedGroupId(s.id); fetchItemsForGroup(s.id); }}
                        className={`text-right p-2 rounded border transition-all ${selectedGroupId === s.id ? "bg-orange-500 text-white shadow-sm" : "bg-white hover:bg-orange-50"}`}>
                        {s.name}
                    </button>
                ))}
            </div>

            {/* אזור עריכה מעוצב */}
            <div className="flex-1 bg-white p-5 rounded-lg border shadow-xl overflow-hidden flex flex-col">
                {loading ? <div className="m-auto animate-pulse text-blue-500 font-bold italic">טוען מה-DB...</div> : selectedGroupId ? (
                    <>
                        <div className="flex justify-between items-center mb-6 pb-3 border-b sticky top-0 bg-white z-10">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 italic">עריכת: {sections.find(s => s.id === selectedGroupId)?.name}</h3>
                                <p className="text-[9px] text-gray-400 uppercase tracking-widest">ID: {selectedGroupId}</p>
                            </div>
                            <button onClick={handleSaveGroup} disabled={saving || changedIds.size === 0} className="px-8 py-2 bg-green-600 text-white rounded-md font-bold shadow-lg hover:bg-green-700 disabled:opacity-30 transition-all">
                                {saving ? "שומר..." : `שמור ${changedIds.size > 0 ? `(${changedIds.size})` : ""}`}
                            </button>
                        </div>

                        <div className="overflow-auto space-y-8 pb-10 px-2">
                            {allItems.map(item => {
                                const localItem = localValues[item.id] || {};
                                const isChanged = changedIds.has(item.id);

                                return (
                                    <div key={item.id} className="flex flex-col group">
                                        {/* סרגל כלים לכל פריט */}
                                        <div className={`flex justify-between items-center p-2 rounded-t-md border border-b-0 transition-colors ${isChanged ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                                            <div className="flex gap-3 items-center">
                                                <select value={localItem.type} onChange={e => updateLocalItem(item.id, "type", e.target.value)} 
                                                    className="text-[10px] font-bold border rounded px-1 py-0.5 bg-white outline-none focus:ring-1 ring-blue-400">
                                                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>

                                                {localItem.type === "title" && (
                                                    <select value={localItem.titleType} onChange={e => updateLocalItem(item.id, "titleType", e.target.value)} 
                                                        className="text-[10px] border rounded px-1 py-0.5 bg-white font-medium text-blue-700">
                                                        <option value="">ללא רמה</option>
                                                        {availableTitleTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                                                    </select>
                                                )}

                                                {localItem.type === "body" && (
                                                    <div className="flex gap-3 items-center border-r pr-3 ml-2">
                                                        <label className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
                                                            <input type="checkbox" checked={!!localItem.fontTanach} onChange={e => updateLocalItem(item.id, "fontTanach", e.target.checked)} /> 
                                                            <span className="font-serif font-bold italic">תנ"ך</span>
                                                        </label>
                                                        <input className="text-[10px] border rounded px-2 py-0.5 w-20 bg-white" placeholder="תפקיד" value={localItem.role || ""} onChange={e => updateLocalItem(item.id, "role", e.target.value)} />
                                                    </div>
                                                )}
                                                
                                                {(localItem.type === "body" || localItem.type === "smallInstructions") && (
                                                    <label className="flex items-center gap-1 text-[10px] cursor-pointer border-r pr-3 select-none">
                                                        <input type="checkbox" checked={!!localItem.noSpace} onChange={e => updateLocalItem(item.id, "noSpace", e.target.checked)} /> 
                                                        <span>ללא רווח</span>
                                                    </label>
                                                )}
                                            </div>
                                            <span className="text-[9px] text-gray-400 font-mono italic">#{item.id}</span>
                                        </div>

                                        {/* תיבת הטקסט עם העיצוב הדינמי */}
                                        <textarea 
                                            className={`${getItemStyle(localItem.type, localItem.titleType, localItem.fontTanach)} ${isChanged ? "border-orange-400 ring-2 ring-orange-50 shadow-md" : "border-gray-200 focus:border-blue-400 focus:ring-2 ring-blue-50"}`}
                                            value={localItem.content}
                                            onChange={e => updateLocalItem(item.id, "content", e.target.value)}
                                            dir="rtl"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : <div className="m-auto text-gray-300 italic flex flex-col items-center gap-4 select-none">
                        <span className="text-5xl animate-bounce">⬅️</span>
                        <p className="text-lg font-medium">בחר מקטע מהעמודה הרביעית כדי לערוך</p>
                    </div>}
            </div>
        </div>
    );
}