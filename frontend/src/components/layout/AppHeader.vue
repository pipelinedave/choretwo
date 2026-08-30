<template>
  <header class="app-header">
    <div class="header-content">
      <div class="brand">
        <router-link to="/" class="brand-link">
          <span class="brand-title">{{ title || 'CHORETWO' }}</span>
        </router-link>
      </div>

      <div class="header-actions" v-if="authStore.isAuthenticated">
        <!-- Add Chore Button (+) -->
        <button
          class="btn-icon add-btn"
          @click="$emit('toggleAddChore')"
          aria-label="Add new chore"
          title="Add new chore"
        >
          <span class="mdi mdi-plus"></span>
        </button>

        <!-- Install PWA Button -->
        <button
          v-if="canInstallPwa"
          class="btn-icon install-btn"
          @click="installPwa"
          aria-label="Install App"
          title="Install App"
        >
          <span class="mdi mdi-download"></span>
        </button>

        <!-- AI Copilot Bar Toggle -->
        <button
          class="btn-icon ai-btn"
          :class="{ active: showAiBar }"
          @click="$emit('toggleAiBar')"
          aria-label="Toggle AI Copilot"
          title="AI Copilot Assistant"
        >
          <span class="mdi mdi-robot"></span>
        </button>

        <!-- Hamburger Menu (☰) / User Menu -->
        <div class="menu-wrapper" ref="menuRef">
          <button
            class="btn-icon menu-btn"
            :class="{ active: showMenu }"
            @click="showMenu = !showMenu"
            aria-label="User menu"
            title="Menu"
          >
            <span class="mdi mdi-menu"></span>
          </button>

          <!-- Menu Dropdown -->
          <transition name="scale">
            <div v-if="showMenu" class="dropdown-menu user-menu">
              <div class="user-greeting" v-if="authStore.user?.email">
                <span class="user-name user-email">{{ authStore.user.email }}</span>
              </div>

              <div class="menu-divider" v-if="authStore.user?.email"></div>

              <button class="menu-item" @click="handleMenuAction('archive')">
                <span class="mdi mdi-archive"></span>
                <span>Archived Chores</span>
              </button>

              <button class="menu-item" @click="handleMenuAction('notifications')">
                <span class="mdi mdi-bell"></span>
                <span>Notifications</span>
              </button>

              <button class="menu-item" @click="handleMenuAction('import-export')">
                <span class="mdi mdi-swap-horizontal"></span>
                <span>Import / Export</span>
              </button>

              <button class="menu-item" @click="handleMenuAction('settings')">
                <span class="mdi mdi-cog"></span>
                <span>Settings</span>
              </button>

              <button class="menu-item" @click="handleMenuAction('about')">
                <span class="mdi mdi-information"></span>
                <span>About</span>
              </button>

              <div class="menu-divider"></div>

              <button class="menu-item logout" @click="handleMenuAction('logout')">
                <span class="mdi mdi-logout"></span>
                <span>Logout</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useAuthStore } from "@/stores/auth";

defineProps({
  title: { type: String, default: "CHORETWO" },
  showAiBar: { type: Boolean, default: false },
});

const emit = defineEmits([
  "toggleAddChore",
  "toggleAiBar",
  "openArchive",
  "openNotifications",
  "openImportExport",
  "openSettings",
  "openAbout",
]);

const authStore = useAuthStore();
const showMenu = ref(false);
const menuRef = ref(null);
const canInstallPwa = ref(false);
let deferredPrompt = null;

onMounted(() => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    canInstallPwa.value = true;
  });

  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

function handleClickOutside(e) {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    showMenu.value = false;
  }
}

function handleMenuAction(action) {
  showMenu.value = false;
  switch (action) {
    case "archive":
      emit("openArchive");
      break;
    case "notifications":
      emit("openNotifications");
      break;
    case "import-export":
      emit("openImportExport");
      break;
    case "settings":
      emit("openSettings");
      break;
    case "about":
      emit("openAbout");
      break;
    case "logout":
      authStore.logout();
      break;
  }
}

async function installPwa() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      canInstallPwa.value = false;
    }
    deferredPrompt = null;
  }
}
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  margin-bottom: var(--space-md);
  backdrop-filter: blur(16px);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.brand-link {
  text-decoration: none;
}

.brand-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--color-primary);
  text-transform: uppercase;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid rgba(255, 255, 255, 0.6);
  font-size: 1.25rem;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), background-color var(--transition-fast);
  padding: 0;
}

.btn-icon:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-md);
}

.btn-icon.active {
  background: var(--color-primary);
  color: white;
}

.add-btn {
  background: var(--color-primary);
  color: white;
}

.add-btn:hover {
  background: var(--color-primary-hover);
}

.menu-wrapper {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: var(--color-background);
  background-image:
    radial-gradient(120% 160% at 10% 10%, rgba(253, 232, 213, 0.9) 0%, rgba(253, 232, 213, 0) 45%),
    radial-gradient(90% 120% at 90% 20%, rgba(189, 233, 221, 0.9) 0%, rgba(189, 233, 221, 0) 52%);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255, 255, 255, 0.7);
  padding: 8px 0;
  z-index: 1000;
  overflow: hidden;
  backdrop-filter: blur(20px);
}

.user-greeting {
  padding: 8px 16px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  word-break: break-all;
  font-weight: 500;
}

.menu-divider {
  height: 1px;
  background: var(--color-surface-lighter);
  margin: 6px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  cursor: pointer;
  text-align: left;
  transition: background-color var(--transition-fast);
}

.menu-item:hover {
  background: rgba(47, 111, 111, 0.12);
  transform: none;
}

.menu-item .mdi {
  font-size: 1.15rem;
  color: var(--color-primary);
}

.menu-item.logout {
  color: var(--color-danger);
}

.menu-item.logout .mdi {
  color: var(--color-danger);
}

.scale-enter-active,
.scale-leave-active {
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
  transform: scale(0.92) translateY(-8px);
  opacity: 0;
}
</style>
