/**
 * Aktionssemantik des Activity-Logs — EINE Quelle fuer BEIDE
 * Log-Oberflaechen.
 *
 * Warum eine eigene Datei: es gibt zwei Komponenten, die dieselben
 * Log-Aktionen anzeigen — `LogItem.vue` (Route /logs) und
 * `LogOverlay.vue` (Bottom-Sheet auf Home). Beide hatten eigene
 * `if (action.includes(...))`-Ketten, und die sind bereits auseinander
 * gelaufen. Zwei Befunde aus dieser Zeit, die der Grund fuer die
 * Zusammenfuehrung sind:
 *
 *   1. `LogItem` pruefte `archived` VOR `unarchived`. "chore:unarchived"
 *      enthaelt "archived", also war `.log-unarchived` toter Code und
 *      jede Restoring-Aktion wurde als "archived" beschriftet UND
 *      eingefaerbt. Hier ist die Reihenfolge deshalb bindend:
 *      `unarchived` steht VOR `archived`.
 *   2. `LogItem` kannte `marked_done` nicht. Das ist aber genau der
 *      Wert, den der Log-Store fuer "erledigt" setzt (log.js,
 *      `getActionDescription`), also blieb die haeufigste Aktion der
 *      App ohne Code und ohne Icon.
 *
 * Dazu ein toter Icon-Name: `mdi-archive-open` existiert in der
 * eingebundenen @mdi/font-Version nicht und wurde als leeres Glyph
 * gerendert. Ersatz ist `mdi-archive-arrow-up` (dieselbe Icon-Familie,
 * "aus dem Archiv heraus"), in dieser Datei verifiziert.
 *
 * Die Liste ist absichtlich eine Liste und keine Kette aus ifs: die
 * Reihenfolge IST die Semantik, und eine Liste macht die
 * Reihenfolge-Abhaengigkeit sichtbar statt sie in der Tiefe zu
 * verstecken.
 */

const CODES = [
  {
    id: "completed",
    icon: "mdi-check-circle",
    // `marked_done` ist der Wert, den der Store fuer "erledigt" setzt.
    match: (a) => a.includes("completed") || a.includes("marked_done"),
  },
  {
    id: "created",
    icon: "mdi-plus-circle",
    match: (a) => a.includes("created"),
  },
  {
    id: "updated",
    icon: "mdi-pencil-circle",
    match: (a) => a.includes("updated"),
  },
  // VOR `archived` — "unarchived" enthaelt "archived".
  {
    id: "unarchived",
    icon: "mdi-archive-arrow-up",
    // `restored` ist die Beschreibung, die der Store fuer
    // "chore:unarchived" ausgibt; `undone` faellt in `undone` weiter unten.
    match: (a) => a.includes("unarchived") || a.includes("restored"),
  },
  { id: "archived", icon: "mdi-archive", match: (a) => a.includes("archived") },
  { id: "deleted", icon: "mdi-delete", match: (a) => a.includes("deleted") },
  { id: "undone", icon: "mdi-undo", match: (a) => a.includes("undo") },
  // Import/Export bekommen bewusst KEINE eigene Farbe (sie teilen sich
  // den neutralen Fallback): sie sind Systemaktionen ohne Bezug zu einem
  // Chore, und fuer sie gibt es in der Palette keine freie semantische
  // Achse. Das Icon unterscheidet sie trotzdem.
  { id: "imported", icon: "mdi-import", match: (a) => a.includes("import") },
  { id: "exported", icon: "mdi-download", match: (a) => a.includes("export") },
];

const FALLBACK = { id: "activity", icon: "mdi-history" };

/** Die Klassen-Namen beider Komponenten sind bewusst gleich — das ist
 *  der Punkt der Zusammenfuehrung. */
const cls = (id) => `log-${id}`;

/**
 * @param {string|null|undefined} action roher Aktionsstring aus dem Log-Store
 * @returns {{id: string, cls: string, icon: string}}
 */
export function resolveLogAction(action) {
  const a = String(action ?? "").toLowerCase();
  const hit = CODES.find((c) => c.match(a));
  if (!hit) return { ...FALLBACK, cls: cls(FALLBACK.id) };
  return { id: hit.id, cls: cls(hit.id), icon: hit.icon };
}

/** CSS-Klasse des Aktionstyps (`.log-completed`, `.log-created`, …). */
export function logActionClass(action) {
  return resolveLogAction(action).cls;
}

/** MDI-Icon des Aktionstyps. */
export function logActionIcon(action) {
  return resolveLogAction(action).icon;
}

/**
 * Verb-Beschreibung fuer die Textdarstellung.
 *
 * Reihenfolge ist dieselbe wie oben und aus demselben Grund bindend.
 * Bewusst NICHT in `resolveLogAction` enthalten: der Farbcode ist eine
 * Eigenschaft der Aktion, der Satz eine des Lesers — die beiden sollen
 * sich nicht gegenseitig festlegen. Wer eine Aktion ergaenzt, muss
 * darum in beiden Listen nachsehen, was `resolveLogAction` in `CODES`
 * aufnimmt.
 */
export function logActionText(action) {
  const a = String(action ?? "").toLowerCase();
  if (a.includes("completed") || a.includes("marked_done")) return "completed";
  if (a.includes("created")) return "created";
  if (a.includes("updated")) return "updated";
  if (a.includes("unarchived") || a.includes("restored")) return "unarchived";
  if (a.includes("archived")) return "archived";
  if (a.includes("deleted")) return "deleted";
  if (a.includes("undo")) return "undid";
  return "did something to";
}

/** Die Aktionstypen, fuer die es eine eigene Farbe gibt. */
export const LOG_ACTION_IDS = CODES.map((c) => c.id);
