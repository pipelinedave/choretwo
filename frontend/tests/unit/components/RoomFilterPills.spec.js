/**
 * RoomFilterPills — die zweite Achse (Aufgabe 2).
 *
 * Geprueft wird das, was den Auftrag ausmacht: Zaehler je Raum, das
 * UND-Verhalten (die Zeile kennt die Faelligkeit gar nicht), das
 * Ausblenden leerer Raeume, das getrennte Clear, und die Farbgleichheit
 * mit dem Raum-Chip.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import RoomFilterPills from "@/components/chores/RoomFilterPills.vue";
import RoomChip from "@/components/chores/RoomChip.vue";
import { useRoomStore } from "@/stores/room";
import { useChoreStore } from "@/stores/chore";
import { roomPalette } from "@/utils/roomColor";

const ROOMS = [
  {
    id: 10,
    name: "Küche",
    color: "#f6c7ae",
    icon: "silverware-fork-knife",
    isPersonal: false,
    sortOrder: 10,
  },
  {
    id: 20,
    name: "Bad",
    color: "#b7e1d7",
    icon: "shower",
    isPersonal: false,
    sortOrder: 20,
  },
  {
    id: 30,
    name: "Dave",
    color: "#8d6e63",
    icon: "account",
    isPersonal: true,
    sortOrder: 900,
  },
  {
    id: 40,
    name: "Keller",
    color: "#e2e6d2",
    icon: "garage",
    isPersonal: false,
    sortOrder: 60,
  },
];

const counts = { 10: 3, 20: 1, 30: 0, 40: 2 };

/**
 * Eine Pinia fuer den ganzen Test: die Komponente liest den room-Store,
 * und die Clear-Reihe den chore-Store. Zwei Instanzen wuerden die
 * geteilte Quelle zerlegen, die hier gerade geprueft wird.
 */
beforeEach(() => {
  setActivePinia(createPinia());
});

/** Setzt die Raumliste direkt in den Store, ohne API-Aufruf. */
function seedRooms(rooms = ROOMS) {
  const roomStore = useRoomStore();
  roomStore.rooms = rooms.map((r) => ({ ...r }));
  return roomStore;
}

function mountRow(props = {}) {
  return mount(RoomFilterPills, {
    props: { counts, ...props },
  });
}

describe("RoomFilterPills: Inhalt", () => {
  beforeEach(() => seedRooms());

  it("zeigt eine Pille je Raum MIT Chore", () => {
    const wrapper = mountRow();
    expect(wrapper.findAll(".room-pill")).toHaveLength(3);
    expect(wrapper.text()).toContain("Küche");
    expect(wrapper.text()).toContain("Bad");
  });

  it("traegt Icon und Name", () => {
    const wrapper = mountRow();
    const icon = wrapper.find(".room-pill__icon");
    expect(icon.classes()).toContain("mdi-silverware-fork-knife");
    expect(wrapper.find(".room-pill__label").text()).toBe("Küche");
  });

  it("zeigt den Zaehler je Raum, wie die Faelligkeits-Pills", () => {
    const wrapper = mountRow();
    const labels = wrapper.findAll(".room-pill").map((p) => ({
      name: p.find(".room-pill__label").text(),
      count: p.find(".room-pill-count").text(),
    }));
    expect(labels).toEqual([
      { name: "Küche", count: "3" },
      { name: "Bad", count: "1" },
      { name: "Keller", count: "2" },
    ]);
  });

  it("sortiert nach sortOrder, wie die Raum-Verwaltung", () => {
    const wrapper = mountRow();
    expect(wrapper.findAll(".room-pill__label").map((l) => l.text())).toEqual([
      "Küche",
      "Bad",
      "Keller",
    ]);
  });
});

describe("RoomFilterPills: Raeume ohne Chore", () => {
  beforeEach(() => seedRooms());

  it("zeigt keinen Chip fuer einen Raum ohne Chore", () => {
    // Dave hat 0 Chores. Ein Badge mit "0" wuerde eine Auswahl anbieten,
    // die garantiert leer endet.
    const wrapper = mountRow();
    expect(wrapper.text()).not.toContain("Dave");
    expect(
      wrapper.findAll(".room-pill-count").map((c) => c.text()),
    ).not.toContain("0");
  });

  it("zeigt die Zeile nicht, wenn alle Raeume bei 0 liegen", () => {
    const wrapper = mountRow({ counts: { 10: 0 } });
    expect(wrapper.find(".room-filter-row").exists()).toBe(false);
  });
});

describe("RoomFilterPills: leere Zeile", () => {
  it("rendert ohne Raeume gar nichts", () => {
    // Der room-Store faellt bei einem API-Fehler bewusst auf eine leere
    // Liste zurueck (unmigrierte Prod-DB, Ausfall). Die Zeile darf dann
    // nicht als leerer Streifen ueber der Liste stehen.
    seedRooms([]);
    const wrapper = mountRow({ counts: {} });
    expect(wrapper.find(".room-filter-row").exists()).toBe(false);
  });
});

describe("RoomFilterPills: Auswahl", () => {
  beforeEach(() => seedRooms());

  it("markiert den gewaehlten Raum als aktiv", () => {
    const wrapper = mountRow({ roomFilter: 20 });
    const active = wrapper
      .findAll(".room-pill")
      .filter((p) => p.classes("room-pill--active"));
    expect(active).toHaveLength(1);
    expect(active[0].find(".room-pill__label").text()).toBe("Bad");
  });

  it("setzt aria-pressed, damit der Zustand auch ohne Farbe erkennbar ist", () => {
    const wrapper = mountRow({ roomFilter: 20 });
    const pressed = (name) =>
      wrapper
        .findAll(".room-pill")
        .find((p) => p.find(".room-pill__label").text() === name)
        .attributes("aria-pressed");
    expect(pressed("Bad")).toBe("true");
    expect(pressed("Küche")).toBe("false");
  });

  it("sendet beim Klick die Raum-ID — nicht die Faelligkeit", () => {
    const wrapper = mountRow();
    wrapper.findAll(".room-pill")[0].trigger("click");
    const events = wrapper.emitted("update:roomFilter");
    expect(events).toBeTruthy();
    expect(events[0]).toEqual([10]);
    // Der entscheidende Punkt: diese Zeile kennt die Faelligkeit gar nicht.
    expect(wrapper.emitted("update:filter")).toBeUndefined();
  });

  it("hebt beim zweiten Klick auf denselben Raum die Auswahl auf", () => {
    const wrapper = mountRow({ roomFilter: 10 });
    wrapper.findAll(".room-pill")[0].trigger("click");
    expect(wrapper.emitted("update:roomFilter")[0]).toEqual([null]);
  });

  it("bleibt beim Wechsel auf einen anderen Raum stehen", () => {
    const wrapper = mountRow({ roomFilter: 10 });
    wrapper.findAll(".room-pill")[1].trigger("click");
    expect(wrapper.emitted("update:roomFilter")[0]).toEqual([20]);
  });
});

describe("RoomFilterPills: Clear-Button", () => {
  beforeEach(() => seedRooms());

  it("erscheint nur bei gesetztem Raumfilter", () => {
    expect(mountRow().find(".room-filter-clear").exists()).toBe(false);
    expect(
      mountRow({ roomFilter: 10 }).find(".room-filter-clear").exists(),
    ).toBe(true);
  });

  it("sendet clear und NICHT update:roomFilter", () => {
    // Getrennte Events, damit die View eindeutig entscheiden kann. Ein
    // stilles "update:roomFilter(null)" waere dasselbe, aber implizit.
    const wrapper = mountRow({ roomFilter: 10 });
    wrapper.find(".room-filter-clear").trigger("click");
    expect(wrapper.emitted("clear")).toBeTruthy();
    expect(wrapper.emitted("update:roomFilter")).toBeUndefined();
  });

  it("loescht NUR den Raumfilter, nicht die Faelligkeit", () => {
    // Ueber den Store geprueft, nicht ueber die Komponente: das ist die
    // eigentliche Zusage.
    const choreStore = useChoreStore();
    choreStore.setFilter("today");
    choreStore.setRoomFilter(10);
    choreStore.clearRoomFilter();
    expect(choreStore.roomFilter).toBeNull();
    expect(choreStore.filter).toBe("today");
  });
});

describe("RoomFilterPills: Personen-Raum", () => {
  beforeEach(() => seedRooms());

  it("traegt dieselbe Spezialklasse wie der Raum-Chip", () => {
    const wrapper = mountRow({ counts: { 30: 2 } });
    const dave = wrapper
      .findAll(".room-pill")
      .find((p) => p.find(".room-pill__label").text() === "Dave");
    expect(dave.classes()).toContain("room-pill--personal");
    expect(dave.attributes("title")).toContain("persönlich");
  });
});

describe("Raum-Farbe: Karte und Filter sind identisch", () => {
  beforeEach(() => seedRooms());

  it("nutzt dieselben drei Farben wie RoomChip", () => {
    const style = mountRow().findAll(".room-pill")[0].attributes("style");
    const { fill, ink, edge } = roomPalette("#f6c7ae");

    expect(style).toContain(`background-color: ${fill}`);
    expect(style).toContain(`border-color: ${edge}`);
    const inkMatch = /(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,6})/.exec(style);
    expect(inkMatch[1]).toBe(ink);
  });

  it("liefert fuer Chip und Pille dieselbe Palette", () => {
    const chipStyle = mount(RoomChip, { props: { room: ROOMS[0] } })
      .find(".room-chip")
      .attributes("style");
    const pillStyle = mountRow().findAll(".room-pill")[0].attributes("style");

    const extract = (s) => ({
      bg: /background-color:\s*(#[0-9a-fA-F]{3,6})/.exec(s)[1],
      border: /border-color:\s*(#[0-9a-fA-F]{3,6})/.exec(s)[1],
    });
    expect(extract(pillStyle)).toEqual(extract(chipStyle));
  });

  it("setzt die Raumfarbe als Inline-Style, nicht als Token", () => {
    // design-tokens.spec.js wuerde eine Custom-Property-Referenz fuer die
    // Raumfarbe als undefiniertes Token failen.
    const style = mountRow().findAll(".room-pill")[0].attributes("style");
    expect(style).not.toMatch(/var\(--/);
  });
});
