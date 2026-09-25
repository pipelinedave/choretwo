<template>
  <!--
    Leerer-Zustand des Aufholen-Decks.

    Warum eine eigene Komponente statt `EmptyState` (das ist ausserhalb des
    File-Scopes dieser Aenderung): `EmptyState.vue` hat keinen `<slot />`.
    Der `#icon`-Slot, den die CatchUpView schon vorher uebergab, wird
    deshalb seit jeher verworfen — das harte `mdi-clipboard-list-outline`
    steht fest im Template. Fuer "Filter zurücksetzen" braucht es aber einen
    zweiten Knopf, und `EmptyState` bietet mit `showAddButton` genau einen
    fest benannten ("Add Your First Chore", englisch).

    Die Wurzel traegt bewusst die Klasse `empty-state`: der Empty-State ist
    ein App-Konzept, nicht nur eine Optik, und darauf pruefen die E2E-Tests.
    Folgearbeit: `<slot />` in `EmptyState.vue` ergaenzen und diese Komponente
    dort zusammenlegen.
  -->
  <div class="empty-state catchup-empty">
    <div class="catchup-empty-icon" aria-hidden="true">
      <span class="mdi" :class="icon"></span>
    </div>
    <h3 class="catchup-empty-title">{{ title }}</h3>
    <p class="catchup-empty-text">{{ message }}</p>
    <button
      v-if="actionLabel"
      type="button"
      class="catchup-empty-action"
      @click="emit('action')"
    >
      <span class="mdi" :class="actionIcon"></span>
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup>
/**
 * Leerer Zustand mit optionaler Aktion — deckt die Faelle "nichts zu tun"
 * (Aktion: Chore anlegen) und "Filter blendet alles aus" (Aktion: Filter
 * zuruecksetzen) ab.
 */
defineProps({
  icon: { type: String, default: "mdi-check-circle-outline" },
  title: { type: String, required: true },
  message: { type: String, default: "" },
  /** Beschriftung des Knopfes. Ohne Label kein Knopf. */
  actionLabel: { type: String, default: "" },
  actionIcon: { type: String, default: "" },
});

const emit = defineEmits(["action"]);
</script>

<style scoped>
.catchup-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-2xl) var(--md-sys-spacing-md);
  text-align: center;
  color: var(--md-sys-color-on-surface-variant);
}

.catchup-empty-icon {
  margin-bottom: var(--md-sys-spacing-md);
  font-size: 64px;
  opacity: 0.5;
  color: var(--color-primary);
}

.catchup-empty-title {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin-bottom: var(--md-sys-spacing-xs);
}

.catchup-empty-text {
  font-size: var(--md-sys-typescale-body-medium);
  margin: 0;
  max-width: 320px;
}

.catchup-empty-action {
  margin-top: var(--md-sys-spacing-lg);
  min-height: 44px;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-lg);
  border: none;
  border-radius: var(--md-sys-radius-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.catchup-empty-action:hover {
  background: var(--color-primary-hover);
}
</style>
