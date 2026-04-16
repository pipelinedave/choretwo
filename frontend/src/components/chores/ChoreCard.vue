<template>
  <div 
    ref="cardRef"
    class="chore-card"
    :class="{ 
      'completed': chore.done,
      'overdue': isOverdue,
      'priority-high': chore.priority === 'high' && !chore.done,
      'priority-medium': chore.priority === 'medium' && !chore.done,
      'priority-low': chore.priority === 'low' && !chore.done
    }"
  >
    <!-- Swipe feedback overlay -->
    <div class="swipe-feedback" :class="swipeDirection">
      <span class="mdi" :class="swipeIcon"></span>
    </div>
    
    <!-- Card content -->
    <div class="chore-card-content" @click="handleClick">
      <div class="chore-checkbox" 
        :class="{ checked: chore.done }"
        @click.stop="toggleDone"
      >
        <span v-if="chore.done" class="mdi mdi-check"></span>
      </div>
      
      <div class="chore-info">
        <h3 class="chore-title" :class="{ 'line-through': chore.done }">
          {{ chore.name }}
        </h3>
        
        <div class="chore-meta">
          <span v-if="chore.interval" class="chore-interval">
            <span class="mdi mdi-clock-outline"></span>
            {{ formatInterval(chore.interval) }}
          </span>
          
          <span v-if="chore.dueDate && !chore.done" class="chore-due" :class="dueClass">
            <span class="mdi mdi-calendar"></span>
            {{ formatDate(chore.dueDate) }}
          </span>
          
          <span v-if="chore.doneBy" class="chore-done-by">
            by {{ chore.doneBy.split('@')[0] }}
          </span>
        </div>
      </div>
      
      <div class="chore-actions">
        <button 
          @click.stop="handleEdit"
          class="btn-icon"
          aria-label="Edit chore"
        >
          <span class="mdi mdi-pencil"></span>
        </button>
        <button 
          @click.stop="handleArchive"
          class="btn-icon"
          aria-label="Archive chore"
        >
          <span class="mdi mdi-archive"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Hammer from 'hammerjs'

const props = defineProps({
  chore: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'archive', 'toggle'])

const cardRef = ref(null)
const swipeDirection = ref('')
let hammerInstance = null

const isOverdue = computed(() => {
  if (props.chore.done || !props.chore.dueDate) return false
  return new Date(props.chore.dueDate) < new Date()
})

const dueClass = computed(() => {
  if (isOverdue.value) return 'overdue'
  const dueDate = new Date(props.chore.dueDate)
  const today = new Date()
  const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
  return diffDays <= 2 ? 'due-soon' : 'due-later'
})

const swipeIcon = computed(() => {
  switch (swipeDirection.value) {
    case 'right': return 'mdi-check-circle'
    case 'left': return 'mdi-pencil-circle'
    case 'down': return 'mdi-archive-circle'
    default: return ''
  }
})

onMounted(() => {
  if (cardRef.value) {
    hammerInstance = new Hammer(cardRef.value)
    hammerInstance.on('swiperight', handleSwipeRight)
    hammerInstance.on('swipeleft', handleSwipeLeft)
    hammerInstance.on('swipedown', handleSwipeDown)
  }
})

onUnmounted(() => {
  if (hammerInstance) {
    hammerInstance.destroy()
  }
})

function handleSwipeRight() {
  swipeDirection.value = 'right'
  setTimeout(() => {
    swipeDirection.value = ''
    emit('toggle', props.chore.id)
  }, 200)
}

function handleSwipeLeft() {
  swipeDirection.value = 'left'
  setTimeout(() => {
    swipeDirection.value = ''
    emit('edit', props.chore.id)
  }, 200)
}

function handleSwipeDown() {
  swipeDirection.value = 'down'
  setTimeout(() => {
    swipeDirection.value = ''
    emit('archive', props.chore.id)
  }, 200)
}

function toggleDone() {
  emit('toggle', props.chore.id)
}

function handleEdit() {
  emit('edit', props.chore.id)
}

function handleArchive() {
  emit('archive', props.chore.id)
}

function handleClick() {
  // Optional: handle card click
}

function formatInterval(interval) {
  if (!interval) return ''
  
  const units = {
    days: 'day',
    weeks: 'week',
    months: 'month',
    years: 'year'
  }
  
  for (const [unit, singular] of Object.entries(units)) {
    if (interval.includes(unit)) {
      const value = interval.match(/\d+/)?.[0] || '1'
      return `${value} ${singular}${value > 1 ? 's' : ''}`
    }
  }
  
  return interval
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }
}
</script>

<style scoped>
.chore-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--md-sys-radius-medium);
  background-color: var(--md-sys-color-surface);
  box-shadow: var(--md-sys-elevation-1);
  transition: transform var(--md-sys-transition-fast), box-shadow var(--md-sys-transition-fast);
  touch-action: pan-y;
}

.chore-card.completed {
  opacity: 0.7;
}

.chore-card.overdue {
  border-left: 4px solid var(--md-sys-color-overdue);
}

.chore-card.priority-high:not(.completed) {
  border-left: 4px solid var(--md-sys-color-high-priority);
}

.chore-card.priority-medium:not(.completed) {
  border-left: 4px solid var(--md-sys-color-medium-priority);
}

.chore-card.priority-low:not(.completed) {
  border-left: 4px solid var(--md-sys-color-low-priority);
}

.swipe-feedback {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  opacity: 0;
  transition: opacity var(--md-sys-transition-fast);
  z-index: 1;
}

.swipe-feedback.right {
  background-color: var(--md-sys-color-completed);
  color: white;
  opacity: 0.3;
}

.swipe-feedback.left {
  background-color: var(--md-sys-color-primary);
  color: white;
  opacity: 0.3;
}

.swipe-feedback.down {
  background-color: var(--md-sys-color-secondary);
  color: white;
  opacity: 0.3;
}

.chore-card-content {
  display: flex;
  align-items: center;
  padding: var(--md-sys-spacing-md);
  gap: var(--md-sys-spacing-md);
  position: relative;
  z-index: 2;
}

.chore-checkbox {
  width: 24px;
  height: 24px;
  border: 2px solid var(--md-sys-color-outline);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--md-sys-transition-fast), border-color var(--md-sys-transition-fast);
  flex-shrink: 0;
}

.chore-checkbox:hover {
  border-color: var(--md-sys-color-primary);
}

.chore-checkbox.checked {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
  color: white;
}

.chore-checkbox .mdi {
  font-size: 16px;
}

.chore-info {
  flex: 1;
  min-width: 0;
}

.chore-title {
  font-size: var(--md-sys-typescale-body-large);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin-bottom: 4px;
  word-break: break-word;
}

.line-through {
  text-decoration: line-through;
  color: var(--md-sys-color-on-surface-variant);
}

.chore-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-sys-spacing-sm);
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.chore-interval,
.chore-due,
.chore-done-by {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chore-due.overdue {
  color: var(--md-sys-color-overdue);
  font-weight: 500;
}

.chore-due.due-soon {
  color: var(--md-sys-color-due-soon);
  font-weight: 500;
}

.chore-due.due-later {
  color: var(--md-sys-color-due-later);
}

.chore-actions {
  display: flex;
  gap: var(--md-sys-spacing-xs);
  flex-shrink: 0;
}

.btn-icon {
  color: var(--md-sys-color-on-surface-variant);
}

.btn-icon:hover {
  color: var(--md-sys-color-primary);
}
</style>
