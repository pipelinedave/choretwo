import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ROOM_ICONS,
  ROOM_COLOR_PRESETS,
  DEFAULT_ROOM_COLOR,
  DEFAULT_ROOM_ICON,
} from "@/constants/roomIcons";
import {
  parseHexColor,
  readableInk,
  contrastRatio,
  relativeLuminance,
} from "@/utils/roomColor";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "../../../..");

/* ====================================================================== *
 * 1. Der Icon-Spiegel — die wichtigste Invariante der ganzen Liste
 * ====================================================================== *
 *
 * `icon` wird im Frontend als CSS-Klasse gerendert und vom Backend gegen
 * eine Allowlist geprueft. Sind die beiden Listen auseinander, waehlt der
 * User im Picker ein Icon, das das Backend beim Speichern mit 422
 * zurueckweist — und die Fehlermeldung erklaert nicht, worum es geht.
 *
 * Der Test liest die Python-Datei und vergleicht. Das ist etwas fragil
 * (Parse-Format), aber ein False Positive ist hier harmlos: faellt die
 * Regex mal aus, meldet der Test einen leeren Satz und man schaut nach.
 * Ein nicht synchrones Frontend waere dagegen ein echter Produktfehler.
 */
describe("Raum-Icons: Frontend spiegelt das Backend", () => {
  const pythonSrc = readFileSync(
    join(REPO, "services/chore-service/app/schemas.py"),
    "utf8",
  );

  const block = pythonSrc.match(
    /ALLOWED_ROOM_ICONS\s*=\s*frozenset\(\s*\{([\s\S]*?)\}\s*\)/,
  );

  it("findet ALLOWED_ROOM_ICONS in schemas.py", () => {
    expect(block).not.toBeNull();
  });

  const backendIcons = (() => {
    if (!block) return [];
    return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  })();

  it("liest eine nicht-leere Icon-Liste aus dem Backend", () => {
    expect(backendIcons.length).toBeGreaterThan(10);
  });

  it("hat exakt dieselbe Icon-Menge wie das Backend", () => {
    const frontend = [...ROOM_ICONS].sort();
    const backend = [...backendIcons].sort();
    expect(frontend).toEqual(backend);
  });

  it("nutzt jedes Icon genau einmal (keine Tippfehler-Duplikate)", () => {
    expect(new Set(ROOM_ICONS).size).toBe(ROOM_ICONS.length);
  });

  it("erlaubt nur Zeichen, die ein MDI-Klassenname haben kann", () => {
    // Das Backend prueft zusaetzlich `^[a-z0-9-]{1,64}$`. Ein Icon mit
    // Unterstrich oder Punkt wuerde dort durchfallen.
    for (const icon of ROOM_ICONS) {
      expect(icon).toMatch(/^[a-z0-9-]{1,64}$/);
    }
  });

  it("nutzt weder 'mdi-'-Praefix noch Leerzeichen", () => {
    for (const icon of ROOM_ICONS) {
      expect(icon.startsWith("mdi-")).toBe(false);
      expect(icon).not.toMatch(/\s/);
    }
  });
});

/* ====================================================================== *
 * 2. Farb-Palette
 * ====================================================================== */
describe("Raum-Farbpalette", () => {
  it("besteht aus gueltigen Hex-Werten", () => {
    for (const p of ROOM_COLOR_PRESETS) {
      expect(p.value).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("hat keine doppelten Farben", () => {
    const values = ROOM_COLOR_PRESETS.map((p) => p.value.toLowerCase());
    expect(new Set(values).size).toBe(values.length);
  });

  it("nutzt pastellige Töne, damit der Chip als Textfeld liest", () => {
    // Zu dunkle Presets wuerden mit heller Tinte arbeiten, aber der Chip
    // soll nicht wie eine Flaeche und nicht wie ein Farbblock wirken.
    // Keine harte Grenze, nur die Absicht festgehalten.
    for (const p of ROOM_COLOR_PRESETS) {
      const rgb = parseHexColor(p.value);
      const lum = relativeLuminance(rgb);
      expect(lum).toBeGreaterThan(0.15);
    }
  });

  it("Default-Farbe ist selbst ein Preset", () => {
    const values = ROOM_COLOR_PRESETS.map((p) => p.value.toLowerCase());
    expect(values).toContain(DEFAULT_ROOM_COLOR.toLowerCase());
  });

  it("Default-Icon steht in der Icon-Liste", () => {
    expect(ROOM_ICONS).toContain(DEFAULT_ROOM_ICON);
  });
});

/* ====================================================================== *
 * 3. Lesbarkeit: die Tinte folgt der Flaeche
 * ====================================================================== *
 *
 * Der Chip muss in Light UND Dark Mode lesbar sein. Er traegt seine
 * Raumfarbe als Inline-Style und rechnet die Schriftfarbe daraus — es
 * gibt also keine Dark-Variante des Chips. Der Test haelt fest, dass das
 * Rechnen funktioniert: auf jeder Preset-Farbe liegt der Kontrast
 * zwischen Chip und Beschriftung ueber der WCAG-AA-Grenze fuer
 * Fliesstext.
 */
describe("Raum-Chip: Kontrast", () => {
  it("parseHexColor versteht #rrggbb, #rgb und ohne #", () => {
    expect(parseHexColor("#c6e7dc")).toEqual([198, 231, 220]);
    expect(parseHexColor("c6e7dc")).toEqual([198, 231, 220]);
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
  });

  it("parseHexColor gibt null fuer Unsinn zurueck", () => {
    expect(parseHexColor("red")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
    expect(parseHexColor(null)).toBeNull();
    expect(parseHexColor("")).toBeNull();
  });

  it("reachableInk liefert bei Unsinn eine sichere Default-Tinte", () => {
    // Kein Wurf umkippen: ein ungueltiger Wert darf den Chip nicht
    // transparent machen, sondern bekommt die dunkle Standardtinte.
    expect(readableInk("nope")).toBe("#0b1f1d");
  });

  it("waehlt auf dunklen Farben helle Schrift", () => {
    expect(readableInk("#000000")).toBe("#ffffff");
    expect(readableInk("#8d6e63")).toBe("#ffffff");
  });

  it("waehlt auf hellen Farben dunkle Schrift", () => {
    expect(readableInk("#ffffff")).toBe("#0b1f1d");
    expect(readableInk("#c6e7dc")).toBe("#0b1f1d");
  });

  it("haelt auf JEDER Preset-Farbe den WCAG-AA-Kontrast fuer Text (4.5:1)", () => {
    for (const p of ROOM_COLOR_PRESETS) {
      const ratio = contrastRatio(p.value, readableInk(p.value));
      expect(
        ratio,
        `${p.name} (${p.value}) erreicht nur ${ratio?.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("haelt den Kontrast auch bei einem sehr hellen Freiwert", () => {
    // Der User darf jeden Hex setzen, nicht nur Presets.
    for (const hex of ["#fffff0", "#e8f4ff", "#f0fff0"]) {
      const ratio = contrastRatio(hex, readableInk(hex));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("haelt den Kontrast auch bei einem sehr dunklen Freiwert", () => {
    for (const hex of ["#1a1a2e", "#2d1b1b", "#0b1f1d"]) {
      const ratio = contrastRatio(hex, readableInk(hex));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("contrastRatio ist symmetrisch", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(
      contrastRatio("#ffffff", "#000000"),
      5,
    );
  });
});
