/**
 * Prompt-Definitionen fuer die KI-Illustrationen der ChoreCards.
 *
 * WARUM EIN EIGENES MODUL
 * Das Generator-Script laeuft als `node scripts/…` und ist damit fuer Vitest
 * nicht importierbar (es fuehrt beim Import `main()` aus). Die Definitionen
 * stehen hier, damit zwei Dinge sie importieren koennen:
 *
 *   1. scripts/generate-chore-images.mjs  — erzeugt die Bilder
 *   2. tests/unit/utils/choreVisual.spec.js — prueft, dass CATEGORIES
 *      exakt CHORE_CATEGORIES entspricht
 *
 * Ohne diesen Abgleich koennte eine Kategorie in der App entstehen, fuer die
 * kein Bild existiert — die Karte zeigte dann still ein leeres Feld. Genau
 * das verhindert der Test.
 */

/**
 * Muss identisch sein zu `CHORE_CATEGORIES` in src/utils/choreVisual.js.
 * Reihenfolge irrelevant fuer die Generierung, Vollstaendigkeit nicht.
 */
export const CATEGORIES = [
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
 * Motiv je Kategorie, auf Englisch. FLUX ist auf englische Prompts deutlich
 * besser eingestellt; die Promptkette ist invariant, nur das SUbjekt
 * variiert — sonst fallen die 210 Bilder auseinander.
 */
export const SUBJECTS = {
  bad: "a bathtub with a shower head and folded towels",
  dusche: "a shower with water droplets and soap",
  toilette: "a toilet with a toilet roll and brush",
  waesche: "a washing machine with a laundry basket full of clothes",
  "waesche-aufhaengen":
    "a clothes drying rack with towels and shirts hanging on it",
  schrank: "an open wardrobe with clothes on hangers and storage boxes",
  schuhe: "a pair of sneakers and boots with a shoe brush",
  garderobe: "a coat rack with a jacket, shirt and trousers",
  kueche: "a kitchen counter with a sink and cutting board",
  kochen: "a cooking pot on a stove with steam rising",
  geschirr: "a stack of plates, a fork and a glass",
  spuelmaschine: "an open dishwasher with clean plates inside",
  kuehlschrank: "a refrigerator with its door open and food inside",
  vorrat: "storage jars and bottles on a shelf",
  einkaufen: "a shopping trolley and a grocery bag",
  abfall: "a waste bin with a bin bag and trash",
  recycling: "separated recycling bins for paper, glass and packaging",
  reinigung: "a spray bottle, a sponge and a cleaning cloth",
  staub: "a vacuum cleaner with a dust cloud",
  boden: "a broom and a bucket of water on the floor",
  fenster: "a window with a cloth and a bucket to clean it",
  garten: "a garden with a lawn, a hedge and a flower bed",
  pflanzen: "a watering can pouring water onto potted plants",
  tier: "a dog and a cat sitting together with a food bowl",
  handwerk: "a wrench and a screwdriver with screws",
  sport: "dumbbells and a bicycle leaning against a wall",
  musik: "an acoustic guitar with headphones and a music note",
  buero: "a desk with a laptop, papers and a desk lamp",
  gast: "a laid table with plates, glasses and a party hat",
  sonstiges: "a clipboard with a checked task list and a star",
};

/**
 * Kompositions-Varianten. Der eigentliche Trick, damit sich die Varianten
 * einer Kategorie wirklich unterscheiden: nicht das Motiv variiert, sondern
 * Perspektive und Ausschnitt.
 */
export const FRAMINGS = [
  "centered close-up, filling the frame",
  "wide shot, the whole scene visible, small in the frame",
  "top-down flat lay view from directly above",
  "three-quarter angled view",
  "simple icon-like view, very minimal, single centered object",
  "side view, low camera angle",
  "over-the-shoulder view, slightly from behind",
];

/**
 * Stil-Suffix, damit die Menge als Familie erkennbar bleibt.
 *
 * `white background` ist Absicht, kein Zufall: die ChoreCards sind farbig,
 * und nur auf weissem Grund laesst sich das Motiv per `mix-blend-mode:
 * multiply` in die Kartenfarbe einrechnen. Ein farbiger Hintergrund wuerde
 * einen harten Kasten in der Karte erzeugen.
 */
export const STYLE =
  "flat vector illustration, minimal geometric shapes, single soft muted " +
  "colour, white background, no text, no letters, no shadow, no border, " +
  "no frame, clean modern app icon style, centered composition";

/** Dateiname ohne Extension — zugleich der Manifest-Schluessel. */
export const keyOf = (category, variant) => `${category}-${variant}`;

/** Baut den vollstaendigen Prompt fuer eine Konstellation. */
export function buildPrompt(category, variant) {
  const subject = SUBJECTS[category];
  if (!subject) throw new Error(`Kein Motiv fuer Kategorie "${category}"`);
  const framing = FRAMINGS[variant % FRAMINGS.length];
  return `${subject}, ${framing}, ${STYLE}`;
}
