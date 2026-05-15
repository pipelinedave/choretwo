import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { choreApi } from '@/api'
import { bucketChores, normalizeToLocalDate } from '@/utils/choreBuckets'

export const useChoreStore = defineStore('chores', () => {
  const chores = ref([])
  const archivedChores = ref([])
  const loading = ref(false)
  const error = ref(null)
  const filter = ref('all')
  const totalCounts = ref({
    all: 0, overdue: 0, today: 0, tomorrow: 0, thisWeek: 0, upcoming: 0
  })
  const householdHealth = ref(100)

  const sortedByUrgency = computed(() => {
    return [...chores.value].sort((a, b) => {
      const dateA = normalizeToLocalDate(a.due_date)
      const dateB = normalizeToLocalDate(b.due_date)
      return (dateA?.getTime() ?? Infinity) - (dateB?.getTime() ?? Infinity)
    })
  })

  const sortedArchivedChores = computed(() => {
    return [...archivedChores.value].sort((a, b) => {
      const dateA = normalizeToLocalDate(a.due_date)
      const dateB = normalizeToLocalDate(b.due_date)
      return (dateA?.getTime() ?? Infinity) - (dateB?.getTime() ?? Infinity)
    })
  })

  const bucketedChores = computed(() => bucketChores(sortedByUrgency.value))

  const filteredChores = computed(() => {
    const buckets = bucketedChores.value.buckets
    return buckets[filter.value] || buckets.all
  })

  const bucketCounts = computed(() => bucketedChores.value.counts)

  const stats = computed(() => {
    const total = chores.value.length
    const completed = chores.value.filter(c => c.done).length
    const overdue = bucketCounts.value.overdue
    const dueSoon = bucketCounts.value.today
    return { total, completed, overdue, dueSoon }
  })

  async function fetchChores() {
    loading.value = true
    error.value = null

    try {
      const response = await choreApi.get('/')
      chores.value = response.data
      await fetchChoreCounts()
    } catch (err) {
      error.value = err.message || 'Failed to fetch chores'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchArchivedChores() {
    loading.value = true
    error.value = null

    try {
      const response = await choreApi.get('/archived')
      archivedChores.value = response.data
    } catch (err) {
      error.value = err.message || 'Failed to fetch archived chores'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function fetchChoreCounts() {
    try {
      const response = await choreApi.get('/count')
      totalCounts.value = response.data
      await fetchHouseholdHealth()
    } catch (err) {
      console.error('Failed to fetch chore counts:', err)
    }
  }

  async function fetchHouseholdHealth() {
    try {
      const response = await choreApi.get('/household-health')
      householdHealth.value = response.data.score
    } catch (err) {
      console.error('Failed to fetch household health:', err)
    }
  }

  async function addChore(choreData) {
    try {
      const response = await choreApi.post('/', choreData)
      const createdChore = {
        ...choreData,
        id: response.data.id,
        done: false,
        done_by: null,
        archived: false
      }
      chores.value.push(createdChore)
      await fetchChoreCounts()
      return createdChore
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
        chores.value[index] = {
          ...chores.value[index],
          ...response.data,
          ...updates
        }
      }
      await fetchChoreCounts()
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
        chores.value[index] = {
          ...chores.value[index],
          done: true,
          due_date: response.data.new_due_date,
          last_done: response.data.last_done,
          done_by: response.data.done_by
        }
      }
      await fetchChoreCounts()
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
        const archivedChore = { ...chores.value[index], archived: true }
        chores.value.splice(index, 1)
        archivedChores.value.push(archivedChore)
      }
      await fetchChoreCounts()
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to archive chore'
      throw err
    }
  }

  async function unarchiveChore(id) {
    try {
      const response = await choreApi.put(`/${id}/unarchive`)
      const index = archivedChores.value.findIndex(c => c.id === id)
      if (index !== -1) {
        const unarchived = { ...archivedChores.value[index], archived: false }
        archivedChores.value.splice(index, 1)
        chores.value.push(unarchived)
      }
      await fetchChoreCounts()
      return response.data
    } catch (err) {
      error.value = err.message || 'Failed to unarchive chore'
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
    archivedChores,
    loading,
    error,
    filter,
    sortedByUrgency,
    sortedArchivedChores,
    bucketedChores,
    filteredChores,
    stats,
    totalCounts,
    householdHealth,
    fetchChores,
    fetchArchivedChores,
    fetchChoreCounts,
    fetchHouseholdHealth,
    addChore,
    updateChore,
    markDone,
    archiveChore,
    unarchiveChore,
    deleteChore,
    setFilter,
    clearError
  }
})
