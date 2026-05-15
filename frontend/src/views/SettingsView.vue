<template>
  <div class="settings-view">
    <h1 class="page-title">Settings</h1>

    <NotificationSettings />
    <AppearanceSettings />
    <DataSettings />

    <!-- AI Settings -->
    <section class="settings-section card">
      <div class="section-header">
        <div class="section-icon">
          <span class="mdi mdi-brain"></span>
        </div>
        <div>
          <h2 class="section-title">AI Copilot</h2>
          <p class="section-subtitle">Configure AI-powered suggestions</p>
        </div>
      </div>

      <!-- Learning toggle -->
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">AI learning enabled</span>
          <span class="setting-description">Allow AI to learn your habits</span>
        </div>
        <label class="toggle">
          <input
            type="checkbox"
            :checked="aiDraft.learning_enabled"
            @change="toggleLearning"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Suggestion types -->
      <div class="suggestion-types">
        <div
          class="chip"
          :class="{ active: aiDraft.suggestion_types.includes(t.value) }"
          v-for="t in suggestionOptions"
          :key="t.value"
          @click="toggleSuggestionType(t.value)"
        >
          <span class="chip-text">{{ t.label }}</span>
        </div>
      </div>

      <!-- Save bar -->
      <div v-if="unsavedAi" class="save-bar">
        <span class="save-bar-text">Unsaved AI changes</span>
        <div class="save-bar-actions">
          <button class="btn btn-text btn-sm" @click="discardAi">
            Discard
          </button>
          <button
            class="btn btn-filled btn-sm"
            @click="saveAi"
            :disabled="s.loading"
          >
            <span v-if="s.loading" class="spinner"></span>
            Save
          </button>
        </div>
      </div>
    </section>

    <!-- Toast -->
    <SettingsToast
      :visible="toast.visible"
      :message="toast.message"
      :type="toast.type"
      :icon="toast.icon"
      :duration="3000"
      @dismiss="dismissToast"
    />
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch, computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import NotificationSettings from "@/components/settings/NotificationSettings.vue";
import AppearanceSettings from "@/components/settings/AppearanceSettings.vue";
import DataSettings from "@/components/settings/DataSettings.vue";
import SettingsToast from "@/components/settings/SettingsToast.vue";

const s = useSettingsStore();
const unsavedAi = ref(false);
const toast = reactive({
  visible: false,
  message: "",
  type: "default",
  icon: "",
});

const aiDraft = computed({
  get: () => ({
    learning_enabled: s.ai.learning_enabled,
    suggestion_types: [...s.ai.suggestion_types],
  }),
});

const suggestionOptions = [
  { label: "Recurrence", value: "recurrence" },
  { label: "Timing", value: "timing" },
  { label: "Assignment", value: "assignment" },
];

onMounted(async () => {
  try {
    await s.fetchSettings();
    s.applyTheme();
    showToast("success", "Settings loaded", "check-circle");
  } catch (err) {
    console.error("Failed to load settings:", err);
    showToast("error", "Failed to load settings");
  }
});

watch(
  () => ({ ...s.ai }),
  () => {
    unsavedAi.value = false;
  },
  { deep: true },
);

function showToast(type, message, icon = "") {
  toast.visible = true;
  toast.type = type;
  toast.message = message;
  toast.icon = icon;
}

function dismissToast() {
  toast.visible = false;
}

function toggleLearning() {
  unsavedAi.value = true;
}

function toggleSuggestionType() {
  unsavedAi.value = true;
}

function discardAi() {
  unsavedAi.value = false;
}

async function saveAi() {
  await s.updateSettings({ ai: { ...aiDraft.value } });
  unsavedAi.value = false;
  showToast("success", "AI settings saved", "check-circle");
}
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: var(--md-sys-typescale-headline-large);
  font-weight: 500;
  margin: var(--md-sys-spacing-xl) 0 var(--md-sys-spacing-2xl);
}

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
}

.setting-label {
  font-size: var(--md-sys-typescale-body-medium);
  font-weight: 500;
}

.setting-description {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.btn-sm {
  font-size: var(--md-sys-typescale-label-medium);
  padding: var(--md-sys-spacing-xs) var(--md-sys-spacing-sm);
  min-height: 32px;
}

/* Toggle (copied for consistency) */
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

/* Custom chip for AI suggestions */
.suggestion-types {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: calc(var(--md-sys-spacing-sm) + 2px) var(--md-sys-spacing-md);
  border-radius: var(--md-sys-radius-full);
  font-size: var(--md-sys-typescale-label-medium);
  background-color: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
  cursor: pointer;
  transition:
    background-color var(--md-sys-transition-fast),
    color var(--md-sys-transition-fast);
  user-select: none;
}

.chip.active {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.chip-text {
  display: flex;
  align-items: center;
  gap: 4px;
}

.chip-text::after {
  content: "";
  display: inline-block;
  width: 4px;
  height: 4px;
  background: currentColor;
  border-radius: 50%;
  opacity: 0;
  transition: opacity var(--md-sys-transition-fast);
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
</style>
