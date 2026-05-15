import { test, expect } from "@playwright/test";

test.describe("Settings — AI Settings", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/", { timeout: 15000 });
  });

  test("toggling AI learning should show save bar", async ({ page }) => {
    // Set AI state in localStorage so frontend reads it
    await page.evaluate(() => {
      localStorage.setItem("settings-ai-learning", JSON.stringify(false));
    });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    // Wait for AI section to render
    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // Click the AI toggle slider (it's the first toggle on the AI section page)
    const aiSection = page.locator(".settings-section:has-text('AI Copilot')");
    await aiSection.locator("label.toggle").click();

    // Save bar should appear
    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();
  });

  test("toggling suggestion type chip should show save bar", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("settings-ai-learning", JSON.stringify(true));
    });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    // Wait for AI section
    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // Click "Recurrence" chip to deselect it
    await page.locator(".chip:has-text('Recurrence')").click();

    // Save bar should appear
    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();

    // Chip should no longer be active
    await expect(page.locator(".chip:has-text('Recurrence')")).not.toHaveClass(/active/);
  });

  test("discarding AI changes should revert to saved state", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("settings-ai-learning", JSON.stringify(true));
    });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // Toggle AI off
    const aiSection = page.locator(".settings-section:has-text('AI Copilot')");
    await aiSection.locator("label.toggle").click();

    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();

    // Discard
    await page.locator("text=Discard").click();

    // Save bar should be gone
    await expect(page.locator("text=Unsaved AI changes")).not.toBeVisible();
  });

  test("saving AI changes should save to localStorage", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem("settings-ai-learning", JSON.stringify(false));
    });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");

    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // AI toggle should be OFF initially
    const aiSection = page.locator(".settings-section:has-text('AI Copilot')");
    const toggleInput = aiSection.locator('.toggle input[type="checkbox"]');
    await expect(toggleInput).not.toBeChecked();

    // Toggle AI on
    await aiSection.locator("label.toggle").click();

    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();

    // Verify draft reflects the toggle (chip gets active when learning enabled)
    await expect(page.locator(".chip:has-text('Recurrence')")).toHaveClass(/active/);

    // Save
    await page.getByRole('button', { name: 'Save' }).click();

    // Save bar gone
    await expect(page.locator("text=Unsaved AI changes")).not.toBeVisible();
  });
});
