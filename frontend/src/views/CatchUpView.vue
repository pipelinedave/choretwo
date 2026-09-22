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
      <div class="stack-container" ref="containerRef">
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
    </div>

    <!-- Snooze Action Sheet -->
    <SnoozeSheet
      :visible="snoozeOpen"
      :chore-name="snoozeChoreName"
      @select="applySnooze"
      @close="snoozeOpen = false"
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

// Busy-Guard gegen doppelte Aktionen während laufender Requests
const busyIds = ref(new Set());
const isBusy = (id) => busyIds.value.has(id);

// Snooze
const snoozeOpen = ref(false);
const snoozeChore = ref(null);
const snoozeChoreName = computed(() => snoozeChore.value?.name || "");

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
});

// Cleanup beim Verlassen: laufende Timer stoppen, sonst feuert der
// Success-Timer nach dem Verlassen noch einen router.push("/") und
// der Toast-Timer tickt ins Leere.
onUnmounted(() => {
  if (successTimer) {
    clearTimeout(successTimer);
    successTimer = null;
  }
  if (toastTimer.value) {
    clearTimeout(toastTimer.value);
    toastTimer.value = null;
  }
});

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
  busyIds.value.add(choreId);
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
    busyIds.value.delete(choreId);
  }
}

async function handleUndo(choreId) {
  if (isBusy(choreId)) return;
  busyIds.value.add(choreId);
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
    busyIds.value.delete(choreId);
  }
}

function handleSnooze(chore) {
  if (isBusy(chore.id)) return;
  snoozeChore.value = chore;
  snoozeOpen.value = true;
}

async function applySnooze(offsetDays, customDate) {
  const chore = snoozeChore.value;
  snoozeOpen.value = false;
  if (!chore || isBusy(chore.id)) return;
  busyIds.value.add(chore.id);

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
    busyIds.value.delete(chore.id);
  }
}
</script>

<style scoped>
.catchup-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 20px;
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
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
  font-family: inherit;
}

.back-btn:hover {
  background: rgba(47, 111, 111, 0.1);
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
  border: 1px solid rgba(31, 45, 44, 0.15);
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-radius: var(--radius-full);
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
  color: #ffffff;
}

/* Progress Bar */
.progress-bar {
  height: 6px;
  background: rgba(31, 45, 44, 0.08);
  border-radius: var(--radius-full);
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
  border-radius: var(--radius-full);
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
  padding: 0 var(--space-md);
}

/* Fortschritts-Banner "Karte X von Y" */
.stack-counter {
  margin-bottom: 14px;
  padding: 6px 18px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: #ffffff;
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
  background: var(--color-text);
  color: #ffffff;
  padding: 10px 16px;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
  z-index: 2100; /* über dem Success-Overlay (1400), damit UNDO immer klickbar bleibt */
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
  background: rgba(31, 45, 44, 0.35);
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
  color: #ffffff;
  font-size: 3rem;
  animation: successPop 0.5s var(--motion-emphasized);
}

.success-text {
  color: #ffffff;
  font-size: 1.3rem;
  font-weight: 800;
  margin-top: 16px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
