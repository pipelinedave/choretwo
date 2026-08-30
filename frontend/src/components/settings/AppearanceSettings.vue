<template>
  <section class="settings-section card">
    <div class="section-header">
      <div class="section-icon">
        <span class="mdi mdi-palette-variant"></span>
      </div>
      <div>
        <h2 class="section-title">Appearance</h2>
        <p class="section-subtitle">Choose how choretwo looks</p>
      </div>
    </div>

    <div class="theme-options">
      <button
        v-for="opt in themes"
        :key="opt.value"
        @click="selectTheme(opt.value)"
        class="theme-option"
        :class="{ active: draft === opt.value }"
        :aria-pressed="draft === opt.value"
      >
        <span class="theme-icon" :class="opt.icon"></span>
        <span class="theme-label">{{ opt.label }}</span>
        <span
          v-if="draft === opt.value"
          class="mdi mdi-check-circle theme-check"
        ></span>
      </button>
    </div>

    <!-- Preview -->
    <div class="theme-preview card-outlined">
      <div class="theme-preview-line theme-preview-primary">
        <span>{{
          draft === "dark" ? "Dark theme preview text" : "Preview text"
        }}</span>
      </div>
      <div class="theme-preview-line theme-preview-secondary">
        <span>Secondary text sample</span>
      </div>
    </div>

    <!-- Save bar -->
    <div v-if="unsavedChanges" class="save-bar">
      <span class="save-bar-text">Theme change pending</span>
      <div class="save-bar-actions">
        <button class="btn btn-text btn-sm" @click="discardTheme">
          Discard
        </button>
        <button
          class="btn btn-filled btn-sm"
          @click="saveTheme"
          :disabled="saving"
        >
          <span v-if="saving" class="spinner"></span>
          Apply
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useSettingsStore } from "@/stores/settings";

const s = useSettingsStore();
const draft = ref(null);
const unsavedChanges = ref(false);
const saving = ref(false);

const themes = [
  { value: "light", label: "Light", icon: "mdi-white-balance-sunny" },
  { value: "dark", label: "Dark", icon: "mdi-moon-waning-crescent" },
  { value: "system", label: "System", icon: "mdi-monitor-dash" },
];

onMounted(() => {
  draft.value = s.appearance.theme;
});

function selectTheme(value) {
  draft.value = value;
  unsavedChanges.value = true;
  s.applyThemeImmediate(value);
}

function discardTheme() {
  draft.value = s.appearance.theme;
  unsavedChanges.value = false;
}

async function saveTheme() {
  saving.value = true;
  try {
    await s.updateSettings({ appearance: { theme: draft.value } });
    unsavedChanges.value = false;
    s.clearError();
  } catch (err) {
    s.clearError();
    const msg = err?.response?.data?.detail || err?.message || "Theme konnte nicht gespeichert werden";
    s.error = msg;
    console.error("[AppearanceSettings] save failed:", err);
  } finally {
    saving.value = false;
  }
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
  background-color: var(--md-sys-color-tertiary-container);
  color: var(--md-sys-color-on-tertiary-container);
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

.theme-options {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  margin-bottom: var(--md-sys-spacing-lg);
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: var(--md-sys-spacing-md);
  border: 2px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-radius-large);
  background: transparent;
  cursor: pointer;
  transition: all var(--md-sys-transition-fast);
  min-height: 100px;
  position: relative;
}

.theme-option:hover {
  border-color: var(--md-sys-color-outline);
  background-color: var(--md-sys-color-surface-variant);
}

.theme-option.active {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.theme-icon {
  font-size: 28px;
}

.theme-label {
  font-size: var(--md-sys-typescale-label-large);
  font-weight: 500;
}

.theme-check {
  position: absolute;
  top: var(--md-sys-spacing-xs);
  right: var(--md-sys-spacing-xs);
  font-size: 20px;
  color: var(--md-sys-color-primary);
}

.theme-preview {
  padding: var(--md-sys-spacing-md);
  transition: background-color var(--md-sys-transition-fast);
}

.theme-preview-line {
  border-radius: var(--md-sys-radius-medium);
}

.theme-preview-primary {
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  margin-bottom: var(--md-sys-spacing-xs);
  font-weight: 500;
}

.theme-preview-secondary {
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}

.save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  margin-top: var(--md-sys-spacing-lg);
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

.btn-sm {
  font-size: var(--md-sys-typescale-label-medium);
  padding: var(--md-sys-spacing-xs) var(--md-sys-spacing-sm);
  min-height: 32px;
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
</style>
