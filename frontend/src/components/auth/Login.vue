<template>
  <div class="login-container">
    <div class="login-card card">
      <div class="login-header">
        <span class="mdi mdi-checkbox-marked-circle brand-icon"></span>
        <h1 class="login-title">CHORETWO</h1>
        <p class="login-subtitle">
          Tactile Microservice Household Task Tracker
        </p>
      </div>

      <div class="login-content">
        <LoadingSpinner v-if="authStore.loading" context="auth" message="Authentifizierung läuft…" />

        <!-- Supabase mode: passwordless magic link (+ optional Google OAuth) -->
        <div v-else-if="authStore.isSupabaseMode" class="login-actions">
          <p class="login-message" v-if="authStore.error">
            {{ authStore.error }}
          </p>

          <template v-if="!magicLinkSent">
            <input
              v-model="email"
              type="email"
              class="login-input"
              placeholder="you@example.com"
              autocomplete="email"
              required
              @keyup.enter="handleMagicLink"
            />
            <button
              @click="handleMagicLink"
              class="btn btn-primary btn-login"
              :disabled="!email || magicLinkSending"
            >
              <ChoreSpinner v-if="magicLinkSending" inline variant="bubbles" />
              <template v-else>
                <span class="mdi mdi-email-outline"></span>
                Send login link
              </template>
            </button>
            <button
              v-if="googleEnabled"
              @click="handleGoogle"
              class="btn btn-tonal btn-login"
            >
              <span class="mdi mdi-google"></span>
              Sign in with Google
            </button>
            <p class="login-note">
              We'll email you a passwordless login link.
            </p>
          </template>

          <p class="login-note login-sent" v-else>
            <span class="mdi mdi-email-check-outline"></span>
            Login-Link wurde gesendet an {{ email }}. Bitte im Postfach öffnen.
          </p>
        </div>

        <!-- Legacy mode: Go auth-service / Dex OIDC (local dev & E2E) -->
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
import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import ChoreSpinner from "@/components/layout/ChoreSpinner.vue";

const route = useRoute();
const authStore = useAuthStore();

const email = ref("");
const magicLinkSent = ref(false);
const magicLinkSending = ref(false);
// Google OAuth is opt-in via env (VITE_SUPABASE_GOOGLE_ENABLED=true) and
// only rendered in Supabase mode.
const googleEnabled =
  authStore.isSupabaseMode &&
  import.meta.env.VITE_SUPABASE_GOOGLE_ENABLED === "true";

function handleLogin() {
  const redirect = route.query.redirect || "/";
  authStore.login(redirect);
}

async function handleMagicLink() {
  if (!email.value || magicLinkSending.value) return;
  magicLinkSending.value = true;
  try {
    const redirect = route.query.redirect || "/";
    const sent = await authStore.login(email.value, redirect);
    if (sent) magicLinkSent.value = true;
  } finally {
    magicLinkSending.value = false;
  }
}

async function handleGoogle() {
  const redirect = route.query.redirect || "/";
  await authStore.loginWithGoogle(redirect);
}
</script>

<style scoped>
.login-container {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-lg);
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: var(--md-sys-spacing-xl);
  text-align: center;
  background: var(--color-surface);
  border-radius: var(--md-sys-radius-large);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-glass);
  backdrop-filter: blur(20px);
}

.login-header {
  margin-bottom: var(--md-sys-spacing-xl);
}

.brand-icon {
  font-size: 56px;
  color: var(--color-primary);
}

.login-title {
  font-family: "Space Grotesk", sans-serif;
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: -0.5px;
  margin-top: var(--md-sys-spacing-sm);
  margin-bottom: var(--space-xxs);
}

.login-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.login-actions {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-md);
}

.btn-login {
  width: 100%;
  padding: 0.85rem var(--md-sys-spacing-md);
  font-size: 1rem;
  border-radius: var(--md-sys-radius-medium);
}

.login-input {
  width: 100%;
  padding: 0.85rem var(--md-sys-spacing-md);
  font-size: 1rem;
  font-family: inherit;
  border-radius: var(--md-sys-radius-medium);
  border: 1px solid var(--color-surface-variant, color-mix(in srgb, var(--color-text) 15%, transparent));
  background: var(--color-surface-light, #fff);
  color: var(--color-text);
  text-align: center;
}

.login-input:focus {
  border-color: var(--color-primary);
}

.login-input:disabled {
  opacity: 0.6;
}

.login-sent {
  font-size: 0.9rem;
  color: var(--color-text);
}

.login-sent .mdi {
  font-size: 1.4rem;
  display: block;
  margin-bottom: var(--md-sys-spacing-sm);
  color: var(--color-primary);
}

.login-message {
  padding: 0.5rem 1rem;
  background-color: var(--color-danger-subtle);
  color: var(--color-danger);
  border-radius: var(--md-sys-radius-small);
  font-size: 0.85rem;
}

.login-note {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: var(--md-sys-spacing-md);
}
</style>
