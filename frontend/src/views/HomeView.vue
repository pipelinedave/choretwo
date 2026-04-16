<template>
  <div class="home-view">
    <!-- Welcome section -->
    <div class="welcome-section">
      <h1>Welcome back, {{ authStore.user?.email?.split('@')[0] || 'User' }}!</h1>
      <p>Here's what's happening with your chores today.</p>
    </div>

    <!-- Stats cards -->
    <div class="stats-grid">
      <div class="stat-card card" @click="navigateTo('/chores?filter=overdue')">
        <div class="stat-icon overdue">
          <span class="mdi mdi-alert-circle"></span>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ choreStore.stats.overdue }}</span>
          <span class="stat-label">Overdue</span>
        </div>
      </div>

      <div class="stat-card card" @click="navigateTo('/chores?filter=due-soon')">
        <div class="stat-icon due-soon">
          <span class="mdi mdi-clock-outline"></span>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ choreStore.stats.dueSoon }}</span>
          <span class="stat-label">Due Soon</span>
        </div>
      </div>

      <div class="stat-card card" @click="navigateTo('/chores?filter=completed')">
        <div class="stat-icon completed">
          <span class="mdi mdi-check-circle"></span>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ choreStore.stats.completed }}</span>
          <span class="stat-label">Completed</span>
        </div>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="quick-actions">
      <button @click="showAddForm = true" class="btn btn-filled">
        <span class="mdi mdi-plus" style="margin-right: 8px;"></span>
        Add Chore
      </button>
      <button @click="showLogs = true" class="btn btn-tonal">
        <span class="mdi mdi-history" style="margin-right: 8px;"></span>
        View Logs
      </button>
    </div>

    <!-- Today's chores preview -->
    <div class="chores-preview">
      <div class="section-header">
        <h2>Today's Chores</h2>
        <router-link to="/chores" class="view-all">View all</router-link>
      </div>

      <LoadingSpinner v-if="choreStore.loading" />

      <EmptyState 
        v-else-if="filteredChores.length === 0"
        message="No chores for today. Enjoy your free time!"
        show-add-button
        @add="showAddForm = true"
      />

      <div v-else class="chore-list-preview">
        <ChoreCard
          v-for="chore in filteredChores.slice(0, 5)"
          :key="chore.id"
          :chore="chore"
          @toggle="handleToggle"
          @edit="handleEdit"
          @archive="handleArchive"
        />
      </div>
    </div>

    <!-- Add chore form modal -->
    <AddChoreForm 
      v-if="showAddForm"
      @submit="handleAddChore"
      @close="showAddForm = false"
    />

    <!-- Edit chore form modal -->
    <AddChoreForm 
      v-if="showEditForm && editingChore"
      :chore="editingChore"
      @submit="handleUpdateChore"
      @close="showEditForm = false"
    />

    <!-- Log overlay -->
    <LogOverlay :is-open="showLogs" @close="showLogs = false" />

    <!-- Undo banner -->
    <UndoBanner />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useChoreStore } from '@/stores/chore'
import { useLogStore } from '@/stores/log'
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'
import EmptyState from '@/components/chores/EmptyState.vue'
import ChoreCard from '@/components/chores/ChoreCard.vue'
import AddChoreForm from '@/components/chores/AddChoreForm.vue'
import LogOverlay from '@/components/logs/LogOverlay.vue'
import UndoBanner from '@/components/logs/UndoBanner.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const choreStore = useChoreStore()
const logStore = useLogStore()

const showAddForm = ref(false)
const showEditForm = ref(false)
const showLogs = ref(false)
const editingChore = ref(null)

const filteredChores = computed(() => {
  return choreStore.filteredChores
})

onMounted(async () => {
  await choreStore.fetchChores()
  await logStore.fetchLogs(20)
})

function navigateTo(path) {
  router.push(path)
}

async function handleToggle(choreId) {
  const chore = choreStore.chores.find(c => c.id === choreId)
  if (chore && !chore.done) {
    try {
      await choreStore.markDone(choreId, authStore.user.email)
    } catch (err) {
      console.error('Failed to mark chore as done:', err)
    }
  }
}

function handleEdit(choreId) {
  editingChore.value = choreStore.chores.find(c => c.id === choreId)
  showEditForm.value = true
}

async function handleArchive(choreId) {
  try {
    await choreStore.archiveChore(choreId)
  } catch (err) {
    console.error('Failed to archive chore:', err)
  }
}

async function handleAddChore(formData) {
  try {
    await choreStore.addChore(formData)
    showAddForm.value = false
  } catch (err) {
    console.error('Failed to add chore:', err)
  }
}

async function handleUpdateChore(formData) {
  try {
    await choreStore.updateChore(formData.id, formData)
    showEditForm.value = false
    editingChore.value = null
  } catch (err) {
    console.error('Failed to update chore:', err)
  }
}
</script>

<style scoped>
.home-view {
  max-width: 800px;
  margin: 0 auto;
}

.welcome-section {
  margin-bottom: var(--md-sys-spacing-lg);
}

.welcome-section h1 {
  font-size: var(--md-sys-typescale-headline-large);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin-bottom: var(--md-sys-spacing-sm);
}

.welcome-section p {
  font-size: var(--md-sys-typescale-body-large);
  color: var(--md-sys-color-on-surface-variant);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-lg);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  cursor: pointer;
  transition: transform var(--md-sys-transition-fast);
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--md-sys-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.stat-icon.overdue {
  background-color: var(--md-sys-color-overdue);
}

.stat-icon.due-soon {
  background-color: var(--md-sys-color-due-soon);
}

.stat-icon.completed {
  background-color: var(--md-sys-color-completed);
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: var(--md-sys-typescale-display-small);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.stat-label {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.quick-actions {
  display: flex;
  gap: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-lg);
}

.chores-preview {
  margin-top: var(--md-sys-spacing-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--md-sys-spacing-md);
}

.section-header h2 {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 500;
}

.view-all {
  color: var(--md-sys-color-primary);
  text-decoration: none;
  font-size: var(--md-sys-typescale-body-medium);
}

.chore-list-preview {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
}
</style>
