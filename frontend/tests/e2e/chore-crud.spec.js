import { test, expect } from '@playwright/test'

test.describe('Chore CRUD + Undo Flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await context.addCookies([])
    
    await page.goto('/')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('should create a new chore', async ({ page }) => {
    // Navigate directly to chores page (already logged in from beforeEach)
    await page.goto('/chores')
    
    // Wait for chores to load
    await page.waitForTimeout(1000)
    
    // Click FAB
    await page.click('[aria-label="Add chore"]', { force: true })
    
    // Wait for form to appear with retry
    await page.waitForSelector('.add-chore-form-overlay', { timeout: 5000 })
    await expect(page.locator('.add-chore-form-overlay')).toBeVisible()

    await page.fill('#name', 'E2E Test Chore')
    await page.selectOption('#interval', '7 days')
    await page.click('button[type="submit"]')

    await expect(page.locator('.add-chore-form-overlay')).not.toBeVisible()
    await expect(page.locator('.chore-title')).toContainText('E2E Test Chore')
  })

  test('should mark chore as done', async ({ page }) => {
    await page.goto('/chores')

    await page.click('[aria-label="Add chore"]', { force: true })
    await page.fill('#name', 'Test Chore to Complete')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(500)
    await page.click('.chore-checkbox')

    await page.waitForTimeout(500)
    const chore = page.locator('.chore-card.completed').first()
    await expect(chore).toBeVisible()
  })

  test('should archive a chore', async ({ page }) => {
    await page.goto('/chores')

    await page.click('[aria-label="Add chore"]', { force: true })
    await page.fill('#name', 'Test Chore to Archive')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(500)
    await page.click('.chore-actions .btn-icon[aria-label="Archive chore"]', { force: true })

    await page.waitForTimeout(500)
    const chores = page.locator('.chore-card')
    await expect(chores).toHaveCount(0)
  })

  test('should undo chore creation', async ({ page }) => {
    await page.goto('/chores')

    await page.click('[aria-label="Add chore"]', { force: true })
    await page.fill('#name', 'Chore to Undo Create')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(500)
    await expect(page.locator('.chore-title')).toContainText('Chore to Undo Create')

    await page.click('[aria-label="Activity log"]')
    await expect(page.locator('.log-overlay')).toBeVisible()

    await page.waitForTimeout(500)
    await page.click('.btn-undo')

    await page.waitForTimeout(500)
    await expect(page.locator('.chore-title')).not.toContainText('Chore to Undo Create')
  })

  test('should undo chore completion', async ({ page }) => {
    await page.goto('/chores')

    await page.click('[aria-label="Add chore"]', { force: true })
    await page.fill('#name', 'Chore to Undo Complete')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(500)
    await page.click('.chore-checkbox')

    await page.waitForTimeout(500)
    await expect(page.locator('.chore-card.completed')).toBeVisible()

    await page.click('[aria-label="Activity log"]')
    await page.waitForTimeout(500)

    const undoButtons = page.locator('.btn-undo')
    const completionLog = undoButtons.first()
    await completionLog.click()

    await page.waitForTimeout(500)
    await expect(page.locator('.chore-card.completed')).not.toBeVisible()
  })

  test('should undo chore archive', async ({ page }) => {
    await page.goto('/chores')

    await page.click('[aria-label="Add chore"]', { force: true })
    await page.fill('#name', 'Chore to Undo Archive')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(500)
    await page.click('.chore-actions .btn-icon[aria-label="Archive chore"]', { force: true })

    await page.waitForTimeout(500)
    await expect(page.locator('.chore-card')).toHaveCount(0)

    await page.click('[aria-label="Activity log"]')
    await page.waitForTimeout(500)

    await page.click('.btn-undo')

    await page.waitForTimeout(500)
    await expect(page.locator('.chore-title')).toContainText('Chore to Undo Archive')
  })

  test('should show logs with correct action types', async ({ page }) => {
    await page.goto('/chores')

    await page.click('[aria-label="Add chore"]', { force: true })
    await page.fill('#name', 'Log Test Chore')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(500)
    await page.click('[aria-label="Activity log"]')
    await expect(page.locator('.log-overlay')).toBeVisible()

    await page.waitForTimeout(500)
    const logItems = page.locator('.log-item')
    await expect(logItems).not.toHaveCount(0)

    const firstLog = logItems.first()
    await expect(firstLog.locator('strong')).toContainText('developer')
  })
})
