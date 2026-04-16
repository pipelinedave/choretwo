import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { choreApi } from '@/api'

export const useChoreStore = defineStore('chores', () => {
  const chores = ref([])
  const loading = ref(false)
  const error = ref(null)
  const filter = ref('all')

  const filteredChores = computed(() => {
    if (filter.value === 'all') return chores.value
    if (filter.value === 'completed') return chores.value.filter(c => c.done)
    if (filter.value === 'overdue') return chores.value.filter(c => !c.done && c.dueDate && new Date(c.dueDate) < new Date())
    if (filter.value === 'due-soon') {
      const today = new Date()
      const soon = new Date()
      soon.setDate(soon.getDate() + 3)
      return chores.value.filter(c => !c.done && c.dueDate && new Date(c.dueDate) >= today && new Date(c.dueDate) <= soon)
    }
    return chores.value
  })

  const stats = computed(() => {
    const total = chores.value.length
    const completed = chores.value.filter(c => c.done).length
    const overdue = chores.value.filter(c => !c.done && c.dueDate && new Date(c.dueDate) < new Date()).length
    const dueSoon = chores.value.filter(c => {
      if (c.done || !c.dueDate) return false
      const today = new Date()
      const soon = new Date()
      soon.setDate(soon.getDate() + 3)
      return new Date(c.dueDate) >= today && new Date(c.dueDate) <= soon
    }).length
    
    return { total, completed, overdue, dueSoon }
  })

  async function fetchChores() {
    loading.value = true
    error.value = null
    
    try {
      const response = await choreApi.get('/')
      chores.value = response.data
    } catch (err) {
      error.value = err.message || 'Failed to fetch chores'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function addChore(choreData) {
    try {
      const response = await choreApi.post('/', choreData)
      chores.value.push(response.data)
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to add chore'
      throw err
    }
  }

  async function updateChore(id, updates) {
    try {
      const response = await choreApi.put(`/${id}`, updates)
      const index = chores.value.findIndex(c => c.id === id)
      if (index !== -1) {
        chores.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to update chore'
      throw err
    }
  }

  async function markDone(id, doneBy) {
    try {
      const response = await choreApi.put(`/${id}/done`, { done_by: doneBy })
      const index = chores.value.findIndex(c => c.id === id)
      if (index !== -1) {
        chores.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to mark chore as done'
      throw err
    }
  }

  async function archiveChore(id) {
    try {
      const response = await choreApi.put(`/${id}/archive`)
      const index = chores.value.findIndex(c => c.id === id)
      if (index !== -1) {
        chores.value[index] = response.data
      }
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to archive chore'
      throw err
    }
  }

  async function deleteChore(id) {
    try {
      await choreApi.delete(`/${id}`)
      chores.value = chores.value.filter(c => c.id !== id)
    } catch (err) {
      error.value = err.message || 'Failed to delete chore'
      throw err
    }
  }

  function setFilter(newFilter) {
    filter.value = newFilter
  }

  function clearError() {
    error.value = null
  }

  return {
    chores,
    loading,
    error,
    filter,
    filteredChores,
    stats,
    fetchChores,
    addChore,
    updateChore,
    markDone,
    archiveChore,
    deleteChore,
    setFilter,
    clearError
  }
})
