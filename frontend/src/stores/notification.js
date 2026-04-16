import { defineStore } from 'pinia'
import { ref } from 'vue'
import { notifyApi } from '@/api'

export const useNotificationStore = defineStore('notifications', () => {
  const preferences = ref({
    enabled: true,
    reminderTime: '08:00',
    reminderDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    overdueAlerts: true,
    weeklySummary: false
  })
  const loading = ref(false)
  const error = ref(null)

  async function fetchPreferences() {
    loading.value = true
    error.value = null
    
    try {
      const response = await notifyApi.get('/preferences')
      preferences.value = { ...preferences.value, ...response.data }
    } catch (err) {
      error.value = err.message || 'Failed to fetch preferences'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updatePreferences(newPrefs) {
    loading.value = true
    error.value = null
    
    try {
      const response = await notifyApi.put('/preferences', newPrefs)
      preferences.value = response.data
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to update preferences'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function testNotification() {
    try {
      await notifyApi.post('/test')
      return true
    } catch (err) {
      error.value = err.message || 'Failed to send test notification'
      throw err
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    preferences,
    loading,
    error,
    fetchPreferences,
    updatePreferences,
    testNotification,
    clearError
  }
})
