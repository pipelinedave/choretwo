import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RoomChip from "@/components/chores/RoomChip.vue";
import { contrastRatio } from "@/utils/roomColor";

const room = (over = {}) => ({
  id: 1,
  name: "Küche",
  color: "#f6c7ae",
  icon: "silverware-fork-knife",
  is_personal: false,
  ...over,
});

describe("RoomChip: Optionalitaet", () => {
  it("rendert ohne room gar nichts (kein Platzhalter)", () => {
    // Kernanforderung: ein Chore ohne Raum sieht exakt aus wie vor dem
    // Feature. Ein leerer Chip oder ein unsichtbarer mit padding wuerde
    // die Kartenhoehe veraendern.
    const wrapper = mount(RoomChip, { props: { room: null } });
    expect(wrapper.find(".room-chip").exists()).toBe(false);
    // Vue kompiliert `v-if` zu einem Kommentar-Platzhalter. Entscheidend
    // ist: nichts Sichtbares, kein Text, keine Box.
    expect(wrapper.text()).toBe("");
  });

  it("rendert mit undefined genauso nichts", () => {
    const wrapper = mount(RoomChip, { props: { room: undefined } });
    expect(wrapper.find(".room-chip").exists()).toBe(false);
  });
});

describe("RoomChip: Inhalt", () => {
  it("zeigt Icon-Klasse und Namen", () => {
    const wrapper = mount(RoomChip, { props: { room: room() } });
    const icon = wrapper.find(".room-chip__icon");
    expect(icon.classes()).toContain("mdi-silverware-fork-knife");
    expect(wrapper.find(".room-chip__label").text()).toBe("Küche");
  });

  it("traegt die Raumfarbe als Inline-Style, nicht als Token", () => {
    const wrapper = mount(RoomChip, { props: { room: room() } });
    const style = wrapper.find(".room-chip").attributes("style");
    // Die Raumfarbe ist Laufzeit-Daten aus der DB. Sie muss als
    // Inline-Style kommen — design-tokens.spec.js wuerde eine
    // CSS-Custom-Property-Referenz hier als undefiniertes Token failen.
    expect(style).toContain(`background-color: ${room().color}`);
    expect(style).not.toMatch(/var\(--/);
  });

  it("berechnet eine lesbare Schriftfarbe aus der Flaeche", () => {
    const wrapper = mount(RoomChip, { props: { room: room() } });
    const style = wrapper.find(".room-chip").attributes("style");
    // Auf #f6c7ae (heller Sand) muss dunkle Schrift kommen — Kontrast
    // >= 4.5:1, sonst ist der Chip in keinem Theme lesbar.
    // `(?:^|;)\s*color:` statt nur `color:` — sonst matcht der Ausdruck
    // das `color` aus `background-color` und liefert die Hintergrundfarbe
    // als "Tinte" zurueck.
    const ink = /(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,6})/.exec(style);
    expect(ink).not.toBeNull();
    expect(contrastRatio("#f6c7ae", ink[1])).toBeGreaterThanOrEqual(4.5);
  });

  it("nutzt helle Schrift auf dunkler Raumfarbe (Dave-Braun)", () => {
    const wrapper = mount(RoomChip, {
      props: {
        room: room({ name: "Dave", color: "#8d6e63", icon: "account" }),
      },
    });
    const style = wrapper.find(".room-chip").attributes("style");
    expect(style).toContain("color: #ffffff");
    expect(contrastRatio("#8d6e63", "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("RoomChip: Dave-Spezialbehandlung", () => {
  it("traegt bei is_personal die Sonderklasse, sonst nicht", () => {
    const personal = mount(RoomChip, {
      props: { room: room({ name: "Dave", is_personal: true }) },
    });
    expect(personal.find(".room-chip").classes()).toContain(
      "room-chip--personal",
    );

    const normal = mount(RoomChip, { props: { room: room() } });
    expect(normal.find(".room-chip").classes()).not.toContain(
      "room-chip--personal",
    );
  });

  it("erkennt die Sonderbehandlung auch ueber camelCase", () => {
    const wrapper = mount(RoomChip, {
      props: { room: room({ is_personal: undefined, isPersonal: true }) },
    });
    expect(wrapper.find(".room-chip").classes()).toContain(
      "room-chip--personal",
    );
  });

  it("unterscheidet sich vom Normal-Chip auch OHNE Farbunterschied", () => {
    // Die Spezialbehandlung darf nicht nur "andere Farbe" sein — sonst
    // waere sie nicht erkennbar, sobald der User "Dave" auf Salbei
    // setzt. Der Klassenunterschied ist der eigentliche Unterschied.
    const personal = mount(RoomChip, {
      props: { room: room({ is_personal: true }) },
    });
    const normal = mount(RoomChip, { props: { room: room() } });
    expect(personal.find(".room-chip").classes()).not.toEqual(
      normal.find(".room-chip").classes(),
    );
  });

  it("nennt den Raum im title als persoenlich", () => {
    const wrapper = mount(RoomChip, {
      props: { room: room({ name: "Dave", is_personal: true }) },
    });
    expect(wrapper.find(".room-chip").attributes("title")).toContain(
      "persönlich",
    );
  });
});

describe("RoomChip: compact", () => {
  it("haelt den Namen im title, auch wenn er nicht angezeigt wird", () => {
    const wrapper = mount(RoomChip, {
      props: { room: room(), compact: true },
    });
    expect(wrapper.find(".room-chip").classes()).toContain(
      "room-chip--compact",
    );
    expect(wrapper.find(".room-chip").attributes("title")).toBe("Küche");
  });
});
