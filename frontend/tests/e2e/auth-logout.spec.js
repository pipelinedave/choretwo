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
    let token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeTruthy()
    
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/login/)
    
    token = await page.evaluate(() => localStorage.getItem('token'))
    expect(token).toBeNull()
    
    const user = await page.evaluate(() => localStorage.getItem('user'))
    expect(user).toBeNull()
  })

  test('should redirect to login page after logout', async ({ page }) => {
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('.login-subtitle')).toBeVisible()
  })

  test('should not access protected routes after logout', async ({ page }) => {
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/login/)
    
    await page.goto('/chores')
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/login/)
  })

  test('should show login button after logout', async ({ page }) => {
    await page.click('.btn-icon[aria-label="User menu"]')
    await page.click('.menu-item.logout', { force: true })
    await page.waitForTimeout(500)
    await expect(page).toHaveURL(/\/login/)
    
    await expect(page.locator('.btn-login')).toBeVisible()
    await expect(page.locator('.btn-login')).toContainText('Sign in with Google')
  })
})
