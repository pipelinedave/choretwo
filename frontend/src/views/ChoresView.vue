<template>
  <div class="chores-view">
    <!-- Filter pills -->
    <FilterPills v-model:filter="choreStore.filter" :stats="choreStore.stats" />

    <!-- Performance bar -->
    <PerformanceBar :score="choreStore.householdHealth" label="Health" />

    <!-- Add chore FAB -->
    <button
      @click="showAddForm = true"
      class="fab shadow-elevation-3"
      aria-label="Add chore"
    >
      <span class="mdi mdi-plus" style="font-size: 24px"></span>
    </button>

    <LoadingSpinner v-if="choreStore.loading" context="chores" />

    <EmptyState
      v-else-if="choreStore.filteredChores.length === 0"
      :message="filterMessage"
      show-add-button
      @add="showAddForm = true"
    />

    <div v-else class="chore-list">
      <ChoreCard
        v-for="chore in filteredChores"
        :key="chore.id"
        :chore="chore"
        :completing="completingIds.has(chore.id)"
        @toggle="handleToggle"
        @updateChore="handleUpdateChore"
        @archive="handleArchive"
      />
    </div>

    <!-- Add chore form modal -->
    <AddChoreForm
      v-if="showAddForm"
      @submit="handleAddChore"
      @close="showAddForm = false"
    />

    <!-- Undo banner -->
    <UndoBanner />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useChoreStore } from "@/stores/chore";
import { useAuthStore } from "@/stores/auth";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import EmptyState from "@/components/chores/EmptyState.vue";
import FilterPills from "@/components/chores/FilterPills.vue";
import PerformanceBar from "@/components/layout/PerformanceBar.vue";
import ChoreCard from "@/components/chores/ChoreCard.vue";
import AddChoreForm from "@/components/chores/AddChoreForm.vue";
import UndoBanner from "@/components/logs/UndoBanner.vue";

const choreStore = useChoreStore();
const authStore = useAuthStore();

const showAddForm = ref(false);
const completingIds = ref(new Set());

const filteredChores = computed(() => {
  const base = choreStore.filteredChores;
  if (completingIds.value.size === 0) return base;
  const baseIds = new Set(base.map((c) => c.id));
  const stillCompleting = choreStore.chores.filter(
    (c) => completingIds.value.has(c.id) && !baseIds.has(c.id),
  );
  return [...base, ...stillCompleting];
});

const filterMessage = computed(() => {
  const filter = choreStore.filter;
  if (filter === "completed") return "No completed chores yet.";
  if (filter === "overdue") return "No overdue chores. Great job!";
  if (filter === "due-soon") return "No chores due soon.";
  return "No chores to show.";
});

onMounted(async () => {
  await choreStore.fetchChores();
});

async function handleToggle(choreId) {
  const chore = choreStore.chores.find((c) => c.id === choreId);
  if (chore && !chore.done) {
    completingIds.value.add(choreId);
    try {
      await choreStore.markDone(choreId, authStore.user.email);
    } catch (err) {
      console.error("Failed to mark chore as done:", err);
    } finally {
      setTimeout(() => {
        completingIds.value.delete(choreId);
      }, 1000);
    }
  }
}

// Kein eigenes Edit-Modal mehr: die ChoreCard editiert inline und emittiert
// `updateChore`. Das Modal lag ueber dem Inline-Editor und blockierte dessen
// Buttons — siehe ChoreCard.vue, Kommentar an der entfernten emit("edit").

async function handleArchive(choreId) {
  try {
    await choreStore.archiveChore(choreId);
  } catch (err) {
    console.error("Failed to archive chore:", err);
  }
}

async function handleAddChore(formData) {
  try {
    await choreStore.addChore(formData);
    showAddForm.value = false;
  } catch (err) {
    console.error("Failed to add chore:", err);
  }
}

async function handleUpdateChore(formData) {
  try {
    await choreStore.updateChore(formData.id, formData);
  } catch (err) {
    console.error("Failed to update chore:", err);
  }
}
</script>

<style scoped>
.chores-view {
  max-width: 800px;
  margin: 0 auto;
}

.chore-list {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
}

.fab {
  position: fixed;
  bottom: calc(120px + env(safe-area-inset-bottom));
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
