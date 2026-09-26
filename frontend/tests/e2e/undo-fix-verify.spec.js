import { test, expect, request } from "@playwright/test";
import { makeToken, specEmail } from "./helpers/auth.js";
import { localDate } from "./helpers/dates.js";

// Diese Spec ist eine reine API-Spec (kein Browser). Sie lief urspruenglich
// gegen den Microservice-Stack mit drei Ports (8001 auth, 8002 chore, 8003 log).
// Der Monolith bietet dieselben Endpunkte unter einem Port; die Aufteilung ist
// seit der Modular-Monolith-Migration ueberholt. Zusaetzlich ist der
// mock-callback-Token weggefallen — der Token entsteht jetzt lokal, siehe
// helpers/auth.js.
const MONOLITH = "http://127.0.0.1:8000";
const BASE = {
  chore: MONOLITH,
  log: MONOLITH,
};

const USER = specEmail("undo-fix-verify");

function getToken() {
  return makeToken(USER, { name: "Undo Verify" });
}

async function api(method, baseUrl, path, body, token) {
  const resp = await request.newContext();
  const fetchResp = await resp.fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: body,
  });

  let json = {};
  try {
    json = await fetchResp.json();
  } catch {
    // ignore parse errors
  }

  await resp.dispose();
  return { ok: fetchResp.ok(), status: fetchResp.status(), json };
}

test.describe("Undo marked_done Bug Fix", () => {
  let token;

  test.beforeAll(async () => {
    token = getToken();
    expect(token).toBeDefined();
  });

  test("undo marked_done resets due_date, last_done, done_by", async () => {
    const today = localDate();
    const email = USER;

    // 1. Create chore
    console.log(`[1] Create chore (due_date=${today})`);
    const create = await api(
      "POST",
      BASE.chore,
      "/api/chores/",
      {
        name: "Undo-Test",
        interval_days: 7,
        due_date: today,
        is_private: false,
      },
      token,
    );
    expect(create.ok).toBe(
      true,
      `Create failed: ${JSON.stringify(create.json)}`,
    );
    const chore = create.json;
    expect(chore.id).toBeDefined();
    console.log(`    ✅ Chore ${chore.id} created\n`);

    // 2. Mark done (done_by as query param)
    console.log("[2] Mark done");
    const donePath = `/api/chores/${chore.id}/done?done_by=${encodeURIComponent(email)}`;
    const done = await api("PUT", BASE.chore, donePath, null, token);
    expect(done.ok, `Mark done failed: ${JSON.stringify(done.json)}`).toBe(
      true,
    );
    const d = done.json;
    console.log(
      `    done=${d.done} due_date=${d.due_date} last_done=${d.last_done} done_by=${d.done_by}`,
    );
    console.log(`    ✅ Chore marked as done\n`);

    // 3. Find marked_done log
    console.log("[3] Find marked_done log");
    const logs = await api(
      "GET",
      BASE.log,
      "/api/logs/?page=1&limit=50",
      null,
      token,
    );
    expect(logs.ok).toBe(true);
    const doneLog = logs.json.find(
      (l) => l.action_type === "marked_done" && l.chore_id === chore.id,
    );
    expect(doneLog).toBeDefined();
    expect(doneLog.action_details?.previous_due_date).toBe(today);
    console.log(
      `    ✅ Log id=${doneLog.id}, previous_due_date=${doneLog.action_details.previous_due_date}\n`,
    );

    // 4. UNDO
    console.log("[4] Undo");
    const undo = await api(
      "POST",
      BASE.log,
      "/api/logs/undo",
      { log_id: doneLog.id },
      token,
    );
    expect(undo.ok, `Undo failed: ${JSON.stringify(undo.json)}`).toBe(true);
    expect(undo.json.undone_action_type).toBe("marked_done");
    console.log(`    ✅ ${undo.json.message}\n`);

    // Wait for async HTTP calls
    await new Promise((r) => setTimeout(r, 2000));

    // 5. Verify chore after undo
    console.log("[5] Verify after undo");
    const after = await api(
      "GET",
      BASE.chore,
      `/api/chores/${chore.id}`,
      null,
      token,
    );
    expect(after.ok).toBe(
      true,
      `Get chore failed: ${JSON.stringify(after.json)}`,
    );
    const cu = after.json;

    console.log(
      `    done: ${cu.done} (expect: false) ${cu.done === false ? "✅" : "❌"}`,
    );
    console.log(
      `    due_date: ${cu.due_date} (expect: ${today}) ${cu.due_date === today ? "✅" : "❌"}`,
    );
    console.log(
      `    last_done: ${cu.last_done} (expect: null) ${cu.last_done === null ? "✅" : "❌"}`,
    );
    console.log(
      `    done_by: ${cu.done_by} (expect: null) ${cu.done_by === null ? "✅" : "❌"}`,
    );

    expect(cu.done, "done should be false after undo").toBe(false);
    expect(cu.due_date, "due_date should be reset to original").toBe(today);
    expect(cu.last_done, "last_done should be null after undo").toBeNull();
    expect(cu.done_by, "done_by should be null after undo").toBeNull();

    console.log("\n✅✅✅ UNDO BUG FIXED! ✅✅✅\n");

    // Cleanup
    await api("DELETE", BASE.chore, `/api/chores/${chore.id}`, null, token);
  });
});
