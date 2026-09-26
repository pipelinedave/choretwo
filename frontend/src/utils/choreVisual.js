/**
 * Chore-Visuals: Kategorie-Erkennung und Kompositions-Logik.
 *
 * ZWECK
 * Jede Chore bekommt eine eigene kleine Vektor-Illustration, damit man auf
 * einen Blick sieht, WAS die Chore ist. Die Dringlichkeits-FARBE bleibt
 * davon unberuehrt (rot = ueberfaellig ... gruen = weit weg) — die Farbe
 * beantwortet "wie dringend", die Illustration "was".
 *
 * DESIGN-ENTSCHEIDUNGEN (bewusst so und nicht anders)
 *
 * 1. Deterministisch aus dem Namen, ohne Server.
 *    Es gibt kein category-Feld am Chore und es soll auch keins dazukommen.
 *    Gleicher Name => gleiches Bild, offline funktionsfaehig, keine
 *    Migration. Aendert der User den Namen, aendert sich das Bild — das ist
 *    gewuenscht, weil der Name die Chore definiert.
 *
 * 2. Keine LLM-Abhaengigkeit.
 *    Das Projekt hat Copilot-Intent-Parsing, aber das nur fuer
 *    mark_done/create_chore/update_chore/archive. Eine Kategorie-Erkennung
 *    auf dem Backend aufzubauen haette bedeutet: die Illustration haengt
 *    davon ab, ob ein LLM konfiguriert und erreichbar ist. Fuer ein
 *    dekoratives Element ist das die falsche Kopplung. Die Erkennung ist
 *    stattdessen deterministisch (Schluesselwort-Matching mit Gewichten)
 *    und laeuft immer.
 *
 * 3. Pro Chore EIGENES Bild, nicht nur pro Kategorie.
 *    Der User hat das explizit gewaehlt. Deshalb liefert
 *    `resolveChoreVisual()` nicht nur eine Kategorie, sondern eine
 *    vollstaendige Komposition: Basisform(en) aus der Kategorie, variiert
 *    ueber einen Seed aus dem Namen (Anzahl, Platzierung, Akzent, Zusatz-
 *    elemente). "Wäsche waschen" und "Wäsche aufhängen" teilen sich die
 *    Kategorie, sehen aber unterschiedlich aus.
 *
 * 4. Austauschbarkeit der Bildquelle.
 *    Spaeter kommen echte KI-Bilder (OpenRouter, gemini-2.5-flash-image,
 *    ~0,3 ct/Bild) statt der Vektoren. Der Einstiegspunkt dafuer ist
 *    `resolveChoreVisual()` — die Karten kennen nur dessen Rueckgabe, nie
 *    die MDI-Pfade. `source: 'vector'` im Rueckgabeobjekt sagt, woher das
 *    Bild kam; ein 'image'-Provider wuerde dieselbe Struktur liefern.
 *    ACHTUNG: Da die Zuordnung aus dem Namen kommt, muss ein spaeterer
 *    Bild-Generator identisch kategorisieren, sonst bekommen ahnliche
 *    Chores verschiedene Bilder. Die Kategorie-Liste unten ist deshalb die
 *    verbindliche Referenz.
 *
 * FORMGEOMETRIE
 * MDI-Pfade liegen im 24x24-Raster. Sie sind FUELL-Pfade, keine Outline-
 * Striche — `fill-rule: evenodd` liegt dem nicht zugrunde, Teile mit
 * "Z"-Luecken (z.B. ein Henkel) werden also gefuellt wie gezeichnet. Das ist
 * die Form, die MDI ausliefert, und sie ist konsistent.
 */

/** Die verbindliche Kategorie-Liste. Reihenfolge = Fallback-Prioritaet. */
export const CHORE_CATEGORIES = [
  "bad",
  "dusche",
  "toilette",
  "waesche",
  "waesche-aufhaengen",
  "schrank",
  "schuhe",
  "garderobe",
  "kueche",
  "kochen",
  "geschirr",
  "spuelmaschine",
  "kuehlschrank",
  "vorrat",
  "einkaufen",
  "abfall",
  "recycling",
  "reinigung",
  "staub",
  "boden",
  "fenster",
  "garten",
  "pflanzen",
  "tier",
  "handwerk",
  "sport",
  "musik",
  "buero",
  "gast",
  "sonstiges",
];

/**
 * Schluesselwort -> Kategorie. Reihenfolge hier ist NICHT bedeutsam, die
 * Treffergoenung entscheidet: die Kategorie mit dem hoechsten Score gewinnt,
 * bei Gleichstand die weiter oben stehende.
 *
 * Die Schluesselwoerter sind auf Deutsch UND Englisch, weil Copilot-Chores
 * in beiden Sprachen entstehen koennen (siehe llm_client.py, DEFAULT-Sprache
 * ist mehrsprachig).
 */
const KEYWORDS = {
  bad: [
    "bad",
    "baeder",
    "bader",
    "badreinigung",
    "waschtisch",
    "spiegel",
    "dusch",
  ],
  dusche: ["dusche", "duschen", "duschkabine", "shower"],
  toilette: ["toilette", "wc", "klo", "wc-sitz", "haustür", "haustuer"],
  waesche: [
    "wäsche",
    "waesche",
    "waschen",
    "wäscheleine",
    "maschine",
    "trommel",
    "wäsche waschen",
    "bügeln",
    "buegeln",
    "mangel",
    "laundry",
    "wash",
  ],
  "waesche-aufhaengen": [
    "aufhängen",
    "aufhaengen",
    "wäscheständer",
    "waeschestaender",
    "ständer",
    "staender",
    "wäscheklammer",
    "klammern",
    "trocknen",
    "tumble",
  ],
  schrank: [
    "schrank",
    "schränke",
    "schraenke",
    "kleiderschrank",
    "kommode",
    "ausräumen",
    "ausraeumen",
    "sortieren",
    "schublade",
    "closet",
  ],
  schuhe: [
    "schuhe",
    "schuh",
    "stiefel",
    "sandalen",
    "putz",
    "schnürsenkel",
    "schnuerensenkel",
  ],
  garderobe: [
    "garderobe",
    "kleidung",
    "bügel",
    "buegel",
    "mantel",
    "jacke",
    "hose",
    "shirt",
    "tshirt",
    "kleider",
  ],
  kueche: [
    "küche",
    "kueche",
    "küchen",
    "arbeitsplatte",
    "spüle",
    "spuele",
    "kitchen",
    "counter",
  ],
  kochen: [
    "kochen",
    "koch",
    "essen",
    "zubereiten",
    "backen",
    "braten",
    "aufsetzen",
    "kochstellen",
  ],
  geschirr: [
    "geschirr",
    "spülen",
    "spuelen",
    "abwasch",
    "besteck",
    "teller",
    "gläser",
    "glaeser",
    "dishes",
  ],
  spuelmaschine: ["spülmaschine", "spuelmaschine", "dishwasher"],
  kuehlschrank: [
    "kühlschrank",
    "kuehlschrank",
    "kühl",
    "kuehl",
    "einfrieren",
    "gefrier",
    "fridge",
    "tiefkühl",
    "tiefkuehl",
  ],
  vorrat: [
    "vorrat",
    "vorräte",
    "vorraete",
    "schrankhaltbar",
    "haltbar",
    "kühlfach",
  ],
  einkaufen: [
    "einkaufen",
    "einkauf",
    "kaufen",
    "holen",
    "besorgen",
    "supermarkt",
    "markt",
    "liste",
    "shopping",
    "groceries",
  ],
  abfall: [
    "müll",
    "muell",
    "abfall",
    "tonne",
    "restmüll",
    "restmuell",
    "papier",
    "gelbe",
    "trash",
    "waste",
  ],
  recycling: [
    "recycling",
    "recyceln",
    "trennung",
    "mülltrennung",
    "muelltrennung",
    "glas",
    "dosen",
    "verpackung",
  ],
  reinigung: [
    "putzen",
    "reinigen",
    "putzmittel",
    "wischen",
    "wisch",
    "säubern",
    "saeubern",
    "shampoo",
    "duschgel",
    "seife",
  ],
  staub: [
    "staub",
    "staubsaugen",
    "staubwischen",
    "entstauben",
    "spinnweben",
    "dust",
  ],
  boden: [
    "boden",
    "parkett",
    "fliesen",
    "laminate",
    "dielen",
    "polieren",
    "wischen",
  ],
  fenster: [
    "fenster",
    "scheibe",
    "scheiben",
    "glas",
    "jalousie",
    "rollladen",
    "window",
    "spiegel",
  ],
  garten: [
    "garten",
    "rasen",
    "hecke",
    "beet",
    "beete",
    "erde",
    "umgrab",
    "compost",
    "yard",
    "garden",
  ],
  pflanzen: [
    "pflanze",
    "pflanzen",
    "gießen",
    "giessen",
    "topf",
    "tanne",
    "baum",
    "kraut",
    "blume",
    "blumen",
    "water",
    "plant",
  ],
  tier: [
    "hund",
    "katze",
    "tier",
    "haustier",
    "futter",
    "kennel",
    "dog",
    "cat",
    "pet",
  ],
  handwerk: [
    "schraube",
    "schrauben",
    "werkzeug",
    "reparatur",
    "hamm",
    "bohren",
    "montage",
    "hängen",
    "haengen",
    "kleb",
    "dichtung",
    "brenner",
  ],
  sport: [
    "sport",
    "fahrrad",
    "rad",
    "training",
    "workout",
    "yoga",
    "gym",
    "schwimmen",
    "laufen",
    "bike",
    "fitness",
    "dumbbell",
  ],
  musik: [
    "musik",
    "gitarre",
    "klavier",
    "instrument",
    "note",
    "guitar",
    "vinyl",
  ],
  buero: [
    "büro",
    "buero",
    "schreibtisch",
    "laptop",
    "ordner",
    "rechnung",
    "unterlagen",
    "akten",
    "dokument",
    "desktop",
    "office",
    "lampe",
  ],
  gast: [
    "gast",
    "gäste",
    "gaeste",
    "besuch",
    "party",
    "feier",
    "tisch decken",
    "servietten",
    "feucht",
  ],
  sonstiges: [""],
};

/**
 * Zusatzformen, die eine Kategorie verfeinern, ohne sie zu wechseln.
 * Reihenfolge zaehlt: der erste passende Zusatz gewinnt.
 */
const MODIFIERS = [
  { id: "klein", keywords: ["klein", "quick", "schnell", "5 min", "5min"] },
  {
    id: "gross",
    keywords: ["groß", "gross", "große", "grosse", "tief", "grundreinigung"],
  },
  { id: "abnehmen", keywords: ["abnehmen", "einsammeln", "abholen"] },
  {
    id: "aufhaengen",
    keywords: [
      "aufhängen",
      "aufhaengen",
      "hängen",
      "haengen",
      "ständer",
      "staender",
    ],
  },
  { id: "einkaufen", keywords: ["einkaufen", "einkauf", "liste"] },
  { id: "abwasch", keywords: ["abwasch", "spülen", "spuelen", "abspülen"] },
  { id: "giessen", keywords: ["gießen", "giessen", "wasser"] },
];

/**
 * Gewichtung.
 *
 * NAIVE GEWICHTSFUNKTIONEN SCHEITERN: mit einem konstanten Score je Treffer
 * gewinnt bei "Bad putzen" die Kategorie 'reinigung' (Treffer auf "putzen")
 * gegen 'bad' (Treffer auf "bad") — die generische Taetigkeit sammelt mehr
 * Punkte als der spezifische Ort. Das war ein echter Testbefund, kein
 * Theorieproblem.
 *
 * Deshalb zwei Korrekturen:
 *
 * 1. SPEZIFITAET: Laengere Keyword-Begriffe wiegen schwerer als kurze.
 *    "arbeitsplatte" (12) schlaegt "spuele" (6) schlaegt "bad" (3). Das
 *    belohnt aussagekraeftige Begriffe statt generischer Verben.
 *
 * 2. POSITION: Ein Treffer am Wortanfang wiegt mehr als einer irgendwo im
 *    Satz. Nutzer schreiben das Objekt zuerst ("Bad putzen", "Wäsche
 *    waschen"), das ist die staerkste Absichtsaeußerung im kurzen Chore-Namen.
 */
const SCORE_BASE = 10;
const SCORE_WORD = 4; // Teiltreffer auf Substring-Ebene

/** Laengenfaktor: 3 Zeichen = 1.0, je weiter Zeichen +0.12, gedeckelt bei 2.2. */
function specificity(keyword) {
  return Math.min(2.2, 1 + Math.max(0, keyword.length - 3) * 0.12);
}

/**
 * Deterministischer 32-Bit-Stringhash (FNV-1a). Kein Math.random, damit
 * gleiche Eingaben immer dasselbe Bild ergeben — auch nach einem Reload und
 * auch fuer zwei Nutzer, die dieselbe Chore anlegen.
 */
export function hashString(input) {
  let h = 0x811c9dc5;
  const s = String(input || "").toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Normalisiert einen Chore-Namen fuer das Matching (klein, ohne Diakritika). */
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
}

/**
 * Bewertet alle Kategorien gegen einen (normalisierten) Namen und gibt die
 * beste zurueck. Exportiert fuer die Tests.
 *
 * @returns {{ category: string, score: number, matched: string[] }}
 */
export function classifyChore(rawName) {
  const name = normalize(rawName);
  if (!name) return { category: "sonstiges", score: 0, matched: [] };

  let best = { category: "sonstiges", score: 0, matched: [] };

  for (const category of CHORE_CATEGORIES) {
    const keywords = KEYWORDS[category] || [];
    let score = 0;
    const matched = [];
    for (const kw of keywords) {
      if (!kw) continue;
      const spec = specificity(kw);
      if (name === kw) {
        score += SCORE_BASE * 2 * spec; // exakter Name-Treffer wiegt schwer
        matched.push(kw);
      } else if (name.startsWith(kw)) {
        // Wortanfang: das Objekt wird zuerst genannt ("Bad putzen").
        score += SCORE_BASE * 1.5 * spec;
        matched.push(kw);
      } else if (name.includes(` ${kw}`) || name.includes(`-${kw}`)) {
        // Als eigenes Wort irgendwo im Satz.
        score += SCORE_BASE * spec;
        matched.push(kw);
      } else if (name.includes(kw)) {
        // Substring ohne Wortgrenze.
        score += SCORE_BASE * 0.5 * spec;
        matched.push(kw);
      }
    }

    /*
     * Praefix-Fallback als LETZTER Schritt und nur bei bisher Null Treffern.
     *
     * Zweck: "Waesch waschen" (Tippfehler) soll noch als Waesche gelten.
     * Er darf aber KEINEN zusaetzlichen Score liefern — als Scorer erzeugte
     * er Fehl-Positive: bei "Bad putzen" traf der Praefix von "putzmittel"
     * auf das Wort "putzen" und die generische Kategorie 'reinigung'
     * sammelte 2 Treffer, insgesamt mehr als 'bad'. Der Fallback ist damit
     * ausschliesslich "kein besserer Treffer gefunden".
     */
    if (score === 0) {
      for (const kw of keywords) {
        if (
          kw &&
          kw.length >= 5 &&
          name.split(/\s+/).some((w) => w.startsWith(kw.slice(0, 4)))
        ) {
          score += SCORE_WORD * specificity(kw);
          matched.push(kw);
          break;
        }
      }
    }
    // Gleichstand: die weiter oben in CHORE_CATEGORIES stehende gewinnt,
    // weil wir nur bei `score > best.score` ersetzen.
    if (score > best.score) best = { category, score, matched };
  }

  return best;
}

/** Ermittelt den Zusatz (Modifier) fuer einen Namen. */
export function resolveModifier(rawName) {
  const name = normalize(rawName);
  for (const mod of MODIFIERS) {
    if (mod.keywords.some((kw) => name.includes(kw))) return mod.id;
  }
  return null;
}

// --- Kompositions-Bau ---------------------------------------------------
//
// Die Komposition ist bewusst klein gehalten: sie besteht aus EINEM
// Basispfad (in 24x24-Raster, meist direkt MDI) und bis zu ZWEI
// Zusaetzlichen, kleineren Pfaden. Mehr davon ist auf einer 48px-Card nicht
// mehr lesbar — das ist die harte Grenze, an der "schoener" zu "unlesbar"
// kippt.

/** Basisform je Kategorie. Wert: MDI-Key oder eigener 24x24-Pfad. */
const BASE_SHAPES = {
  bad: "bathtub-outline",
  dusche: "shower",
  toilette: "toilet",
  waesche: "washing-machine",
  "waesche-aufhaengen": "hanger",
  schrank: "wardrobe-outline",
  schuhe: "shoe-sneaker",
  garderobe: "tshirt-crew-outline",
  kueche: "countertop",
  kochen: "stove",
  geschirr: "silverware-fork-knife",
  spuelmaschine: "dishwasher",
  kuehlschrank: "fridge-outline",
  vorrat: "bottle-tonic-outline",
  einkaufen: "cart-outline",
  abfall: "trash-can-outline",
  recycling: "recycle",
  reinigung: "spray-bottle",
  staub: "vacuum",
  boden: "broom",
  fenster: "window-closed",
  garten: "tree-outline",
  pflanzen: "watering-can-outline",
  tier: "paw",
  handwerk: "pipe-wrench",
  sport: "dumbbell",
  musik: "guitar-electric",
  buero: "laptop",
  gast: "party-popper",
  sonstiges: "clipboard-check-outline",
};

/** Zusaetzliche Formen, die eine Kategorie "spezifischer" machen. */
const ACCENT_SHAPES = {
  bad: ["toothbrush-paste", "spray-bottle"],
  dusche: ["water-pump", "bubble" /* ersetzt unten, s. resolveShape */],
  toilette: ["water-pump"],
  waesche: ["tumble-dryer", "bottle-tonic-outline"],
  "waesche-aufhaengen": ["broom", "hanger"],
  schrank: ["hanger", "tshirt-crew-outline"],
  schuhe: ["shoe-formal", "brush-outline"],
  garderobe: ["hanger", "iron-outline"],
  kueche: ["silverware-fork-knife", "cup"],
  kochen: ["pan", "pot-steam"],
  geschirr: ["cup", "bottle-tonic-outline"],
  spuelmaschine: ["silverware-fork-knife"],
  kuehlschrank: ["food-apple-outline", "bottle-tonic-outline"],
  vorrat: ["basket-outline", "cart-outline"],
  einkaufen: ["basket", "list" /* ersetzt unten */],
  abfall: ["recycle", "package-variant"],
  recycling: ["package-variant", "glass-wine"],
  reinigung: ["brush-outline", "bucket-outline"],
  staub: ["broom", "curtains"],
  boden: ["vacuum", "bucket-outline"],
  fenster: ["curtains", "lightbulb"],
  garten: ["sprout", "flower-tulip-outline"],
  pflanzen: ["sprout", "leaf"],
  tier: ["cat", "dog"],
  handwerk: ["screwdriver", "nail" /* ersetzt unten */],
  sport: ["bike", "yoga"],
  musik: ["music-note" /* ersetzt unten */, "headphones" /* ersetzt unten */],
  buero: ["bookshelf", "lightbulb"],
  gast: ["gift-outline", "silverware-variant"],
  sonstiges: ["star-outline", "check-circle-outline"],
};

/** Korrekturen fuer Formen, die es in diesem Icon-Set nicht gibt. */
const SHAPE_FALLBACKS = {
  bubble: "droplet",
  pan: "silverware-variant",
  "pot-steam": "cup",
  list: "clipboard-check-outline",
  nail: "screwdriver",
  "music-note": "guitar-electric",
  headphones: "cellphone",
  droplet: "water-pump",
};

/** Loest einen Shape-Key auf einen existierenden MDI-Key auf. */
function resolveShape(key) {
  if (!key) return null;
  if (SHAPE_FALLBACKS[key]) return SHAPE_FALLBACKS[key];
  return key;
}

/**
 * Baut die Komposition aus Name + Kategorie + Modifier.
 *
 * @param {string} name - Chore-Name
 * @param {object} [opts]
 * @param {number} [opts.variant] - Anzahl Akzentformen (0-2).
 * @returns {object} Kompositionsbeschreibung fuer ChoreVisual.vue
 */
export function buildComposition(name, opts = {}) {
  const { category, score, matched } = classifyChore(name);
  const modifier = resolveModifier(name);
  const seed = hashString(`${category}|${normalize(name)}`);

  const base = resolveShape(BASE_SHAPES[category]) || BASE_SHAPES.sonstiges;
  const accents = (ACCENT_SHAPES[category] || [])
    .map(resolveShape)
    .filter(Boolean);

  // Der Seed entscheidet, wie viele Akzente und welche. Damit bekommen
  // aehnlich benannte Chores sichtbar unterschiedliche Bilder, ohne dass
  // zwei Chores mit gleichem Namen unterschiedlich aussehen.
  const wanted = opts.variant != null ? opts.variant : seed % 3; // 0, 1 oder 2
  const chosen = [];
  const start = (seed >>> 3) % Math.max(1, accents.length);
  for (let i = 0; i < wanted && chosen.length < accents.length; i++) {
    const idx = (start + i) % accents.length;
    if (!chosen.includes(accents[idx])) chosen.push(accents[idx]);
  }

  // Feinjustierung der Platzierung aus den mittleren Seed-Bits. Bei 48px
  // Hoehe sind das Nuancen, aber genau sie verhindern, dass zwei Karten
  // wie Kopien wirken.
  return {
    base,
    accents: chosen,
    seed,
    // 0..1 Positionen fuer die Akzente
    offsets: chosen.map((_, i) => ({
      x: 0.62 + (((seed >>> (5 + i * 3)) & 0x3) / 3) * 0.22,
      y: 0.58 + (((seed >>> (8 + i * 3)) & 0x3) / 3) * 0.2,
      scale: 0.42 + (((seed >>> (11 + i * 3)) & 0x1) / 1) * 0.1,
    })),
    modifier,
    category,
    categoryScore: score,
    matched,
  };
}

/**
 * OEFFENTLICHE SCHNITTSTELLE.
 *
 * Das ist der einzige Einstiegspunkt, den die Karten kennen. Ein spaeterer
 * KI-Bild-Provider (OpenRouter / gemini-2.5-flash-image) implementiert
 * dieselbe Signatur und liefert `source: 'image'` plus eine Bild-URL statt
 * der Pfade — die Karten muessen dafuer nicht angefasst werden.
 *
 * @param {string|object} chore - Name oder Chore-Objekt
 * @returns {{
 *   source: 'vector', category: string, modifier: string|null,
 *   base: string, accents: string[], offsets: object[], seed: number,
 *   label: string
 * }}
 */
export function resolveChoreVisual(chore) {
  const name = typeof chore === "string" ? chore : chore?.name || "";
  const comp = buildComposition(name);
  return {
    source: "vector",
    ...comp,
    label: name,
  };
}

/** Lesbare Kategorie-Bezeichnung (fuer aria-label und Tooltips). */
export const CATEGORY_LABELS = {
  bad: "Bad",
  dusche: "Dusche",
  toilette: "Toilette",
  waesche: "Wäsche",
  "waesche-aufhaengen": "Wäsche aufhängen",
  schrank: "Schrank",
  schuhe: "Schuhe",
  garderobe: "Garderobe",
  kueche: "Küche",
  kochen: "Kochen",
  geschirr: "Geschirr",
  spuelmaschine: "Spülmaschine",
  kuehlschrank: "Kühlschrank",
  vorrat: "Vorräte",
  einkaufen: "Einkaufen",
  abfall: "Abfall",
  recycling: "Recycling",
  reinigung: "Reinigung",
  staub: "Staub",
  boden: "Boden",
  fenster: "Fenster",
  garten: "Garten",
  pflanzen: "Pflanzen",
  tier: "Haustier",
  handwerk: "Handwerk",
  sport: "Sport",
  musik: "Musik",
  buero: "Büro",
  gast: "Gäste",
  sonstiges: "Hausarbeit",
};

/** MDI-Pfade, damit ChoreVisual.vue die Icon-Daten bekommt. */
export { MDI_PATHS } from "@/assets/icons/mdi-paths.generated.js";
