<template>
  <div id="app">
    <AppHeader v-if="showHeader" :title="headerTitle" />
    
    <main class="main-content" :class="{ 'has-bottom-nav': showBottomNav }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    
    <AppBottomNav v-if="showBottomNav" />
    
    <!-- AI Chat Widget (always visible on auth pages) -->
    <ChatWidget v-if="showChatWidget && authStore.isAuthenticated" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/layout/AppHeader.vue'
import AppBottomNav from '@/components/layout/AppBottomNav.vue'
import ChatWidget from '@/components/ai/ChatWidget.vue'

const route = useRoute()
const authStore = useAuthStore()

const showHeader = computed(() => {
  return !route.meta.hideLayout
})

const showBottomNav = computed(() => {
  return authStore.isAuthenticated && !route.meta.hideBottomNav
})

const showChatWidget = computed(() => {
  return authStore.isAuthenticated && !route.meta.hideChat
})

const headerTitle = computed(() => {
  const titles = {
    '/': 'Choretwo',
    '/chores': 'My Chores',
    '/logs': 'Activity Log',
    '/settings': 'Settings',
    '/ai': 'AI Copilot'
  }
  return titles[route.path] || 'Choretwo'
})
</script>

<style>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  padding: var(--md-sys-spacing-md);
  padding-top: calc(var(--md-sys-spacing-md) + 64px);
  padding-bottom: calc(var(--md-sys-spacing-xl) + 80px);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.main-content.has-bottom-nav {
  padding-bottom: calc(var(--md-sys-spacing-xl) + 80px);
}

@media (min-width: 768px) {
  .main-content {
    padding-top: calc(var(--md-sys-spacing-lg) + 64px);
    padding-bottom: var(--md-sys-spacing-2xl);
  }
  
  .main-content.has-bottom-nav {
    padding-bottom: var(--md-sys-spacing-2xl);
  }
}
</style>
