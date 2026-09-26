<template>
  <section class="settings-section">
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
          @change="
            aiDraft.learning_enabled = !aiDraft.learning_enabled;
            markAiChanged();
          "
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
        <button class="btn btn-text btn-sm" @click="discardAi">Discard</button>
        <button
          class="btn btn-filled btn-sm"
          @click="saveAi"
          :disabled="savingAi"
        >
          <span v-if="savingAi" class="spinner"></span>
          Save
        </button>
      </div>
    </div>

    <SettingsToast
      :visible="toast.visible"
      :message="toast.message"
      :type="toast.type"
      :icon="toast.icon"
      :duration="3000"
      @dismiss="dismissToast"
    />
  </section>
</template>

<script setup>
/**
 * AI-Sektion der Einstellungen.
 *
 * AUSGELAGERT aus views/SettingsView.vue, weil die Route /settings seit
 * 5671fd nicht mehr erreichbar war (die Bottom-Nav war ihr einziger Zugang)
 * und die Seite dadurch toter Code war. Der User hat entschieden: die Route
 * entfaellt, das Settings-Modal ist die einzige Settings-Oberflaeche — und
 * damit darf die AI-Sektion nicht mit verschwinden.
 *
 * Das Modal hatte bisher eine EIGENE, schlechtere AI-Umschaltung: eine
 * einzelne Checkbox gegen `localStorage.choretwo_ai_enabled`. Die Einstellung
 * war damit doppelt vorhanden und nur ueber die tote Route vernuenftig zu
 * bedienen. Diese Komponente ist die einzige AI-Einstellung.
 *
 * Draft/Discard/Save gegen `useSettingsStore` (also `PUT /api/settings`),
 * damit Verwerfen wirklich auf den persistierten Stand zurueckfaellt.
 */
import { reactive, ref } from "vue";
import { useSettingsStore } from "@/stores/settings";
import SettingsToast from "@/components/settings/SettingsToast.vue";

const s = useSettingsStore();
const unsavedAi = ref(false);
const savingAi = ref(false);
const toast = reactive({
  visible: false,
  message: "",
  type: "default",
  icon: "",
});

const aiDraft = reactive({
  learning_enabled: true,
  suggestion_types: ["recurrence", "timing", "assignment"],
});

const suggestionOptions = [
  { label: "Recurrence", value: "recurrence" },
  { label: "Timing", value: "timing" },
  { label: "Assignment", value: "assignment" },
];

/** Uebernimmt den persistierten Stand in den Entwurf. Vom Parent aufrufen. */
function loadFromStore() {
  aiDraft.learning_enabled = s.ai.learning_enabled;
  aiDraft.suggestion_types = [...s.ai.suggestion_types];
  unsavedAi.value = false;
}

function showToast(type, message, icon = "") {
  toast.visible = true;
  toast.type = type;
  toast.message = message;
  toast.icon = icon;
}

function dismissToast() {
  toast.visible = false;
}

function markAiChanged() {
  unsavedAi.value = true;
}

function toggleSuggestionType(value) {
  const idx = aiDraft.suggestion_types.indexOf(value);
  if (idx >= 0) {
    aiDraft.suggestion_types.splice(idx, 1);
  } else {
    aiDraft.suggestion_types.push(value);
  }
  unsavedAi.value = true;
}

function discardAi() {
  aiDraft.learning_enabled = s.ai.learning_enabled;
  aiDraft.suggestion_types = [...s.ai.suggestion_types];
  unsavedAi.value = false;
}

async function saveAi() {
  savingAi.value = true;
  unsavedAi.value = false;
  try {
    await s.updateSettings({ ai: { ...aiDraft } });
    showToast("success", "AI settings saved", "check-circle");
    s.clearError();
  } catch (err) {
    s.clearError();
    const msg =
      err?.response?.data?.detail ||
      err?.message ||
      "AI settings konnten nicht gespeichert werden";
    s.error = msg;
    showToast("error", "Speichern fehlgeschlagen: " + msg);
    unsavedAi.value = true;
    console.error("[AiSettingsSection] saveAi failed:", err);
  } finally {
    savingAi.value = false;
  }
}

defineExpose({ loadFromStore, showToast });
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--md-sys-spacing-lg);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  margin-bottom: var(--md-sys-spacing-md);
}

.section-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--md-sys-radius-medium);
  background: var(--md-sys-color-primary-container);
  color: var(--color-primary);
  font-size: 1.2rem;
  flex-shrink: 0;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.section-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 2px 0 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-sm) 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-label {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
}

.setting-description {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* Toggle — Optik aus AppearanceSettings uebernommen, damit beide
   Einstellungs-Sektionen im Modal gleich aussehen. */
.toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  display: block;
  width: 44px;
  height: 24px;
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface-variant);
  transition: background-color var(--md-sys-transition-fast);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--md-sys-transition-fast);
}

.toggle input:checked + .toggle-slider {
  background: var(--color-primary);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

/* Fokus: der globale Ring aus main.css greift ueber
   :focus-visible, das versteckte Input macht ihn sichtbar. */
.toggle input:focus-visible + .toggle-slider {
  outline: var(--focus-ring-width) solid var(--color-focus-outline);
  outline-offset: var(--focus-ring-offset);
}

.suggestion-types {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-sys-spacing-xs);
  margin-top: var(--md-sys-spacing-sm);
}

.chip {
  padding: 5px 12px;
  border-radius: var(--md-sys-radius-full);
  background: var(--md-sys-color-surface-variant);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color var(--md-sys-transition-fast),
    color var(--md-sys-transition-fast);
  user-select: none;
}

.chip.active {
  background: var(--color-primary);
  color: var(--md-sys-color-on-primary);
}

.save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border-radius: var(--md-sys-radius-medium);
  background: var(--color-surface-variant);
}

.save-bar-text {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.save-bar-actions {
  display: flex;
  gap: var(--md-sys-spacing-xs);
}
</style>
