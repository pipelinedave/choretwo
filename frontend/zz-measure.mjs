import { request } from "@playwright/test";
import { makeToken, specEmail } from "./tests/e2e/helpers/auth.js";

const BASE = "http://127.0.0.1:8000";
const email = specEmail("measure-c2-c3");
const token = makeToken(email);
const created = [];
const due = (off) => { const d=new Date(); const o=new Date(d.getFullYear(),d.getMonth(),d.getDate()); o.setDate(o.getDate()+off);
  return `${o.getFullYear()}-${String(o.getMonth()+1).padStart(2,"0")}-${String(o.getDate()).padStart(2,"0")}`; };

const ctx = await request.newContext({ baseURL: BASE });
async function mk(name, off) {
  const r = await ctx.post("/api/chores/", { headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
    data:{ name, interval_days:7, due_date:due(off), is_private:false } });
  const d = await r.json(); created.push(d.id); return d;
}
// Bewusst: kurzer Name (Referenzfall) und sehr langer Name + Recurrence (Problemfall C2)
await mk("Kurz", -1);
await mk("Ein sehr langer Chore-Name, der ueber zwei Zeilen umbricht und die Karte deutlich hoeher macht", -4);

const { chromium } = await import("@playwright/test");
const b = await chromium.launch();
const p = await b.newPage({ hasTouch: true });
await p.addInitScript(([t]) => { localStorage.setItem("token", t); localStorage.setItem("user", JSON.stringify({ email: "m@e.de", name: "M" })); }, [token]);
await p.goto("http://localhost:3000/catchup", { waitUntil: "networkidle" });
await p.waitForSelector(".catchup-card", { state: "visible" });
await p.waitForTimeout(400);

const m = await p.evaluate(() => {
  const cont = document.querySelector(".stack-container");
  const cards = [...document.querySelectorAll(".catchup-card")];
  const r = (el) => { const b = el.getBoundingClientRect(); return { x:+b.x.toFixed(1), y:+b.y.toFixed(1), w:+b.width.toFixed(1), h:+b.height.toFixed(1) }; };
  return {
    containerH: cont.clientHeight,
    containerRect: r(cont),
    cardCount: cards.length,
    cards: cards.map(c => ({ h: +c.getBoundingClientRect().height.toFixed(1), transform: getComputedStyle(c).transform, opacity: getComputedStyle(c).opacity })),
    areaBelow: (() => { const a=document.querySelector('.stack-area'); return +a.getBoundingClientRect().height.toFixed(1); })(),
  };
});
console.log("=== C2: Container vs. Karte ===");
console.log("  .stack-container clientHeight :", m.containerH);
console.log("  tatsaechliche Karten-Hoehe    :", m.cards.map(c=>c.h).join(", "));
console.log("  -> Ueberhang/Fehlbetrag       :", (m.cards[0].h - m.containerH).toFixed(1), "px");
console.log("\n=== C3: Stapel-Tiefenwirkung ===");
m.cards.forEach((c,i)=>console.log(`  Karte ${i}: h=${c.h} transform=${c.transform} opacity=${c.opacity}`));
console.log("\n  Karten im DOM:", m.cardCount);

await b.close();
for (const id of created) { try { await ctx.delete(`/api/chores/${id}`, { headers:{ Authorization:`Bearer ${token}` } }); } catch {} }
await ctx.dispose();
