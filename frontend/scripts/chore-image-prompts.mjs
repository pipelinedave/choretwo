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
 *
 * JEDES Motiv hat eine AUSDRUECKLICHE FARBE. Das ist keine Dekoration,
 * sondern die Voraussetzung fuer die Komposition:
 *
 * Die erste Ladung lief mit "a washing machine" und FLUX lieferte ein
 * weisses Geraet auf weissem Grund. Das ist ein informationstheoretisches
 * Problem, kein Renderfehler: Weiss mal Weiss ist Weiss, die Form geht
 * verloren. In der Komposition ueber `mix-blend-mode: multiply` war die
 * Waschmaschine deshalb unsichtbar — uebrig blieben nur Korb und
 * Klamotten, die Karte sah kaputt aus.
 *
 * Betroffen sind genau die Kategorien mit weissen Geraeten: Waschmaschine,
 * Spuelmaschine, Kuehlschrank, Toilette, Badewanne, Dusche, Geschirr. Also
 * traegt jedes Motiv eine mittlere, gesaettigte Farbe. Zwei Bedingungen:
 * nicht zu hell (sonst verschwindet es auf den Pastell-Karten) und nicht zu
 * dunkel (sonst ueberlagert es die Dringlichkeitsfarbe). Die Palette ist
 * bewusst begrenzt — Petroleum, Terrakotta, Senf, Pflaume, Navy, Rost,
 * Ockergelb — damit die 210 Bilder als Familie lesen.
 */
export const SUBJECTS = {
  bad: "a deep teal bathtub with a brass shower head and coral folded towels",
  dusche: "a slate blue shower cabin with sparkling water droplets and a yellow soap bar",
  toilette: "a dark green toilet with a mint toilet roll and a wooden brush",
  waesche:
    "a coral washing machine with a teal laundry basket full of colourful clothes",
  "waesche-aufhaengen":
    "a wooden clothes drying rack with mustard towels and blue shirts hanging on it",
  schrank:
    "an aubergine open wardrobe with clothes on hangers and teal storage boxes",
  schuhe: "rust red sneakers and navy boots with a wooden shoe brush",
  garderobe: "a brass coat rack with a plum jacket, teal shirt and navy trousers",
  kueche:
    "a sage green kitchen counter with a ceramic sink and a wooden cutting board",
  kochen: "a dark red cooking pot on a black stove with steam rising",
  geschirr: "a stack of teal plates, a brass fork and a navy glass",
  spuelmaschine: "a navy dishwasher with its door open and teal plates inside",
  kuehlschrank:
    "a dark teal refrigerator with its door open and colourful food inside",
  vorrat: "amber storage jars and green bottles on a wooden shelf",
  einkaufen: "a red shopping trolley and a brown paper grocery bag",
  abfall: "a dark grey waste bin with a yellow bin bag",
  recycling:
    "separated recycling bins in blue, green and yellow for paper, glass and packaging",
  reinigung: "a yellow spray bottle, a pink sponge and a blue cleaning cloth",
  staub: "a red vacuum cleaner with a grey dust cloud",
  boden: "a wooden broom and a teal bucket of water on the floor",
  fenster: "a blue window frame with a cloth and a yellow bucket to clean it",
  garten: "a garden with a deep green lawn, a brown hedge and red flowers",
  pflanzen: "a teal watering can pouring water onto terracotta potted plants",
  tier: "a golden dog and a dark grey cat sitting together with a red food bowl",
  handwerk: "an orange wrench and a blue screwdriver with brass screws",
  sport: "navy dumbbells and a teal bicycle leaning against a wall",
  musik: "a mahogany acoustic guitar with mustard headphones and a music note",
  buero: "a dark wood desk with a navy laptop, cream papers and a brass desk lamp",
  gast: "a table with teal plates, amber glasses and a striped party hat",
  sonstiges: "a teal clipboard with a checked task list and a yellow star",
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
 *
 * `bold saturated colours` widerspricht scheinbar der weissen
 * Motivfarb-Architektur oben, meint aber das richtige: die FLATTE Fläche
 * soll kraeftig sein. Zu muesste Grafik erzeugt FLUX gedeckte Töne, die
 * auf den Pastell-Karten zu verschwinden drohen. Das Weiss gilt fuer den
 * Hintergrund, nicht fuer das Motiv.
 */
export const STYLE =
  "flat vector illustration, minimal geometric shapes, bold saturated " +
  "colours, plain white background, no text, no letters, no shadow, no " +
  "border, no frame, clean modern app icon style, centered composition";

/** Dateiname ohne Extension — zugleich der Manifest-Schluessel. */
export const keyOf = (category, variant) => `${category}-${variant}`;

/** Baut den vollstaendigen Prompt fuer eine Konstellation. */
export function buildPrompt(category, variant) {
  const subject = SUBJECTS[category];
  if (!subject) throw new Error(`Kein Motiv fuer Kategorie "${category}"`);
  const framing = FRAMINGS[variant % FRAMINGS.length];
  return `${subject}, ${framing}, ${STYLE}`;
}
