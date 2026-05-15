<template>
  <div 
    ref="cardRef"
    class="chore-card"
    :class="{ 
      'completed': chore.done,
      'overdue': isOverdue,
      'swiping-right': swipeDirection === 'right',
      'swiping-left': swipeDirection === 'left',
      'swiping-down': swipeDirection === 'down'
    }"
    :style="dragStyle"
  >
    <!-- Swipe actions overlay -->
    <div 
      v-show="swipeDirection" 
      class="swipe-actions-overlay"
    >
      <div class="swipe-action action-done" :class="{ active: swipeDirection === 'right' }" @click.stop="handleToggle">
        <span class="mdi mdi-check-circle"></span>
        <span>Mark Done</span>
      </div>
      <div class="swipe-action action-edit" :class="{ active: swipeDirection === 'left' }" @click.stop="handleEdit">
        <span class="mdi mdi-pencil"></span>
        <span>Edit</span>
      </div>
      <div class="swipe-action action-archive" :class="{ active: swipeDirection === 'down' }" @click.stop="handleArchive">
        <span class="mdi mdi-archive"></span>
        <span>Archive</span>
      </div>
    </div>
    
    <!-- Card content -->
    <div class="chore-card-content" @click="handleClick">
      <div 
        class="chore-checkbox" 
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  chore: { type: Object, required: true }
})

const emit = defineEmits(['edit', 'archive', 'toggle'])

const cardRef = ref(null)
const startX = ref(0)
const startY = ref(0)
const currentX = ref(0)
const currentY = ref(0)
const isPointerDown = ref(false)
const swipeDirection = ref('')

const threshold = 80
const minSwipeDistance = 50

const dragStyle = computed(() => {
  if (!swipeDirection.value) return {}
  if (!isPointerDown.value) return {
    transform: `translateX(${getTranslateX() * 1.5}px)`,
    transition: 'transform 0.2s ease-out',
    opacity: 0.7
  }
  
  const rotation = Math.max(-15, Math.min(15, currentX.value * 0.01))
  return {
    transform: `translateX(${currentX.value}px) translateY(${currentY.value}px) rotate(${rotation}deg)`,
    transition: 'none',
    boxShadow: `0 8px 24px rgba(0,0,0,0.2)`
  }
})

function getTranslateX() {
  if (swipeDirection.value === 'right') return threshold
  if (swipeDirection.value === 'left') return -threshold
  return 0
}

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

function handleMouseDown(e) {
  if (e.target.closest('.chore-checkbox')) return
  if (e.target.closest('.swipe-action')) return
  
  isPointerDown.value = true
  startX.value = e.clientX
  startY.value = e.clientY
  currentX.value = 0
  currentY.value = 0
  swipeDirection.value = ''
}

function handleMouseMove(e) {
  if (!isPointerDown.value) return
  
  const deltaX = e.clientX - startX.value
  const deltaY = e.clientY - startY.value
  
  currentX.value = deltaX
  currentY.value = deltaY
  
  // Determine direction once we've moved enough
  if (!swipeDirection.value) {
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    if (totalDelta < 15) return
    
    if (Math.abs(deltaY) > Math.abs(deltaX) * 2.5 && deltaY > 20) {
      swipeDirection.value = 'down'
    } else if (Math.abs(deltaX) > Math.abs(deltaY) * 2.5) {
      swipeDirection.value = deltaX > 0 ? 'right' : 'left'
    } else {
      // Too diagonal - wait for more movement
      return
    }
  }
  
  if (swipeDirection.value) {
    e.preventDefault()
    e.stopPropagation()
    
    if (swipeDirection.value === 'right' || swipeDirection.value === 'left') {
      currentX.value = Math.max(Math.min(deltaX, threshold * 2), -threshold * 2)
      currentY.value = 0
    } else if (swipeDirection.value === 'down') {
      currentY.value = Math.max(Math.min(deltaY, threshold * 2), 0)
      currentX.value = 0
    }
  }
}

function handleMouseUp(e) {
  if (!isPointerDown.value) return
  isPointerDown.value = false
  
  const totalDelta = Math.sqrt(currentX.value * currentX.value + currentY.value * currentY.value)
  
  if (totalDelta >= minSwipeDistance) {
    commitSwipe()
  } else {
    swipeDirection.value = ''
  }
}

function handleTouchStart(e) {
  const target = e.target
  if (target.closest('.chore-checkbox')) return
  if (target.closest('.swipe-action')) return
  
  const touch = e.touches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  isPointerDown.value = true
  currentX.value = 0
  currentY.value = 0
  swipeDirection.value = ''
}

function handleTouchMove(e) {
  if (!isPointerDown.value) return
  
  const touch = e.touches[0]
  const deltaX = touch.clientX - startX.value
  const deltaY = touch.clientY - startY.value
  
  currentX.value = deltaX
  currentY.value = deltaY
  
  if (!swipeDirection.value) {
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    if (totalDelta < 15) return
    
    if (Math.abs(deltaY) > Math.abs(deltaX) * 2.5 && deltaY > 20) {
      swipeDirection.value = 'down'
    } else if (Math.abs(deltaX) > Math.abs(deltaY) * 2.5) {
      swipeDirection.value = deltaX > 0 ? 'right' : 'left'
    } else {
      return
    }
  }
  
  if (swipeDirection.value) {
    if (swipeDirection.value === 'down') {
      e.preventDefault()
    }
    
    if (swipeDirection.value === 'right' || swipeDirection.value === 'left') {
      currentX.value = Math.max(Math.min(deltaX, threshold * 2), -threshold * 2)
      currentY.value = 0
    } else if (swipeDirection.value === 'down') {
      currentY.value = Math.max(Math.min(deltaY, threshold * 2), 0)
      currentX.value = 0
    }
  }
}

function handleTouchEnd(e) {
  if (!isPointerDown.value) return
  isPointerDown.value = false
  
  e.preventDefault()
  e.stopPropagation()
  
  const totalDelta = Math.sqrt(currentX.value * currentX.value + currentY.value * currentY.value)
  
  if (totalDelta >= minSwipeDistance) {
    commitSwipe()
  } else {
    swipeDirection.value = ''
  }
}

function commitSwipe() {
  const choreId = props.chore.id
  
  if (swipeDirection.value === 'right') {
    currentX.value = 400
    emit('toggle', choreId)
  } else if (swipeDirection.value === 'left') {
    currentX.value = -400
    emit('edit', choreId)
  } else if (swipeDirection.value === 'down') {
    currentY.value = 400
    emit('archive', choreId)
  }
  
  setTimeout(() => {
    swipeDirection.value = ''
    currentX.value = 0
    currentY.value = 0
  }, 300)
}

function toggleDone() {
  emit('toggle', props.chore.id)
}

function handleToggle() {
  emit('toggle', props.chore.id)
}

function handleEdit() {
  emit('edit', props.chore.id)
}

function handleArchive() {
  emit('archive', props.chore.id)
}

function handleClick(e) {
  if (swipeDirection.value) {
    e.stopPropagation()
    return
  }
  // Normal click handling if needed
}

function formatInterval(interval) {
  if (!interval) return ''
  const match = interval.match(/^(\d+)\s*days?$/)
  if (!match) return interval
  
  const days = parseInt(match[1])
  if (days === 1) return 'Daily'
  if (days === 7) return 'Weekly'
  if (days === 14) return 'Bi-weekly'
  if (days === 30) return 'Monthly'
  return `Every ${days} days`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

onMounted(() => {
  const el = cardRef.value
  if (!el) return
  
  el.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})
</script>

<style scoped>
.chore-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--md-sys-radius-medium);
  background-color: var(--md-sys-color-surface);
  box-shadow: var(--md-sys-elevation-1);
  user-select: none;
  touch-action: none;
  cursor: grab;
}

.chore-card:active {
  cursor: grabbing;
}

.chore-card.completed {
  opacity: 0.7;
}

.chore-card.overdue {
  border-left: 4px solid var(--md-sys-color-overdue);
}

.swipe-actions-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 10;
}

.swipe-action {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.swipe-action .mdi {
  font-size: 24px;
}

.swipe-action.action-done {
  background-color: var(--md-sys-color-completed);
}

.swipe-action.action-edit {
  background-color: var(--md-sys-color-primary);
}

.swipe-action.action-archive {
  background-color: var(--md-sys-color-secondary);
}

.swipe-action.active {
  flex: 1.5;
  color: white;
}

.swipe-action.active:hover {
  filter: brightness(1.1);
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
</style>
