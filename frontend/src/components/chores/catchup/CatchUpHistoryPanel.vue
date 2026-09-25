<template>
  <Teleport to="body">
    <div class="history-overlay" @click.self="emit('close')">
      <div
        class="history-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catchup-history-title"
      >
        <div class="history-head">
          <h3 id="catchup-history-title" class="history-title">
            <span class="mdi mdi-undo-variant"></span>
            Verlauf dieser Runde
          </h3>
          <button
            type="button"
            class="history-close"
            aria-label="Verlauf schließen"
            @click="emit('close')"
          >
            <span class="mdi mdi-close"></span>
          </button>
        </div>

        <p v-if="!entries.length" class="history-empty">
          In dieser Runde wurde noch nichts abgearbeitet.
        </p>

        <ol v-else class="history-list">
          <li v-for="entry in entries" :key="entry.id" class="history-row">
            <span class="mdi history-icon" :class="entry.icon"></span>
            <span class="history-name">{{ entry.choreName }}</span>
            <span class="history-kind">{{ entry.label }}</span>
            <button
              type="button"
              class="history-undo"
              :disabled="busyId === entry.id"
              @click="emit('undo', entry.id)"
            >
              Rückgängig
            </button>
          </li>
        </ol>

        <p v-if="entries.length" class="history-hint">
          <kbd>u</kbd>
          nimmt die letzte Aktion zurück, <kbd>Esc</kbd> schließt dieses Fenster.
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * Undo-Historie einer Aufholen-Runde (Befund B5).
 *
 * Vorher gab es nur den Toast der LETZTEN Aktion (4s). Bei zehn schnellen
 * Swipes war der Toast lange weg, die Runde aber nicht — rueckwaerts ging
 * nichts mehr. Diese Liste haelt die letzten N Aktionen der Session und macht
 * sie einzeln rueckgaengig.
 *
 * Bewusst zustandslos: Eintraege kommen als Prop, Undo als Event. Die Logik
 * (welche Aktion rueckgaengig machbar ist, wie der Server-Zustand
 * wiederhergestellt wird) liegt in der View, nicht in der Anzeige.
 */
defineProps({
  /** Neueste zuerst. */
  entries: { type: Array, default: () => [] },
  /** ID des Eintrags, dessen Undo gerade laeuft. */
  busyId: { type: Number, default: null },
});

const emit = defineEmits(["close", "undo"]);
</script>

<style scoped>
.history-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--md-sys-zindex-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-md);
  background: var(--color-overlay-scrim);
}

.history-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  padding: var(--md-sys-spacing-lg);
  border-radius: var(--md-sys-radius-extra-large);
  background: var(--color-surface);
  border: var(--border-hairline) solid var(--color-border-glass);
  box-shadow: var(--md-sys-elevation-3);
  color: var(--color-text);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--md-sys-spacing-sm);
  margin-bottom: var(--md-sys-spacing-md);
}

.history-title {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  font-size: var(--md-sys-typescale-title-large);
  font-weight: 700;
  margin: 0;
}

/* Icon-Knopf, aber ohne die globale `.btn-icon`-Optik zu erben: der Dialog
   traegt die Flaeche, ein zweites Glas-Kreuz daneben waere Rauschen. */
.history-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-button-size);
  height: var(--icon-button-size);
  border: none;
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface-variant);
  color: var(--color-text);
  cursor: pointer;
}

.history-close:hover {
  background: var(--color-primary-subtle);
}

.history-empty {
  margin: 0;
  padding: var(--md-sys-spacing-lg) 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--md-sys-typescale-body-medium);
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-xs);
}

.history-row {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  padding: var(--md-sys-spacing-sm);
  border-radius: var(--md-sys-radius-medium);
  background: var(--color-surface-variant);
}

.history-icon {
  font-size: 1.2rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.history-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  font-size: var(--md-sys-typescale-body-medium);
}

.history-kind {
  font-size: var(--md-sys-typescale-label-medium);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.history-undo {
  flex-shrink: 0;
  min-height: 32px;
  padding: 0 var(--md-sys-spacing-md);
  border: var(--border-hairline) solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: var(--md-sys-typescale-label-medium);
  font-weight: 700;
  cursor: pointer;
}

.history-undo:hover:not(:disabled) {
  background: var(--color-primary-subtle);
}

.history-undo:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.history-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: var(--md-sys-spacing-md) 0 0;
  font-size: var(--md-sys-typescale-body-small);
  color: var(--color-text-muted);
}

.history-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: var(--md-sys-radius-small);
  border: var(--border-hairline) solid var(--md-sys-color-outline-variant);
  background: var(--color-surface-variant);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 700;
}
</style>
