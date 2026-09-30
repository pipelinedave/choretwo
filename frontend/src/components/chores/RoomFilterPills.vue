<template>
  <!--
    Die Raum-Filterzeile — zweite Achse neben der Faelligkeit.

    SIEHE FilterPills.vue: dieses Bild ist dort festgelegt (Pille, Rand,
    Zaehler-Badge, Clear-Knopf links, `pill-count`-Analogon). Diese
    Komponente ist eine eigene Datei, KEINE Erweiterung von FilterPills —
    die beiden Zeilen duerfen sich nicht gegenseitig in die Karten
    drehen. Sie teilen sich nur die Tokens, damit das Bild gleich bleibt.

    Bewusst zwei weiche Punkte, aus denen dieser Auftrag besteht:

      1. Beide Achsen gleichzeitig. Der Klick auf eine Raum-Pille aendert
         NUR `roomFilter`; `filter` (Faelligkeit) bleibt, was es war. Der
         Zaehler an der Pille sagt vorher, wie viele Chores dieser Raum
         innerhalb der aktuellen Faelligkeit behaelt.
      2. Der Clear-Knopf loescht nur den Raumfilter. Es gibt einen zweiten,
         genau neben der Faelligkeits-Zeile, der nur die Faelligkeit
         loescht. Siehe die Begruendung am `clearRoomFilter`-Aufruf.
  -->
  <div v-if="hasAnyRoom" class="room-filter-row">
    <transition name="fade">
      <button
        v-if="selectedRoomId !== null"
        class="room-filter-clear"
        type="button"
        @click="emit('clear')"
        aria-label="Clear room filter"
        title="Clear room filter"
      >
        <span class="mdi mdi-close"></span>
      </button>
    </transition>

    <div class="room-filter-pills" role="group" aria-label="Filter by room">
      <button
        v-for="room in visibleRooms"
        :key="room.id"
        class="room-pill"
        :class="{
          'room-pill--active': isSelected(room),
          'room-pill--personal': room.isPersonal,
        }"
        :style="styleFor(room)"
        type="button"
        :aria-pressed="isSelected(room)"
        :title="roomTitle(room)"
        @click="emit('update:roomFilter', toggleId(room))"
      >
        <span class="mdi room-pill__icon" :class="`mdi-${room.icon}`"></span>
        <span class="room-pill__label">{{ room.name }}</span>
        <span class="room-pill-count">{{ countFor(room) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { roomPalette } from "@/utils/roomColor";
import { useRoomStore } from "@/stores/room";

/**
 * Der Raumfilter als controlled component.
 *
 * Props + Emits statt direktem Store-Zugriff: die Zeile ist damit
 * testbar ohne Pinia-Aufbau (FilterPills.spec.js macht das so) und die
 * View entscheidet, was passiert. Die RAUM-LISTE kommt trotzdem aus dem
 * room-Store — eine eigene Quelle waere eine zweite Wahrheit, und genau
 * die soll es hier nicht geben.
 */
const props = defineProps({
  /** Aktiver Raum oder null (= keine Raumauswahl). */
  roomFilter: { type: [Number, String, null], default: null },
  /** Zaehler je Raum-ID, aus `choreStore.roomCounts`. */
  counts: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:roomFilter", "clear"]);

const roomStore = useRoomStore();

/**
 * Welche Raeume eine Pille bekommen.
 *
 * ENTSCHEIDUNG: Raeume ohne Chore erscheinen NICHT (kein Chip mit "0").
 * Begruendung: eine Pille mit Null ist eine Einladung, eine leere Liste
 * zu erzeugen — sie behauptet per Zahlenbadge, es gaebe dort etwas zu
 * sehen. Bei 11 Raeumen sind das bis zu 11 Knoepfe, von denen die
 * Haelfte tot ist. Sichtbar bleibt stattdessen nur, was tatsaechlich
 * filtert. Wer einen Raum mit 0 Chores gezielt sucht, hat ohnehin
 * nichts zu sehen — und er/sie bekommt ihn im Raum-Picker beim Anlegen
 * eines Chores.
 *
 * Sortiert wird nach `sortOrder` — der Reihenfolge, die auch
 * RoomsSettings.vue anzeigt. Eine eigene Sortierung hier wuerde die
 * Raeume in der Filterzeile anders ordnen als in der Verwaltung.
 */
const visibleRooms = computed(() => {
  const counts = props.counts || {};
  return [...roomStore.rooms]
    .filter((r) => (counts[r.id] || 0) > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
});

/**
 * Gibt es ueberhaupt eine Zeile? Ohneraeume (unmigrierte DB, API-Ausfall
 * — der room-Store faellt dann bewusst auf eine leere Liste zurueck)
 * soll die Chores-Liste nicht eine einsame, leere Filterzeile zeigen.
 */
const hasAnyRoom = computed(() => visibleRooms.value.length > 0);

/** null heisst "kein Raum gesetzt" — der Wert, mit dem zurueckgeschaltet wird. */
const selectedRoomId = computed(() =>
  props.roomFilter === undefined ? null : (props.roomFilter ?? null),
);

const isSelected = (room) => selectedRoomId.value === room.id;

function toggleId(room) {
  return isSelected(room) ? null : room.id;
}

function countFor(room) {
  return (props.counts || {})[room.id] || 0;
}

/**
 * Farbe und Typografie aus `roomPalette` — derselbe Aufruf wie in
 * RoomChip.vue. Deshalb sieht ein Raum in Karte und Filter gleich aus;
 * das ist keine Absichtserklaerung, sondern eine geteilte Funktion.
 */
function styleFor(room) {
  const { fill, ink, edge } = roomPalette(room.color);
  return {
    backgroundColor: fill,
    color: ink,
    borderColor: edge,
  };
}

const roomTitle = (room) =>
  room.isPersonal ? `${room.name} — persönlich` : room.name;
</script>

<style scoped>
/*
 * Geometrie und Farb-Chroma sind dieselben Tokens wie im Raum-Chip
 * (--room-chip-*). Wer die Chip-Groesse aendert, aendert damit beide
 * Darstellungen — was die Anforderung "ein Raum sieht in Karte und
 * Filter gleich aus" ueber die Farbe hinaus auch geometrisch einloest.
 *
 * Kein eigener Farbwert im CSS: die Raumfarbe kommt per Inline-Style aus
 * roomPalette(). `design-tokens.spec.js` wuerde eine Custom-Property-
 * Referenz fuer die Raumfarbe als undefiniertes Token failen.
 */
.room-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--md-sys-spacing-sm);
  width: 100%;
}

.room-filter-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  min-width: 38px;
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-surface-lighter);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition:
    transform var(--transition-fast),
    background-color var(--transition-fast);
}

.room-filter-clear:hover {
  background: var(--color-danger);
  color: white;
  transform: scale(1.05);
}

.room-filter-pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  flex: 1;
}

.room-filter-pills::-webkit-scrollbar {
  display: none;
}

.room-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--room-chip-padding-y) var(--room-chip-padding-x);
  border-radius: var(--room-chip-radius);
  border: var(--room-chip-border-width) solid var(--color-border-glass-subtle);
  box-shadow: var(--room-chip-shadow), var(--room-chip-inset);
  font-size: var(--room-chip-font-size);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0.82;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);
}

.room-pill:hover {
  transform: translateY(-1px);
  opacity: 1;
}

.room-pill--active {
  opacity: 1;
  transform: translateY(-1px);
  /*
   * Ring in der Theme-Primärfarbe, nicht in der Raumfarbe: er markiert
   * "diese Achse ist gesetzt" und muss deshalb in JEDEM Raum gleich
   * aussehen. Ein Raum-farbener Ring waere bei drei Raumpaaren mit
   * identischer Pastellfarbe optisch nicht von "gar nicht aktiv" zu
   * unterscheiden. Gleiches Muster wie FilterPills.
   */
  box-shadow:
    0 0 0 2px var(--color-primary),
    var(--room-chip-shadow),
    var(--room-chip-inset);
}

/*
 * Persoenlicher Raum (Dave) traegt dieselbe Hut-Silhouette wie der Chip.
 * `room-chip-personal-*` heisst hier nicht "Chip-spezifisch", sondern
 * "Raum ist persoenlich" — die Datei gibt nur die Tokens aus.
 */
.room-pill--personal {
  border-radius: var(--room-chip-radius) var(--room-chip-radius)
    var(--room-chip-personal-tip-radius) var(--room-chip-personal-tip-radius);
  font-weight: 700;
}

.room-pill__icon {
  font-size: 0.95em;
  line-height: 1;
  flex-shrink: 0;
}

.room-pill--personal .room-pill__icon {
  font-size: 1.05em;
}

/*
 * Das Zahlen-Badge ist das `pill-count`-Analogon der Faelligkeits-Zeile —
 * gleiche Masse, gleiche Form, gleiche Schriftgroesse, damit die Zeilen
 * als ein Bild gelesen werden. Die Textfarbe kommt aus `currentColor`,
 * also aus dem Inline-Style des Raums: der Zaehler muss auf JEDER
 * Pastellfarbe lesbar sein, nicht nur auf der des gerade gewaehlten Raums.
 */
.room-pill-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  color: inherit;
  font-size: 0.75rem;
  font-weight: 700;
}

.room-pill--active .room-pill-count {
  background: color-mix(in srgb, currentColor 28%, transparent);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
