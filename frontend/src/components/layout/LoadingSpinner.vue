<template>
  <ChoreSpinner
    :inline="inline"
    :label="message"
    :variant="variant"
    :context="context"
    :size="inline ? 'sm' : 'md'"
  />
</template>

<script setup>
import ChoreSpinner from "./ChoreSpinner.vue";

defineProps({
  inline: {
    type: Boolean,
    default: false,
  },
  message: {
    type: String,
    default: "",
  },
  variant: {
    type: String,
    default: "",
  },
  context: {
    type: String,
    default: "chores",
  },
});
</script>
