import { test, expect } from "@playwright/test";
import { login as e2eLogin, specEmail } from "./helpers/auth.js";


// Eigene Test-Adresse pro Spec — verhindert, dass sich die Chores
// dieser Spec mit denen anderer Specs in der geteilten Test-DB mischen.
const USER = specEmail("filter-pills");

test.describe("FilterPills E2E", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await context.addCookies([]);

    // Login per JWT-Injection; `e2eLogin` wartet auf den persistierten Token.
    await e2eLogin(page, { email: USER, name: "FilterPills" });

    // Chores-Ansicht. Die alte Spec wartete hier auf `.stats-grid` — das
    // Element existiert im src nicht (dokumentierte Test-Drift in
    // SESSION_STATE.md). Ersatz: die Filter-Pills selbst sind das Signal,
    // dass die Chores-Ansicht gemountet ist.
    await page.goto("/chores");
    await page.waitForSelector(".filter-pills");
    await page.waitForTimeout(500);
  });

  test("renders filter pills on chores view", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    await expect(pills).toHaveCount(5);
    await expect(pills.first()).toContainText("Overdue");
    await expect(pills.nth(1)).toContainText("Today");
    await expect(pills.nth(2)).toContainText("Tomorrow");
    await expect(pills.nth(3)).toContainText("This Week");
    await expect(pills.last()).toContainText("Later");
  });

  test("shows clear button when a filter is active", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    await pills.last().click(); // click "Later"

    const clearBtn = page.locator(".clear-btn");
    await expect(clearBtn).toBeVisible();

    // Das MDI-Icon ist ein <span class="mdi mdi-close"> (FilterPills.vue:12),
    // kein <i> — die Spec suchte noch nach der aelteren Auszeichnung.
    await expect(clearBtn.locator("span.mdi-close")).toBeVisible();
  });

  test("clear button clears filter", async ({ page }) => {
    // Click a filter to make it active
    await page.locator(".filter-pills .chip").nth(1).click();

    const clearBtn = page.locator(".clear-btn");
    await clearBtn.click();

    // Filter pills should still be there
    const pills = page.locator(".filter-pills .chip");
    await expect(pills).toHaveCount(5);
  });

  test("active pill gets active class", async ({ page }) => {
    const pills = page.locator(".filter-pills .chip");
    const todayPill = pills.nth(1); // Today

    await expect(todayPill).not.toHaveClass(/active/);
    await todayPill.click();
    await expect(todayPill).toHaveClass(/active/);
  });

  test("chip counts display correctly", async ({ page }) => {
    const countBadges = page.locator(".chip-count");
    await expect(countBadges).not.toHaveCount(0);

    // `locator.all()` gibt es in aktuellen Playwright-Versionen nicht mehr
    // (entfernt, nicht nur deprecated) — stattdessen ueber die Zahl iterieren
    // und mit nth() zulaeufig locaten.
    const total = await countBadges.count();
    for (let i = 0; i < total; i++) {
      const text = await countBadges.nth(i).textContent();
      expect(text, `chip-count #${i} sollte eine Zahl enthalten`).toMatch(/\d+/);
    }
  });
});
