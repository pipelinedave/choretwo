<template>
  <div class="logs-view">
    <LoadingSpinner v-if="logStore.loading" />

    <EmptyState 
      v-else-if="logs.length === 0"
      message="No recent activity to show."
    />

    <div v-else class="log-list">
      <LogItem 
        v-for="log in logs" 
        :key="log.id"
        :log="log"
        @undo="handleUndo"
      />
    </div>

    <!-- Undo banner -->
    <UndoBanner />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLogStore } from '@/stores/log'
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'
import EmptyState from '@/components/chores/EmptyState.vue'
import LogItem from '@/components/logs/LogItem.vue'
import UndoBanner from '@/components/logs/UndoBanner.vue'

const logStore = useLogStore()
const logs = ref([])

onMounted(async () => {
  await logStore.fetchLogs(100)
  logs.value = logStore.logs
})

watch(() => logStore.logs, (newLogs) => {
  logs.value = newLogs
}, { deep: true })

async function handleUndo(logId) {
  try {
    await logStore.undo(logId)
    logs.value = logStore.logs
  } catch (err) {
    console.error('Undo failed:', err)
  }
}
</script>

<style scoped>
.logs-view {
  max-width: 800px;
  margin: 0 auto;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
}
</style>
