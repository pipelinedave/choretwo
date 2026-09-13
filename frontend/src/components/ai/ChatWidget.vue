<template>
  <div class="chat-widget">
    <!-- Chat button -->
    <button
      v-if="!isOpen"
      @click="toggleChat"
      class="chat-button shadow-elevation-3"
      aria-label="Open AI assistant"
    >
      <span class="mdi mdi-robot-happy" style="font-size: 24px"></span>
    </button>

    <!-- Chat interface -->
    <div v-else class="chat-interface shadow-elevation-4">
      <div class="chat-header">
        <div class="chat-header-title">
          <span class="mdi mdi-robot-happy" style="margin-right: 8px"></span>
          AI Copilot
        </div>
        <button @click="toggleChat" class="btn-icon">
          <span class="mdi mdi-close"></span>
        </button>
      </div>

      <div class="chat-messages" ref="messagesRef">
        <div v-if="messages.length === 0" class="chat-empty">
          <p>Hi! I'm your AI chore assistant.</p>
          <p>Try saying:</p>
          <div class="quick-commands">
            <button
              v-for="cmd in quickCommands"
              :key="cmd"
              @click="sendQuickCommand(cmd)"
              class="quick-command"
            >
              {{ cmd }}
            </button>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="chat-message"
          :class="msg.role"
        >
          <div class="message-avatar">
            <span
              class="mdi"
              :class="msg.role === 'user' ? 'mdi-account' : 'mdi-robot-happy'"
            ></span>
          </div>
          <div class="message-body">
            <div class="message-content">
              {{ msg.content }}
            </div>
            <button
              v-if="msg.role === 'assistant' && msg.canConfirm && !msg.confirmed"
              @click="confirmAction(msg)"
              class="confirm-btn"
              :disabled="msg.confirming"
            >
              <span v-if="msg.confirming" class="dot"></span>
              <span v-else class="mdi mdi-check"></span>
              {{ msg.confirmLabel }}
            </button>
          </div>
        </div>

        <div v-if="loading" class="chat-message assistant">
          <div class="message-avatar">
            <span class="mdi mdi-robot-happy"></span>
          </div>
          <div class="message-content loading">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <input
          v-model="inputMessage"
          @keyup.enter="sendMessage"
          type="text"
          class="chat-input"
          placeholder="Type a message..."
          :disabled="loading"
        />
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || loading"
          class="chat-send btn-icon"
        >
          <span class="mdi mdi-send"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from "vue";
import { useAuthStore } from "@/stores/auth";
import {
  assistantText,
  sendToCopilot,
  executeProposal,
  isActionIntent,
} from "@/composables/useCopilot";

const authStore = useAuthStore();
const isOpen = ref(false);
const messages = ref([]);
const inputMessage = ref("");
const loading = ref(false);
const messagesRef = ref(null);

const quickCommands = [
  "Mark 'wash dishes' as done",
  "Add laundry every 3 days",
  "What chores do I have?",
  "Give me suggestions",
];

function toggleChat() {
  isOpen.value = !isOpen.value;
}

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

async function confirmAction(msg) {
  if (msg.confirming || msg.confirmed) return;
  msg.confirming = true;
  try {
    const data = await executeProposal(msg.proposalId);
    msg.content = data?.message || "Ausgeführt.";
    msg.confirmed = true;
    msg.canConfirm = false;
  } catch (err) {
    console.error("Execute error:", err);
    msg.content =
      "Ausführung fehlgeschlagen: " +
      (err?.response?.data?.detail || err.message || "Unbekannter Fehler");
    msg.confirming = false;
  } finally {
    msg.confirming = false;
    await scrollToBottom();
  }
}

async function sendMessage() {
  if (!inputMessage.value.trim() || loading.value) return;

  const userMessage = {
    id: Date.now(),
    role: "user",
    content: inputMessage.value,
  };

  messages.value.push(userMessage);
  inputMessage.value = "";
  await scrollToBottom();

  loading.value = true;

  try {
    const data = await sendToCopilot(userMessage.content, authStore.user?.id);

    const assistantMessage = {
      id: Date.now() + 1,
      role: "assistant",
      content: assistantText(data),
      // Bestätigungs-Flow: nur Aktions-Intents mit Proposal anbieten
      canConfirm: !!(data.requires_confirmation && data.proposal_id && isActionIntent(data.intent)),
      confirmed: false,
      confirming: false,
      proposalId: data.proposal_id,
      confirmLabel: confirmLabelFor(data.intent),
    };

    messages.value.push(assistantMessage);
    await scrollToBottom();
  } catch (err) {
    console.error("Chat error:", err);
    messages.value.push({
      id: Date.now() + 1,
      role: "assistant",
      content: "Sorry, I encountered an error. Please try again.",
    });
  } finally {
    loading.value = false;
  }
}

async function sendQuickCommand(command) {
  inputMessage.value = command;
  await sendMessage();
}

async function scrollToBottom() {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
}
</script>

<style scoped>
.chat-widget {
  position: fixed;
  bottom: calc(100px + env(safe-area-inset-bottom));
  right: var(--md-sys-spacing-lg);
  z-index: var(--md-sys-zindex-overlay);
}

.chat-button {
  width: 56px;
  height: 56px;
  border-radius: var(--md-sys-radius-full);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform var(--md-sys-transition-fast),
    box-shadow var(--md-sys-transition-fast);
}

.chat-button:hover {
  transform: scale(1.05);
  box-shadow: var(--md-sys-elevation-4);
}

.chat-button:active {
  transform: scale(0.95);
}

.chat-interface {
  position: fixed;
  bottom: calc(100px + env(safe-area-inset-bottom));
  right: var(--md-sys-spacing-lg);
  width: 350px;
  height: 500px;
  max-height: calc(100vh - 160px);
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-radius-extra-large);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  font-weight: 500;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--md-sys-spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-md);
}

.chat-empty {
  text-align: center;
  padding: var(--md-sys-spacing-lg);
  color: var(--md-sys-color-on-surface-variant);
}

.chat-empty p {
  margin-bottom: var(--md-sys-spacing-sm);
}

.quick-commands {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
}

.quick-command {
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-surface-variant);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-radius-medium);
  text-align: left;
  cursor: pointer;
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface);
  transition: background-color var(--md-sys-transition-fast);
}

.quick-command:hover {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.chat-message {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  max-width: 80%;
}

.chat-message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--md-sys-radius-full);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-content {
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border-radius: var(--md-sys-radius-large);
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface);
  font-size: var(--md-sys-typescale-body-medium);
  line-height: 1.4;
  word-wrap: break-word;
}

.message-body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--md-sys-spacing-xs);
  max-width: 88%;
}

.chat-message.user .message-body {
  align-items: flex-end;
}

.confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: var(--md-sys-spacing-xs) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: var(--md-sys-radius-full);
  font-size: var(--md-sys-typescale-body-small);
  font-weight: 500;
  cursor: pointer;
  transition: opacity var(--md-sys-transition-fast);
}

.confirm-btn:hover {
  opacity: 0.9;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-message.user .message-content {
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.message-content.loading {
  display: flex;
  gap: 4px;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
}

.dot {
  width: 8px;
  height: 8px;
  background-color: var(--md-sys-color-on-surface-variant);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}
.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.chat-input-area {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  padding: var(--md-sys-spacing-md);
  border-top: 1px solid var(--md-sys-color-outline-variant);
}

.chat-input {
  flex: 1;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-radius-full);
  font-size: var(--md-sys-typescale-body-medium);
  background-color: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
}

.chat-input:focus {
  outline: none;
  border-color: var(--md-sys-color-primary);
  box-shadow: 0 0 0 2px var(--md-sys-color-primary-container);
}

.chat-input:disabled {
  opacity: 0.6;
}

.chat-send {
  color: var(--md-sys-color-primary);
}

.chat-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
