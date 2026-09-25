/**
 * E2E Tests fuer die CatchUp 2.0 Edge-Cases.
 *
 * Testet: UNDO stellt die due_date korrekt wieder her (Bug 2 Kern),
 * Snooze per Swipe-up, Snooze auf custom Datum, Recurrence-Hinweis im Toast,
 * Filter "Überfällig + Heute" und den Fortschrittszähler nach done/undo.
 */
import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

// Eigene Test-Adresse pro Spec — verhindert, dass sich die CatchUp-Stacks der
// drei CatchUp-Specs in der geteilten Test-DB gegenseitig verunreinigen.
const USER = specEmail("catchup-edge");

test.describe("CatchUp 2.0 Edge-Cases", () => {
  let token = null;
  const createdIds = [];

  // Lokale Datumkonstruktion (kein UTC) — konsistent zur App (localDateStr).
  const dateForOffsetDays = (offsetDays) => {
    const d = new Date();
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + offsetDays);
    const y = out.getFullYear();
    const m = String(out.getMonth() + 1).padStart(2, "0");
    const day = String(out.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // JWT-Injection statt OIDC-Flow — siehe helpers/auth.js fuer die Begruendung.
  // Das Warten auf den persistierten Token ist in `e2eLogin` enthalten.
  async function login(page) {
    token = await e2eLogin(page, { email: USER, name: "CatchUp Edge" });
    expect(token).toBeTruthy();
  }

  async function createChore(request, name, offsetDays, intervalDays = 7) {
    const res = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name,
        interval_days: intervalDays,
        due_date: dateForOffsetDays(offsetDays),
        is_private: false,
      },
    });
    const data = await res.json();
    // POST liefert { message, id, chore: {...} } — greife auf das volle Objekt zu.
    const chore = data.chore || data;
    createdIds.push(chore.id);
    return chore;
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

  // Isolations-Helfer: beseitigt AKTIVE Chores des Mock-Users vor jedem Test.
  // Da alle E2E-Specs dieselbe geteilte Test-DB verwenden, hinterlassen andere
  // Specs (chore-crud, undo-marked-done, swipe-*) eigene Chores, die den
  // CatchUp-Stack verfälschen würden. Die CatchUp-Tests setzen einen cleanen
  // Stack voraus (sonst ist die oberste Karte nicht zwangsläufig die des Tests).
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
  // Vor jedem Test (NICHT nur wenn token schon aus einem Vor-Test kommt).
  test.beforeEach(async ({ page, request }) => {
    await login(page);
    await clearActiveChores(request);
  });

  /** Swipe nach rechts (Done) auf der aktiven Card. */
  async function swipeDone(page) {
    const card = page.locator(".catchup-card").first();
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
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
    // Auf den Bestätigungs-Toast warten: showToast wird erst NACH dem await
    // markDone() (Backend-Persistenz) aufgerufen. Der Toast ist damit das
    // definitive „Persistenz abgeschlossen"-Signal — statt fester Timeouts, die
    // unter Last zu einem Race führen (db.done könnte noch false sein).
    await page
      .locator(".catchup-toast")
      .waitFor({ state: "visible", timeout: 5000 });
  }

  /** Swipe nach oben (Snooze) auf der aktiven Card. */
  async function swipeUp(page) {
    const card = page.locator(".catchup-card").first();
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t =
        i === 0 ? "pointerdown" : i === steps ? "pointerup" : "pointermove";
      const y = Math.round(cy - (90 * i) / steps);
      await card.dispatchEvent(t, {
        clientX: cx,
        clientY: y,
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

  test("UNDO stellt die due_date der Chore wieder auf heute her (Bug 2)", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const originalDue = dateForOffsetDays(0);
    const chore = await createChore(request, `Undo-Due ${stamp}`, 0);
    expect(chore.due_date).toBe(originalDue);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Done → due_date wird nach interval (7 Tage) verschoben
    await swipeDone(page);
    let db = await getChore(request, chore.id);
    expect(db.done).toBe(true);
    expect(db.due_date).not.toBe(originalDue);

    // UNDO → die Chore kommt zurueck und due_date wird wieder auf heute gesetzt
    await page
      .locator(".toast-action")
      .waitFor({ state: "visible", timeout: 4000 });
    await page.locator(".toast-action").click();

    // Chore ist wieder im Stack sichtbar
    await page.waitForSelector(".catchup-card", {
      state: "visible",
      timeout: 5000,
    });
    const visibleTitles = await page
      .locator(".catchup-card .chore-title")
      .allTextContents();
    expect(visibleTitles.some((t) => t.includes(stamp))).toBe(true);

    // due_date wieder heute, done=false
    db = await getChore(request, chore.id);
    expect(db.done).toBe(false);
    expect(db.due_date).toBe(originalDue);
  });

  test("Swipe nach oben oeffnet das Snooze-Sheet", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await createChore(request, `SwipeUp ${stamp}`, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    await swipeUp(page);
    await page.waitForSelector(".snooze-sheet", {
      state: "visible",
      timeout: 4000,
    });
    const sub = await page.locator(".snooze-subtitle").textContent();
    expect(sub.trim()).toContain(`SwipeUp ${stamp}`);
  });

  test("Snooze auf ein custom Datum verschiebt die Chore korrekt", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const chore = await createChore(request, `Snooze-Custom ${stamp}`, 0);
    const customDate = dateForOffsetDays(6);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Snooze-Sheet per Swipe nach oben auf der obersten (einzigen) Chore öffnen
    await swipeUp(page);
    await page.waitForSelector(".snooze-sheet", { state: "visible" });
    const sub = await page.locator(".snooze-subtitle").textContent();
    expect(sub.trim()).toContain(`Snooze-Custom ${stamp}`);

    // Custom-Datum setzen und bestaetigen. Der Toast ("Aufgeschoben auf …")
    // erscheint erst NACH erfolgreichem Server-Save (applySnooze → await
    // snoozeChore → showToast). Auf dieses deterministische Signal warten
    // statt auf ein fixes Timeout — eliminiert das DB-Read-Race unter Last
    // (Firefox/Chromium geteilt dieselbe Test-DB).
    await page.locator(".snooze-custom-input").fill(customDate);
    await page.locator(".snooze-custom-input").press("Enter");

    await page.waitForSelector(".catchup-toast", { state: "visible" });
    await page.waitForFunction(
      () => {
        const el = document.querySelector(".toast-message");
        return el && /Aufgeschoben auf/.test(el.textContent);
      },
      { timeout: 5000 },
    );
    const db = await getChore(request, chore.id);
    expect(db.due_date).toBe(customDate);
  });

  test("Recurrence-Hinweis erscheint im Toast nach dem Erledigen", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await createChore(request, `Rec-Toggle ${stamp}`, 0, 14);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    await swipeDone(page);
    await page.waitForSelector(".catchup-toast", {
      state: "visible",
      timeout: 4000,
    });
    const msg = await page.locator(".toast-message").textContent();
    expect(msg).toContain("Nächste Fälligkeit");
  });

  test("Filter 'Überfällig + Heute' blendet spaetere Chores aus", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const overdue = `Filt-A ${stamp}`;
    const today = `Filt-B ${stamp}`;
    const later = `Filt-C ${stamp}`;
    await createChore(request, overdue, -2);
    await createChore(request, today, 0);
    await createChore(request, later, 3);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Ueberfaellig + Heute-Button klicken
    await page.locator(".filter-chip", { hasText: "Überfällig" }).click();
    await page.waitForTimeout(300);

    const titles = await page
      .locator(".catchup-card .chore-title")
      .allTextContents();
    const own = titles.map((t) => t.trim()).filter((t) => t.includes(stamp));
    // Nur die ueberfaellige + heutige Chore sind sichtbar, die spaetere nicht
    expect(own).toContain(overdue);
    expect(own).toContain(today);
    expect(own).not.toContain(later);
  });

  test("Fortschrittszähler aktualisiert sich nach done und undo", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await createChore(request, `Prog-A ${stamp}`, -1);
    await createChore(request, `Prog-B ${stamp}`, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Start: 0 von 2 geschafft
    let subtitle = await page.locator(".subtitle").textContent();
    expect(subtitle).toContain("0 von");

    // Done der ersten Chore → 1 von 2
    await swipeDone(page);
    subtitle = await page.locator(".subtitle").textContent();
    expect(subtitle).toContain("1 von");

    // UNDO → wieder 0 von 2
    await page
      .locator(".toast-action")
      .waitFor({ state: "visible", timeout: 4000 });
    await page.locator(".toast-action").click();
    await page.waitForSelector(".catchup-card", {
      state: "visible",
      timeout: 5000,
    });
    // Toast nach undo zeigt keine Action (Fehler-Toast?) → kurz warten
    await page.waitForTimeout(300);
    subtitle = await page.locator(".subtitle").textContent();
    expect(subtitle).toContain("0 von");
  });
});
