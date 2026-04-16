import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || ''

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
