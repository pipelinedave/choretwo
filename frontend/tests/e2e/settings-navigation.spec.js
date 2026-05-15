import { test, expect } from "@playwright/test";

test.describe("Settings Page Navigation & Rendering", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });
  });

  test("should navigate to settings and render all sections", async ({
    page,
  }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");
    await expect(page).toHaveURL("/settings");

    await expect(
      page.locator("h2:has-text('Notifications')"),
    ).toBeVisible();
    await expect(
      page.locator("h2:has-text('Appearance')"),
    ).toBeVisible();
    await expect(page.locator("h2:has-text('Data')")).toBeVisible();
    await expect(
      page.locator("h2:has-text('AI Copilot')"),
    ).toBeVisible();
  });

  test("should have notification toggles rendered correctly", async ({
    page,
  }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    // All toggle checkboxes should exist in DOM
    const notifications = page.locator(
      ".settings-section.card >> .toggle input[type='checkbox']",
    );
    await expect(notifications).toHaveCount(4); // main notification + overdue + soon + AI
  });

  test("should have all 3 theme options visible", async ({ page }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    const themeButtons = page.locator(".theme-option");
    await expect(themeButtons).toHaveCount(3);
    await expect(themeButtons.nth(0)).toContainText("Light");
    await expect(themeButtons.nth(1)).toContainText("Dark");
    await expect(themeButtons.nth(2)).toContainText("System");
  });

  test("should have export and import buttons visible", async ({ page }) => {
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    await expect(page.locator("text=EXPORT DATA")).toBeVisible();
    await expect(page.locator("text=IMPORT DATA")).toBeVisible();
  });
});
