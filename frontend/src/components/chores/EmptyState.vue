<template>
  <div class="empty-state">
    <div class="empty-state-icon">
      <span class="mdi mdi-clipboard-list-outline" style="font-size: 64px;"></span>
    </div>
    <h3 class="empty-state-title">No chores yet</h3>
    <p class="empty-state-text">
      {{ message || "You don't have any chores to do. Time to relax!" }}
    </p>
    <button 
      v-if="showAddButton"
      @click="emit('add')"
      class="btn btn-filled"
    >
      <span class="mdi mdi-plus" style="margin-right: 8px;"></span>
      Add Your First Chore
    </button>
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    default: ''
  },
  showAddButton: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add'])
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-2xl);
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

.empty-state-icon {
  margin-bottom: var(--md-sys-spacing-lg);
  opacity: 0.5;
}

.empty-state-title {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin-bottom: var(--md-sys-spacing-sm);
}

.empty-state-text {
  font-size: var(--md-sys-typescale-body-medium);
  margin-bottom: var(--md-sys-spacing-lg);
  max-width: 300px;
}
</style>
