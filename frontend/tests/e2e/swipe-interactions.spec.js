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

test.describe("Swipe Gesture Interactions — Mouse & Touch", () => {
  let choreId = null;
  let token = null;

  test.beforeEach(async ({ page, request }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    token = await page.evaluate(() => localStorage.getItem("token"));
    const dueDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `Swipe Test ${Date.now()}`,
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

  async function getActiveCard(page) {
    await page.goto("/chores");
    await page.waitForSelector(".chore-card", { state: "visible" });
    const card = page.locator(".chore-card:not(.completed)").first();
    await card.waitFor({ state: "visible", timeout: 5000 });
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    return { card, box };
  }

  function getCenter(box) {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  /**
   * Simuliert Maus-Swipe ueber document-level event dispatch.
   * Erzeugt mousedown→12x mousemove→mouseup events.
   */
  function simulateMouseSwipe(page, center, { dx, dy }) {
    return page.evaluate(
      ({ cx, cy, ddx, ddy }) => {
        const card = document.elementFromPoint(cx, cy);
        if (!card) return;

        card.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
          }),
        );

        const steps = 12;
        for (let i = 1; i <= steps; i++) {
          const p = i / steps;
          document.dispatchEvent(
            new MouseEvent("mousemove", {
              bubbles: true,
              cancelable: true,
              clientX: cx + ddx * p,
              clientY: cy + ddy * p,
            }),
          );
        }

        document.dispatchEvent(
          new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
            clientX: cx + ddx,
            clientY: cy + ddy,
          }),
        );
      },
      { cx: center.x, cy: center.y, ddx: dx, ddy: dy },
    );
  }

  /**
   * Simuliert Touch-Swipe über native Touch-Konstruktoren.
   * new Touch({ clientX, clientY, target }) erzeugt echte Touch-Objekte
   * die vom ChoreCard touchmove Handler als e.touches[0] gelesen werden.
   */
  function simulateTouchSwipe(page, center, { dx, dy }) {
    return page.evaluate(
      ({ cx, cy, ddx, ddy, stepY }) => {
        const card = document.elementFromPoint(cx, cy);
        if (!card) return;

        const startTouch = new Touch({
          clientX: cx,
          clientY: cy,
          target: card,
          identifier: 0,
        });

        // touchstart
        card.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [startTouch],
            bubbles: true,
            cancelable: true,
          }),
        );

        // touchmove in Schritten
        const steps = 10;
        for (let i = 1; i <= steps; i++) {
          const p = i / steps;
          const mv = new Touch({
            clientX: cx + ddx * p,
            clientY: cy + (stepY || ddy) * p,
            target: card,
            identifier: 0,
          });
          document.dispatchEvent(
            new TouchEvent("touchmove", {
              touches: [mv],
              bubbles: true,
              cancelable: true,
            }),
          );
        }

        // touchend
        const endTouch = new Touch({
          clientX: cx + ddx,
          clientY: cy + (stepY || ddy),
          target: card,
          identifier: 0,
        });
        document.dispatchEvent(
          new TouchEvent("touchend", {
            changedTouches: [endTouch],
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { cx: center.x, cy: center.y, ddx: dx, ddy: dy, stepY: dy },
    );
  }

  function vueTick(page) {
    return page.waitForTimeout(500);
  }

  // ============================================================
  // Test 1: Mouse swipe right → toggle / Mark Done
  // ============================================================
  test("mouse swipe right commits toggle", async ({ page }) => {
    const { box } = await getActiveCard(page);
    const center = getCenter(box);

    const totalCompletedBefore = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();

    // Swipe right mit 150px (> minSwipeDistance 50)
    await simulateMouseSwipe(page, center, { dx: 150, dy: 0 });
    await vueTick(page);

    // emit('toggle') → markDone → chore wird .completed
    const newTotalCompleted = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();
    expect(newTotalCompleted).toBeGreaterThan(totalCompletedBefore);
  });

  // ============================================================
  // Test 2: Mouse swipe left → edit modal öffnet sich
  // ============================================================
  test("mouse swipe left opens edit modal", async ({ page }) => {
    const { box } = await getActiveCard(page);
    const center = getCenter(box);

    await simulateMouseSwipe(page, center, { dx: -150, dy: 0 });
    await vueTick(page);

    // AddChoreForm im Edit-Modus erscheint mit .add-chore-form-overlay
    const formCount = await page.locator(".add-chore-form-overlay").count();
    expect(formCount).toBeGreaterThan(0);
  });

  // ============================================================
  // Test 3: Swipe unter Threshold (30px) → snap-back, kein emit
  // ============================================================
  test("swipe below threshold does not commit", async ({ page }) => {
    const { card } = await getActiveCard(page);

    const totalCompletedBefore = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();

    const box = await card.boundingBox();
    const center = getCenter(box);
    // Swipe mit nur 30px (< minSwipeDistance 50)
    await simulateMouseSwipe(page, center, { dx: 30, dy: 0 });
    await vueTick(page);

    // Keine Aenderung — keine neue completed chore
    const newTotalCompleted = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();
    expect(newTotalCompleted).toBe(totalCompletedBefore);
  });

  // ============================================================
  // Test 4: Touch swipe right → toggle / Mark Done
  // ============================================================
  test("touch swipe right commits toggle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { card } = await getActiveCard(page);
    const box = await card.boundingBox();
    const center = getCenter(box);

    const totalCompletedBefore = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();

    // Touch-Swipe nach rechts
    await simulateTouchSwipe(page, center, { dx: 150, dy: 0 });
    await vueTick(page);

    const newTotalCompleted = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();
    expect(newTotalCompleted).toBeGreaterThan(totalCompletedBefore);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ============================================================
  // Test 5: Touch swipe left → edit modal
  // ============================================================
  test("touch swipe left opens edit modal", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { card } = await getActiveCard(page);
    const box = await card.boundingBox();
    const center = getCenter(box);

    // Touch-Swipe nach links
    await simulateTouchSwipe(page, center, { dx: -150, dy: 0 });
    await vueTick(page);

    const formCount = await page.locator(".add-chore-form-overlay").count();
    expect(formCount).toBeGreaterThan(0);

    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ============================================================
  // Test 6: Vertical drag → KEIN horizontaler swipe
  // ============================================================
  test("vertical drag does not trigger swipe", async ({ page }) => {
    const { card } = await getActiveCard(page);

    const totalCompletedBefore = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();

    const box = await card.boundingBox();
    const center = getCenter(box);

    // Verticaler Drag — nur y
    await simulateMouseSwipe(page, center, { dx: 0, dy: 150 });
    await vueTick(page);

    // Keine Aenderung
    const newTotalCompleted = await page
      .locator(".chore-card.completed .chore-checkbox.checked")
      .count();
    expect(newTotalCompleted).toBe(totalCompletedBefore);

    // Kein edit-modal
    const formCount = await page.locator(".add-chore-form-overlay").count();
    expect(formCount).toBe(0);
  });

  // ============================================================
  // Test 7: Touch swipe down → archive emit
  // ============================================================
  test("touch swipe down triggers archive", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { card } = await getActiveCard(page);
    const box = await card.boundingBox();
    const center = getCenter(box);

    const cardCountBefore = await page.locator(".chore-card").count();

    // Touch-Swipe nach unten (dy > 0)
    await simulateTouchSwipe(page, center, { dx: 0, dy: 150 });
    await vueTick(page);

    const cardCountAfter = await page.locator(".chore-card").count();
    // Archivierung entfernt die chore — count sollte sinken
    expect(cardCountAfter).toBeLessThan(cardCountBefore);

    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
