import { expect, test } from "@playwright/test";

test.describe("Prod sync UI flows", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/?playwright=prod-sync");
        await expect(page.getByTestId("harness-title")).toBeVisible();
    });

    test("שמור · פרוד enabled only after stage save", async ({ page }) => {
        const saveProdButton = page.getByRole("button", { name: "שמור · פרוד" });
        const saveStageButton = page.getByRole("button", { name: "שמור · סטייג'" });

        await expect(saveProdButton).toBeDisabled();
        await expect(page.getByTestId("pending-items")).toContainText("pendingItems: 0");

        await saveStageButton.click();

        await expect(page.getByTestId("pending-items")).toContainText("pendingItems: 1");
        await expect(saveProdButton).toBeEnabled();

        await saveProdButton.click();
        await expect(page.getByText("כניסה לסביבת Production")).toBeVisible();
        await page.getByPlaceholder("הזן סיסמה...").fill("dummy");
        await page.getByRole("button", { name: "התחבר" }).click();

        await expect(page.getByTestId("pending-items")).toContainText("pendingItems: 0");
        await expect(saveProdButton).toBeDisabled();
        await expect(page.getByTestId("event-log")).toContainText(
            "save-stage,open-auth-save-prod-items,auth-success,save-prod-items"
        );
    });

    test("שמור מבנה · פרוד appears and clears pending nav writes", async ({ page }) => {
        await expect(
            page.getByRole("button", { name: /שמור מבנה · פרוד/ })
        ).toHaveCount(0);

        await page.getByRole("button", { name: "צור pending מבנה" }).click();

        const saveNavButton = page.getByRole("button", { name: /שמור מבנה · פרוד/ });
        await expect(saveNavButton).toBeVisible();
        await expect(page.getByTestId("pending-nav")).toContainText("pendingNav: 2");

        await saveNavButton.click();
        await expect(page.getByText("כניסה לסביבת Production")).toBeVisible();
        await page.getByPlaceholder("הזן סיסמה...").fill("dummy");
        await page.getByRole("button", { name: "התחבר" }).click();

        await expect(page.getByTestId("pending-nav")).toContainText("pendingNav: 0");
        await expect(
            page.getByRole("button", { name: /שמור מבנה · פרוד/ })
        ).toHaveCount(0);
        await expect(page.getByTestId("event-log")).toContainText(
            "queue-nav-pending,open-auth-save-prod-nav,auth-success,save-prod-nav"
        );
    });

    test("פרסם · סטייג' opens confirm modal and triggers only on confirm", async ({ page }) => {
        const stagePublishButton = page.getByRole("button", {
            name: /פרסם אשכנז · סטייג'/,
        });
        await stagePublishButton.click();

        await expect(page.getByText("אישור פרסום · סטייג'")).toBeVisible();
        await page.getByRole("button", { name: "ביטול" }).click();
        await expect(page.getByText("אישור פרסום · סטייג'")).toHaveCount(0);
        await expect(page.getByTestId("event-log")).not.toContainText("publish-stage");

        await stagePublishButton.click();
        await page.getByRole("button", { name: "פרסם · סטייג'" }).click();
        await expect(page.getByTestId("event-log")).toContainText("publish-stage");
    });

    test("פרסם · פרוד uses prod confirmation flow", async ({ page }) => {
        const prodPublishButton = page.getByRole("button", {
            name: /פרסם אשכנז · פרוד/,
        });
        await prodPublishButton.click();

        await expect(page.getByText("אישור פרסום · פרוד")).toBeVisible();
        await page.getByRole("button", { name: "פרסם · פרוד" }).click();
        await expect(page.getByTestId("event-log")).toContainText("publish-prod");
    });

    test("auth modal cancel does not execute pending prod action", async ({ page }) => {
        await page.getByRole("button", { name: "שמור · סטייג'" }).click();
        await page.getByRole("button", { name: "שמור · פרוד" }).click();
        await expect(page.getByText("כניסה לסביבת Production")).toBeVisible();
        await page.getByRole("button", { name: "ביטול" }).click();

        await expect(page.getByText("כניסה לסביבת Production")).toHaveCount(0);
        await expect(page.getByTestId("pending-items")).toContainText("pendingItems: 1");
        const cancelEvents = await page.evaluate(
            () => window.__prodSyncHarness?.events ?? []
        );
        expect(cancelEvents.includes("save-prod-items")).toBe(false);
    });

    test("auth modal wrong password shows error and keeps pending", async ({ page }) => {
        await page.getByTestId("auth-scenario").selectOption("wrong-password");
        await page.getByRole("button", { name: "שמור · סטייג'" }).click();
        await page.getByRole("button", { name: "שמור · פרוד" }).click();

        await page.getByPlaceholder("הזן סיסמה...").fill("wrong");
        await page.getByRole("button", { name: "התחבר" }).click();

        await expect(page.getByText("סיסמה שגויה – נסה שוב.")).toBeVisible();
        await expect(page.getByTestId("pending-items")).toContainText("pendingItems: 1");
        const wrongPasswordEvents = await page.evaluate(
            () => window.__prodSyncHarness?.events ?? []
        );
        expect(wrongPasswordEvents.includes("save-prod-items")).toBe(false);
    });

    test("auth success persists session for next prod action", async ({ page }) => {
        await page.getByRole("button", { name: "שמור · סטייג'" }).click();
        await page.getByRole("button", { name: "שמור · פרוד" }).click();
        await page.getByPlaceholder("הזן סיסמה...").fill("ok");
        await page.getByRole("button", { name: "התחבר" }).click();

        await expect(page.getByTestId("prod-session")).toContainText("prodSession: on");
        await expect(page.getByTestId("pending-items")).toContainText("pendingItems: 0");

        // queue nav pending and save again: should not open auth modal this time
        await page.getByRole("button", { name: "צור pending מבנה" }).click();
        await page.getByRole("button", { name: /שמור מבנה · פרוד/ }).click();

        await expect(page.getByText("כניסה לסביבת Production")).toHaveCount(0);
        await expect(page.getByTestId("pending-nav")).toContainText("pendingNav: 0");
    });
});
