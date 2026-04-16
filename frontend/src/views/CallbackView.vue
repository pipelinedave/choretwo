<template>
  <div class="callback-container">
    <LoadingSpinner message="Completing authentication..." />
  </div>
</template>

<script setup>
import LoadingSpinner from '@/components/layout/LoadingSpinner.vue'
</script>

<style scoped>
.callback-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
