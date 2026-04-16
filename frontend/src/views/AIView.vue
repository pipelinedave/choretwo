<template>
  <div class="ai-view">
    <div class="ai-header">
      <div class="ai-header-content">
        <span class="mdi mdi-robot-happy" style="font-size: 48px; color: var(--md-sys-color-primary);"></span>
        <h1>AI Copilot</h1>
        <p>Ask me anything about your chores!</p>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="quick-actions">
      <button 
        v-for="action in quickActions" 
        :key="action.label"
        @click="sendQuickCommand(action.command)"
        class="quick-action-card card"
      >
        <span class="mdi" :class="action.icon"></span>
        <span>{{ action.label }}</span>
      </button>
    </div>

    <!-- Chat interface -->
    <div class="chat-container">
      <div class="chat-messages" ref="messagesRef">
        <div v-if="messages.length === 0" class="chat-empty">
          <p>Hi! I'm your AI chore assistant.</p>
          <p>I can help you:</p>
          <ul>
            <li>List your current chores</li>
            <li>Add new chores</li>
            <li>Mark chores as done</li>
            <li>Provide suggestions</li>
            <li>Analyze your chore patterns</li>
          </ul>
        </div>

        <div 
          v-for="msg in messages" 
          :key="msg.id"
          class="chat-message"
          :class="msg.role"
        >
          <div class="message-avatar">
            <span class="mdi" :class="msg.role === 'user' ? 'mdi-account' : 'mdi-robot-happy'"></span>
          </div>
          <div class="message-content">
            {{ msg.content }}
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
import { ref, nextTick, onMounted } from 'vue'
import { aiApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const messages = ref([])
const inputMessage = ref('')
const loading = ref(false)
const messagesRef = ref(null)

const quickActions = [
  { label: 'What chores do I have?', command: 'What chores do I have?', icon: 'mdi-list-box-outline' },
  { label: 'Add a new chore', command: 'Add a new chore', icon: 'mdi-plus-circle' },
  { label: 'Mark "wash dishes" done', command: 'Mark wash dishes as done', icon: 'mdi-check-circle' },
  { label: 'Give me suggestions', command: 'Give me suggestions', icon: 'mdi-lightbulb' },
  { label: 'Analyze my patterns', command: 'Analyze my chore patterns', icon: 'mdi-chart-line' },
  { label: 'Show stats', command: 'Show me my chore statistics', icon: 'mdi-chart-bar' }
]

onMounted(async () => {
  // Fetch initial suggestions
  await fetchSuggestions()
})

async function sendMessage() {
  if (!inputMessage.value.trim() || loading.value) return

  const userMessage = {
    id: Date.now(),
    role: 'user',
    content: inputMessage.value
  }

  messages.value.push(userMessage)
  inputMessage.value = ''
  await scrollToBottom()

  loading.value = true

  try {
    const response = await aiApi.post('/chat', {
      message: userMessage.content,
      user_id: authStore.user?.id
    })

    const assistantMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: response.data.response || response.data.message || 'I\'m not sure how to help with that.'
    }

    messages.value.push(assistantMessage)
    await scrollToBottom()
  } catch (err) {
    console.error('Chat error:', err)
    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      content: 'Sorry, I encountered an error. Please try again.'
    })
  } finally {
    loading.value = false
  }
}

async function sendQuickCommand(command) {
  inputMessage.value = command
  await sendMessage()
}

async function fetchSuggestions() {
  try {
    const response = await aiApi.get('/suggestions')
    if (response.data.suggestions && response.data.suggestions.length > 0) {
      messages.value.push({
        id: Date.now(),
        role: 'assistant',
        content: `Here are some suggestions: ${response.data.suggestions.slice(0, 3).join(', ')}`
      })
    }
  } catch (err) {
    console.error('Failed to fetch suggestions:', err)
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}
</script>

<style scoped>
.ai-view {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

.ai-header {
  text-align: center;
  padding: var(--md-sys-spacing-lg);
  background: linear-gradient(135deg, var(--md-sys-color-primary-container), var(--md-sys-color-secondary-container));
  border-radius: var(--md-sys-radius-extra-large);
  margin-bottom: var(--md-sys-spacing-lg);
}

.ai-header-content h1 {
  font-size: var(--md-sys-typescale-headline-medium);
  font-weight: 500;
  color: var(--md-sys-color-on-primary-container);
  margin: var(--md-sys-spacing-md) 0;
}

.ai-header-content p {
  font-size: var(--md-sys-typescale-body-large);
  color: var(--md-sys-color-on-secondary-container);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-lg);
}

.quick-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  padding: var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-surface);
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-radius-medium);
  cursor: pointer;
  transition: transform var(--md-sys-transition-fast), background-color var(--md-sys-transition-fast);
}

.quick-action-card:hover {
  transform: translateY(-2px);
  background-color: var(--md-sys-color-primary-container);
}

.quick-action-card .mdi {
  font-size: 28px;
  color: var(--md-sys-color-primary);
}

.chat-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-radius-extra-large);
  border: 1px solid var(--md-sys-color-outline-variant);
  overflow: hidden;
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
  padding: var(--md-sys-spacing-2xl);
  color: var(--md-sys-color-on-surface-variant);
}

.chat-empty p {
  margin-bottom: var(--md-sys-spacing-sm);
}

.chat-empty ul {
  text-align: left;
  margin-top: var(--md-sys-spacing-md);
  padding-left: var(--md-sys-spacing-lg);
}

.chat-empty li {
  margin-bottom: var(--md-sys-spacing-sm);
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

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
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
