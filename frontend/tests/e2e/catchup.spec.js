/**
 * E2E Tests fuer den CatchUp (Aufholen) Stack.
 *
 * Testet: Button-Zugang, Sortier-Reihenfolge (overdue > today > ...),
 * Deck-Effekt (mehrere Cards sichtbar), Swipe-Done (naechste Card rutscht
 * auf), Fortschrittsanzeige und Empty-State.
 */
import { test, expect } from "@playwright/test";

test.describe("CatchUp Stack", () => {
  let token = null;
  const createdIds = [];

  const dueDateFor = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
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

  test("zeigt den CatchUp-Stack mit korrekter Sortier-Reihenfolge und Deck-Effekt", async ({
    page,
    request,
  }) => {
    // Login + Chores in verschiedenen Dringlichkeits-Stufen anlegen
    await login(page);
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
    await page.waitForSelector(".catchup-card", { state: "visible" });

    // Alle 5 eigenen Chores sind im Stack
    const cardBodies = page.locator(".catchup-card");
    const titles = await cardBodies.locator(".chore-title").allTextContents();
    const ownTitles = titles
      .map((t) => t.trim())
      .filter((t) => t.includes(stamp));
    expect(ownTitles).toHaveLength(5);

    // Sortier-Reihenfolge (logisch): aelteste ueberfaellige zuerst
    const firstOwn = ownTitles[0];
    expect(firstOwn).toBe(a);
    // Der dringendste (a, -4d) liegt ganz oben, der spaeteste (e, +3d) unten
    const titleOrder = titles.map((t) => t.trim());
    expect(titleOrder.indexOf(a)).toBeLessThan(titleOrder.indexOf(e));

    // Deck-Effekt: nicht-aktive Cards haben unterschiedliche Bounding-Boxen
    // (untere Cards sind per Stack-Offset verschoben)
    const box0 = await cardBodies.nth(0).boundingBox();
    const lastIndex = (await cardBodies.count()) - 1;
    const boxLast = await cardBodies.nth(lastIndex).boundingBox();
    expect(box0).toBeTruthy();
    expect(boxLast).toBeTruthy();
    const diffY = Math.abs(box0.y - boxLast.y);
    expect(diffY).toBeGreaterThan(20);

    // Fortschrittsanzeige startet bei "0 von N" geschafft
    const subtitle = await page.locator(".subtitle").textContent();
    expect(subtitle).toContain("0 von");
  });

  test("Swipe-Done auf oberster Card arbeitet den Stack ab", async ({
    page,
    request,
  }) => {
    await login(page);
    const stamp = Date.now();
    const firstName = `Swipe-A ${stamp}`;
    const secondName = `Swipe-B ${stamp}`;
    await createChore(request, firstName, -2);
    await createChore(request, secondName, 0);

    await page.goto("/catchup");
    await page.waitForSelector(".catchup-card", { state: "visible" });

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
  });

  test("Empty-State nach Abarbeitung aller Chores", async ({
    page,
    request,
  }) => {
    await login(page);
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
});
