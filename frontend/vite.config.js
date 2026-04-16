import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      '/api/chores': {
        target: 'http://localhost:8002',
        changeOrigin: true
      },
      '/api/logs': {
        target: 'http://localhost:8003',
        changeOrigin: true
      },
      '/api/notify': {
        target: 'http://localhost:8004',
        changeOrigin: true
      },
      '/api/ai': {
        target: 'http://localhost:8005',
        changeOrigin: true
      }
    }
  }
})
