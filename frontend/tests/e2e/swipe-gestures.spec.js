import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";


// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores
// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.
const USER = specEmail("swipe-gestures");
test.describe("Swipe Gestures on ChoreCard", () => {
  let choreId = null;

  test.beforeEach(async ({ page, request }) => {
    await e2eLogin(page, { email: USER, name: "swipe-gestures" });

    const token = await page.evaluate(() => localStorage.getItem("token"));
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const response = await request.post("/api/chores/", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `Swipe Test Chore ${Date.now()}`,
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
      const token = await page.evaluate(() => localStorage.getItem("token"));
      await request.delete(`/api/chores/${choreId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      choreId = null;
    }
  });

  test("chore cards should be rendered on /chores", async ({ page }) => {
    await page.goto("/chores");
    await page.waitForTimeout(300);
    const firstCard = page.locator(".chore-card").first();
    await expect(firstCard).toBeVisible();
  });

  // Die Spec pruefte frueher ein `.swipe-actions-overlay` mit drei
  // Text-Aktionen ("Mark Done", "Edit", "Archive"). Diese Struktur gibt es in
  // ChoreCard.vue nicht mehr — sie wurde durch die Gmail-Style-Indikatoren
  // ersetzt: ein `.swipe-background` mit genau zwei Richtungshinweisen
  // (ChoreCard.vue:4-11). Das entspricht auch der dokumentierten Semantik
  // (README: "Swipe right=done, left=edit, down=archive"); "archive" ist eine
  // Geste, keine Knopf-Aktion.
  test("chore cards should have swipe action elements", async ({ page }) => {
    await page.goto("/chores");
    await page.waitForTimeout(300);

    const cards = page.locator(".chore-card");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // `.swipe-background` und `.action-icon` liegen im `.chore-card-wrapper`
    // und sind Geschwister von `.chore-card`, nicht dessen Kinder.
    const wrapper = page.locator(".chore-card-wrapper").first();
    await expect(wrapper.locator(".swipe-background")).toBeAttached();
    await expect(wrapper.locator(".action-icon")).toHaveCount(2);
  });

  const INDICATORS = [
    { dir: "icon-left", icon: "mdi-check", action: "erledigen" },
    { dir: "icon-right", icon: "mdi-pencil", action: "bearbeiten" },
  ];

  for (const { dir, icon, action } of INDICATORS) {
    test(`swipe indicator should offer ${action} (${dir})`, async ({ page }) => {
      await page.goto("/chores");
      await page.waitForTimeout(300);

      const wrapper = page.locator(".chore-card-wrapper").first();
      const indicator = wrapper.locator(`.action-icon.${dir}`);
      await expect(indicator).toBeAttached();
      await expect(indicator.locator(`span.${icon}`)).toHaveCount(1);
    });
  }
});
