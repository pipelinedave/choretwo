<template>
  <transition name="slide-up">
    <div
      v-if="visible"
      class="toast"
      :class="type"
      role="alert"
      aria-live="polite"
    >
      <span class="toast-icon" v-if="icon">{{ icon }}</span>
      <span class="toast-message">{{ message }}</span>
    </div>
  </transition>
</template>

<script setup>
import { watch } from "vue";

const props = defineProps({
  visible: { type: Boolean, default: false },
  message: { type: String, default: "" },
  type: { type: String, default: "default" },
  duration: { type: Number, default: 3000 },
  icon: { type: String, default: "" },
});

const emit = defineEmits(["dismiss"]);

let timer = null;

// Auto-dismiss
watch(
  () => props.visible,
  (val) => {
    if (val && props.duration > 0) {
      clearTimeout(timer);
      timer = setTimeout(() => emit("dismiss"), props.duration);
    }
  },
);
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: calc(80px + env(safe-area-inset-bottom, 0));
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--md-sys-color-inverse-on-surface, #322f35);
  color: var(--md-sys-color-inverse-surface, #f5eff7);
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-lg);
  border-radius: var(--md-sys-radius-full);
  box-shadow: var(--md-sys-elevation-3);
  z-index: var(--md-sys-zindex-toast);
  font-size: var(--md-sys-typescale-body-medium);
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  max-width: calc(100vw - 32px);
  min-width: 200px;
  justify-content: center;
}

.toast.success {
  background-color: #2e7d32;
  color: #ffffff;
}

.toast.error {
  background-color: var(--md-sys-color-error);
  color: var(--md-sys-color-on-error);
}

.toast-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform var(--md-sys-transition-normal),
    opacity var(--md-sys-transition-fast);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateX(-50%) translateY(100%);
  opacity: 0;
}
</style>
