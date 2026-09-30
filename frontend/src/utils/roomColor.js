/**
 * Lesbare Schriftfarbe fuer einen Raum-Chip.
 *
 * WARUM DAS IN JS PASSIERT UND NICHT UEBR EIN CSS-TOKEN
 * ------------------------------------------------------
 * Die Raumfarbe kommt aus der Datenbank, ist also zur Compile-Zeit
 * unbekannt. Der Chip muss sie trotzdem in Light UND Dark Mode
 * lesbar machen.
 *
 * Der naheliegende Weg waere eine eigene Dark-Variante je Raum — also
 * Tokens wie `--room-kueche` in `variables.css`. Das waere die falsche
 * Richtung aus zwei Gruenden:
 *
 *  1. Es gibt beliebig viele Raume, jedes mit eigenem Hex-Wert. Tokens
 *     koennen die nicht abdecken; der User kann jeden Hex setzen.
 *  2. Der Chip ist ein geschlossenes Objekt: eine pastellfarbene
 *     Flaeche mit dunkler Schrift liest sich in BEIDEN Themes richtig,
 *     unabhaengig davon, was hinter ihm steht. Er braucht also gar
 *     keine Dark-Variante — die Schriftfarbe folgt der Flaeche.
 *
 * Deshalb wird die Tinte aus der Flaeche BERECHNET (WCAG-Relativ-
 * Luminanz) und als Inline-Style gesetzt. Konsequenz fuer den
 * Design-Token-Test: in Komponenten darf fuer die Raumfarbe KEINE
 * CSS-Custom-Property referenziert werden — es gibt keine solche in
 * `:root`, und `tests/unit/styles/design-tokens.spec.js` wuerde genau
 * das als "unbekanntes Token" failen. Nur die statische Chip-Chrome
 * (Radius, Rand, Schriftgroesse, Abstand) liegt in `variables.css`.
 */

import { DEFAULT_ROOM_COLOR } from "@/constants/roomIcons";

/**
 * Die TINTE des Chips, also der Wert, den `readableInk` auf einer hellen
 * Flaeche liefert. Ein leicht getoentes Tiefgruen statt Schwarz, passend
 * zur Aqua-Palette der App.
 */
export const ROOM_DEEP_INK = "#0b1f1d";

/**
 * Der ANKER der Raum-Kontur.
 *
 * Bewusst Schwarz und NICHT `ROOM_DEEP_INK`, obwohl beide "dunkel" sind.
 * Der Unterschied ist der FARBTON, nicht die Helligkeit. Schwarz ist in
 * RGB neutral: ein Mix skaliert alle drei Kanaele gleich und laesst den
 * Farbton damit exakt stehen. `ROOM_DEEP_INK` hat selbst einen Ton
 * (~178 Grad, das Aqua der App) und jedes Mischen zieht die Raumfarbe in
 * diese Richtung. Gemessen ueber die sieben Pastellfarben bei 0.55:
 *
 *   Anker #0b1f1d: Abweichung bis 57 Grad. Keller #e2e6d2 wird auf 129
 *   Grad gezogen, Salbei und Oliv ebenfalls — die Kontur traegt die
 *   Raumfarbe dann NICHT mehr, und genau das ist der Auftrag.
 *   Anker #000000: Abweichung <= 2 Grad, das ist nur Rundung.
 *
 * Die Kontur soll die Raumfarbe nach DUNKEL verschieben, nicht veraendern.
 * Deshalb ist Schwarz hier nicht die generische Kontur, sondern genau das
 * Werkzeug, das den Farbton unveraendert laesst.
 */
export const ROOM_EDGE_ANCHOR = "#000000";

/**
 * Wie weit die Kontur auf `ROOM_EDGE_ANCHOR` gezogen wird: 0.50.
 *
 * Die Zahl ist gemessen, nicht geschaetzt. Sie ist die groesste Stufe,
 * die ALLE drei noetigen Kontraste haelt — je weiter, desto eher laeuft
 * die Kontur auf der anderen Seite in die Karte:
 *
 *   Fuellung~Kontur | Kontur~helle Karte | Kontur~dunkle Karte
 *   0.42   2.85:1 (zu wenig)   3.19:1         3.97:1
 *   0.50   3.60:1             4.10:1         3.14:1   <- gewaehlt
 *   0.52   3.84:1             4.40:1         2.95:1 (zu viel)
 *   0.55   4.22:1             4.88:1         2.68:1
 *
 * (jeweils der schlechteste der sieben Pastellfarben der Produktivdaten;
 * die Zahlen stehen als Test in `tests/unit/utils/roomColor.spec.js`.)
 *
 * Also: 0.42 laeuft optisch in die Pastellflaeche — genau der Befund aus
 * Aufgabe 1. Ab 0.52 dagegen faellt die Kontur gegen die dunklen
 * Dark-Mode-Surfaces unter 3:1 und der Chip verliert dort seine Kante.
 * 0.50 ist die einzige Stufe, in der die Kontur in BEIDEN Themes und auf
 * BEIDEN Achsen traegt.
 */
export const ROOM_EDGE_RATIO = 0.5;

/** "#c6e7dc" | "c6e7dc" | "#C6E7DC" -> [r, g, b] oder null. */
export function parseHexColor(hex) {
  if (typeof hex !== "string") return null;
  let s = hex.trim().replace(/^#/, "");
  if (s.length === 3) {
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

/** WCAG 2.x relative Luminanz, 0 (schwarz) .. 1 (weiss). */
export function relativeLuminance(rgb) {
  const [r, g, b] = rgb;
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Schwarz oder Weiss — whichever gives more contrast on this color.
 *
 * Der Schnittpunkt liegt bei L ~= 0.179. Mit einem
 * Kontrastverhaeltnis von (1.05)/(L+0.05) bzw. (L+0.05)/0.05 folgt die
 * Grenze bei (0.179+0.05)*1.05 ~ 0.24; die Kante ist bewusst weich
 * gewaehlt, weil ein knapper Wechsel bei mittelhellen Pastellen sonst
 * sichtbar flackert, wenn der User die Farbe live aendert.
 */
export function readableInk(
  hex,
  { dark = ROOM_DEEP_INK, light = "#ffffff" } = {},
) {
  const rgb = parseHexColor(hex);
  if (!rgb) return dark;
  return relativeLuminance(rgb) > 0.24 ? dark : light;
}

/**
 * Zwei Hex-Farben linear in sRGB mischen. `ratio` ist der Anteil von `b`.
 *
 * Bewusst sRGB-Mischen und kein HSL-Umdrehen: ein Mix mit Schwarz oder
 * Weiss aendert den FARBTON nicht, er verschiebt ihn nur auf der
 * Helligkeitsachse. Genau das ist der Punkt der Kontur — die Raumfarbe
 * muss als Raumfarbe erkennbar bleiben, nur tiefer.
 */
export function mixHex(a, b, ratio = 0.5) {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return null;
  const t = Math.min(1, Math.max(0, Number(ratio)));
  const mix = ca.map((v, i) => Math.round(v * (1 - t) + cb[i] * t));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Die Konturfarbe eines Raums: seine eigene Farbe, `ROOM_EDGE_RATIO`
 * tief auf den dunklen Anker gezogen.
 *
 * WARUM SO UND NICHT EINE SCHWARZE KANTE
 * ---------------------------------------
 * `border: 1px solid rgb(0 0 0 / 0.12)` war an allen Chips identisch —
 * der Rand trug also keine Rauminformation, nur die Flaeche tat es, und
 * die ist bei sieben Pastelltonen untereinander kaum zu trennen. Die
 * Kontur ist genau der Kanal, der das loesen kann: sie traegt denselben
 * Farbton wie die Flaeche, aber mit vollem Kontrast. Terrakotta bekommt
 * einen terrakottafarbenen Rand, Salbei einen salbeifarbenen.
 *
 * WARUM DAS IN BEIDEN THEMES TRAGT
 * -------------------------------
 * Die Kontur ist IMMER der dunkle Pol der Flaeche, nie der helle. Das
 * Thema steckt nicht in der Farbe, sondern in der Umgebung: im Light Mode
 * liegt der Chip auf heller Karte (dunkle Kontur = sichtbar), im Dark Mode
 * auf dunkler (helle Pastellflaeche = Silhouette sichtbar). Die Kontur
 * braucht also KEIN Dark-Override — sie ist in beiden Themes einfach die
 * dunkle Seite desselben Chips. Ein Light/Dark-Token-Paar waere hier eine
 * zweite Wahrheit ohne Not, genau wie bei `readableInk`.
 *
 * Die eine Ausnahme ist dokumentiert (nicht behoben): der dunkle
 * Persoenlichen-Raum ("Dave", #8d6e63). Seine Flaeche ist bereits dunkel,
 * eine weitere Stufe Richtung Schwarz nimmt ihr die Unterscheidbarkeit
 * (nur noch ~2.4:1 gegen die eigene Flaeche). Die Kontur traegt dort
 * trotzdem: die Silhouette gegen die helle Karte (~9.8:1) und den
 * Farbton. Im Dark Mode traegt die Flaeche selbst die Silhouette
 * (~3.75:1). Die Schrift bleibt in beiden Themes ueber 4.5:1.
 */
export function roomEdge(hex, { ratio = ROOM_EDGE_RATIO } = {}) {
  const fill = parseHexColor(hex) ? hex : DEFAULT_ROOM_COLOR;
  return mixHex(fill, ROOM_EDGE_ANCHOR, ratio);
}

/**
 * Das komplette Farbset eines Raums — die EINE Quelle fuer Chip UND
 * Raum-Filter.
 *
 * Aufgabe 2 verlangt, dass ein Raum in Karte und Filter gleich aussieht.
 * Das ist hier strukturell erzwungen: beide Komponenten rufen diese
 * Funktion, es gibt keine zweite Mischung und kein eigenes Schema in
 * einer der beiden Dateien.
 *
 * @returns {{ fill: string, ink: string, edge: string }}
 *   `fill` = DB-Farbe (Pastell), `ink` = Schrift (Kontrast >= 4.5:1 gegen
 *   `fill`), `edge` = Kontur (Kontrast >= 3:1 gegen `fill`).
 */
export function roomPalette(hex, { edgeRatio = ROOM_EDGE_RATIO } = {}) {
  const fill = parseHexColor(hex) ? hex : DEFAULT_ROOM_COLOR;
  return {
    fill,
    ink: readableInk(fill),
    edge: mixHex(fill, ROOM_EDGE_ANCHOR, edgeRatio),
  };
}

/** Kontrastverhaeltnis zwischen zwei Farben (fuer Tests/Pruefungen). */
export function contrastRatio(a, b) {
  const ra = parseHexColor(a);
  const rb = parseHexColor(b);
  if (!ra || !rb) return null;
  const la = relativeLuminance(ra);
  const lb = relativeLuminance(rb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
