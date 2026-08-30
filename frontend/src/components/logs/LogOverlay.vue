<template>
  <div
    ref="overlayRef"
    :class="['log-overlay', { expanded: isExpanded }]"
    role="region"
    aria-label="Activity Log Overlay"
    @touchmove.stop
    @wheel.stop
  >
    <!-- Handle (visible when collapsed or always interactive) -->
    <div
      v-show="!isExpanded"
      class="handle"
      ref="handleRef"
      @click="toggleExpand"
      tabindex="0"
      role="button"
      aria-label="Expand activity log"
    >
      <div class="handle-bar"></div>
      <div class="handle-content" v-if="logStore.latestEntry">
        <div class="entry-display">
          <span class="chore-pill" v-if="logStore.latestEntry.choreName">
            {{ logStore.latestEntry.choreName }}
          </span>
          <span class="action-text">{{ logStore.latestEntry.actionDescription }}</span>
          <span class="user-text" v-if="logStore.latestEntry.user">
            by {{ logStore.latestEntry.user.split('@')[0] }}
          </span>
        </div>
        <div class="handle-right">
          <span class="time-ago">{{ logStore.latestEntry.timeAgo }}</span>
          <button
            class="revert-btn"
            @click.stop="handleRevert(logStore.latestEntry)"
            :disabled="logStore.latestEntry.isLocal"
            :aria-label="getRevertLabel(logStore.latestEntry)"
            :title="getRevertLabel(logStore.latestEntry)"
          >
            <span class="mdi" :class="getRevertIcon(logStore.latestEntry)"></span>
          </button>
        </div>
      </div>
      <div class="handle-content empty" v-else>
        No recent activity
      </div>
    </div>

    <!-- Expanded Header -->
    <div v-show="isExpanded" class="expanded-header" @click="toggleExpand">
      <div class="handle-bar"></div>
      <div class="header-title-row">
        <h3>Activity Log</h3>
        <button class="close-btn" @click.stop="toggleExpand" aria-label="Collapse log">
          <span class="mdi mdi-chevron-down"></span>
        </button>
      </div>
    </div>

    <!-- Expanded Content -->
    <div class="log-content" v-show="isExpanded">
      <div class="log-list" ref="logListRef">
        <div
          v-for="entry in logStore.visibleEntries"
          :key="entry.id"
          class="log-entry"
        >
          <div class="entry-info">
            <div class="entry-display">
              <span class="chore-pill" v-if="entry.choreName">{{ entry.choreName }}</span>
              <span class="action-text">{{ entry.actionDescription }}</span>
              <span class="user-text" v-if="entry.user">by {{ entry.user.split('@')[0] }}</span>
            </div>
            <span class="entry-time">{{ entry.timeAgo }}</span>
          </div>
          <button
            class="revert-btn"
            @click.stop="handleRevert(entry)"
            :disabled="entry.isLocal"
            :aria-label="getRevertLabel(entry)"
            :title="getRevertLabel(entry)"
          >
            <span class="mdi" :class="getRevertIcon(entry)"></span>
          </button>
        </div>

        <div v-if="logStore.loading" class="loading-indicator">
          <div class="loading-spinner"></div>
          <span>Loading...</span>
        </div>

        <div
          v-if="logStore.visibleEntries.length === 0 && !logStore.loading"
          class="empty-state"
        >
          No activity recorded yet
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from "vue";
import { useLogStore } from "@/stores/log";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "update:isOpen"]);

const logStore = useLogStore();
const localExpanded = ref(false);
const overlayRef = ref(null);
const handleRef = ref(null);

const isExpanded = computed({
  get: () => props.isOpen || localExpanded.value,
  set: (val) => {
    localExpanded.value = val;
    emit("update:isOpen", val);
    if (!val) emit("close");
  },
});

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      logStore.fetchLogs();
    }
  }
);

onMounted(() => {
  logStore.fetchLogs();
});

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}

function getRevertLabel(entry) {
  if (entry?.action === "created" || entry?.action_type === "created") return "Archive";
  return "Undo";
}

function getRevertIcon(entry) {
  if (entry?.action === "created" || entry?.action_type === "created") return "mdi-archive";
  return "mdi-undo";
}

async function handleRevert(entry) {
  if (!entry || entry.isLocal) return;
  try {
    await logStore.undo(entry.id);
  } catch (err) {
    console.error("Undo failed:", err);
  }
}
</script>

<style scoped>
.log-overlay {
  position: fixed;
  bottom: 0;
  left: var(--space-md);
  right: var(--space-md);
  max-width: 900px;
  margin: 0 auto;
  background: var(--color-background);
  background-image:
    radial-gradient(120% 160% at 10% 90%, rgba(253, 232, 213, 0.5) 0%, rgba(253, 232, 213, 0) 45%),
    radial-gradient(90% 120% at 90% 80%, rgba(189, 233, 221, 0.5) 0%, rgba(189, 233, 221, 0) 52%);
  color: var(--color-text);
  box-shadow: 0 -4px 24px rgba(31, 45, 44, 0.15);
  border-top-left-radius: var(--radius-lg);
  border-top-right-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-bottom: none;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  max-height: 64px;
  overflow: hidden;
  backdrop-filter: blur(16px);
}

.log-overlay.expanded {
  max-height: 70vh;
  box-shadow: 0 -8px 32px rgba(31, 45, 44, 0.25);
}

.handle,
.expanded-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
}

.expanded-header {
  border-bottom: 1px solid var(--color-surface-lighter);
  padding-bottom: 10px;
}

.header-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.expanded-header h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  border: none;
  box-shadow: none;
  font-size: 1.3rem;
  padding: 2px 6px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: rgba(31, 45, 44, 0.2);
  border-radius: 2px;
  margin-bottom: 6px;
}

.handle-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
}

.handle-content.empty {
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.handle-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.entry-display {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  flex-wrap: nowrap;
  overflow: hidden;
}

.chore-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  background: var(--color-primary);
  color: white;
  border-radius: 14px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
}

.user-text {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.time-ago {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.revert-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: transform var(--transition-fast), background-color var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.revert-btn:hover:not(:disabled) {
  background: var(--color-primary);
  color: white;
  transform: translateY(-1px);
}

.revert-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.log-content {
  padding: 0 16px 16px;
  max-height: calc(70vh - 60px);
  overflow-y: auto;
  scrollbar-width: thin;
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-surface-lighter);
  gap: 12px;
}

.log-entry:last-child {
  border-bottom: none;
}

.entry-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.entry-time {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}
</style>
