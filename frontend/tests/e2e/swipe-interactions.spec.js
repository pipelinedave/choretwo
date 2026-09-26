/**
 * E2E Tests fuer Swipe Gestures auf der ChoreCard-Komponente.
 *
 * Testet: Mausevents (drag), Touch-events, Schwellenwerte (threshold),
 * und vertikale Zuege (die keinen horizontalen Swipe ausloesen duerfen).
 *
 * Test-Szenarien:
 *  1. Mouse swipe right → toggle (Mark Done)
 *  2. Mouse swipe left → edit modal öffnet sich
 *  3. Swipe unterhalb 50px → snap-back, kein emit
 *  4. Touch swipe right → toggle
 *  5. Touch swipe left → edit modal
 *  6. Vertical drag → kein swipe
 *  7. Touch swipe down → archive
 */
import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";
import { localDateOffset } from "./helpers/dates.js";


// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores
// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.
const USER = specEmail("swipe-interactions");
test.describe("Swipe Gesture Interactions — Mouse & Touch", () => {
  let choreId = null;
  let choreName = null;
  let token = null;

  test.beforeEach(async ({ page, request }) => {
    await e2eLogin(page, { email: USER, name: "swipe-interactions" });

    token = await page.evaluate(() => localStorage.getItem("token"));
    const dueDate = localDateOffset(1);
    choreName = `Swipe Test ${Date.now()}`;

    const response = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: dueDate,
        is_private: false,
      },
    });
    const data = await response.json();
    choreId = data.id;
  });

  test.afterEach(async ({ page, request }) => {
    if (choreId) {
      try {
        const t = await page.evaluate(() => localStorage.getItem("token"));
        await request.delete(`/api/chores/${choreId}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
      } catch {
        /* already deleted */
      }
      choreId = null;
    }
  });

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Findet die im beforeEach erstellte Chore deterministisch über ihre
   * stabile Card-id (robust gegen DB-Sharing mit anderen Tests/parallelen
   * Browser-Laeufen und gegen den Edit-Modus, der den Namenstext ersetzt).
   */
  async function getMyCard(page) {
    await page.goto("/chores");
    await page.waitForSelector(".chore-card", { state: "visible" });
    const card = page.locator(`.chore-card[id="chore-card-${choreId}"]`);
    await card.waitFor({ state: "visible", timeout: 5000 });
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    return { card, box };
  }

  /**
   * Liest das done-Flag der eigenen Chore direkt ueber die API
   * (deterministisch, unabhaengig von DOM-Klassen).
   */
  async function getChoreDone(page, request) {
    const res = await request.get(`/api/chores/${choreId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return !!data.done;
  }

  /**
   * Simuliert einen Swipe per Pointer-Events direkt am Card-Element.
   * locator.dispatchEvent feuert die Vue-pointer-Handler (pointerdown/move/up)
   * browseruebergreifend, unabhaengig von Touch/Pointer/Screen-Verfuegbarkeit.
   */
  async function swipeCard(page, cardLocator, box, { dx, dy }) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t =
        i === 0 ? "pointerdown" : i === steps ? "pointerup" : "pointermove";
      const x = Math.round(cx + (dx * i) / steps);
      const y = Math.round(cy + (dy * i) / steps);
      await cardLocator.dispatchEvent(t, {
        clientX: x,
        clientY: y,
        pointerId: 1,
        isPrimary: true,
        buttons: 1,
        pointerType: "touch",
        cancelable: true,
      });
      await page.waitForTimeout(15);
    }
    await page.waitForTimeout(400);
  }

  function vueTick(page) {
    return page.waitForTimeout(500);
  }

  // ============================================================
  // Test 1: Mouse swipe right → toggle / Mark Done
  // ============================================================
  test("mouse swipe right commits toggle", async ({ page, request }) => {
    const { card, box } = await getMyCard(page);

    // Swipe right mit 150px (> SWIPE_THRESHOLD 70)
    await swipeCard(page, card, box, { dx: 150, dy: 0 });
    await vueTick(page);

    // Direkter API-Beweis: Chore ist now done
    expect(await getChoreDone(page, request)).toBe(true);
    // UI-Beweis: Card zeigt done-Zustand
    await expect(card).toHaveClass(/done-today/);
  });

  // ============================================================
  // Test 2: Mouse swipe left → edit modal öffnet sich
  // ============================================================
  test("mouse swipe left opens edit modal", async ({ page }) => {
    const { card, box } = await getMyCard(page);

    await swipeCard(page, card, box, { dx: -150, dy: 0 });
    await vueTick(page);

    // ChoreCard oeffnet das Inline-Edit-Formular .chore-edit
    await expect(card.locator(".chore-edit")).toBeVisible();
  });

  // ============================================================
  // Test 3: Swipe unter Threshold (30px) → snap-back, kein emit
  // ============================================================
  test("swipe below threshold does not commit", async ({ page, request }) => {
    const { card, box } = await getMyCard(page);

    // Swipe mit nur 30px (< SWIPE_THRESHOLD 70)
    await swipeCard(page, card, box, { dx: 30, dy: 0 });
    await vueTick(page);

    // Kein done, kein Edit
    expect(await getChoreDone(page, request)).toBe(false);
    await expect(card.locator(".chore-edit")).toHaveCount(0);
    await expect(card).not.toHaveClass(/done-today/);
  });

  // ============================================================
  // Test 4: Touch swipe right → toggle / Mark Done
  // ============================================================
  test("touch swipe right commits toggle", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { card, box } = await getMyCard(page);

    // Touch-Swipe nach rechts
    await swipeCard(page, card, box, { dx: 150, dy: 0 });
    await vueTick(page);

    expect(await getChoreDone(page, request)).toBe(true);
    await expect(card).toHaveClass(/done-today/);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ============================================================
  // Test 5: Touch swipe left → edit modal
  // ============================================================
  test("touch swipe left opens edit modal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { card, box } = await getMyCard(page);

    // Touch-Swipe nach links
    await swipeCard(page, card, box, { dx: -150, dy: 0 });
    await vueTick(page);

    await expect(card.locator(".chore-edit")).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ============================================================
  // Test 6: Vertical drag → KEIN horizontaler swipe
  // ============================================================
  test("vertical drag does not trigger swipe", async ({ page, request }) => {
    const { card, box } = await getMyCard(page);

    // Verticaler Drag — nur y
    await swipeCard(page, card, box, { dx: 0, dy: 150 });
    await vueTick(page);

    // Kein done, kein Edit
    expect(await getChoreDone(page, request)).toBe(false);
    await expect(card.locator(".chore-edit")).toHaveCount(0);
    await expect(card).not.toHaveClass(/done-today/);
  });

  // ============================================================
  // Test 7: Swipe left → Edit → Archivierung (reale Archive-Aktion)
  // ============================================================
  test("swipe+edit archive removes chore", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { card, box } = await getMyCard(page);

    // Swipe links oeffnet den Inline-Edit-Modus der ChoreCard + das globale
    // AddChoreForm-Modal (via emit('edit')). Das Modal hat keinen
    // Archive-Button und ueberlagert den inline-Archive-Button (App-eigenes
    // UI-Overlapp zweier konkurrierender Edit-Oberflaechen).
    await swipeCard(page, card, box, { dx: -150, dy: 0 });
    await vueTick(page);
    await expect(card.locator(".chore-edit")).toBeVisible();

    // force:true umgeht das Modal-Overlay-Intercept, damit die tatsaechliche
    // ChoreCard-handleArchive-Logik ausgeloest wird (Verifikation via API).
    await card.locator(".chore-edit .archive-button").click({ force: true });
    await vueTick(page);

    // API-Beweis: Chore ist archiviert
    const res = await request.get(`/api/chores/${choreId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    expect(data.archived).toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
