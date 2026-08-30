<template>
  <div id="app">
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { onMounted } from "vue";

onMounted(() => {
  const savedTheme = localStorage.getItem("choretwo_theme") || "light";
  if (savedTheme === "dark" || (savedTheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
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
