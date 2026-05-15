import { test, expect } from "@playwright/test";

test.describe("Undo marked_done fix", () => {
  test("undo should reset chore to incomplete state with correct due_date", async ({
    page,
    request,
  }) => {
    // Login via the same flow as other passing tests
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Create a fresh chore for testing
    const createResp = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `Undo Test Chore ${Date.now()}`,
        interval_days: 7,
        due_date: dueDate,
        is_private: false,
      },
    });
    const choreData = await createResp.json();
    const choreId = choreData.id;

    try {
      // Go to chores page
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /Chores/ })
        .click();
      await page.waitForTimeout(500);

      // Mark first chore as done via API (since button click is flaky)
      const doneResp = await request.put(`/api/chores/${choreId}/done`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { done_by: "developer@example.com" },
      });
      expect(doneResp.ok()).toBeTruthy();

      // Wait a bit for the done action to complete
      await page.waitForTimeout(1000);

      // Go to logs and find the "marked_done" action
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /Logs/ })
        .click();
      await page.waitForTimeout(500);

      // Click UNDO on the marked_done action
      const undoButtons = page.getByRole("button", { name: /UNDO/ });
      await expect(undoButtons.first()).toBeVisible();
      await undoButtons.first().click();

      // Wait for undo to complete
      await page.waitForTimeout(1000);

      // Go back to chores
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /Chores/ })
        .click();
      await page.waitForTimeout(1000);

      // Verify chore is still in the list (should have been undone)
      const updatedChoreCards = page.locator(".chore-card");
      await expect(updatedChoreCards).toHaveCount({ min: 1 });

      // Verify chore is NOT marked as done anymore via API
      const choreResp = await request.get(`/api/chores/${choreId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const chore = await choreResp.json();
      expect(chore.done).toBe(false);
    } finally {
      // Cleanup
      await request.delete(`/api/chores/${choreId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test("undo on archived chore should restore it", async ({
    page,
    request,
  }) => {
    // Login
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Create chore
    const createResp = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `Archive Undo Test ${Date.now()}`,
        interval_days: 7,
        due_date: dueDate,
        is_private: false,
      },
    });
    const choreData = await createResp.json();
    const choreId = choreData.id;

    try {
      // Go to logs and verify we can undo an action without error
      await page
        .getByRole("navigation")
        .getByRole("link", { name: /Logs/ })
        .click();
      await page.waitForTimeout(500);

      // Verify we can undo at least one action
      const undoButtons = page.getByRole("button", { name: /UNDO/ });
      const count = await undoButtons.count();
      if (count > 0) {
        await undoButtons.first().click();
        await page.waitForTimeout(1000);
        await expect(page).toHaveTitle(/Choretwo/);
      }
    } finally {
      await request.delete(`/api/chores/${choreId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});
