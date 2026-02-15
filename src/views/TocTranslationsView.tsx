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

// --- 2. לוגיקת עיצוב ---
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
    const [tocItems, setTocItems] = useState<Entity<any>[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null); 
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // States עריכה
    const [allItems, setAllItems] = useState<Entity<any>[]>([]);
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    const [availableTypes, setAvailableTypes] = useState<string[]>(["body", "title", "smallInstructions", "instructions"]);
    const [availableTitleTypes, setAvailableTitleTypes] = useState<string[]>(["H1", "H2", "H4"]);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // 1. שליפת TOC
    useEffect(() => {
        const fetchTocOnce = async () => {
            if (hasFetchedToc.current || fetchingRef.current) return;
            fetchingRef.current = true;
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

    const categories = useMemo(() => currentTranslationData?.categories || [], [currentTranslationData]);
    const prayers = useMemo(() => categories.find((c: any) => c.name === selectedCategoryName)?.prayers || [], [categories, selectedCategoryName]);
    const sections = useMemo(() => prayers.find((p: any) => p.id === selectedPrayerId)?.parts || [], [prayers, selectedPrayerId]);

    // 2. שליפת פריטים
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
            const promises = Array.from(changedIds).map(id => dataSource.saveEntity({
                path: `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`,
                entityId: id, values: localValues[id], status: "existing", collection: itemsCollection,
            }));
            await Promise.all(promises);
            setChangedIds(new Set());
            snackbar.open({ type: "success", message: "נשמר בהצלחה" });
        } catch (err) { snackbar.open({ type: "error", message: "שגיאה" }); } finally { setSaving(false); }
    };

    return (
        <div className="flex w-full h-full p-1 gap-1 bg-gray-200 overflow-hidden font-sans text-[10px]" dir="rtl">
            {/* עמודות ניווט */}
            <div className="w-24 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">1. נוסח</h4>
                {tocItems.map(toc => (
                    <button key={toc.id} onClick={() => { setSelectedTocId(toc.id); setSelectedTranslationIndex(null); setSelectedCategoryName(null); setSelectedPrayerId(null); setSelectedGroupId(null); }}
                        className={`text-right p-1.5 rounded border ${selectedTocId === toc.id ? "bg-blue-600 text-white shadow-md" : "bg-gray-50 hover:bg-blue-50"}`}>
                        {toc.id}
                    </button>
                ))}
            </div>

            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">2. תרגום</h4>
                {currentTocData?.translations?.map((trans: any, index: number) => (
                    <button key={index} onClick={() => { setSelectedTranslationIndex(index); setSelectedCategoryName(null); setSelectedPrayerId(null); setSelectedGroupId(null); }}
                        className={`text-right p-1.5 rounded border ${selectedTranslationIndex === index ? "bg-purple-600 text-white shadow-md" : "bg-gray-50 hover:bg-purple-50"}`}>
                        {trans.translationId}
                    </button>
                ))}
            </div>

            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">3. קטגוריה</h4>
                {categories.map((cat: any) => (
                    <button key={cat.name} onClick={() => { setSelectedCategoryName(cat.name); setSelectedPrayerId(null); setSelectedGroupId(null); }}
                        className={`text-right p-1.5 rounded border ${selectedCategoryName === cat.name ? "bg-indigo-600 text-white shadow-md" : "bg-gray-50 hover:bg-indigo-50"}`}>
                        {cat.name}
                    </button>
                ))}
            </div>

            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">4. תפילה</h4>
                {prayers.map((p: any) => (
                    <button key={p.id} onClick={() => { setSelectedPrayerId(p.id); setSelectedGroupId(null); }}
                        className={`text-right p-1.5 rounded border ${selectedPrayerId === p.id ? "bg-green-600 text-white shadow-md" : "bg-gray-50 hover:bg-green-50"}`}>
                        {p.name}
                    </button>
                ))}
            </div>

            <div className="w-28 shrink-0 flex flex-col gap-1 bg-white p-1 border-l overflow-auto">
                <h4 className="font-bold text-gray-400 uppercase text-[8px] mb-1">5. מקטע</h4>
                {sections.map((s: any) => (
                    <button key={s.id} onClick={() => { setSelectedGroupId(s.id); fetchItemsForGroup(s.id); }}
                        className={`text-right p-1.5 rounded border ${selectedGroupId === s.id ? "bg-orange-500 text-white shadow-md" : "bg-gray-50 hover:bg-orange-50"}`}>
                        {s.name}
                    </button>
                ))}
            </div>

            {/* אזור עריכה */}
            <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
                {loading ? <div className="m-auto animate-pulse text-blue-500 font-bold">טוען מה-DB...</div> : selectedGroupId ? (
                    <>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b">
                            <div>
                                <h3 className="font-bold text-base text-gray-800 italic">
                                    {sections.find((s: any) => s.id === selectedGroupId)?.name}
                                </h3>
                                <p className="text-[8px] text-gray-400 uppercase tracking-tighter">{selectedTocId} / {selectedCategoryName} / {selectedPrayerId}</p>
                            </div>
                            <button onClick={handleSaveGroup} disabled={saving || changedIds.size === 0} className="px-6 py-1.5 bg-green-600 text-white rounded font-bold shadow-md hover:bg-green-700 disabled:opacity-30">
                                {saving ? "שומר..." : `שמור (${changedIds.size})`}
                            </button>
                        </div>

                        <div className="overflow-auto space-y-6 pb-10">
                            {allItems.map(item => {
                                const localItem = localValues[item.id] || {};
                                const isChanged = changedIds.has(item.id);
                                return (
                                    <div key={item.id} className="flex flex-col">
                                        <div className={`flex justify-between items-center p-1.5 rounded-t border border-b-0 ${isChanged ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"}`}>
                                            <div className="flex gap-2 items-center">
                                                <select value={localItem.type} onChange={e => updateLocalItem(item.id, "type", e.target.value)} className="text-[9px] border rounded bg-white px-1">
                                                    {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                {localItem.type === "title" && (
                                                    <select value={localItem.titleType} onChange={e => updateLocalItem(item.id, "titleType", e.target.value)} className="text-[9px] border rounded bg-white px-1 text-blue-700">
                                                        <option value="">רמה</option>
                                                        {availableTitleTypes.map(tt => <option key={tt} value={tt}>{tt}</option>)}
                                                    </select>
                                                )}
                                                {localItem.type === "body" && (
                                                    <label className="flex items-center gap-1 text-[9px] cursor-pointer">
                                                        <input type="checkbox" checked={!!localItem.fontTanach} onChange={e => updateLocalItem(item.id, "fontTanach", e.target.checked)} /> <b>תנ"ך</b>
                                                    </label>
                                                )}
                                            </div>
                                            <span className="text-[8px] text-gray-400">#{item.id}</span>
                                        </div>
                                        <textarea 
                                            className={`${getItemStyle(localItem.type, localItem.titleType, localItem.fontTanach)} ${isChanged ? "border-orange-400 ring-1 ring-orange-50 shadow-md" : "border-gray-200 focus:border-blue-400"}`}
                                            value={localItem.content}
                                            onChange={e => updateLocalItem(item.id, "content", e.target.value)}
                                            dir="rtl"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : <div className="m-auto text-gray-300 italic flex flex-col items-center gap-2">
                        <span className="text-3xl">👈</span>
                        <p>בחר מקטע לניווט</p>
                    </div>}
            </div>
        </div>
    );
}