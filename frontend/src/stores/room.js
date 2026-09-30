import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { choreApi } from "@/api";

/**
 * snake_case -> camelCase, Spiegeldienst zu `normalizeChore` in
 * stores/chore.js (dort steht der Grund fuer dieses Muster). Das Backend
 * liefert durchgaengig snake_case, das Frontend rechnet camelCase — der
 * Normalisierer haelt beide Schreibweisen bereit, damit Komponenten
 * nicht auf eine davon angewiesen sind.
 */
const normalizeRoom = (raw) => {
  const r = raw?.room || raw || {};
  return {
    ...r,
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    isPersonal: !!(r.is_personal ?? r.isPersonal),
    is_personal: !!(r.is_personal ?? r.isPersonal),
    sortOrder: r.sort_order ?? r.sortOrder ?? 0,
    sort_order: r.sort_order ?? r.sortOrder ?? 0,
    createdAt: r.created_at || r.createdAt || null,
    updatedAt: r.updated_at || r.updatedAt || null,
  };
};

/** Fehlertext aus einer Axios-Fehlermeldung. 409 = Name vergeben. */
function toMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return err?.message || fallback;
}

export const useRoomStore = defineStore("rooms", () => {
  const rooms = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Einfache Lookups fuer Komponenten, die einen Raum per ID brauchen
  // (ChoreCard bekommt den Raum zwar eingebettet, die Raumauswahl im
  // Formular aber nicht).
  const roomById = computed(() => {
    const map = new Map();
    for (const r of rooms.value) map.set(r.id, r);
    return map;
  });

  const personalRooms = computed(() => rooms.value.filter((r) => r.isPersonal));

  const roomNames = computed(() => rooms.value.map((r) => r.name));

  async function fetchRooms() {
    loading.value = true;
    error.value = null;
    try {
      const response = await choreApi.get("/rooms");
      rooms.value = (response.data || []).map(normalizeRoom);
      return rooms.value;
    } catch (err) {
      // Nicht fatal: die App muss auch ohne Raum-Endpunkt laufen
      // (z.B. noch nicht migrierte Prod-DB). Dann gibt es nur keine
      // Raeume, aber weiterhin Chores.
      error.value = toMessage(err, "Failed to load rooms");
      rooms.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Legt einen Raum an. Wirft bei 409 (Name vergeben) — der Aufrufer
   * entscheidet, wie er das dem User zeigt. Bewusst NICHT geschluckt:
   * ein stilles Scheitern waere hier ein Datenverlust.
   */
  async function createRoom(payload) {
    const response = await choreApi.post("/rooms", {
      name: payload.name,
      color: payload.color,
      icon: payload.icon,
      is_personal: !!payload.isPersonal,
      sort_order: payload.sortOrder ?? 0,
    });
    const room = normalizeRoom(response.data);
    rooms.value = [...rooms.value, room].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    return room;
  }

  async function updateRoom(id, payload) {
    const body = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.color !== undefined) body.color = payload.color;
    if (payload.icon !== undefined) body.icon = payload.icon;
    if (payload.isPersonal !== undefined) {
      body.is_personal = !!payload.isPersonal;
    }
    if (payload.sortOrder !== undefined) body.sort_order = payload.sortOrder;

    const response = await choreApi.patch(`/rooms/${id}`, body);
    const room = normalizeRoom(response.data);
    rooms.value = rooms.value
      .map((r) => (r.id === id ? room : r))
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
    return room;
  }

  /**
   * Loescht einen Raum. Die Chores, die ihn hatten, bleiben bestehen und
   * werden raumlos — das Backend regelt das per ON DELETE SET NULL.
   * Deshalb wird hier nur die Raumliste angefasst; die Chores holt der
   * Aufrufer neu (`choreStore.fetchChores()`).
   */
  async function deleteRoom(id) {
    await choreApi.delete(`/rooms/${id}`);
    rooms.value = rooms.value.filter((r) => r.id !== id);
  }

  return {
    rooms,
    loading,
    error,
    roomById,
    personalRooms,
    roomNames,
    fetchRooms,
    createRoom,
    updateRoom,
    deleteRoom,
  };
});
