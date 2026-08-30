import { test, expect } from "@playwright/test";

test.describe("FilterPills E2E", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await context.addCookies([]);

    // Step 1: Navigate to mock login API endpoint
    await page.goto("/api/auth/login");
    await page.waitForURL("**/mock-login-page*");

    // Step 2: Submit the mock login form
    await page.click('button[type="submit"]');

    // Step 3: Wait for the auth-callback with token
    await page.waitForURL("**/auth-callback?token=*");

    // Step 4: Home page loads — wait for stats grid (proves callback finished)
    await page.waitForSelector(".stats-grid");

    // Step 5: Navigate to chores page
    await page.click('a[href="/chores"]');
    await page.waitForSelector(".filter-pills");
    await page.waitForTimeout(500);
  });

  test("renders filter pills on chores view", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    await expect(pills).toHaveCount(5);
    await expect(pills.first()).toContainText("Overdue");
    await expect(pills.nth(1)).toContainText("Today");
    await expect(pills.nth(2)).toContainText("Tomorrow");
    await expect(pills.nth(3)).toContainText("This Week");
    await expect(pills.last()).toContainText("Later");
  });

  test("shows clear button when a filter is active", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    await pills.last().click(); // click "Later"

    const clearBtn = page.locator(".clear-btn");
    await expect(clearBtn).toBeVisible();

    const icon = clearBtn.locator("i");
    await expect(icon).toHaveClass(/mdi-close/);
  });

  test("clear button clears filter", async ({ page }) => {
    // Click a filter to make it active
    await page.locator(".filter-pills .chip").nth(1).click();

    const clearBtn = page.locator(".clear-btn");
    await clearBtn.click();

    // Filter pills should still be there
    const pills = page.locator(".filter-pills .chip");
    await expect(pills).toHaveCount(5);
  });

  test("active pill gets active class", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    const todayPill = pills.nth(1); // Today

    await expect(todayPill).not.toHaveClass(/active/);
    await todayPill.click();
    await expect(todayPill).toHaveClass(/active/);
  });

  test("chip counts display correctly", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    const countBadges = page.locator(".chip-count");
    await expect(countBadges).not.toHaveCount(0);

    for (const badge of countBadges.all()) {
      const text = await badge.textContent();
      expect(text).toMatch(/\d+/);
    }
  });
});
