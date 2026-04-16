import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChoreStore = defineStore('chores', () => {
  const chores = ref([])
  const loading = ref(false)

  async function fetchChores() {
    loading.value = true
    // TODO: Implement API call
    loading.value = false
  }

  async function addChore(chore) {
    // TODO: Implement API call
  }

  async function updateChore(id, updates) {
    // TODO: Implement API call
  }

  async function markDone(id) {
    // TODO: Implement API call
  }

  return { chores, loading, fetchChores, addChore, updateChore, markDone }
})
