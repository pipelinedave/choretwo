<template>
  <div id="app">
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!--
      Die Bottom-Nav ist App-Shell, nicht View-Inhalt: sie liegt ueber allen
      Routen. Sie war beim Header-Refactor aus der Seite gefallen — HomeView
      reserviert bis heute `padding-bottom: 90px`, exakt ihre Hoehe plus
      Safe-Area, und die E2E-Suite navigierte ueber ihre `a[href]`, die dadurch
      nie aufloesbar waren.
      Auf /login und /auth-callback gehoert sie nicht hin.
    -->
    <AppBottomNav v-if="showNav" />
  </div>
</template>

<script setup>
import { onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import AppBottomNav from "@/components/layout/AppBottomNav.vue";

const route = useRoute();

// Auth-Routen tragen keine Navigation.
const showNav = computed(
  () => route.path !== "/login" && route.path !== "/auth-callback",
);

onMounted(() => {
  const savedTheme = localStorage.getItem("choretwo_theme") || "light";
  if (
    savedTheme === "dark" ||
    (savedTheme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
});
</script>

<style>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}
</style>
