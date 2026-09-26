import { test, expect } from "@playwright/test";
import { goToSettings } from "./helpers/nav.js";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";


// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores
// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.
const USER = specEmail("settings-notifications");
test.describe("Settings — Notification Draft & Save", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await e2eLogin(page, { email: USER, name: "settings-notifications" });
  });

  test("toggling enable notifications should show save bar", async ({
    page,
  }) => {
    await goToSettings(page);
    // Kein Routenwechsel: Settings sind ein Modal an HomeView.
    await expect(page.locator(".modal-content")).toBeVisible();

    const settingItem = page
      .locator(".setting-item")
      .filter({ hasText: "Enable notifications" });
    await settingItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("toggling overdue alerts should show save bar", async ({ page }) => {
    await goToSettings(page);
    // Kein Routenwechsel: Settings sind ein Modal an HomeView.
    await expect(page.locator(".modal-content")).toBeVisible();

    const settingItem = page
      .locator(".setting-item")
      .filter({ hasText: "Overdue alerts" });
    await settingItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("toggling upcoming alerts should show save bar", async ({ page }) => {
    await goToSettings(page);
    // Kein Routenwechsel: Settings sind ein Modal an HomeView.
    await expect(page.locator(".modal-content")).toBeVisible();

    const settingItem = page
      .locator(".setting-item")
      .filter({ hasText: "Upcoming alerts" });
    await settingItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("adding a notification time should show save bar", async ({ page }) => {
    await goToSettings(page);
    // Kein Routenwechsel: Settings sind ein Modal an HomeView.
    await expect(page.locator(".modal-content")).toBeVisible();

    await expect(page.locator("text=Morning reminder")).toBeVisible();

    await page.locator("text=Add time").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("discarding notification changes should revert to stored values", async ({
    page,
    request,
  }) => {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    await request.put("/api/settings", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        notifications: {
          enabled: true,
          notify_overdue: false,
          notify_soon: true,
        },
      },
    });

    await goToSettings(page);
    // Kein Routenwechsel: Settings sind ein Modal an HomeView.
    await expect(page.locator(".modal-content")).toBeVisible();

    const overdueItem = page
      .locator(".setting-item")
      .filter({ hasText: "Overdue alerts" });
    await overdueItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );

    await page.locator("text=Discard").click();

    await expect(page.locator("text=Unsaved changes")).not.toBeVisible();
  });
});
