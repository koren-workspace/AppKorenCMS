/**
 * בדיקות ל-partEditService – שלב ראשון: עדכון ומחיקה של פריטים קיימים
 *
 * בודקים שהשירות:
 * - קורא ל-saveEntity עם הנתונים הנכונים (path, values, timestamp, status)
 * - במחיקה: מסמן deleted: true בפריט הנוכחי ובכל התרגומים המקושרים
 *
 * השרשרת המלאה (Firestore -> Bagel -> App) נבדקת בבדיקות אינטגרציה/ידניות;
 * כאן בודקים רק את הלוגיקה של partEditService עם DataSource mock.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const firestoreBatchWrites = vi.hoisted(() => [] as Array<{ ref: any; data: any }>);
const firestoreBatchCommits = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

// מונע טעינת @firecms/cloud ו-collections (שמושכים CSS וסביבת דפדפן)
vi.mock("@firecms/cloud", () => ({ Entity: class {}, default: {} }));
vi.mock("firebase/firestore", () => ({
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn((_db: any, path: string, id: string) => ({ path, id })),
    writeBatch: vi.fn(() => ({
        set: (ref: any, data: any) => {
            firestoreBatchWrites.push({ ref, data });
        },
        commit: firestoreBatchCommits,
    })),
}));
vi.mock("../../../firebase_config", () => ({
    getFirebaseApp: vi.fn(() => ({})),
}));
vi.mock("../collections", () => ({
    itemsCollection: {},
    dbUpdateTimeCollection: {},
}));
import {
    savePartItems,
    deletePartItemAndRelatedTranslations,
    splitPartItems,
    moveItemsToPart,
    createTranslationItem,
    copyItemsToPart,
    updatePartMetadataInItems,
    type DeletePartItemParams,
    type SplitPartItemsParams,
    type MoveItemsToPartParams,
} from "./partEditService";

describe("partEditService – עדכון פריטים (savePartItems)", () => {
    const basePath = "translations/0-ashkenaz/prayers/p1/items";

    beforeEach(() => {
        vi.clearAllMocks();
        firestoreBatchWrites.length = 0;
    });

    it("עדכון רשומה אחת – קורא ל-saveEntity פעם אחת עם path, entityId, values ו-timestamp", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const dataSource = {
            fetchCollection: vi.fn(),
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const itemId = "item_100";
        const localValues: Record<string, any> = {
            [itemId]: {
                content: "תוכן מעודכן",
                type: "body",
                partId: "part1",
                itemId,
                mit_id: "100",
                timestamp: 0,
            },
        };

        await savePartItems(dataSource, {
            path: basePath,
            changedIds: [itemId],
            localValues,
        });

        expect(saveEntity).toHaveBeenCalledTimes(1);
        const call = saveEntity.mock.calls[0][0];
        expect(call.path).toBe(basePath);
        expect(call.entityId).toBe(itemId);
        expect(call.status).toBe("existing");
        expect(call.values).toMatchObject({
            content: "תוכן מעודכן",
            type: "body",
            partId: "part1",
            itemId,
            mit_id: "100",
        });
        expect(typeof call.values.timestamp).toBe("number");
        expect(call.values.timestamp).toBeGreaterThan(0);
    });

    it("עדכון רשומה אחת – שינוי אטומי (תיקון אות אחת בתוכן)", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const dataSource = {
            fetchCollection: vi.fn(),
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const itemId = "item_101";
        const localValues: Record<string, any> = {
            [itemId]: {
                content: "בָּרְכוּ אֶת ה' הַמְּבֹרָךְ", // תיקון אות
                type: "body",
                partId: "part1",
                itemId,
                mit_id: "101",
            },
        };

        await savePartItems(dataSource, {
            path: basePath,
            changedIds: [itemId],
            localValues,
        });

        expect(saveEntity).toHaveBeenCalledTimes(1);
        expect(saveEntity.mock.calls[0][0].values.content).toBe(
            "בָּרְכוּ אֶת ה' הַמְּבֹרָךְ"
        );
    });

    it("שמירה במנות – 3 פריטים נשמרים ב-3 קריאות ל-saveEntity", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const dataSource = {
            fetchCollection: vi.fn(),
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const ids = ["item_1", "item_2", "item_3"];
        const localValues: Record<string, any> = {};
        ids.forEach((id, i) => {
            localValues[id] = {
                content: `תוכן ${i + 1}`,
                type: "body",
                partId: "part1",
                itemId: id,
                mit_id: String(100 + i),
            };
        });

        await savePartItems(dataSource, {
            path: basePath,
            changedIds: ids,
            localValues,
        });

        expect(saveEntity).toHaveBeenCalledTimes(3);
        ids.forEach((id, i) => {
            expect(saveEntity.mock.calls[i][0].entityId).toBe(id);
            expect(saveEntity.mock.calls[i][0].values.content).toBe(`תוכן ${i + 1}`);
        });
    });

    it("פריט new_* בלי itemId תקף – זורק לפני saveEntity", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const dataSource = {
            fetchCollection: vi.fn(),
            saveEntity,
            deleteEntity: vi.fn(),
        };

        await expect(
            savePartItems(dataSource, {
                path: basePath,
                changedIds: ["new_abc"],
                localValues: {},
            })
        ).rejects.toThrow("savePartItems: new item missing valid itemId");

        await expect(
            savePartItems(dataSource, {
                path: basePath,
                changedIds: ["new_abc"],
                localValues: { new_abc: { content: "x", partId: "p1" } },
            })
        ).rejects.toThrow("savePartItems: new item missing valid itemId");

        expect(saveEntity).not.toHaveBeenCalled();
    });
});

describe("partEditService – מחיקות (deletePartItemAndRelatedTranslations)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("מחיקה רכה של פריט בודד – saveEntity נקרא פעם אחת עם deleted: true ו-timestamp", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const fetchCollection = vi.fn().mockResolvedValue([]);
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const itemEntity = {
            id: "item_200",
            path: "translations/0-ashkenaz/prayers/p1/items",
            values: {
                content: "פריט למחיקה",
                type: "body",
                partId: "part1",
                itemId: "item_200",
                mit_id: "200",
            },
        };

        const params: DeletePartItemParams = {
            itemEntity: itemEntity as any,
            itemId: "item_200",
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p1",
            translations: [{ translationId: "0-ashkenaz" }, { translationId: "0-sefard" }],
        };

        await deletePartItemAndRelatedTranslations(dataSource, params);

        expect(saveEntity).toHaveBeenCalledTimes(1);
        const call = saveEntity.mock.calls[0][0];
        expect(call.path).toBe(itemEntity.path);
        expect(call.entityId).toBe(itemEntity.id);
        expect(call.values.deleted).toBe(true);
        expect(typeof call.values.timestamp).toBe("number");
        expect(call.status).toBe("existing");
    });

    it("מחיקת פריט בבסיס – כולל תרגום מקושר (linkedItem) – saveEntity נקרא פעמיים", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const relatedInSefard = {
            id: "item_sefard_200",
            path: "translations/0-sefard/prayers/p1/items",
            values: {
                content: "תרגום מקושר",
                linkedItem: ["item_200"],
                itemId: "item_sefard_200",
            },
        };
        const fetchCollection = vi.fn().mockResolvedValue([relatedInSefard]);
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const itemEntity = {
            id: "item_200",
            path: "translations/0-ashkenaz/prayers/p1/items",
            values: {
                content: "פריט בסיס",
                itemId: "item_200",
                partId: "part1",
            },
        };

        const params: DeletePartItemParams = {
            itemEntity: itemEntity as any,
            itemId: "item_200",
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p1",
            translations: [
                { translationId: "0-ashkenaz" },
                { translationId: "0-sefard" },
            ],
        };

        await deletePartItemAndRelatedTranslations(dataSource, params);

        expect(saveEntity).toHaveBeenCalledTimes(2);
        const first = saveEntity.mock.calls[0][0];
        const second = saveEntity.mock.calls[1][0];
        expect(first.entityId).toBe("item_200");
        expect(first.values.deleted).toBe(true);
        expect(second.entityId).toBe("item_sefard_200");
        expect(second.values.deleted).toBe(true);
    });

    it("מחיקה רק בתרגום אחד – אין תרגומים מקושרים – רק הפריט הנוכחי מסומן deleted", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const fetchCollection = vi.fn().mockResolvedValue([]);
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const itemEntity = {
            id: "item_300",
            path: "translations/0-english/prayers/p1/items",
            values: {
                content: "רק בתרגום אנגלית",
                itemId: "item_300",
                partId: "part1",
            },
        };

        const params: DeletePartItemParams = {
            itemEntity: itemEntity as any,
            itemId: "item_300",
            currentTranslationId: "0-english",
            selectedPrayerId: "p1",
            translations: [
                { translationId: "0-ashkenaz" },
                { translationId: "0-english" },
            ],
        };

        await deletePartItemAndRelatedTranslations(dataSource, params);

        expect(saveEntity).toHaveBeenCalledTimes(1);
        expect(saveEntity.mock.calls[0][0].values.deleted).toBe(true);
    });

    it("כשמחיקת תרגום מקושר אחת נכשלת – מנסים את כולן ואז נזרקת שגיאת מצטברת", async () => {
        const relatedOk = {
            id: "item_ok",
            path: "translations/0-sefard/prayers/p1/items",
            values: { linkedItem: ["item_200"], itemId: "item_ok" },
        };
        const relatedFail = {
            id: "item_bad",
            path: "translations/0-sefard/prayers/p1/items",
            values: { linkedItem: ["item_200"], itemId: "item_bad" },
        };
        const fetchCollection = vi.fn().mockResolvedValue([relatedOk, relatedFail]);
        const saveEntity = vi.fn().mockImplementation((opts: any) => {
            if (opts.entityId === "item_bad") {
                return Promise.reject(new Error("network"));
            }
            return Promise.resolve(undefined);
        });
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const itemEntity = {
            id: "item_200",
            path: "translations/0-ashkenaz/prayers/p1/items",
            values: { content: "בסיס", itemId: "item_200", partId: "part1" },
        };

        const params: DeletePartItemParams = {
            itemEntity: itemEntity as any,
            itemId: "item_200",
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p1",
            translations: [
                { translationId: "0-ashkenaz" },
                { translationId: "0-sefard" },
            ],
        };

        await expect(
            deletePartItemAndRelatedTranslations(dataSource, params)
        ).rejects.toThrow(/deletePartItemAndRelatedTranslations/);

        expect(saveEntity).toHaveBeenCalledTimes(3);
        const savedIds = saveEntity.mock.calls.map((c: any) => c[0].entityId);
        expect(savedIds).toContain("item_200");
        expect(savedIds).toContain("item_ok");
        expect(savedIds).toContain("item_bad");
    });
});

// ─── splitPartItems ───────────────────────────────────────────────────────────

describe("partEditService – splitPartItems", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        firestoreBatchWrites.length = 0;
    });

    /** בונה mock של fetchCollection שמחזיר פריטים לפי partId */
    function makeDataSource(
        baseItems: any[],
        linkedItemsPerTid: Record<string, any[]> = {}
    ) {
        const fetchCollection = vi.fn().mockImplementation(({ filter }: any) => {
            // שליפת פריטים לפי partId (בסיס)
            if (filter?.partId) return Promise.resolve(baseItems);
            // שליפת פריטים לפי linkedItem (תרגומים)
            const tid = Object.keys(linkedItemsPerTid).find((k) => {
                return linkedItemsPerTid[k].length > 0;
            });
            return Promise.resolve(tid ? linkedItemsPerTid[tid] : []);
        });
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        return { fetchCollection, saveEntity, deleteEntity: vi.fn() };
    }

    it("insertBefore=false – פריט החתך ועד הסוף עוברים למקטע החדש", async () => {
        const items = [
            { id: "e1", values: { itemId: "1", mit_id: "10", partId: "p1", partName: "ישן", partIdAndName: "p1 ישן", content: "א" } },
            { id: "e2", values: { itemId: "2", mit_id: "20", partId: "p1", partName: "ישן", partIdAndName: "p1 ישן", content: "ב" } },
            { id: "e3", values: { itemId: "3", mit_id: "30", partId: "p1", partName: "ישן", partIdAndName: "p1 ישן", content: "ג" } },
        ];
        const ds = makeDataSource(items);

        const params: SplitPartItemsParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            tocId: "ashkenaz",
            currentPartId: "p1",
            splitAtItemId: "2",
            insertBefore: false,
            newPartId: "p2",
            newPartNameHe: "חדש",
            newPartNameEn: "New",
            translations: [{ translationId: "0-ashkenaz" }],
        };

        await splitPartItems(ds, params);

        // e2 ו-e3 צריכים לעבור (החתך מ-2 עד הסוף = insertBefore=false)
        const writtenIds = firestoreBatchWrites.map((w) => w.ref.id);
        expect(writtenIds).toContain("e2");
        expect(writtenIds).toContain("e3");
        expect(writtenIds).not.toContain("e1");

        const e2Write = firestoreBatchWrites.find((w) => w.ref.id === "e2");
        expect(e2Write?.data.partId).toBe("p2");
        expect(e2Write?.data.partName).toBe("חדש");
        expect(e2Write?.data.partIdAndName).toBe("p2 חדש");
        expect(typeof e2Write?.data.timestamp).toBe("number");
    });

    it("insertBefore=true – מהתחלה עד פריט החתך (כולל) עוברים למקטע החדש", async () => {
        const items = [
            { id: "e1", values: { itemId: "1", mit_id: "10", partId: "p1", partName: "ישן", content: "א" } },
            { id: "e2", values: { itemId: "2", mit_id: "20", partId: "p1", partName: "ישן", content: "ב" } },
            { id: "e3", values: { itemId: "3", mit_id: "30", partId: "p1", partName: "ישן", content: "ג" } },
        ];
        const ds = makeDataSource(items);

        const params: SplitPartItemsParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            tocId: "ashkenaz",
            currentPartId: "p1",
            splitAtItemId: "2",
            insertBefore: true,
            newPartId: "p2",
            newPartNameHe: "חדש",
            newPartNameEn: "New",
            translations: [{ translationId: "0-ashkenaz" }],
        };

        await splitPartItems(ds, params);

        const writtenIds = firestoreBatchWrites.map((w) => w.ref.id);
        expect(writtenIds).toContain("e1");
        expect(writtenIds).toContain("e2");
        expect(writtenIds).not.toContain("e3");
    });

    it("תרגום 1-ashkenaz מקבל שם אנגלי", async () => {
        const baseItem = { id: "e1", values: { itemId: "1", mit_id: "10", partId: "p1", partName: "ישן", content: "א" } };
        const engItem = { id: "e_eng", values: { itemId: "eng1", mit_id: "10", partId: "p1", linkedItem: ["1"], content: "a" } };

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                if (filter?.partId) return Promise.resolve([baseItem]);
                return Promise.resolve([engItem]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: SplitPartItemsParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            tocId: "ashkenaz",
            currentPartId: "p1",
            splitAtItemId: "1",
            insertBefore: false,
            newPartId: "p2",
            newPartNameHe: "חדש",
            newPartNameEn: "New Part",
            translations: [
                { translationId: "0-ashkenaz" },
                { translationId: "1-ashkenaz" },
            ],
        };

        await splitPartItems(ds, params);

        // הפריט בתרגום 1-ashkenaz צריך לקבל שם אנגלי
        const engWrite = firestoreBatchWrites.find((w) => w.ref.id === "e_eng");
        expect(engWrite?.data.partName).toBe("New Part");
        expect(engWrite?.data.partIdAndName).toBe("p2 New Part");

        // הפריט הבסיסי מקבל שם עברי
        const baseWrite = firestoreBatchWrites.find((w) => w.ref.id === "e1");
        expect(baseWrite?.data.partName).toBe("חדש");
    });

    it("זורק שגיאה כשפריט החתך לא נמצא", async () => {
        const items = [
            { id: "e1", values: { itemId: "1", partId: "p1" } },
            { id: "e2", values: { itemId: "2", partId: "p1" } },
        ];
        const ds = makeDataSource(items);

        const params: SplitPartItemsParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            tocId: "ashkenaz",
            currentPartId: "p1",
            splitAtItemId: "999",
            insertBefore: false,
            newPartId: "p2",
            newPartNameHe: "חדש",
            newPartNameEn: "New",
            translations: [{ translationId: "0-ashkenaz" }],
        };

        await expect(splitPartItems(ds as any, params)).rejects.toThrow(
            "splitPartItems: split item not found: 999"
        );
        expect(ds.saveEntity).not.toHaveBeenCalled();
    });
});

// ─── moveItemsToPart ──────────────────────────────────────────────────────────

describe("partEditService – moveItemsToPart", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        firestoreBatchWrites.length = 0;
    });

    it("העברה למקטע ריק – לפריט בסיס מחושב itemId חדש וגם mit_id בהתאם", async () => {
        const sourceItem = {
            id: "e1",
            values: { itemId: "100", mit_id: "50", partId: "src", partName: "מקור", content: "א" },
        };

        const translations = [
            {
                translationId: "0-ashkenaz",
                categories: [{ prayers: [{ id: "prayer1", parts: [
                    { id: "tgt", name: "יעד" },
                ] }] }],
            },
        ];

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                if (filter?.partId?.[1] === "src") return Promise.resolve([sourceItem]);
                return Promise.resolve([]); // פריט יעד ריק
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            movedItemIds: ["100"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: null,
            translations,
        };

        await moveItemsToPart(ds, params);

        expect(firestoreBatchWrites.length).toBe(2);
        const createWrite = firestoreBatchWrites.find((w) => !w.data.deleted);
        const softDeleteWrite = firestoreBatchWrites.find((w) => w.data.deleted === true);
        expect(createWrite).toBeTruthy();
        expect(softDeleteWrite).toBeTruthy();
        expect(createWrite!.data.partId).toBe("tgt");
        expect(createWrite!.data.partName).toBe("יעד");
        expect(createWrite!.data.partIdAndName).toBe("tgt יעד");
        expect(createWrite!.data.itemId).toBe("101002211000");
        expect(createWrite!.data.mit_id).toBe("101002211000");
        expect(createWrite!.ref.id).toBe(createWrite!.data.itemId);
        expect(softDeleteWrite!.ref.id).toBe("e1");
        expect(typeof createWrite!.data.timestamp).toBe("number");
    });

    it("העברת שני פריטי בסיס – itemId מחושב לפי מיקום יעד, ו-mit_id לפי כלל הפסקה", async () => {
        const src1 = { id: "s1", values: { itemId: "10", mit_id: "10", partId: "src" } };
        const src2 = { id: "s2", values: { itemId: "20", mit_id: "20", partId: "src" } };
        const tgtBefore = { id: "t1", values: { itemId: "100", mit_id: "100", partId: "tgt" } };
        const tgtAfter = { id: "t2", values: { itemId: "200", mit_id: "200", partId: "tgt" } };

        const translations = [
            {
                translationId: "0-ashkenaz",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
        ];

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                const pid = filter?.partId?.[1];
                if (pid === "src") return Promise.resolve([src1, src2]);
                if (pid === "tgt") return Promise.resolve([tgtBefore, tgtAfter]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        // הכנסה אחרי t1 (itemId="100"), לפני t2 (mit_id=200)
        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p",
            movedItemIds: ["10", "20"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: "100",
            paragraphByBaseItemId: { "10": true, "20": false },
            translations,
        };

        await moveItemsToPart(ds, params);

        expect(firestoreBatchWrites.length).toBe(4);

        const createWrites = firestoreBatchWrites
            .filter((w) => !w.data.deleted)
            .sort((a, b) =>
                (a.data.itemId ?? "").localeCompare(b.data.itemId ?? "", undefined, { numeric: true })
            );
        expect(createWrites.length).toBe(2);
        const write1 = createWrites[0];
        const write2 = createWrites[1];
        const i1 = Number(write1.data.itemId);
        const i2 = Number(write2.data.itemId);

        // itemId מחושב בין 100 ל-200 ובסדר עולה
        expect(i1).toBeGreaterThan(100);
        expect(i1).toBeLessThan(200);
        expect(i2).toBeGreaterThan(i1);
        expect(i2).toBeLessThan(200);

        // פריט ראשון חלק מפסקה -> mit_id של הפריט הקודם ביעד (100)
        expect(write1.data.mit_id).toBe("100");
        // פריט שני לא חלק מפסקה -> mit_id=itemId החדש שלו
        expect(write2.data.mit_id).toBe(write2.data.itemId);
    });

    it("תרגומים מקושרים מתעדכנים בנפרד: linkedItem חדש, itemId מחושב מקומית, mit_id לפי כלל הבסיס", async () => {
        const srcBase = { id: "b1", values: { itemId: "10", mit_id: "10", partId: "src", content: "base" } };
        const tgtExistingBase = { id: "tb1", values: { itemId: "100", mit_id: "100", partId: "tgt", content: "x" } };

        const trTargetExisting = { id: "tr_tgt_1", values: { itemId: "105", mit_id: "105", partId: "tgt", content: "existing tr" } };
        const trRelated1 = { id: "tr_rel_1", values: { itemId: "11", mit_id: "11", partId: "src", linkedItem: ["10"], content: "rel1" } };
        const trRelated2 = { id: "tr_rel_2", values: { itemId: "12", mit_id: "12", partId: "src", linkedItem: ["10"], content: "rel2" } };

        const translations = [
            {
                translationId: "0-ashkenaz",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
            {
                translationId: "1-ashkenaz",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "Target" }] }] }],
            },
        ];

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                const pid = filter?.partId?.[1];
                if (path.includes("translations/0-ashkenaz") && pid === "src") return Promise.resolve([srcBase]);
                if (path.includes("translations/0-ashkenaz") && pid === "tgt") return Promise.resolve([tgtExistingBase]);
                if (path.includes("translations/1-ashkenaz") && pid === "tgt") return Promise.resolve([trTargetExisting]);
                if (path.includes("translations/1-ashkenaz") && filter?.linkedItem) return Promise.resolve([trRelated1, trRelated2]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p",
            movedItemIds: ["10"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: "100",
            paragraphByBaseItemId: { "10": true },
            translations,
        };

        await moveItemsToPart(ds, params);

        const baseCreateWrite = firestoreBatchWrites.find(
            (w) =>
                w.ref.path.includes("translations/0-ashkenaz") &&
                !w.data.deleted
        );
        const relCreateWrites = firestoreBatchWrites.filter(
            (w) =>
                w.ref.path.includes("translations/1-ashkenaz") &&
                !w.data.deleted
        );
        const relSoftDeleteWrites = firestoreBatchWrites.filter(
            (w) =>
                w.ref.path.includes("translations/1-ashkenaz") &&
                w.data.deleted === true
        );

        expect(baseCreateWrite).toBeTruthy();
        // idBefore=100, idAfter=null + extraTakenIds=[105] → idBefore מוכמס ל-105, לכן 1105
        expect(baseCreateWrite!.data.itemId).toBe("1105");
        expect(baseCreateWrite!.data.mit_id).toBe("100");
        expect(baseCreateWrite!.ref.id).toBe("1105");

        expect(relCreateWrites.length).toBe(2);
        expect(relSoftDeleteWrites.length).toBe(2);
        relCreateWrites.forEach((w) => {
            expect(w.data.partId).toBe("tgt");
            expect(w.data.linkedItem).toContain("1105"); // linkedItem עודכן ל-itemId החדש של הבסיס
            expect(w.data.mit_id).toBe("100"); // הבסיס חלק מפסקה -> אותו mit_id לתרגומים
            expect(w.data.itemId).not.toBe("1105"); // מחושב בנפרד לתרגום ולא מועתק מהבסיס
            expect(w.ref.id).toBe(w.data.itemId);
        });
    });

    it("תרגום לא חורג מ-ID של פריט הבסיס הבא (nextBaseLinkedMinItemId cap)", async () => {
        const srcBase1 = { id: "10", values: { itemId: "10", mit_id: "10", partId: "src" } };
        const srcBase2 = { id: "20", values: { itemId: "20", mit_id: "20", partId: "src" } };
        const tgtItem1 = { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt" } };
        const tgtItem2 = { id: "200", values: { itemId: "200", mit_id: "200", partId: "tgt" } };

        const trRel1 = { id: "tr1", values: { itemId: "11", mit_id: "11", partId: "src", linkedItem: ["10"] } };
        const trRel2 = { id: "tr2", values: { itemId: "21", mit_id: "21", partId: "src", linkedItem: ["20"] } };

        const translations = [
            {
                translationId: "0-base",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
            {
                translationId: "1-trans",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "Target" }] }] }],
            },
        ];

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                const pid = filter?.partId?.[1];
                if (path.includes("0-base") && pid === "src") return Promise.resolve([srcBase1, srcBase2]);
                if (path.includes("0-base") && pid === "tgt") return Promise.resolve([tgtItem1, tgtItem2]);
                if (path.includes("1-trans") && pid === "tgt") return Promise.resolve([]);
                if (path.includes("1-trans") && filter?.linkedItem) return Promise.resolve([trRel1, trRel2]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-base",
            selectedPrayerId: "p",
            movedItemIds: ["10", "20"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: "100",
            translations,
        };

        await moveItemsToPart(ds, params);

        const baseNewWrites = firestoreBatchWrites.filter(
            (w) => w.ref.path.includes("0-base") && !w.data.deleted
        );
        const transNewWrites = firestoreBatchWrites.filter(
            (w) => w.ref.path.includes("1-trans") && !w.data.deleted
        );

        // Base items: inserted between 100 and 200 → e.g. 150, 175
        expect(baseNewWrites.length).toBe(2);
        const baseId1 = Number(baseNewWrites[0].data.itemId);
        const baseId2 = Number(baseNewWrites[1].data.itemId);
        expect(baseId1).toBeGreaterThan(100);
        expect(baseId1).toBeLessThan(200);
        expect(baseId2).toBeGreaterThan(baseId1);
        expect(baseId2).toBeLessThan(200);

        // Translation for base1: must be between baseId1 and baseId2 (capped by nextBaseId)
        expect(transNewWrites.length).toBe(2);
        const trForBase1 = transNewWrites.find(
            (w) => w.data.linkedItem?.includes(String(baseId1))
        );
        const trForBase2 = transNewWrites.find(
            (w) => w.data.linkedItem?.includes(String(baseId2))
        );
        expect(trForBase1).toBeTruthy();
        expect(trForBase2).toBeTruthy();

        const trId1 = Number(trForBase1!.data.itemId);
        const trId2 = Number(trForBase2!.data.itemId);

        // Critical: translation ID must stay below the NEXT base item
        expect(trId1).toBeGreaterThan(baseId1);
        expect(trId1).toBeLessThan(baseId2);
        expect(trId2).toBeGreaterThan(baseId2);
    });

    it("העברה: תרגום מקושר נשאר מעל newBaseId ומתחת לבסיס הבא", async () => {
        const srcBase = { id: "10", values: { itemId: "10", mit_id: "10", partId: "src" } };
        const tgtBase1 = { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt" } };
        const tgtBase2 = { id: "200", values: { itemId: "200", mit_id: "200", partId: "tgt" } };

        // תרגום מקור של הפריט המועבר
        const srcRel = {
            id: "tr_src",
            values: { itemId: "11", mit_id: "11", partId: "src", linkedItem: ["10"] },
        };
        // תרגום קיים ביעד, כדי לייצר הקשר ריאלי של IDs קיימים
        const tgtExistingRel = {
            id: "tr_tgt_existing",
            values: { itemId: "250", mit_id: "250", partId: "tgt", linkedItem: ["200"] },
        };

        const translations = [
            {
                translationId: "0-base",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
            {
                translationId: "1-trans",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "Target" }] }] }],
            },
        ];

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                const pid = filter?.partId?.[1];
                if (path.includes("0-base") && pid === "src") return Promise.resolve([srcBase]);
                if (path.includes("0-base") && pid === "tgt")
                    return Promise.resolve([tgtBase1, tgtBase2]);
                if (path.includes("1-trans") && pid === "tgt")
                    return Promise.resolve([tgtExistingRel]);
                if (path.includes("1-trans") && filter?.linkedItem)
                    return Promise.resolve([srcRel]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        await moveItemsToPart(ds as any, {
            currentTranslationId: "0-base",
            selectedPrayerId: "p",
            movedItemIds: ["10"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: "100",
            translations,
        });

        const baseCreate = firestoreBatchWrites.find(
            (w) =>
                w.ref.path === "translations/0-base/prayers/p/items" &&
                !Array.isArray(w.data?.linkedItem) &&
                w.data?.partId === "tgt"
        );
        const translationCreate = firestoreBatchWrites.find(
            (w) =>
                w.ref.path === "translations/1-trans/prayers/p/items" &&
                Array.isArray(w.data?.linkedItem) &&
                w.data?.partId === "tgt"
        );

        expect(baseCreate).toBeTruthy();
        expect(translationCreate).toBeTruthy();

        const newBaseId = Number(baseCreate!.data.itemId);
        const newRelId = Number(translationCreate!.data.itemId);
        expect(newBaseId).toBeGreaterThan(100);
        expect(newBaseId).toBeLessThan(200);
        expect(newRelId).toBeGreaterThan(newBaseId);
        expect(newRelId).toBeLessThan(200);
    });

    it("תרגום מקושר לשני בסיסים מועברים – כל הפניות ב-linkedItem מתעדכנות", async () => {
        const srcBase1 = { id: "10", values: { itemId: "10", mit_id: "10", partId: "src" } };
        const srcBase2 = { id: "20", values: { itemId: "20", mit_id: "20", partId: "src" } };
        const tgtItem1 = { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt" } };

        // תרגום מקושר לשני פריטי בסיס מועברים
        const trMultiLink = { id: "tr_multi", values: { itemId: "15", mit_id: "15", partId: "src", linkedItem: ["10", "20"] } };

        const translations = [
            {
                translationId: "0-base",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
            {
                translationId: "1-trans",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "Target" }] }] }],
            },
        ];

        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                const pid = filter?.partId?.[1];
                if (path.includes("0-base") && pid === "src") return Promise.resolve([srcBase1, srcBase2]);
                if (path.includes("0-base") && pid === "tgt") return Promise.resolve([tgtItem1]);
                if (path.includes("1-trans") && pid === "tgt") return Promise.resolve([]);
                if (path.includes("1-trans") && filter?.linkedItem) return Promise.resolve([trMultiLink]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-base",
            selectedPrayerId: "p",
            movedItemIds: ["10", "20"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: "100",
            translations,
        };

        await moveItemsToPart(ds, params);

        const baseNewWrites = firestoreBatchWrites.filter(
            (w) => w.ref.path.includes("0-base") && !w.data.deleted
        );
        const transNewWrites = firestoreBatchWrites.filter(
            (w) => w.ref.path.includes("1-trans") && !w.data.deleted
        );

        const newBaseId1 = baseNewWrites[0]?.data.itemId;
        const newBaseId2 = baseNewWrites[1]?.data.itemId;

        // Translation is only created once (no duplicates despite multi-link)
        expect(transNewWrites.length).toBe(1);

        // BOTH old base IDs replaced in linkedItem
        const savedLinkedItem = transNewWrites[0].data.linkedItem;
        expect(savedLinkedItem).toContain(newBaseId1);
        expect(savedLinkedItem).toContain(newBaseId2);
        expect(savedLinkedItem).not.toContain("10");
        expect(savedLinkedItem).not.toContain("20");
    });

    it("זורק שגיאה כשאין התאמה בין movedItemIds לפריטי המקור", async () => {
        const srcBase = { id: "b1", values: { itemId: "10", mit_id: "10", partId: "src" } };
        const translations = [
            {
                translationId: "0-ashkenaz",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
        ];
        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                const pid = filter?.partId?.[1];
                if (pid === "src") return Promise.resolve([srcBase]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p",
            movedItemIds: ["999"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: null,
            translations,
        };

        await expect(moveItemsToPart(ds as any, params)).rejects.toThrow(
            "moveItemsToPart: no matching source items found for movedItemIds"
        );
        expect(ds.saveEntity).not.toHaveBeenCalled();
    });

    it("זורק שגיאה כש-insertAfterItemId לא נמצא במקטע היעד", async () => {
        const srcItem = { id: "10", values: { itemId: "10", mit_id: "10", partId: "src" } };
        const tgtItem = { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt" } };
        const translations = [
            {
                translationId: "0-ashkenaz",
                categories: [{ prayers: [{ id: "p", parts: [{ id: "src", name: "מקור" }, { id: "tgt", name: "יעד" }] }] }],
            },
        ];
        const ds = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                const pid = filter?.partId?.[1];
                if (pid === "src") return Promise.resolve([srcItem]);
                if (pid === "tgt") return Promise.resolve([tgtItem]);
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const params: MoveItemsToPartParams = {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "p",
            movedItemIds: ["10"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: "999",
            translations,
        };

        await expect(moveItemsToPart(ds as any, params)).rejects.toThrow(
            /insertAfterItemId "999" not found in target part/
        );
        expect(ds.saveEntity).not.toHaveBeenCalled();
    });
});

describe("partEditService – copyItemsToPart (warehouse snapshots)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        firestoreBatchWrites.length = 0;
    });

    const makeTranslations = (baseTid: string, prayerId: string, partId: string, partName: string) => [
        {
            translationId: baseTid,
            categories: [
                {
                    prayers: [
                        {
                            id: prayerId,
                            parts: [{ id: partId, name: partName }],
                        },
                    ],
                },
            ],
        },
    ];

    it("creates new base item ids from preloaded source entities", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                if (path.includes("translations/0-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([
                        { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt-part" } },
                    ]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn(),
            deleteEntity: vi.fn(),
        };

        const result = await copyItemsToPart(dataSource as any, {
            sourceTranslationId: "0-src",
            sourcePrayerId: "p-src",
            sourcePartId: "src-part",
            sourceItemIds: [],
            targetTranslationId: "0-dst",
            targetTocId: "dst",
            targetPrayerId: "p-dst",
            targetPartId: "tgt-part",
            insertAfterItemId: "100",
            copyLinkedTranslations: false,
            sourceTranslations: makeTranslations("0-src", "p-src", "src-part", "source"),
            targetTranslations: makeTranslations("0-dst", "p-dst", "tgt-part", "target"),
            sourceEntities: [
                { id: "base-1", values: { itemId: "10", mit_id: "10", content: "Amen", partId: "src-part" } } as any,
            ],
            sourceEnhancementsByTranslationId: {},
        });

        const newBaseId = result.baseIdMap["10"];
        expect(newBaseId).toBeTruthy();
        expect(Number(newBaseId)).toBeGreaterThan(100);
        expect(result.translationIdMap).toEqual({});

        const baseWrite = firestoreBatchWrites.find(
            (w) => w.ref.path === "translations/0-dst/prayers/p-dst/items"
        );
        expect(baseWrite).toBeTruthy();
        expect(baseWrite!.data.itemId).toBe(newBaseId);
        expect(baseWrite!.data.mit_id).toBe(newBaseId);
        expect(baseWrite!.data.partId).toBe("tgt-part");
    });

    it("copies linked translations into matching target nusach with recalculated ids", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                if (path.includes("translations/0-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([
                        { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt-part" } },
                    ]);
                }
                if (path.includes("translations/1-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn(),
            deleteEntity: vi.fn(),
        };

        const result = await copyItemsToPart(dataSource as any, {
            sourceTranslationId: "0-src",
            sourcePrayerId: "p-src",
            sourcePartId: "src-part",
            sourceItemIds: [],
            targetTranslationId: "0-dst",
            targetTocId: "dst",
            targetPrayerId: "p-dst",
            targetPartId: "tgt-part",
            insertAfterItemId: "100",
            copyLinkedTranslations: true,
            sourceTranslations: [
                ...makeTranslations("0-src", "p-src", "src-part", "source"),
                ...makeTranslations("1-src", "p-src", "src-part", "Source EN"),
            ],
            targetTranslations: [
                ...makeTranslations("0-dst", "p-dst", "tgt-part", "target"),
                ...makeTranslations("1-dst", "p-dst", "tgt-part", "Target EN"),
            ],
            sourceEntities: [
                { id: "base-1", values: { itemId: "10", mit_id: "10", content: "Amen", partId: "src-part" } } as any,
            ],
            sourceEnhancementsByTranslationId: {
                "1-src": [
                    {
                        id: "enh-1",
                        values: {
                            itemId: "11",
                            mit_id: "11",
                            linkedItem: ["10"],
                            content: "Amen (EN)",
                            partId: "src-part",
                        },
                    } as any,
                ],
            },
        });

        const newBaseId = result.baseIdMap["10"];
        expect(newBaseId).toBeTruthy();
        expect(result.translationIdMap["enh-1"]).toBeTruthy();

        const enhWrite = firestoreBatchWrites.find(
            (w) =>
                w.ref.path === "translations/1-dst/prayers/p-dst/items" &&
                Array.isArray(w.data.linkedItem)
        );
        expect(enhWrite).toBeTruthy();
        expect(enhWrite!.data.linkedItem).toContain(newBaseId);
        expect(enhWrite!.data.itemId).toBe(result.translationIdMap["enh-1"]);
        expect(enhWrite!.data.itemId).not.toBe(newBaseId);
    });

    it("skips linked translations when copyLinkedTranslations is false", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                if (path.includes("translations/0-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([
                        { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt-part" } },
                    ]);
                }
                if (path.includes("translations/1-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn(),
            deleteEntity: vi.fn(),
        };

        const result = await copyItemsToPart(dataSource as any, {
            sourceTranslationId: "0-src",
            sourcePrayerId: "p-src",
            sourcePartId: "src-part",
            sourceItemIds: [],
            targetTranslationId: "0-dst",
            targetTocId: "dst",
            targetPrayerId: "p-dst",
            targetPartId: "tgt-part",
            insertAfterItemId: "100",
            copyLinkedTranslations: false,
            sourceTranslations: [
                ...makeTranslations("0-src", "p-src", "src-part", "source"),
                ...makeTranslations("1-src", "p-src", "src-part", "Source EN"),
            ],
            targetTranslations: [
                ...makeTranslations("0-dst", "p-dst", "tgt-part", "target"),
                ...makeTranslations("1-dst", "p-dst", "tgt-part", "Target EN"),
            ],
            sourceEntities: [
                { id: "base-1", values: { itemId: "10", mit_id: "10", content: "Amen", partId: "src-part" } } as any,
            ],
            sourceEnhancementsByTranslationId: {
                "1-src": [
                    {
                        id: "enh-1",
                        values: { itemId: "11", mit_id: "11", linkedItem: ["10"], content: "Amen (EN)" },
                    } as any,
                ],
            },
        });

        expect(result.translationIdMap).toEqual({});
        const enhWrites = firestoreBatchWrites.filter((w) =>
            w.ref.path.includes("translations/1-dst/prayers/p-dst/items")
        );
        expect(enhWrites).toHaveLength(0);
    });

    it("keeps copied translation below the next existing base item in target part", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                if (path.includes("translations/0-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([
                        { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt-part" } },
                        { id: "200", values: { itemId: "200", mit_id: "200", partId: "tgt-part" } },
                    ]);
                }
                if (path.includes("translations/1-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn(),
            deleteEntity: vi.fn(),
        };

        const result = await copyItemsToPart(dataSource as any, {
            sourceTranslationId: "0-src",
            sourcePrayerId: "p-src",
            sourcePartId: "src-part",
            sourceItemIds: [],
            targetTranslationId: "0-dst",
            targetTocId: "dst",
            targetPrayerId: "p-dst",
            targetPartId: "tgt-part",
            insertAfterItemId: "100",
            copyLinkedTranslations: true,
            sourceTranslations: [
                ...makeTranslations("0-src", "p-src", "src-part", "source"),
                ...makeTranslations("1-src", "p-src", "src-part", "Source EN"),
            ],
            targetTranslations: [
                ...makeTranslations("0-dst", "p-dst", "tgt-part", "target"),
                ...makeTranslations("1-dst", "p-dst", "tgt-part", "Target EN"),
            ],
            sourceEntities: [
                { id: "base-1", values: { itemId: "10", mit_id: "10", content: "Amen", partId: "src-part" } } as any,
            ],
            sourceEnhancementsByTranslationId: {
                "1-src": [
                    {
                        id: "enh-1",
                        values: {
                            itemId: "11",
                            mit_id: "11",
                            linkedItem: ["10"],
                            content: "Amen (EN)",
                            partId: "src-part",
                        },
                    } as any,
                ],
            },
        });

        const newBaseId = Number(result.baseIdMap["10"]);
        const newEnhId = Number(result.translationIdMap["enh-1"]);
        expect(newBaseId).toBeGreaterThan(100);
        expect(newBaseId).toBeLessThan(200);
        expect(newEnhId).toBeGreaterThan(newBaseId);
        expect(newEnhId).toBeLessThan(200);
    });
});

describe("partEditService – createTranslationItem", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("caps new translation item below next base id (B_{i+1})", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const fetchCollection = vi.fn().mockImplementation(({ filter }: any) => {
            if (filter?.partId?.[1] === "part-a") {
                return Promise.resolve([
                    {
                        id: "150",
                        values: { itemId: "150", linkedItem: ["100"] },
                    },
                    {
                        id: "250",
                        values: { itemId: "250", linkedItem: ["200"] },
                    },
                ]);
            }
            return Promise.resolve([]);
        });
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const result = await createTranslationItem(dataSource as any, {
            targetTranslationId: "0-sefard",
            selectedPrayerId: "p1",
            partId: "part-a",
            baseItemId: "100",
            afterItemId: null,
            baseItemIdsInPartOrder: ["100", "200"],
            currentBaseRowIndex: 0,
            translations: [],
            content: "new",
            minIdBefore: "100",
        });

        expect(Number(result.newItemId)).toBeGreaterThan(150);
        expect(Number(result.newItemId)).toBeLessThan(200);
        expect(saveEntity).toHaveBeenCalledTimes(1);
    });

    it("uses the minimum linked id of next base row as cap", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const fetchCollection = vi.fn().mockImplementation(({ filter }: any) => {
            if (filter?.partId?.[1] === "part-a") {
                return Promise.resolve([
                    { id: "160", values: { itemId: "160", linkedItem: ["100"] } },
                    // intentionally unsorted and both linked to next base row (200)
                    { id: "250", values: { itemId: "250", linkedItem: ["200"] } },
                    { id: "205", values: { itemId: "205", linkedItem: ["200"] } },
                ]);
            }
            return Promise.resolve([]);
        });
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const result = await createTranslationItem(dataSource as any, {
            targetTranslationId: "0-sefard",
            selectedPrayerId: "p1",
            partId: "part-a",
            baseItemId: "100",
            afterItemId: null,
            baseItemIdsInPartOrder: ["100", "200"],
            currentBaseRowIndex: 0,
            translations: [],
            content: "new",
            minIdBefore: "100",
        });

        expect(Number(result.newItemId)).toBeGreaterThan(160);
        expect(Number(result.newItemId)).toBeLessThan(205);
        expect(saveEntity).toHaveBeenCalledTimes(1);
    });

    it("first translation on base row stays above baseItemId when part has only later-row translations", async () => {
        const saveEntity = vi.fn().mockResolvedValue(undefined);
        const fetchCollection = vi.fn().mockImplementation(({ filter }: any) => {
            if (filter?.partId?.[1] === "part-a") {
                return Promise.resolve([
                    { id: "250", values: { itemId: "250", linkedItem: ["200"] } },
                ]);
            }
            return Promise.resolve([]);
        });
        const dataSource = {
            fetchCollection,
            saveEntity,
            deleteEntity: vi.fn(),
        };

        const result = await createTranslationItem(dataSource as any, {
            targetTranslationId: "0-sefard",
            selectedPrayerId: "p1",
            partId: "part-a",
            baseItemId: "100",
            afterItemId: null,
            baseItemIdsInPartOrder: ["100", "200"],
            currentBaseRowIndex: 0,
            translations: [],
            content: "new",
            minIdBefore: "100",
        });

        expect(Number(result.newItemId)).toBeGreaterThan(100);
        expect(Number(result.newItemId)).toBeLessThan(200);
        expect(saveEntity).toHaveBeenCalledTimes(1);
    });
});

describe("partEditService – pending writes return contracts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        firestoreBatchWrites.length = 0;
    });

    it("splitPartItems returns writes list for prod pending sync", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                if (filter?.partId?.[1] === "p1") {
                    return Promise.resolve([
                        { id: "e1", values: { itemId: "1", partId: "p1", content: "א" } },
                        { id: "e2", values: { itemId: "2", partId: "p1", content: "ב" } },
                    ]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const writes = await splitPartItems(dataSource as any, {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            tocId: "ashkenaz",
            currentPartId: "p1",
            splitAtItemId: "2",
            insertBefore: false,
            newPartId: "p2",
            newPartNameHe: "חדש",
            newPartNameEn: "New",
            translations: [{ translationId: "0-ashkenaz" }],
        });

        expect(writes.length).toBe(1);
        expect(writes[0].docId).toBe("e2");
        expect(writes[0].collectionPath).toBe("translations/0-ashkenaz/prayers/prayer1/items");
        expect(firestoreBatchWrites.length).toBe(writes.length);
    });

    it("moveItemsToPart returns create+soft-delete writes", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ filter }: any) => {
                if (filter?.partId?.[1] === "src") {
                    return Promise.resolve([
                        {
                            id: "s1",
                            values: { itemId: "100", mit_id: "100", partId: "src", partName: "מקור" },
                        },
                    ]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };
        const translations = [
            {
                translationId: "0-ashkenaz",
                categories: [{ prayers: [{ id: "prayer1", parts: [{ id: "tgt", name: "יעד" }] }] }],
            },
        ];

        const writes = await moveItemsToPart(dataSource as any, {
            currentTranslationId: "0-ashkenaz",
            selectedPrayerId: "prayer1",
            movedItemIds: ["100"],
            sourcePartId: "src",
            targetPartId: "tgt",
            insertAfterItemId: null,
            translations,
        });

        expect(writes.length).toBe(2);
        expect(writes.some((w) => w.data.deleted === true)).toBe(true);
        expect(writes.some((w) => w.data.deleted !== true)).toBe(true);
        expect(firestoreBatchWrites.length).toBe(writes.length);
    });

    it("copyItemsToPart result includes writes used by pending prod", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ path, filter }: any) => {
                if (path.includes("translations/0-dst") && filter?.partId?.[1] === "tgt-part") {
                    return Promise.resolve([
                        { id: "100", values: { itemId: "100", mit_id: "100", partId: "tgt-part" } },
                    ]);
                }
                return Promise.resolve([]);
            }),
            saveEntity: vi.fn(),
            deleteEntity: vi.fn(),
        };

        const result = await copyItemsToPart(dataSource as any, {
            sourceTranslationId: "0-src",
            sourcePrayerId: "p-src",
            sourcePartId: "src-part",
            sourceItemIds: [],
            targetTranslationId: "0-dst",
            targetTocId: "dst",
            targetPrayerId: "p-dst",
            targetPartId: "tgt-part",
            insertAfterItemId: "100",
            copyLinkedTranslations: false,
            sourceTranslations: [
                {
                    translationId: "0-src",
                    categories: [{ prayers: [{ id: "p-src", parts: [{ id: "src-part", name: "source" }] }] }],
                },
            ],
            targetTranslations: [
                {
                    translationId: "0-dst",
                    categories: [{ prayers: [{ id: "p-dst", parts: [{ id: "tgt-part", name: "target" }] }] }],
                },
            ],
            sourceEntities: [
                { id: "base-1", values: { itemId: "10", mit_id: "10", content: "Amen", partId: "src-part" } } as any,
            ],
            sourceEnhancementsByTranslationId: {},
        });

        expect(result.writes.length).toBe(result.createdCount);
        expect(result.writes[0].collectionPath).toBe("translations/0-dst/prayers/p-dst/items");
    });

    it("deletePartItemAndRelatedTranslations returns all soft-delete writes", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockResolvedValue([
                {
                    id: "rel-1",
                    path: "translations/1-a/prayers/p1/items",
                    values: { linkedItem: ["1"], itemId: "1.1" },
                },
            ]),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };
        const itemEntity = {
            id: "item-1",
            path: "translations/0-a/prayers/p1/items",
            values: { itemId: "1", content: "x" },
        };

        const writes = await deletePartItemAndRelatedTranslations(dataSource as any, {
            itemEntity: itemEntity as any,
            itemId: "1",
            currentTranslationId: "0-a",
            selectedPrayerId: "p1",
            translations: [{ translationId: "0-a" }, { translationId: "1-a" }],
        });

        expect(writes).toHaveLength(2);
        expect(writes.every((w) => w.data.deleted === true)).toBe(true);
    });

    it("updatePartMetadataInItems returns writes for all touched translations", async () => {
        const dataSource = {
            fetchCollection: vi.fn().mockImplementation(({ path }: any) => {
                if (String(path).includes("translations/0-a")) {
                    return Promise.resolve([{ id: "i1", values: { partId: "p10", content: "a" } }]);
                }
                return Promise.resolve([{ id: "i2", values: { partId: "p10", content: "b" } }]);
            }),
            saveEntity: vi.fn().mockResolvedValue(undefined),
            deleteEntity: vi.fn(),
        };

        const writes = await updatePartMetadataInItems(dataSource as any, {
            selectedPrayerId: "pr1",
            partId: "p10",
            translations: [
                {
                    translationId: "0-a",
                    categories: [{ prayers: [{ id: "pr1", parts: [{ id: "p10", name: "חלק בסיס" }] }] }],
                },
                {
                    translationId: "1-a",
                    categories: [{ prayers: [{ id: "pr1", parts: [{ id: "p10", name: "Part EN" }] }] }],
                },
            ],
        });

        expect(writes).toHaveLength(2);
        expect(writes.map((w) => w.docId)).toEqual(expect.arrayContaining(["i1", "i2"]));
        expect(dataSource.saveEntity).toHaveBeenCalledTimes(2);
    });
});
