import { test, expect } from '@playwright/test'

test.describe('Authentication Logout Flow', () => {
  test.beforeEach(async ({ context, page }) => {
    // Clear all storage before each test
    await context.clearCookies()
    await context.addCookies([])
    
    // Complete login flow
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('should clear localStorage on logout', async ({ page }) => {
    // Verify we're logged in
    let token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    
    // Click user menu
    await page.click('.btn-icon[aria-label="User menu"]')
    
    // Click logout
    await page.click('.menu-item.logout', { force: true })
    
    // Wait for redirect to login
    await page.waitForURL('/login')
    
    // Verify token is cleared
    token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeNull()
    
    // Verify user is cleared
    const user = await page.evaluate(() => localStorage.getItem('user'))
    expect(user).toBeNull()
  })

  test('should redirect to login page after logout', async ({ page }) => {
    // Complete logout flow
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForURL('/login')
    
    // Verify we're on login page
    await expect(page).toHaveURL('/login')
    await expect(page.locator('.login-subtitle')).toBeVisible()
  })

  test('should not access protected routes after logout', async ({ page }) => {
    // Complete logout flow
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForURL('/login')
    
    // Try to navigate to protected route
    await page.goto('/chores')
    
    // Should redirect back to login
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show login button after logout', async ({ page }) => {
    // Complete logout flow
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForURL('/login')
    
    // Verify login button is present
    await expect(page.locator('.btn-login')).toBeVisible()
    await expect(page.locator('.btn-login')).toContainText('Sign in with Google')
  })
})
