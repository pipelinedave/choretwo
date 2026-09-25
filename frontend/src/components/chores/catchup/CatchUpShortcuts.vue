<template>
  <Teleport to="body">
    <div class="shortcuts-overlay" @click.self="emit('close')">
      <div
        class="shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="catchup-shortcuts-title"
      >
        <h3 id="catchup-shortcuts-title" class="shortcuts-title">
          <span class="mdi mdi-keyboard-outline"></span>
          Tastatur
        </h3>

        <dl class="shortcuts-list">
          <div v-for="entry in shortcuts" :key="entry.keys" class="shortcuts-row">
            <dt class="shortcuts-keys">
              <kbd v-for="key in entry.keys" :key="key">{{ key }}</kbd>
            </dt>
            <dd class="shortcuts-text">{{ entry.text }}</dd>
          </div>
        </dl>

        <p class="shortcuts-hint">
          <span class="mdi mdi-gesture-swipe-horizontal"></span>
          Ohne Tastatur: nach rechts wischen = erledigen, nach links oder nach
          oben = aufschieben.
        </p>

        <button type="button" class="shortcuts-close" @click="emit('close')">
          Alles klar
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * Kurzhilfe fuer das Aufholen-Deck (Befund A2).
 *
 * Bewusst als Dialog mit `aria-modal` und nicht als Tooltip am Knopf: die
 * Taste "?" loest ihn aus, der Fokus wandert beim Schliessen nicht
 * zusaetzlich herum. `Escape` schliesst ihn ueber den Tastatur-Handler der
 * View, nicht ueber einen eigenen keydown-Handler — dieselbe Quelle wie beim
 * Snooze-Sheet.
 */
defineProps({
  /** Die Belegung, damit Anzeige und Tastatur-Handler nicht auseinanderlaufen. */
  shortcuts: {
    type: Array,
    default: () => [
      { keys: ["Eingabe"], text: "Aktuelle Chore erledigen" },
      { keys: ["Leertaste"], text: "Aktuelle Chore erledigen" },
      { keys: ["1"], text: "Aktuelle Chore erledigen" },
      { keys: ["2"], text: "Aktuelle Chore aufschieben" },
      { keys: ["Esc"], text: "Offenes Fenster schließen" },
      { keys: ["?"], text: "Diese Übersicht" },
    ],
  },
});

const emit = defineEmits(["close"]);
</script>

<style scoped>
.shortcuts-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--md-sys-zindex-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-sys-spacing-md);
  background: var(--color-overlay-scrim);
}

.shortcuts-dialog {
  width: 100%;
  max-width: 420px;
  padding: var(--md-sys-spacing-lg);
  border-radius: var(--md-sys-radius-extra-large);
  background: var(--color-surface);
  border: var(--border-hairline) solid var(--color-border-glass);
  box-shadow: var(--md-sys-elevation-3);
  color: var(--color-text);
}

.shortcuts-title {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  font-size: var(--md-sys-typescale-title-large);
  font-weight: 700;
  margin: 0 0 var(--md-sys-spacing-md);
}

.shortcuts-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
}

.shortcuts-row {
  display: flex;
  align-items: baseline;
  gap: var(--md-sys-spacing-md);
}

.shortcuts-keys {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  min-width: 104px;
}

.shortcuts-keys kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--md-sys-spacing-sm);
  border-radius: var(--md-sys-radius-small);
  border: var(--border-hairline) solid var(--md-sys-color-outline-variant);
  background: var(--color-surface-variant);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
}

.shortcuts-text {
  margin: 0;
  font-size: var(--md-sys-typescale-body-medium);
  color: var(--color-text-muted);
}

.shortcuts-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--md-sys-spacing-sm);
  margin: var(--md-sys-spacing-md) 0 0;
  padding-top: var(--md-sys-spacing-sm);
  border-top: var(--border-hairline) solid
    var(--color-border-glass-subtle);
  font-size: var(--md-sys-typescale-body-small);
  color: var(--color-text-muted);
}

.shortcuts-close {
  width: 100%;
  margin-top: var(--md-sys-spacing-md);
  min-height: 44px;
  border: none;
  border-radius: var(--md-sys-radius-full);
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.shortcuts-close:hover {
  background: var(--color-primary-hover);
}
</style>
