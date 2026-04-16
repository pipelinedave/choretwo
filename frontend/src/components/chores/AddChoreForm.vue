<template>
  <div class="add-chore-form-overlay" @click="handleBackdropClick">
    <div class="add-chore-form card" @click.stop>
      <div class="form-header">
        <h2>{{ editingChore ? 'Edit Chore' : 'Add Chore' }}</h2>
        <button @click="handleClose" class="btn-icon">
          <span class="mdi mdi-close"></span>
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="form-content">
        <div class="form-group">
          <label for="name" class="form-label">Chore Name</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            class="input"
            placeholder="e.g., Wash dishes"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="interval" class="form-label">Recurrence (optional)</label>
          <select v-model="formData.interval" class="input">
            <option value="">One-time</option>
            <option value="1 day">Daily</option>
            <option value="2 days">Every 2 days</option>
            <option value="3 days">Every 3 days</option>
            <option value="7 days">Weekly</option>
            <option value="14 days">Every 2 weeks</option>
            <option value="30 days">Monthly</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="dueDate" class="form-label">Due Date (optional)</label>
          <input
            id="dueDate"
            v-model="formData.dueDate"
            type="date"
            class="input"
          />
        </div>
        
        <div class="form-group">
          <label for="priority" class="form-label">Priority</label>
          <select v-model="formData.priority" class="input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-checkbox">
            <input
              v-model="formData.private"
              type="checkbox"
            />
            <span class="checkbox-custom"></span>
            <span class="form-label">Private (only you can see)</span>
          </label>
        </div>
        
        <div class="form-actions">
          <button type="button" @click="handleClose" class="btn btn-text">
            Cancel
          </button>
          <button type="submit" class="btn btn-filled">
            {{ editingChore ? 'Save Changes' : 'Add Chore' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  chore: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['submit', 'close'])

const formData = ref({
  name: '',
  interval: '',
  dueDate: '',
  priority: 'medium',
  private: false
})

const editingChore = ref(false)

watch(() => props.chore, (newChore) => {
  if (newChore) {
    editingChore.value = true
    formData.value = {
      name: newChore.name || '',
      interval: newChore.interval || '',
      dueDate: newChore.dueDate || '',
      priority: newChore.priority || 'medium',
      private: newChore.private || false
    }
  } else {
    editingChore.value = false
    resetForm()
  }
}, { immediate: true })

function resetForm() {
  formData.value = {
    name: '',
    interval: '',
    dueDate: '',
    priority: 'medium',
    private: false
  }
}

function handleClose() {
  resetForm()
  emit('close')
}

function handleSubmit() {
  emit('submit', {
    ...formData.value,
    id: props.chore?.id
  })
  resetForm()
}

function handleBackdropClick() {
  handleClose()
}
</script>

<style scoped>
.add-chore-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-md);
  z-index: var(--md-sys-zindex-modal);
}

.add-chore-form {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-radius-extra-large);
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-lg);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.form-header h2 {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.form-content {
  padding: var(--md-sys-spacing-lg);
}

.form-group {
  margin-bottom: var(--md-sys-spacing-lg);
}

.form-label {
  display: block;
  font-size: var(--md-sys-typescale-label-medium);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin-bottom: var(--md-sys-spacing-sm);
}

.form-checkbox {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  cursor: pointer;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid var(--md-sys-color-outline);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color var(--md-sys-transition-fast), border-color var(--md-sys-transition-fast);
}

input[type="checkbox"]:checked + .checkbox-custom {
  background-color: var(--md-sys-color-primary);
  border-color: var(--md-sys-color-primary);
}

input[type="checkbox"]:checked + .checkbox-custom::after {
  content: '✓';
  color: white;
  font-size: 14px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--md-sys-spacing-sm);
  padding-top: var(--md-sys-spacing-lg);
  border-top: 1px solid var(--md-sys-color-outline-variant);
}
</style>
