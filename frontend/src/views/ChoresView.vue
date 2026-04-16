<template>
  <div class="chores-view">
    <!-- Filter pills -->
    <FilterPills 
      v-model:filter="choreStore.filter"
      :stats="choreStore.stats"
    />

    <!-- Add chore FAB -->
    <button 
      @click="showAddForm = true"
      class="fab shadow-elevation-3"
      aria-label="Add chore"
    >
      <span class="mdi mdi-plus" style="font-size: 24px;"></span>
    </button>

    <LoadingSpinner v-if="choreStore.loading" />

    <EmptyState 
      v-else-if="choreStore.filteredChores.length === 0"
      :message="filterMessage"
      show-add-button
      @add="showAddForm = true"
    />

    <div v-else class="chore-list">
      <ChoreCard
        v-for="chore in choreStore.filteredChores"
        :key="chore.id"
        :chore="chore"
        @toggle="handleToggle"
        @edit="handleEdit"
        @archive="handleArchive"
      />
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

    <!-- Undo banner -->
    <UndoBanner />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useChoreStore } from '@/stores/chore'
import { useAuthStore } from '@/stores/auth'
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'
import EmptyState from '@/components/chores/EmptyState.vue'
import FilterPills from '@/components/chores/FilterPills.vue'
import ChoreCard from '@/components/chores/ChoreCard.vue'
import AddChoreForm from '@/components/chores/AddChoreForm.vue'
import UndoBanner from '@/components/logs/UndoBanner.vue'

const choreStore = useChoreStore()
const authStore = useAuthStore()

const showAddForm = ref(false)
const showEditForm = ref(false)
const editingChore = ref(null)

const filterMessage = computed(() => {
  const filter = choreStore.filter
  if (filter === 'completed') return 'No completed chores yet.'
  if (filter === 'overdue') return 'No overdue chores. Great job!'
  if (filter === 'due-soon') return 'No chores due soon.'
  return 'No chores to show.'
})

onMounted(async () => {
  await choreStore.fetchChores()
})

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
  bottom: calc(120px + env(safe-area-inset-bottom));
}
</style>
