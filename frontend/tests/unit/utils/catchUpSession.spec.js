/**
 * Session-Logik des Aufholen-Decks (STAGE 2, Befund B4/B2/D1).
 *
 * Getestet werden die REINEN Funktionen aus `catchUpStack.js` — sie tragen
 * die Semantik, die im View sonst nur schwer zu pruefen waere: der
 * Fortschritt einer Runde bezieht sich auf die GESAMTmenge, ein Filter aendert
 * nur die Sichtbarkeit.
 */
import { describe, it, expect } from "vitest";
import {
  applyCatchUpFilter,
  buildSessionStack,
  emptyDeckReason,
  isUrgentChore,
  sessionProgress,
  CATCH_UP_FILTERS,
  URGENT_LABELS,
} from "@/utils/catchUpStack";

const NOW = new Date("2026-05-15T12:00:00Z");

const makeChore = (overrides = {}) => ({
  id: 1,
  name: "Test Chore",
  dueDate: "2026-05-15",
  done: false,
  archived: false,
  ...overrides,
});

/* ====================================================================== *
 * 1. Der Filter filtert die Sichtbarkeit, nicht die Menge (Befund B4)
 * ====================================================================== */
describe("applyCatchUpFilter", () => {
  const stack = [
    makeChore({ id: 1, dueDate: "2026-05-10" }), // Überfällig
    makeChore({ id: 2, dueDate: "2026-05-15" }), // Heute
    makeChore({ id: 3, dueDate: "2026-05-16" }), // Morgen
    makeChore({ id: 4, dueDate: "2026-05-20" }), // Diese Woche
    makeChore({ id: 5, dueDate: "2026-06-20" }), // Später
  ];

  it("laesst bei 'all' alles durch", () => {
    expect(applyCatchUpFilter(stack, CATCH_UP_FILTERS.all, NOW)).toHaveLength(5);
  });

  it("laesst bei 'urgent' nur Überfällig und Heute durch", () => {
    const urgent = applyCatchUpFilter(stack, CATCH_UP_FILTERS.urgent, NOW);
    expect(urgent.map((c) => c.id)).toEqual([1, 2]);
  });

  it("behaelt die Reihenfolge des ungefilterten Stapels bei", () => {
    const urgent = applyCatchUpFilter(stack, CATCH_UP_FILTERS.urgent, NOW);
    // Der Filter darf nicht umsortieren — die Dringlichkeitsordnung des
    // aufgebauten Stapels ist das, was das Deck ausmacht.
    const positions = urgent.map((c) => stack.findIndex((s) => s.id === c.id));
    expect(positions).toEqual([0, 1]);
  });

  it("kennt genau die zwei Labels des Filters", () => {
    expect(URGENT_LABELS).toEqual(["Überfällig", "Heute"]);
  });

  it("erkennt eine dringende Chore unabhaengig vom Bucket-Namen", () => {
    expect(isUrgentChore(makeChore({ dueDate: "2026-05-01" }), NOW)).toBe(true);
    expect(isUrgentChore(makeChore({ dueDate: "2026-05-15" }), NOW)).toBe(true);
    expect(isUrgentChore(makeChore({ dueDate: "2026-05-16" }), NOW)).toBe(false);
  });
});

/* ====================================================================== *
 * 2. Fortschritt relativ zur GESAMTEN Runde
 * ====================================================================== */
describe("sessionProgress", () => {
  it("startet bei 0 erledigt", () => {
    expect(sessionProgress(5, 5)).toMatchObject({
      resolved: 0,
      pct: 0,
      currentCardNumber: 1,
    });
  });

  it("zaehlt die abgearbeiteten Chores", () => {
    expect(sessionProgress(5, 3)).toMatchObject({
      resolved: 2,
      pct: 40,
      currentCardNumber: 3,
    });
  });

  it("haelt den Fortschritt bei einem Filterwechsel", () => {
    // 10 von 20 erledigt, Filter blendet auf 5 sichtbare Chores — die
    // Fortschrittsanzeige bleibt bei 10/20. Genau das war der Datenverlust-
    // Eindruck in Befund B4.
    const before = sessionProgress(20, 10);
    const visible = applyCatchUpFilter(
      Array.from({ length: 5 }, (_, i) =>
        makeChore({ id: i + 1, dueDate: "2026-05-10" }),
      ),
      CATCH_UP_FILTERS.urgent,
      NOW,
    );
    expect(visible).toHaveLength(5);
    expect(sessionProgress(20, 10)).toEqual(before);
  });

  it("deckelt die Kartennummer auf die Session-Groesse", () => {
    // Ohne Deckel behauptete die letzte Karte "Karte 3 von 2".
    expect(sessionProgress(2, 0).currentCardNumber).toBe(2);
  });

  it("rundet den Prozentwert", () => {
    expect(sessionProgress(3, 2).pct).toBe(33);
  });

  it("vertraegt unsinnige Eingaben, ohne zu brechen", () => {
    // Undo nach dem Stapel-Neubau, Pause/Resume, doppelter Klick: der
    // Fortschritt darf nie negativ oder groesser als die Runde werden.
    expect(sessionProgress(0, 0)).toMatchObject({
      resolved: 0,
      pct: 0,
      currentCardNumber: 0,
    });
    expect(sessionProgress(2, 5).resolved).toBe(0);
    expect(sessionProgress(undefined, undefined)).toMatchObject({
      total: 0,
      resolved: 0,
      pct: 0,
    });
  });
});

/* ====================================================================== *
 * 3. Leerer Stapel: drei Ursachen, drei Antworten (Befund D1)
 * ====================================================================== */
describe("emptyDeckReason", () => {
  it("erkennt die abgearbeitete Runde", () => {
    expect(emptyDeckReason({ remaining: 0, sessionTotal: 5 })).toBe("complete");
  });

  it("erkennt den Filter, der alles ausblendet", () => {
    expect(emptyDeckReason({ remaining: 7, sessionTotal: 20 })).toBe(
      "filtered-out",
    );
  });

  it("erkennt einen von Anfang an leeren Stapel", () => {
    expect(emptyDeckReason({ remaining: 0, sessionTotal: 0 })).toBe("nothing");
  });
});

/* ====================================================================== *
 * 4. Der Runde-Stapel blendet aufgeschobene Chores aus
 * ====================================================================== */
describe("buildSessionStack", () => {
  it("schliesst in dieser Runde aufgeschobene Chores aus", () => {
    const chores = [
      makeChore({ id: 1, dueDate: "2026-05-10" }),
      // Durch das Aufschieben wandert die Chore in "upcoming" — sie ist
      // weiterhin offen und taucht im upcoming-Bucket wieder auf.
      makeChore({ id: 2, dueDate: "2026-05-22" }),
      makeChore({ id: 3, dueDate: "2026-05-11" }),
    ];
    const { stack, total } = buildSessionStack(chores, {
      now: NOW,
      excludeIds: [2],
    });
    expect(stack.map((c) => c.id)).toEqual([1, 3]);
    expect(total).toBe(2);
  });

  it("ohne excludeIds ist der Stapel vollstaendig", () => {
    const chores = [makeChore({ id: 1 }), makeChore({ id: 2 })];
    expect(buildSessionStack(chores, { now: NOW }).total).toBe(2);
  });

  it("ignoriert eine unbekannte ID im Ausschluss", () => {
    const chores = [makeChore({ id: 1 })];
    expect(
      buildSessionStack(chores, { now: NOW, excludeIds: [999] }).total,
    ).toBe(1);
  });
});
