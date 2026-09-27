<template>
  <!--
    Aktionsleiste unter der Karte. Befund A1: das Deck kannte nur die Geste
    (Swipe rechts = erledigen, Später-Button = aufschieben) und damit auf
    Desktop faktisch nur den Snooze-Pfad — mit der Maus kam niemand zu
    "erledigen", weil Mause-Swipe niemand macht. Die Geste bleibt der
    schnellste Weg, ist aber nicht mehr der einzige.

    Die Tastenkürzel stehen als sichtbare Hinweise auf den Knöpfen, weil die
    Tastatursteuerung sonst eine reine Doku-Angelegenheit wäre (Befund A2).

    Die Icons sind dieselben wie die des Swipe-Hinweises in CatchUpCard
    (mdi-check-bold / mdi-clock-outline): Geste, Tastatur und Knöpfe dürfen
    nicht drei Bildsprachen führen (Befund A5).
  -->
  <div class="catchup-actions" role="group" aria-label="Aktionen für die aktuelle Karte">
    <button
      type="button"
      class="catchup-action snooze-btn"
      :disabled="disabled"
      aria-keyshortcuts="2"
      @click="emit('snooze', chore)"
    >
      <span class="mdi mdi-clock-outline"></span>
      <span class="catchup-action-label">Später</span>
      <kbd class="catchup-action-key">2</kbd>
    </button>

    <button
      type="button"
      class="catchup-action done-btn"
      :class="{ 'is-pending': pending === 'done' }"
      :disabled="disabled"
      aria-keyshortcuts="1"
      @click="emit('done', chore)"
    >
      <ChoreSpinner
        v-if="pending === 'done'"
        inline
        variant="rocket_task"
      />
      <span v-else class="mdi mdi-check-bold"></span>
      <span class="catchup-action-label">Erledigen</span>
      <kbd class="catchup-action-key">1</kbd>
    </button>
  </div>
</template>

<script setup>
import ChoreSpinner from "@/components/layout/ChoreSpinner.vue";

/**
 * Sichtbare Aktionen fuer die oberste Karte des Aufholen-Decks.
 *
 * Bewusst KEIN Container fuer die Karten selbst: die Leiste kennt genau eine
 * Karte (`chore`, die aktive). Damit kann sie nicht in die Ein-Karte-plus-Peek-
 * Optimierung hineingreifen — sie steht als Geschwister unter dem Stapel und
 * wird genau einmal gerendert.
 */
defineProps({
  /** Die aktive Karte. Nur fuer den aria-Kontext und als Event-Payload. */
  chore: { type: Object, default: null },
  /**
   * "done" | "snooze" — welche Aktion gerade laeuft (Befund B3: `busyIds`
   * war ein No-Op, es gab weder Spinner noch Disabled-State). Leer = nichts
   * in Arbeit.
   */
  pending: { type: String, default: "" },
  /** Alles sperren (z. B. waehrend des Ladens oder bei Pause). */
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["done", "snooze"]);
</script>

<style scoped>
.catchup-actions {
  display: flex;
  align-items: stretch;
  gap: var(--md-sys-spacing-sm);
  width: 100%;
  max-width: 420px;
  margin: var(--md-sys-spacing-md) auto 0;
  /*
   * Umbruch erlaubt, damit die Leiste nie breiter wird als ihr Container.
   *
   * BEFUND: bei 150 % Systemschriftgroesse lief die CatchUp-Seite 127 px
   * ueber den Viewport. Ursache war diese Leiste: `scrollWidth 507` in
   * `clientWidth 348`. Die Buttons sind `flex: 1` und damit zwar shrinkbar,
   * aber ohne `min-width: 0` sinken sie nicht unter ihre Inhaltsbreite —
   * und ohne `flex-wrap` gab es keine zweite Zeile, in die sie ausweichen
   * koennten. Beides fehlte.
   */
  flex-wrap: wrap;
}

.catchup-action {
  flex: 1;
  /* Ohne das schrumpft der Button nicht unter die Breite seines Labels
     und die Leiste laeuft aus dem Container. */
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--md-sys-spacing-sm);
  /* min-height statt padding: WCAG 2.2 verlangt 24x24 CSS-px, die
     Tastatur-/Finger-Ziele dieser App sind mit 48px deutlich grosszuegiger. */
  min-height: 48px;
  padding: var(--md-sys-spacing-sm) var(--md-sys-spacing-md);
  border: var(--border-hairline) solid transparent;
  border-radius: var(--md-sys-radius-full);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color var(--md-sys-transition-fast),
    border-color var(--md-sys-transition-fast),
    color var(--md-sys-transition-fast);
}

.catchup-action .mdi {
  font-size: 1.2rem;
}

.catchup-action-label {
  /*
   * `nowrap` war hier die letzte Ursache fuer horizontalen Ueberlauf.
   *
   * BEFUND: bei 200 % Schriftgroesse lief /catchup noch 77 px ueber den
   * Viewport. Der Schuldige war das <kbd> mit der Tastenkuerzel-Ziffer, das
   * am rechten Rand eines Buttons sass — rechts daneben das Label mit
   * `white-space: nowrap`. Weil das Label nicht umbrach, konnte der Button
   * nicht schrumpfen, und der Button durfte wegen `min-width: 0` zwar
   * schrumpfen, sein Inhalt sprengte die Zeile trotzdem.
   *
   * Das Kuerzel selbst bleibt sichtbar — es ist ein Bedienhinweis, kein
   * Dekor. Weggelassen wird es nur, wenn der Platz wirklich nicht reicht:
   * `min-width: 0` erlaubt dem <kbd> das Schrumpfen, und da es nur eine
   * Ziffer enthaelt, kollabiert es auf die eigene Mindestbreite.
   */
  min-width: 0;
}

/* "Später": zurueckhaltend. Fuellt NICHT den Button, damit die beiden
   Aktionen nicht um Aufmerksamkeit konkurrieren — erledigen ist die
   Standardaktion, aufschieben der Ausweg. */
.snooze-btn {
  background: var(--color-surface);
  border-color: var(--color-border-glass);
  color: var(--color-text);
}

.snooze-btn:hover:not(:disabled) {
  background: var(--md-sys-color-tertiary-container);
  color: var(--md-sys-color-on-tertiary-container);
}

/* "Erledigen": gefuellt, es ist der haeufigste Fall. */
.done-btn {
  background: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
}

.done-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

/* Pending: der Spinner ersetzt das Icon, das Label tritt zurueck, damit der
   Zustand an EINER Stelle steht und nicht an zwei konkurrierenden. Vorher
   war `.is-pending` im Template gesetzt, aber im CSS nirgends verwendet —
   ein totes Klassen-Binding. */
.done-btn.is-pending .catchup-action-label,
.done-btn.is-pending .catchup-action-key {
  opacity: 0.75;
}

.catchup-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

/* Tastenkuerzel als sichtbarer Hinweis. Kein Rahmen, keine Flaeche: es
   soll als Ziffer lesbar sein, nicht als weiterer Knopf. */
.catchup-action-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /*
   * `min-width: 0` statt `min-width: 20px`: die 20 px waren eine feste
   * Untergrenze, die den Button nicht schrumpfen liess. Mit 0 kann das
   * Kuerzel bei extrem grosser Schrift auf seine Zifferbreite zusammenfallen
   * (siehe Kommentar bei `.catchup-action-label`). Fuer die normale
   * Anzeigegroesse von 20 px ist das ohne sichtbare Aenderung.
   */
  min-width: 0;
  flex-shrink: 1;
  height: 20px;
  padding: 0 5px;
  border-radius: var(--md-sys-radius-small);
  background: var(--color-surface-overlay-soft);
  font-family: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  opacity: 0.85;
}

.done-btn .catchup-action-key {
  /* Auf der gefuellten Flaeche waere die weiche Kachel unlesbar. */
  background: rgb(var(--md-sys-color-white-rgb) / 0.22);
  color: inherit;
}

/* Ueberschreibt die globale `.spinner`-Regel: dort stehen Rand und
   Vorderkante auf Primary-Tokens, auf der gefuellten Primary-Flaeche waere
   der Spinner unsichtbar. Stattdessen folgt er `currentColor` und laesst
   nur die Vorderkante offen. */
.catchup-action-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
}

@media (prefers-contrast: more) {
  .snooze-btn {
    border-color: var(--md-sys-color-outline);
  }
}
</style>
