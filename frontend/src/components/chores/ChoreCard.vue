<template>
  <div class="chore-card-wrapper">
    <!-- Swipe Background Layer (Gmail Style) -->
    <div class="swipe-background" :style="backgroundStyle">
      <div class="action-icon icon-left" :style="leftIconStyle">
        <span class="mdi mdi-check"></span>
      </div>
      <div class="action-icon icon-right" :style="rightIconStyle">
        <span class="mdi mdi-pencil"></span>
      </div>
    </div>

    <!-- Sliding Surface Card -->
    <div
      class="chore-card"
      :style="{ transform: isSwiping || isReturning ? `translateX(${swipeOffset}px)` : '' }"
      :class="[
        choreClass,
        {
          'edit-mode': editMode,
          'done-today': isDoneToday,
          'private-chore': isPrivate,
          'archived-view': isArchivedView,
          'swiping': isSwiping,
          'returning': isReturning
        }
      ]"
      :id="`chore-card-${chore.id}`"
      ref="cardRef"
      @dblclick="handleDblClick"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      role="listitem"
      tabindex="0"
      :aria-label="isPrivate ? `Private chore: ${chore.name}` : `Chore: ${chore.name}`"
    >
      <transition name="fade">
        <!-- Inline Edit Mode -->
        <div v-if="editMode" class="chore-edit">
          <form @submit.prevent="saveChore" class="edit-chore-form">
            <div class="form-header">
              <h3>Edit Chore</h3>
            </div>

            <div class="form-body">
              <div class="form-group">
                <label for="chore-name">Name</label>
                <input id="chore-name" v-model="editableChore.name" type="text" placeholder="Chore Name" required />
              </div>

              <div class="form-group">
                <label for="chore-due-date">Due Date</label>
                <input id="chore-due-date" v-model="editableChore.dueDate" type="date" required />
              </div>

              <div class="form-group">
                <label for="chore-interval">Interval (days)</label>
                <input id="chore-interval" v-model.number="editableChore.interval" type="number" min="1" required />
              </div>

              <div class="form-group custom-checkbox-wrapper">
                <input type="checkbox" id="chore-private" v-model="editableChore.isPrivate" />
                <label for="chore-private">
                  <span class="checkbox-text">🔒 Private (only visible to me)</span>
                </label>
              </div>
            </div>

            <div class="form-footer">
              <button v-if="!isArchivedView" type="button" class="btn btn-warning btn-sm archive-button" @click="handleArchive">
                <span class="mdi" :class="chore.archived ? 'mdi-undo' : 'mdi-archive'"></span>
                {{ chore.archived ? 'Unarchive' : 'Archive' }}
              </button>
              <div class="action-buttons">
                <button type="button" class="btn btn-tonal btn-sm cancel-button" @click="cancelEditMode">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary btn-sm save-button">
                  Save
                </button>
              </div>
            </div>
          </form>
        </div>

        <!-- Normal Display Mode -->
        <div v-else class="chore-content" @click="handleClick">
          <div class="chore-left">
            <span v-if="isPrivate" class="lock-icon" title="Private chore" aria-label="Private chore">🔒</span>
            <span class="chore-title" :class="{ 'line-through': isDoneToday }">
              {{ chore.name }}
            </span>
          </div>

          <div class="chore-right">
            <span class="chore-due" :class="{ 'chore-overdue': isOverdueDate }">
              {{ friendlyDueDate }}
            </span>
            <span v-if="chore.interval || chore.interval_days" class="chore-interval">
              {{ chore.interval || chore.interval_days }}
            </span>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useAuthStore } from "@/stores/auth";

const props = defineProps({
  chore: { type: Object, required: true },
  isArchivedView: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle", "markAsDone", "edit", "updateChore", "archive", "archiveChore"]);

const authStore = useAuthStore();
const cardRef = ref(null);
const editMode = ref(false);

const getChoreDueDate = () => {
  const d = props.chore.dueDate || props.chore.due_date;
  if (!d) return "";
  if (typeof d === "string") return d.split("T")[0];
  if (d instanceof Date) return d.toISOString().split("T")[0];
  return String(d);
};

const editableChore = ref({
  id: props.chore.id,
  name: props.chore.name,
  dueDate: getChoreDueDate(),
  interval: props.chore.interval || props.chore.interval_days || 1,
  isPrivate: !!(props.chore.isPrivate ?? props.chore.is_private),
  archived: !!props.chore.archived,
});

watch(
  () => props.chore,
  (newVal) => {
    if (!editMode.value) {
      editableChore.value = {
        id: newVal.id,
        name: newVal.name,
        dueDate: getChoreDueDate(),
        interval: newVal.interval || newVal.interval_days || 1,
        isPrivate: !!(newVal.isPrivate ?? newVal.is_private),
        archived: !!newVal.archived,
      };
    }
  },
  { deep: true }
);

// Swipe Configuration
const SWIPE_THRESHOLD = 70;
const MAX_RETURN_DISTANCE = 140;
const RETURN_ANIMATION_MS = 480;

const isSwiping = ref(false);
const isReturning = ref(false);
const swipeOffset = ref(0);

const swipeThresholdPct = computed(() =>
  Math.min(1, Math.abs(swipeOffset.value) / SWIPE_THRESHOLD)
);

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

const backgroundStyle = computed(() => {
  if (swipeOffset.value === 0) return {};
  const colorDone = "var(--color-primary, #2f6f6f)";
  const colorEdit = "var(--color-warning, #f6c572)";
  return {
    backgroundColor: swipeOffset.value > 0 ? colorDone : colorEdit,
  };
});

const isPrivate = computed(() => {
  return !!(props.chore.isPrivate ?? props.chore.is_private);
});

const isDoneToday = computed(() => {
  if (!props.chore.lastDone && !props.chore.last_done) {
    return !!props.chore.done;
  }
  const lastDoneStr = props.chore.lastDone || props.chore.last_done;
  const todayStr = new Date().toISOString().split("T")[0];
  return (
    props.chore.done &&
    (typeof lastDoneStr === "string" ? lastDoneStr.split("T")[0] === todayStr : false)
  );
});

const rawDueDate = computed(() => {
  return props.chore.dueDate || props.chore.due_date;
});

const isOverdueDate = computed(() => {
  if (!rawDueDate.value || isDoneToday.value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(rawDueDate.value);
  due.setHours(0, 0, 0, 0);
  return due < today;
});

const choreClass = computed(() => {
  if (props.chore.archived) return "archived";
  if (!rawDueDate.value) return "due-far-future";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(rawDueDate.value);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "due-today";
  if (diffDays === 1) return "due-tomorrow";
  if (diffDays <= 2) return "due-2-days";
  if (diffDays <= 3) return "due-3-days";
  if (diffDays <= 7) return "due-7-days";
  if (diffDays <= 14) return "due-14-days";
  if (diffDays <= 30) return "due-30-days";
  return "due-far-future";
});

const friendlyDueDate = computed(() => {
  if (!rawDueDate.value) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(rawDueDate.value);
  dueDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays}d`;
});

// Pointer Gesture Tracking
let startX = 0;
let startY = 0;
let isGestureActive = false;
let isScrollLocked = false;
let isSwipeLocked = false;

function handlePointerDown(e) {
  if (isDoneToday.value || editMode.value || props.isArchivedView) return;
  if (!e.isPrimary) return;

  isGestureActive = true;
  isScrollLocked = false;
  isSwipeLocked = false;
  startX = e.clientX;
  startY = e.clientY;
  isReturning.value = false;
  try {
    e.target.setPointerCapture(e.pointerId);
  } catch (err) {}
}

function handlePointerMove(e) {
  if (!isGestureActive || isScrollLocked) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  if (!isSwipeLocked) {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 6 && absDy < 6) return;

    if (absDy > absDx) {
      isScrollLocked = true;
      isGestureActive = false;
      return;
    } else {
      isSwipeLocked = true;
      isSwiping.value = true;
    }
  }

  if (isSwipeLocked) {
    if (e.cancelable) e.preventDefault();
    const rawOffset = dx;
    swipeOffset.value = Math.max(
      -MAX_RETURN_DISTANCE * 1.3,
      Math.min(MAX_RETURN_DISTANCE * 1.3, rawOffset)
    );
  }
}

function handlePointerUp(e) {
  if (!isGestureActive) return;
  endGesture();
  try {
    e.target.releasePointerCapture(e.pointerId);
  } catch (err) {}
}

function handlePointerCancel(e) {
  if (!isGestureActive) return;
  endGesture();
  try {
    e.target.releasePointerCapture(e.pointerId);
  } catch (err) {}
}

function endGesture() {
  isGestureActive = false;
  isSwiping.value = false;

  if (isSwipeLocked && Math.abs(swipeOffset.value) > SWIPE_THRESHOLD) {
    if (swipeOffset.value < 0) {
      triggerEdit();
    } else {
      triggerDone();
    }
  } else {
    animateReturn();
  }

  isScrollLocked = false;
  isSwipeLocked = false;
}

function triggerEdit() {
  enterEditMode();
  swipeOffset.value = 0;
  isReturning.value = false;
}

function triggerDone() {
  markDone();
  swipeOffset.value = 0;
  isReturning.value = false;
}

function animateReturn() {
  isReturning.value = true;
  swipeOffset.value = 0;
  setTimeout(() => {
    isReturning.value = false;
  }, RETURN_ANIMATION_MS);
}

function handleDblClick() {
  if (isDoneToday.value || props.isArchivedView) return;
  enterEditMode();
}

function enterEditMode() {
  if (isDoneToday.value || props.isArchivedView) return;
  editableChore.value = {
    id: props.chore.id,
    name: props.chore.name,
    dueDate: getChoreDueDate(),
    interval: props.chore.interval || props.chore.interval_days || 1,
    isPrivate: isPrivate.value,
    archived: !!props.chore.archived,
  };
  editMode.value = true;
  emit("edit", props.chore.id);
}

function cancelEditMode() {
  editMode.value = false;
}

function markDone() {
  if (isDoneToday.value || props.isArchivedView) return;
  emit("toggle", props.chore.id);
  emit("markAsDone", props.chore.id);
}

function handleClick() {
  // Can be used for interaction
}

function saveChore() {
  const choreData = {
    ...props.chore,
    name: editableChore.value.name,
    due_date: editableChore.value.dueDate,
    dueDate: editableChore.value.dueDate,
    interval_days: editableChore.value.interval,
    interval: editableChore.value.interval,
    is_private: editableChore.value.isPrivate,
    isPrivate: editableChore.value.isPrivate,
    owner_email: editableChore.value.isPrivate
      ? props.chore.owner_email || authStore.user?.email || null
      : null,
  };

  emit("updateChore", choreData);
  editMode.value = false;
}

function handleArchive() {
  emit("archive", props.chore.id);
  emit("archiveChore", props.chore.id);
  editMode.value = false;
}
</script>

<style scoped>
.chore-card-wrapper {
  position: relative;
  margin-bottom: var(--space-xs);
  border-radius: var(--radius-md);
  overflow: hidden;
  touch-action: pan-y;
}

/* Swipe background layer with action icons */
.swipe-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-md);
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
  box-sizing: border-box;
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #ffffff;
  font-size: 1.5rem;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

/* Sliding Chore Card Surface */
.chore-card {
  position: relative;
  z-index: 2;
  border-radius: var(--radius-md);
  padding: 12px 18px;
  box-shadow: var(--shadow-sm);
  user-select: none;
  cursor: grab;
  transition: box-shadow var(--transition-normal);
  color: var(--color-text);
  border: 1px solid rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(14px);
}

.chore-card:active {
  cursor: grabbing;
}

.chore-card.returning {
  transition: transform var(--swipe-return-duration) var(--motion-rubber);
}

/* Urgency Color Themes */
.chore-card.overdue {
  background-color: var(--color-overdue);
}
.chore-card.due-today {
  background-color: var(--color-due-today);
}
.chore-card.due-tomorrow {
  background-color: var(--color-due-soon);
}
.chore-card.due-2-days {
  background-color: var(--color-due-2-days);
}
.chore-card.due-3-days {
  background-color: var(--color-due-3-days);
}
.chore-card.due-7-days {
  background-color: var(--color-due-7-days);
}
.chore-card.due-14-days {
  background-color: var(--color-due-14-days);
}
.chore-card.due-30-days {
  background-color: var(--color-due-30-days);
}
.chore-card.due-far-future {
  background-color: var(--color-due-far-future);
}
.chore-card.archived {
  background-color: var(--color-archived);
}

/* Done today state */
.chore-card.done-today {
  opacity: 0.72 !important;
  filter: saturate(0.85);
  cursor: default;
}

.chore-card.done-today .chore-title {
  text-decoration: line-through;
  opacity: 0.75;
}

.chore-card.done-today::after {
  content: "✓ Done today";
  position: absolute;
  top: 50%;
  right: var(--space-md);
  transform: translateY(-50%);
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--color-primary);
}

/* Card Content Layout */
.chore-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 12px;
}

.chore-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.lock-icon {
  font-size: 0.9rem;
}

.chore-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-word;
}

.chore-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.chore-due {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.chore-due.chore-overdue {
  color: var(--color-danger);
  font-weight: 700;
}

.chore-interval {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: rgba(31, 45, 44, 0.12);
  border-radius: 11px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text);
}

/* Inline Edit Form */
.edit-chore-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

.form-header h3 {
  font-size: 1.05rem;
  margin-bottom: 4px;
}

.form-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group input[type="number"] {
  width: 100%;
}

.form-group.custom-checkbox-wrapper {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}
</style>
