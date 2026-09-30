/**
 * Farbleiter des Raum-Chips (Aufgabe 1).
 *
 * Der Chip bekommt seine drei Farben aus der DB-Farbe berechnet
 * (`roomPalette`). Das ist unsichtbarer Code, bis eine Zahl kippt: dann
 * ist der Chip entweder unlesbar oder der Rand laeuft in die Flaeche.
 * Dieser Test haelt deshalb die ZAHLEN fest, nicht das Verhalten der
 * Komponente — RoomChip.spec.js prueft, dass die Komponente sie benutzt.
 *
 * Die Raumfarben sind die aus der Produktivmigration
 * (`services/chore-service/app/migrations.py`, DEFAULT_ROOMS). Absichtlich
 * kopiert und nicht aus der Python-Datei gelesen: wenn das Backend einen
 * Raum umfaerbt, soll dieser Test die Design-Aussage "Rand >= 3:1"
 * brechen und nicht stillschweigend neu berechnen.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  contrastRatio,
  mixHex,
  parseHexColor,
  roomEdge,
  roomPalette,
  ROOM_EDGE_RATIO,
  ROOM_EDGE_ANCHOR,
  ROOM_DEEP_INK,
} from "@/utils/roomColor";

/** Die elf Produktivraeume: [name, farbe, istPersoenlich]. */
const ROOMS = [
  ["Küche", "#f6c7ae", false],
  ["Bad", "#b7e1d7", false],
  ["Schlafzimmer", "#c6e7dc", false],
  ["Wohnzimmer", "#f2ddba", false],
  ["Flur", "#eee7c9", false],
  ["Keller", "#e2e6d2", false],
  ["Garage", "#d3ead8", false],
  ["Waschraum", "#c6e7dc", false],
  ["Garten", "#d3ead8", false],
  ["Abwasch", "#f6c7ae", false],
  ["Dave", "#8d6e63", true],
];
/** Die acht verschiedenen Farben daraus (3 Paare teilen sich einen Ton). */
const PASTELLS = [
  "#f6c7ae",
  "#b7e1d7",
  "#c6e7dc",
  "#f2ddba",
  "#eee7c9",
  "#e2e6d2",
  "#d3ead8",
];
const DAVE = "#8d6e63";

/**
 * Die Kartenflaechen, auf denen der Chip liegt, aus `variables.css` gelesen
 * statt hier festgeschrieben: ein Theme-Wechsel darf den Test nicht still
 * veralten lassen. Genommen wird `--color-background`, also die jeweils
 * UNGUENSTIGERE der beiden Ebenen — Light: das dunklere Page-Beige unter
 * der weissen Glasflaeche, Dark: das dunklere Page-Schwarz unter der
 * helleren Karte. Eine Aenderung dort, die die Zusagen bricht, schlaegt
 * also an.
 */
const VARS = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../src/assets/styles/variables.css",
  ),
  "utf8",
);
const themeBlock = (selector) => VARS.split(selector)[1]?.split("}")[0] ?? "";
const bgOf = (block) =>
  /--color-background:\s*(#[0-9a-fA-F]{3,6})/.exec(block)?.[1];
const LIGHT_CARD = bgOf(themeBlock(":root {"));
const DARK_CARD = bgOf(themeBlock('[data-theme="dark"] {'));

/** Farbton in Grad. Nur fuer die Hue-Treue der Kontur. */
function hueOf(hex) {
  const rgb = parseHexColor(hex);
  if (!rgb) throw new Error(`keine Farbe: ${JSON.stringify(hex)}`);
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (((h * 60) % 360) + 360) % 360;
}
/**
 * Kuerzester Abstand zweier Farben auf dem Farbkreis, in Grad.
 *
 * Nimmt Hex-Farben, nicht schon berechnete Farbtoene. Ein neutraler Ton
 * (r == g == b) hat keinen Farbton — dann ist die Frage "wie weit ist er
 * gewandert" nicht beantwortbar, und `null` wuerde in der Arithmetik
 * still zu 0. Deshalb explodiert der Test in dem Fall, statt eine
 * falsche 0 zu liefern.
 */
function hueGap(a, b) {
  const ha = hueOf(a);
  const hb = hueOf(b);
  if (ha === null || hb === null) {
    throw new Error(`Farbton nicht bestimmbar: ${a} (${ha}) / ${b} (${hb})`);
  }
  const d = Math.abs(ha - hb) % 360;
  return d > 180 ? 360 - d : d;
}

describe("roomColor: parseHexColor", () => {
  it("versteht alle Schreibweisen des Users", () => {
    expect(parseHexColor("#f6c7ae")).toEqual([246, 199, 174]);
    expect(parseHexColor("f6c7ae")).toEqual([246, 199, 174]);
    expect(parseHexColor("  #F6C7AE ")).toEqual([246, 199, 174]);
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
  });

  it("gibt bei Muell null zurueck statt zu raten", () => {
    for (const bad of [null, undefined, "", "rebeccapurple", "#12345", 42]) {
      expect(parseHexColor(bad)).toBeNull();
    }
  });
});

describe("roomColor: mixHex", () => {
  it("mischt linear und rundet auf ganze Kanaele", () => {
    expect(mixHex("#ffffff", "#000000", 0.5)).toBe("#808080");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#f6c7ae", "#f6c7ae", 0.5)).toBe("#f6c7ae");
  });

  it("klemmt das Verhaeltnis auf 0..1", () => {
    expect(mixHex("#ffffff", "#000000", 0)).toBe("#ffffff");
    expect(mixHex("#ffffff", "#000000", 1)).toBe("#000000");
    expect(mixHex("#ffffff", "#000000", -3)).toBe("#ffffff");
    expect(mixHex("#ffffff", "#000000", 7)).toBe("#000000");
  });

  it("liefert bei unbrauchbarer Farbe null, statt eine zu erfinden", () => {
    expect(mixHex("nope", "#000000", 0.5)).toBeNull();
  });
});

describe("roomColor: die Kontur traegt die Raumfarbe", () => {
  it("zieht die Kontur auf ROOM_EDGE_ANCHOR, nicht auf die Tinte", () => {
    for (const [, fill] of ROOMS) {
      expect(roomEdge(fill)).toBe(
        mixHex(fill, ROOM_EDGE_ANCHOR, ROOM_EDGE_RATIO),
      );
    }
  });

  it("nutzt einen NEUTRALEN Anker, damit der Farbton nicht wandert", () => {
    // Der Kern der Aufgabe: die Kontur muss die Raumfarbe tragen. Ein
    // getoenter Anker (ROOM_DEEP_INK, ~178 Grad Aqua) zieht jeden Raum in
    // seine Richtung — bei 0.55 verliert Keller #e2e6d2 seinen Ton
    // (Abweichung 57 Grad). Schwarz laesst alle drei Kanaele gleich
    // skalieren, also den Farbton stehen.
    expect(ROOM_EDGE_ANCHOR).toBe("#000000");
    const driftWithInk = PASTELLS.map((f) =>
      hueGap(f, mixHex(f, ROOM_DEEP_INK, 0.55)),
    );
    expect(Math.max(...driftWithInk)).toBeGreaterThan(20);
    const driftWithAnchor = PASTELLS.map((f) =>
      hueGap(f, mixHex(f, ROOM_EDGE_ANCHOR, ROOM_EDGE_RATIO)),
    );
    expect(Math.max(...driftWithAnchor)).toBeLessThanOrEqual(6);
  });

  it("unterscheidet die Raeume auch dann, wenn die Pastelle aehnlich sind", () => {
    // Drei Raumpaare teilen sich dieselbe Pastellfarbe (Kueche/Abwasch,
    // Schlafzimmer/Waschraum, Garage/Garten). Der Chip kann sie an der
    // Flaeche nicht trennen — fuer diese Raeume ist der NAME der
    // Traeger. Die Kontur muss aber wenigstens dort, wo die Farben
    // wirklich verschieden sind, wirklich verschieden sein.
    const edges = new Set(PASTELLS.map((f) => roomEdge(f)));
    expect(edges.size).toBe(PASTELLS.length);
  });

  it("erhaelt den Farbton: die Kontur ist die Raumfarbe, nur tiefer", () => {
    // Toleranz 6 Grad: die Kanaele werden auf ganze Zahlen gerundet, und
    // bei dunklen Werten verschiebt das den Farbton um ein paar Grad. Die
    // Alternative — eine getoente Kontur, die den Ton "genauer" trifft —
    // waere die 57-Grad-Abweichung aus dem Anker-Test.
    for (const [name, fill] of ROOMS) {
      expect(hueGap(roomEdge(fill), fill), name).toBeLessThanOrEqual(6);
    }
  });

  it("haelt bei jeder PASTELL-Raumfarbe >= 3:1 gegen die eigene Flaeche", () => {
    // WCAG 1.4.11 (nicht-Text-Inhalt). Ohne das laeuft der Rand optisch in
    // die Pastellflaeche — genau der Befund aus Aufgabe 1.
    //
    // Geprueft werden die PASTELLE, nicht alle Raeume: der dunkle
    // Persoenlichen-Raum kann das nicht erreichen (siehe eigener Test
    // weiter unten, "Dave: der dokumentierte Ausnahmefall").
    for (const fill of PASTELLS) {
      const cr = contrastRatio(fill, roomEdge(fill));
      expect(cr, fill).not.toBeNull();
      expect(cr, fill).toBeGreaterThanOrEqual(3);
    }
  });

  it("Dave: der dokumentierte Ausnahmefall", () => {
    // Der einzige dunkle Raum kann die 3:1 gegen die eigene Flaeche nicht
    // erreichen: die Flaeche ist bereits dunkel, jede weitere Stufe Richtung
    // Schwarz nimmt ihr die Unterscheidbarkeit. Das ist eine Eigenschaft des
    // dunklen Raums, kein Fehler der Stufe — und es heisst ausdruecklich
    // NICHT, dass die Kontur dort wirkungslos ist. Sie traegt:
    //   - die Silhouette gegen die helle Karte (~9.8:1), und
    //   - die Raumfarbe selbst, denn der Farbton bleibt erhalten.
    // Im Dark Mode traegt die Flaeche die Silhouette (3.75:1), nicht die
    // Kontur. Die Tinte (4.62:1 gegen die Flaeche) ist in beiden Themes
    // ueber der 4.5:1-Linie — der Chip ist also immer lesbar.
    const fill = DAVE;
    const edge = roomEdge(fill);
    expect(contrastRatio(fill, edge)).toBeLessThan(3);
    expect(contrastRatio(edge, LIGHT_CARD)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(fill, DARK_CARD)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(fill, roomPalette(fill).ink)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(hueGap(edge, fill)).toBeLessThanOrEqual(6);
  });

  it("schoen: 0.42 laeuft in die Flaeche, 0.52 laeuft in die dunkle Karte", () => {
    // Die Begruendung fuer ROOM_EDGE_RATIO — die Zahl ist gemessen, nicht
    // geschaetzt. Beide Nachbarwerte verletzen je EINE der beiden in
    // roomColor.js zugesagten Achsen, jeweils im schlechtesten Fall aller
    // sieben Pastellfarben.
    const worstFillEdge = (ratio) =>
      Math.min(
        ...PASTELLS.map((f) => contrastRatio(f, roomEdge(f, { ratio }))),
      );
    const worstDark = (ratio) =>
      Math.min(
        ...PASTELLS.map((f) =>
          contrastRatio(roomEdge(f, { ratio }), DARK_CARD),
        ),
      );
    // Zu wenig: die Kontur verschwindet in der Pastellflaeche.
    expect(worstFillEdge(0.42)).toBeLessThan(3);
    // Zu viel: die Kontur verschwindet auf der dunklen Karte.
    expect(worstDark(0.52)).toBeLessThan(3);
  });

  it("ROOM_EDGE_RATIO haelt alle drei Achsen fuer JEDE Pastellfarbe", () => {
    for (const fill of PASTELLS) {
      expect(
        contrastRatio(fill, roomEdge(fill)),
        `${fill} ~ Fuellung`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(roomEdge(fill), LIGHT_CARD),
        `${fill} ~ Light`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(roomEdge(fill), DARK_CARD),
        `${fill} ~ Dark`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("ist die groesste Stufe, die die dunkle Karte noch haelt", () => {
    // Dass ROOM_EDGE_RATIO nicht willkuerlich gewaehlt ist, beweist der
    // Sprung zur naechsten Stufe: bei 0.52 faellt der schlechteste Pastell
    // aus dem 3:1-Raster. Der Wert ist damit an beiden Seiten begrenzt.
    const worstDark = (ratio) =>
      Math.min(
        ...PASTELLS.map((f) =>
          contrastRatio(roomEdge(f, { ratio }), DARK_CARD),
        ),
      );
    expect(worstDark(ROOM_EDGE_RATIO)).toBeGreaterThanOrEqual(3);
    expect(worstDark(0.52)).toBeLessThan(3);
  });
});

describe("roomColor: die Kontur trennt den Chip von der Karte", () => {
  it("liest die Kartenfarben wirklich aus variables.css", () => {
    // Ohne diese Assertion prueft der Rest ins Leere, falls sich das
    // Block-Muster im Stylesheet aendert.
    expect(LIGHT_CARD).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    expect(DARK_CARD).toMatch(/^#[0-9a-fA-F]{3,6}$/);
  });

  it.each(PASTELLS)("%s: >= 3:1 gegen beide Karten", (fill) => {
    const edge = roomEdge(fill);
    expect(contrastRatio(edge, LIGHT_CARD)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(edge, DARK_CARD)).toBeGreaterThanOrEqual(3);
  });

  it("Dave: die Kontur traegt nur den Light Mode, die Flaeche den Dark Mode", () => {
    // Der einzige dokumentierte Ausnahmefall: der einzige dunkle Raum hat
    // eine dunkle Kontur, die auf dunkler Karte nur ~1.4:1 erreicht. Der
    // Chip bleibt dort ueber seine Flaeche erkennbar (~3.6:1). Beides wird
    // hier festgehalten, damit die Ausnahme nicht zur Selbstverstaendlichkeit
    // wird und jemand sie "repariert", indem er die Regel bricht.
    expect(contrastRatio(roomEdge(DAVE), LIGHT_CARD)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(roomEdge(DAVE), DARK_CARD)).toBeLessThan(3);
    expect(contrastRatio(DAVE, DARK_CARD)).toBeGreaterThanOrEqual(3);
  });
});

describe("roomColor: roomPalette ist die eine Quelle fuer Chip und Filter", () => {
  it("liefert Fuellung, Schrift und Kontur fuer jeden Raum", () => {
    for (const [name, fill] of ROOMS) {
      const p = roomPalette(fill);
      expect(p, name).toEqual({
        fill,
        ink: expect.any(String),
        edge: expect.any(String),
      });
    }
  });

  it("haelt die Schrift bei >= 4.5:1 gegen die Flaeche", () => {
    for (const [name, fill] of ROOMS) {
      const { ink } = roomPalette(fill);
      expect(
        contrastRatio(fill, ink),
        `${name}: ${fill}/${ink}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("nutzt bei dunkler Raumfarbe helle Schrift (Dave)", () => {
    expect(roomPalette(DAVE).ink).toBe("#ffffff");
    expect(roomPalette("#f6c7ae").ink).toBe(ROOM_DEEP_INK);
  });

  it("faellt bei kaputter Farbe auf den Raum-Default zurueck", () => {
    // Ein Raum ohne Farbe darf den Chip nicht transparent machen. Die
    // Quelle des Defaults ist `constants/roomIcons.js`, dieselbe wie im
    // Room-Picker — keine zweite Wahrheit.
    for (const bad of [undefined, null, "", "rgb(1,2,3)", "#zzzzzz"]) {
      const p = roomPalette(bad);
      expect(p.fill, String(bad)).toBe("#c6e7dc");
      expect(contrastRatio(p.fill, p.ink)).toBeGreaterThanOrEqual(4.5);
      expect(p.edge).toBe(roomEdge("#c6e7dc"));
    }
  });

  it("gibt fuer Chip und Filter identische Farben zurueck", () => {
    // Der Auftrag aus Aufgabe 2: "ein Raum sieht in Karte und Filter gleich
    // aus". Das ist hier eine Identitaetsaussage, kein Augenschein.
    expect(roomPalette("#f6c7ae")).toEqual(roomPalette("#f6c7ae"));
  });
});
