import { test, expect } from '@playwright/test'

test.describe('Authentication Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage before each test
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('should display login page and redirect to mock login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')
    
    // Verify we're on the login page
    await expect(page).toHaveURL('/login')
    await expect(page.locator('h1')).toContainText('Choretwo')
    await expect(page.locator('.login-subtitle')).toContainText('Manage your chores with ease')
    
    // Click Sign in button
    await page.click('.btn-login')
    
    // Should redirect to mock login page
    await expect(page).toHaveURL('/api/auth/mock-login-page')
    await expect(page.locator('h1')).toContainText('Development Login')
  })

  test('should complete mock login flow and redirect to home', async ({ page }) => {
    // Navigate to login and click through to mock login
    await page.goto('/login')
    await page.click('.btn-login')
    
    // Wait for mock login page
    await expect(page).toHaveURL('/api/auth/mock-login-page')
    
    // Submit the mock login form (using default values)
    await page.click('button[type="submit"]')
    
    // Should redirect to auth callback with token
    await page.waitForURL(/\/auth-callback/)
    const url = page.url()
    expect(url).toContain('/auth-callback')
    expect(url).toContain('token=')
    expect(url).toContain('id_token=')
    expect(url).toContain('refresh_token=')
    
    // Should extract token and redirect to home
    await page.waitForURL('/')
    await expect(page).toHaveURL('/')
    
    // Verify we're on the home page
    await expect(page.locator('h1')).toContainText('Welcome back')
  })

  test('should store token in localStorage after login', async ({ page }) => {
    // Complete login flow
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
    
    // Verify token is stored
    const token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    expect(token).toContain('.') // JWT has 3 parts separated by dots
    
    // Verify user is stored
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
