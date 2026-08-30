<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Notification Settings" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Notification Settings</h2>
      </div>

      <div class="modal-body">
        <div class="custom-checkbox-wrapper">
          <input type="checkbox" id="enable-notif" v-model="enabled" @change="onToggleNotifications" />
          <label for="enable-notif">
            <span class="checkbox-text">Enable Push Notifications</span>
          </label>
        </div>

        <div v-if="enabled" class="times-section">
          <label class="section-label">Notification Times:</label>
          <div v-for="(time, idx) in times" :key="idx" class="time-input-group">
            <input type="time" v-model="times[idx]" class="time-input" />
            <button
              v-if="times.length > 1"
              type="button"
              class="btn btn-sm btn-danger remove-time-btn"
              @click="removeTime(idx)"
              title="Remove time"
            >
              <span class="mdi mdi-trash-can-outline"></span>
            </button>
          </div>

          <button type="button" class="btn btn-sm btn-tonal add-time-btn" @click="addTime">
            <span class="mdi mdi-plus"></span> Add Time
          </button>

          <div class="test-notif-section">
            <button type="button" class="btn btn-sm btn-tonal" @click="sendTestNotification" :disabled="testing">
              <span class="mdi mdi-bell-ring-outline"></span>
              {{ testing ? 'Sending...' : 'Send Test Notification' }}
            </button>
            <span v-if="testResult" class="test-result">{{ testResult }}</span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-tonal" @click="cancelChanges">
          Cancel
        </button>
        <button class="btn btn-primary" @click="saveChanges">
          <span class="mdi mdi-content-save"></span> Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { notifyApi } from "@/api";

const NOTIF_KEY = "choretwo_notification_settings";
const enabled = ref(false);
const times = ref(["09:00"]);
const initialSettings = ref({ enabled: false, times: ["09:00"] });
const testing = ref(false);
const testResult = ref("");

const emit = defineEmits(["close"]);

onMounted(() => {
  loadSettings();
});

function loadSettings() {
  const saved = localStorage.getItem(NOTIF_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      enabled.value = !!parsed.enabled;
      times.value = Array.isArray(parsed.times) && parsed.times.length > 0 ? parsed.times : ["09:00"];
      initialSettings.value = { enabled: enabled.value, times: [...times.value] };
    } catch (e) {
      resetToDefaults();
    }
  } else {
    resetToDefaults();
  }
}

function resetToDefaults() {
  enabled.value = false;
  times.value = ["09:00"];
  initialSettings.value = { enabled: false, times: ["09:00"] };
}

function saveChanges() {
  try {
    localStorage.setItem(
      NOTIF_KEY,
      JSON.stringify({ enabled: enabled.value, times: times.value })
    );
    emit("close");
  } catch (e) {
    alert("Failed to save settings");
  }
}

function cancelChanges() {
  enabled.value = initialSettings.value.enabled;
  times.value = [...initialSettings.value.times];
  emit("close");
}

function addTime() {
  times.value.push("12:00");
}

function removeTime(idx) {
  if (times.value.length > 1) {
    times.value.splice(idx, 1);
  }
}

async function onToggleNotifications() {
  if (enabled.value && "Notification" in window) {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      enabled.value = false;
      alert("Notification permission denied.");
    }
  }
}

async function sendTestNotification() {
  testing.value = true;
  testResult.value = "";
  try {
    await notifyApi.post("/test", { message: "Choretwo test notification! Everything is working." });
    testResult.value = "Notification sent!";
  } catch (err) {
    testResult.value = "Failed to send: " + (err.message || "Network error");
  } finally {
    testing.value = false;
  }
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
  max-width: 480px;
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
  gap: 1rem;
}

.custom-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-text {
  font-weight: 600;
}

.times-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.section-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.time-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-surface-lighter);
}

.test-notif-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.test-result {
  font-size: 0.8rem;
  color: var(--color-primary);
  font-weight: 600;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--color-surface-lighter);
  background: rgba(255, 255, 255, 0.3);
}
</style>
