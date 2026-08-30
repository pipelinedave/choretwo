<template>
  <div class="copilot-bar">
    <div class="copilot-input-wrapper">
      <span class="mdi mdi-robot ai-icon"></span>
      <input
        v-model="query"
        type="text"
        placeholder="Ask AI Copilot (e.g., 'Clean bathroom every 5 days' or 'Mark kitchen done')"
        @keydown.enter="handleSubmit"
        :disabled="loading"
      />
      <button
        class="btn-send"
        @click="handleSubmit"
        :disabled="loading || !query.trim()"
        aria-label="Send AI prompt"
      >
        <span v-if="loading" class="spinner-sm"></span>
        <span v-else class="mdi mdi-send"></span>
      </button>
    </div>

    <transition name="fade">
      <div v-if="responseMessage" class="ai-feedback" :class="{ error: isError }">
        <span class="feedback-text">{{ responseMessage }}</span>
        <button class="feedback-close" @click="responseMessage = ''">✕</button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { aiApi } from "@/api";
import { useChoreStore } from "@/stores/chore";
import { useLogStore } from "@/stores/log";

const choreStore = useChoreStore();
const logStore = useLogStore();

const query = ref("");
const loading = ref(false);
const responseMessage = ref("");
const isError = ref(false);

async function handleSubmit() {
  const text = query.value.trim();
  if (!text || loading.value) return;

  loading.value = true;
  responseMessage.value = "";
  isError.value = false;

  try {
    const res = await aiApi.post("/intent", { text });
    const data = res.data;

    if (data.intent === "create_chore" && data.entities?.name) {
      await choreStore.addChore({
        name: data.entities.name,
        interval: data.entities.interval_days || 7,
        dueDate: data.entities.due_date || new Date().toISOString().split("T")[0],
        private: false,
      });
      responseMessage.value = `✨ Created chore "${data.entities.name}"!`;
    } else if (data.intent === "complete_chore" && data.entities?.name) {
      const match = choreStore.chores.find(
        (c) => c.name.toLowerCase().includes(data.entities.name.toLowerCase())
      );
      if (match) {
        await choreStore.markDone(match.id);
        responseMessage.value = `✓ Marked "${match.name}" as done!`;
      } else {
        responseMessage.value = `Could not find a matching chore for "${data.entities.name}".`;
      }
    } else {
      responseMessage.value = data.message || `Processed intent: ${data.intent || 'understood'}`;
    }

    query.value = "";
    await choreStore.fetchChores();
    await logStore.fetchLogs();
  } catch (err) {
    isError.value = true;
    responseMessage.value = "AI Assistant error: " + (err.message || "Failed to process");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.copilot-bar {
  margin-bottom: var(--space-md);
  width: 100%;
}

.copilot-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-surface);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-md);
  padding: 6px 12px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(14px);
}

.ai-icon {
  font-size: 1.3rem;
  color: var(--color-primary);
}

.copilot-input-wrapper input {
  flex: 1;
  background: transparent;
  border: none;
  box-shadow: none;
  font-size: 0.95rem;
  color: var(--color-text);
  padding: 6px 0;
}

.copilot-input-wrapper input:focus {
  outline: none;
  box-shadow: none;
}

.btn-send {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  padding: 0;
  box-shadow: none;
}

.btn-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-feedback {
  margin-top: 8px;
  padding: 8px 14px;
  background: rgba(47, 111, 111, 0.12);
  border-radius: var(--radius-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}

.ai-feedback.error {
  background: rgba(231, 99, 99, 0.15);
  color: var(--color-danger);
}

.feedback-close {
  background: transparent;
  border: none;
  box-shadow: none;
  cursor: pointer;
  color: inherit;
  padding: 0 4px;
}

.spinner-sm {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
