<template>
  <div class="catchup-view">
    <!-- Header -->
    <div class="catchup-header">
      <button class="back-btn" @click="$router.push('/')" aria-label="Zurück">
        <span class="mdi mdi-arrow-left"></span>
        <span>Zurück</span>
      </button>

      <div class="catchup-title-area">
        <h1>Aufholen</h1>
        <p class="subtitle">
          {{ completedInSession }} von {{ originalTotal }} Chores geschafft
        </p>
      </div>
    </div>

    <!-- Filter Chips -->
    <div class="filter-row" v-if="!loading && stackLength > 0">
      <button
        class="filter-chip"
        :class="{ active: displayFilter === 'all' }"
        @click="setFilter('all')"
      >
        Alle
      </button>
      <button
        class="filter-chip"
        :class="{ active: displayFilter === 'urgent' }"
        @click="setFilter('urgent')"
      >
        Überfällig + Heute
      </button>
      <!-- Tastatur ist der zweite vollwertige Bedienweg, deshalb gehoert ihr
           Einstieg (Taste "?") neben die Filter, nicht in ein Menue. -->
      <button
        class="filter-chip shortcuts-trigger"
        aria-keyshortcuts="?"
        @click="helpOpen = true"
      >
        <span class="mdi mdi-keyboard-outline"></span>
        Tastatur
      </button>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar" v-if="originalTotal > 0">
      <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="loader-center" />

    <!-- Empty State -->
    <EmptyState
      v-else-if="stackLength === 0"
      message="Keine chores zum Aufholen — du bist top! 🎉"
      :show-add-button="true"
      @add="$router.push('/chores')"
    >
      <template #icon>
        <span
          class="mdi mdi-check-circle-outline"
          style="font-size: 64px; opacity: 0.5"
        ></span>
      </template>
    </EmptyState>

    <!-- Card Stack: nur die oberste Card + max. 1 Deck-Peek rendern.
         Bei grossen Stacks (50+) war das Voll-Rendering der Perf-Killer
         (Swipe-Handler + backdrop-filter pro Card). -->
    <div v-else class="stack-area" ref="stackAreaRef">
      <div class="stack-counter" role="status" aria-live="polite">
        Karte {{ currentCardNumber }} von {{ originalTotal }}
      </div>
      <div class="stack-container" ref="containerRef" role="list" aria-label="Aufholen-Stapel">
        <CatchUpCard
          v-for="(chore, index) in visibleStack"
          :key="chore.id"
          :chore="chore"
          :position="index"
          :total="stackLength"
          :is-active="index === 0"
          @toggle="handleToggle"
          @snooze="handleSnooze"
        />
      </div>

      <!-- Aktionen als sichtbare Leiste unter der Karte (Befund A1): die
           Geste bleibt der schnellste Weg, ist aber nicht mehr der einzige. -->
      <CatchUpActionBar
        :chore="visibleStack[0] || null"
        :pending="pendingAction"
        @done="handleToggle(visibleStack[0].id)"
        @snooze="handleSnooze(visibleStack[0])"
      />
    </div>

    <!-- Snooze Action Sheet -->
    <SnoozeSheet
      :visible="snoozeOpen"
      :chore-name="snoozeChoreName"
      @select="applySnooze"
      @close="snoozeOpen = false"
    />

    <!-- Tastatur-Kurzhilfe -->
    <CatchUpShortcuts
      v-if="helpOpen"
      :shortcuts="shortcutHelp"
      @close="helpOpen = false"
    />

    <!-- Action Toast (Done / Undo / Snooze) -->
    <transition name="toast-enter">
      <div
        v-if="toast.visible"
        class="catchup-toast"
        role="alert"
        aria-live="polite"
      >
        <span class="toast-message">{{ toast.message }}</span>
        <button v-if="toast.action" class="toast-action" @click="triggerAction">
          {{ toast.action }}
        </button>
        <span class="toast-close mdi mdi-close" @click="hideToast"></span>
      </div>
    </transition>

    <!-- Success overlay when stack fully done -->
    <transition name="confetti-fade">
      <div
        v-if="showSuccess"
        class="success-overlay"
        :aria-hidden="!showSuccess"
      >
        <div class="success-check">
          <span class="mdi mdi-check"></span>
        </div>
        <p class="success-text">Alles geschafft! 🎉</p>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useChoreStore } from "@/stores/chore";
import { useAuthStore } from "@/stores/auth";
import { buildCatchUpStack, getBucketLabel } from "@/utils/catchUpStack";

import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import EmptyState from "@/components/chores/EmptyState.vue";
import CatchUpCard from "@/components/chores/CatchUpCard.vue";
import CatchUpActionBar from "@/components/chores/catchup/CatchUpActionBar.vue";
import CatchUpShortcuts from "@/components/chores/catchup/CatchUpShortcuts.vue";
import SnoozeSheet from "@/components/chores/SnoozeSheet.vue";

const router = useRouter();
const choreStore = useChoreStore();
const authStore = useAuthStore();

const loading = ref(true);
const stack = ref([]);
const containerRef = ref(null);
const stackAreaRef = ref(null);

// Stabilisierter Fortschritts-Zähler: originalTotal wird beim (gefilterten)
// Aufbau gesetzt, Fortschritt = originalTotal - aktuelle Stack-Größe.
let sessionBaseline = null;
const originalTotal = ref(0);
const stackLength = computed(() => stack.value.length);
const completedInSession = computed(() =>
  Math.max(0, originalTotal.value - stackLength.value),
);
const progressPct = computed(() => {
  if (originalTotal.value === 0) return 0;
  return Math.round((completedInSession.value / originalTotal.value) * 100);
});

// Single-Card-Deck: nur die oberste Card + max. 1 Peek dahinter rendern.
// Der Index im Slice entspricht dem echten Stack-Index (Sortierung bleibt
// erhalten), damit Deck-Styling und Fortschritts-Banner stimmen.
const visibleStack = computed(() => stack.value.slice(0, 2));

// Fortschritts-Banner "Karte X von Y": X = Position der aktuellen Card
// in der Session (erledigt + 1), Y = urspruengliche Stack-Groesse.
const currentCardNumber = computed(() =>
  Math.min(originalTotal.value, completedInSession.value + 1),
);

// Filter: "all" | "urgent" (nur Überfällig + Heute)
const displayFilter = ref("all");

// Pending-Aktion: der Busy-Guard war vorher ein `Set` ohne jedes Template-
// Binding (Befund B3) — geschuetzt wurde, sichtbar war nichts. Jetzt EIN
// Zustand statt einer Menge: das Deck zeigt immer nur eine Karte, es kann
// also hoechstens eine Aktion gleichzeitig in Arbeit sein. Dieselbe Quelle
// speist den Guard (`isBusy`), den Spinner und den Disabled-State.
const pending = ref(null); // { id, kind: "done" | "snooze" }
const isBusy = (id) => pending.value?.id === id;
const pendingAction = computed(() =>
  isBusy(visibleStack.value[0]?.id) ? pending.value?.kind || "" : "",
);

// Snooze
const snoozeOpen = ref(false);
const snoozeChore = ref(null);
const snoozeChoreName = computed(() => snoozeChore.value?.name || "");

// Tastatur-Kurzhilfe (Befund A2)
const helpOpen = ref(false);
// Anzeige und Tastatur-Handler teilen sich diese Liste, damit die Doku nicht
// veralten kann, solange jemand sie pflegt.
const shortcutHelp = [
  { keys: ["Eingabe", "␣", "1"], text: "Aktuelle Chore erledigen" },
  { keys: ["2"], text: "Aktuelle Chore aufschieben" },
  { keys: ["Esc"], text: "Offenes Fenster schließen" },
  { keys: ["?"], text: "Diese Übersicht" },
];

// Toast
const toast = ref({ visible: false, message: "", action: null, handler: null });
const toastTimer = ref(null);

// Success effect
const showSuccess = ref(false);
// Timer für das Erfolgs-Routing – wird beim UNDO abgebrochen, damit die View
// nicht wegnavigiert, solange der User noch rückgängig machen kann.
let successTimer = null;

onMounted(async () => {
  try {
    await choreStore.fetchChores();
    rebuildStack(true);
  } catch (err) {
    console.error("Failed to fetch chores for catchup:", err);
  } finally {
    loading.value = false;
  }
  document.addEventListener("keydown", onKeydown);
});

// Cleanup beim Verlassen: laufende Timer stoppen, sonst feuert der
// Success-Timer nach dem Verlassen noch einen router.push("/") und
// der Toast-Timer tickt ins Leere.
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  if (toastTimer.value) {
    clearTimeout(toastTimer.value);
    toastTimer.value = null;
  }
});

// --- Tastatursteuerung (Befund A2) -------------------------------------
// Vorher gab es zwar `tabindex="0"` auf der Karte, aber keinen keydown-Handler:
// Enter und Space taten nichts, die pure Tastaturnutzung war blind.
//
// EIN Handler auf document-Ebene statt einer Handkante je Karte: die Karten
// werden bei jedem Swipe neu gerendert, ein Karte-lokaler Handler muesste also
// an jedem Kartenwechsel neu gebunden werden. Zusaetzlich ist eine einzige
// Quelle leichter zu pruefen als N.
const DECK_FOCUS = ".stack-area, .catchup-actions";

/** Text-Eingaben gehoeren dem Dokument, nicht dem Deck. */
function isTextEntry(el) {
  return !!(
    el &&
    el.closest &&
    el.closest("input, textarea, select, [contenteditable='true']")
  );
}

/**
 * Darf eine Aktionstaste greifen? Ja, wenn nichts fokussiert ist (der Fokus
 * liegt dann auf der View) oder wenn der Fokus im Deck liegt. Steht der Fokus
 * z. B. auf der Bottom-Nav, gehoert die Taste dorthin und nicht hierher.
 */
function hasDeckFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return true;
  return !!(el.closest && el.closest(DECK_FOCUS));
}

/** Overlay obenauf? Dann hat es eigene Bedienung (inkl. Escape). */
function isOverlayOpen() {
  return snoozeOpen.value || helpOpen.value;
}

/** Schliesst das oberste Overlay, sonst nichts. */
function closeTopOverlay() {
  if (snoozeOpen.value) {
    snoozeOpen.value = false;
    return true;
  }
  if (helpOpen.value) {
    helpOpen.value = false;
    return true;
  }
  return false;
}

function onKeydown(e) {
  if (e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Escape hat Vorrang und greift auch aus dem Datumseingabefeld des
  // Snooze-Sheets: dort ist das Schliessen der einzige sinnvolle Ausgang.
  if (e.key === "Escape") {
    if (closeTopOverlay()) e.preventDefault();
    return;
  }

  if (isTextEntry(e.target)) return;
  if (isOverlayOpen()) return;
  if (!hasDeckFocus()) return;
  if (pending.value) return;

  const top = visibleStack.value[0];

  if (e.key === "Enter" || e.key === " " || e.key === "1") {
    if (!top) return;
    e.preventDefault();
    handleToggle(top.id);
    return;
  }
  if (e.key === "2") {
    if (!top) return;
    e.preventDefault();
    handleSnooze(top);
    return;
  }
  if (e.key === "?") {
    e.preventDefault();
    helpOpen.value = true;
  }
}

function isUrgent(chore) {
  const label = getBucketLabel(chore);
  return label === "Überfällig" || label === "Heute";
}

function rebuildStack(resetBaseline = false) {
  const result = buildCatchUpStack(choreStore.chores);
  const full = result.stack;
  stack.value = displayFilter.value === "urgent" ? full.filter(isUrgent) : full;

  if (resetBaseline || sessionBaseline === null) {
    sessionBaseline = stack.value.length;
    originalTotal.value = stack.value.length;
  }
}

function setFilter(filter) {
  displayFilter.value = filter;
  rebuildStack(true);
}

// --- Date helpers (lokale Zeit, YYYY-MM-DD wie bestehende Chores) ---
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parst "YYYY-MM-DD" LOKAL (nicht als UTC), damit der angezeigte Wochentag/Tag
// bei Offset-Zeitzonen nicht um einen Tag abweicht. Konsistent zu localDateStr()
// und zu normalizeToLocalDate() (choreBuckets).
function parseLocalDate(raw) {
  if (raw instanceof Date) return raw;
  const parts = String(raw).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

function formatNextDue(raw) {
  if (!raw) return "";
  const d = parseLocalDate(raw);
  if (!d) return "";
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function showToast(message, action = null, handler = null, duration = 4000) {
  hideToast();
  toast.value = { visible: true, message, action, handler };
  if (duration > 0) {
    toastTimer.value = setTimeout(hideToast, duration);
  }
}

function hideToast() {
  if (toastTimer.value) clearTimeout(toastTimer.value);
  toastTimer.value = null;
  toast.value.visible = false;
  toast.value.action = null;
  toast.value.handler = null;
}

function triggerAction() {
  const handler = toast.value.handler;
  hideToast();
  if (handler) handler();
}

// --- Interactions ---

async function handleToggle(choreId) {
  if (isBusy(choreId)) return;
  pending.value = { id: choreId, kind: "done" };
  try {
    const response = await choreStore.markDone(choreId, authStore.user?.email);
    rebuildStack();

    // Recurrence-Hinweis, falls vorhanden
    const nextDue = response?.due_date ?? response?.new_due_date;
    const msg = nextDue
      ? `Erledigt ✓ Nächste Fälligkeit: ${formatNextDue(nextDue)}`
      : `Erledigt ✓`;
    showToast(msg, "UNDO", () => handleUndo(choreId));

    if (stack.value.length === 0) {
      showSuccess.value = true;
      if (successTimer) clearTimeout(successTimer);
      successTimer = setTimeout(() => {
        showSuccess.value = false;
        successTimer = null;
        setTimeout(() => router.push("/"), 500);
      }, 1300);
    }
  } catch (err) {
    console.error("Failed to mark chore done in catchup:", err);
    showToast("Fehler beim Erledigen", null, null, 3000);
  } finally {
    pending.value = null;
  }
}

async function handleUndo(choreId) {
  if (isBusy(choreId)) return;
  pending.value = { id: choreId, kind: "done" };
  // Sofort (vor dem await) den Erfolgs-Overlay + Redirect-Timer stoppen:
  // sonst räumt der ablaufende Timer die View weg, während undoDone noch läuft
  // (Race bei der letzten Chore). Die zurückgeholte Chore muss wieder sichtbar sein.
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  showSuccess.value = false;
  try {
    await choreStore.undoDone(choreId);
    rebuildStack();
    showToast("Chore wieder geöffnet", null, null, 2500);
  } catch (err) {
    console.error("Failed to undo chore in catchup:", err);
    showToast("Fehler beim Rückgängig machen", null, null, 3000);
  } finally {
    pending.value = null;
  }
}

function handleSnooze(chore) {
  if (!chore || isBusy(chore.id)) return;
  snoozeChore.value = chore;
  snoozeOpen.value = true;
}

async function applySnooze(offsetDays, customDate) {
  const chore = snoozeChore.value;
  snoozeOpen.value = false;
  if (!chore || isBusy(chore.id)) return;
  pending.value = { id: chore.id, kind: "snooze" };

  const newDate =
    customDate ||
    (() => {
      const base = new Date();
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      d.setDate(d.getDate() + offsetDays);
      return localDateStr(d);
    })();

  try {
    await choreStore.snoozeChore(chore.id, newDate);
    rebuildStack();
    // Aufgeschoben = nicht mehr aufzuholen: die gesnoozte Chore aus dem
    // sichtbaren Stack entfernen (der Stack zeigt sonst auch zukuenftige
    // Chores erneut im upcoming-Bucket an).
    stack.value = stack.value.filter((c) => c.id !== chore.id);
    showToast(`Aufgeschoben auf ${formatNextDue(newDate)}`, null, null, 2500);
  } catch (err) {
    console.error("Failed to snooze chore in catchup:", err);
    showToast("Fehler beim Aufschieben", null, null, 3000);
  } finally {
    pending.value = null;
  }
}
</script>

<style scoped>
.catchup-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  /* Platz fuer die fixe Bottom-Nav (AppBottomNav: 80px + Safe-Area). Die
     Aktionsleiste ist das Einzige, was der User zwingend anfasst — sie darf
     nie hinter der Navigation liegen. Dieselbe Konstante steht in
     AppBottomNav.vue; ein gemeinsames Token steht als Folgearbeit aus. */
  padding-bottom: calc(
    80px + env(safe-area-inset-bottom, 0px) + var(--md-sys-spacing-lg)
  );
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 80px);
}

/* Header */
.catchup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 8px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--md-sys-radius-small);
  transition: background-color var(--transition-fast);
  font-family: inherit;
}

.back-btn:hover {
  background: var(--color-primary-subtle);
}

.catchup-title-area {
  flex: 1;
}

.catchup-title-area h1 {
  font-size: 1.6rem;
  margin: 0;
  color: var(--color-primary);
}

.subtitle {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

/* Filter chips */
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--color-text) 15%, transparent);
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-radius: var(--md-sys-radius-full);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.filter-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-accent);
}

/* Der Einstieg in die Tastaturhilfe ist ein Chip, aber kein Filter: er traegt
   kein Icon-Label-Paar wie die beiden Filter und sitzt daher am Ende. */
.shortcuts-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--color-primary);
}

.shortcuts-trigger .mdi {
  font-size: 0.95rem;
}

/* Progress Bar */
.progress-bar {
  height: 6px;
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
  border-radius: var(--md-sys-radius-full);
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-success)
  );
  border-radius: var(--md-sys-radius-full);
  transition: width 0.4s var(--motion-soft);
}

/* Loading */
.loader-center {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

/* Stack Area */
.stack-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--md-sys-spacing-md);
}

/* Fortschritts-Banner "Karte X von Y" */
.stack-counter {
  margin-bottom: 14px;
  padding: 6px 18px;
  border-radius: var(--md-sys-radius-full);
  background: var(--color-primary);
  color: var(--color-on-accent);
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  box-shadow: var(--shadow-md);
}

.stack-container {
  position: relative;
  width: 100%;
  max-width: 420px;
  min-height: 160px;
  margin: 0 auto;
}

/* Empty State Override */
:deep(.empty-state) {
  margin-top: 40px;
}

/* Action Toast */
.catchup-toast {
  position: fixed;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  /* Der Toast invertiert gegen --color-text: im Light Mode dunkler
     Hintergrund/helle Schrift, im Dark Mode heller Hintergrund/dunkle
     Schrift. Ein festes #ffffff waere im Dark Mode unsichtbar. */
  background: var(--color-text);
  color: var(--color-background);
  padding: 10px 16px;
  border-radius: var(--md-sys-radius-full);
  box-shadow: var(--shadow-lg);
  z-index: var(--md-sys-zindex-toast); /* über dem Success-Overlay (1400), damit UNDO immer klickbar bleibt */
  max-width: calc(100vw - 32px);
  font-size: 0.85rem;
}

.toast-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-action {
  background: none;
  border: none;
  color: var(--color-success);
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}

.toast-close {
  cursor: pointer;
  opacity: 0.7;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

/* Success overlay */
.success-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-scrim);
  backdrop-filter: blur(4px);
  z-index: 1400;
  /* Das Erfolgs-Overlay ist rein dekorativ und darf Klicks NIEMALS blockieren:
     Der UNDO-Toast (z-index 2100) muss auch bei leerem Stack sofort nutzbar
     sein, sonst gewinnt der Auto-Redirect das Race gegen das Rückgängig-Machen. */
  pointer-events: none;
}

.success-check {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-accent);
  font-size: 3rem;
  animation: successPop 0.5s var(--motion-emphasized);
}

.success-text {
  /* Sitzt auf dem Scrim (nicht auf dem gruenen Kreis) — der Scrim ist in
     beiden Themes dunkel, also bleibt die Schrift hell. */
  color: #ffffff;
  font-size: 1.3rem;
  font-weight: 800;
  margin-top: 16px;
  text-shadow: 0 2px 8px rgb(var(--md-sys-color-shadow-rgb) / 0.3);
}

@keyframes successPop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.confetti-fade-enter-active,
.confetti-fade-leave-active {
  transition: opacity var(--transition-slow);
}

.confetti-fade-enter-from,
.confetti-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .success-check {
    animation: none;
  }
}
</style>
