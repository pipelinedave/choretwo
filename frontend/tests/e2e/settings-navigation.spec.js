import { test, expect } from "@playwright/test";
import { goToSettings } from "./helpers/nav.js";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";


// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores
// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.
const USER = specEmail("settings-navigation");
test.describe("Settings Page Navigation & Rendering", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await e2eLogin(page, { email: USER, name: "settings-navigation" });
  });

  test("should navigate to settings and render all sections", async ({
    page,
  }) => {
    await goToSettings(page);
    // Kein Routenwechsel: das Modal haengt an HomeView. Statt der
    // URL pruefen wir, dass es offen ist (goToSettings wartet darauf).
    await expect(page.locator(".modal-content")).toBeVisible();

    await expect(page.locator("h2:has-text('Notifications')")).toBeVisible();
    await expect(page.locator("h2:has-text('Appearance')")).toBeVisible();
    await expect(page.locator("h2:has-text('Data')")).toBeVisible();
    await expect(page.locator("h2:has-text('AI Copilot')")).toBeVisible();
  });

  test("should have notification toggles rendered correctly", async ({
    page,
  }) => {
    await goToSettings(page);
    await expect(page.locator(".modal-content")).toBeVisible();

    // Getrennt geprueft statt als Pauschalzahl. Vorher stand hier
    // `toHaveCount(4)` fuer "main notification + overdue + soon + AI" — eine
    // Zahl, die nur stimmte, solange beide AI-Umsetzungen (Route + Modal-
    // Checkbox) existierten. Jetzt gibt es genau eine AI-Sektion, und sie
    // traegt `.settings-section` ohne `.card`. Eine Pauschalzahl wuerde bei
    // jeder Sektionsaenderung stillschweigend falsch.
    const notifications = page.locator(
      ".settings-section.card >> .toggle input[type='checkbox']",
    );
    await expect(notifications).toHaveCount(3); // aktiv, ueberfaellig, bald faellig

    // Der AI-Toggle ist eine eigene Sektion mit eigener Optik. Ueber den
    // Sektions-Text gefiltert statt per XPath-Ahnentraegerei — das bleibt
    // stabil, wenn sich die Sektions-Struktur aendert.
    const aiSection = page
      .locator(".modal-content .settings-section")
      .filter({ hasText: "AI Copilot" });
    await expect(aiSection.locator("input[type='checkbox']")).toHaveCount(1);
  });

  test("should have all 3 theme options visible", async ({ page }) => {
    await goToSettings(page);
    await expect(page.locator(".modal-content")).toBeVisible();

    const themeButtons = page.locator(".theme-option");
    await expect(themeButtons).toHaveCount(3);
    await expect(themeButtons.nth(0)).toContainText("Light");
    await expect(themeButtons.nth(1)).toContainText("Dark");
    await expect(themeButtons.nth(2)).toContainText("System");
  });

  test("should have export and import buttons visible", async ({ page }) => {
    await goToSettings(page);
    await expect(page.locator(".modal-content")).toBeVisible();

    await expect(page.locator("text=EXPORT DATA")).toBeVisible();
    await expect(page.locator("text=IMPORT DATA")).toBeVisible();
  });
});
