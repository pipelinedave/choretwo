import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// `vi.mock` wird von Vitest an den Dateianfang gehoben. Die Mock-Objekte
// darum in `vi.hoisted()` erzeugen — sonst kann die Factory beim Hoisten
// noch gar nicht auf `choreApi` zugreifen
// ("Cannot access 'choreApi' before initialization").
const { choreApi } = vi.hoisted(() => ({
  choreApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/api", () => ({ choreApi }));

import { useRoomStore } from "@/stores/room";

const apiRoom = (over = {}) => ({
  id: 1,
  name: "Küche",
  color: "#f6c7ae",
  icon: "silverware-fork-knife",
  is_personal: false,
  sort_order: 10,
  created_at: "2026-09-30T10:00:00",
  updated_at: "2026-09-30T10:00:00",
  ...over,
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe("room store: normalizeRoom", () => {
  it("mappt snake_case auf camelCase und haelt beides", () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({ data: [apiRoom()] });
    return store.fetchRooms().then(() => {
      const room = store.rooms[0];
      expect(room.isPersonal).toBe(false);
      expect(room.is_personal).toBe(false);
      expect(room.sortOrder).toBe(10);
      expect(room.sort_order).toBe(10);
      expect(room.color).toBe("#f6c7ae");
      expect(room.icon).toBe("silverware-fork-knife");
    });
  });

  it("erkennt den Dave-Raum als is_personal", () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({
      data: [apiRoom({ id: 11, name: "Dave", is_personal: true })],
    });
    return store.fetchRooms().then(() => {
      expect(store.rooms[0].isPersonal).toBe(true);
      expect(store.personalRooms).toHaveLength(1);
      expect(store.personalRooms[0].name).toBe("Dave");
    });
  });

  it("liefert roomById als Map", () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({ data: [apiRoom({ id: 7 })] });
    return store.fetchRooms().then(() => {
      expect(store.roomById.get(7).name).toBe("Küche");
      expect(store.roomById.get(999)).toBeUndefined();
    });
  });
});

describe("room store: create", () => {
  it("schickt is_personal und sort_order in snake_case", async () => {
    const store = useRoomStore();
    choreApi.post.mockResolvedValue({ data: apiRoom({ id: 5 }) });
    await store.createRoom({
      name: "Dave",
      color: "#8d6e63",
      icon: "account",
      isPersonal: true,
      sortOrder: 900,
    });
    expect(choreApi.post).toHaveBeenCalledWith("/rooms", {
      name: "Dave",
      color: "#8d6e63",
      icon: "account",
      is_personal: true,
      sort_order: 900,
    });
  });

  it("haengt den neuen Raum an die Liste", async () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({ data: [] });
    await store.fetchRooms();
    choreApi.post.mockResolvedValue({ data: apiRoom({ id: 3, name: "Bad" }) });
    await store.createRoom({ name: "Bad" });
    expect(store.rooms).toHaveLength(1);
    expect(store.rooms[0].name).toBe("Bad");
  });

  it("propagiert einen 409 (Name vergeben) statt ihn zu schlucken", async () => {
    // Bewusst NICHT gefangen: ein stilles Scheitern waere hier ein
    // Datenverlust — der User glaubt, der Raum sei angelegt.
    const store = useRoomStore();
    const err = Object.assign(new Error("conflict"), {
      response: {
        status: 409,
        data: { detail: "Room 'Bad' existiert bereits" },
      },
    });
    choreApi.post.mockRejectedValue(err);
    await expect(store.createRoom({ name: "Bad" })).rejects.toThrow("conflict");
  });
});

describe("room store: update", () => {
  it("schickt nur gesetzte Felder", async () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({ data: [apiRoom({ id: 2 })] });
    await store.fetchRooms();
    choreApi.patch.mockResolvedValue({
      data: apiRoom({ id: 2, color: "#d3ead8" }),
    });
    await store.updateRoom(2, { color: "#d3ead8" });
    expect(choreApi.patch).toHaveBeenCalledWith("/rooms/2", {
      color: "#d3ead8",
    });
  });

  it("ersetzt den Raum in der Liste", async () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({
      data: [apiRoom({ id: 2, name: "Keller" })],
    });
    await store.fetchRooms();
    choreApi.patch.mockResolvedValue({
      data: apiRoom({ id: 2, name: "Keller", color: "#e2e6d2" }),
    });
    await store.updateRoom(2, { color: "#e2e6d2" });
    expect(store.rooms[0].color).toBe("#e2e6d2");
    expect(store.rooms[0].name).toBe("Keller");
  });
});

describe("room store: delete", () => {
  it("entfernt den Raum aus der Liste", async () => {
    const store = useRoomStore();
    choreApi.get.mockResolvedValue({
      data: [apiRoom({ id: 4, name: "Garage" })],
    });
    await store.fetchRooms();
    choreApi.delete.mockResolvedValue({ data: { id: 4 } });
    await store.deleteRoom(4);
    expect(choreApi.delete).toHaveBeenCalledWith("/rooms/4");
    expect(store.rooms).toHaveLength(0);
  });
});

describe("room store: Fehlertoleranz", () => {
  it("faellt bei kaputtem Endpoint auf eine leere Liste zurueck", async () => {
    // Prod ohne Migration: /rooms existiert noch nicht. Die App muss
    // trotzdem laufen — nur eben ohne Raeume.
    const store = useRoomStore();
    choreApi.get.mockRejectedValue(new Error("Network Error"));
    const result = await store.fetchRooms();
    expect(result).toEqual([]);
    expect(store.rooms).toEqual([]);
    expect(store.error).toBeTruthy();
  });

  it("uebernimmt die Backend-Fehlermeldung (409) als error-Text", async () => {
    const store = useRoomStore();
    choreApi.get.mockRejectedValue(
      Object.assign(new Error("boom"), {
        response: { data: { detail: "nope" } },
      }),
    );
    await store.fetchRooms();
    expect(store.error).toBe("nope");
  });

  it("leert loading auch im Fehlerfall", async () => {
    const store = useRoomStore();
    choreApi.get.mockRejectedValue(new Error("boom"));
    await store.fetchRooms();
    expect(store.loading).toBe(false);
  });
});
