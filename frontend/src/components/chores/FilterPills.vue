<template>
  <div class="filter-row" :class="{ 'has-filter': activeFilter !== 'all' }">
    <!-- Clear Filters Button -->
    <transition name="fade">
      <button
        v-if="activeFilter !== 'all'"
        class="clear-btn pill clear-filter-fixed"
        @click="clearFilters"
        aria-label="Clear filters"
        title="Clear filters"
      >
        <span class="mdi mdi-close"></span>
      </button>
    </transition>

    <div class="filter-pills" ref="pillsContainer">
      <button
        v-for="pill in pillsWithCounts"
        :key="pill.value"
        class="chip pill"
        :class="{ active: activeFilter === pill.value }"
        :style="{ '--chip-color': pill.color, backgroundColor: pill.color }"
        @click="selectFilter(pill.value)"
        :aria-label="`${pill.label} (${pill.count})`"
      >
        <span class="chip-count pill-count">{{ pill.count }}</span>
        <span class="pill-label">{{ pill.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  currentFilter: { type: String, default: null },
  filter: { type: String, default: null },
  counts: { type: Object, default: () => ({}) },
  stats: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["update:filter", "clearFilter"]);

const activeFilter = computed(() => {
  return props.currentFilter || props.filter || "all";
});

const pills = [
  { label: "Overdue", value: "overdue", color: "var(--color-overdue, #f7b4ae)" },
  { label: "Due Today", value: "today", color: "var(--color-due-today, #f6c7ae)" },
  { label: "Due Tomorrow", value: "tomorrow", color: "var(--color-due-soon, #f2ddba)" },
  { label: "Due This Week", value: "thisWeek", color: "var(--color-due-7-days, #d3ead8)" },
  { label: "Later", value: "upcoming", color: "var(--color-due-far-future, #a4dcd3)" },
];

const pillsWithCounts = computed(() => {
  const c = props.counts || {};
  const s = props.stats || {};

  return pills.map((p) => {
    let count = 0;
    if (c[p.value] !== undefined) {
      count = c[p.value];
    } else if (p.value === "overdue" && s.overdue !== undefined) {
      count = s.overdue;
    } else if (p.value === "today" && s.dueSoon !== undefined) {
      count = s.dueSoon;
    } else if (s[p.value] !== undefined) {
      count = s[p.value];
    }
    return {
      ...p,
      count: count || 0,
    };
  });
});

function selectFilter(val) {
  const nextVal = activeFilter.value === val ? "all" : val;
  emit("update:filter", nextVal);
}

function clearFilters() {
  emit("update:filter", "all");
  emit("clearFilter");
}
</script>

<style scoped>
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-md);
  position: relative;
  width: 100%;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  min-width: 38px;
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-surface-lighter);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  padding: 0;
  transition: transform var(--transition-fast), background-color var(--transition-fast);
  flex-shrink: 0;
}

.clear-btn:hover {
  background: var(--color-danger);
  color: white;
  transform: scale(1.05);
}

.filter-pills {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 2px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  flex: 1;
}

.filter-pills::-webkit-scrollbar {
  display: none;
}

.pill, .chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
  opacity: 0.82;
}

.pill:hover, .chip:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  opacity: 1;
}

.pill.active, .chip.active {
  opacity: 1;
  box-shadow: 0 0 0 2px var(--color-primary, #2f6f6f), var(--shadow-md);
  transform: translateY(-1px);
}

.pill-count, .chip-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(31, 45, 44, 0.15);
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
}

.pill.active .pill-count, .chip.active .chip-count {
  background: rgba(31, 45, 44, 0.25);
}
</style>
