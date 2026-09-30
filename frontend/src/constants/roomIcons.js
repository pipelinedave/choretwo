/**
 * Raum-Icons und Farb-Palette.
 *
 * DIESE LISTE IST EIN SPIEGEL des Backends.
 * Quelle der Wahrheit: `services/chore-service/app/schemas.py`
 * -> `ALLOWED_ROOM_ICONS`. Das Backend validiert gegen eine Allowlist und
 * weist alles andere mit 422 ab. Stimmen die beiden Listen nicht
 * ueberein, kann der User im Picker ein Icon waehlen, das das Backend
 * beim Speichern zurueckweist — mit einer Fehlermeldung, die nicht
 * erklaert, worum es geht.
 *
 * Ein Test haelt die Synchronitaet fest:
 * `tests/unit/utils/roomIcons.spec.js` liest die Python-Datei und
 * vergleicht. Laeuft der Test nicht mit, ist es trotzdem ein Feature
 * hier zu aendern — die Reihenfolge ist irrelevant, der Inhalt nicht.
 *
 * `icon` ist der MDI-Klassenname OHNE "mdi-"-Praefix; gerendert wird
 * `<span class="mdi mdi-<icon>">`. `@mdi/font` ist eine Abhaengigkeit
 * und global in main.js importiert, die Webfont steht also zur
 * Verfuegung.
 *
 * ACHTUNG: `src/assets/icons/mdi-paths.generated.js` ist damit NICHT
 * gemeint. Das sind die Vektor-Konturen fuer die Chore-Illustrationen,
 * generiert aus `@mdi/font` — eine andere Aufgabe, andere Datei.
 */

export const ROOM_ICONS = [
  // Kueche / Essen
  "silverware-fork-knife",
  "coffee",
  "bottle-tonic-outline",
  // Bad
  "shower",
  "bathtub-outline",
  "toilet",
  // Schlafen / Wohnen
  "bed",
  "bed-double-outline",
  "sofa",
  "bookshelf",
  // Flur / Allgemein
  "stairs",
  "home",
  "door",
  // Haushalt
  "washing-machine",
  "broom",
  "basket-outline",
  "tshirt-crew",
  // Aussen
  "garage",
  "car",
  "flower",
  "carrot",
  // Persoenlich
  "account",
  "arm-flex",
  "dog",
];

/**
 * Vorschlaege fuer den Farbw ae hler.
 *
 * Die Werte sind bewusst aus der Pastellfamilie der
 * Dringlichkeitsfarben geschnitten (`--color-due-*` in variables.css):
 * so sieht der Raum-Chip wie ein Teil derselben Oberflaeche aus und
 * nicht wie ein fremdes Bauteil. Wer einen eigenen Raum anlegt, kann
 * trotzdem einen beliebigen Hex-Wert setzen — das Backend erlaubt es.
 */
export const ROOM_COLOR_PRESETS = [
  { name: "Salbei", value: "#c6e7dc" },
  { name: "Petersilie", value: "#d3ead8" },
  { name: "Oliv", value: "#e2e6d2" },
  { name: "Sand", value: "#eee7c9" },
  { name: "Hafer", value: "#f2ddba" },
  { name: "Terrakotta", value: "#f6c7ae" },
  { name: "Taube", value: "#b7e1d7" },
  { name: "Kaffee", value: "#8d6e63" },
];

export const DEFAULT_ROOM_COLOR = "#c6e7dc";
export const DEFAULT_ROOM_ICON = "home";
