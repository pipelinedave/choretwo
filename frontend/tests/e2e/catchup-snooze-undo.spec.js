/**
 * E2E Tests fuer CatchUp 2.0:
 * Snooze (Aufschieben per Button) und Undo (Chore nach "erledigt" wieder oeffnen).
 */
import { test, expect } from "@playwright/test";

test.describe("CatchUp 2.0 (Snooze & Undo)", () => {
  let token = null;
  const createdIds = [];

  // Lokale Datumkonstruktion (kein UTC) — konsistent zur App (localDateStr).
  const dueDateFor = (offsetDays) => {
    const d = new Date();
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + offsetDays);
    const y = out.getFullYear();
    const m = String(out.getMonth() + 1).padStart(2, "0");
    const day = String(out.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const dateForOffsetDays = (offsetDays) => dueDateFor(offsetDays);

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

  // Isolations-Helfer: beseitigt AKTIVE Chores des Mock-Users vor jedem Test,
  // damit der CatchUp-Stack deterministisch nur die eigenen Chores enthält.
  //
  // Robust gegen Last-Aussetzer (siehe catchup.spec.js): nacktes list.json()
  // crasht bei transienten leeren/5xx-Antworten mit "Unexpected end of JSON
  // input" → HTTP-Check + defensives Parsen + Retry + Fallback [].
  async function fetchChores(request, headers, page) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const list = await request.get(
        `/api/chores/?page=${page}&limit=100`,
        { headers },
      );
      const text = await list.text();
      if (list.ok() && text) {
        try {
          return JSON.parse(text);
        } catch {
          /* fallthrough → retry */
        }
      }
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
    return [];
  }

  async function clearActiveChores(request) {
    // Isolation muss ALLE aktiven Chores löschen, nicht nur die ersten 10
    // (GET /api/chores/ ist paginiert, default limit=10). Reste aus vorherigen
    // Tests/Specs (v.a. Zukunfts-Chores von Snooze-Tests mit späterem due_date)
    // würden sonst den CatchUp-Stack verfälschen. Pagination durchlaufen.
    const headers = { Authorization: `Bearer ${token}` };
    for (let page = 1; page <= 50; page++) {
      const chores = await fetchChores(request, headers, page);
      if (!chores.length) break;
      for (const c of chores) {
        try {
          await request.delete(`/api/chores/${c.id}`, { headers });
        } catch {
          /* already gone */
        }
      }
    }
  }

  // Login + Isolation pro Test: erst einloggen (Token setzen), dann den Stack
  // leeren, damit die Tests deterministisch gegen einen sauberen Stack laufen.
  test.beforeEach(async ({ page, request }) => {
    await login(page);
    await clearActiveChores(request);
  });

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
