<template>
  <div class="performance-container" role="progressbar" :aria-valuenow="score" aria-valuemin="0" aria-valuemax="100" aria-label="Household Health Score">
    <div class="bar-background">
      <div 
        class="bar-fill" 
        :style="{ width: `${score}%`, background: listColor }"
      ></div>
    </div>
    <span class="score-value" :style="{ color: textColor }">{{ score }}</span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  score: {
    type: Number,
    required: true,
    default: 100,
  },
  label: {
    type: String,
    default: null,
  },
});

const listColor = computed(() => {
  const s = props.score;
  if (s >= 80) return "linear-gradient(90deg, #4CAF50, #81C784)";
  if (s >= 50) return "linear-gradient(90deg, #FFC107, #FFD54F)";
  return "linear-gradient(90deg, #F44336, #E57373)";
});

const textColor = computed(() => {
  const s = props.score;
  if (s >= 80) return "var(--color-primary, #2E7D32)";
  if (s >= 50) return "#F57F17";
  return "#C62828";
});
</script>

<style scoped>
.performance-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin: 0 0 var(--space-md) 0;
  padding: 0;
}

.bar-background {
  flex-grow: 1;
  height: 12px;
  background-color: rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease;
}

.score-value {
  font-weight: 700;
  font-size: 1.15rem;
  font-family: 'Space Grotesk', sans-serif;
  min-width: 2ch;
  text-align: right;
  flex-shrink: 0;
}
</style>
