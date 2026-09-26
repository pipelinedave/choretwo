/**
 * Navigations-Helper fuer E2E.
 *
 * WARUM DAS EIN HELPER IST
 * Die Specs sind ueber `page.click('a[href="/settings"]')` zu den Settings
 * gegangen — ein Link, den es nur gab, solange die App eine Bottom-Nav
 * hatte. Die ist in 5671ffd absichtlich entfernt worden (sie war nie
 * gewollt), wodurch 16 Stellen in 4 Specs auf einen nicht mehr
 * aufloesbaren Selektor zeigten und die ganze Suite rot wurde.
 *
 * Der Weg von der Startseite zu den Settings fuehrt jetzt ueber das
 * Header-Benue: `.menu-btn` (☰) -> `.menu-item` mit dem Text "Settings".
 * Diese Specs testen damit den Weg, den ein Mensch tatsaechlich geht —
 * ein Direktlink auf /settings wuerde die Navigation gar nicht pruefen.
 */
import { expect } from "@playwright/test";

/** Oeffnet das Header-Benue. */
export async function openMenu(page) {
  await page.locator(".menu-btn").first().click();
  // Das Dropdown ist eine Transition; ohne Warten kann der Klick auf das
  // naechste Element ins Leere gehen.
  await page.locator(".dropdown-menu").first().waitFor({ state: "visible" });
}

/** Schliesst das Header-Benue, falls es offen ist. */
export async function closeMenu(page) {
  const menu = page.locator(".dropdown-menu").first();
  if (await menu.isVisible().catch(() => false)) {
    await page.keyboard.press("Escape");
    await menu.waitFor({ state: "hidden" }).catch(() => {});
  }
}

/**
 * Navigiert zum Settings-Modal (Home -> Header-Benue -> "Settings").
 *
 * Die Specs testen die Sektionen Notification, Appearance, Data und AI. Diese
 * lebten in der Route /settings, die seit 5671fd nicht mehr erreichbar war
 * (die Bottom-Nav war ihr einziger Zugang) und die der User daraufhin durch
 * das Modal ersetzen liess. Die Specs nehmen also den Weg, den ein Mensch
 * geht — ein `goto("/settings")` wuerde eine umgeleitete, tote Route pruefen
 * und damit nichts wert sein.
 */
export async function goToSettings(page) {
  // Das Modal haengt an HomeView, also erst dorthin.
  if (!/\/$/.test(new URL(page.url()).pathname)) {
    await page.goto("/");
  }
  await openMenu(page);
  await page.locator(".menu-item", { hasText: "Settings" }).first().click();
  // Das Modal ist kein Routenwechsel — es wird per v-if eingeblendet. Also
  // nicht auf waitForURL warten, sondern auf das Sektions-Element.
  await expect(page.locator(".modal-content").first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.locator(".modal-content .section-title").first(),
  ).toBeVisible({ timeout: 10_000 });
}

/** Navigiert direkt per URL — die Route leitet auf "/" um (toter Pfad). */
export async function gotoSettingsDirect(page) {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/$/);
}
