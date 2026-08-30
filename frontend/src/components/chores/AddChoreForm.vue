<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" :aria-label="editing ? 'Edit Chore' : 'Add New Chore'" @click.self="onCancel">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ editing ? 'Edit Chore' : 'Add New Chore' }}</h2>
      </div>

      <div class="modal-body">
        <form @submit.prevent="onSubmit" id="add-chore-form">
          <div class="form-group">
            <label for="chore-name">Name</label>
            <input
              id="chore-name"
              v-model="formData.name"
              type="text"
              placeholder="e.g., Wash dishes"
              required
              autofocus
            />
          </div>

          <div class="form-group">
            <label for="chore-interval">Repeat every (days)</label>
            <input
              id="chore-interval"
              v-model.number="formData.interval"
              type="number"
              min="1"
              step="1"
              required
              placeholder="7"
            />
          </div>

          <div class="form-group">
            <label for="chore-due-date">Due Date</label>
            <input
              id="chore-due-date"
              v-model="formData.dueDate"
              type="date"
              required
            />
          </div>

          <div class="form-group custom-checkbox-wrapper">
            <input
              type="checkbox"
              id="chore-private"
              v-model="formData.isPrivate"
            />
            <label for="chore-private">
              <span class="checkbox-text">🔒 Private (only visible to me)</span>
            </label>
          </div>
        </form>
      </div>

      <div class="modal-footer">
        <button
          v-if="editing"
          type="button"
          class="btn btn-warning archive-btn"
          @click="onArchive"
        >
          <span class="mdi mdi-archive"></span> Archive
        </button>
        <button
          type="button"
          class="btn btn-tonal cancel-btn"
          @click="onCancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="add-chore-form"
          class="btn btn-primary submit-btn"
        >
          <span class="mdi" :class="editing ? 'mdi-content-save' : 'mdi-plus'"></span>
          {{ editing ? 'Save Changes' : 'Add Chore' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { useAuthStore } from "@/stores/auth";

const props = defineProps({
  chore: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["submit", "addChore", "close", "cancel", "archive"]);
const authStore = useAuthStore();

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split("T")[0];
};

const formData = ref({
  name: "",
  interval: 7,
  dueDate: getTodayDate(),
  isPrivate: false,
});

const editing = computed(() => !!props.chore);

watch(
  () => props.chore,
  (newChore) => {
    if (newChore) {
      const rawDue = newChore.dueDate || newChore.due_date;
      const dueStr = rawDue
        ? (typeof rawDue === "string" ? rawDue.split("T")[0] : new Date(rawDue).toISOString().split("T")[0])
        : getTodayDate();

      formData.value = {
        name: newChore.name || "",
        interval: newChore.interval || newChore.interval_days || 7,
        dueDate: dueStr,
        isPrivate: !!(newChore.isPrivate ?? newChore.is_private),
      };
    } else {
      formData.value = {
        name: "",
        interval: 7,
        dueDate: getTodayDate(),
        isPrivate: false,
      };
    }
  },
  { immediate: true }
);

function onSubmit() {
  const result = {
    ...props.chore,
    name: formData.value.name,
    interval_days: formData.value.interval,
    interval: formData.value.interval,
    due_date: formData.value.dueDate,
    dueDate: formData.value.dueDate,
    is_private: formData.value.isPrivate,
    isPrivate: formData.value.isPrivate,
    private: formData.value.isPrivate,
    owner_email: formData.value.isPrivate
      ? props.chore?.owner_email || authStore.user?.email || null
      : null,
  };

  emit("submit", result);
  emit("addChore", result);
  emit("close");
}

function onCancel() {
  emit("cancel");
  emit("close");
}

function onArchive() {
  if (props.chore?.id) {
    emit("archive", props.chore.id);
  }
  emit("close");
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 45, 44, 0.45);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: var(--color-background);
  background-image:
    radial-gradient(120% 160% at 10% 10%, rgba(253, 232, 213, 0.6) 0%, rgba(253, 232, 213, 0) 45%),
    radial-gradient(90% 120% at 90% 20%, rgba(189, 233, 221, 0.6) 0%, rgba(189, 233, 221, 0) 52%);
  color: var(--color-text);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-surface-lighter);
}

.modal-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group input[type="number"] {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-surface-lighter);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.95rem;
}

.custom-checkbox-wrapper {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-top: 0.5rem;
  cursor: pointer;
}

.checkbox-text {
  font-weight: 600;
  font-size: 0.9rem;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid var(--color-surface-lighter);
  background: rgba(255, 255, 255, 0.3);
}

@media (max-width: 576px) {
  .modal-footer {
    flex-direction: column-reverse;
  }
  .modal-footer button {
    width: 100%;
  }
}
</style>
