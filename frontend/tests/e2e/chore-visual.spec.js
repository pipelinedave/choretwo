import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

/**
 * Prueft das Motiv der ChoreCard — die KI-Ilustration hinter dem Text.
 *
 * WARUM DIESE SPEC ESISTIERT
 * Die Bilder liegen in `public/chore-images/` und werden ueber eine
 * Manifest-Datei addressiert. Ein Fehler dort ist ansonsten voellig
 * lautlos: kein Build-Error, kein Lint-Error, kein Test-Error — die Karte
 * zeigte einfach ein leeres Feld. Die beiden Tests, die darauf zielen,
 * sind deshalb:
 *
 *   1. naturalWidth > 0   beweist, dass die Datei wirklich ausgeliefert
 *                         wird. Ohne das ist ein 404 unbemerkt.
 *   2. gleicher Name -> gleiches Bild, und verschiedene Namen -> meist
 *      verschiedene Bilder. Das ist die eigentliche Zusage ("pro Chore ein
 *      eigenes Bild") und sie ist nur ueber den Pool erfuellbar.
 *
 * Bewusst KEINE Pruefung der Bildqualitaet oder der Farbe. Das waere eine
 * Sache, die man ansehen muss, nicht eine, die man automatisieren sollte —
 * ein Schwellenwert auf "Farbe ist kraeftig genug" waere willkuerlich und
 * wuerde bei der naechsten Generierung grundlos anschlagen.
 */
const USER = specEmail("chore-visual");

test.describe("ChoreCard-Motiv (KI-Bilder)", () => {
  const created = [];

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await e2eLogin(page, { email: USER, name: "chore-visual" });
  });

  test.afterEach(async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    for (const id of created.splice(0)) {
      await request
        .delete(`/api/chores/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {});
    }
  });

  /** Legt eine Chore an und liefert deren ID. */
  async function create(page, request, name) {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const res = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name,
        interval_days: 7,
        due_date: "2026-04-24",
        is_private: false,
      },
    });
    expect(res.ok(), `Chore "${name}" konnte nicht angelegt werden`).toBe(true);
    const body = await res.json();
    const id = body.id ?? body._embedded?.id;
    created.push(id);
    return id;
  }

  test("rendert das Motiv als <img> mit geladener Bilddatei", async ({
    page,
    request,
  }) => {
    await create(page, request, "Wäsche waschen");
    await page.goto("/chores");
    await expect(page.locator(".chore-card").first()).toBeVisible();

    const img = page.locator(".chore-visual-img").first();
    await expect(img).toBeVisible();

    // Aus public/ geliefert, aus dem generierten Manifest.
    await expect(img).toHaveAttribute(
      "src",
      /\/chore-images\/waesche-\d\.webp/,
    );

    // DER entscheidende Assert: naturalWidth > 0 beweist, dass die Datei
    // wirklich ausgeliefert wurde. Ein 404 laesst naturalWidth bei 0 und
    // wuerde hier auffallen.
    const loaded = await img.evaluate(
      (el) => el.complete && el.naturalWidth > 0,
    );
    expect(loaded, "Motiv-Bild wurde nicht ausgeliefert (naturalWidth 0)").toBe(
      true,
    );
  });

  test("mischt das Motiv per multiply in die Kartenfarbe ein", async ({
    page,
    request,
  }) => {
    // Ohne multiply waere jedes Bild ein weisser Kasten auf der
    // pastellfarbenen Karte. Der Blend-Modus ist also keine Kosmetik,
    // sondern der ganze Trick der Komposition.
    await create(page, request, "Müll rausbringen");
    await page.goto("/chores");
    const img = page.locator(".chore-visual-img").first();
    await expect(img).toBeVisible();
    await expect(img).toHaveCSS("mix-blend-mode", "multiply");
  });

  test("vergibt Varianten deterministisch ueber den Namen", async ({
    page,
    request,
  }) => {
    // Zwei Chores derselben Kategorie. Abweichende Motive sind erlaubt
    // (7er-Pool, Kollision 1/7), identische Motive bei VERSCHIEDENEN Namen
    // waeren der Fehler: dann haette der Name keinen Einfluss.
    await create(page, request, "Wäsche waschen");
    await create(page, request, "Pflanzen gießen");
    await page.goto("/chores");
    await expect(page.locator(".chore-card").first()).toBeVisible();

    const srcs = await page
      .locator(".chore-visual-img")
      .evaluateAll((els) => els.map((e) => e.getAttribute("src")));
    expect(srcs.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(srcs).size,
      `gleiches Motiv fuer verschiedene Namen: ${srcs}`,
    ).toBeGreaterThan(1);
  });

  test("liefert fuer denselben Namen immer dasselbe Motiv", async ({
    page,
    request,
  }) => {
    // Reload-Stabilitaet: die Auswahl darf nicht aus einem Zufall kommen,
    // sonst zeigt dieselbe Chore nach jedem Neuladen ein anderes Bild.
    // Ohne eigene Chore waere der Test leer gelaufen — `read()` lieferte
    // dann zwei leere Listen, und `toEqual` vergleicht [] mit [].
    await create(page, request, "Wäsche waschen");
    await page.goto("/chores");
    await expect(page.locator(".chore-visual-img").first()).toBeVisible();

    const read = () =>
      page
        .locator(".chore-visual-img")
        .evaluateAll((els) => els.map((e) => e.getAttribute("src")));

    const first = await read();
    expect(first.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator(".chore-visual-img").first()).toBeVisible();
    expect(await read()).toEqual(first);
  });
});
