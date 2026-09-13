<template>
  <Teleport to="body">
    <transition name="snooze-fade">
      <div
        v-if="visible"
        class="snooze-overlay"
        @click.self="emit('close')"
        role="presentation"
      >
        <transition name="snooze-slide" appear>
          <div
            class="snooze-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Aufschieben"
          >
            <div class="snooze-handle"></div>
            <h3 class="snooze-title">Aufschieben</h3>
            <p class="snooze-subtitle">{{ choreName }}</p>

            <div class="snooze-options">
              <button
                class="snooze-option"
                v-for="opt in options"
                :key="opt.label"
                @click="emit('select', opt.offsetDays)"
              >
                <span class="mdi" :class="opt.icon"></span>
                <span class="snooze-option-label">{{ opt.label }}</span>
              </button>

              <label class="snooze-option snooze-custom">
                <span class="mdi mdi-calendar"></span>
                <input
                  type="date"
                  class="snooze-custom-input"
                  :min="minDate"
                  aria-label="Eigenes Datum wählen"
                  @change="onCustomDate"
                />
              </label>
            </div>

            <button class="snooze-cancel" @click="emit('close')">
              Abbrechen
            </button>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed } from "vue";

const { choreName } = defineProps({
  visible: { type: Boolean, default: false },
  choreName: { type: String, default: "" },
});

const emit = defineEmits(["select", "close"]);

const options = [
  { label: "Morgen", offsetDays: 1, icon: "mdi-sun-clock-outline" },
  { label: "+3 Tage", offsetDays: 3, icon: "mdi-calendar-arrow-right" },
  { label: "+1 Woche", offsetDays: 7, icon: "mdi-calendar-week" },
];

// Lokales Datum heute als YYYY-MM-DD (gleiches Format wie bestehende Chores)
const localDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const minDate = computed(() => localDateStr(new Date()));

function onCustomDate(e) {
  if (!e.target.value) return;
  emit("select", null, e.target.value);
}
</script>

<style scoped>
.snooze-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1200;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.snooze-sheet {
  width: 100%;
  max-width: 480px;
  background: var(--color-surface);
  backdrop-filter: blur(20px);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 12px 20px calc(20px + env(safe-area-inset-bottom, 0));
  box-shadow: var(--shadow-lg);
}

.snooze-handle {
  width: 40px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-text-dim);
  opacity: 0.4;
  margin: 0 auto 12px;
}

.snooze-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 2px;
}

.snooze-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0 0 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snooze-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.snooze-option {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-surface-variant);
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  font-family: inherit;
}

.snooze-option:hover {
  background: var(--color-primary-container);
}

.snooze-option .mdi {
  font-size: 1.3rem;
  color: var(--color-primary);
}

.snooze-custom {
  padding: 8px 16px;
}

.snooze-custom-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
}

.snooze-cancel {
  margin-top: 14px;
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.snooze-cancel:hover {
  background: var(--color-surface-variant);
}

.snooze-fade-enter-active,
.snooze-fade-leave-active {
  transition: opacity var(--transition-normal);
}

.snooze-fade-enter-from,
.snooze-fade-leave-to {
  opacity: 0;
}

.snooze-slide-enter-active,
.snooze-slide-leave-active {
  transition: transform var(--transition-normal) var(--motion-soft);
}

.snooze-slide-enter-from,
.snooze-slide-leave-to {
  transform: translateY(100%);
}
</style>
