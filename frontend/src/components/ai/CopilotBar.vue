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
      <div
        v-if="responseMessage"
        class="ai-feedback"
        :class="{ error: isError }"
      >
        <span class="feedback-text">{{ responseMessage }}</span>
        <button
          v-if="pendingProposal && !isError"
          class="confirm-btn"
          @click="confirmAction"
          :disabled="confirming"
        >
          <span v-if="confirming" class="spinner-sm"></span>
          <span v-else>{{ pendingProposal.label }}</span>
        </button>
        <button class="feedback-close" @click="dismissFeedback">✕</button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import {
  assistantText,
  sendToCopilot,
  executeProposal,
  isActionIntent,
} from "@/composables/useCopilot";

const authStore = useAuthStore();

const query = ref("");
const loading = ref(false);
const responseMessage = ref("");
const isError = ref(false);
const confirming = ref(false);
const pendingProposal = ref(null);

function confirmLabelFor(intent) {
  switch (intent) {
    case "mark_done":
      return "Erledigt";
    case "create_chore":
      return "Anlegen";
    case "update_chore":
      return "Aktualisieren";
    case "archive":
      return "Archivieren";
    default:
      return "Bestätigen";
  }
}

function dismissFeedback() {
  responseMessage.value = "";
  pendingProposal.value = null;
  isError.value = false;
}

async function confirmAction() {
  if (confirming.value || !pendingProposal.value) return;
  confirming.value = true;
  try {
    const data = await executeProposal(pendingProposal.value.proposalId);
    responseMessage.value = data?.message || "Ausgeführt.";
    pendingProposal.value = null;
    isError.value = false;
  } catch (err) {
    isError.value = true;
    responseMessage.value =
      "Ausführung fehlgeschlagen: " +
      (err?.response?.data?.detail || err.message || "Unbekannter Fehler");
  } finally {
    confirming.value = false;
  }
}

async function handleSubmit() {
  const text = query.value.trim();
  if (!text || loading.value) return;

  loading.value = true;
  responseMessage.value = "";
  pendingProposal.value = null;
  isError.value = false;

  try {
    const data = await sendToCopilot(text, authStore.user?.id);

    if (data.requires_confirmation && data.proposal_id && isActionIntent(data.intent)) {
      pendingProposal.value = {
        proposalId: data.proposal_id,
        label: confirmLabelFor(data.intent),
        intent: data.intent,
      };
    }
    responseMessage.value = assistantText(data);
    query.value = "";
  } catch (err) {
    isError.value = true;
    responseMessage.value =
      "AI Assistant error: " + (err.message || "Failed to process");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.copilot-bar {
  margin-bottom: var(--md-sys-spacing-md);
  width: 100%;
}

.copilot-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-glass);
  border-radius: var(--md-sys-radius-medium);
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
  background: var(--color-primary-subtle);
  border-radius: var(--md-sys-radius-small);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}

.ai-feedback.error {
  background: var(--color-danger-subtle);
  color: var(--color-danger);
}

.feedback-text {
  flex: 1;
}

.confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--md-sys-radius-full);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: none;
  white-space: nowrap;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  border: 2px solid color-mix(in srgb, var(--color-on-accent) 40%, transparent);
  border-top-color: var(--color-on-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
