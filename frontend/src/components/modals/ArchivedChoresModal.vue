<template>
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Archived Chores"
    @click.self="$emit('close')"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>Archived Chores</h2>
      </div>

      <div class="modal-body" ref="modalBody">
        <LoadingSpinner
          v-if="choreStore.loading"
          context="chores"
          message="Archivierte Chores werden geladen…"
        />
        <EmptyState
          v-else-if="choreStore.archivedChores.length === 0"
          type="archived"
          title="No archived chores"
          message="Archived chores will appear here once you archive them from your active chores list."
        />

        <div v-else class="chore-cards-archived">
          <div
            v-for="chore in choreStore.archivedChores"
            :key="chore.id"
            class="archived-chore-container"
          >
            <ChoreCard
              :chore="chore"
              :isArchivedView="true"
              @archiveChore="handleUnarchive"
              @updateChore="handleUpdate"
            />
            <button
              class="unarchive-button btn btn-sm btn-tonal"
              @click="handleUnarchive(chore.id)"
              aria-label="Unarchive chore"
              title="Unarchive chore"
            >
              <span class="mdi mdi-undo"></span>
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn btn-tonal"
          @click="$emit('close')"
          aria-label="Close dialog"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useChoreStore } from "@/stores/chore";
import ChoreCard from "@/components/chores/ChoreCard.vue";
import EmptyState from "@/components/chores/EmptyState.vue";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";

defineEmits(["close"]);
const choreStore = useChoreStore();

onMounted(async () => {
  await choreStore.fetchArchivedChores();
});

async function handleUnarchive(choreId) {
  try {
    await choreStore.unarchiveChore(choreId);
  } catch (err) {
    console.error("Failed to unarchive chore:", err);
  }
}

async function handleUpdate(choreData) {
  try {
    await choreStore.updateChore(choreData.id, choreData);
  } catch (err) {
    console.error("Failed to update chore:", err);
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
  background: var(--color-overlay-scrim);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--md-sys-zindex-modal);
  padding: 1rem;
}

.modal-content {
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  background: var(--color-background);
  background-image:
    radial-gradient(
      120% 160% at 10% 10%,
      rgb(var(--md-sys-color-accent-warm-rgb) / 0.6) 0%,
      rgb(var(--md-sys-color-accent-warm-rgb) / 0) 45%
    ),
    radial-gradient(
      90% 120% at 90% 20%,
      rgb(var(--md-sys-color-accent-cool-rgb) / 0.6) 0%,
      rgb(var(--md-sys-color-accent-cool-rgb) / 0) 52%
    );
  border-radius: var(--md-sys-radius-large);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  color: var(--color-text);
  border: 1px solid var(--color-border-glass);
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-surface-lighter);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.chore-cards-archived {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.archived-chore-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.archived-chore-container :deep(.chore-card-wrapper) {
  flex: 1;
  margin-bottom: 0;
}

.unarchive-button {
  width: 40px;
  height: 40px;
  border-radius: var(--md-sys-radius-medium);
  padding: 0;
  flex-shrink: 0;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-surface-lighter);
  background: var(--color-surface-overlay-soft);
}
</style>
