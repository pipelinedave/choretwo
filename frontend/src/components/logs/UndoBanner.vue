<template>
  <transition name="slide-down">
    <div v-if="show" class="undo-banner shadow-elevation-3">
      <div class="undo-banner-content">
        <span class="mdi mdi-undo" style="margin-right: 8px;"></span>
        <span>Action undone</span>
      </div>
      <button 
        @click="handleDismiss"
        class="btn-icon"
        aria-label="Dismiss"
      >
        <span class="mdi mdi-close"></span>
      </button>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useLogStore } from '@/stores/log'

const logStore = useLogStore()
const show = ref(false)
let dismissTimer = null

watch(() => logStore.lastAction, (newAction) => {
  if (newAction?.type === 'undo') {
    show.value = true
    clearTimeout(dismissTimer)
    dismissTimer = setTimeout(() => {
      show.value = false
    }, 3000)
  }
})

function handleDismiss() {
  show.value = false
  clearTimeout(dismissTimer)
}
</script>

<style scoped>
.undo-banner {
  position: fixed;
  top: calc(64px + var(--md-sys-spacing-md));
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border-radius: var(--md-sys-radius-full);
  z-index: var(--md-sys-zindex-toast);
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-md);
  max-width: calc(100% - var(--md-sys-spacing-2xl));
}

.undo-banner-content {
  display: flex;
  align-items: center;
  font-size: var(--md-sys-typescale-body-medium);
}
</style>
