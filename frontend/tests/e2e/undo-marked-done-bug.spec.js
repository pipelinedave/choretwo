import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";
import { localDate, localDateOffset } from "./helpers/dates.js";

// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores
// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.
const USER = specEmail("undo-marked-done-bug");
test.describe("Undo marked_done Bug (Issue #42)", () => {
  test.beforeEach(async ({ page }) => {
    await e2eLogin(page, { email: USER, name: "undo-marked-done-bug" });
  });

  test("undo marked_done should reset due_date to previous value (not next period)", async ({
    page,
    request,
  }) => {
    const testId = Date.now();
    const choreName = `Undo Bug Test Chore ${testId}`;
    const today = localDate();
    const nextWeek = localDateOffset(7);

    const token = await page.evaluate(() => localStorage.getItem("token"));

    // 1. Create chore with due_date = today
    const createResp = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: today,
        is_private: false,
      },
    });
    const choreData = await createResp.json();
    expect(createResp.status()).toBe(200);
    const choreId = choreData.id;

    // 2. Mark as done
    const doneResp = await request.put(`/api/chores/${choreId}/done`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: { done_by: "developer@example.com" },
    });
    expect(doneResp.ok()).toBeTruthy();

    // 3. Verify chore is done with NEXT due_date
    const afterDoneResp = await request.get(`/api/chores/${choreId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterDoneChore = await afterDoneResp.json();
    expect(afterDoneChore.done).toBe(true);
    expect(afterDoneChore.last_done).toBe(today);
    expect(afterDoneChore.due_date).toBe(nextWeek);

    // 4. Get the "marked_done" log entry
    const logsResp = await request.get("/api/logs/?page=1&limit=100", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const logs = await logsResp.json();
    const doneLog = logs.find(
      (l) => l.action_type === "marked_done" && l.chore_id === choreId,
    );
    expect(doneLog).toBeTruthy();

    // 5. Undo the marked_done action
    const undoResp = await request.post("/api/logs/undo", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: { log_id: doneLog.id },
    });
    expect(undoResp.ok()).toBeTruthy();
    const undoData = await undoResp.json();
    expect(undoData.undone_action_type).toBe("marked_done");

    // 6. CRITICAL: Verify chore is BACK to incomplete with ORIGINAL due_date
    const afterUndoResp = await request.get(`/api/chores/${choreId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const afterUndoChore = await afterUndoResp.json();

    expect(afterUndoChore.done).toBe(false);
    expect(afterUndoChore.due_date).toBe(today);
    expect(afterUndoChore.last_done).toBeNull();
  });
});
