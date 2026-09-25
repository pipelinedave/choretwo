/**
 * E2E-Tests fuer den Session-Lebenszyklus des Aufholen-Decks (STAGE 2).
 *
 * Deckt die Befunde ab, bei denen der Zaehler das Deck verliess:
 *   - B4: ein Filterklick setzte `originalTotal` auf die gefilterte Menge
 *         zurueck — 10/20 erledigt, Klick auf "Überfällig + Heute", und der
 *         Fortschritt sprang auf 0/5. Das fuehlt sich wie Datenverlust an.
 *   - B2: `sessionBaseline` wurde geschrieben und nie gelesen.
 *   - D1: nach der letzten Chore 1300ms Success-Overlay, dann Auto-Redirect
 *         nach "/" — bei 50 Chores im Stapel fliegt man raus, egal wie viel
 *         uebrig ist, und das Undo-Fenster war ein Rennen gegen den Timer.
 *
 * Eigene Test-Adresse pro Spec — siehe catchup-edge-cases.spec.js.
 */
import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

const USER = specEmail("catchup-session");

test.describe("CatchUp Session", () => {
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
    token = await e2eLogin(page, { email: USER, name: "CatchUp Session" });
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

  // Wie in den drei bestehenden CatchUp-Specs: GET /api/chores/ ist paginiert
  // und liefert unter Last gelegentlich leere/5xx-Antworten.
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

  test("Filterwechsel setzt den Session-Fortschritt nicht zurueck", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    // 2 ueberfaellig, 1 heute, 2 spaeter: der Filter "Überfällig + Heute"
    // blendet die beiden spaeteren aus, die Gesamtzahl bleibt 5.
    await createChore(request, `Sess-A ${stamp}`, -3);
    await createChore(request, `Sess-B ${stamp}`, -1);
    await createChore(request, `Sess-C ${stamp}`, 0);
    await createChore(request, `Sess-D ${stamp}`, 3);
    await createChore(request, `Sess-E ${stamp}`, 9);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    expect(await page.locator(".subtitle").textContent()).toContain("0 von 5");
    expect(await page.locator(".stack-counter").textContent()).toContain(
      "Karte 1 von 5",
    );

    // Zwei Chores ueber den sichtbaren Erledigen-Knopf abarbeiten.
    for (let i = 0; i < 2; i++) {
      await page.locator(".done-btn").first().click();
      await page.waitForSelector(".catchup-toast", { state: "visible" });
    }
    await expect(page.locator(".subtitle")).toHaveText(/2 von 5/);
    await expect(page.locator(".stack-counter")).toHaveText(/Karte 3 von 5/);

    // Filterwechsel: 3 Chores werden sichtbar (1 ueberfaellig, 1 heute, 1 in
    // 3 Tagen -> nein: die beiden ueberfaelligen sind erledigt, also 1 heute
    // + 0). Der Fortschritt darf NICHT auf die gefilterte Menge springen.
    await page.locator(".filter-chip", { hasText: "Überfällig" }).click();
    await page.waitForTimeout(300);

    await expect(page.locator(".subtitle")).toHaveText(/2 von 5/);
    await expect(page.locator(".stack-counter")).toHaveText(/Karte 3 von 5/);

    // Und der sichtbare Stapel ist tatsaechlich kleiner — sonst prueft der
    // Test nichts: nach dem Erledigen der beiden ueberfaelligen blendet
    // "Überfällig + Heute" nur noch die heutige Chore aus.
    const titles = await page
      .locator(".catchup-card .chore-title")
      .allTextContents();
    expect(titles.filter((t) => t.includes(stamp))).toHaveLength(1);
  });

  test("Filter, der alles ausblendet, sagt das auch", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    // NUR eine spaetere Chore: "Überfällig + Heute" blendet sie aus, obwohl
    // die Runde nicht beendet ist.
    await createChore(request, `Sess-F ${stamp}`, 6);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    await page.locator(".filter-chip", { hasText: "Überfällig" }).click();
    await page.waitForTimeout(300);

    // Kein "Alles geschafft" — es ist noch was offen, der Filter blendet es
    // nur aus. Genau dieser Zustand sah vorher wie ein Session-Ende aus.
    const empty = page.locator(".empty-state");
    await empty.waitFor({ state: "visible" });
    await expect(empty).toContainText("Filter");

    // Und der Weg zurueck ist einen Klick entfernt.
    await page.locator(".catchup-empty-action").click();
    await page.waitForSelector(".catchup-card", { state: "visible" });
    await expect(page.locator(".subtitle")).toHaveText(/0 von 1/);
  });

  test("die Historie nimmt auch ein Aufschieben zurueck (Befund B5)", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const name = `Sess-Undo ${stamp}`;
    const chore = await createChore(request, name, -2);
    const originalDue = dueDateFor(-2);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Aufschieben ueber das Sheet.
    await page.locator(".snooze-btn").first().click();
    await page.locator(".snooze-sheet").waitFor({ state: "visible" });
    await page
      .locator(".snooze-option")
      .filter({ hasText: "+1 Woche" })
      .click();
    await page.waitForSelector(".catchup-toast", { state: "visible" });

    let db = await getChore(request, chore.id);
    expect(db.due_date).toBe(dueDateFor(7));

    // Der Toast traegt jetzt eine Aktion (vorher nur bei "erledigt"), und der
    // Verlauf haelt die Aktion dauerhaft — der Toast verschwindet nach 2.5s.
    await page.locator(".toast-action").click();
    await page.waitForTimeout(400);

    db = await getChore(request, chore.id);
    expect(db.due_date).toBe(originalDue);
    await expect(page.locator(".subtitle")).toHaveText(/0 von 1/);
  });

  test("Taste u nimmt die letzte Aktion zurueck, der Verlauf listet alle", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await createChore(request, `Sess-U1 ${stamp}`, -3);
    await createChore(request, `Sess-U2 ${stamp}`, -1);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Zwei Aktionen, mehr als das Undo-Fenster des Toasts abdeckt.
    for (let i = 0; i < 2; i++) {
      await page.locator(".done-btn").first().click();
      await page.waitForSelector(".catchup-toast", { state: "visible" });
      await page.waitForTimeout(200);
    }
    await expect(page.locator(".subtitle")).toHaveText(/2 von 2/);

    // Der Verlauf zaehlt beide Aktionen.
    await page.locator(".history-btn").click();
    await page.locator(".history-panel").waitFor({ state: "visible" });
    await expect(page.locator(".history-row")).toHaveCount(2);

    // Escape schliesst, Taste u nimmt die letzte Aktion zurueck — beides
    // ueber den Tastatur-Handler der View.
    await page.keyboard.press("Escape");
    await expect(page.locator(".history-panel")).toBeHidden();
    await page.keyboard.press("u");
    await page.waitForSelector(".catchup-card", { state: "visible" });
    await expect(page.locator(".subtitle")).toHaveText(/1 von 2/);
  });
});
