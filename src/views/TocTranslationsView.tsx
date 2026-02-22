import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
    useDataSource,
    useSnackbarController,
    Entity,
    buildCollection
} from "@firecms/cloud";
import {
    getPrayerCategoriesFromTranslation,
    getPrayersForCategory,
    getPartsForPrayer
} from "./toc-translations/services/navigationService";
import { PrayerNavigationColumns } from "./toc-translations/components/PrayerNavigationColumns";
import { TocAndTranslationColumns } from "./toc-translations/components/TocAndTranslationColumns";

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
        timestamp: { dataType: "number", name: "זמן עדכון" },
        // השדה המדויק לפי ה-Database שלך
        linkedItem: { dataType: "array", name: "פריטים מקושרים", of: { dataType: "string" } }
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
    const logPrefix = "[TocTranslations]";

    // ניווט
    const [tocItems, setTocItems] = useState<Entity<any>[]>([]);
    const [selectedTocId, setSelectedTocId] = useState<string | null>(null);
    const [selectedTranslationIndex, setSelectedTranslationIndex] = useState<number | null>(null);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
    const [selectedPrayerId, setSelectedPrayerId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    // עריכה
    const [allItems, setAllItems] = useState<Entity<any>[]>([]);
    const [enhancements, setEnhancements] = useState<Record<string, Entity<any>[]>>({});
    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const startedAt = Date.now();
        console.info(`${logPrefix} TOC fetch start`, { online: navigator.onLine });
        dataSource.fetchCollection({ path: "toc", collection: baseColl })
            .then((items) => {
                console.info(`${logPrefix} TOC fetch success`, {
                    count: items.length,
                    elapsedMs: Date.now() - startedAt
                });
                setTocItems(items);
            })
            .catch((error) => {
                console.error(`${logPrefix} TOC fetch failed`, error);
                snackbar.open({ type: "error", message: "שגיאה בטעינת רשימת נוסחים" });
            });
    }, [dataSource]);

    const currentTocData = useMemo(() => tocItems.find(t => t.id === selectedTocId)?.values as any, [tocItems, selectedTocId]);
    const currentTranslationData = useMemo(() => currentTocData?.translations?.[selectedTranslationIndex ?? -1], [currentTocData, selectedTranslationIndex]);
    const currentCategories = useMemo(
        () => getPrayerCategoriesFromTranslation(currentTranslationData),
        [currentTranslationData]
    );
    const currentPrayers = useMemo(
        () => getPrayersForCategory(currentCategories, selectedCategoryName),
        [currentCategories, selectedCategoryName]
    );
    const currentParts = useMemo(
        () => getPartsForPrayer(currentCategories, selectedPrayerId),
        [currentCategories, selectedPrayerId]
    );

    const fetchItemsWithEnhancements = async (partId: string) => {
        if (!currentTranslationData || !selectedPrayerId || !currentTocData) return;
        const startedAt = Date.now();
        setLoading(true);
        console.info(`${logPrefix} Part fetch start`, {
            tocId: selectedTocId,
            translationId: currentTranslationData.translationId,
            prayerId: selectedPrayerId,
            partId
        });
        try {
            const itemsPath = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
            const sourceEntities = await dataSource.fetchCollection({
                path: itemsPath, collection: itemsCollection, filter: { partId: ["==", partId] }
            });

            const sorted = [...sourceEntities].sort((a: any, b: any) => 
                (a.values?.mit_id || "").localeCompare(b.values?.mit_id || "", undefined, { numeric: true }));

            const sourceItemIds = sorted.map(i => i.values.itemId).filter(id => id);
            const idChunks = chunkArray(sourceItemIds, 30);
            const enhancementsMap: Record<string, Entity<any>[]> = {};
            
            const enhancementPromises = currentTocData.translations.map(async (trans: any) => {
                if (trans.translationId === currentTranslationData.translationId) return;
                const tPath = `translations/${trans.translationId}/prayers/${selectedPrayerId}/items`;
                let allRelated: Entity<any>[] = [];
                for (const chunk of idChunks) {
                    const related = await dataSource.fetchCollection({
                        path: tPath, collection: itemsCollection,
                        filter: { linkedItem: ["array-contains-any", chunk] }
                    });
                    allRelated = [...allRelated, ...related];
                }
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
            console.info(`${logPrefix} Part fetch success`, {
                itemsCount: sorted.length,
                enhancementsTranslationsCount: Object.keys(enhancementsMap).length,
                elapsedMs: Date.now() - startedAt
            });
        } catch (err) {
            console.error(`${logPrefix} Part fetch failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בטעינת נתונים" });
        } finally { setLoading(false); }
    };

    const updateLocalItem = (id: string, field: string, value: any) => {
        setLocalValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: value, timestamp: Date.now() } }));
        setChangedIds(prev => new Set(prev).add(id));
    };

    const handleSaveGroup = async () => {
        if (!currentTranslationData || changedIds.size === 0) return;
        const startedAt = Date.now();
        setSaving(true);
        const path = `translations/${currentTranslationData.translationId}/prayers/${selectedPrayerId}/items`;
        const now = Date.now();
        const changedIdList = Array.from(changedIds);
        const hasNewItems = changedIdList.some(id => id.startsWith("new_"));
        console.info(`${logPrefix} Save start`, {
            changedItemsCount: changedIdList.length,
            hasNewItems
        });
        try {
            const savePromises = changedIdList.map(id => {
                const isNew = id.startsWith("new_");
                return dataSource.saveEntity({
                    path,
                    entityId: isNew ? undefined : id,
                    values: { ...localValues[id], timestamp: now },
                    status: isNew ? "new" : "existing",
                    collection: itemsCollection,
                });
            });
            await Promise.all(savePromises);
            snackbar.open({ type: "success", message: "המקטע נשמר בהצלחה (מקומי)" });
            setChangedIds(new Set());
            console.info(`${logPrefix} Save success`, {
                elapsedMs: Date.now() - startedAt,
                reloadedAfterSave: hasNewItems
            });
            if (hasNewItems && selectedGroupId) {
                await fetchItemsWithEnhancements(selectedGroupId);
            }
        } catch (err) {
            console.error(`${logPrefix} Save failed`, err);
            snackbar.open({ type: "error", message: "שגיאה בשמירה" });
        }
        finally { setSaving(false); }
    };

    const handleFinalPublish = async () => {
        if (!selectedTocId) return;
        const startedAt = Date.now();
        setSaving(true);
        const newTimestamp = Date.now();
        console.info(`${logPrefix} Publish start`, { tocId: selectedTocId });
        try {
            // 1. עדכון Firestore לצורך סנכרון פנימי
            await dataSource.saveEntity({
                path: "db-update-time", entityId: selectedTocId,
                values: { maxTimestamp: newTimestamp }, status: "existing", collection: dbUpdateTimeCollection
            });

            // 2. עדכון BagelStudio (הטריגר של האפליקציה)
            const BAGEL_TOKEN = (import.meta as any).env.VITE_BAGEL_TOKEN;
            await fetch(`https://api.bageldb.com/v1/collection/updateTime/items/${selectedTocId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${BAGEL_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ timestamp: newTimestamp })
            });

            snackbar.open({ type: "success", message: "השינויים פורסמו בהצלחה לאפליקציה!" });
            console.info(`${logPrefix} Publish success`, {
                elapsedMs: Date.now() - startedAt
            });
        } catch (err) { 
            console.error(`${logPrefix} Publish failed`, err);
            snackbar.open({ type: "error", message: "נכשל הפרסום ל-Bagel" }); 
        }
        finally { setSaving(false); }
    };

    const addNewItemAt = (index: number) => {
        const newId = `new_${Date.now()}`;
        const newItemValues = { content: "", type: "body", partId: selectedGroupId, itemId: newId, mit_id: "", timestamp: Date.now() };
        const updated = [...allItems];
        updated.splice(index, 0, { id: newId, values: newItemValues } as any);
        setAllItems(updated);
        setLocalValues(prev => ({ ...prev, [newId]: newItemValues }));
        setChangedIds(prev => new Set(prev).add(newId));
    };

    return (
        <div className="flex w-full h-full p-1 gap-1 bg-gray-200 overflow-hidden font-sans text-[10px]" dir="rtl">
            {/* ניווט מלא */}
            <TocAndTranslationColumns
                tocItems={tocItems}
                selectedTocId={selectedTocId}
                onSelectToc={(tocId) => {
                    setSelectedTocId(tocId);
                    setSelectedTranslationIndex(null);
                    setSelectedCategoryName(null);
                    setSelectedPrayerId(null);
                    setSelectedGroupId(null);
                }}
                translations={currentTocData?.translations ?? []}
                selectedTranslationIndex={selectedTranslationIndex}
                onSelectTranslation={(index) => {
                    setSelectedTranslationIndex(index);
                    setSelectedCategoryName(null);
                    setSelectedPrayerId(null);
                    setSelectedGroupId(null);
                }}
            />
            <PrayerNavigationColumns
                currentCategories={currentCategories}
                selectedCategoryName={selectedCategoryName}
                onSelectCategory={(categoryName) => {
                    setSelectedCategoryName(categoryName);
                    setSelectedPrayerId(null);
                    setSelectedGroupId(null);
                }}
                currentPrayers={currentPrayers}
                selectedPrayerId={selectedPrayerId}
                onSelectPrayer={(prayerId) => {
                    setSelectedPrayerId(prayerId);
                    setSelectedGroupId(null);
                }}
                currentParts={currentParts}
                selectedGroupId={selectedGroupId}
                onSelectPart={fetchItemsWithEnhancements}
            />

            {/* עריכה */}
            <div className="flex-1 bg-white p-4 shadow-xl overflow-hidden flex flex-col">
                {selectedGroupId && (
                    <div className="flex justify-between items-center mb-4 pb-2 border-b">
                        <h3 className="font-bold text-base">{selectedGroupId}</h3>
                        <div className="flex gap-2">
                            <button onClick={handleSaveGroup} disabled={saving || changedIds.size === 0} className="px-4 py-1.5 bg-green-600 text-white rounded font-bold disabled:opacity-30">
                                {saving ? "שומר..." : "שמור מקטע"}
                            </button>
                            <button onClick={handleFinalPublish} disabled={saving} className="px-4 py-1.5 bg-blue-800 text-white rounded font-bold border-2 border-blue-400">
                                🚀 פרסום (Publish)
                            </button>
                        </div>
                    </div>
                )}

                {loading ? <div className="m-auto font-bold text-blue-500 animate-pulse text-lg">טוען...</div> : selectedGroupId && (
                    <div className="overflow-auto space-y-4 px-2 pb-10">
                        <button onClick={() => addNewItemAt(0)} className="w-full py-2 border-2 border-dashed border-blue-100 text-blue-300 font-bold hover:bg-blue-50">+ הוסף בראש המקטע</button>
                        {allItems.map((item, index) => {
                            const val = localValues[item.id] || {};
                            const curId = val.itemId;
                            const related = Object.entries(enhancements).flatMap(([tId, list]) => 
                                list.filter(e => {
                                    const link = e.values?.linkedItem;
                                    return Array.isArray(link) ? link.includes(curId) : link === curId;
                                }).map(e => ({...e, tId}))
                            );

                            return (
                                <React.Fragment key={item.id}>
                                    <div className={`p-2 border rounded ${changedIds.has(item.id) ? "border-orange-300" : "border-gray-200"}`}>
                                        <div className="flex justify-between text-[7px] text-gray-400 mb-1 uppercase tracking-tighter">
                                            <span>itemId: {curId} | MIT: {val.mit_id}</span>
                                            <span>Update: {val.timestamp ? new Date(val.timestamp).toLocaleTimeString() : 'Never'}</span>
                                        </div>
                                        <textarea className={getItemStyle(val.type)} value={val.content} onChange={e => updateLocalItem(item.id, "content", e.target.value)} dir="rtl" />
                                    </div>

                                    {related.length > 0 && (
                                        <div className="mr-8 border-r-4 border-blue-400 pr-3 space-y-1">
                                            {related.map(enh => (
                                                <div key={enh.id} className="p-2 bg-blue-50 border border-blue-100 rounded text-[10px]">
                                                    <div className="font-bold text-blue-600 mb-1">{enh.tId}</div>
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