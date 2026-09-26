import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("@/views/HomeView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/LoginView.vue"),
    meta: { requiresGuest: true },
  },
  {
    path: "/chores",
    name: "Chores",
    component: () => import("@/views/ChoresView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/logs",
    name: "Logs",
    component: () => import("@/views/LogsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    // Die Route /settings ist absichtlich entfernt. Sie war seit 5671fd
    // (Entfernen der Bottom-Nav) von keiner Stelle der UI mehr erreichbar —
    // die Bottom-Nav war ihr einziger Zugang — und damit toter Code. Der
    // Inhalt lebt jetzt im Settings-Modal (Home -> ☰ -> Settings), das die
    // Sektionen Notification/Appearance/Data/AI vollstaendig enthaelt.
    // Bewusst KEIN Redirect auf eine andere Route: das Modal ist kein
    // Adressierbares, ein Redirect wuerde ins Leere zeigen.
    path: "/settings",
    redirect: "/",
  },
  {
    path: "/ai",
    name: "AI",
    component: () => import("@/views/AIView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/catchup",
    name: "CatchUp",
    component: () => import("@/views/CatchUpView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/auth-callback",
    name: "AuthCallback",
    component: () => import("@/views/CallbackView.vue"),
    meta: { requiresGuest: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Check if route requires auth
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // Try to restore auth from localStorage
    await authStore.restoreAuth();

    if (!authStore.isAuthenticated) {
      next({ name: "Login", query: { redirect: to.fullPath } });
      return;
    }
  }

  // Check if route requires guest (already logged in)
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next({ name: "Home" });
    return;
  }

  next();
});

export default router;
