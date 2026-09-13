<template>
  <div class="catchup-view">
    <!-- Header -->
    <div class="catchup-header">
      <button class="back-btn" @click="$router.push('/')" aria-label="Zurück">
        <span class="mdi mdi-arrow-left"></span>
        <span>Zurück</span>
      </button>

      <div class="catchup-title-area">
        <h1>Aufholen</h1>
        <p class="subtitle">
          {{ completedCount }} von {{ totalRemaining }} Chores geschafft
        </p>
      </div>

      <!-- Stack icon -->
      <span
        class="stack-count-badge mdi mdi-stack-exchange"
        :title="`${stackLength} übrig`"
      ></span>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar" v-if="totalRemaining > 0">
      <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="loader-center" />

    <!-- Empty State -->
    <EmptyState
      v-else-if="stackLength === 0"
      message="Keine chores zum Aufholen — du bist top! 🎉"
      :show-add-button="true"
      @add="$router.push('/chores')"
    >
      <template #icon>
        <span
          class="mdi mdi-check-circle-outline"
          style="font-size: 64px; opacity: 0.5"
        ></span>
      </template>
    </EmptyState>

    <!-- Card Stack -->
    <div v-else class="stack-area" ref="stackAreaRef">
      <div class="stack-container" ref="containerRef">
        <CatchUpCard
          v-for="(chore, index) in stack"
          :key="chore.id"
          :chore="chore"
          :position="index"
          :total="stackLength"
          :is-active="index === 0"
          @toggle="handleToggle"
          @edit="handleEdit"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useChoreStore } from "@/stores/chore";
import { useAuthStore } from "@/stores/auth";
import { buildCatchUpStack } from "@/utils/catchUpStack";

import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import EmptyState from "@/components/chores/EmptyState.vue";
import CatchUpCard from "@/components/chores/CatchUpCard.vue";

const router = useRouter();
const choreStore = useChoreStore();
const authStore = useAuthStore();

const loading = ref(true);
const stack = ref([]);
const stackLength = ref(0);
const containerRef = ref(null);
const stackAreaRef = ref(null);

const totalRemaining = computed(() => stackLength.value);
const completedCount = computed(() => {
  // Wir zählen, wie viele wir in dieser Session bereits abgeschlossen haben.
  // Da wir den Stack beim Mount aufbauen, ist das die Differenz zwischen
  // ursprünglicher Stack-Größe und aktueller Stack-Größe.
  // Einfacher: wir tracken es als Session-Zähler.
  return sessionCompleted.value;
});

let sessionCompleted = ref(0);

const progressPct = computed(() => {
  if (stackLength.value === 0 && sessionCompleted.value === 0) return 0;
  const original = sessionCompleted.value + stackLength.value;
  if (original === 0) return 0;
  return Math.round((sessionCompleted.value / original) * 100);
});

onMounted(async () => {
  try {
    await choreStore.fetchChores();
    rebuildStack();
  } catch (err) {
    console.error("Failed to fetch chores for catchup:", err);
  } finally {
    loading.value = false;
  }
});

function rebuildStack() {
  const result = buildCatchUpStack(choreStore.chores);
  stack.value = result.stack;
  stackLength.value = result.stack.length;
}

// --- Interactions ---

async function handleToggle(choreId) {
  try {
    await choreStore.markDone(choreId, authStore.user?.email);
    sessionCompleted.value += 1;
    rebuildStack();

    // Wenn Stack leer → Erfolg
    if (stack.value.length === 0) {
      setTimeout(() => {
        router.push("/");
      }, 600);
    }
  } catch (err) {
    console.error("Failed to mark chore done in catchup:", err);
  }
}

function handleEdit(chore) {
  // Edit: navigiere zur Chores-Ansicht, markiere die Chore zum Bearbeiten
  router.push({
    name: "Chores",
    query: { editChore: String(chore.id) },
  });
}
</script>

<style scoped>
.catchup-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding-bottom: 20px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 80px);
}

/* Header */
.catchup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 8px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-fast);
  font-family: inherit;
}

.back-btn:hover {
  background: rgba(47, 111, 111, 0.1);
}

.catchup-title-area {
  flex: 1;
}

.catchup-title-area h1 {
  font-size: 1.6rem;
  margin: 0;
  color: var(--color-primary);
}

.subtitle {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.stack-count-badge {
  font-size: 1.6rem;
  color: var(--color-text-dim);
}

/* Progress Bar */
.progress-bar {
  height: 6px;
  background: rgba(31, 45, 44, 0.08);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-success)
  );
  border-radius: var(--radius-full);
  transition: width 0.4s var(--motion-soft);
}

/* Loading */
.loader-center {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

/* Stack Area */
.stack-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--space-md);
}

.stack-container {
  position: relative;
  width: 100%;
  max-width: 420px;
  min-height: 160px;
  margin: 0 auto;
}

/* Empty State Override */
:deep(.empty-state) {
  margin-top: 40px;
}
</style>
