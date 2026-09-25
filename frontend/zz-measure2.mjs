import { request, chromium } from "@playwright/test";
import { makeToken, specEmail } from "./tests/e2e/helpers/auth.js";
const email = specEmail("measure-c2");
const token = makeToken(email, { name: "M" });
const created = [];
const due = (off) => { const d=new Date(); const o=new Date(d.getFullYear(),d.getMonth(),d.getDate()); o.setDate(o.getDate()+off);
  return `${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,"0")}-${String(o.getDate()).padStart(2,"0")}`; };
const ctx = await request.newContext({ baseURL: "http://127.0.0.1:8000" });
async function mk(name, off) { const r = await ctx.post("/api/chores/", { headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}, data:{name,interval_days:7,due_date:due(off),is_private:false} }); const d=await r.json(); created.push(d.id); return d; }

async function scenario(label, top, second) {
  await mk(top, -4); await mk(second, -1);
  const b = await chromium.launch(); const p = await b.newPage({ hasTouch: true });
  await p.addInitScript(([t,u]) => { localStorage.setItem("token",t); localStorage.setItem("user",JSON.stringify(u)); }, [token,{email,name:"M"}]);
  await p.goto("http://localhost:3000/catchup", { waitUntil: "networkidle" });
  await p.waitForSelector(".catchup-card", { state: "visible" }); await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const cont = document.querySelector(".stack-container");
    const bar = document.querySelector(".catchup-actions");
    const c = cont.getBoundingClientRect(); const bb = bar?.getBoundingClientRect();
    const cards = [...document.querySelectorAll(".catchup-card")].map(el => el.getBoundingClientRect());
    return {
      contTop: +c.top.toFixed(1), contH: +c.height.toFixed(1), contBottom: +c.bottom.toFixed(1),
      lowestCard: +Math.max(...cards.map(r=>r.bottom)).toFixed(1),
      barTop: bb ? +bb.top.toFixed(1) : null,
      cardCount: cards.length,
    };
  });
  const slack = +(m.contBottom - m.lowestCard).toFixed(1);
  const gapToBar = m.barTop !== null ? +(m.barTop - m.contBottom).toFixed(1) : null;
  console.log(`\n### ${label}`);
  console.log(`  Karten im DOM              : ${m.cardCount}`);
  console.log(`  Container                  : top=${m.contTop} h=${m.contH} bottom=${m.contBottom}`);
  console.log(`  unterster Karten-Pixel     : ${m.lowestCard}`);
  console.log(`  Reserve unten im Container : ${slack}px   ${slack >= -0.5 ? "OK (deckt alle Karten)" : "FEHLER: Ueberhang"}`);
  console.log(`  Abstand Container->Aktionsleiste: ${gapToBar}px   ${gapToBar >= 0 ? "OK (keine Ueberlappung)" : "FEHLER: Ueberlappung"}`);
  await b.close();
  for (const id of created.splice(0)) { try { await ctx.delete(`/api/chores/${id}`, { headers:{Authorization:`Bearer ${token}`} }); } catch {} }
}

await scenario("A) kurze Namen (vorher: 52px zu hoch)", "Kurz", "Kurz2");
await scenario("B) langer Name auf Position 0 (vorher: 33px Ueberhang)", "Ein sehr langer Chore-Name, der ueber zwei Zeilen umbricht und die Karte deutlich hoeher macht", "Kurz2");
await scenario("C) langer Name auf der Peek (Hoehe wird vom hinteren Stapel bestimmt)", "Kurz", "Ein noch langerer Chore-Name fuer die Peek-Karte, der die Stapel-Hoehe nach unten bestimmt");
await ctx.dispose();
