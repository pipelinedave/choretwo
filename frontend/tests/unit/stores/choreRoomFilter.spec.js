/**
 * Raumfilter als zweite, unabhaengige Achse (Aufgabe 2).
 *
 * Der entscheidende Test ist `filteredChores` bei BEIDEN gesetzten Filtern.
 * Genau dort ist ein Ersetzen statt eines UND unsichtbar: die Liste waere
 * dann nicht leer, sie waere nur die "falsche" Liste. Ein reiner
 * Laengen-Test erkennt das nicht — deshalb wird hier auf Inhalt geprueft.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useChoreStore } from "@/stores/chore";

/** Ein Chore, drei Tage in der Zukunft faellig. */
const soon = (id, roomId, over = {}) => ({
  id,
  name: `Chore ${id}`,
  done: false,
  archived: false,
  interval: 0,
  due_date: dueIn(3),
  room_id: roomId,
  roomId,
  ...over,
});

function dueIn(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

const dueToday = () => dueIn(0);

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useChoreStore();
  store.chores = [
    soon(1, 10), // due in 3 days
    soon(2, 10), // due in 3 days
    soon(3, 20), // due in 3 days
    soon(4, 10, { due_date: dueToday(), dueDate: dueToday() }), // due today
    soon(5, 20, { due_date: dueToday(), dueDate: dueToday() }), // due today
    soon(6, null), // no room at all
    soon(7, 30, { archived: true }), // archived
  ];
});

describe("Raumfilter: eigene Achse", () => {
  it("startet ohne Auswahl", () => {
    expect(store.roomFilter).toBeNull();
  });

  it("aendert die Liste, ohne die Faelligkeit zu beruehren", () => {
    store.setFilter("all");
    const before = store.filteredChores.length;

    store.setRoomFilter(10);
    expect(store.roomFilter).toBe(10);
    expect(store.filteredChores.length).toBeLessThan(before);
    // Die Kernzusage: die Faelligkeit wurde nicht angefasst.
    expect(store.filter).toBe("all");
  });

  it("setzt und loescht unabhaengig", () => {
    store.setRoomFilter(10);
    store.setFilter("today");
    store.clearRoomFilter();
    expect(store.roomFilter).toBeNull();
    expect(store.filter).toBe("today");
  });
});

describe("Raumfilter: UND statt Ersetzen", () => {
  it("liefert die Schnittmenge beider Achsen", () => {
    store.setFilter("today");
    store.setRoomFilter(10);

    // "Heute faellig" liefert 4 und 5, "Raum 10" zusätzlich -> nur 4.
    expect(store.filteredChores.map((c) => c.id)).toEqual([4]);
  });

  it("behaelt die Chores ohne Raum nicht, wenn ein Raum gewaehlt ist", () => {
    store.setFilter("all");
    store.setRoomFilter(10);
    expect(store.filteredChores.map((c) => c.id)).not.toContain(6);
  });

  it("arbeitet auch mit einem Filter, der nichts ergibt (Schnittmenge leer)", () => {
    // Raum 30 hat nur einen archivierten Chore -> nach der UND-Filterung
    // bleibt nichts. Die Liste muss dann leer sein und nicht wieder alles.
    store.setFilter("all");
    store.setRoomFilter(30);
    expect(store.filteredChores).toHaveLength(0);
  });

  it("vertauscht die Achsen nicht, wenn in anderer Reihenfolge gewaehlt wird", () => {
    store.setRoomFilter(20);
    store.setFilter("today");
    const a = store.filteredChores.map((c) => c.id);

    store.setRoomFilter(null);
    store.setFilter("all");
    store.setRoomFilter(20);
    store.setFilter("today");
    expect(store.filteredChores.map((c) => c.id)).toEqual(a);
  });
});

describe("Raumfilter: Zaehler", () => {
  it("zaehlt auf der Faelligkeits-Achse, nicht auf der gefilterten Liste", () => {
    store.setFilter("all");
    expect(store.roomCounts).toEqual({ 10: 3, 20: 2 });

    // Der springende Punkt: bei "heute" fallen die Zaehler, weil die
    // Zeile zeigen soll, was die zweite Auswahl ERGAEZEN wuerde. Aus
    // `filteredChores` waere das nicht ableitbar.
    store.setFilter("today");
    expect(store.roomCounts).toEqual({ 10: 1, 20: 1 });
  });

  it("zaehlt die Chores ohne Raum nicht", () => {
    store.setFilter("all");
    expect(store.roomCounts[null]).toBeUndefined();
    expect(store.roomCounts[undefined]).toBeUndefined();
    const total = Object.values(store.roomCounts).reduce((a, b) => a + b, 0);
    // 7 Chores, davon 1 ohne Raum und 1 archiviert -> 5.
    expect(total).toBe(5);
  });

  it("zaehlt auch dann nach der Raum-Achse, wenn sie schon steht", () => {
    // Ein Filter, der sich selbst wegzahlt, waere nutzlos: mit aktivem
    // Raum 10 zeigte die Zeile nur noch dessen Zaehler.
    store.setFilter("all");
    store.setRoomFilter(10);
    expect(store.roomCounts[20]).toBe(2);
  });
});

describe("Raumfilter: Schalten", () => {
  it("toggleRoomFilter setzt und loescht denselben Raum", () => {
    store.toggleRoomFilter(20);
    expect(store.roomFilter).toBe(20);
    store.toggleRoomFilter(20);
    expect(store.roomFilter).toBeNull();
  });

  it("setRoomFilter behandelt undefined wie null", () => {
    store.setRoomFilter(undefined);
    expect(store.roomFilter).toBeNull();
  });

  it("clearFilter fasst den Raum NICHT an", () => {
    store.setRoomFilter(10);
    store.setFilter("today");
    store.clearFilter();
    expect(store.filter).toBe("all");
    expect(store.roomFilter).toBe(10);
  });
});
