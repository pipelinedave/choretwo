import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, getToken, setToken, removeToken, getUser, setUser } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(getUser())
  const token = ref(getToken())
  const loading = ref(false)
  const error = ref(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function login(redirectUrl = '/') {
    window.location.href = `${import.meta.env.VITE_AUTH_URL}/api/auth/login?redirect=${encodeURIComponent(redirectUrl)}`
  }

  async function handleCallback() {
    loading.value = true
    error.value = null
    
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const tokenFromUrl = urlParams.get('token')
      
      console.log('Callback: tokenFromUrl', tokenFromUrl ? 'present' : 'missing')
      
      if (!tokenFromUrl) {
        throw new Error('No token in callback URL')
      }
      
      setToken(tokenFromUrl)
      token.value = tokenFromUrl
      
      console.log('Callback: fetching user data')
      
      const response = await authApi.get('/user')
      user.value = response.data
      setUser(response.data)
      
      console.log('Callback: success, user:', user.value)
      
      window.history.replaceState({}, '', window.location.pathname)
      
      return true
    } catch (err) {
      console.error('Callback error:', err)
      error.value = err.message || 'Authentication failed'
      removeToken()
      token.value = null
      user.value = null
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return
    
    try {
      const response = await authApi.get('/user')
      user.value = response.data
      setUser(response.data)
    } catch (err) {
      console.error('Failed to fetch user:', err)
      logout()
    }
  }

  async function logout() {
    loading.value = true
    
    try {
      // Call logout endpoint if exists
      await authApi.post('/logout').catch(() => {})
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      removeToken()
      token.value = null
      user.value = null
      loading.value = false
      
      // Redirect to login
      window.location.href = '/login'
    }
  }

  async function restoreAuth() {
    if (!token.value || !user.value) {
      const storedToken = getToken()
      const storedUser = getUser()
      
      if (storedToken && storedUser) {
        token.value = storedToken
        user.value = storedUser
        
        // Verify token is still valid
        try {
          await fetchUser()
          return true
        } catch {
          logout()
          return false
        }
      }
      return false
    }
    return true
  }

  function clearError() {
    error.value = null
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    handleCallback,
    fetchUser,
    logout,
    restoreAuth,
    clearError
  }
})
