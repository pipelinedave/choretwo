import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// Create axios instances for each service
export const authApi = axios.create({
  baseURL: `${API_BASE}/api/auth`,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const choreApi = axios.create({
  baseURL: `${API_BASE}/api/chores`,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const logApi = axios.create({
  baseURL: `${API_BASE}/api/logs`,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const notifyApi = axios.create({
  baseURL: `${API_BASE}/api/notify`,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const aiApi = axios.create({
  baseURL: `${API_BASE}/api/ai`,
  headers: {
    'Content-Type': 'application/json'
  }
})

// JWT Token Interceptor
const attachToken = (config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

// Request interceptor for all APIs
const apis = [authApi, choreApi, logApi, notifyApi, aiApi]

apis.forEach(api => {
  api.interceptors.request.use(attachToken, error => {
    return Promise.reject(error)
  })

  api.interceptors.response.use(
    response => response,
    error => {
      if (error.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }
  )
})

// Helper to get current token
export const getToken = () => localStorage.getItem('token')

// Helper to set token (called after successful login)
export const setToken = (token) => {
  localStorage.setItem('token', token)
}

// Helper to remove token (called on logout)
export const removeToken = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

// Helper to get current user
export const getUser = () => {
  const userStr = localStorage.getItem('user')
  return userStr ? JSON.parse(userStr) : null
}

// Helper to set user
export const setUser = (user) => {
  localStorage.setItem('user', JSON.stringify(user))
}
