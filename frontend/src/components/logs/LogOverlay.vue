<template>
  <transition name="slide-up">
    <div v-if="isOpen" class="log-overlay" @click.self="close">
      <div class="log-overlay-content">
        <div class="log-overlay-header">
          <h2>Activity Log</h2>
          <button @click="close" class="btn-icon">
            <span class="mdi mdi-close"></span>
          </button>
        </div>

        <div v-if="logStore.loading" class="log-loading">
          <LoadingSpinner />
        </div>

        <EmptyState 
          v-else-if="logs.length === 0"
          message="No recent activity"
        />

        <div v-else class="log-list">
          <LogItem 
            v-for="log in logs" 
            :key="log.id"
            :log="log"
            @undo="handleUndo"
          />
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useLogStore } from '@/stores/log'
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'
import EmptyState from '@/components/chores/EmptyState.vue'
import LogItem from './LogItem.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])
const logStore = useLogStore()

const logs = ref([])

watch(() => props.isOpen, async (newOpen) => {
  if (newOpen) {
    await logStore.fetchLogs()
    logs.value = logStore.logs
  }
})

function close() {
  emit('close')
}

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
.log-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: var(--md-sys-zindex-drawer);
  display: flex;
  align-items: flex-end;
}

.log-overlay-content {
  width: 100%;
  max-height: 80vh;
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-radius-extra-large) var(--md-sys-radius-extra-large) 0 0;
  display: flex;
  flex-direction: column;
}

.log-overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-lg);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.log-overlay-header h2 {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 500;
}

.log-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-2xl);
}

.log-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--md-sys-spacing-md);
}
</style>
