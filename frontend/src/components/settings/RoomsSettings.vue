<template>
  <section class="settings-section card">
    <div class="section-header">
      <div class="section-icon">
        <span class="mdi mdi-home-map-marker"></span>
      </div>
      <div>
        <h2 class="section-title">Rooms</h2>
        <p class="section-subtitle">
          Chores belong to a room — the room shows as a colored chip on the card
        </p>
      </div>
    </div>

    <p v-if="roomStore.loading" class="rooms-hint">Loading rooms…</p>

    <p v-else-if="roomStore.error" class="rooms-error" role="alert">
      {{ roomStore.error }}
      <button class="btn btn-text" @click="roomStore.fetchRooms()">
        Retry
      </button>
    </p>

    <!-- Liste -->
    <ul v-if="roomStore.rooms.length" class="rooms-list">
      <li v-for="room in roomStore.rooms" :key="room.id" class="rooms-item">
        <RoomChip :room="room" />

        <span v-if="room.isPersonal" class="rooms-badge">personal</span>

        <div class="rooms-actions">
          <button
            class="btn btn-text rooms-btn"
            :aria-label="`Edit ${room.name}`"
            :title="`Edit ${room.name}`"
            @click="startEdit(room)"
          >
            <span class="mdi mdi-pencil"></span>
          </button>
          <button
            class="btn btn-text rooms-btn rooms-btn--danger"
            :aria-label="`Delete ${room.name}`"
            :title="`Delete ${room.name}`"
            @click="askDelete(room)"
          >
            <span class="mdi mdi-delete"></span>
          </button>
        </div>
      </li>
    </ul>

    <p v-else class="rooms-hint">
      No rooms yet. Add one below — a chore does not need a room, but with one
      its title can stay short ("Boden wischen" instead of "Boden wischen
      Schlafzimmer").
    </p>

    <!-- Bearbeiten / Anlegen: dasselbe Formular, zwei Modi -->
    <form class="rooms-form" @submit.prevent="submit">
      <h3 class="rooms-form__title">
        {{ editing ? `Edit "${editing.name}"` : "New room" }}
      </h3>

      <div v-if="editing" class="rooms-form__row">
        <input
          v-model="draft.name"
          type="text"
          class="rooms-input"
          placeholder="Room name (e.g. Keller)"
          maxlength="100"
          required
        />
      </div>

      <div class="rooms-form__colors" role="group" aria-label="Room color">
        <button
          v-for="preset in ROOM_COLOR_PRESETS"
          :key="preset.value"
          type="button"
          class="rooms-swatch"
          :class="{ 'is-active': draft.color === preset.value }"
          :style="{ backgroundColor: preset.value }"
          :title="preset.name"
          :aria-label="preset.name"
          :aria-pressed="draft.color === preset.value"
          @click="draft.color = preset.value"
        ></button>
        <label class="rooms-custom-color">
          <span class="mdi mdi-eyedropper"></span>
          <input
            v-model="draft.color"
            type="color"
            aria-label="Custom color"
            title="Custom color"
          />
        </label>
      </div>

      <div class="rooms-form__icons" role="group" aria-label="Room icon">
        <button
          v-for="icon in ROOM_ICONS"
          :key="icon"
          type="button"
          class="rooms-icon"
          :class="{ 'is-active': draft.icon === icon }"
          :title="icon"
          :aria-label="icon"
          :aria-pressed="draft.icon === icon"
          @click="draft.icon = icon"
        >
          <span class="mdi" :class="`mdi-${icon}`"></span>
        </button>
      </div>

      <label class="rooms-personal">
        <input v-model="draft.isPersonal" type="checkbox" />
        <span>
          Personal room — special treatment
          <small>
            Renders as a pointed chip with a double border on every card.
          </small>
        </span>
      </label>

      <p v-if="formError" class="rooms-error" role="alert">{{ formError }}</p>

      <div class="rooms-form__actions">
        <button
          v-if="editing"
          type="button"
          class="btn btn-tonal"
          @click="cancelEdit"
        >
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          {{ editing ? "Save" : "Add room" }}
        </button>
      </div>
    </form>

    <!-- Loeschen-Bestaetigung -->
    <div v-if="pendingDelete" class="rooms-confirm">
      <p>
        Delete room <strong>{{ pendingDelete.name }}</strong
        >?<br />
        Its chores are <strong>kept</strong> — they simply lose their room.
      </p>
      <div class="rooms-form__actions">
        <button class="btn btn-tonal" @click="pendingDelete = null">
          Cancel
        </button>
        <button class="btn btn-danger" @click="confirmDelete">Delete</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { useRoomStore } from "@/stores/room";
import { useChoreStore } from "@/stores/chore";
import {
  ROOM_ICONS,
  ROOM_COLOR_PRESETS,
  DEFAULT_ROOM_COLOR,
  DEFAULT_ROOM_ICON,
} from "@/constants/roomIcons";
import RoomChip from "@/components/chores/RoomChip.vue";

const roomStore = useRoomStore();
const choreStore = useChoreStore();

const editing = ref(null); // null = "neuer Raum"
const pendingDelete = ref(null);
const saving = ref(false);
const formError = ref(null);

const draft = reactive({
  name: "",
  color: DEFAULT_ROOM_COLOR,
  icon: DEFAULT_ROOM_ICON,
  isPersonal: false,
});

onMounted(() => {
  if (!roomStore.rooms.length) roomStore.fetchRooms();
});

function resetDraft() {
  draft.name = "";
  draft.color = DEFAULT_ROOM_COLOR;
  draft.icon = DEFAULT_ROOM_ICON;
  draft.isPersonal = false;
  formError.value = null;
}

function startEdit(room) {
  editing.value = room;
  draft.name = room.name;
  draft.color = room.color;
  draft.icon = room.icon;
  draft.isPersonal = !!room.isPersonal;
  formError.value = null;
}

function cancelEdit() {
  editing.value = null;
  resetDraft();
}

function askDelete(room) {
  pendingDelete.value = room;
}

async function confirmDelete() {
  const room = pendingDelete.value;
  pendingDelete.value = null;
  try {
    await roomStore.deleteRoom(room.id);
    // Die Chores haben ihren Raum verloren (ON DELETE SET NULL im
    // Backend). Lokal nachziehen, sonst zeigt der Chip weiter den
    // geloeschten Raum an, bis ein Reload kommt.
    await choreStore.fetchChores();
    if (editing.value?.id === room.id) cancelEdit();
  } catch (err) {
    formError.value = err?.response?.data?.detail || "Could not delete room";
  }
}

async function submit() {
  formError.value = null;
  saving.value = true;
  try {
    const payload = {
      name: draft.name.trim(),
      color: draft.color,
      icon: draft.icon,
      isPersonal: !!draft.isPersonal,
    };

    if (editing.value) {
      await roomStore.updateRoom(editing.value.id, payload);
      // Farbe/Icon haben sich geaendert -> die Chores betrifft das direkt,
      // weil sie den Raum eingebettet bekommen haben.
      await choreStore.fetchChores();
    } else {
      await roomStore.createRoom({ ...payload, sortOrder: 0 });
    }
    editing.value = null;
    resetDraft();
  } catch (err) {
    // 409 = Name vergeben. Das ist der haeufigste Fehler hier und der
    // Text kommt vom Backend, deshalb direkt durchreichen.
    formError.value =
      err?.response?.data?.detail || err?.message || "Could not save room";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.rooms-hint {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem;
}

.rooms-error {
  font-size: 0.82rem;
  color: var(--color-danger);
  margin: 0.25rem 0;
}

.rooms-list {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rooms-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border-radius: var(--md-sys-radius-small);
  background: var(--color-surface-overlay-soft);
  border: 1px solid var(--color-surface-lighter);
}

.rooms-badge {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-dim);
}

.rooms-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
}

.rooms-btn {
  padding: 4px 6px;
  min-height: 0;
  color: var(--color-text-muted);
}

.rooms-btn--danger:hover {
  color: var(--color-danger);
}

.rooms-form {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px;
  border-radius: var(--md-sys-radius-small);
  background: var(--color-surface-overlay-soft);
  border: 1px solid var(--color-surface-lighter);
}

.rooms-form__title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.rooms-input {
  width: 100%;
  padding: 0.55rem 0.7rem;
  border-radius: var(--md-sys-radius-small);
  border: 1px solid var(--color-surface-lighter);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.9rem;
}

.rooms-form__colors {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rooms-swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.rooms-swatch.is-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-background);
}

.rooms-custom-color {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid var(--color-surface-lighter);
  border-radius: var(--md-sys-radius-small);
  cursor: pointer;
  color: var(--color-text-muted);
}

.rooms-custom-color input[type="color"] {
  width: 24px;
  height: 22px;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}

.rooms-form__icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 4px;
  max-height: 124px;
  overflow-y: auto;
}

.rooms-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: var(--md-sys-radius-small);
  border: 1px solid transparent;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.05rem;
}

.rooms-icon.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-container);
}

.rooms-personal {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
}

.rooms-personal small {
  display: block;
  font-weight: 400;
  font-size: 0.75rem;
  color: var(--color-text-dim);
}

.rooms-form__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.rooms-confirm {
  margin-top: 0.85rem;
  padding: 11px;
  border-radius: var(--md-sys-radius-small);
  border: 1px solid var(--color-danger);
  background: var(--color-surface-overlay-soft);
  font-size: 0.85rem;
}

.rooms-confirm p {
  margin: 0 0 0.6rem;
}
</style>
