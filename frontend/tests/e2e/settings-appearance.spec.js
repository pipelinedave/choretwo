import { test, expect } from "@playwright/test";

function prepareSettings({ context, page, theme, enableNotifications, 
  notifyOverdue, notifySoon, aiLearning, suggestionTypes }) {
  if (theme) localStorage.setItem("settings-theme", theme);
  if (enableNotifications !== undefined) localStorage.setItem("settings-notifications-enabled", JSON.stringify(enableNotifications));
  if (notifyOverdue !== undefined) localStorage.setItem("settings-notifications-overdue", JSON.stringify(notifyOverdue));
  if (notifySoon !== undefined) localStorage.setItem("settings-notifications-soon", JSON.stringify(notifySoon));
  if (aiLearning !== undefined) localStorage.setItem("settings-ai-learning", JSON.stringify(aiLearning));
}

test.describe("Settings — Appearance Theme", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });
  });

  test("selecting a different theme should show save bar", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("settings-theme", "light"));
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    // Wait for page to fully render
    await expect(page.locator("text=Appearance")).toBeVisible();
    await expect(page.locator(".theme-option:has-text('Light')")).toHaveAttribute("aria-pressed", "true");

    // Click "Dark" theme
    const darkBtn = page.locator(".theme-option:has-text('Dark')");
    await darkBtn.click();

    // Save bar should appear
    await expect(page.locator(".save-bar-text")).toContainText(
      "Theme change pending",
    );

    // "Dark" button should now be active
    await expect(page.locator(".theme-option:has-text('Dark')")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".theme-option:has-text('Light')")).toHaveAttribute("aria-pressed", "false");

    // Preview should change
    await expect(page.locator("text=Dark theme preview text")).toBeVisible();
  });

  test("discarding theme change should revert to saved value", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("settings-theme", "dark"));
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    // "Dark" should be active
    const darkBtn = page.locator(".theme-option:has-text('Dark')");
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");

    // Click a different theme
    const lightBtn = page.locator(".theme-option:has-text('Light')");
    await lightBtn.click();

    // Save bar should appear
    await expect(page.locator(".save-bar-text")).toContainText(
      "Theme change pending",
    );

    // Discard
    await page.locator("text=Discard").click();

    // "Dark" should be back to active, save bar gone
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");
    await expect(lightBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("text=Theme change pending")).not.toBeVisible();
  });

  test("saving theme should persist via localStorage", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("settings-theme", "dark"));
    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    // Select "System" theme
    const systemBtn = page.locator(".theme-option:has-text('System')");
    await systemBtn.click();

    await expect(page.locator(".save-bar-text")).toContainText(
      "Theme change pending",
    );

    // Save
    await page.locator("text=Apply").click();

    // Save bar should be gone
    await expect(page.locator("text=Theme change pending")).not.toBeVisible();

    // Verify localStorage
    const savedTheme = await page.evaluate(() =>
      localStorage.getItem("settings-theme"),
    );
    expect(savedTheme).toBe("system");
  });
});
