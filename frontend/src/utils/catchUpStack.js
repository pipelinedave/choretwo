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
