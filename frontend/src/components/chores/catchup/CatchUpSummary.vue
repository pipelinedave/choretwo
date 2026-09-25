<template>
  <!--
    Session-Ende. Befund D1: nach der letzten Chore 1300ms Success-Overlay, dann
    Auto-Redirect nach "/". Bei 50 Chores im Stapel fliegt man raus, egal wie
    viel uebrig ist — und der Redirect war ein Rennen gegen das Undo-Fenster,
    das in der Zeit von 4 Sekunden ablaeuft.

    Der Screen fragt die Entscheidung ab, statt sie zu treffen: "Weitere
    Runde" (Stapel neu laden, Zaehler zuruecksetzen) oder "Zur Uebersicht".
    Und er haelt das Rueckgaengigmachen offen: die letzte Aktion der Runde ist
    hier einen Knopf entfernt rueckgaengig — unabhaengig davon, ob der Toast
    schon weg ist.

    Die Wurzel traegt die Klasse `empty-state`: der Empty-State ist ein
    App-Konzept, darauf pruefen die E2E-Tests.
  -->
  <div class="empty-state catchup-summary">
    <div class="catchup-summary-hero" aria-hidden="true">
      <span class="mdi mdi-check-decagram"></span>
    </div>

    <h3 class="catchup-summary-title">Aufholen geschafft</h3>
    <p class="catchup-summary-sub">
      {{ summary.total }} {{ plural(summary.total, "Chore") }} in
      {{ formatDuration(summary.elapsedMs) }} abgearbeitet
    </p>

    <dl class="catchup-summary-stats">
      <div class="catchup-summary-stat">
        <dt>Erledigt</dt>
        <dd>{{ summary.done }}</dd>
      </div>
      <div class="catchup-summary-stat">
        <dt>Aufgeschoben</dt>
        <dd>{{ summary.snoozed }}</dd>
      </div>
      <div class="catchup-summary-stat">
        <dt>Offen</dt>
        <dd>{{ summary.remaining }}</dd>
      </div>
    </dl>

    <!-- Das Rueckwaertsfenster der Runde, unabhaengig vom Toast. -->
    <div v-if="lastEntry" class="catchup-summary-undo">
      <span class="mdi" :class="lastEntry.icon"></span>
      <span class="catchup-summary-undo-text">
        Zuletzt: {{ lastEntry.choreName }} {{ lastEntry.label }}
      </span>
      <button
        type="button"
        class="catchup-summary-undo-btn"
        :disabled="busy"
        @click="emit('undo', lastEntry.id)"
      >
        Rückgängig
      </button>
    </div>

    <div class="catchup-summary-actions">
      <button
        type="button"
        class="catchup-summary-btn is-primary"
        @click="emit('continue')"
      >
        <span class="mdi mdi-refresh"></span>
        Weitere Runde
      </button>
      <button
        type="button"
        class="catchup-summary-btn"
        @click="emit('exit')"
      >
        Zur Übersicht
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * Zusammenfassung einer abgeschlossenen Aufholen-Runde.
 *
 * Zustandslos wie die anderen Dialoge: Zahlen kommen als Prop, Aktionen als
 * Events. Die Zeit misst die View (sie kennt den Session-Start), hier wird
 * nur formatiert.
 */
defineProps({
  /**
   * @param {{done:number, snoozed:number, remaining:number, total:number,
   *          elapsedMs:number}} summary
   */
  summary: {
    type: Object,
    required: true,
  },
  /** Juengster Eintrag der Undo-Historie oder null. */
  lastEntry: { type: Object, default: null },
  /** Ein Undo laeuft gerade. */
  busy: { type: Boolean, default: false },
});

const emit = defineEmits(["continue", "exit", "undo"]);

const plural = (n, word) => (n === 1 ? word : `${word}n`);

/** mm:ss — bei unter einer Minute "0:42 min", sonst "12:05 min". */
const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} min`;
};
</script>

<style scoped>
.catchup-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--md-sys-spacing-xl) var(--md-sys-spacing-md)
    var(--md-sys-spacing-lg);
  color: var(--md-sys-color-on-surface-variant);
}

.catchup-summary-hero {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin-bottom: var(--md-sys-spacing-md);
  border-radius: var(--md-sys-radius-full);
  background: var(--color-success);
  color: var(--md-sys-color-inverse-on-surface);
  font-size: 3rem;
  animation: summaryPop var(--transition-slow) var(--motion-emphasized);
}

@keyframes summaryPop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.catchup-summary-title {
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 700;
  color: var(--md-sys-color-on-surface);
  margin-bottom: var(--md-sys-spacing-xs);
}

.catchup-summary-sub {
  margin: 0;
  font-size: var(--md-sys-typescale-body-medium);
  color: var(--color-text-muted);
}

.catchup-summary-stats {
  display: flex;
  gap: var(--md-sys-spacing-sm);
  width: 100%;
  max-width: 360px;
  margin: var(--md-sys-spacing-lg) 0 0;
}

.catchup-summary-stat {
  flex: 1;
  padding: var(--md-sys-spacing-sm);
  border-radius: var(--md-sys-radius-medium);
  background: var(--color-surface);
  border: var(--border-hairline) solid var(--color-border-glass);
}

.catchup-summary-stat dt {
  font-size: var(--md-sys-typescale-label-medium);
  color: var(--color-text-muted);
}

.catchup-summary-stat dd {
  margin: 2px 0 0;
  font-family: "Space Grotesk", sans-serif;
  font-size: var(--md-sys-typescale-headline-small);
  font-weight: 800;
  color: var(--color-primary);
}

.catchup-summary-undo {
  display: flex;
  align-items: center;
  gap: var(--md-sys-spacing-sm);
  width: 100%;
  max-width: 360px;
  margin-top: var(--md-sys-spacing-md);
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface-variant);
  color: var(--color-text);
  font-size: var(--md-sys-typescale-body-small);
}

.catchup-summary-undo .mdi {
  color: var(--color-primary);
  font-size: 1.1rem;
}

.catchup-summary-undo-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.catchup-summary-undo-btn {
  flex-shrink: 0;
  padding: 0 var(--md-sys-spacing-md);
  min-height: 32px;
  border: var(--border-hairline) solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: inherit;
  font-size: var(--md-sys-typescale-label-medium);
  font-weight: 700;
  cursor: pointer;
}

.catchup-summary-undo-btn:hover:not(:disabled) {
  background: var(--color-primary-subtle);
}

.catchup-summary-undo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.catchup-summary-actions {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
  width: 100%;
  max-width: 360px;
  margin-top: var(--md-sys-spacing-lg);
}

.catchup-summary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--md-sys-spacing-sm);
  width: 100%;
  min-height: 48px;
  border: var(--border-hairline) solid var(--color-border-glass);
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.catchup-summary-btn:hover {
  background: var(--color-surface-variant);
}

.catchup-summary-btn.is-primary {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-color: transparent;
}

.catchup-summary-btn.is-primary:hover {
  background: var(--color-primary-hover);
}
</style>
