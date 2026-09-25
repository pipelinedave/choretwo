/**
 * Design-Token-Schicht — Light/Dark-Assertions (STAGE 1).
 *
 * Warum statisch geparst und nicht ueber getComputedStyle: Vitest laeuft
 * hier mit happy-dom (vitest.config.js), und happy-dom wertet importierte
 * Stylesheets nicht aus — ein Probe-Lauf lieferte
 * `document.styleSheets.length === 0` und einen leeren computed-Wert fuer
 * `--md-sys-spacing-xs`. Ein getComputedStyle-Test wuerde also immer
 * gruen sein, ohne etwas zu pruefen. Der Parser unten liest stattdessen
 * beide Stylesheets in der Reihenfolge, in der der Browser sie sieht
 * (variables.css wird per @import VOR main.css geladen) und bildet den
 * Cascade fuer Light und Dark nach — inklusive Vererbung, also
 * Dark = :root plus Dark-Overrides.
 *
 * Abgedeckt sind genau die Fehlerklassen, die in STAGE 1 zugeschlagen
 * haben: undefinierte Tokens (9bcec8e), Tippfehler im Dark-Block,
 * Alias-Achsen, die auseinanderlaufen (2b28495), und die grelle weisse
 * Linie im Dark Mode (7af3698).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "../../../src");
/** Reihenfolge wie im Browser: der @import steht in main.css Zeile 1. */
const STYLESHEETS = [
  join(SRC, "assets/styles/variables.css"),
  join(SRC, "assets/styles/main.css"),
];

/* ---------------------------------------------------------------------- *
 * Mini-CSS-Parser: flache Regel-Liste mit Selektor, Media und Body.
 * Verschachtelte At-Rules werden rekursiv mitgefuehrt, die Reihenfolge
 * bleibt Quellreihenfolge — das genuegt fuer den Cascade.
 * ---------------------------------------------------------------------- */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

function parseRules(css) {
  const text = stripComments(css);
  const rules = [];
  let i = 0;

  /** Liest ab der offenen Klammer bis zur passenden schliessenden. */
  const readBody = () => {
    i++; // '{'
    let depth = 0;
    let out = "";
    while (i < text.length) {
      const ch = text[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        if (depth === 0) {
          i++;
          return out;
        }
        depth--;
      }
      out += ch;
      i++;
    }
    return out;
  };

  while (i < text.length) {
    let head = "";
    while (i < text.length && text[i] !== "{" && text[i] !== ";") {
      head += text[i];
      i++;
    }
    if (i >= text.length) break;
    // Statement-At-Rules (@import, @charset) tragen keine Block-Regeln.
    if (text[i] === ";") {
      i++;
      continue;
    }
    head = head.trim();
    const body = readBody();
    if (head.startsWith("@")) {
      for (const r of parseRules(body)) {
        r.media = `${head} ${r.media}`.trim();
        rules.push(r);
      }
    } else {
      rules.push({ media: "", selector: head, decls: body });
    }
  }
  return rules;
}

const ALL_RULES = STYLESHEETS.flatMap((f) => parseRules(readFileSync(f, "utf8")));

/** Nur Custom Properties einer Regel. */
function parseDecls(decls) {
  const out = {};
  for (const m of decls.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

/**
 * Die Deklarationen eines (Media-)Filters, in Quellreihenfolge, getrennt
 * nach dark-spezifischen Regeln.
 *
 * Wichtig: `:root` gilt in BEIDEN Themes — es ist die allgemeinste
 * Regel, nicht die Light-Regel. Nur `[data-theme="dark"]` ist
 * Dark-spezifisch. Deshalb ist Dark = base + darkOverrides und nicht
 * umgekehrt; sonst wuerden die prefers-contrast-Werte aus dem
 * `:root`-Block im Dark Mode gar nicht ankommen.
 */
function collect({ contrast }) {
  const base = {};
  const dark = {};
  for (const rule of ALL_RULES) {
    if (/prefers-contrast:\s*more/.test(rule.media) !== contrast) continue;
    if (/prefers-reduced-motion|@keyframes|@media \(max-width/.test(rule.media)) continue;
    const targetsDark = rule.selector
      .split(",")
      .some((s) => /^\[data-theme=["']dark["']\]/.test(s.trim()));
    Object.assign(targetsDark ? dark : base, parseDecls(rule.decls));
  }
  return { base, dark };
}

const PLAIN = collect({ contrast: false });
const CONTRAST = collect({ contrast: true });

// Dark erbt alles aus :root und ueberschreibt nur die genannten Tokens.
const LIGHT = PLAIN.base;
const DARK_OVERRIDES = PLAIN.dark;
const DARK = { ...PLAIN.base, ...PLAIN.dark };

const LIGHT_CONTRAST = { ...PLAIN.base, ...CONTRAST.base };
const DARK_CONTRAST = { ...PLAIN.base, ...PLAIN.dark, ...CONTRAST.base, ...CONTRAST.dark };

/* ---------------------------------------------------------------------- *
 * Aufloesung: var()-Ketten rekursiv, mit Zyklenerkennung.
 * Ein undefinierter Sprung in der Kette macht das Ergebnis undefined —
 * genau das ist der Bug, den der Browser als "faellt auf initial"
 * stillschweigend behandelt.
 * ---------------------------------------------------------------------- */
function resolve(name, map, seen = new Set()) {
  if (!(name in map)) return undefined;
  if (seen.has(name)) return undefined; // Zyklus
  const raw = map[name];
  const next = new Set(seen).add(name);
  let out = raw;
  // Das volle var(...) samt schliessender Klammer matchen, sonst bleibt
  // beim Ersetzen eine ") " stehen.
  for (const m of raw.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*\)/g)) {
    const inner = resolve(m[1], map, next);
    if (inner === undefined) return undefined;
    out = out.replace(m[0], inner);
  }
  return out.trim();
}

/**
 * Alpha aus einem aufgeloesten Farbwert ziehen. Deckt beide Schreibweisen
 * ab — modern `rgb(r g b / a)` und Legacy `rgba(r, g, b, a)` —, damit der
 * Test nicht an einer Syntaxfrage scheitert statt an der Property.
 */
function alphaOf(value) {
  if (!value) return undefined;
  const modern = value.match(/\/\s*([0-9.]+)/);
  if (modern) return Number(modern[1]);
  const legacy = value.match(/,\s*([0-9.]+)\s*\)/);
  return legacy ? Number(legacy[1]) : undefined;
}

/* ---------------------------------------------------------------------- *
 * var()-Referenzen aus dem gesamten src/ einsammeln.
 * ---------------------------------------------------------------------- */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(vue|css|js)$/.test(entry)) out.push(p);
  }
  return out;
}

const REFERENCED = (() => {
  const refs = new Map();
  for (const file of walk(SRC)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
      if (!refs.has(m[1])) refs.set(m[1], new Set());
      refs.get(m[1]).add(relative(SRC, file));
    }
  }
  return refs;
})();

/* ====================================================================== *
 * 0. Parser-Gegenprobe — sonst waeren alle Tests gruen, weil sie nichts tun
 * ====================================================================== */
describe("Token-Schicht: Parser", () => {
  it("liest die Schicht aus beiden Stylesheets", () => {
    expect(ALL_RULES.length).toBeGreaterThan(20);
    expect(Object.keys(LIGHT).length).toBeGreaterThan(100);
    expect(Object.keys(DARK_OVERRIDES).length).toBeGreaterThan(20);
  });

  it("liest die bekannten Kernwerte in beiden Themes", () => {
    expect(LIGHT["--color-primary"]).toBe("#2f6f6f");
    expect(DARK["--color-primary"]).toBe("#4daaa0");
    expect(LIGHT["--md-sys-spacing-md"]).toBe("16px");
  });
});

/* ====================================================================== *
 * 1. Token-Vollstaendigkeit Light <-> Dark
 * ====================================================================== */
describe("Token-Schicht: Vollstaendigkeit", () => {
  it("laesst kein :root-Token im Dark Mode unerwartet weg", () => {
    const missing = Object.keys(LIGHT).filter((n) => !(n in DARK));
    expect(missing).toEqual([]);
  });

  it("deklariert im Dark-Mode-Block kein Token, das es in :root nicht gibt", () => {
    // Ein Dark-only-Token waere ein Tippfehler: im Light Mode fehlte es.
    const orphans = Object.keys(DARK_OVERRIDES).filter((n) => !(n in LIGHT));
    expect(orphans).toEqual([]);
  });

  it("loest jede Deklaration in beiden Themes zu einem echten Wert auf", () => {
    const broken = [];
    for (const name of Object.keys(LIGHT)) {
      if (resolve(name, LIGHT) === undefined) broken.push(`${name} (light)`);
      if (resolve(name, DARK) === undefined) broken.push(`${name} (dark)`);
    }
    expect(broken).toEqual([]);
  });
});

/* ====================================================================== *
 * 2. Kein Token faellt auf den initialen Wert zurueck
 * ====================================================================== */
describe("Token-Schicht: keine undefinierten Referenzen", () => {
  it("kennt jede in src/ per var() referenzierte Token-Definition", () => {
    const undefinedTokens = [...REFERENCED.keys()].filter((t) => !(t in LIGHT)).sort();
    expect(undefinedTokens).toEqual([]);
  });

  it("sammelt genug Referenzen ein, damit der Test nicht leer laeuft", () => {
    expect(REFERENCED.size).toBeGreaterThan(50);
  });
});

/* ====================================================================== *
 * 3. Semantische Achsen: Light und Dark MUESSEN sich unterscheiden
 * ====================================================================== */
describe("Token-Schicht: semantische Achsen im Dark Mode", () => {
  const MUST_DIFFER = [
    "--color-border-glass",
    "--color-border-glass-subtle",
    "--color-overlay-scrim",
    "--color-focus-ring",
    "--color-on-accent",
  ];

  it.each(MUST_DIFFER)("%s unterscheidet sich zwischen Light und Dark", (token) => {
    expect(LIGHT[token]).toBeDefined();
    expect(DARK[token]).toBeDefined();
    expect(resolve(token, LIGHT)).not.toBe(resolve(token, DARK));
  });

  it("--color-on-accent ist in Dark Mode dunkel, in Light Mode hell", () => {
    // Sonst haetten die gefuellten Buttons nur 2.6:1 Kontrast.
    expect(resolve("--color-on-accent", LIGHT)).toBe("#fdfbf7");
    expect(resolve("--color-on-accent", DARK)).toBe("#06201d");
  });
});

/* ====================================================================== *
 * 4. Urspruenglicher Befund: grelle weisse Linie um jede Karte
 * ====================================================================== */
describe("Token-Schicht: Glas-Border im Dark Mode (Befund 3)", () => {
  it("setzt --color-border-glass im Dark Mode deutlich dezenter als im Light", () => {
    const light = alphaOf(resolve("--color-border-glass", LIGHT));
    const dark = alphaOf(resolve("--color-border-glass", DARK));
    expect(light).toBeGreaterThan(0.5);
    expect(dark).toBeLessThanOrEqual(0.25);
    expect(dark).toBeLessThan(light);
  });

  it("setzt --color-border-glass-subtle im Dark Mode ebenfalls zurueck", () => {
    const light = alphaOf(resolve("--color-border-glass-subtle", LIGHT));
    const dark = alphaOf(resolve("--color-border-glass-subtle", DARK));
    expect(dark).toBeLessThan(light);
    expect(dark).toBeLessThanOrEqual(0.2);
  });

  it("baut die Dark-Border auf Weiss, nicht auf der hellen Ink-Basis", () => {
    // Die Ink-Basis kippt im Dark Mode auf Weiss; eine Border darauf waere
    // genau die grelle Linie, die Befund 3 beseitigt hat.
    expect(DARK["--md-sys-color-ink-rgb"]).toBe("255 255 255");
    expect(resolve("--color-border-glass", DARK)).toContain("255 255 255");
  });
});

/* ====================================================================== *
 * 5. Alias-Achsen: muessen in BEIDEN Themes denselben Wert liefern
 * ====================================================================== */
describe("Token-Schicht: Alias-Achsen", () => {
  const ALIASES = {
    "--space-xs": "--md-sys-spacing-xs",
    "--space-sm": "--md-sys-spacing-sm",
    "--space-md": "--md-sys-spacing-md",
    "--space-lg": "--md-sys-spacing-lg",
    "--space-xl": "--md-sys-spacing-xl",
    "--space-2xl": "--md-sys-spacing-2xl",
    "--radius-sm": "--md-sys-radius-small",
    "--radius-md": "--md-sys-radius-medium",
    "--radius-lg": "--md-sys-radius-large",
    "--radius-full": "--md-sys-radius-full",
  };
  const CANONICAL = [
    "--md-sys-spacing-xs", "--md-sys-spacing-sm", "--md-sys-spacing-md",
    "--md-sys-spacing-lg", "--md-sys-spacing-xl", "--md-sys-spacing-2xl",
    "--md-sys-radius-small", "--md-sys-radius-medium", "--md-sys-radius-large",
    "--md-sys-radius-full", "--md-sys-radius-extra-large",
  ];

  it.each(Object.entries(ALIASES))("%s zeigt auf %s", (alias, canonical) => {
    expect(LIGHT[alias]).toBe(`var(${canonical})`);
  });

  it.each(Object.entries(ALIASES))("%s loest in Light und Dark gleich auf", (alias, canonical) => {
    expect(resolve(alias, LIGHT)).toBe(resolve(canonical, LIGHT));
    expect(resolve(alias, DARK)).toBe(resolve(canonical, DARK));
  });

  it("haelt jede kanonische Stufe in beiden Themes identisch", () => {
    // Eine Achse, die im Dark Mode aus dem Raster faellt, faellt hier auf.
    for (const canonical of CANONICAL) {
      expect(resolve(canonical, LIGHT)).toBe(resolve(canonical, DARK));
    }
  });
});

/* ====================================================================== *
 * 6. Fokus-Achse (Befund 5)
 * ====================================================================== */
describe("Token-Schicht: Fokus-Achse", () => {
  it("laesst die Ringfarbe dem Thema folgen", () => {
    expect(LIGHT["--color-focus-outline"]).toBe("var(--color-primary)");
    expect(resolve("--color-focus-outline", LIGHT)).toBe("#2f6f6f");
    expect(resolve("--color-focus-outline", DARK)).toBe("#4daaa0");
  });

  it("haelt Geometrie und Halo in beiden Themes getrennt", () => {
    expect(resolve("--focus-ring-width", LIGHT)).toBe("2px");
    expect(resolve("--focus-ring-offset", DARK)).toBe("2px");
    // Der Halo ist weicher als die Ringfarbe, in beiden Themes.
    expect(alphaOf(resolve("--color-focus-ring", LIGHT))).toBeLessThan(1);
    expect(alphaOf(resolve("--color-focus-ring", LIGHT))).toBeLessThan(
      alphaOf(resolve("--color-focus-ring", DARK)),
    );
  });
});

/* ====================================================================== *
 * 7. Pastell-Verlauf (Befund 8)
 * ====================================================================== */
describe("Token-Schicht: Pastell-Verlauf", () => {
  const TRIPLETS = [
    "--md-sys-color-accent-warm-rgb",
    "--md-sys-color-accent-cool-rgb",
    "--md-sys-color-accent-sage-rgb",
    "--md-sys-color-bg-top-rgb",
    "--md-sys-color-bg-bottom-rgb",
  ];

  it.each(TRIPLETS)("%s hat eine Dark-Mode-Variante", (token) => {
    expect(resolve(token, LIGHT)).toMatch(/^\d+ \d+ \d+$/);
    expect(resolve(token, DARK)).toMatch(/^\d+ \d+ \d+$/);
    expect(resolve(token, LIGHT)).not.toBe(resolve(token, DARK));
  });

  it("behaelt die Warm-/Kuelt-Farben, die der Verlauf schon immer hatte", () => {
    // #fde8d5 bzw. #bde9dd — Regressionstest gegen eine stille
    // Aenderung der Palette.
    expect(resolve("--md-sys-color-accent-warm-rgb", LIGHT)).toBe("253 232 213");
    expect(resolve("--md-sys-color-accent-cool-rgb", LIGHT)).toBe("189 233 221");
  });
});

/* ====================================================================== *
 * 8. prefers-contrast (Befund 7)
 * ====================================================================== */
describe("Token-Schicht: prefers-contrast", () => {
  it("schaerft die Outline-Achse in beiden Themes nach", () => {
    expect(alphaOf(resolve("--md-sys-color-outline", LIGHT_CONTRAST))).toBeGreaterThan(
      alphaOf(resolve("--md-sys-color-outline", LIGHT)),
    );
    expect(alphaOf(resolve("--md-sys-color-outline", DARK_CONTRAST))).toBeGreaterThan(
      alphaOf(resolve("--md-sys-color-outline", DARK)),
    );
  });

  it("gibt der Dark-Variante eine eigene Border statt der Light-Werte", () => {
    // Sonst traegt Light-Weiss mit 0.95 Deckkraft auch im Dark Mode.
    expect(resolve("--color-border-glass", LIGHT_CONTRAST)).not.toBe(
      resolve("--color-border-glass", DARK_CONTRAST),
    );
    expect(alphaOf(resolve("--color-border-glass", DARK_CONTRAST))).toBeLessThanOrEqual(0.75);
  });
});
