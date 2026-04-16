<template>
  <div class="log-item card">
    <div class="log-item-icon" :class="logClass">
      <span class="mdi" :class="logIcon"></span>
    </div>
    
    <div class="log-item-content">
      <p class="log-item-text">
        <strong>{{ log.user_email?.split('@')[0] || 'Unknown' }}</strong>
        {{ actionText }}
        <strong>{{ resourceName }}</strong>
      </p>
      <p class="log-item-time">{{ formatTime(log.timestamp) }}</p>
    </div>
    
    <button 
      v-if="canUndo"
      @click="handleUndo"
      class="btn btn-tonal btn-undo"
    >
      Undo
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  log: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['undo'])

const canUndo = computed(() => {
  const undoableActions = ['chore:completed', 'chore:created', 'chore:updated', 'chore:archived']
  return undoableActions.includes(props.log.action)
})

const logClass = computed(() => {
  const action = props.log.action
  if (action.includes('completed')) return 'log-completed'
  if (action.includes('created')) return 'log-created'
  if (action.includes('updated')) return 'log-updated'
  if (action.includes('archived')) return 'log-archived'
  return ''
})

const logIcon = computed(() => {
  const action = props.log.action
  if (action.includes('completed')) return 'mdi-check-circle'
  if (action.includes('created')) return 'mdi-plus-circle'
  if (action.includes('updated')) return 'mdi-pencil-circle'
  if (action.includes('archived')) return 'mdi-archive'
  if (action.includes('deleted')) return 'mdi-delete'
  return 'mdi-history'
})

const actionText = computed(() => {
  const action = props.log.action
  if (action.includes('completed')) return 'completed'
  if (action.includes('created')) return 'created'
  if (action.includes('updated')) return 'updated'
  if (action.includes('archived')) return 'archived'
  if (action.includes('deleted')) return 'deleted'
  return 'did something to'
})

const resourceName = computed(() => {
  const resourceType = props.log.resource_type
  if (resourceType === 'chore') return 'a chore'
  return 'something'
})

function formatTime(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function handleUndo() {
  emit('undo', props.log.id)
}
</script>

<style scoped>
.log-item {
  display: flex;
  align-items: flex-start;
  gap: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-sm);
}

.log-item-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--md-sys-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.log-item-icon.log-completed {
  background-color: var(--md-sys-color-completed);
  color: white;
}

.log-item-icon.log-created {
  background-color: var(--md-sys-color-primary);
  color: white;
}

.log-item-icon.log-updated {
  background-color: var(--md-sys-color-secondary);
  color: white;
}

.log-item-icon.log-archived {
  background-color: var(--md-sys-color-outline);
  color: white;
}

.log-item-content {
  flex: 1;
  min-width: 0;
}

.log-item-text {
  font-size: var(--md-sys-typescale-body-medium);
  color: var(--md-sys-color-on-surface);
  margin-bottom: 4px;
  word-break: break-word;
}

.log-item-time {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.btn-undo {
  flex-shrink: 0;
  padding: var(--md-sys-spacing-xs) var(--md-sys-spacing-md);
  font-size: var(--md-sys-typescale-label-medium);
}
</style>
