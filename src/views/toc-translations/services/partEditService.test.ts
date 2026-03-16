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

// מונע טעינת @firecms/cloud ו-collections (שמושכים CSS וסביבת דפדפן)
vi.mock("@firecms/cloud", () => ({ Entity: class {}, default: {} }));
vi.mock("../collections", () => ({
    itemsCollection: {},
    dbUpdateTimeCollection: {},
}));
import {
    savePartItems,
    deletePartItemAndRelatedTranslations,
    splitPartItems,
    moveItemsToPart,
    type DeletePartItemParams,
    type SplitPartItemsParams,
    type MoveItemsToPartParams,
} from "./partEditService";

describe("partEditService – עדכון פריטים (savePartItems)", () => {
    const basePath = "translations/0-ashkenaz/prayers/p1/items";

    beforeEach(() => {
        vi.clearAllMocks();
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
});

// ─── splitPartItems ───────────────────────────────────────────────────────────

describe("partEditService – splitPartItems", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
        const savedIds = ds.saveEntity.mock.calls.map((c: any) => c[0].entityId);
        expect(savedIds).toContain("e2");
        expect(savedIds).toContain("e3");
        expect(savedIds).not.toContain("e1");

        const e2Call = ds.saveEntity.mock.calls.find((c: any) => c[0].entityId === "e2")[0];
        expect(e2Call.values.partId).toBe("p2");
        expect(e2Call.values.partName).toBe("חדש");
        expect(e2Call.values.partIdAndName).toBe("p2 חדש");
        expect(typeof e2Call.values.timestamp).toBe("number");
    });

    it("insertBefore=true – מהתחלה עד פריט החתך (כולל) עוברים", async () => {
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

        const savedIds = ds.saveEntity.mock.calls.map((c: any) => c[0].entityId);
        expect(savedIds).toContain("e1");
        expect(savedIds).toContain("e2");
        expect(savedIds).not.toContain("e3");
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
        const engCall = ds.saveEntity.mock.calls.find((c: any) => c[0].entityId === "e_eng")?.[0];
        expect(engCall?.values.partName).toBe("New Part");
        expect(engCall?.values.partIdAndName).toBe("p2 New Part");

        // הפריט הבסיסי מקבל שם עברי
        const baseCall = ds.saveEntity.mock.calls.find((c: any) => c[0].entityId === "e1")?.[0];
        expect(baseCall?.values.partName).toBe("חדש");
    });
});

// ─── moveItemsToPart ──────────────────────────────────────────────────────────

describe("partEditService – moveItemsToPart", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
                return Promise.resolve([]); // מקטע יעד ריק
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

        expect(ds.saveEntity).toHaveBeenCalledTimes(1);
        const call = ds.saveEntity.mock.calls[0][0];
        expect(call.values.partId).toBe("tgt");
        expect(call.values.partName).toBe("יעד");
        expect(call.values.partIdAndName).toBe("tgt יעד");
        expect(call.values.itemId).toBe("0"); // mitIdBetween(null, null) -> "0"
        expect(call.values.mit_id).toBe("0");
        expect(typeof call.values.timestamp).toBe("number");
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

        expect(ds.saveEntity).toHaveBeenCalledTimes(2);

        const call1 = ds.saveEntity.mock.calls[0][0];
        const call2 = ds.saveEntity.mock.calls[1][0];
        const i1 = Number(call1.values.itemId);
        const i2 = Number(call2.values.itemId);

        // itemId מחושב בין 100 ל-200 ובסדר עולה
        expect(i1).toBeGreaterThan(100);
        expect(i1).toBeLessThan(200);
        expect(i2).toBeGreaterThan(i1);
        expect(i2).toBeLessThan(200);

        // פריט ראשון חלק מפסקה -> mit_id של הפריט הקודם ביעד (100)
        expect(call1.values.mit_id).toBe("100");
        // פריט שני לא חלק מפסקה -> mit_id=itemId החדש שלו
        expect(call2.values.mit_id).toBe(call2.values.itemId);
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

        const saveCalls = ds.saveEntity.mock.calls.map((c: any) => c[0]);
        const baseCall = saveCalls.find((c: any) => c.path.includes("translations/0-ashkenaz") && c.entityId === "b1");
        const relCalls = saveCalls.filter((c: any) => c.path.includes("translations/1-ashkenaz"));

        expect(baseCall).toBeTruthy();
        // idBefore=100, idAfter=null (פריט יחיד ביעד) → 100+MIT_ID_GAP=1100
        expect(baseCall.values.itemId).toBe("1100");
        expect(baseCall.values.mit_id).toBe("100");

        expect(relCalls.length).toBe(2);
        relCalls.forEach((c: any) => {
            expect(c.values.partId).toBe("tgt");
            expect(c.values.linkedItem).toContain("1100"); // linkedItem עודכן ל-itemId החדש של הבסיס
            expect(c.values.mit_id).toBe("100"); // הבסיס חלק מפסקה -> אותו mit_id לתרגומים
            expect(c.values.itemId).not.toBe("1100"); // מחושב בנפרד לתרגום ולא מועתק מהבסיס
        });
    });
});
