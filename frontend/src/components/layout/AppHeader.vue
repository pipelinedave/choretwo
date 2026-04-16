<template>
  <header class="app-bar app-bar-large shadow-elevation-1">
    <div class="app-bar-content">
      <div class="app-bar-start">
        <h1 class="app-bar-title">{{ title }}</h1>
      </div>
      
      <div class="app-bar-end">
        <button 
          v-if="authStore.isAuthenticated"
          @click="showUserMenu = !showUserMenu"
          class="btn-icon touch-target"
          aria-label="User menu"
        >
          <span class="mdi mdi-account-circle" style="font-size: 28px;"></span>
        </button>
        
        <!-- User Menu Dropdown -->
        <div v-if="showUserMenu" class="user-menu">
          <div class="user-menu-header">
            <span class="mdi mdi-account-circle" style="font-size: 32px;"></span>
            <span class="user-name">{{ authStore.user?.email }}</span>
          </div>
          <div class="user-menu-items">
            <router-link 
              to="/settings" 
              class="menu-item"
              @click="showUserMenu = false"
            >
              <span class="mdi mdi-cog" style="margin-right: 8px;"></span>
              Settings
            </router-link>
            <button 
              @click="handleLogout" 
              class="menu-item logout"
            >
              <span class="mdi mdi-logout" style="margin-right: 8px;"></span>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const props = defineProps({
  title: {
    type: String,
    default: 'Choretwo'
  }
})

const authStore = useAuthStore()
const router = useRouter()
const showUserMenu = ref(false)

// Close menu when clicking outside
watch(showUserMenu, (newValue) => {
  if (newValue) {
    const closeMenu = (e) => {
      if (!e.target.closest('.app-bar')) {
        showUserMenu.value = false
        document.removeEventListener('click', closeMenu)
      }
    }
    setTimeout(() => document.addEventListener('click', closeMenu), 0)
  }
})

async function handleLogout() {
  await authStore.logout()
}
</script>

<style scoped>
.app-bar {
  position: sticky;
  top: 0;
}

.app-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--md-sys-spacing-md);
  height: 64px;
}

.app-bar-start {
  display: flex;
  align-items: center;
}

.app-bar-title {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
}

.app-bar-end {
  position: relative;
}

.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background-color: var(--md-sys-color-surface);
  border-radius: var(--md-sys-radius-medium);
  box-shadow: var(--md-sys-elevation-3);
  min-width: 200px;
  z-index: var(--md-sys-zindex-dropdown);
  overflow: hidden;
}

.user-menu-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--md-sys-spacing-md);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
  background-color: var(--md-sys-color-surface-variant);
}

.user-menu-header .mdi {
  color: var(--md-sys-color-primary);
}

.user-name {
  margin-top: var(--md-sys-spacing-sm);
  font-size: var(--md-sys-typescale-body-medium);
  font-weight: 500;
  color: var(--md-sys-color-on-surface);
  text-align: center;
  word-break: break-all;
}

.user-menu-items {
  padding: var(--md-sys-spacing-sm) 0;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  font-size: var(--md-sys-typescale-body-medium);
  color: var(--md-sys-color-on-surface);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background-color var(--md-sys-transition-fast);
}

.menu-item:hover {
  background-color: var(--md-sys-color-surface-variant);
}

.menu-item.logout {
  color: var(--md-sys-color-error);
}
</style>
