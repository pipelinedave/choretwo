<template>
  <div class="login-container">
    <div class="login-card card">
      <div class="login-header">
        <span class="mdi mdi-checkbox-marked-circle brand-icon"></span>
        <h1 class="login-title">CHORETWO</h1>
        <p class="login-subtitle">Tactile Microservice Household Task Tracker</p>
      </div>

      <div class="login-content">
        <LoadingSpinner v-if="authStore.loading" message="Authenticating..." />

        <div v-else class="login-actions">
          <p class="login-message" v-if="authStore.error">
            {{ authStore.error }}
          </p>

          <button @click="handleLogin" class="btn btn-primary btn-login">
            <span class="mdi mdi-google"></span>
            Sign in with Dex / OAuth
          </button>

          <p class="login-note">
            Secure multi-user authentication powered by Dex OIDC
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";

const route = useRoute();
const authStore = useAuthStore();

function handleLogin() {
  const redirect = route.query.redirect || "/";
  authStore.login(redirect);
}
</script>

<style scoped>
.login-container {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: var(--space-xl);
  text-align: center;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
}

.login-header {
  margin-bottom: var(--space-xl);
}

.brand-icon {
  font-size: 56px;
  color: var(--color-primary);
}

.login-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.5px;
  margin-top: var(--space-xs);
  margin-bottom: var(--space-xxs);
}

.login-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.btn-login {
  width: 100%;
  padding: 0.85rem var(--space-md);
  font-size: 1rem;
  border-radius: var(--radius-md);
}

.login-message {
  padding: 0.5rem 1rem;
  background-color: rgba(231, 99, 99, 0.15);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.login-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: var(--space-md);
}
</style>
