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
    type DeletePartItemParams,
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
