<template>
  <section class="settings-section card">
    <div class="section-header">
      <div class="section-icon">
        <span class="mdi mdi-bell"></span>
      </div>
      <div>
        <h2 class="section-title">Notifications</h2>
        <p class="section-subtitle">Receive reminders for upcoming chores</p>
      </div>
    </div>

    <!-- Main toggle -->
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">Enable notifications</span>
        <span class="setting-description"
          >Show reminders for due and upcoming chores</span
        >
      </div>
      <label class="toggle">
        <input
          v-model="effectiveNotifications.enabled"
          type="checkbox"
          @change="scheduleSave"
        />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <transition name="fade">
      <div v-if="effectiveNotifications.enabled" class="setting-group">
        <!-- notify_times -->
        <div
          class="setting-item"
          v-for="(time, idx) in effectiveNotifications.notify_times"
          :key="idx"
        >
          <div class="setting-info">
            <span class="setting-label">Reminder time #{{ idx + 1 }}</span>
            <span class="setting-description">
              {{
                idx === 0
                  ? "Morning reminder"
                  : idx === 1
                    ? "Evening reminder"
                    : "Additional reminder"
              }}
            </span>
          </div>
          <div class="time-picker">
            <input
              v-model="effectiveNotifications.notify_times[idx]"
              type="time"
              class="input"
              @change="scheduleSave"
            />
            <button
              v-if="effectiveNotifications.notify_times.length > 1"
              class="btn-icon time-remove-btn"
              title="Remove"
              @click="removeTime(idx)"
            >
              <span class="mdi mdi-close"></span>
            </button>
          </div>
        </div>

        <button class="btn btn-tonal btn-sm add-time-btn" @click="addTime">
          <span class="mdi mdi-plus" style="margin-right: 8px"></span>
          Add time
        </button>

        <!-- Toggle: overdue -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Overdue alerts</span>
            <span class="setting-description"
              >Get notified about overdue chores</span
            >
          </div>
          <label class="toggle">
            <input
              v-model="effectiveNotifications.notify_overdue"
              type="checkbox"
              @change="scheduleSave"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <!-- Toggle: soon -->
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Upcoming alerts</span>
            <span class="setting-description"
              >Get notified about chores due soon</span
            >
          </div>
          <label class="toggle">
            <input
              v-model="effectiveNotifications.notify_soon"
              type="checkbox"
              @change="scheduleSave"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </transition>

    <!-- Save bar -->
    <div v-if="unsavedChanges" class="save-bar">
      <span class="save-bar-text">Unsaved changes</span>
      <div class="save-bar-actions">
        <button class="btn btn-text btn-sm" @click="discardChanges">
          Discard
        </button>
        <button
          class="btn btn-filled btn-sm"
          @click="save"
          :disabled="s.loading"
        >
          <span v-if="s.loading" class="spinner"></span>
          Save
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, computed, watch } from "vue";
import { useSettingsStore } from "@/stores/settings";

const s = useSettingsStore();
const draft = ref(null);
const unsavedChanges = ref(false);

// Computed that returns the draft values when they exist, otherwise the store values
const effectiveNotifications = computed(() => {
  if (draft.value) {
    return draft.value;
  }
  return s.notifications;
});

// Watch for external changes and reset draft
watch(
  () => s.notifications,
  () => {
    draft.value = null;
    unsavedChanges.value = false;
  },
  { deep: true },
);

function getDraft() {
  if (!draft.value) {
    draft.value = reactive({
      enabled: s.notifications.enabled,
      notify_times: [...s.notifications.notify_times],
      notify_overdue: s.notifications.notify_overdue,
      notify_soon: s.notifications.notify_soon,
    });
  }
  return draft.value;
}

function scheduleSave() {
  const d = getDraft();
  s.updateSettings({ notifications: d });
  draft.value = null;
  unsavedChanges.value = false;
}

function addTime() {
  const d = getDraft();
  d.notify_times.push("12:00");
  unsavedChanges.value = true;
}

function removeTime(idx) {
  const d = getDraft();
  if (d.notify_times.length > 1) {
    d.notify_times.splice(idx, 1);
    unsavedChanges.value = true;
  }
}

function discardChanges() {
  draft.value = null;
  unsavedChanges.value = false;
}

async function save() {
  const d = getDraft();
  await s.updateSettings({ notifications: d });
  draft.value = null;
  unsavedChanges.value = false;
}
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--md-sys-spacing-lg);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-md);
}

.section-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--md-sys-radius-full);
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.section-title {
  font-size: var(--md-sys-typescale-title-medium);
  font-weight: 500;
  line-height: 1.3;
}

.section-subtitle {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
  margin-top: 2px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-sm) 0;
  gap: var(--md-sys-spacing-md);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.setting-label {
  font-size: var(--md-sys-typescale-body-medium);
  font-weight: 500;
}

.setting-description {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.setting-group {
  margin: var(--md-sys-spacing-md) 0 0;
  padding-left: var(--md-sys-spacing-md);
  border-left: 3px solid var(--md-sys-color-outline-variant);
}

.time-picker {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-xs);
}

.time-remove-btn {
  color: var(--md-sys-color-error);
}

.btn-sm {
  font-size: var(--md-sys-typescale-label-medium);
  padding: var(--md-sys-spacing-xs) var(--md-sys-spacing-sm);
  min-height: 32px;
}

.add-time-btn {
  margin-top: var(--md-sys-spacing-xs);
}

.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--md-sys-color-outline);
  transition: var(--md-sys-transition-fast);
  border-radius: 28px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: var(--md-sys-transition-fast);
  border-radius: 50%;
}

.toggle input:checked + .toggle-slider {
  background-color: var(--md-sys-color-primary);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

/* Save bar */
.save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  margin-top: var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border-radius: var(--md-sys-radius-large);
  gap: var(--md-sys-spacing-md);
}

.save-bar-text {
  font-size: var(--md-sys-typescale-body-medium);
  font-weight: 500;
}

.save-bar-actions {
  display: flex;
  gap: var(--md-sys-spacing-xs);
  flex-shrink: 0;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 4px;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity var(--md-sys-transition-fast),
    transform var(--md-sys-transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
