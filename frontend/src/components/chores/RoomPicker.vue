<template>
  <!--
    Raumauswahl: bestehenden Raum waehlen ODER direkt einen neuen anlegen.

    "Freitext + eigene Liste" war die ausdrueckliche Entscheidung: der
    Raumname ist Freitext, aber Farbe und Icon kommen aus einer
    kuratierten Liste. Ein voll freies Icon-Feld waere nicht moeglich —
    das Backend validiert Icons gegen eine Allowlist (der Icon landet als
    CSS-Klasse im Dokument) und wuerde alles andere mit 422 ablehnen.

    Das Room wird NICHT hier angelegt, sondern erst beim Speichern der
    Chore. Grund: eine halb ausgefuellte Chore soll keinen leeren Raum
    in der Haushaltsliste hinterlassen. `pendingRoom` haelt den Entwurf,
    `onSubmit` gibt ihn nach aussen.
  -->
  <div class="room-picker">
    <label class="room-picker__label" :for="selectId">Room</label>

    <div class="room-picker__row">
      <select
        :id="selectId"
        class="room-picker__select"
        :value="selectedValue"
        @change="onSelect"
      >
        <option value="">No room</option>
        <option v-for="room in rooms" :key="room.id" :value="String(room.id)">
          {{ room.name }}{{ room.isPersonal ? " (personal)" : "" }}
        </option>
        <option v-if="pendingRoom" :value="NEW_ROOM_VALUE">
          + {{ pendingRoom.name }} (new)
        </option>
      </select>

      <button
        type="button"
        class="room-picker__toggle"
        :aria-expanded="showCreator"
        @click="showCreator = !showCreator"
      >
        <span
          class="mdi"
          :class="showCreator ? 'mdi-close' : 'mdi-plus'"
        ></span>
        New
      </button>
    </div>

    <!-- Vorschau des aktuell gewaehlten Raums -->
    <div v-if="activeRoom" class="room-picker__preview">
      <RoomChip :room="activeRoom" />
    </div>

    <!-- Neu anlegen -->
    <div v-if="showCreator" class="room-picker__creator">
      <input
        :id="nameId"
        v-model="draft.name"
        type="text"
        class="room-picker__input"
        placeholder="Room name (e.g. Keller)"
        maxlength="100"
      />

      <div class="room-picker__colors" role="group" aria-label="Room color">
        <button
          v-for="preset in ROOM_COLOR_PRESETS"
          :key="preset.value"
          type="button"
          class="room-picker__swatch"
          :class="{ 'is-active': draft.color === preset.value }"
          :style="{ backgroundColor: preset.value }"
          :title="preset.name"
          :aria-label="preset.name"
          :aria-pressed="draft.color === preset.value"
          @click="draft.color = preset.value"
        ></button>
        <input
          v-model="draft.color"
          type="color"
          class="room-picker__color-input"
          title="Custom color"
          aria-label="Custom color"
        />
      </div>

      <div class="room-picker__icons" role="group" aria-label="Room icon">
        <button
          v-for="icon in ROOM_ICONS"
          :key="icon"
          type="button"
          class="room-picker__icon"
          :class="{ 'is-active': draft.icon === icon }"
          :title="icon"
          :aria-label="icon"
          :aria-pressed="draft.icon === icon"
          @click="draft.icon = icon"
        >
          <span class="mdi" :class="`mdi-${icon}`"></span>
        </button>
      </div>

      <label class="room-picker__personal">
        <input v-model="draft.isPersonal" type="checkbox" />
        <span>Personal room (special treatment)</span>
      </label>
    </div>

    <p v-if="error" class="room-picker__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRoomStore } from "@/stores/room";
import {
  ROOM_ICONS,
  ROOM_COLOR_PRESETS,
  DEFAULT_ROOM_COLOR,
  DEFAULT_ROOM_ICON,
} from "@/constants/roomIcons";
import RoomChip from "@/components/chores/RoomChip.vue";

/** Sentinel im <select>. Nie eine echte room_id — die sind Integer. */
const NEW_ROOM_VALUE = "__new__";

const props = defineProps({
  /** roomId: number | null. null = kein Raum. */
  modelValue: { type: [Number, String, null], default: null },
  /** Eigene IDs, damit zwei Picker auf einer Seite nicht kollidieren. */
  idPrefix: { type: String, default: "room-picker" },
});

const emit = defineEmits(["update:modelValue", "update:pendingRoom"]);

const roomStore = useRoomStore();
const rooms = computed(() => roomStore.rooms);
const selectId = computed(() => `${props.idPrefix}-select`);
const nameId = computed(() => `${props.idPrefix}-name`);

const showCreator = ref(false);
const error = ref(null);

// Die Raumliste wird hier geladen, weil der Picker der erste Ort ist, an
// dem sie gebraucht wird. `fetchRooms` ist selbst-fehlertolerant: gibt es
// noch keine rooms-Tabelle (Prod noch nicht migriert), bleibt die Liste
// leer und der Picker zeigt nur "No room" + "New" — die App laeuft weiter.
onMounted(() => {
  if (!roomStore.rooms.length) roomStore.fetchRooms();
});

const draft = ref({
  name: "",
  color: DEFAULT_ROOM_COLOR,
  icon: DEFAULT_ROOM_ICON,
  isPersonal: false,
});

/** Entwurf fuer einen Raum, der erst beim Speichern der Chore entsteht. */
const pendingRoom = ref(null);

watch(
  () => props.modelValue,
  (val) => {
    // Beim Wechsel des Werts von aussen (z.B. Edit auf einen anderen
    // Chore) einen noch nicht gespeicherten Entwurf verwerfen — er
    // gehoert zu einem anderen Chore und wuerde sonst den falschen Raum
    // zuweisen.
    if (val === null || val === undefined || val === "") {
      pendingRoom.value = null;
      showCreator.value = false;
    }
  },
);

// Der Wert im <select>: pendingRoom hat Vorrang, sonst die room_id.
const selectedValue = computed(() => {
  if (pendingRoom.value) return NEW_ROOM_VALUE;
  if (props.modelValue === null || props.modelValue === undefined) return "";
  return String(props.modelValue);
});

/**
 * Der Raum, der gerade gewaehlt ist — als Objekt, damit die Vorschau
 * den Chip exakt so zeigt, wie er spaeter auf der Karte steht.
 */
const activeRoom = computed(() => {
  if (pendingRoom.value) return pendingRoom.value;
  if (props.modelValue === null || props.modelValue === undefined) return null;
  return roomStore.roomById.get(Number(props.modelValue)) || null;
});

function onSelect(event) {
  const value = event.target.value;
  error.value = null;
  if (value === NEW_ROOM_VALUE) {
    pendingRoom.value = { ...draft.value };
    emit("update:modelValue", null);
    emit("update:pendingRoom", pendingRoom.value);
    return;
  }
  pendingRoom.value = null;
  emit("update:pendingRoom", null);
  emit("update:modelValue", value === "" ? null : Number(value));
}

// Der Entwurf lebt mit: sobald Name/Farbe/Icon sich aendern, muss auch
// der wartende Raum mitziehen, sonst zeigt die Vorschau einen anderen
// Raum als gespeichert wird.
watch(
  draft,
  (val) => {
    if (!pendingRoom.value) return;
    if (!val.name?.trim()) return;
    pendingRoom.value = { ...val };
    emit("update:pendingRoom", pendingRoom.value);
  },
  { deep: true },
);

/** Von aussen lesbar: der Entwurf, den der Parent anlegen soll. */
function getPendingRoom() {
  if (!pendingRoom.value?.name?.trim()) return null;
  return { ...pendingRoom.value, name: pendingRoom.value.name.trim() };
}

defineExpose({ getPendingRoom });
</script>

<style scoped>
.room-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-picker__label {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.room-picker__row {
  display: flex;
  gap: 8px;
}

.room-picker__select,
.room-picker__input {
  flex: 1;
  min-width: 0;
  padding: 0.55rem 0.7rem;
  border-radius: var(--md-sys-radius-small);
  border: 1px solid var(--color-surface-lighter);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.9rem;
}

.room-picker__toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0.55rem 0.7rem;
  border-radius: var(--md-sys-radius-small);
  border: 1px solid var(--color-surface-lighter);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.room-picker__toggle:hover {
  background: var(--color-surface-light);
}

.room-picker__preview {
  display: flex;
  padding: 2px 0;
}

.room-picker__creator {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--md-sys-radius-small);
  background: var(--color-surface-overlay-soft);
  border: 1px solid var(--color-surface-lighter);
}

.room-picker__colors {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.room-picker__swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.room-picker__swatch.is-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-background);
}

.room-picker__color-input {
  width: 30px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--color-surface-lighter);
  border-radius: var(--md-sys-radius-small);
  background: var(--color-surface);
  cursor: pointer;
}

.room-picker__icons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(34px, 1fr));
  gap: 4px;
  max-height: 108px;
  overflow-y: auto;
}

.room-picker__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: var(--md-sys-radius-small);
  border: 1px solid transparent;
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1rem;
}

.room-picker__icon.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-container);
}

.room-picker__personal {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
}

.room-picker__error {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-danger);
}
</style>
