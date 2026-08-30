<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="Import/Export Data" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Import / Export Chores & Logs</h2>
      </div>

      <div class="modal-body">
        <button class="btn btn-primary export-btn" @click="exportData" :disabled="exporting">
          <span class="mdi mdi-download"></span>
          {{ exporting ? 'Exporting...' : 'Export Backup (JSON)' }}
        </button>

        <input
          type="file"
          ref="importInput"
          style="display: none"
          @change="handleFileSelected"
          accept="application/json"
        />

        <button class="btn btn-warning import-btn" @click="triggerImport" :disabled="importing">
          <span class="mdi mdi-upload"></span>
          {{ importing ? 'Importing...' : 'Import Backup (JSON)' }}
        </button>

        <div v-if="statusMessage" class="status-msg" :class="{ error: isError, success: !isError }">
          {{ statusMessage }}
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-tonal" @click="$emit('close')">
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useChoreStore } from "@/stores/chore";
import { useLogStore } from "@/stores/log";
import { choreApi } from "@/api";

const emit = defineEmits(["close"]);
const choreStore = useChoreStore();
const logStore = useLogStore();

const importInput = ref(null);
const exporting = ref(false);
const importing = ref(false);
const statusMessage = ref("");
const isError = ref(false);

async function exportData() {
  exporting.value = true;
  statusMessage.value = "";
  try {
    const backupData = {
      version: 2,
      export_date: new Date().toISOString(),
      chores: choreStore.chores,
      archived_chores: choreStore.archivedChores,
      logs: logStore.logs,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `choretwo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    statusMessage.value = "Backup exported successfully!";
    isError.value = false;
  } catch (err) {
    statusMessage.value = "Export failed: " + (err.message || "Unknown error");
    isError.value = true;
  } finally {
    exporting.value = false;
  }
}

function triggerImport() {
  importInput.value?.click();
}

async function handleFileSelected(event) {
  statusMessage.value = "";
  const file = event.target.files?.[0];
  if (!file) return;

  importing.value = true;
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const choresList = Array.isArray(data.chores) ? data.chores : Array.isArray(data) ? data : null;

      if (!choresList) {
        throw new Error("Invalid backup file structure: expected chores array");
      }

      let importedCount = 0;
      for (const item of choresList) {
        try {
          await choreStore.addChore({
            name: item.name || item.title,
            interval: item.interval || item.interval_days || 7,
            dueDate: item.dueDate || item.due_date || new Date().toISOString().split("T")[0],
            private: !!(item.private || item.is_private),
          });
          importedCount++;
        } catch (itemErr) {
          console.warn("Skipping failed item:", item, itemErr);
        }
      }

      await choreStore.fetchChores();
      await logStore.fetchLogs();

      statusMessage.value = `Successfully imported ${importedCount} chores!`;
      isError.value = false;
    } catch (err) {
      statusMessage.value = "Import failed: " + (err.message || "Invalid JSON");
      isError.value = true;
    } finally {
      importing.value = false;
      if (importInput.value) importInput.value.value = "";
    }
  };

  reader.readAsText(file);
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

.export-btn, .import-btn {
  padding: 0.85rem 1.25rem;
  font-size: 1rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.status-msg {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 500;
}

.status-msg.success {
  background: rgba(72, 187, 120, 0.15);
  color: #2e7d32;
  border: 1px solid rgba(72, 187, 120, 0.3);
}

.status-msg.error {
  background: rgba(231, 99, 99, 0.15);
  color: var(--color-danger);
  border: 1px solid rgba(231, 99, 99, 0.3);
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-surface-lighter);
  background: rgba(255, 255, 255, 0.3);
}
</style>
