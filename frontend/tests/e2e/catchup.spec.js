/**
 * E2E Tests fuer den CatchUp (Aufholen) Stack.
 *
 * Testet: Button-Zugang, Sortier-Reihenfolge (overdue > today > ...),
 * Deck-Effekt (mehrere Cards sichtbar), Swipe-Done (naechste Card rutscht
 * auf), Fortschrittsanzeige und Empty-State.
 */
import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

// Eigene Test-Adresse: diese Spec und die beiden anderen CatchUp-Specs teilen
// sich die DB, legen aber Chores unter verschiedenen `user_email` an. Sonst
// mischen sich die Stacks der Specs gegenseitig.
const USER = specEmail("catchup");

test.describe("CatchUp Stack", () => {
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

  // JWT-Injection statt OIDC-Flow — siehe helpers/auth.js fuer die Begruendung.
  async function login(page) {
    token = await e2eLogin(page, { email: USER, name: "CatchUp" });
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
  // damit der CatchUp-Stack deterministisch nur die eigenen Chores enthält
  // (andere Specs teilen sich dieselbe Test-DB).
  //
  // Robust gegen Last-Aussetzer: Unter paralleler Browser-Last (Chromium+Firefox
  // gegen denselben Monolith) liefert GET /api/chores/ gelegentlich einen leeren
  // Body oder einen 5xx. Ein nacktes `await list.json()` crasht dann mit
  // "SyntaxError: Unexpected end of JSON input" → flaky. Daher: HTTP-Check +
  // defensives Parsen + kurzer Retry + Fallback [].
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
      // Kurzer Backoff gegen transiente Monolith-Aussetzer
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

  /**
   * Simuliert einen Swipe nach rechts (Done) auf der aktiven Card.
   * Verwendet Pointer-Events per locator.dispatchEvent direkt am Card-Element,
   * damit die Vue-pointer-Handler browseruebergreifend feuern.
   */
  async function swipeDone(page, box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const card = page.locator(".catchup-card").first();

    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t =
        i === 0 ? "pointerdown" : i === steps ? "pointerup" : "pointermove";
      const x = Math.round(cx + (100 * i) / steps);
      const y = Math.round(cy);
      await card.dispatchEvent(t, {
        clientX: x,
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

  test("rendert Single-Card-Deck mit Sortierung, Peek und Fortschritts-Banner", async ({
    page,
    request,
  }) => {
    // Login + Chores in verschiedenen Dringlichkeits-Stufen anlegen
    const stamp = Date.now();
    const a = `Sort-A ${stamp}`;
    const b = `Sort-B ${stamp}`;
    const c = `Sort-C ${stamp}`;
    const d = `Sort-D ${stamp}`;
    const e = `Sort-E ${stamp}`;
    await createChore(request, a, -4);
    await createChore(request, b, -1);
    await createChore(request, c, 0);
    await createChore(request, d, 1);
    await createChore(request, e, 3);

    // Navigation zum CatchUp
    await page.goto("/catchup");
    // Single-Card-Deck: nur die oberste Card + 1 Peek sind im DOM. Warten,
    // bis die dringendste (a, -4d) als aktive Karte gerendert ist. Bei einem
    // transistent leeren/verkuerzten Fetch unter Browser-Last (dokumentierte
    // Monolith-Flakiness) wird einmal neu geladen und erneut gewartet.
    const waitForDeck = () =>
      page.waitForFunction(
        (s) => {
          const cards = document.querySelectorAll(".catchup-card");
          if (cards.length < 2) return false;
          const t = cards[0].querySelector(".chore-title")?.textContent || "";
          return t.includes(s);
        },
        stamp,
        { timeout: 8000 },
      );
    try {
      await waitForDeck();
    } catch {
      await page.reload();
      await waitForDeck();
    }

    // Genau 2 Cards gerendert (aktiv + Peek), NICHT der ganze Stack
    const cardBodies = page.locator(".catchup-card");
    expect(await cardBodies.count()).toBe(2);

    // Sortier-Reihenfolge: aelteste ueberfaellige aktiv, naechste als Peek
    const topTitle = (
      await cardBodies.nth(0).locator(".chore-title").textContent()
    ).trim();
    const peekTitle = (
      await cardBodies.nth(1).locator(".chore-title").textContent()
    ).trim();
    expect(topTitle).toBe(a);
    expect(peekTitle).toBe(b);

    // Fortschritts-Banner "Karte X von Y"
    const counter = await page.locator(".stack-counter").textContent();
    expect(counter).toContain("Karte 1 von 5");

    // Deck-Effekt: die Peek-Card ist per Stack-Offset verschoben
    const box0 = await cardBodies.nth(0).boundingBox();
    const box1 = await cardBodies.nth(1).boundingBox();
    expect(box0).toBeTruthy();
    expect(box1).toBeTruthy();
    const diffY = Math.abs(box0.y - box1.y);
    expect(diffY).toBeGreaterThan(8);

    // Fortschrittsanzeige startet bei "0 von N" geschafft
    const subtitle = await page.locator(".subtitle").textContent();
    expect(subtitle).toContain("0 von");
  });

  test("Swipe-Done auf oberster Card arbeitet den Stack ab", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const firstName = `Swipe-A ${stamp}`;
    const secondName = `Swipe-B ${stamp}`;
    await createChore(request, firstName, -2);
    await createChore(request, secondName, 0);

    await page.goto("/catchup");
    // Auf beide eigenen Chores warten, bevor auf die oberste Karte zugegriffen
    // wird (sonst Race bei langsamem Rendering).
    await page.waitForFunction(
      (s) => {
        const titles = [
          ...document.querySelectorAll(".catchup-card .chore-title"),
        ].map((el) => el.textContent.trim());
        return titles.filter((t) => t.includes(s)).length >= 2;
      },
      stamp,
      { timeout: 8000 },
    );

    // Die aelteste/ueberfaellige Chore ist ganz oben (Sortier-Logik)
    const cardBodies = page.locator(".catchup-card");
    const topTitle = await cardBodies
      .first()
      .locator(".chore-title")
      .textContent();
    expect(topTitle.trim()).toBe(firstName);

    // Swipe-Rechts (Done) auf der obersten Card simulieren (Touch → Pointer)
    const top = cardBodies.first();
    const box = await top.boundingBox();
    expect(box).toBeTruthy();
    await swipeDone(page, box);

    // Nach dem Done: die naechste (zweite) Chore ist oben; die erledigte ist weg
    await page.waitForFunction((name) => {
      const titles = [
        ...document.querySelectorAll(".catchup-card .chore-title"),
      ].map((el) => el.textContent.trim());
      return titles.includes(name) && titles.indexOf(name) === 0;
    }, secondName);
    // Erste ist erledigt und nicht mehr im Stack
    const remainingCount = await page
      .locator(".catchup-card")
      .filter({ hasText: stamp })
      .count();
    expect(remainingCount).toBe(1);

    // Fortschritts-Banner zaehlt weiter: Karte 2 von 2
    const counter = await page.locator(".stack-counter").textContent();
    expect(counter).toContain("Karte 2 von 2");
  });

  test("Empty-State nach Abarbeitung aller Chores", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const onlyName = `Empty ${stamp}`;
    await createChore(request, onlyName, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Genau diese Chore ist oben
    const topTitle = await page
      .locator(".catchup-card")
      .first()
      .locator(".chore-title")
      .textContent();
    expect(topTitle.trim()).toBe(onlyName);

    const top = page.locator(".catchup-card").first();
    const box = await top.boundingBox();
    await swipeDone(page, box);

    // Empty-State nach Abarbeitung (die einzige Chore ist erledigt)
    await page.waitForSelector(".empty-state", {
      state: "visible",
      timeout: 5000,
    });
    const msg = await page.locator(".empty-state").textContent();
    expect(msg).toContain("Aufholen");
  });

  test("Swipe nach links öffnet das Snooze-Sheet und verlässt die View nicht", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await createChore(request, `LeftSwipe ${stamp}`, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Swipe nach links auf der aktiven Card (Pointer-Sequenz, wie swipeDone
    // aber mit negativem dx)
    const card = page.locator(".catchup-card").first();
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t =
        i === 0 ? "pointerdown" : i === steps ? "pointerup" : "pointermove";
      await card.dispatchEvent(t, {
        clientX: Math.round(cx - (120 * i) / steps),
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

    // KEINE Navigation: die View bleibt /catchup (Regression: Links-Swipe
    // warf frueher per Edit-Redirect aus dem CatchUp raus)
    expect(page.url()).toContain("/catchup");

    // Stattdessen öffnet sich das Snooze-Sheet mit der Chore
    await page.waitForSelector(".snooze-sheet", {
      state: "visible",
      timeout: 4000,
    });
    const sub = await page.locator(".snooze-subtitle").textContent();
    expect(sub.trim()).toContain(`LeftSwipe ${stamp}`);
  });

  test("Später-Button reagiert auf echten Touch (kein preventDefault auf touchstart)", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    await createChore(request, `TouchBtn ${stamp}`, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Echter Touch-Tap (hasTouch: true in beiden Projekten): geht durch die
    // echte Browser-Touch-Pipeline inkl. Click-Synthese. Regression: Das
    // alte @touchstart.prevent auf der Card unterdrückte den synthetischen
    // Click -> der Button war auf Touch-Geräten tot.
    const btn = page.locator(".snooze-btn").first();
    const box = await btn.boundingBox();
    expect(box).toBeTruthy();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    await page.waitForSelector(".snooze-sheet", {
      state: "visible",
      timeout: 4000,
    });
    const sub = await page.locator(".snooze-subtitle").textContent();
    expect(sub.trim()).toContain(`TouchBtn ${stamp}`);
  });
});
