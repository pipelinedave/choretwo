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
export function readableInk(hex, { dark = "#0b1f1d", light = "#ffffff" } = {}) {
  const rgb = parseHexColor(hex);
  if (!rgb) return dark;
  return relativeLuminance(rgb) > 0.24 ? dark : light;
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
