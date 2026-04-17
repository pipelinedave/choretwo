import { test, expect } from '@playwright/test'

test.describe('Authentication Login Flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await context.addCookies([])
  })

  test('should display login page and redirect to mock login', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')
    
    await expect(page).toHaveURL('/login')
    await expect(page.locator('text=Manage your chores with ease')).toBeVisible()
    
    await page.click('button:has-text("Sign in")')
    
    await page.waitForURL(/mock-login-page/)
    await expect(page).toHaveURL(/mock-login-page/)
    await expect(page.locator('h1')).toContainText('Development Login')
  })

  test('should complete mock login flow and redirect to home', async ({ page }) => {
    await page.goto('/login')
    await page.click('.btn-login')
    
    await expect(page).toHaveURL('/api/auth/mock-login-page')
    
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/\/auth-callback/, { timeout: 10000 })
    const url = page.url()
    expect(url).toContain('/auth-callback')
    expect(url).toContain('token=')
    
    // Wait for redirect to home with longer timeout
    await page.waitForURL('/', { timeout: 15000 })
    await expect(page).toHaveURL('/')
    
    await expect(page.locator('.view-container h1')).toContainText('Welcome back')
  })

  test('should store token in localStorage after login', async ({ page }) => {
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    expect(token).toContain('.')
    
    const user = await page.evaluate(() => localStorage.getItem('user'))
    expect(user).toBeTruthy()
    
    const userData = JSON.parse(user)
    expect(userData.email).toBe('developer@example.com')
    expect(userData.name).toBe('Test Developer')
  })

  test('should show user menu with email after login', async ({ page }) => {
    // Complete login flow
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    // Click on user avatar to open menu
    await page.click('.btn-icon[aria-label="User menu"]')
    
    // Verify menu is open and shows email
    await expect(page.locator('.user-name')).toContainText('developer@example.com')
    
    // Verify menu items
    await expect(page.locator('.menu-item')).toHaveCount(2)
    await expect(page.locator('.menu-item').nth(0)).toContainText('Settings')
    await expect(page.locator('.menu-item').nth(1)).toContainText('Logout')
  })

  test('should navigate to protected routes after login', async ({ page }) => {
    // Complete login flow
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    // Navigate to Chores page
    await page.click('a[href="/chores"]')
    await page.waitForURL('/chores')
    await expect(page).toHaveURL('/chores')
    
    // Navigate to Logs page
    await page.click('a[href="/logs"]')
    await page.waitForURL('/logs')
    await expect(page).toHaveURL('/logs')
    
    // Navigate to Settings page
    await page.click('a[href="/settings"]')
    await page.waitForURL('/settings')
    await expect(page).toHaveURL('/settings')
  })
})
