import { defineStore } from 'pinia'
import { ref } from 'vue'
import { logApi, choreApi } from '@/api'
import { useAuthStore } from '@/stores/auth'

export const useLogStore = defineStore('logs', () => {
  const logs = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastAction = ref(null)

  async function fetchLogs(limit = 50) {
    loading.value = true
    error.value = null
    
    try {
      const response = await logApi.get(`/?limit=${limit}`)
      logs.value = response.data
    } catch (err) {
      error.value = err.message || 'Failed to fetch logs'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function undo(logId) {
    const log = logs.value.find(l => l.id === logId)
    if (!log) throw new Error('Log not found')

    try {
      const response = await logApi.post('/undo', { log_id: logId })

      const index = logs.value.findIndex(l => l.id === logId)
      if (index !== -1) {
        logs.value.splice(index, 1)
      }

      lastAction.value = { type: 'undo', logId }
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to undo action'
      throw err
    }
  }

  function setLastAction(action) {
    lastAction.value = action
  }

  function clearError() {
    error.value = null
  }

  return {
    logs,
    loading,
    error,
    lastAction,
    fetchLogs,
    undo,
    setLastAction,
    clearError
  }
})
