<template>
  <nav class="bottom-nav safe-bottom">
    <router-link 
      v-for="item in navItems" 
      :key="item.path"
      :to="item.path"
      class="nav-item"
      :class="{ active: isActive(item.path) }"
    >
      <span 
        class="nav-item-icon mdi" 
        :class="item.icon"
      ></span>
      <span class="nav-item-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { path: '/', label: 'Home', icon: 'mdi-home' },
  { path: '/chores', label: 'Chores', icon: 'mdi-checkbox-marked-circle' },
  { path: '/logs', label: 'Logs', icon: 'mdi-history' },
  { path: '/settings', label: 'Settings', icon: 'mdi-cog' }
]

const isActive = (path) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}
</script>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--md-sys-color-surface);
  height: 80px;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: var(--md-sys-zindex-overlay);
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-sm);
  min-width: 64px;
  min-height: 48px;
  border-radius: var(--md-sys-radius-full);
  text-decoration: none;
  transition: background-color var(--md-sys-transition-fast);
  color: var(--md-sys-color-nav-inactive);
}

.nav-item.active {
  color: var(--md-sys-color-nav-active);
  background-color: var(--md-sys-color-primary-container);
}

.nav-item-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.nav-item-label {
  font-size: 12px;
  font-weight: 500;
}
</style>
