<template>
  <div
    class="performance-bar"
    :class="`level-${colorLevel}`"
    :aria-label="`Hausgesundheit: ${score} von 100`"
  >
    <div class="score-label">
      <span>{{ score }}</span
      >/100
    </div>
    <div class="bar-track">
      <div class="bar-fill" :style="{ width: score + '%' }"></div>
    </div>
    <div class="score-label right" v-if="label">{{ label }}</div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  score: {
    type: Number,
    default: 100,
  },
  label: {
    type: String,
    default: null,
  },
});

const colorLevel = computed(() => {
  if (props.score >= 70) return "good";
  if (props.score >= 30) return "warning";
  return "danger";
});
</script>

<style scoped>
.performance-bar {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  padding: var(--md-sys-spacing-sm) 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.bar-track {
  flex: 1;
  height: 6px;
  background-color: var(--md-sys-color-surface-variant);
  border-radius: var(--md-sys-radius-full);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--md-sys-radius-full);
  transition: width 0.6s ease;
}

.level-good .bar-fill {
  background-color: var(--md-sys-color-completed);
}

.level-warning .bar-fill {
  background-color: var(--md-sys-color-due-soon);
}

.level-danger .bar-fill {
  background-color: var(--md-sys-color-overdue);
}

.score-label {
  font-size: var(--md-sys-typescale-label-medium);
  color: var(--md-sys-color-on-surface-variant);
  font-weight: 500;
  flex-shrink: 0;
  white-space: nowrap;
}

.score-label.right {
  text-align: right;
}

.score-label span {
  font-size: var(--md-sys-typescale-title-medium);
  color: var(--md-sys-color-on-surface);
  font-weight: 600;
}
</style>
