import { test, expect, request } from '@playwright/test';

const BASE = {
  chore: 'http://localhost:8002',
  log: 'http://localhost:8003',
};

async function getToken() {
  const ctx = await request.newContext();
  const data = new URLSearchParams({ email: 'developer@example.com', name: 'Test Developer' }).toString();
  const resp = await ctx.post('http://localhost:8001/api/auth/mock-callback', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data,
    maxRedirects: 0
  });
  const loc = resp.headers()['location'] || '';
  const match = loc.match(/token=([^&]+)/);
  const token = match ? match[1] : null;
  await ctx.dispose();
  return token;
}

async function api(method, baseUrl, path, body, token) {
  const resp = await request.newContext();
  const fetchResp = await resp.fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  });
  
  let json = {};
  try { json = await fetchResp.json(); } catch {}
  
  await resp.dispose();
  return { ok: fetchResp.ok(), status: fetchResp.status(), json };
}

test.describe('Undo marked_done Bug Fix', () => {
  let token;
  
  test.beforeAll(async () => {
    token = await getToken();
    expect(token).toBeDefined();
    console.log(`\n✅ Token: ${token.substring(0, 40)}...\n`);
  });

  test('undo marked_done resets due_date, last_done, done_by', async () => {
    const today = new Date().toISOString().split('T')[0];
    const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const email = 'developer@example.com';
    
    // 1. Create chore
    console.log(`[1] Create chore (due_date=${today})`);
    const create = await api('POST', BASE.chore, '/api/chores/', {
      name: 'Undo-Test', interval_days: 7, due_date: today, is_private: false
    }, token);
    expect(create.ok).toBe(true, `Create failed: ${JSON.stringify(create.json)}`);
    const chore = create.json;
    expect(chore.id).toBeDefined();
    console.log(`    ✅ Chore ${chore.id} created\n`);
    
    // 2. Mark done (done_by as query param)
    console.log('[2] Mark done');
    const donePath = `/api/chores/${chore.id}/done?done_by=${encodeURIComponent(email)}`;
    const done = await api('PUT', BASE.chore, donePath, null, token);
    expect(done.ok, `Mark done failed: ${JSON.stringify(done.json)}`).toBe(true);
    const d = done.json;
    console.log(`    done=${d.done} due_date=${d.due_date} last_done=${d.last_done} done_by=${d.done_by}`);
    console.log(`    ✅ Chore marked as done\n`);
    
    // 3. Find marked_done log
    console.log('[3] Find marked_done log');
    const logs = await api('GET', BASE.log, '/api/logs/?page=1&limit=50', null, token);
    expect(logs.ok).toBe(true);
    const doneLog = logs.json.find(l => l.action_type === 'marked_done' && l.chore_id === chore.id);
    expect(doneLog).toBeDefined();
    expect(doneLog.action_details?.previous_due_date).toBe(today);
    console.log(`    ✅ Log id=${doneLog.id}, previous_due_date=${doneLog.action_details.previous_due_date}\n`);
    
    // 4. UNDO
    console.log('[4] Undo');
    const undo = await api('POST', BASE.log, '/api/logs/undo', { log_id: doneLog.id }, token);
    expect(undo.ok, `Undo failed: ${JSON.stringify(undo.json)}`).toBe(true);
    expect(undo.json.undone_action_type).toBe('marked_done');
    console.log(`    ✅ ${undo.json.message}\n`);
    
    // Wait for async HTTP calls
    await new Promise(r => setTimeout(r, 2000));
    
    // 5. Verify chore after undo
    console.log('[5] Verify after undo');
    const after = await api('GET', BASE.chore, `/api/chores/${chore.id}`, null, token);
    expect(after.ok).toBe(true, `Get chore failed: ${JSON.stringify(after.json)}`);
    const cu = after.json;
    
    console.log(`    done: ${cu.done} (expect: false) ${cu.done === false ? '✅' : '❌'}`);
    console.log(`    due_date: ${cu.due_date} (expect: ${today}) ${cu.due_date === today ? '✅' : '❌'}`);
    console.log(`    last_done: ${cu.last_done} (expect: null) ${cu.last_done === null ? '✅' : '❌'}`);
    console.log(`    done_by: ${cu.done_by} (expect: null) ${cu.done_by === null ? '✅' : '❌'}`);
    
    expect(cu.done, 'done should be false after undo').toBe(false);
    expect(cu.due_date, 'due_date should be reset to original').toBe(today);
    expect(cu.last_done, 'last_done should be null after undo').toBeNull();
    expect(cu.done_by, 'done_by should be null after undo').toBeNull();
    
    console.log('\n✅✅✅ UNDO BUG FIXED! ✅✅✅\n');
    
    // Cleanup
    await api('DELETE', BASE.chore, `/api/chores/${chore.id}`, null, token);
  });
});
