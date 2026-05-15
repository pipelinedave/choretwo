import { test, expect } from '@playwright/test'

test('debug: what action_types exist for done events?', async ({ page, request }) => {
  await page.goto('/login')
  await page.click('.btn-login')
  await page.click('button[type="submit"]')
  await page.waitForURL('/')
  
  const token = await page.evaluate(() => localStorage.getItem('token'))
  
  // Get all logs
  const logsResp = await request.get('/api/logs/?page=1&limit=100', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  const logs = await logsResp.json()
  
  console.log('TOTAL LOGS:', logs.length)
  
  // Group by action_type and show structure
  const types = {}
  for (const log of logs) {
    if (!types[log.action_type]) types[log.action_type] = []
    types[log.action_type].push({
      id: log.id,
      chore_id: log.chore_id,
      details: log.action_details
    })
  }
  
  console.log('ACTION TYPES:', JSON.stringify(types, null, 2))
  
  // Find any chore that was marked as done
  for (const log of logs) {
    if (log.action_details?.chore_id || (log.action_type === 'completed') || log.action_details?.done) {
      console.log(`DONE-RELATED: type=${log.action_type}, chore_id=${log.chore_id}, details=${JSON.stringify(log.action_details)}`)
    }
  }
})
