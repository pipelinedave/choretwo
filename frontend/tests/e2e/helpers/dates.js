/**
 * Datums-Helfer fuer E2E-Tests.
 *
 * WARUM DAS EIGENE MODUL
 * `new Date().toISOString().split("T")[0]` liefert das UTC-Datum. Die
 * Services speichern aber lokale Daten. In einer Zeitzone westlich von UTC
 * (CET/CEST = UTC+1/+2) laufen die beiden zwischen 00:00 und 02:00 lokal
 * auseinander — der Test berechnet "heute" als gestern, der Server schreibt
 * heute, und der Vergleich schlaegt fehl.
 *
 * Das ist keine theoretische Sorge, sondern aufgetreten: die beiden
 * `undo-marked-done-*`-Specs wurden um 00:06 CEST am 27.09. rot, mit
 *   Expected: "2026-09-26"   (UTC, vom Test berechnet)
 *   Received: "2026-09-27"   (lokal, vom Server)
 * Nachgewiesen, dass es unabhaengig von jeder Aenderung am Frontend ist —
 * der Fehler tritt auch mit gestashtem Arbeitsbaum auf.
 *
 * Wer Datums-Vergleiche schreibt, nimmt `localDate()` und nicht `toISOString`.
 */

/** Lokales Datum als `YYYY-MM-DD`, im Format, das die API erwartet. */
export function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lokales Datum um `days` verschoben. */
export function localDateOffset(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
