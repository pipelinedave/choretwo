import { test, expect } from "@playwright/test";

test.describe("Settings — Notification Draft & Save", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });
  });

  test("toggling enable notifications should show save bar", async ({
    page,
  }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    const settingItem = page
      .locator(".setting-item")
      .filter({ hasText: "Enable notifications" });
    await settingItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("toggling overdue alerts should show save bar", async ({ page }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    const settingItem = page
      .locator(".setting-item")
      .filter({ hasText: "Overdue alerts" });
    await settingItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("toggling upcoming alerts should show save bar", async ({ page }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    const settingItem = page
      .locator(".setting-item")
      .filter({ hasText: "Upcoming alerts" });
    await settingItem.locator("label.toggle").click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Unsaved changes",
    );
  });

  test("adding a notification time should show save bar", async ({ page }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

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
        notifications: { enabled: true, notify_overdue: false, notify_soon: true },
      },
    });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

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
