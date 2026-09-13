/**
 * E2E Tests fuer CatchUp 2.0:
 * Snooze (Aufschieben per Button) und Undo (Chore nach "erledigt" wieder oeffnen).
 */
import { test, expect } from "@playwright/test";

test.describe("CatchUp 2.0 (Snooze & Undo)", () => {
  let token = null;
  const createdIds = [];

  const dueDateFor = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  };

  const dateForOffsetDays = (offsetDays) => {
    const d = new Date();
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + offsetDays);
    const y = out.getFullYear();
    const m = String(out.getMonth() + 1).padStart(2, "0");
    const day = String(out.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  async function login(page) {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");
    token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();
  }

  async function createChore(request, name, offsetDays) {
    const res = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name,
        interval_days: 7,
        due_date: dueDateFor(offsetDays),
        is_private: false,
      },
    });
    const data = await res.json();
    createdIds.push(data.id);
    return data;
  }

  async function getChore(request, id) {
    const res = await request.get(`/api/chores/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  async function cleanup(request) {
    while (createdIds.length) {
      const id = createdIds.pop();
      try {
        await request.delete(`/api/chores/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* already deleted */
      }
    }
  }

  async function swipeDone(page, box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const card = page.locator(".catchup-card").first();
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t =
        i === 0 ? "pointerdown" : i === steps ? "pointerup" : "pointermove";
      const x = Math.round(cx + (100 * i) / steps);
      await card.dispatchEvent(t, {
        clientX: x,
        clientY: cy,
        pointerId: 1,
        isPrimary: true,
        buttons: 1,
        pointerType: "touch",
        cancelable: true,
        bubbles: true,
      });
      await page.waitForTimeout(15);
    }
    await page.waitForTimeout(400);
  }

  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test("Snooze-Flow: Button +1 Woche verschiebt die Chore in die Zukunft", async ({
    page,
    request,
  }) => {
    await login(page);
    const stamp = Date.now();
    const name = `Snooze ${stamp}`;
    const chore = await createChore(request, name, 0); // heute fällig

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Dropdown/Button öffnen
    await page.locator(".snooze-btn").first().click();
    await page.locator(".snooze-sheet").waitFor({ state: "visible" });

    // "+1 Woche" wählen
    await page
      .locator(".snooze-option")
      .filter({ hasText: "+1 Woche" })
      .click();

    // Toast erscheint und Karte wird aus dem sichtbaren Stack entfernt
    await page.waitForSelector(".catchup-toast", { state: "visible" });
    expect(await page.locator(".catchup-toast").textContent()).toContain(
      "Aufgeschoben",
    );
    await page.waitForTimeout(250);

    const remaining = await page
      .locator(".catchup-card")
      .filter({ hasText: name })
      .count();
    expect(remaining).toBe(0);

    // Backend bestätigt: due_date = heute + 7 Tage
    const updated = await getChore(request, chore.id);
    expect(updated.due_date).toBe(dateForOffsetDays(7));
  });

  test("Undo-Flow: Chore nach 'erledigt' wieder öffnen", async ({
    page,
    request,
  }) => {
    await login(page);
    const stamp = Date.now();
    const name = `Undo ${stamp}`;
    const chore = await createChore(request, name, 0); // heute fällig

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Erledigt per Swipe nach rechts
    const top = page.locator(".catchup-card").first();
    const box = await top.boundingBox();
    await swipeDone(page, box);

    // Toast mit UNDO-Aktion erscheint
    await page.waitForSelector(".catchup-toast .toast-action", {
      state: "visible",
    });
    expect(await page.locator(".catchup-toast").textContent()).toContain(
      "Erledigt",
    );

    // UNDO klicken → Chore wieder offen (API done=false)
    await page.locator(".toast-action").click();
    await page.waitForSelector(".catchup-card", { state: "visible" });

    const undone = await getChore(request, chore.id);
    expect(undone.done).toBe(false);
    expect(undone.done_by).toBe(null);
  });
});
