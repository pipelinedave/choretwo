# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-login.spec.js >> Authentication Login Flow >> should display login page and redirect to mock login
- Location: tests/e2e/auth-login.spec.js:9:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Manage your chores with ease')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Manage your chores with ease')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to parse source for import analysis because the content contains invalid JS syntax. If you are using JSX, make sure to name the file with the .jsx or .tsx extension."
  - generic [ref=e5]: /home/dhallmann/projects/choretwo/frontend/src/stores/auth.js:151:5
  - generic [ref=e6]: "150| clearError 151| } 152| }) | ^ 153|"
  - generic [ref=e7]: at TransformPluginContext._formatError (file:///home/dhallmann/projects/choretwo/frontend/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49258:41) at TransformPluginContext.error (file:///home/dhallmann/projects/choretwo/frontend/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49253:16) at TransformPluginContext.transform (file:///home/dhallmann/projects/choretwo/frontend/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64259:14) at async PluginContainer.transform (file:///home/dhallmann/projects/choretwo/frontend/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:49099:18) at async loadAndTransform (file:///home/dhallmann/projects/choretwo/frontend/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:51978:27) at async viteTransformMiddleware (file:///home/dhallmann/projects/choretwo/frontend/node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:62106:24
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.js
    - text: .
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | test.describe('Authentication Login Flow', () => {
  4   |   test.beforeEach(async ({ context, page }) => {
  5   |     await context.clearCookies()
  6   |     await context.addCookies([])
  7   |   })
  8   | 
  9   |   test('should display login page and redirect to mock login', async ({ page }) => {
  10  |     await page.goto('/login')
  11  |     await page.waitForLoadState('domcontentloaded')
  12  |     
  13  |     await expect(page).toHaveURL('/login')
> 14  |     await expect(page.locator('text=Manage your chores with ease')).toBeVisible()
      |                                                                     ^ Error: expect(locator).toBeVisible() failed
  15  |     
  16  |     await page.click('button:has-text("Sign in")')
  17  |     
  18  |     await expect(page).toHaveURL('/api/auth/mock-login-page')
  19  |     await expect(page.locator('h1')).toContainText('Development Login')
  20  |   })
  21  | 
  22  |   test('should complete mock login flow and redirect to home', async ({ page }) => {
  23  |     await page.goto('/login')
  24  |     await page.click('.btn-login')
  25  |     
  26  |     await expect(page).toHaveURL('/api/auth/mock-login-page')
  27  |     
  28  |     await page.click('button[type="submit"]')
  29  |     
  30  |     await page.waitForURL(/\/auth-callback/, { timeout: 10000 })
  31  |     const url = page.url()
  32  |     expect(url).toContain('/auth-callback')
  33  |     expect(url).toContain('token=')
  34  |     
  35  |     // Wait for redirect to home with longer timeout
  36  |     await page.waitForURL('/', { timeout: 15000 })
  37  |     await expect(page).toHaveURL('/')
  38  |     
  39  |     await expect(page.locator('.view-container h1')).toContainText('Welcome back')
  40  |   })
  41  | 
  42  |   test('should store token in localStorage after login', async ({ page }) => {
  43  |     await page.goto('/login')
  44  |     await page.click('.btn-login')
  45  |     await page.click('button[type="submit"]')
  46  |     await page.waitForURL('/')
  47  |     
  48  |     const token = await page.evaluate(() => localStorage.getItem('token'))
  49  |     expect(token).toBeTruthy()
  50  |     expect(token).toContain('.')
  51  |     
  52  |     const user = await page.evaluate(() => localStorage.getItem('user'))
  53  |     expect(user).toBeTruthy()
  54  |     
  55  |     const userData = JSON.parse(user)
  56  |     expect(userData.email).toBe('developer@example.com')
  57  |     expect(userData.name).toBe('Test Developer')
  58  |   })
  59  | 
  60  |   test('should show user menu with email after login', async ({ page }) => {
  61  |     // Complete login flow
  62  |     await page.goto('/login')
  63  |     await page.click('.btn-login')
  64  |     await page.click('button[type="submit"]')
  65  |     await page.waitForURL('/')
  66  |     
  67  |     // Click on user avatar to open menu
  68  |     await page.click('.btn-icon[aria-label="User menu"]')
  69  |     
  70  |     // Verify menu is open and shows email
  71  |     await expect(page.locator('.user-name')).toContainText('developer@example.com')
  72  |     
  73  |     // Verify menu items
  74  |     await expect(page.locator('.menu-item')).toHaveCount(2)
  75  |     await expect(page.locator('.menu-item').nth(0)).toContainText('Settings')
  76  |     await expect(page.locator('.menu-item').nth(1)).toContainText('Logout')
  77  |   })
  78  | 
  79  |   test('should navigate to protected routes after login', async ({ page }) => {
  80  |     // Complete login flow
  81  |     await page.goto('/login')
  82  |     await page.click('.btn-login')
  83  |     await page.click('button[type="submit"]')
  84  |     await page.waitForURL('/')
  85  |     
  86  |     // Navigate to Chores page
  87  |     await page.click('a[href="/chores"]')
  88  |     await page.waitForURL('/chores')
  89  |     await expect(page).toHaveURL('/chores')
  90  |     
  91  |     // Navigate to Logs page
  92  |     await page.click('a[href="/logs"]')
  93  |     await page.waitForURL('/logs')
  94  |     await expect(page).toHaveURL('/logs')
  95  |     
  96  |     // Navigate to Settings page
  97  |     await page.click('a[href="/settings"]')
  98  |     await page.waitForURL('/settings')
  99  |     await expect(page).toHaveURL('/settings')
  100 |   })
  101 | })
  102 | 
```