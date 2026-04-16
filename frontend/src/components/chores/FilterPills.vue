<template>
  <div class="filter-pills">
    <button 
      v-for="filter in filters" 
      :key="filter.value"
      @click="emit('update:filter', filter.value)"
      class="chip"
      :class="{ active: currentFilter === filter.value }"
    >
      {{ filter.label }}
      <span v-if="filter.value === 'all' && stats" class="chip-count">{{ stats.total }}</span>
      <span v-else-if="stats" class="chip-count">{{ stats[filter.value] || 0 }}</span>
    </button>
  </div>
</template>

<script setup>
defineProps({
  currentFilter: {
    type: String,
    default: 'all'
  },
  stats: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:filter'])

const filters = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: 'Due Soon' },
  { value: 'completed', label: 'Done' }
]
</script>

<style scoped>
.filter-pills {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  overflow-x: auto;
  padding: var(--md-sys-spacing-sm) 0;
  scrollbar-width: none;
}

.filter-pills::-webkit-scrollbar {
  display: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: var(--md-sys-radius-full);
  font-size: var(--md-sys-typescale-label-medium);
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  cursor: pointer;
  transition: background-color var(--md-sys-transition-fast), color var(--md-sys-transition-fast);
  white-space: nowrap;
  border: none;
}

.chip.active {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.chip-count {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: var(--md-sys-radius-full);
  font-size: var(--md-sys-typescale-label-small);
}

.chip.active .chip-count {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
