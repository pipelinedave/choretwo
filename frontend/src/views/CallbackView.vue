<template>
  <div class="callback-container">
    <LoadingSpinner v-if="authStore.loading" message="Completing authentication..." />
    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <router-link to="/login" class="btn btn-filled">
        Back to Login
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'

const router = useRouter()
const authStore = useAuthStore()
const error = ref(null)

onMounted(async () => {
  try {
    const success = await authStore.handleCallback()
    if (success) {
      const redirect = router.currentRoute.value.query.redirect || '/'
      router.push(redirect)
    } else {
      error.value = authStore.error || 'Authentication failed'
    }
  } catch (err) {
    error.value = err.message || 'Authentication failed'
  }
})
</script>

<style scoped>
.callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-2xl);
  text-align: center;
}

.error-message {
  font-size: var(--md-sys-typescale-body-large);
  color: var(--md-sys-color-error);
  margin-bottom: var(--md-sys-spacing-lg);
}
</style>
