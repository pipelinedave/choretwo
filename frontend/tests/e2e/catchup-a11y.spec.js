/**
 * E2E-Tests fuer die Bedienbarkeit des Aufholen-Decks OHNE Geste (STAGE 2).
 *
 * Deckt die Befunde A1 und A2 ab, die vorher von keinem Test beruehrt waren:
 *   - A1: es gab keinen "Erledigen"-Knopf. Die Karte kannte nur Swipe und
 *         den "Später"-Knopf, das Deck war mit der Maus nicht bedienbar.
 *   - A2: `tabindex="0"` ohne keydown-Handler — Enter/Space taten nichts,
 *         `role="listitem"` ohne `role="list"` am Container.
 *
 * Die Geste-Tests in catchup.spec.js decken den Wischpfad ab; dieser Deckel
 * deckt Maus und Tastatur ab. Beide Wege muessen funktionieren.
 *
 * Eigene Test-Adresse pro Spec — siehe catchup-edge-cases.spec.js: alle Specs
 * teilen sich dieselbe Test-DB, und die CatchUp-Stacks mischen sich sonst.
 */
import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

const USER = specEmail("catchup-a11y");

test.describe("CatchUp ohne Geste (Maus + Tastatur)", () => {
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

  async function login(page) {
    token = await e2eLogin(page, { email: USER, name: "CatchUp A11y" });
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

  // Identisch zu den drei bestehenden CatchUp-Specs: GET /api/chores/ ist
  // paginiert (default limit=10) und liefert unter paralleler Browser-Last
  // gelegentlich leere/5xx-Antworten. HTTP-Check + defensives Parsen + Retry,
  // damit "clearActiveChores" nicht flaky wird und den Rest nicht mitzieht.
  async function fetchChores(request, headers, page) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const list = await request.get(`/api/chores/?page=${page}&limit=100`, {
        headers,
      });
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

  test.beforeEach(async ({ page, request }) => {
    await login(page);
    await clearActiveChores(request);
  });

  test.afterEach(async ({ request }) => {
    await cleanup(request);
  });

  test("der Erledigen-Knopf der Aktionsleiste arbeitet mit der Maus", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const name = `Btn-Done ${stamp}`;
    const chore = await createChore(request, name, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Die Aktionsleiste liegt UNTER der Karte, nicht in ihr — genau diese
    // Anordnung macht das Deck erst mit der Maus bedienbar (Befund A1).
    const done = page.locator(".done-btn").first();
    await expect(done).toBeVisible();
    await expect(done).toHaveText(/Erledigen/);

    const doneBox = await done.boundingBox();
    const cardBox = await page.locator(".catchup-card").first().boundingBox();
    expect(doneBox).toBeTruthy();
    expect(cardBox).toBeTruthy();
    expect(doneBox.y).toBeGreaterThan(cardBox.y + cardBox.height - 5);

    // Echter Klick, keine Geste.
    await done.click();

    await page.waitForSelector(".catchup-toast", { state: "visible" });
    expect(await page.locator(".catchup-toast").textContent()).toContain(
      "Erledigt",
    );

    // Und das Backend bestaetigt es — der Knopf ist derselbe Pfad wie die
    // Geste, nicht nur ein optimistischer UI-Zustand.
    const db = await getChore(request, chore.id);
    expect(db.done).toBe(true);
  });

  test("Enter auf der fokussierten Karte erledigt die Chore", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const name = `Key-Enter ${stamp}`;
    const chore = await createChore(request, name, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // ARIA: `role="listitem"` braucht ein `role="list"` als Eltern, und die
    // Karte traegt den Chore-Namen im Label (Befund A2).
    await expect(page.locator(".stack-container")).toHaveAttribute(
      "role",
      "list",
    );
    const card = page.locator(".catchup-card").first();
    await expect(card).toHaveAttribute("role", "listitem");
    await expect(card).toHaveAttribute("aria-label", new RegExp(name));

    // Rein ueber die Tastatur: Karte fokussieren, Enter druecken. Vorher tat
    // das nichts, weil die Karte zwar tabindex="0" hatte, aber keinen Handler.
    await card.focus();
    await page.keyboard.press("Enter");

    await page.waitForSelector(".catchup-toast", { state: "visible" });
    expect(await page.locator(".catchup-toast").textContent()).toContain(
      "Erledigt",
    );

    const db = await getChore(request, chore.id);
    expect(db.done).toBe(true);
  });

  test("Taste 2 oeffnet das Snooze-Sheet, Escape schliesst es", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const name = `Key-Snooze ${stamp}`;
    await createChore(request, name, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    await page.locator(".catchup-card").first().focus();
    await page.keyboard.press("2");

    const sheet = page.locator(".snooze-sheet");
    await sheet.waitFor({ state: "visible", timeout: 4000 });
    expect(await page.locator(".snooze-subtitle").textContent()).toContain(
      name,
    );

    // Escape schliesst das oberste Overlay. Vorher blieb das Sheet offen —
    // es hatte keinen keydown-Handler und die View kannte kein Escape.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("Enter im Datumseingabefeld schreibt das Datum statt zu erledigen", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const name = `Key-Input ${stamp}`;
    const chore = await createChore(request, name, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    await page.locator(".snooze-btn").first().click();
    await page.locator(".snooze-sheet").waitFor({ state: "visible" });

    // Regression auf die Reihenfolge der Guards des Keydown-Handlers: die
    // Eingabe im Datumsfeld darf nicht als "Enter = erledigen" gelesen
    // werden. Ohne den Text-Eingabe-Guard wuerde die Chore hier erledigt
    // statt aufgeschoben.
    await page.locator(".snooze-custom-input").fill(dueDateFor(6));
    await page.locator(".snooze-custom-input").press("Enter");
    await page.waitForSelector(".catchup-toast", { state: "visible" });
    expect(await page.locator(".toast-message").textContent()).toContain(
      "Aufgeschoben auf",
    );

    const db = await getChore(request, chore.id);
    expect(db.done).toBe(false);
    expect(db.due_date).toBe(dueDateFor(6));
  });
});
