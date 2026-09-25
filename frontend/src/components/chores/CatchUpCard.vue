<template>
  <div class="catchup-card-wrapper" :class="{ 'active-card': isActive }">
    <!-- Swipe Background Layer (Gmail Style) -->
    <div class="swipe-background" :style="backgroundStyle">
      <div class="action-icon icon-left" :style="leftIconStyle">
        <span class="mdi mdi-check"></span>
      </div>
      <div class="action-icon icon-right" :style="rightIconStyle">
        <span class="mdi mdi-sleep"></span>
      </div>
    </div>

    <!-- Sliding Surface Card -->
    <div
      class="catchup-card"
      :class="[choreClass, { swiping: isSwiping, returning: isReturning }]"
      :style="cardStyle"
      :id="`catchup-card-${chore.id}`"
      ref="cardRef"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      role="listitem"
      tabindex="0"
      :aria-label="ariaLabel"
    >
      <!-- Priority Badge -->
      <div class="priority-badge">{{ bucketLabel }}</div>

      <!-- Card Content -->
      <div class="catchup-content">
        <div class="catchup-left">
          <span v-if="isPrivate" class="lock-icon" title="Private chore"
            >🔒</span
          >
          <span class="chore-title">{{ chore.name }}</span>
        </div>

        <div class="catchup-right">
          <span class="due-date-text">{{ friendlyDueDate }}</span>
          <span
            v-if="chore.interval || chore.interval_days"
            class="chore-interval"
            :title="intervalHint"
          >
            {{ chore.interval || chore.interval_days }}
          </span>
        </div>
      </div>

      <p v-if="chore.interval || chore.interval_days" class="recurrence-hint">
        <span class="mdi mdi-repeat"></span>
        {{ intervalHint }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { getBucketLabel } from "@/utils/catchUpStack";

const props = defineProps({
  chore: { type: Object, required: true },
  position: { type: Number, default: 0 },
  total: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
});

const emit = defineEmits(["toggle", "snooze"]);

// Swipe Configuration
const SWIPE_THRESHOLD = 80;
const MAX_RETURN_DISTANCE = 160;
const RETURN_ANIMATION_MS = 480;

const isSwiping = ref(false);
const isReturning = ref(false);
const swipeOffset = ref(0);

const intervalHint = computed(() => {
  const days = props.chore.interval || props.chore.interval_days;
  if (!days) return "";
  return days === 1
    ? "wiederkehrend jeden Tag"
    : `wiederkehrend alle ${days} Tage`;
});

const swipeThresholdPct = computed(() =>
  Math.min(1, Math.abs(swipeOffset.value) / SWIPE_THRESHOLD),
);

// --- Icon opacity per swipe direction ---
const leftIconStyle = computed(() => {
  if (swipeOffset.value <= 0) return { opacity: 0, transform: "scale(0.8)" };
  const scale = 0.8 + swipeThresholdPct.value * 0.4;
  return {
    opacity: Math.min(1, swipeThresholdPct.value * 1.5),
    transform: `scale(${scale})`,
  };
});

const rightIconStyle = computed(() => {
  if (swipeOffset.value >= 0) return { opacity: 0, transform: "scale(0.8)" };
  const scale = 0.8 + swipeThresholdPct.value * 0.4;
  return {
    opacity: Math.min(1, swipeThresholdPct.value * 1.5),
    transform: `scale(${scale})`,
  };
});

// --- Background color ---
const backgroundStyle = computed(() => {
  if (swipeOffset.value === 0) return {};
  return {
    backgroundColor:
      swipeOffset.value > 0
        ? "var(--color-primary, #2f6f6f)"
        : "var(--color-warning, #f6c572)",
  };
});

// --- Position/stack styling + swipe offset ---
const cardStyle = computed(() => {
  const stackOffset = props.position * 12;
  const rotation = props.position * 1.2;
  const scale = 1 - props.position * 0.025;
  // Swipe-X nur auf der aktiven Card (oberste) anwenden
  const swipeX = props.isActive ? swipeOffset.value : 0;
  return {
    transform: `translate(${swipeX}px, ${stackOffset}px) rotate(${rotation}deg) scale(${Math.max(0.92, scale)})`,
    zIndex: props.total - props.position,
  };
});

// --- Urgency class ---
const isPrivate = computed(
  () => !!(props.chore.isPrivate ?? props.chore.is_private),
);

const choreClass = computed(() => {
  const raw = props.chore.dueDate || props.chore.due_date;
  if (!raw) return "due-far-future";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(raw);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due-today";
  if (diffDays === 1) return "due-tomorrow";
  if (diffDays <= 7) return "due-7-days";
  if (diffDays <= 14) return "due-14-days";
  if (diffDays <= 30) return "due-30-days";
  return "due-far-future";
});

// --- Friendly labels ---
const bucketLabel = computed(() => getBucketLabel(props.chore));

// Befund A2: `role="listitem"` stand ohne `role="list"` am Container und ohne
// `aria-label` — fuer Screenreader war die Karte eine unbenannte
// Listenposition. Der Label nennt Chore, Faelligkeit und Bedienung, damit die
// Tastatursteuerung nicht undokumentiert bleibt. Der Container traegt die
// Rolle `list` (CatchUpView, .stack-container).
const ariaLabel = computed(() => {
  const parts = [props.chore.name, friendlyDueDate.value, bucketLabel.value]
    .filter(Boolean)
    .join(", ");
  if (!props.isActive) {
    return `${parts}. Position ${props.position + 1} im Stapel.`;
  }
  return `${parts}. Erledigen: Eingabetaste oder Taste 1. Aufschieben: Taste 2.`;
});

const friendlyDueDate = computed(() => {
  const raw = props.chore.dueDate || props.chore.due_date;
  if (!raw) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(raw);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d überfällig`;
  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Morgen";
  return `In ${diffDays}d`;
});

// --- Pointer-Geste ------------------------------------------------------
// Swipe-Semantik im CatchUp-Deck:
//   rechts  -> erledigt (emit toggle)
//   links   -> aufschieben (Snooze-Sheet, wie der "Später"-Button)
//   hoch    -> aufschieben (Snooze-Sheet)
//   runter  -> Scroll (keine Aktion)
// Links loest KEINE Navigation aus - Editieren gehoert nicht ins Deck.
//
// Warum NUR Pointer Events (Befund B1): vorher liefen drei Handler parallel
// (pointer + touch + mouse, ~200 Zeilen). Pointer Events sind seit iOS 13
// Baseline und loesen Maus UND Touch ab, die Maus- und Touch-Handler waren
// also reine Doppelabdeckung — mit zwei Fehlerklassen als Folge:
//   1. `@touchmove.prevent` stand DAUERHAFT auf der Karte und widersprach dem
//      `touch-action: pan-y` darunter: der Browser durfte scrollen, das
//      preventDefault hinderte daran, und die Karte wurde bei jedem
//      Scrollversuch "stecken" gelassen.
//   2. `preventDefault()` auf `touchstart` unterdrueckt das vom Browser
//      synthetisierte `click` — damit waren die Aktions-Buttons der Karte auf
//      Touch-Geraeten tot (dokumentiert im E2E-Test "Später-Button reagiert
//      auf echten Touch").
let startX = 0;
let startY = 0;
let isGestureActive = false;
let isScrollLocked = false;
let isSwipeLocked = false;
let isUpSwipeLocked = false;

const UP_SWIPE_THRESHOLD = 70;

// Interaktive Elemente nehmen an der Swipe-Geste NICHT teil: Eine Geste
// duerfte ihren Klicks nicht abwuergen. Mit Pointer Events ist das nur noch
// eine Absicherung (die Karte hat aktuell keine Knöpfe mehr, die Aktionen
// liegen in der Aktionsleiste unter der Karte) — aber sie kostet nichts und
// schuetzt, falls die Karte wieder bedienbare Elemente bekommt.
function isInteractiveTarget(e) {
  return !!(e.target && e.target.closest("button, a, input, label, select"));
}

function startGesture(clientX, clientY) {
  isGestureActive = true;
  isScrollLocked = false;
  isSwipeLocked = false;
  isUpSwipeLocked = false;
  startX = clientX;
  startY = clientY;
  isReturning.value = false;
}

function moveGesture(clientX, clientY) {
  if (!isGestureActive || isScrollLocked) return;

  const dx = clientX - startX;
  const dy = clientY - startY;

  if (!isSwipeLocked && !isUpSwipeLocked) {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 6 && absDy < 6) return;

    if (absDy > absDx) {
      // Vertikale Geste: nach oben (dy < 0) → Snooze, nach unten → Scroll.
      // Wichtig: NACH OBEN wird NICHT sofort als Scroll gelockt, sonst wird
      // jeder echte (inkrementelle) Up-Swipe schon beim ersten < 70px-Move
      // als Scroll interpretiert und Snooze wuerde nie feuern. Der Kandidat
      // bleibt offen, bis die Schwelle ueberschritten ist.
      if (dy < 0) {
        if (absDy > UP_SWIPE_THRESHOLD) {
          isUpSwipeLocked = true;
          isSwiping.value = true;
        }
        // unter Schwelle: Kandidat offen lassen, kein gleicher Scroll-Lock
      } else {
        isScrollLocked = true;
        isGestureActive = false;
      }
      return;
    } else {
      isSwipeLocked = true;
      isSwiping.value = true;
    }
  }

  if (isSwipeLocked) {
    swipeOffset.value = Math.max(
      -MAX_RETURN_DISTANCE * 1.2,
      Math.min(MAX_RETURN_DISTANCE * 1.2, dx),
    );
  }
}

function handlePointerDown(e) {
  if (!props.isActive) return;
  if (!e.isPrimary) return;
  if (e.button != null && e.button !== 0) return;
  if (isInteractiveTarget(e)) return;

  startGesture(e.clientX, e.clientY);
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch (_err) {
    // Pointer capture not available
  }
}

function handlePointerMove(e) {
  moveGesture(e.clientX, e.clientY);
}

function handlePointerUp(e) {
  if (!isGestureActive) return;
  endGesture();
  try {
    e.target.releasePointerCapture(e.pointerId);
  } catch (_err) {
    // Pointer capture release failed
  }
}

function handlePointerCancel(e) {
  if (!isGestureActive) return;
  endGesture();
  try {
    e.target.releasePointerCapture(e.pointerId);
  } catch (_err) {
    // Pointer capture release failed
  }
}

function endGesture() {
  isGestureActive = false;
  isSwiping.value = false;

  if (isUpSwipeLocked) {
    triggerSnooze();
  } else if (isSwipeLocked && Math.abs(swipeOffset.value) > SWIPE_THRESHOLD) {
    if (swipeOffset.value < 0) {
      // Links = aufschieben (Snooze-Sheet), KEINE Navigation aus der View
      triggerSnooze();
    } else {
      triggerDone();
    }
  } else {
    animateReturn();
  }

  isScrollLocked = false;
  isSwipeLocked = false;
  isUpSwipeLocked = false;
}

function triggerSnooze() {
  swipeOffset.value = 0;
  emit("snooze", props.chore);
}

function triggerDone() {
  swipeOffset.value = 0;
  emit("toggle", props.chore.id);
}

function animateReturn() {
  isReturning.value = true;
  swipeOffset.value = 0;
  setTimeout(() => {
    isReturning.value = false;
  }, RETURN_ANIMATION_MS);
}
</script>

<style scoped>
.catchup-card-wrapper {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  transition: transform var(--transition-normal) var(--motion-soft);
}

.swipe-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--md-sys-radius-large);
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.8rem;
  box-sizing: border-box;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: #ffffff;
  font-size: 1.6rem;
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

.catchup-card {
  position: relative;
  z-index: 2;
  border-radius: var(--md-sys-radius-large);
  padding: 18px 20px 14px;
  box-shadow: var(--shadow-md);
  user-select: none;
  cursor: grab;
  /* Pointer-Events steuern die Geste; verhindert, dass der Browser den
     pointerdown/move bei Touch als native Scroll-Geste übernimmt und ein
     pointercancel auslöst (was doppelte/abgebrochene Swipes erzeugt). */
  touch-action: pan-y;
  transition:
    box-shadow var(--transition-normal),
    transform var(--swipe-return-duration) var(--motion-rubber);
  border: 1px solid var(--color-border-glass);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  overflow: hidden;
}

.catchup-card:active {
  cursor: grabbing;
}

.catchup-card.swiping {
  transition: none;
}

/* Urgency color themes (reuse existing) */
.catchup-card.overdue {
  background-color: var(--color-overdue);
}
.catchup-card.due-today {
  background-color: var(--color-due-today);
}
.catchup-card.due-tomorrow {
  background-color: var(--color-due-soon);
}
.catchup-card.due-7-days {
  background-color: var(--color-due-7-days);
}
.catchup-card.due-14-days {
  background-color: var(--color-due-14-days);
}
.catchup-card.due-30-days {
  background-color: var(--color-due-30-days);
}
.catchup-card.due-far-future {
  background-color: var(--color-due-far-future);
}

/* Priority Badge (top-right corner) */
.priority-badge {
  position: absolute;
  top: 12px;
  right: 14px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 10px;
  border-radius: var(--md-sys-radius-full);
  background: color-mix(in srgb, var(--color-surface) 50%, transparent);
  color: var(--color-text);
  backdrop-filter: blur(6px);
}

/* Card Content */
.catchup-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
  margin-bottom: 4px;
}

.catchup-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.lock-icon {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.chore-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-word;
}

.catchup-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.due-date-text {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.chore-interval {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: color-mix(in srgb, var(--color-text) 12%, transparent);
  border-radius: 11px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Recurrence hint text */
.recurrence-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.recurrence-hint .mdi {
  font-size: 0.9rem;
}
</style>
