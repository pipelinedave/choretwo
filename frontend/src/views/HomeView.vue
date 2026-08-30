<template>
  <div class="home-view">
    <!-- Top Header -->
    <AppHeader
      title="CHORETWO"
      :showAiBar="showAiBar"
      @toggleAddChore="showAddModal = true"
      @toggleAiBar="showAiBar = !showAiBar"
      @openArchive="showArchiveModal = true"
      @openNotifications="showNotificationsModal = true"
      @openImportExport="showImportExportModal = true"
      @openSettings="showSettingsModal = true"
      @openAbout="showAboutModal = true"
    />

    <!-- AI Copilot Quick Action Bar -->
    <transition name="fade">
      <CopilotBar v-if="showAiBar" />
    </transition>

    <!-- Welcome section -->
    <div class="welcome-section">
      <p class="welcome-text">Welcome back, {{ authStore.user?.email?.split("@")[0] || "User" }}!</p>
    </div>

    <!-- Performance Bar (Household Health 0-100) -->
    <PerformanceBar :score="choreStore.householdHealth" />

    <!-- Filter Pills Bar -->
    <FilterPills
      v-model:filter="choreStore.filter"
      :counts="choreStore.bucketCounts"
      :stats="choreStore.stats"
      @clearFilter="choreStore.setFilter('all')"
    />

    <!-- Loading Indicator -->
    <LoadingSpinner v-if="choreStore.loading && choreStore.chores.length === 0" />

    <!-- Empty State -->
    <EmptyState
      v-else-if="filteredChores.length === 0"
      :message="emptyMessage"
      :show-add-button="true"
      @add="showAddModal = true"
    />

    <!-- Urgency-Sorted Chore List -->
    <div v-else class="chores-list" role="list">
      <ChoreCard
        v-for="chore in filteredChores"
        :key="chore.id"
        :chore="chore"
        @toggle="handleToggle"
        @markAsDone="handleToggle"
        @updateChore="handleUpdateChore"
        @archive="handleArchiveChore"
        @archiveChore="handleArchiveChore"
      />
    </div>

    <!-- Bottom Activity Log Drawer / Overlay -->
    <LogOverlay />

    <!-- Modals -->
    <AddChoreForm
      v-if="showAddModal"
      @addChore="handleAddChore"
      @submit="handleAddChore"
      @close="showAddModal = false"
    />

    <ArchivedChoresModal
      v-if="showArchiveModal"
      @close="showArchiveModal = false"
    />

    <NotificationSettingsModal
      v-if="showNotificationsModal"
      @close="showNotificationsModal = false"
    />

    <ImportExportModal
      v-if="showImportExportModal"
      @close="showImportExportModal = false"
    />

    <SettingsModal
      v-if="showSettingsModal"
      @close="showSettingsModal = false"
    />

    <AboutModal
      v-if="showAboutModal"
      @close="showAboutModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useChoreStore } from "@/stores/chore";
import { useLogStore } from "@/stores/log";
import { useAuthStore } from "@/stores/auth";

import AppHeader from "@/components/layout/AppHeader.vue";
import PerformanceBar from "@/components/layout/PerformanceBar.vue";
import FilterPills from "@/components/chores/FilterPills.vue";
import ChoreCard from "@/components/chores/ChoreCard.vue";
import EmptyState from "@/components/chores/EmptyState.vue";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import LogOverlay from "@/components/logs/LogOverlay.vue";
import CopilotBar from "@/components/ai/CopilotBar.vue";

import AddChoreForm from "@/components/chores/AddChoreForm.vue";
import ArchivedChoresModal from "@/components/modals/ArchivedChoresModal.vue";
import NotificationSettingsModal from "@/components/modals/NotificationSettingsModal.vue";
import ImportExportModal from "@/components/modals/ImportExportModal.vue";
import SettingsModal from "@/components/modals/SettingsModal.vue";
import AboutModal from "@/components/modals/AboutModal.vue";

const choreStore = useChoreStore();
const logStore = useLogStore();
const authStore = useAuthStore();

const showAddModal = ref(false);
const showAiBar = ref(false);
const showArchiveModal = ref(false);
const showNotificationsModal = ref(false);
const showImportExportModal = ref(false);
const showSettingsModal = ref(false);
const showAboutModal = ref(false);

const filteredChores = computed(() => {
  return choreStore.filteredChores;
});

const emptyMessage = computed(() => {
  const f = choreStore.filter;
  if (f === "overdue") return "No overdue chores! Excellent work!";
  if (f === "today") return "No chores due today! Enjoy your day!";
  if (f === "tomorrow") return "No chores due tomorrow.";
  if (f === "thisWeek") return "No chores due this week.";
  if (f === "upcoming") return "No upcoming chores.";
  return "No chores yet. Click + to add your first chore!";
});

onMounted(async () => {
  await choreStore.fetchChores();
  await logStore.fetchLogs();
});

async function handleToggle(choreId) {
  try {
    await choreStore.markDone(choreId, authStore.user?.email);
    await logStore.fetchLogs();
  } catch (err) {
    console.error("Failed to mark chore done:", err);
  }
}

async function handleAddChore(choreData) {
  try {
    await choreStore.addChore(choreData);
    await logStore.fetchLogs();
  } catch (err) {
    console.error("Failed to add chore:", err);
  }
}

async function handleUpdateChore(choreData) {
  try {
    await choreStore.updateChore(choreData.id, choreData);
    await logStore.fetchLogs();
  } catch (err) {
    console.error("Failed to update chore:", err);
  }
}

async function handleArchiveChore(choreId) {
  try {
    await choreStore.archiveChore(choreId);
    await logStore.fetchLogs();
  } catch (err) {
    console.error("Failed to archive chore:", err);
  }
}
</script>

<style scoped>
.home-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 90px;
}

.chores-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
</style>
