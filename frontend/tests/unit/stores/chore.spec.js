import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChoreStore } from '@/stores/chore'

describe('Chore Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should initialize with empty chores', () => {
    const store = useChoreStore()
    expect(store.chores).toEqual([])
    expect(store.loading).toBe(false)
  })

  it('should calculate stats correctly', () => {
    const store = useChoreStore()
    store.chores = [
      { id: '1', name: 'Chore 1', done: false },
      { id: '2', name: 'Chore 2', done: true },
      { id: '3', name: 'Chore 3', done: false }
    ]

    expect(store.stats.total).toBe(3)
    expect(store.stats.completed).toBe(1)
  })

  it('should filter chores by status', () => {
    const store = useChoreStore()
    store.chores = [
      { id: '1', name: 'Chore 1', done: false },
      { id: '2', name: 'Chore 2', done: true }
    ]

    store.filter = 'completed'
    expect(store.filteredChores.length).toBe(1)

    store.filter = 'all'
    expect(store.filteredChores.length).toBe(2)
  })

  it('should set filter', () => {
    const store = useChoreStore()
    store.setFilter('completed')
    expect(store.filter).toBe('completed')
  })
})
