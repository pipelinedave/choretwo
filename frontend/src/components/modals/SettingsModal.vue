<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Settings" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>App Settings</h2>
      </div>

      <div class="modal-body">
        <div class="settings-section">
          <label class="section-title">Theme</label>
          <div class="theme-options">
            <button
              class="btn btn-sm"
              :class="theme === 'light' ? 'btn-primary' : 'btn-tonal'"
              @click="setTheme('light')"
            >
              <span class="mdi mdi-white-balance-sunny"></span> Light
            </button>
            <button
              class="btn btn-sm"
              :class="theme === 'dark' ? 'btn-primary' : 'btn-tonal'"
              @click="setTheme('dark')"
            >
              <span class="mdi mdi-weather-night"></span> Dark
            </button>
            <button
              class="btn btn-sm"
              :class="theme === 'auto' ? 'btn-primary' : 'btn-tonal'"
              @click="setTheme('auto')"
            >
              <span class="mdi mdi-theme-light-dark"></span> System
            </button>
          </div>
        </div>

        <div class="settings-section">
          <label class="section-title">AI Copilot</label>
          <div class="custom-checkbox-wrapper">
            <input type="checkbox" id="ai-enabled" v-model="aiEnabled" @change="savePreferences" />
            <label for="ai-enabled">
              <span class="checkbox-text">Enable Natural Language Copilot Bar</span>
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" @click="$emit('close')">
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const emit = defineEmits(["close"]);

const theme = ref("light");
const aiEnabled = ref(true);

onMounted(() => {
  const savedTheme = localStorage.getItem("choretwo_theme") || "light";
  theme.value = savedTheme;
  applyTheme(savedTheme);

  const savedAi = localStorage.getItem("choretwo_ai_enabled");
  aiEnabled.value = savedAi !== null ? JSON.parse(savedAi) : true;
});

function setTheme(val) {
  theme.value = val;
  localStorage.setItem("choretwo_theme", val);
  applyTheme(val);
}

function applyTheme(val) {
  if (val === "dark" || (val === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function savePreferences() {
  localStorage.setItem("choretwo_ai_enabled", JSON.stringify(aiEnabled.value));
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 45, 44, 0.45);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: var(--color-background);
  background-image:
    radial-gradient(120% 160% at 10% 10%, rgba(253, 232, 213, 0.6) 0%, rgba(253, 232, 213, 0) 45%),
    radial-gradient(90% 120% at 90% 20%, rgba(189, 233, 221, 0.6) 0%, rgba(189, 233, 221, 0) 52%);
  color: var(--color-text);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-surface-lighter);
}

.modal-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.theme-options {
  display: flex;
  gap: 8px;
}

.custom-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-text {
  font-size: 0.9rem;
  font-weight: 500;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-surface-lighter);
  background: rgba(255, 255, 255, 0.3);
}
</style>
