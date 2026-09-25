/**
 * CatchUp Stack Utility
 *
 * Baut einen flachen, nach Dringlichkeit sortierten Stack aus nicht-archivierten,
 * nicht-erledigten Chores. Nutzt bucketChores() als Basis.
 *
 * Priorität: overdue → today → tomorrow → thisWeek → upcoming
 */
import {
  bucketChores,
  isDoneToday,
  normalizeToLocalDate,
} from "@/utils/choreBuckets";

/**
 * Filtere chores auf nicht-erledigte, nicht-archivierte und baue den CatchUp-Stack.
 *
 * @param {Array} chores - Vollständiger Chore-Array (vom Store)
 * @param {Date} now - Referenzdatum (Standard: jetzt)
 * @returns {{ stack: Array, total: number, remaining: number, counts: Object }}
 */
export function buildCatchUpStack(chores, now = new Date()) {
  // Vorfiltern: nur aktive chores (nicht done, nicht archived)
  const active = (chores || []).filter(
    (c) => !(c.done && isDoneToday(c, now)) && !c.archived,
  );

  // Bucketing mit vorhandener Utility
  const { buckets, counts } = bucketChores(active, now);

  // Flache Reihenfolge: overdue, today, tomorrow, thisWeek, upcoming
  const stack = [
    ...(buckets.overdue || []),
    ...(buckets.today || []),
    ...(buckets.tomorrow || []),
    ...(buckets.thisWeek || []),
    ...(buckets.upcoming || []),
  ];

  const total = stack.length;

  // Sortiere innerhalb jedes Buckets nach Fälligkeitsdatum (älteste zuerst)
  stack.sort((a, b) => {
    const dateA = normalizeToLocalDate(a.dueDate || a.due_date);
    const dateB = normalizeToLocalDate(b.dueDate || b.due_date);
    return (dateA?.getTime() ?? Infinity) - (dateB?.getTime() ?? Infinity);
  });

  return { stack, total, remaining: total, counts };
}

/**
 * Erhalte Bucket-Labels für einen Stack-Eintrag.
 */
export function getBucketLabel(chore, now = new Date()) {
  const rawDate = chore.dueDate || chore.due_date;
  const dueDate = normalizeToLocalDate(rawDate);
  if (!dueDate) return "";

  const { today, tomorrow, nextWeek } = {
    today: normalizeToLocalDate(now),
    tomorrow: (() => {
      const t = new Date(normalizeToLocalDate(now));
      t.setDate(t.getDate() + 1);
      return t;
    })(),
    nextWeek: (() => {
      const w = new Date(normalizeToLocalDate(now));
      w.setDate(w.getDate() + 7);
      return w;
    })(),
  };

  if (dueDate < today) return "Überfällig";
  if (dueDate.getTime() === today.getTime()) return "Heute";
  if (dueDate.getTime() === tomorrow.getTime()) return "Morgen";
  if (dueDate <= nextWeek) return "Diese Woche";
  return "Später";
}

/* ======================================================================
   Session — Fortschritt relativ zur GESAMTEN Runde (Befund B4)
   ====================================================================== */

/** Die beiden Filter des Decks. "urgent" = Überfällig + Heute. */
export const CATCH_UP_FILTERS = { all: "all", urgent: "urgent" };

/** Bucket-Labels, die der Filter "Überfällig + Heute" durchlaesst. */
export const URGENT_LABELS = ["Überfällig", "Heute"];

export function isUrgentChore(chore, now = new Date()) {
  return URGENT_LABELS.includes(getBucketLabel(chore, now));
}

/**
 * Blendet Chores aus, ohne sie zu entfernen.
 *
 * WICHTIG: filtert die Sichtbarkeit, nie die Menge. Der Fortschritt einer
 * Runde bezieht sich auf den ungefilterten Stapel — sonst faellt der Zaehler
 * bei einem Filterklick auf die gefilterte Menge zurueck (10/20 erledigt,
 * Klick auf "Überfällig + Heute" → 0/5) und das fuehlt sich wie Datenverlust
 * an.
 */
export function applyCatchUpFilter(stack, filter = CATCH_UP_FILTERS.all, now) {
  if (filter !== CATCH_UP_FILTERS.urgent) return stack;
  return stack.filter((chore) => isUrgentChore(chore, now));
}

/**
 * Baut den Stapel EINER Runde: alle offenen Chores minus der in dieser
 * Runde aufgeschobenen.
 *
 * Die ausgeschlossenen Chores sind ein Runde-Zustand, kein Chore-Zustand:
 * eine auf "morgen" geschobene Chore ist weiterhin offen und taucht nach
 * einem Stack-Neubau (Refresh, Filterwechsel) in "upcoming" wieder auf. Im
 * Deck waere sie dann zum zweiten Mal dran, ohne dass der Nutzer sie in
 * dieser Runde noch einmal abgearbeitet haette. Das fruehere
 * `stack.filter(c => c.id !== chore.id)` im View erledigte das nur fuer den
 * einen gefilterten Stack und entkoppelte damit Stapel und Zaehler.
 *
 * @param {Array} chores  Vollständige Chore-Liste aus dem Store
 * @param {object} [opts]
 * @param {Date}   [opts.now]        Referenzdatum
 * @param {Array}  [opts.excludeIds] IDs, die in dieser Runde aufgeschoben
 *                                  wurden
 */
export function buildSessionStack(
  chores,
  { now = new Date(), excludeIds = [] } = {},
) {
  const excluded = new Set(excludeIds);
  const { stack, counts } = buildCatchUpStack(chores, now);
  const sessionStack = stack.filter((chore) => !excluded.has(chore.id));
  return {
    stack: sessionStack,
    total: sessionStack.length,
    counts,
    excluded: excluded.size,
  };
}

/**
 * Fortschritt der Runde, bezogen auf die GESAMTmenge des Session-Starts.
 *
 * @param {number} sessionTotal - Stapelgroesse beim Session-Start
 * @param {number} remaining    - noch offene Chores (ungefiltert!)
 * @returns {{total:number, remaining:number, resolved:number, pct:number,
 *            currentCardNumber:number}}
 */
export function sessionProgress(sessionTotal, remaining) {
  const total = Math.max(0, Number(sessionTotal) || 0);
  const left = Math.max(0, Number(remaining) || 0);
  const resolved = Math.max(0, total - left);
  return {
    total,
    remaining: left,
    resolved,
    pct: total === 0 ? 0 : Math.round((resolved / total) * 100),
    // "Karte X von Y": X = aktuelle Position in der Runde, gedeckelt auf Y.
    // Ohne Deckel behauptete die letzte Karte "Karte 3 von 2".
    currentCardNumber: total === 0 ? 0 : Math.min(total, resolved + 1),
  };
}

/**
 * Warum ist das Deck leer? Die drei Faelle brauchen drei verschiedene
 * Antworten, deshalb werden sie unterschieden statt in einem "nichts zu tun"
 * erzwungen (Befund D1).
 *
 * @param {object} p
 * @param {number} p.remaining    - offene Chores der Runde (ungefiltert)
 * @param {number} p.sessionTotal - Stapelgroesse beim Session-Start
 * @returns {"complete"|"filtered-out"|"nothing"}
 *   complete      — die Runde ist abgearbeitet (Session-Ende)
 *   filtered-out  — es ist noch was offen, der Filter blendet es aus
 *   nothing       — von Anfang an nichts im Stapel
 */
export function emptyDeckReason({ remaining, sessionTotal }) {
  if (remaining > 0) return "filtered-out";
  if (!sessionTotal) return "nothing";
  return "complete";
}
