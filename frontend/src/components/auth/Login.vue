<template>
  <div class="login-container">
    <div class="login-card card">
      <div class="login-header">
        <span class="mdi mdi-checkbox-marked-circle" style="font-size: 64px; color: var(--md-sys-color-primary);"></span>
        <h1 class="login-title">Choretwo</h1>
        <p class="login-subtitle">Manage your chores with ease</p>
      </div>
      
      <div class="login-content">
        <LoadingSpinner v-if="authStore.loading" message="Authenticating..." />
        
        <div v-else class="login-actions">
          <p class="login-message" v-if="authStore.error">
            {{ authStore.error }}
          </p>
          
          <button 
            @click="handleLogin"
            class="btn btn-filled btn-login"
          >
            <span class="mdi mdi-google" style="margin-right: 8px;"></span>
            Sign in with Google
          </button>
          
          <p class="login-note">
            By signing in, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

function handleLogin() {
  const redirect = route.query.redirect || '/'
  authStore.login(redirect)
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-lg);
  background-color: var(--md-sys-color-background);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: var(--md-sys-spacing-2xl);
  text-align: center;
}

.login-header {
  margin-bottom: var(--md-sys-spacing-2xl);
}

.login-title {
  font-size: var(--md-sys-typescale-headline-large);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  margin-top: var(--md-sys-spacing-md);
  margin-bottom: var(--md-sys-spacing-sm);
}

.login-subtitle {
  font-size: var(--md-sys-typescale-body-large);
  color: var(--md-sys-color-on-surface-variant);
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-md);
}

.btn-login {
  width: 100%;
  padding: var(--md-sys-spacing-md);
  font-size: var(--md-sys-typescale-body-large);
}

.login-message {
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  background-color: var(--md-sys-color-error-container);
  color: var(--md-sys-color-on-error-container);
  border-radius: var(--md-sys-radius-medium);
  font-size: var(--md-sys-typescale-body-medium);
}

.login-note {
  font-size: var(--md-sys-typescale-body-small);
  color: var(--md-sys-color-on-surface-variant);
  margin-top: var(--md-sys-spacing-lg);
}
</style>
