<template>
  <div class="settings-view">
    <h1 class="page-title">Settings</h1>

    <!-- Notification Settings -->
    <section class="settings-section card">
      <h2 class="section-title">Notifications</h2>
      
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Enable notifications</span>
          <span class="setting-description">Receive reminders for upcoming chores</span>
        </div>
        <label class="toggle">
          <input 
            v-model="notificationPrefs.enabled" 
            type="checkbox"
            @change="updateNotificationPrefs"
          />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div v-if="notificationPrefs.enabled" class="setting-group">
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Reminder time</span>
            <span class="setting-description">Daily reminder time</span>
          </div>
          <input 
            v-model="notificationPrefs.reminderTime"
            type="time"
            class="input"
            @change="updateNotificationPrefs"
          />
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Overdue alerts</span>
            <span class="setting-description">Get notified about overdue chores</span>
          </div>
          <label class="toggle">
            <input 
              v-model="notificationPrefs.overdueAlerts" 
              type="checkbox"
              @change="updateNotificationPrefs"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">Weekly summary</span>
            <span class="setting-description">Receive a weekly chore summary</span>
          </div>
          <label class="toggle">
            <input 
              v-model="notificationPrefs.weeklySummary" 
              type="checkbox"
              @change="updateNotificationPrefs"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <button 
        @click="testNotification"
        class="btn btn-tonal"
        :disabled="notificationStore.loading"
      >
        Test Notification
      </button>
    </section>

    <!-- Theme Settings -->
    <section class="settings-section card">
      <h2 class="section-title">Appearance</h2>
      
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Theme</span>
          <span class="setting-description">Choose light or dark mode</span>
        </div>
        <div class="theme-selector">
          <button 
            @click="setTheme('light')"
            class="theme-option"
            :class="{ active: currentTheme === 'light' }"
          >
            <span class="mdi mdi-white-balance-sunny"></span>
            <span>Light</span>
          </button>
          <button 
            @click="setTheme('dark')"
            class="theme-option"
            :class="{ active: currentTheme === 'dark' }"
          >
            <span class="mdi mdi-moon-waning-crescent"></span>
            <span>Dark</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Data Settings -->
    <section class="settings-section card">
      <h2 class="section-title">Data</h2>
      
      <div class="setting-actions">
        <button @click="exportData" class="btn btn-tonal">
          <span class="mdi mdi-download" style="margin-right: 8px;"></span>
          Export Data
        </button>
        <button @click="importData" class="btn btn-tonal">
          <span class="mdi mdi-upload" style="margin-right: 8px;"></span>
          Import Data
        </button>
      </div>
    </section>

    <!-- About -->
    <section class="settings-section card">
      <h2 class="section-title">About</h2>
      
      <div class="about-info">
        <p><strong>Version:</strong> 1.0.0</p>
        <p>Built with Vue 3, Vite, and Material You design.</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useNotificationStore } from '@/stores/notification'
import { useChoreStore } from '@/stores/chore'
import { useLogStore } from '@/stores/log'

const notificationStore = useNotificationStore()
const choreStore = useChoreStore()
const logStore = useLogStore()

const notificationPrefs = ref({
  enabled: true,
  reminderTime: '08:00',
  overdueAlerts: true,
  weeklySummary: false
})

const currentTheme = ref('light')

onMounted(async () => {
  try {
    await notificationStore.fetchPreferences()
    notificationPrefs.value = { ...notificationPrefs.value, ...notificationStore.preferences }
  } catch (err) {
    console.error('Failed to fetch preferences:', err)
  }

  // Load theme preference
  const savedTheme = localStorage.getItem('theme') || 'light'
  currentTheme.value = savedTheme
  applyTheme(savedTheme)
})

async function updateNotificationPrefs() {
  try {
    await notificationStore.updatePreferences(notificationPrefs.value)
  } catch (err) {
    console.error('Failed to update preferences:', err)
  }
}

async function testNotification() {
  try {
    await notificationStore.testNotification()
    alert('Test notification sent!')
  } catch (err) {
    alert('Failed to send test notification')
  }
}

function setTheme(theme) {
  currentTheme.value = theme
  localStorage.setItem('theme', theme)
  applyTheme(theme)
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

async function exportData() {
  const data = {
    chores: choreStore.chores,
    logs: logStore.logs,
    exportedAt: new Date().toISOString()
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `choretwo-export-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (data.chores) {
        // Import chores (you'll need to add import logic to the store)
        console.log('Importing chores:', data.chores.length)
      }
      
      alert('Import successful!')
    } catch (err) {
      alert('Failed to import data: ' + err.message)
    }
  }
  
  input.click()
}
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: var(--md-sys-typescale-headline-large);
  font-weight: 500;
  margin-bottom: var(--md-sys-spacing-lg);
}

.settings-section {
  margin-bottom: var(--md-sys-spacing-lg);
  padding: var(--md-sys-spacing-lg);
}

.section-title {
  font-size: var(--md-sys-typescale-title-medium);
  font-weight: 500;
  margin-bottom: var(--md-sys-spacing-md);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--md-sys-spacing-md) 0;
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-size: var(--md-sys-typescale-body-medium);
  font-weight: 500;
}

.setting-description {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
}

.setting-group {
  margin: var(--md-sys-spacing-md) 0;
  padding-left: var(--md-sys-spacing-md);
  border-left: 2px solid var(--md-sys-color-outline-variant);
}

.setting-actions {
  display: flex;
  gap: var(--md-sys-spacing-md);
  margin-top: var(--md-sys-spacing-md);
}

.theme-selector {
  display: flex;
  gap: var(--md-sys-spacing-sm);
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border: 2px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-radius-medium);
  background: transparent;
  cursor: pointer;
  min-width: 80px;
}

.theme-option.active {
  border-color: var(--md-sys-color-primary);
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
}

.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--md-sys-color-outline);
  transition: var(--md-sys-transition-fast);
  border-radius: 28px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: var(--md-sys-transition-fast);
  border-radius: 50%;
}

.toggle input:checked + .toggle-slider {
  background-color: var(--md-sys-color-primary);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.about-info {
  padding: var(--md-sys-spacing-md) 0;
  color: var(--md-sys-color-on-surface-variant);
}

.about-info p {
  margin-bottom: var(--md-sys-spacing-sm);
}
</style>
