/**
 * E2E Tests fuer die AI-Sektion der SettingsView.
 *
 * WICHTIG (Zustandssetzung): Die Spec hat frueher per
 * `localStorage.setItem("settings-ai-learning", …)` einen Initialzustand
 * gesetzt. Dieser Key wird im src nirgends gelesen — der Toggle haengt an
 * `ai.learning_enabled` aus `GET /api/settings` (SettingsView.vue:118/153).
 * Die Tests liefen dadurch auf einem Fremdzustand, der vom vorherigen Lauf
 * hing (Settings werden serverseitig pro User persistiert), und waren nicht
 * wiederholbar.
 *
 * Stattdessen wird der Ausgangszustand jetzt ueber `PUT /api/settings`
 * gesetzt — dieselbe Quelle, aus der die View liest. Damit ist jeder Test
 * unabhaengig von der Reihenfolge und wiederholbar.
 *
 * (PATCH gibt es nicht: der Monolith bietet nur GET und PUT /api/settings.)
 */
import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";

// Eigene Test-Adresse pro Spec: die Settings-Zeilen sind pro User persistiert,
// sonst teilen sich die Settings-Specs denselben Zustand.
const USER = specEmail("settings-ai");

test.describe("Settings — AI Settings", () => {
  /** Setzt den AI-Zustand serverseitig und laedt die Seite neu. */
  async function givenAiState(page, request, { learningEnabled, types }) {
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const res = await request.put("/api/settings", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        ai: {
          learning_enabled: learningEnabled,
          suggestion_types: types,
        },
      },
    });
    expect(res.ok(), `PUT /api/settings: ${res.status()}`).toBe(true);
  }

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await e2eLogin(page, { email: USER, name: "settings-ai" });
  });

  test("toggling AI learning should show save bar", async ({
    page,
    request,
  }) => {
    await givenAiState(page, request, { learningEnabled: false });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");
    await page.reload();

    // Wait for AI section to render
    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // Click the AI toggle slider (it's the first toggle on the AI section page)
    const aiSection = page.locator(".settings-section:has-text('AI Copilot')");
    const toggleInput = aiSection.locator('.toggle input[type="checkbox"]');
    await expect(toggleInput).not.toBeChecked();

    await aiSection.locator("label.toggle").click();
    await expect(toggleInput).toBeChecked();

    // Save bar should appear
    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();
  });

  test("toggling suggestion type chip should show save bar", async ({
    page,
    request,
  }) => {
    await givenAiState(page, request, {
      learningEnabled: true,
      types: ["recurrence", "timing", "assignment"],
    });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");
    await page.reload();

    // Wait for AI section
    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // Click "Recurrence" chip to deselect it
    const chip = page.locator(".chip:has-text('Recurrence')");
    await expect(chip).toHaveClass(/active/);
    await chip.click();

    // Save bar should appear
    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();

    // Chip should no longer be active
    await expect(chip).not.toHaveClass(/active/);
  });

  test("discarding AI changes should revert to saved state", async ({
    page,
    request,
  }) => {
    await givenAiState(page, request, { learningEnabled: true });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");
    await page.reload();

    await expect(page.locator("text=AI Copilot")).toBeVisible();

    // Toggle AI off
    const aiSection = page.locator(".settings-section:has-text('AI Copilot')");
    const toggleInput = aiSection.locator('.toggle input[type="checkbox"]');
    await expect(toggleInput).toBeChecked();

    await aiSection.locator("label.toggle").click();
    await expect(toggleInput).not.toBeChecked();

    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();

    // Discard
    await page.locator("text=Discard").click();

    // Save bar should be gone, toggle back at the persisted value
    await expect(page.locator("text=Unsaved AI changes")).not.toBeVisible();
    await expect(toggleInput).toBeChecked();
  });

  test("saving AI changes should persist to the backend", async ({
    page,
    request,
  }) => {
    await givenAiState(page, request, { learningEnabled: false });

    await page.click('a[href="/settings"]');
    await page.waitForURL("/settings");
    await page.reload();

    await expect(page.locator("text=AI Copilot")).toBeVisible();

    const aiSection = page.locator(".settings-section:has-text('AI Copilot')");
    const toggleInput = aiSection.locator('.toggle input[type="checkbox"]');
    await expect(toggleInput).not.toBeChecked();

    // Toggle AI on
    await aiSection.locator("label.toggle").click();
    await expect(toggleInput).toBeChecked();

    await expect(page.locator("text=Unsaved AI changes")).toBeVisible();

    // Verify draft reflects the toggle (chip gets active when learning enabled)
    await expect(page.locator(".chip:has-text('Recurrence')")).toHaveClass(
      /active/,
    );

    // Save
    await page.getByRole("button", { name: "Save" }).click();

    // Save bar gone
    await expect(page.locator("text=Unsaved AI changes")).not.toBeVisible();

    // Und es ist auch wirklich persistiert: frisch vom Backend lesen.
    const token = await page.evaluate(() => localStorage.getItem("token"));
    const res = await request.get("/api/settings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ai.learning_enabled).toBe(true);
  });
});
