<template>
  <div
    ref="overlayRef"
    :class="['log-overlay', { expanded: isExpanded }]"
    role="region"
    aria-label="Activity Log Overlay"
    @touchmove.stop
    @wheel.stop
  >
    <!-- Handle (visible when collapsed or always interactive) -->
    <div
      v-show="!isExpanded"
      class="handle"
      ref="handleRef"
      @click="toggleExpand"
      tabindex="0"
      role="button"
      aria-label="Expand activity log"
    >
      <div class="handle-bar"></div>
      <div class="handle-content" v-if="logStore.latestEntry">
        <!--
          Die Aktionsklasse traegt den Farbcode. Sie wird an `.entry-display`
          gesetzt, weil DIESES Element die Log-Aktionsachse aufspannt
          (`--log-action` -> `--log-action-ink` / `--log-action-tint`) —
          Handle und Expanded-Zeile teilen sich damit dieselbe Quelle.
        -->
        <div
          class="entry-display"
          :class="logActionClass(logStore.latestEntry.action)"
        >
          <span class="action-icon" aria-hidden="true">
            <span
              class="mdi"
              :class="logActionIcon(logStore.latestEntry.action)"
            ></span>
          </span>
          <span class="chore-pill" v-if="logStore.latestEntry.choreName">
            {{ logStore.latestEntry.choreName }}
          </span>
          <span class="action-text">{{
            logStore.latestEntry.actionDescription
          }}</span>
          <span class="user-text" v-if="logStore.latestEntry.user">
            by {{ logStore.latestEntry.user.split("@")[0] }}
          </span>
        </div>
        <div class="handle-right">
          <span class="time-ago">{{ logStore.latestEntry.timeAgo }}</span>
          <button
            class="revert-btn"
            @click.stop="handleRevert(logStore.latestEntry)"
            :disabled="logStore.latestEntry.isLocal"
            :aria-label="getRevertLabel(logStore.latestEntry)"
            :title="getRevertLabel(logStore.latestEntry)"
          >
            <span
              class="mdi"
              :class="getRevertIcon(logStore.latestEntry)"
            ></span>
          </button>
        </div>
      </div>
      <div class="handle-content empty" v-else>No recent activity</div>
    </div>

    <!-- Expanded Header -->
    <div v-show="isExpanded" class="expanded-header" @click="toggleExpand">
      <div class="handle-bar"></div>
      <div class="header-title-row">
        <h3>Activity Log</h3>
        <button
          class="close-btn"
          @click.stop="toggleExpand"
          aria-label="Collapse log"
        >
          <span class="mdi mdi-chevron-down"></span>
        </button>
      </div>
    </div>

    <!-- Expanded Content -->
    <div class="log-content" v-show="isExpanded">
      <div class="log-list" ref="logListRef">
        <div
          v-for="entry in logStore.visibleEntries"
          :key="entry.id"
          class="log-entry"
        >
          <div class="entry-info">
            <!-- Gleiche Aktionsklasse wie im Handle: beide Zeilen
                 sprechen dieselbe Codesprache. -->
            <div class="entry-display" :class="logActionClass(entry.action)">
              <span class="action-icon" aria-hidden="true">
                <span class="mdi" :class="logActionIcon(entry.action)"></span>
              </span>
              <span class="chore-pill" v-if="entry.choreName">{{
                entry.choreName
              }}</span>
              <span class="action-text">{{ entry.actionDescription }}</span>
              <span class="user-text" v-if="entry.user"
                >by {{ entry.user.split("@")[0] }}</span
              >
            </div>
            <span class="entry-time">{{ entry.timeAgo }}</span>
          </div>
          <button
            class="revert-btn"
            @click.stop="handleRevert(entry)"
            :disabled="entry.isLocal"
            :aria-label="getRevertLabel(entry)"
            :title="getRevertLabel(entry)"
          >
            <span class="mdi" :class="getRevertIcon(entry)"></span>
          </button>
        </div>

        <div v-if="logStore.loading" class="loading-indicator">
          <div class="loading-spinner"></div>
          <span>Loading...</span>
        </div>

        <div
          v-if="logStore.visibleEntries.length === 0 && !logStore.loading"
          class="empty-state"
        >
          No activity recorded yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from "vue";
import { useLogStore } from "@/stores/log";
import { logActionClass, logActionIcon } from "@/utils/logAction";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "update:isOpen"]);

const logStore = useLogStore();
const localExpanded = ref(false);
const overlayRef = ref(null);
const handleRef = ref(null);

const isExpanded = computed({
  get: () => props.isOpen || localExpanded.value,
  set: (val) => {
    localExpanded.value = val;
    emit("update:isOpen", val);
    if (!val) emit("close");
  },
});

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      logStore.fetchLogs();
    }
  },
);

onMounted(() => {
  logStore.fetchLogs();
});

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function getRevertLabel(entry) {
  if (entry?.action === "created" || entry?.action_type === "created")
    return "Archive";
  return "Undo";
}

function getRevertIcon(entry) {
  if (entry?.action === "created" || entry?.action_type === "created")
    return "mdi-archive";
  return "mdi-undo";
}

async function handleRevert(entry) {
  if (!entry || entry.isLocal) return;
  try {
    await logStore.undo(entry.id);
  } catch (err) {
    console.error("Undo failed:", err);
  }
}
</script>

<style scoped>
.log-overlay {
  position: fixed;
  bottom: 0;
  left: var(--md-sys-spacing-md);
  right: var(--md-sys-spacing-md);
  max-width: 900px;
  margin: 0 auto;
  background: var(--color-background);
  background-image:
    radial-gradient(
      120% 160% at 10% 90%,
      rgb(var(--md-sys-color-accent-warm-rgb) / 0.5) 0%,
      rgb(var(--md-sys-color-accent-warm-rgb) / 0) 45%
    ),
    radial-gradient(
      90% 120% at 90% 80%,
      rgb(var(--md-sys-color-accent-cool-rgb) / 0.5) 0%,
      rgb(var(--md-sys-color-accent-cool-rgb) / 0) 52%
    );
  color: var(--color-text);
  box-shadow: 0 -4px 24px color-mix(in srgb, var(--color-text) 15%, transparent);
  border-top-left-radius: var(--md-sys-radius-large);
  border-top-right-radius: var(--md-sys-radius-large);
  border: 1px solid var(--color-border-glass);
  border-bottom: none;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: var(--md-sys-zindex-overlay);
  max-height: 64px;
  overflow: hidden;
  backdrop-filter: blur(16px);
}

.log-overlay.expanded {
  max-height: 70vh;
  box-shadow: 0 -8px 32px color-mix(in srgb, var(--color-text) 25%, transparent);
}

.handle,
.expanded-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
}

.expanded-header {
  border-bottom: 1px solid var(--color-surface-lighter);
  padding-bottom: 10px;
}

.header-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.expanded-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  box-shadow: none;
  font-size: 1.3rem;
  padding: 2px 6px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: color-mix(in srgb, var(--color-text) 20%, transparent);
  border-radius: 2px;
  margin-bottom: 6px;
}

.handle-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
}

.handle-content.empty {
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.handle-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* === Aktions-Farbcode ==================================================
   Der Log kodiert jeden Eintrag nach Aktionstyp. Das ist die visuelle
   Sprache der ChoreCards, eine Ebene tiefer: die ChoreCard faerbt ihre
   FLAECHE nach Dringlichkeit, der Log-Eintrag faerbt ein Icon nach
   Aktion. Beide stammen aus derselben Token-Achse.

   `--log-action` setzt die Komponente pro Aktionsklasse (unten). Die
   beiden abgeleiteten Werte mischen in variables.css gegen
   `--color-text` und sind deshalb in beiden Themes kontraststark.
   Grund fuer die Mischung statt einer fertigen Farbe pro Aktion: die
   Pastell-Achsen (`--md-sys-color-completed`, `--color-archived`) sind
   im Light Mode ~1.1:1 gegen die Karte. Als Text, als Icon und als
   Fuellung fuer weisse Schrift sind sie unbrauchbar — sie sind als
   Flaeche gedacht. Details und Messwerte in variables.css. */
.entry-display {
  --log-action: var(--color-text-muted);
  --log-action-ink: color-mix(
    in srgb,
    var(--log-action) 32%,
    var(--color-text)
  );
  --log-action-tint: color-mix(in srgb, var(--log-action) 20%, transparent);

  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  /*
   * `nowrap` + `overflow: hidden` bleiben Pflicht: die Zeile bricht
   * nicht um, der Ueberhang wird am Ende abgeschnitten. Das ist der
   * dokumentierte Befund aus LogItem.vue — `nowrap` allein liess den
   * Titel aus der Karte laufen (247 px bei 150 % Schriftgroesse).
   */
  flex-wrap: nowrap;
  overflow: hidden;
}

/* Reihenfolge ist Semantik, nicht Geschmack: `unarchived` MUSS vor
   `archived` stehen, weil "chore:unarchived" das Wort "archived"
   enthaelt. Sonst kaeme jede Restoring-Aktion als "archived" daher. */
.entry-display.log-completed {
  --log-action: var(--md-sys-color-completed);
}
.entry-display.log-created {
  --log-action: var(--color-primary);
}
.entry-display.log-updated {
  --log-action: var(--md-sys-color-secondary);
}
.entry-display.log-unarchived {
  --log-action: var(--color-due-30-days);
}
.entry-display.log-archived {
  --log-action: var(--color-archived);
}
.entry-display.log-deleted {
  --log-action: var(--color-danger);
}

/* Ruecknehmen, Import, Export und unbekannte Aktionen teilen sich
   bewusst den neutralen Ton aus `:root`. Sie bekommen hier KEINE eigene
   Farbe, weil fuer sie keine freie semantische Achse existiert und
   eine erfundene besserwuenscht als eine falsche waere.
   Ausdruecklich ausgeschrieben statt dem Default ueberlassen: sonst
   waere "neutral" ein stiller Nebenwirkung des nicht getroffenen
   Falls und nicht eine Entscheidung. */
.entry-display.log-undone,
.entry-display.log-imported,
.entry-display.log-exported,
.entry-display.log-activity {
  --log-action: var(--color-text-muted);
}

/* Icon-Pille: traegt den Code. Fuellung ist die abgeleitete Tinte,
   nicht die Pastell-Achse — sonst waere das Glyph unsichtbar. */
.action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: var(--md-sys-radius-full);
  background: var(--log-action-ink);
  color: var(--color-on-accent);
  font-size: 0.9rem;
}

.chore-pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 3px 9px;
  /*
   * Der Chip traegt nur noch einen Hauch der Aktionsfarbe
   * (`--log-action-tint`) statt einer gefuellten Flaeche. Grund: der
   * Chore-Name ist Text, und Text auf 20 % Farbe ueber einer bereits
   * farbigen Glaskarte ist die schlechteste von allen Varianten. Die
   * Farbe kodiert die AKTION — das macht das Icon daneben. So bleibt
   * der Name in beiden Themes auf der Text-Achse und damit lesbar.
   */
  background: var(--log-action-tint);
  color: var(--color-text);
  border: 1px solid var(--color-border-glass-subtle);
  border-radius: var(--md-sys-radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  /*
   * Kurzform bleibt Pflicht, unveraendert bei 140 px.
   *
   * BEFUND (aus LogItem.vue): `white-space: nowrap` allein liess den
   * Chore-Titel aus der Karte laufen — bei 150 % Schriftgroesse waren
   * es 247 px Ueberlauf. Die drei gehoeren zusammen: eine eigene Box,
   * begrenzte Breite, Abschneiden statt Umbruch. Umbruch waere hier
   * zusaetzlich falsch, weil `.entry-display` `nowrap` ist — der Titel
   * wuerde die Zeile sprengen statt sich anzupassen.
   */
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.user-text {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  /*
   * Der Nutzer ist die entbehrlichste Angabe der Zeile. Ohne
   * `flex-shrink: 0` wuerde er als erstes zerdrueckt und der eigentliche
   * Inhalt beschnitten — das Umgekehrte ist richtig: der Chip und der
   * Aktionstext stehen links und duerfen ruhig abgeschnitten werden,
   * aber nie so weit, dass der Chore-Name unlesbar wird. `min-width: 0`
   * erlaubt dem Flex-Item das Schrumpfen ueberhaupt.
   */
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
}

.time-ago {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.revert-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 10px;
  border: 1px solid var(--color-border-glass);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    transform var(--transition-fast),
    background-color var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.revert-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  transform: translateY(-1px);
}

.revert-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.log-content {
  padding: 0 16px 16px;
  max-height: calc(70vh - 60px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  /*
   * Die Trennlinie war `--color-surface-lighter`, also rgba(255,255,255,
   * 0.55) im Light Mode. Auf einer hellen Flaeche ist eine weisse Linie
   * so gut wie unsichtbar — die Eintraege wirkten dadurch wie eine
   * formlose Liste. Dieselbe Zahl in Tinte, nur schwach: 8 % Tinte
   * trennt in beiden Themes, weil `--color-text` dem Theme folgt.
   * Der 8-%-Wert ist die einzige freie Zahl hier und dieselbe, die
   * ChoreCard fuer ihre Kartenkante benutzt.
   */
  border-bottom: 1px solid color-mix(in srgb, var(--color-text) 8%, transparent);
  gap: 12px;
}

.log-entry:last-child {
  border-bottom: none;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.entry-time {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}
</style>
