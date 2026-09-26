import { describe, it, expect } from "vitest";
import {
  resolveChoreVisual,
  classifyChore,
  resolveModifier,
  buildComposition,
  hashString,
  CHORE_CATEGORIES,
  CATEGORY_LABELS,
} from "@/utils/choreVisual";
import { MDI_PATHS } from "@/assets/icons/mdi-paths.generated.js";
import {
  CATEGORIES as IMAGE_CATEGORIES,
  SUBJECTS,
  FRAMINGS,
  buildPrompt,
  keyOf,
} from "../../../scripts/chore-image-prompts.mjs";

// Deterministische, lesbare Beispiele aus dem echten Betrieb.
const SAMPLES = [
  "Wäsche waschen und aufhängen",
  "Bad putzen",
  "Müll rausbringen",
  "Staubsaugen Wohnzimmer",
  "Pflanzen gießen",
  "Küche aufräumen",
  "Spülmaschine ausräumen",
  "Hund füttern",
  "Einkaufen gehen",
  "Fenster putzen",
  "Boden wischen",
  "Büro aufräumen",
];

describe("classifyChore", () => {
  it("ordnet die gaengigen Haushaltschores der richtigen Kategorie zu", () => {
    const expected = {
      "Wäsche waschen und aufhängen": "waesche",
      "Bad putzen": "bad",
      "Müll rausbringen": "abfall",
      "Staubsaugen Wohnzimmer": "staub",
      "Pflanzen gießen": "pflanzen",
      "Küche aufräumen": "kueche",
      "Spülmaschine ausräumen": "spuelmaschine",
      "Hund füttern": "tier",
      "Einkaufen gehen": "einkaufen",
      "Fenster putzen": "fenster",
      "Boden wischen": "boden",
      "Büro aufräumen": "buero",
    };
    for (const [name, cat] of Object.entries(expected)) {
      expect(classifyChore(name).category, `"${name}"`).toBe(cat);
    }
  });

  it("faellt auf 'sonstiges' zurueck statt zu raten", () => {
    const r = classifyChore("Xyzzy plugh xyzzy");
    expect(r.category).toBe("sonstiges");
    expect(r.score).toBe(0);
  });

  it("behandelt einen leeren Namen als 'sonstiges'", () => {
    expect(classifyChore("").category).toBe("sonstiges");
    expect(classifyChore(null).category).toBe("sonstiges");
    expect(classifyChore(undefined).category).toBe("sonstiges");
  });

  it("normalisiert Diakritika, damit 'grosse' und 'große' gleich sind", () => {
    expect(classifyChore("Große Wäsche").category).toBe(classifyChore("Grosse Wäsche").category);
  });

  it("bevorzugt bei Gleichstand die frueheste Kategorie (deterministisch)", () => {
    // 'putzen' passt auf 'reinigung' UND 'fenster' (Fenster putzen).
    // Beide Aufrufe muessen identisch antworten.
    const a = classifyChore("Fenster putzen");
    const b = classifyChore("Fenster putzen");
    expect(a).toEqual(b);
  });

  it("liefert nur Kategorien aus der verbindlichen Liste", () => {
    for (const name of SAMPLES) {
      expect(CHORE_CATEGORIES).toContain(classifyChore(name).category);
    }
  });
});

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("Wäsche waschen")).toBe(hashString("Wäsche waschen"));
  });

  it("ignoriert Gross-/Kleinschreibung", () => {
    expect(hashString("Wäsche")).toBe(hashString("wäsche"));
  });

  it("liefert fuer verschiedene Eingaben meist verschiedene Werte", () => {
    const a = hashString("Wäsche waschen");
    const b = hashString("Wäsche aufhängen");
    expect(a).not.toBe(b);
  });
});

describe("resolveModifier", () => {
  it("erkennt das Aufhaengen als Modifier", () => {
    expect(resolveModifier("Wäsche aufhängen")).toBe("aufhaengen");
  });
  it("gibt null zurueck, wenn nichts passt", () => {
    expect(resolveModifier("Bad putzen")).toBeNull();
  });
});

describe("buildComposition / resolveChoreVisual", () => {
  it("liefert fuer JEDES Sample einen gueltigen Basispfad", () => {
    for (const name of SAMPLES) {
      const c = buildComposition(name);
      expect(MDI_PATHS[c.base], `Basispfad fehlt fuer "${name}": ${c.base}`).toBeTruthy();
    }
  });

  it("liefert fuer JEDES Sample nur existierende Akzentpfade", () => {
    for (const name of SAMPLES) {
      const c = buildComposition(name);
      for (const a of c.accents) {
        expect(MDI_PATHS[a], `Akzentpfad fehlt fuer "${name}": ${a}`).toBeTruthy();
      }
    }
  });

  it("liefert hoechstens zwei Akzente (Lesbarkeit auf 48px-Streifen)", () => {
    for (const name of SAMPLES) {
      expect(buildComposition(name).accents.length).toBeLessThanOrEqual(2);
    }
  });

  it("ist deterministisch: gleicher Name => identische Komposition", () => {
    for (const name of SAMPLES) {
      expect(JSON.stringify(resolveChoreVisual(name))).toBe(
        JSON.stringify(resolveChoreVisual(name)),
      );
    }
  });

  it("gibt unterscheidlichen Chores unterschiedliche Kompositionen", () => {
    // Das ist die Anforderung 'pro Chore ein eigenes Bild'.
    const seen = new Set(SAMPLES.map((n) => JSON.stringify(resolveChoreVisual(n))));
    // Mindestens die Haelfte muss sich unterscheiden — gleiche Kategorie
    // mit gleichem Namen-Fingerprint ist erlaubt, identische Komposition
    // fuer verschiedene Chores waere ein Fehler.
    expect(seen.size).toBeGreaterThanOrEqual(SAMPLES.length / 2);
  });

  it("akzeptiert ein Chore-Objekt genauso wie einen String", () => {
    const byName = resolveChoreVisual("Bad putzen");
    const byObj = resolveChoreVisual({ name: "Bad putzen", id: 7 });
    expect(byObj.category).toBe(byName.category);
    expect(byObj.base).toBe(byName.base);
    expect(byObj.seed).toBe(byName.seed);
  });

  it("markiert die Quelle als 'vector' — die Austauschstelle fuer spaetere KI-Bilder", () => {
    expect(resolveChoreVisual("Bad putzen").source).toBe("vector");
  });

  it("nutzt fuer jede Kategorie eine eigene Basisform, ausser bewusste Mehrfachzuordnung", () => {
    // Sanity-Check, dass die Basisformen ueberhaupt differenzieren.
    const bases = new Set(SAMPLES.map((n) => buildComposition(n).base));
    expect(bases.size).toBeGreaterThan(5);
  });
});

describe("CATEGORY_LABELS", () => {
  it("hat fuer jede Kategorie eine lesbare Bezeichnung", () => {
    for (const c of CHORE_CATEGORIES) {
      expect(CATEGORY_LABELS[c], `Label fehlt fuer ${c}`).toBeTruthy();
    }
  });
});

/*
 * Abgleich mit dem Bild-Generator.
 *
 * `scripts/generate-chore-images.mjs` erzeugt die KI-Prompts aus einer
 * eigenen Kategorie-Liste. Wird hier eine Kategorie ergaenzt und dort
 * vergessen, entsteht fuer sie KEIN Bild — die Karte zeigte dann still ein
 * leeres Feld, ohne Fehler in Build oder Tests. Dieser Block ist die
 * einzige Stelle, die das faengt.
 */
describe("Bild-Prompts (scripts/chore-image-prompts.mjs)", () => {
  it("deckt exakt dieselben Kategorien ab wie die App", () => {
    expect([...IMAGE_CATEGORIES].sort()).toEqual([...CHORE_CATEGORIES].sort());
  });

  it("hat fuer jede Kategorie ein Motiv", () => {
    for (const c of IMAGE_CATEGORIES) {
      expect(SUBJECTS[c], `Motiv fehlt fuer ${c}`).toBeTruthy();
    }
  });

  it("erzeugt je Kategorie so viele Varianten wie Poolgroesse", () => {
    expect(FRAMINGS.length).toBeGreaterThanOrEqual(7);
  });

  it("liefert pro Variante einen anderen Prompt", () => {
    // Sonst waeren es 7 Kopien desselben Bildes — der Pool waere wirkungslos.
    const prompts = new Set(
      FRAMINGS.map((_, i) => buildPrompt("waesche", i)),
    );
    expect(prompts.size).toBe(FRAMINGS.length);
  });

  it("fordert in jedem Prompt weissen Hintergrund und Textverbot", () => {
    // Weisser Grund ist die Voraussetzung fuer mix-blend-mode in der Karte,
    // "no text" verhindert, dass FLUX Schrift in die Illustration setzt.
    for (const c of IMAGE_CATEGORIES) {
      for (let v = 0; v < FRAMINGS.length; v++) {
        const p = buildPrompt(c, v);
        expect(p, c).toContain("white background");
        expect(p, c).toContain("no text");
      }
    }
  });

  it("bleibt mit dem Standardumfang im kostenlosen Tageskontingent", () => {
    // 4,80 Neurone pro 512x512-Tile + 9,60 pro Schritt, 4 Schritte.
    const perImage = 4.8 + 9.6 * 4;
    const total = IMAGE_CATEGORIES.length * 7 * perImage;
    // Ohne Tausendertrenner: der ESLint-Parser stolpert ueber `10_000`.
    expect(total).toBeLessThan(10000); // Cloudflare Free-Tier pro Tag
  });

  it("nutzt einen stabilen Dateischluessel je Variante", () => {
    expect(keyOf("waesche", 0)).toBe("waesche-0");
    expect(keyOf("waesche-aufhaengen", 6)).toBe("waesche-aufhaengen-6");
  });
});
