import { test, expect } from "@playwright/test";

test.describe("Undo marked_done Bug Fix Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
  });

  test("undo marked_done should reset due_date, last_done, done_to original values", async ({
    page,
  }) => {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const today = new Date().toISOString().split("T")[0];
    const next7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // 1. Create chore with due_date = today
    const result = await page.evaluate(
      async (params) => {
        const { token, today } = params;
        const r = await fetch("/api/chores/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: `Undo Bug Test ${Date.now()}`,
            interval_days: 7,
            due_date: today,
            is_private: false,
          }),
        });
        return r.json();
      },
      { token, today },
    );

    const choreId = result.id;
    expect(result.id).toBeDefined();

    // 2. Mark chore as done
    const doneResp = await page.evaluate(
      async (params) => {
        const { token, id } = params;
        const r = await fetch(`/api/chores/${id}/done`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ done_by: "developer@example.com" }),
        });
        return r.json();
      },
      { token, id: choreId, next7, today },
    );

    expect(doneResp.done).toBe(true);
    expect(doneResp.due_date).toBe(next7);
    expect(doneResp.last_done).toBe(today);
    expect(doneResp.done_by).toBe("developer@example.com");

    // 3. Get the marked_done log entry
    const logsResp = await page.evaluate(
      async (params) => {
        const { token } = params;
        const r = await fetch("/api/logs/?page=1&limit=50", {
          headers: { Authorization: `Bearer ${token}` },
        });
        return r.json();
      },
      { token },
    );

    const doneLog = logsResp.find(
      (l) => l.action_type === "marked_done" && l.chore_id === choreId,
    );

    expect(doneLog).toBeDefined();
    expect(doneLog.action_details.previous_due_date).toBe(today);

    // 4. UNDO the marked_done
    const undoResp = await page.evaluate(
      async (params) => {
        const { token, logId } = params;
        const r = await fetch("/api/logs/undo", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ log_id: logId }),
        });
        return r.json();
      },
      { token, logId: doneLog.id },
    );

    expect(undoResp.undone_action_type).toBe("marked_done");

    // Wait for HTTP calls to complete
    await page.waitForTimeout(2000);

    // 5. Verify chore state AFTER undo
    const afterUndo = await page.evaluate(
      async (params) => {
        const { token, id } = params;
        const r = await fetch(`/api/chores/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return r.json();
      },
      { token, id: choreId },
    );

    // THE CRITICAL ASSERTIONS
    expect(afterUndo.done).toBe(false);
    expect(afterUndo.due_date).toBe(today);
    expect(afterUndo.last_done).toBeNull();
    expect(afterUndo.done_by).toBeNull();

    // Cleanup
    await page.evaluate(
      async (params) => {
        const { token, id } = params;
        fetch(`/api/chores/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      },
      { token, id: choreId },
    );
  });
});
