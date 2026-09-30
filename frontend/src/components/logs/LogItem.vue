<template>
  <div class="log-item card">
    <div class="log-item-icon" :class="logClass">
      <span class="mdi" :class="logIcon"></span>
    </div>

    <div class="log-item-content">
      <p class="log-item-text">
        <strong>{{ log.user_email?.split("@")[0] || "Unknown" }}</strong>
        {{ actionText }}
        <strong class="log-chore-title">{{ choreDisplayTitle }}</strong>
      </p>
      <p class="log-item-time">{{ formatTime(log.timestamp) }}</p>
    </div>

    <button v-if="canUndo" @click="handleUndo" class="btn btn-tonal btn-undo">
      Undo
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  logActionClass,
  logActionIcon,
  logActionText,
} from "@/utils/logAction";

const props = defineProps({
  log: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["undo"]);

const canUndo = computed(() => {
  const undoableActions = [
    "chore:completed",
    "chore:created",
    "chore:updated",
    "chore:archived",
  ];
  return undoableActions.includes(props.log.action);
});

/*
 * Semantik kommt aus utils/logAction.js — dieselbe Quelle, die
 * LogOverlay.vue benutzt. Vorher stand hier eine eigene
 * if-Kette, und die war bereits falsch: `archived` wurde vor
 * `unarchived` geprueft, also war "chore:unarchived" unerreichbar und
 * wurde als "archived" beschriftet UND eingefaerbt. Details in der Util.
 */
const logClass = computed(() => logActionClass(props.log.action));
const logIcon = computed(() => logActionIcon(props.log.action));
const actionText = computed(() => logActionText(props.log.action));

const choreDisplayTitle = computed(() => {
  if (props.log.chore_title) return props.log.chore_title;
  const resourceType = props.log.resource_type;
  if (resourceType === "chore") return "a chore";
  return "something";
});

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function handleUndo() {
  emit("undo", props.log.id);
}
</script>

<style scoped>
.log-item {
  display: flex;
  align-items: flex-start;
  gap: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-sm);
}

.log-item-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--md-sys-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--log-action-ink);
  color: var(--color-on-accent);
}

/* === Aktions-Farbcode ==================================================
   Dieselbe Achse wie in LogOverlay.vue und dieselbe Quelle
   (`--log-action*` aus variables.css), damit /logs und das Activity-Log
   auf Home dieselbe Codesprache sprechen. Die Semantik (welche Aktion
   welche Klasse und welches Icon bekommt) steht in utils/logAction.js —
   hier nur die Farbe.

   Vorher stand hier `color: white` auf `--md-sys-color-completed`, also
   weisses Glyph auf #d3ead8: 1.27:1 im Light Mode, bei
   `--color-archived` 1.43:1. Die 3:1-Grenze fuer grafische Objekte
   (WCAG 1.4.11) ist damit klar verfehlt — ein Kontrastfehler, kein
   Geschmack. Die abgeleitete Tinte loest das und liegt in beiden
   Themes ueber 5:1. */
.log-item-icon {
  --log-action: var(--color-text-muted);
  --log-action-ink: color-mix(
    in srgb,
    var(--log-action) 32%,
    var(--color-text)
  );
}

.log-item-icon.log-completed {
  --log-action: var(--md-sys-color-completed);
}
.log-item-icon.log-created {
  --log-action: var(--color-primary);
}
.log-item-icon.log-updated {
  --log-action: var(--md-sys-color-secondary);
}
.log-item-icon.log-unarchived {
  --log-action: var(--color-due-30-days);
}
.log-item-icon.log-archived {
  --log-action: var(--color-archived);
}
.log-item-icon.log-deleted {
  --log-action: var(--color-danger);
}

/* Wie im LogOverlay: neutral, aber ausdruecklich. Siehe dort. */
.log-item-icon.log-undone,
.log-item-icon.log-imported,
.log-item-icon.log-exported,
.log-item-icon.log-activity {
  --log-action: var(--color-text-muted);
}

.log-item-content {
  flex: 1;
  min-width: 0;
}

.log-item-text {
  font-size: var(--md-sys-typescale-body-medium);
  color: var(--md-sys-color-on-surface);
  margin-bottom: 4px;
  word-break: break-word;
}

.log-chore-title {
  /*
   * Einszeilig ja, aber KUERZEN statt aus der Karte laufen.
   *
   * BEFUND: `white-space: nowrap` allein liess den Chore-Titel aus der
   * Log-Karte laufen — `.log-item-text` hatte scrollWidth 390 bei
   * clientWidth 290, und /logs lief bereits bei 100 % Schriftgroesse 67 px
   * ueber den Viewport. Bei 150 % waren es 247 px.
   *
   * `text-overflow: ellipsis` wirkt nur zusammen mit `overflow: hidden` und
   * `white-space: nowrap` — die drei gehoeren zusammen. Zusaetzlich `block`,
   * weil die Kurzform auf Inline-Elementen nicht greift: sie braucht eine
   * eigene Box, deren Breite begrenzt werden kann.
   *
   * Umbruch statt Abschneiden waere hier falsch: eine Log-Zeile ist ein
   * Einzeiler, ein mehrzeiliger Titel zerlegt das Raster.
   */
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.log-item-time {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.btn-undo {
  flex-shrink: 0;
  padding: var(--md-sys-spacing-xs) var(--md-sys-spacing-md);
  font-size: var(--md-sys-typescale-label-medium);
}
</style>
