<template>
  <section class="settings-section card">
    <div class="section-header">
      <div class="section-icon">
        <span class="mdi mdi-database"></span>
      </div>
      <div>
        <h2 class="section-title">Data</h2>
        <p class="section-subtitle">Export and import your chore data</p>
      </div>
    </div>

    <div class="data-info">
      <p><strong>Version:</strong> {{ version }}</p>
      <p>Export your chores and logs for backup.</p>
    </div>

    <div class="data-actions">
      <button
        @click="handleExport"
        class="btn btn-tonal data-btn"
        :disabled="s.loading"
      >
        <span class="mdi mdi-download" style="margin-right: 8px"></span>
        Export Data
      </button>

      <button @click="triggerImport" class="btn btn-tonal data-btn">
        <span class="mdi mdi-upload" style="margin-right: 8px"></span>
        Import Data
      </button>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      style="display: none"
      @change="handleImport"
    />

    <!-- Confirmation dialog -->
    <div
      v-if="showConfirm"
      class="modal-overlay"
      @click.self="showConfirm = false"
    >
      <div class="confirmation-dialog">
        <div class="dialog-icon">
          <span class="mdi mdi-alert"></span>
        </div>
        <h3 class="dialog-title">Import data?</h3>
        <p class="dialog-text">
          This will import chores and logs from the selected file. Current data
          will remain untouched.
        </p>
        <div class="dialog-actions">
          <button class="btn btn-text" @click="showConfirm = false">
            Cancel
          </button>
          <button class="btn btn-filled" @click="confirmImport">Confirm</button>
        </div>
      </div>
    </div>

    <!-- Version info -->
    <div class="version-info">
      <p>Frontend running on {{ envInfo }}</p>
      <p
        data-api-status
        :class="{
          'api-connected': apiConnected,
          'api-disconnected': !apiConnected,
        }"
      >
        <span class="status-dot" :class="apiConnected ? 'green' : 'red'"></span>
        API connection
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { choreApi, getToken } from "@/api";

const s = useSettingsStore();
const fileInput = ref(null);
const showConfirm = ref(false);
const pendingFile = ref(null);
const version = "1.0.0";
const apiConnected = ref(false);
const envInfo = import.meta.env.VITE_APP_ENV || "development";

async function checkApi() {
  try {
    if (!getToken()) return;
    await choreApi.get("/");
    apiConnected.value = true;
  } catch {
    apiConnected.value = false;
  } finally {
    if (!getToken()) apiConnected.value = false;
  }
}

onMounted(() => {
  checkApi();
});

function handleExport() {
  s.exportData();
}

function triggerImport() {
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function handleImport(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    pendingFile.value = evt.target?.result;
    showConfirm.value = true;
  };
  reader.readAsText(file);

  // Reset file input so same file can be selected again
  e.target.value = "";
}

async function confirmImport() {
  if (!pendingFile.value) return;

  showConfirm.value = false;

  try {
    await s.importData(pendingFile.value);
    pendingFile.value = null;
    showToast("success", "Import successful", "check-circle");
  } catch (err) {
    pendingFile.value = null;
    showToast("error", "Import failed: " + err.message);
  }
}

function showToast(type, message) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "polite");
  el.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: ${type === "error" ? "var(--md-sys-color-error)" : "#2e7d32"};
    color: white; padding: 8px 24px; border-radius: 24px;
    box-shadow: var(--md-sys-elevation-3); z-index: 9999;
    font-size: var(--md-sys-typescale-body-medium);
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s";
    el.style.opacity = "0";
    setTimeout(() => document.body.removeChild(el), 300);
  }, 3000);
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
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
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

.data-info {
  padding: var(--md-sys-spacing-sm) 0;
  color: var(--md-sys-color-on-surface-variant);
  font-size: var(--md-sys-typescale-body-medium);
  line-height: 1.6;
}

.data-info p {
  margin-bottom: 4px;
}

.data-actions {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
  flex-wrap: wrap;
}

.data-btn {
  flex: 1;
  min-width: 160px;
}

.version-info {
  margin-top: var(--md-sys-spacing-lg);
  padding-top: var(--md-sys-spacing-md);
  border-top: 1px solid var(--md-sys-color-outline-variant);
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
  line-height: 1.6;
}

[data-api-status] {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-xs);
  margin-top: var(--md-sys-spacing-xs);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.status-dot.green {
  background-color: var(--md-sys-color-primary);
}

.status-dot.red {
  background-color: var(--md-sys-color-error);
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: var(--md-sys-zindex-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-lg);
}

.confirmation-dialog {
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-radius-extra-large);
  padding: var(--md-sys-spacing-xl);
  max-width: 400px;
  width: 100%;
  animation: dialog-in var(--md-sys-transition-normal) ease;
}

.dialog-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--md-sys-radius-full);
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin: 0 auto var(--md-sys-spacing-md);
}

.dialog-title {
  font-size: var(--md-sys-typescale-title-large);
  font-weight: 500;
  text-align: center;
  margin-bottom: var(--md-sys-spacing-sm);
}

.dialog-text {
  font-size: var(--md-sys-typescale-body-medium);
  color: var(--md-sys-color-on-surface-variant);
  text-align: center;
  margin-bottom: var(--md-sys-spacing-lg);
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  justify-content: flex-end;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
