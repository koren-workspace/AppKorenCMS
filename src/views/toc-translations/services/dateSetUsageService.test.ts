import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({}));
vi.mock("../../../firebase_config", () => ({ getFirebaseApp: vi.fn() }));
vi.mock("./prodAuthService", () => ({ getProdFirestore: vi.fn() }));

import { findPartUsagesInToc } from "./dateSetUsageService";

const toc = {
    translations: [
        {
            translationId: "0-ashkenaz",
            categories: [
                {
                    prayers: [
                        {
                            id: "p1",
                            name: "שחרית",
                            parts: [
                                { id: "a", name: "הלל", dateSetIds: ["205", "100"] },
                                { id: "b", name: "מחוק", dateSetIds: ["205"], deleted: true },
                                { id: "c", name: "אחר", dateSetIds: ["2050"] },
                                { id: "d", name: "מספר", dateSetIds: [205] },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};

describe("findPartUsagesInToc", () => {
    it("finds parts by exact id (string or number), skipping deleted ones", () => {
        const usages = findPartUsagesInToc(toc, "205");
        expect(usages.map((u) => u.partName)).toEqual(["הלל", "מספר"]);
        expect(usages[0].translationId).toBe("0-ashkenaz");
        expect(usages[0].prayerName).toBe("שחרית");
    });
});
