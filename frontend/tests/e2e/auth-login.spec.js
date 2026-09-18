import { test, expect } from "@playwright/test";

test.describe("Authentication Login Flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await context.addCookies([]);
  });

  test("should display login page and redirect to mock login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    await expect(page).toHaveURL("/login");
    await expect(
      page.locator("text=Tactile Microservice Household Task Tracker"),
    ).toBeVisible();

    await page.click('button:has-text("Sign in")');

    await page.waitForURL(/mock-login-page/);
    await expect(page).toHaveURL(/mock-login-page/);
    await expect(page.locator("h1")).toContainText("Development Login");
  });

  test("should complete mock login flow and redirect to home", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.click(".btn-login");

    await page.waitForURL(/mock-login-page/);

    await page.click('button[type="submit"]');

    await page.waitForURL(/\/auth-callback/, { timeout: 10000 });
    const url = page.url();
    expect(url).toContain("/auth-callback");
    expect(url).toContain("token=");

    // Wait for redirect to home with longer timeout
    await page.waitForURL("/", { timeout: 15000 });
    await expect(page).toHaveURL("/");

    await expect(page.locator("text=Welcome back")).toBeVisible();
  });

  test("should store token in localStorage after login", async ({ page }) => {
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();
    expect(token).toContain(".");

    const user = await page.evaluate(() => localStorage.getItem("user"));
    expect(user).toBeTruthy();

    const userData = JSON.parse(user);
    expect(userData.email).toBe("developer@example.com");
    expect(userData.name).toBe("Test Developer");
  });

  test("should show user menu with email after login", async ({ page }) => {
    // Complete login flow
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // Click on user avatar to open menu
    await page.click('.btn-icon[aria-label="User menu"]');

    // Verify menu is open and shows email
    await expect(page.locator(".user-name")).toContainText(
      "developer@example.com",
    );

    // Verify the menu items (redesigned header menu: 7 items incl. Logout)
    await expect(page.locator(".menu-item")).toHaveCount(7);
    await expect(page.locator(".menu-item").nth(0)).toContainText(
      "Archived Chores",
    );
    await expect(page.locator(".menu-item").last()).toContainText("Logout");
  });

  test("should navigate to protected routes after login", async ({ page }) => {
    // Complete login flow
    await page.goto("/login");
    await page.click(".btn-login");
    await page.click('button[type="submit"]');
    await page.waitForURL("/");

    // After login the authenticated session (token) is stored -> protected
    // routes must be reachable and must NOT bounce back to /login.
    for (const path of ["/chores", "/logs", "/settings", "/catchup"]) {
      await page.goto(path);
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(path);
      await expect(page.locator(".app-header,.main-content")).toBeAttached();
    }

    // Navigating to /login while authenticated redirects to Home (guest guard)
    await page.goto("/login");
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
  });
});
