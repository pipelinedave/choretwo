/**
 * Extrahiert MDI-Icon-Konturen als SVG-Pfade aus der Webfont-TTF.
 *
 * ==== WARUM ÜBERHAUPT ein Parser ======================================
 * Das Projekt hat `@mdi/font` (Webfont) als Dependency, aber NICHT
 * `@mdi/js` (SVG-Pfade). Die Chore-Visuals sollen echte Vektorpfade
 * sein, nicht Emoji und nicht eigene, von Hand gezeichnete Formen.
 * Optionen waren:
 *
 *   a) Eigene Formen zeichnen     -> 25 Kategorien x Handarbeit,
 *                                     drifts vom Material-Design-Vokabular
 *                                     ab, Clipart-Gefahr.
 *   b) MDI-Webfont im Template    -> funktioniert, ist aber eine
 *                                     MONOCHROME GLYPHE ohne die
 *                                     Szene drumherum. Für eine
 *                                     Illustration ("drei
 *                                     Wäschekörbe") reicht das nicht.
 *   c) `@mdi/js` als Dependency    -> NEUE Abhängigkeit, verboten.
 *   d) Konturen aus der vorhandenen TTF auslesen. Genau das hier.
 *
 * (d) ist die einzige Variante, die echte Material-Pfade liefert OHNE
 * neue Abhängigkeit und OHNE Raten: die Glyphen sind dieselben, die die
 * Webfont schon heute rendert, nur als Vektor. Der Preis ist ein
 * TrueType-Parser — rund 150 Zeilen, davon 90 Lesen von Tabellen und
 * 60 Konvertierung der Kontur.
 *
 * Die Ausgabe (`src/assets/icons/mdi-paths.generated.js`) wird MIT
 * committet. Der Parser läuft nur bei Bedarf neu:
 *
 *     node scripts/extract-mdi-paths.mjs
 *
 * ==== FONT-FORMAT =====================================================
 * Gelesen werden genau die Tabellen, die für eine Kontur nötig sind:
 *   head  -> unitsPerEm, indexToLocFormat (short/long loca)
 *   maxp  -> numGlyphs
 *   loca  -> Glyph-Offset je Glyph-ID
 *   glyf  -> die Kontur selbst (nur "einfache" Glyphen)
 *   cmap  -> Format 4 (BMP) für Codepoint -> Glyph-ID
 *
 * Was NICHT gelesen wird: hmtx (Breiten — MDI-Icons sind quadratisch
 * und werden ohnehin per viewBox skaliert), GSUB/post (nur Metadaten).
 *
 * ==== KOORDINATENWANDEL ==============================================
 * Font-Koordinaten: Y nach OBEN, Einheit = 1/unitsPerEm.
 * SVG-Koordinaten:  Y nach UNTEN, Einheit = 1/24 (MDI-Icon-Grid).
 *
 *     svgX = fontX * 24 / unitsPerEm
 *     svgY = 24 - fontY * 24 / unitsPerEm
 *
 * Die MDI-Webfont hat unitsPerEm = 512; der Faktor ist damit 24/512 =
 * 0.046875, das heisst 21.333 Font-Einheiten pro Icon-Einheit. Die
 * Kontur wird auf 2 Nachkommastellen gerundet — bei 36px Kachelgroesse
 * ist das unterhalb der Darstellungsaufloesung, haelt die Datei aber klein.
 *
 * ==== NUR EINFACHE GLYPHEN ===========================================
 * Zusammengesetzte Glyphen (numberOfContours < 0) referenzieren andere
 * Glyphen per Index. Sie kommen im MDI-Set vor, sind aber nicht Teil
 * des Icons, das wir brauchen. Statt sie stillschweigend zu
 * ueberspringen, meldet das Skript sie beim Lauf — ein fehlendes Icon
 * faellt dann beim Generieren auf, nicht erst optisch auf der Karte.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const FONT = join(ROOT, "node_modules/@mdi/font/fonts/materialdesignicons-webfont.ttf");
const CSS = join(ROOT, "node_modules/@mdi/font/css/materialdesignicons.css");
const OUT = join(ROOT, "src/assets/icons/mdi-paths.generated.js");

/** Icon-Namen, die in die Illustrationen eingehen. Bewusst kuratiert:
 *  eine Chore-Karte hat 24px fuer das Bild, nicht 7000 Pfade im Bundle.
 *  Die Liste ist die Bruecke zwischen der Welt der Chores und dem
 *  Material-Design-Vokabular — sie wird in `choreVisual.js` referenziert. */
const WANTED = [
  // Bad & Sanitaer
  "shower", "bathtub-outline", "water-pump", "toilet", "coat-rack",
  // Kueche & Abwasch
  "silverware-fork-knife", "countertop", "stove", "fridge-outline",
  "dishwasher", "silverware-variant", "cup",
  // Waesche
  "washing-machine", "tumble-dryer", "hanger", "basket-outline",
  "tshirt-crew-outline", "iron-outline",
  // Reinigen & Staub
  "spray-bottle", "broom", "vacuum", "brush-outline", "bucket-outline",
  "window-closed", "curtains",
  // Abfall
  "trash-can-outline", "recycle",
  // Einkauf & Vorrat
  "basket", "cart-outline", "package-variant", "bottle-tonic-outline",
  "food-apple-outline",
  // Garten & Pflanzen
  "sprout", "watering-can-outline", "leaf", "flower-tulip-outline",
  "tree-outline",
  // Kleidung & Schuhe
  "wardrobe-outline", "shoe-sneaker", "shoe-formal", "purse",
  // Wohnen
  "bed", "bed-double-outline", "desk", "bookshelf",
  // Tiere
  "paw", "dog", "cat", "fishbowl", "bone",
  // Technik & Reparatur
  "wrench", "pipe-wrench", "screwdriver", "lightbulb", "power-plug",
  "power-socket-eu", "laptop", "cellphone", "battery-charging",
  // Hobby & Sport
  "guitar-electric", "dumbbell", "bike", "run", "yoga", "palette", "needle",
  "scissors-cutting",
  // Sozial & Dringlichkeit
  "party-popper", "glass-wine", "gift-outline", "account-group", "walk",
  "check-circle-outline", "star-outline", "clipboard-check-outline",
  "calendar-check", "clock-outline", "book-open-page-variant",
  "toothbrush-paste", "pill", "bookshelf", "map-marker-radius-outline",
];

/* ---------------------------------------------------------------------- *
 * 1. Tabellendirectory
 * ---------------------------------------------------------------------- */
const font = readFileSync(FONT);
const dv = new DataView(font.buffer, font.byteOffset, font.byteLength);

const numTables = dv.getUint16(4);
const tables = {};
for (let i = 0; i < numTables; i++) {
  const o = 12 + i * 16;
  const tag = font.toString("ascii", o, o + 4);
  tables[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
}
for (const need of ["head", "maxp", "loca", "glyf", "cmap"]) {
  if (!tables[need]) throw new Error(`TTF unvollstaendig: Tabelle ${need} fehlt`);
}

/* ---------------------------------------------------------------------- *
 * 2. head / maxp / loca
 * ---------------------------------------------------------------------- */
const headOff = tables.head.off;
const unitsPerEm = dv.getUint16(headOff + 18);
const indexToLocFormat = dv.getInt16(headOff + 50);
const numGlyphs = dv.getUint16(tables.maxp.off + 4);

const loca = new Uint32Array(numGlyphs + 1);
for (let i = 0; i <= numGlyphs; i++) {
  loca[i] =
    indexToLocFormat === 0
      ? dv.getUint16(tables.loca.off + i * 2) * 2
      : dv.getUint32(tables.loca.off + i * 4);
}
const SCALE = 24 / unitsPerEm;

/* ---------------------------------------------------------------------- *
 * 3. cmap — Codepoint -> Glyph-ID
 *
 * MDI 7.x nutzt den Unicode-Private-Use-Bereich F0000..F1AFF. Der
 * liegt JENSEITS des BMP (0xFFFF), ein klassisches Format-4-Subtable
 * kommt daar nicht hin. Das Font liefert deshalb zusaetzlich Format 12
 * ((0,4) und (3,10)) mit echten 32-Bit-Codepoints — das ist der
 * Subtable, den wir brauchen; Format 4 existiert zwar auch, ist aber
 * leer und lieferte bei einem ersten Versuch durchweg "leere Glyphe".
 *
 *   Format 4:  endCode[], startCode[], idDelta[], idRangeOffset[]  (uint16)
 *   Format 12: groups[startChar, endChar, startGlyph]              (uint32)
 * ---------------------------------------------------------------------- */
const cmapOff = tables.cmap.off;
const nSub = dv.getUint16(cmapOff + 2);
const subtables = [];
for (let i = 0; i < nSub; i++) {
  const rec = cmapOff + 4 + i * 8;
  subtables.push({
    platform: dv.getUint16(rec),
    encoding: dv.getUint16(rec + 2),
    off: cmapOff + dv.getUint32(rec + 4),
  });
}

// Format 12 zuerst, Format 4 als Rueckfalloption.
const pick = (formats) => {
  for (const fmt of formats) {
    const found = subtables.find((s) => dv.getUint16(s.off) === fmt);
    if (found) return found;
  }
  return null;
};
const sub12 = pick([12]);
const sub4 = pick([4]);

function glyphForFormat4(base, codepoint) {
  const segX2 = dv.getUint16(base + 6);
  const segCount = segX2 / 2;
  const endBase = base + 14;
  const startBase = endBase + segX2 + 2;
  const deltaBase = startBase + segX2;
  const rangeBase = deltaBase + segX2;
  for (let s = 0; s < segCount; s++) {
    const end = dv.getUint16(endBase + s * 2);
    if (codepoint > end) continue;
    const start = dv.getUint16(startBase + s * 2);
    if (codepoint < start) return 0;
    const delta = dv.getInt16(deltaBase + s * 2);
    const rangeOff = dv.getUint16(rangeBase + s * 2);
    if (rangeOff === 0) return (codepoint + delta) & 0xffff;
    // rangeOffset zeigt auf ein Wort RELATIV zur eigenen Position.
    const addr = rangeBase + s * 2 + rangeOff + (codepoint - start) * 2;
    const g = dv.getUint16(addr);
    return g === 0 ? 0 : (g + delta) & 0xffff;
  }
  return 0;
}

function glyphForFormat12(base, codepoint) {
  const nGroups = dv.getUint32(base + 12);
  // Gruppen sind sortiert — binaer suchen statt linear.
  let lo = 0;
  let hi = nGroups - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const g = base + 16 + mid * 12;
    const start = dv.getUint32(g);
    const end = dv.getUint32(g + 4);
    if (codepoint < start) hi = mid - 1;
    else if (codepoint > end) lo = mid + 1;
    else return dv.getUint32(g + 8) + (codepoint - start);
  }
  return 0;
}

const glyphFor = sub12
  ? (cp) => glyphForFormat12(sub12.off, cp)
  : sub4
    ? (cp) => glyphForFormat4(sub4.off, cp)
    : () => 0;

if (!sub12 && !sub4) throw new Error("cmap: weder Format 12 noch Format 4 gefunden");
console.log(
  `  cmap: Format ${dv.getUint16(sub12 ? sub12.off : sub4.off)} ` +
    `(${[...new Set(subtables.map((s) => dv.getUint16(s.off)))].join("/")} vorhanden), ` +
    `unitsPerEm=${unitsPerEm}, numGlyphs=${numGlyphs}`,
);

/* ---------------------------------------------------------------------- *
 * 4. glyf -> SVG-Pfad
 * ---------------------------------------------------------------------- */
const ON_CURVE = 0x01;
const X_SHORT = 0x02;
const Y_SHORT = 0x04;
const REPEAT = 0x08;
const X_SAME_OR_POS = 0x10;
const Y_SAME_OR_POS = 0x20;

const r2 = (n) => {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
};

/**
 * Konvertiert die Kontur einer einfachen Glyphe in einen SVG-`d`-String.
 * Quadratische Beziers (TrueType) werden zu `Q`-Kommandos; ein
 * Off-curve-Punkt zwischen zwei On-curve-Punkten wird als impliziter
 * Mittelpunkt behandelt (das ist die TrueType-Regel fuer "implied
 * on-curve points" und kommt im MDI-Set vor).
 */
function glyphToPath(glyphId) {
  if (glyphId <= 0 || glyphId >= numGlyphs) return null;
  const start = tables.glyf.off + loca[glyphId];
  const end = tables.glyf.off + loca[glyphId + 1];
  if (loca[glyphId] === loca[glyphId + 1]) return null; // leer (z.B. space)

  const nContours = dv.getInt16(start);
  if (nContours < 0) return { composite: true };

  const endPts = [];
  for (let i = 0; i < nContours; i++) endPts.push(dv.getUint16(start + 10 + i * 2));
  const nPoints = nContours === 0 ? 0 : endPts[nContours - 1] + 1;

  const insLen = dv.getUint16(start + 10 + nContours * 2);
  let p = start + 12 + nContours * 2 + insLen;

  // Flags (mit Repeat-Kompression)
  const flags = [];
  while (flags.length < nPoints) {
    const f = dv.getUint8(p++);
    flags.push(f);
    if (f & REPEAT) {
      let r = dv.getUint8(p++);
      while (r-- > 0 && flags.length < nPoints) flags.push(f);
    }
  }

  // Koordinaten (deltakodiert)
  const xs = [];
  let x = 0;
  for (let i = 0; i < nPoints; i++) {
    const f = flags[i];
    if (f & X_SHORT) {
      const d = dv.getUint8(p++);
      x += f & X_SAME_OR_POS ? d : -d;
    } else if (!(f & X_SAME_OR_POS)) {
      x += dv.getInt16(p);
      p += 2;
    }
    xs.push(x);
  }
  const ys = [];
  let y = 0;
  for (let i = 0; i < nPoints; i++) {
    const f = flags[i];
    if (f & Y_SHORT) {
      const d = dv.getUint8(p++);
      y += f & Y_SAME_OR_POS ? d : -d;
    } else if (!(f & Y_SAME_OR_POS)) {
      y += dv.getInt16(p);
      p += 2;
    }
    ys.push(y);
  }

  // In SVG-Raum
  const pts = [];
  for (let i = 0; i < nPoints; i++) {
    pts.push({ x: r2(xs[i] * SCALE), y: r2(24 - ys[i] * SCALE), on: !!(flags[i] & ON_CURVE) });
  }

  // Konturweise in Befehle zerlegen
  const d = [];
  let first = 0;
  for (let c = 0; c < nContours; c++) {
    const last = endPts[c];
    const ring = pts.slice(first, last + 1);
    first = last + 1;
    if (ring.length < 2) continue;

    // Startpunkt: erster On-curve-Punkt; gibt es keinen, wird der
    // Mittelpunkt zwischen erstem und letztem Off-curve-Punkt genommen.
    let startIdx = ring.findIndex((q) => q.on);
    let sx;
    let sy;
    if (startIdx === -1) {
      sx = r2((ring[0].x + ring[ring.length - 1].x) / 2);
      sy = r2((ring[0].y + ring[ring.length - 1].y) / 2);
      startIdx = 0;
    } else {
      sx = ring[startIdx].x;
      sy = ring[startIdx].y;
    }
    d.push(`M${sx} ${sy}`);

    // Sequenz durch den Rest der Kontur
    const seq = [];
    for (let k = 1; k <= ring.length; k++) seq.push(ring[(startIdx + k) % ring.length]);

    let ctrl = null;
    for (const pt of seq) {
      if (pt.on) {
        if (ctrl) {
          d.push(`Q${ctrl.x} ${ctrl.y} ${pt.x} ${pt.y}`);
          ctrl = null;
        } else {
          d.push(`L${pt.x} ${pt.y}`);
        }
      } else {
        if (ctrl) {
          // Zwei Off-curve hintereinander: impliziter Mittelpunkt dazwischen.
          const mx = r2((ctrl.x + pt.x) / 2);
          const my = r2((ctrl.y + pt.y) / 2);
          d.push(`Q${ctrl.x} ${ctrl.y} ${mx} ${my}`);
        }
        ctrl = pt;
      }
    }
    if (ctrl) d.push(`Q${ctrl.x} ${ctrl.y} ${sx} ${sy}`); // Kontur schliesst auf Start
    d.push("Z");
  }

  return { d: d.join("") };
}

/* ---------------------------------------------------------------------- *
 * 5. Namen -> Codepoints aus dem CSS der Webfont
 * ---------------------------------------------------------------------- */
const css = readFileSync(CSS, "utf8");
const byName = new Map();
// Das CSS nutzt `::before` (Pseudo-Element, doppelter Doppelpunkt). Der
// Regex akzeptiert beide Schreibweisen, damit ein Wechsel des Generators
// das Skript nicht still leer laufen laesst.
for (const m of css.matchAll(/\.mdi-([a-z0-9-]+):{1,2}before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"/g)) {
  byName.set(m[1], parseInt(m[2], 16));
}
// Auch die Kurzform ohne "-outline"-Zwang ist abgedeckt: der Regex
// erfasst jede Klasse, die ein `:before` mit einem Codepoint traegt.

/* ---------------------------------------------------------------------- *
 * 6. Generieren
 * ---------------------------------------------------------------------- */
const paths = {};
const missing = [];
const composite = [];
for (const name of new Set(WANTED)) {
  const cp = byName.get(name);
  if (cp === undefined) {
    missing.push(name);
    continue;
  }
  const res = glyphToPath(glyphFor(cp));
  if (res === null) {
    missing.push(`${name} (leere Glyphe)`);
  } else if (res.composite) {
    composite.push(name);
  } else {
    paths[name] = res.d;
  }
}

const header = `/**
 * GENERIERTE DATEI — NICHT VON HAND AENDERN.
 *
 * Quelle: @mdi/font ${readFileSync(join(ROOT, "node_modules/@mdi/font/package.json"), "utf8").match(/"version":\s*"([^"]+)"/)[1]}
 * (Apache-2.0) via scripts/extract-mdi-paths.mjs.
 * Erneut erzeugen:  node scripts/extract-mdi-paths.mjs
 *
 * Warum das existiert: @mdi/font liefert nur eine Webfont. Fuer die
 * Chore-Illustrationen brauchen wir Konturen als Vektor (Komposition aus
 * mehreren Formen, Einfaerben einzelner Teile, Skalieren auf 24px).
 * @mdi/js waere die regulaere Loesung, waere aber eine neue
 * Abhaengigkeit — die Konturen stehen deshalb hier im Repo.
 *
 * Alle Pfade liegen im 24x24-Raster, das der MDI-Ursprungsspezifikation
 * entspricht. viewBox="0 0 24 24".
 */
`;

const body = Object.entries(paths)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, d]) => `  ${JSON.stringify(name)}: ${JSON.stringify(d)},`)
  .join("\n");

const file = `${header}\nexport const MDI_PATHS = {\n${body}\n};\n\n/** namespaced Alias — der Import-Site ist das egal, die Herkunft nicht. */\nexport { MDI_PATHS as mdiPaths };\n`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, file, "utf8");

console.log(`✓ ${Object.keys(paths).length} Pfade -> ${OUT}`);
console.log(`  Groesse: ${(file.length / 1024).toFixed(1)} KB`);
if (missing.length) console.log(`  ! fehlend: ${[...new Set(missing)].join(", ")}`);
if (composite.length) console.log(`  ! zusammengesetzt (uebersprungen): ${[...new Set(composite)].join(", ")}`);
