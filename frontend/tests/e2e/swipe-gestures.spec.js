import { test, expect } from "@playwright/test";

test.describe("Swipe Gestures on ChoreCard", () => {
  let choreId = null;

  test.beforeEach(async ({ page, request }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const response = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `Swipe Test Chore ${Date.now()}`,
        interval_days: 7,
        due_date: dueDate,
        is_private: false,
      },
    });
    const data = await response.json();
    choreId = data.id;
  });

  test.afterEach(async ({ page, request }) => {
    if (choreId) {
      const token = await page.evaluate(() => localStorage.getItem("token"));
      await request.delete(`/api/chores/${choreId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      choreId = null;
    }
  });

  test("chore cards should be rendered on /chores", async ({ page }) => {
    await page.goto("/chores");
    await page.waitForTimeout(300);
    const firstCard = page.locator(".chore-card").first();
    await expect(firstCard).toBeVisible();
  });

  test("chore cards should have swipe action action elements", async ({
    page,
  }) => {
    await page.goto("/chores");
    await page.waitForTimeout(300);

    const cards = page.locator(".chore-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const firstCard = cards.first();
    const swipeOverlay = firstCard.locator(".swipe-actions-overlay");
    await expect(swipeOverlay).toBeVisible();

    const actionItems = swipeOverlay.locator(".swipe-action");
    const actionCount = await actionItems.count();
    expect(actionCount).toBeGreaterThan(0);
  });

  for (const action of ["Mark Done", "Edit", "Archive"]) {
    test(`swipe overlay should contain ${action} action`, async ({ page }) => {
      await page.goto("/chores");
      await page.waitForTimeout(300);

      const firstCard = page.locator(".chore-card").first();
      const swipeOverlay = firstCard.locator(".swipe-actions-overlay");
      await expect(swipeOverlay).toBeVisible();

      const actionElements = swipeOverlay.locator(".swipe-action");
      const found = await actionElements.filter({ hasText: action }).count();
      expect(found).toBeGreaterThan(0);
    });
  }
});
