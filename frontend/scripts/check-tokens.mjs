#!/usr/bin/env node
/**
 * Design-Token-Konsistenzpruefung (STAGE 1).
 *
 * Prueft drei Dinge gegen src/ (Vue-SFCs inkl. Template + Script + Style,
 * CSS-Dateien) gegen die einzige Token-Quelle src/assets/styles/variables.css:
 *
 *   1. UNDEFINIERTE Tokens  — `var(--x)` ohne Definition im aktiven File.
 *      (stille Layout-Bugs: die Deklaration faellt bei computed-value-time aus)
 *   2. UNGENUTZTE Definitionen — Token wird nirgends referenziert (toter Layer).
 *   3. DOPPELTE Definitionen  — gleicher Name mit abweichendem Wert.
 *
 * Aufruf:  node scripts/check-tokens.mjs
 * Exit 0 = alles gruen, Exit 1 = Befund.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = new URL("../src/", import.meta.url).pathname;
const TOKEN_FILE = join(SRC, "assets/styles/variables.css");

/** Alle quellsichtbaren Dateien unter src/ einsammeln. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(vue|css|js)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(SRC);

/* --- 1. Token-Namen sammeln, die irgendwo per var(--x) benutzt werden --- */
const used = new Map(); // token -> Set(datei)
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(relative(SRC, file));
  }
}

/* --- 2. Definitionen aus dem aktiven Token-File ziehen --- */
/** @type {Map<string, {value: string, line: number, selector: string}>} */
const defs = new Map();
/** @type {Map<string, Map<string, Set<string>>>} name -> selector -> werte */
const byName = new Map();

let selector = "(root)";
for (const [i, line] of readFileSync(TOKEN_FILE, "utf8").split("\n").entries()) {
  const sel = line.match(/^([^\s@}][^{]*?)\s*\{\s*$/);
  if (sel) selector = sel[1].trim();
  const decl = line.match(/^\s*(--[a-zA-Z0-9-]+)\s*:\s*(.+?);/);
  if (!decl) continue;
  const [, name, value] = decl;
  defs.set(name, { value: value.trim(), line: i + 1, selector });
  if (!byName.has(name)) byName.set(name, new Map());
  const perSel = byName.get(name);
  if (!perSel.has(selector)) perSel.set(selector, new Set());
  perSel.get(selector).add(value.trim());
}

/* --- 3. Doppelte Definitionen mit abweichendem Wert (pro Selektor) --- */
// light/dark-Overrides sind gewollt und zaehlen NICHT als Konflikt, solange
// jede Achse (z. B. spacing/radius) in sich konsistent bleibt.
const conflicting = [];
for (const [name, perSel] of byName) {
  for (const [sel, values] of perSel) {
    if (values.size > 1) conflicting.push({ name, sel, values: [...values] });
  }
}

/* --- Auswertung --- */
const undefinedTokens = [...used.keys()].filter((t) => !defs.has(t)).sort();
const unusedDefs = [...defs.keys()].filter((t) => !used.has(t)).sort();

let failed = false;

if (undefinedTokens.length) {
  failed = true;
  console.log(`\nFEHLER  Undefinierte Tokens (${undefinedTokens.length}) — var() faellt aus:`);
  for (const t of undefinedTokens) {
    console.log(`  ${t}  <- ${[...used.get(t)].join(", ")}`);
  }
} else {
  console.log("OK      Keine undefinierten Token-Referenzen.");
}

if (conflicting.length) {
  failed = true;
  console.log(`\nFEHLER  Doppelte Definitionen mit abweichendem Wert (${conflicting.length}):`);
  for (const c of conflicting) {
    console.log(`  ${c.name} @ ${c.sel}: ${c.values.join("  !=  ")}`);
  }
} else {
  console.log("OK      Keine doppelt definierten Tokens mit abweichendem Wert.");
}

if (unusedDefs.length) {
  console.log(`\nHINWEIS Ungenutzte Definitionen (${unusedDefs.length}) — toter Layer:`);
  for (const t of unusedDefs) {
    console.log(`  ${t} = ${defs.get(t).value}   (${TOKEN_FILE}:${defs.get(t).line})`);
  }
} else {
  console.log("OK      Keine ungenutzten Token-Definitionen.");
}

console.log(
  `\nSumme: ${defs.size} Definitionen, ${used.size} referenzierte Namen.`,
);
process.exit(failed ? 1 : 0);
