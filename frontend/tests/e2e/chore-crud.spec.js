import { test, expect } from '@playwright/test'

test.describe('Chore CRUD + Undo Flow', () => {
  let choreId = null

  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies()
    await context.addCookies([])
    
    await page.goto('/login')
    await page.click('.btn-login')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test.afterEach(async ({ page, request }) => {
    if (choreId) {
      const token = await page.evaluate(() => localStorage.getItem('token'))
      await request.delete(`/api/chores/${choreId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      choreId = null
    }
  })

  test('should create a new chore via API', async ({ page, request }) => {
    const testId = Date.now()
    const choreName = `E2E Test Chore ${testId}`
    
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const response = await request.post('/api/chores/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: '2026-04-24',
        is_private: false
      }
    })
    
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    choreId = data.id
    
    const choresResponse = await request.get('/api/chores/?page=1&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const chores = await choresResponse.json()
    const foundChore = chores.find(c => c.id === choreId)
    expect(foundChore).toBeTruthy()
    expect(foundChore.name).toBe(choreName)
  })

  test('should mark chore as done via API', async ({ page, request }) => {
    const testId = Date.now()
    const choreName = `Test Chore to Complete ${testId}`
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const createResponse = await request.post('/api/chores/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: dueDate,
        is_private: false
      }
    })
    const choreData = await createResponse.json()
    expect(createResponse.status()).toBe(200)
    choreId = choreData.id
    
    const doneResponse = await request.put(`/api/chores/${choreId}/done`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: { done_by: 'developer@example.com' }
    })
    
    expect(doneResponse.ok()).toBeTruthy()
    
    const refreshedResponse = await request.get(`/api/chores/${choreId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const refreshedChore = await refreshedResponse.json()
    expect(refreshedChore.done).toBe(true)
  })

  test('should archive a chore via API', async ({ page, request }) => {
    const testId = Date.now()
    const choreName = `Test Chore to Archive ${testId}`
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const token = await page.evaluate(() => localStorage.getItem('token'))
    const createResponse = await request.post('/api/chores/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: dueDate,
        is_private: false
      }
    })
    const choreData = await createResponse.json()
    expect(createResponse.status()).toBe(200)
    choreId = choreData.id
    
    const archiveResponse = await request.put(`/api/chores/${choreId}/archive`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    expect(archiveResponse.ok()).toBeTruthy()
    
    const refreshedResponse = await request.get(`/api/chores/${choreId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const refreshedChore = await refreshedResponse.json()
    expect(refreshedChore.archived).toBe(true)
  })

  test('should undo chore creation via API', async ({ page, request }) => {
    const testId = Date.now()
    const choreName = `Chore to Undo Create ${testId}`
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const token = await page.evaluate(() => localStorage.getItem('token'))
    
    const createResponse = await request.post('/api/chores/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: dueDate,
        is_private: false
      }
    })
    const choreData = await createResponse.json()
    expect(createResponse.status()).toBe(200)
    choreId = choreData.id
    
    const logsResponse = await request.get('/api/logs/?page=1&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const logs = await logsResponse.json()
    const createLog = logs.find(log => log.action_type === 'created' && log.action_details?.name === choreName)
    
    expect(createLog).toBeTruthy()
    
    const undoResponse = await request.post('/api/logs/undo', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: { log_id: createLog.id }
    })
    
    expect(undoResponse.ok()).toBeTruthy()
    
    const deletedChore = await undoResponse.json()
    expect(deletedChore.message).toContain('successfully')
  })

  test('should show logs after chore actions', async ({ page, request }) => {
    const testId = Date.now()
    const choreName = `Log Test Chore ${testId}`
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const token = await page.evaluate(() => localStorage.getItem('token'))
    
    await request.post('/api/chores/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: choreName,
        interval_days: 7,
        due_date: dueDate,
        is_private: false
      }
    })
    
    const logsResponse = await request.get('/api/logs/?page=1&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const logs = await logsResponse.json()
    
    expect(logs.length).toBeGreaterThan(0)
    const createLog = logs.find(log => log.action_details?.name === choreName)
    expect(createLog).toBeTruthy()
    expect(createLog.action_type).toBe('created')
  })
})
