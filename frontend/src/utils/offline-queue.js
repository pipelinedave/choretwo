import { ref } from 'vue'

const OFFLINE_QUEUE_KEY = 'choretwo_offline_queue'

export const offlineQueue = ref([])

export function loadOfflineQueue() {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (stored) {
      offlineQueue.value = JSON.parse(stored)
    }
  } catch (err) {
    console.error('Failed to load offline queue:', err)
  }
}

export function saveOfflineQueue() {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue.value))
  } catch (err) {
    console.error('Failed to save offline queue:', err)
  }
}

export function addToQueue(action) {
  offlineQueue.value.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ...action
  })
  saveOfflineQueue()
}

export async function processQueue() {
  if (offlineQueue.value.length === 0) return

  const queue = [...offlineQueue.value]
  offlineQueue.value = []
  saveOfflineQueue()

  for (const action of queue) {
    try {
      await executeAction(action)
    } catch (err) {
      console.error('Failed to process queued action:', err)
      // Re-add to queue for retry
      addToQueue(action)
    }
  }
}

async function executeAction(action) {
  // Import APIs dynamically to avoid circular dependencies
  const { choreApi, logApi } = await import('@/api')

  switch (action.type) {
    case 'chore:mark-done':
      await choreApi.put(`/${action.choreId}/done`, { done_by: action.doneBy })
      break
    case 'chore:create':
      await choreApi.post('/', action.data)
      break
    case 'chore:update':
      await choreApi.put(`/${action.choreId}`, action.data)
      break
    case 'chore:archive':
      await choreApi.put(`/${action.choreId}/archive`)
      break
    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

export function isOnline() {
  return navigator.onLine
}

export function listenOnline/offline(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
