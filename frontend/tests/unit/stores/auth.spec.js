import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
    localStorageMock.clear.mockClear()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('should initialize with null user and token', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('should update user and token', () => {
    const store = useAuthStore()
    const mockUser = { id: '1', email: 'test@example.com' }
    const mockToken = 'mock-jwt-token'

    store.user = mockUser
    store.token = mockToken

    expect(store.user).toEqual(mockUser)
    expect(store.token).toBe(mockToken)
    expect(store.isAuthenticated).toBe(true)
  })

  it('should logout and clear state', () => {
    const store = useAuthStore()
    store.user = { id: '1', email: 'test@example.com' }
    store.token = 'mock-token'

    store.user = null
    store.token = null

    expect(store.user).toBeNull()
    expect(store.token).toBeNull()
  })
})
