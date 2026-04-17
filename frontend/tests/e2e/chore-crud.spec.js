import { test, expect } from '@playwright/test'

test.describe('Chore CRUD + Undo Flow', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await context.addCookies([])
    
    // Complete login flow
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('should create a new chore', async ({ page }) => {
    // Navigate to chores page (already logged in)
    await page.goto('/chores')
    
    // Wait for page to stabilize
    await page.waitForTimeout(1000)
    
    // Instead of clicking the FAB, directly trigger the click event
    await page.evaluate(() => {
      const fab = document.querySelector('[aria-label="Add chore"]')
      if (fab) {
        fab.dispatchEvent(new Event('click', { bubbles: true }))
      }
    })
    
    // Wait for form
    await page.waitForSelector('.add-chore-form-overlay', { timeout: 10000 })
    
    // Fill form - use correct selectors (no id attributes)
    await page.fill('input[placeholder*="dish"]', 'E2E Test Chore')
    await page.selectOption('.add-chore-form-overlay select', '7 days')
    await page.click('button[type="submit"]')
    
    // Wait for form to close
    await page.waitForTimeout(500)
    await expect(page.locator('.add-chore-form-overlay')).not.toBeVisible()
    
    // Verify chore was created
    await expect(page.locator('text=E2E Test Chore')).toBeVisible()
  })

  test('should mark chore as done', async ({ page }) => {
    await page.goto('/chores')
    await page.waitForTimeout(500)

    // Create a chore first
    await page.click('[aria-label="Add chore"]', { force: true })
    await page.waitForSelector('.add-chore-form-overlay')
    await page.fill('input[id="name"]', 'Test Chore to Complete')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    // Mark as done
    await page.click('.chore-checkbox')
    await page.waitForTimeout(500)
    
    // Verify completed
    await expect(page.locator('.chore-card.completed')).toBeVisible()
  })

  test('should archive a chore', async ({ page }) => {
    await page.goto('/chores')
    await page.waitForTimeout(500)

    // Create a chore first
    await page.click('[aria-label="Add chore"]', { force: true })
    await page.waitForSelector('.add-chore-form-overlay')
    await page.fill('input[id="name"]', 'Test Chore to Archive')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    // Archive the chore
    await page.click('.chore-actions .btn-icon[aria-label="Archive chore"]', { force: true })
    await page.waitForTimeout(500)
    
    // Verify chore is gone from active list
    await expect(page.locator('.chore-card')).toHaveCount(0)
  })

  test('should undo chore creation', async ({ page }) => {
    await page.goto('/chores')
    await page.waitForTimeout(500)

    // Create a chore
    await page.click('[aria-label="Add chore"]', { force: true })
    await page.waitForSelector('.add-chore-form-overlay')
    await page.fill('input[id="name"]', 'Chore to Undo Create')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)
    
    await expect(page.locator('text=Chore to Undo Create')).toBeVisible()

    // Open log overlay
    await page.click('[aria-label="Activity log"]')
    await page.waitForSelector('.log-overlay')
    
    // Click undo
    await page.click('.btn-undo')
    await page.waitForTimeout(500)
    
    // Verify chore is gone
    await expect(page.locator('text=Chore to Undo Create')).not.toBeVisible()
  })

  test('should undo chore completion', async ({ page }) => {
    await page.goto('/chores')
    await page.waitForTimeout(500)

    // Create and complete a chore
    await page.click('[aria-label="Add chore"]', { force: true })
    await page.waitForSelector('.add-chore-form-overlay')
    await page.fill('input[id="name"]', 'Chore to Undo Complete')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)
    
    await page.click('.chore-checkbox')
    await page.waitForTimeout(500)
    
    await expect(page.locator('.chore-card.completed')).toBeVisible()

    // Open log and undo
    await page.click('[aria-label="Activity log"]')
    await page.waitForTimeout(500)
    
    await page.click('.btn-undo')
    await page.waitForTimeout(500)
    
    await expect(page.locator('.chore-card.completed')).not.toBeVisible()
  })

  test('should undo chore archive', async ({ page }) => {
    await page.goto('/chores')
    await page.waitForTimeout(500)

    // Create and archive a chore
    await page.click('[aria-label="Add chore"]', { force: true })
    await page.waitForSelector('.add-chore-form-overlay')
    await page.fill('input[id="name"]', 'Chore to Undo Archive')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)
    
    await page.click('.chore-actions .btn-icon[aria-label="Archive chore"]', { force: true })
    await page.waitForTimeout(500)
    
    await expect(page.locator('.chore-card')).toHaveCount(0)

    // Open log and undo
    await page.click('[aria-label="Activity log"]')
    await page.waitForTimeout(500)
    
    await page.click('.btn-undo')
    await page.waitForTimeout(500)
    
    await expect(page.locator('text=Chore to Undo Archive')).toBeVisible()
  })

  test('should show logs with correct action types', async ({ page }) => {
    await page.goto('/chores')
    await page.waitForTimeout(500)

    // Create a chore
    await page.click('[aria-label="Add chore"]', { force: true })
    await page.waitForSelector('.add-chore-form-overlay')
    await page.fill('input[id="name"]', 'Log Test Chore')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    // Open logs
    await page.click('[aria-label="Activity log"]')
    await page.waitForSelector('.log-overlay')
    
    // Verify logs exist
    const logItems = page.locator('.log-item')
    await expect(logItems).not.toHaveCount(0)
    
    // Verify user email in log
    const firstLog = logItems.first()
    await expect(firstLog.locator('strong')).toContainText('developer')
  })
})
