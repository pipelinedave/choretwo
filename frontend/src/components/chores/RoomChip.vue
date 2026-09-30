<template>
  <!--
    Der Raum-Chip.

    WENN `room` fehlt, rendert die Komponente gar nichts — kein leerer
    Platzhalter, keine Reserve. Das ist die Optionalitaets-Anforderung:
    ein Chore ohne Raum sieht exakt aus wie vor dem Feature.

    Die Raumfarbe kommt aus der DB und wird als INLINE-STYLE gesetzt,
    nicht per CSS-Custom-Property. Grund: es gibt pro Raum beliebig viele
    Farben, die lassen sich nicht als Tokens in `:root` abbilden —
    und `tests/unit/styles/design-tokens.spec.js` failt auf jede
    Custom-Property-Referenz, die dort nicht deklariert ist. Aus der
    Flaeche werden gleich drei Farben BERECHNET (`roomPalette` in
    utils/roomColor.js): die Schrift, und die Kontur als dieselbe
    Raumfarbe, eine halbe Stufe tiefer. Dadurch traegt der Chip die
    Rauminformation an BEIDEN Kanten — Flaeche UND Rand — und ist in
    Light UND Dark Mode lesbar, ohne je eine Dark-Variante zu brauchen.
    Siehe utils/roomColor.js fuer die Begruendung und die Messwerte.
  -->
  <span
    v-if="room"
    class="room-chip"
    :class="{
      'room-chip--personal': isPersonal,
      'room-chip--compact': compact,
    }"
    :style="chipStyle"
    :title="chipTitle"
  >
    <span class="mdi room-chip__icon" :class="`mdi-${room.icon}`"></span>
    <span class="room-chip__label">{{ room.name }}</span>
  </span>
</template>

<script setup>
import { computed } from "vue";
import { roomPalette } from "@/utils/roomColor";

const props = defineProps({
  /**
   * Der Kurzdatensatz aus der Chore-Response:
   * `{ id, name, color, icon, is_personal }`. Fehlt er, rendert nichts.
   */
  room: { type: Object, default: null },
  /**
   * Blendet den Raumnamen aus und laesst nur das Icon stehen. fuer
   * enge Zeilen (z.B. Listen mit fixem Durchmesser). Der Name bleibt
   * im `title`-Attribut lesbar.
   */
  compact: { type: Boolean, default: false },
});

const isPersonal = computed(
  () => !!(props.room?.is_personal ?? props.room?.isPersonal),
);

/*
 * Eine Quelle fuer alle drei Farben. Die Komponente enthaelt bewusst KEINE
 * eigene Mischlogik — `roomPalette` ist dieselbe Funktion, die auch der
 * Raum-Filter benutzt (RoomFilterPills.vue), damit ein Raum in Karte und
 * Filter nicht nur aehnlich, sondern identisch aussieht.
 */
const chipStyle = computed(() => {
  const { fill, ink, edge } = roomPalette(props.room?.color);
  return {
    backgroundColor: fill,
    color: ink,
    borderColor: edge,
  };
});

const chipTitle = computed(() => {
  if (!props.room) return "";
  return isPersonal.value ? `${props.room.name} — persönlich` : props.room.name;
});
</script>

<style scoped>
.room-chip {
  /*
   * Eigene Form, damit der Chip sich vom Chore-Titel (Fliesstext) und
   * vom Checkbox-Kreis abhebt. Die Geometrie kommt aus den Tokens, damit
   * sie sich an die Radius-Achse des Systems haelt.
   */
  display: inline-flex;
  align-items: center;
  gap: var(--room-chip-gap);
  padding: var(--room-chip-padding-y) var(--room-chip-padding-x);
  border-radius: var(--room-chip-radius);
  font-size: var(--room-chip-font-size);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;

  /*
   * `text-shadow: none` ist hier KEIN Dekor, sondern Pflicht.
   *
   * `.chore-left` in ChoreCard.vue traegt einen Text-Halo in der
   * Dringlichkeitsfarbe (`text-shadow: 0 0 6px var(--chore-bg)`), damit
   * der Titel gegen das Motiv lesbar bleibt. Der Chip ist aber eine
   * gefuellte Flaeche — ein Halo in Kartenfarbe wuerde um ihn herum
   * einen farbigen Schein legen und die Kante aufloesen. Deshalb
   * ausdruecklich zurueckgesetzt.
   */
  text-shadow: none;

  /*
   * Die Kontur. `border-color` kommt per Inline-Style aus `roomPalette` —
   * sie IST die Raumfarbe, eine halbe Stufe tiefer. Der Fallback hier ist
   * nur die Silhouette fuer den theoretischen Fall, dass der Inline-Wert
   * fehlt (kein Raum-Objekt); er ist bewusst der Glas-Border der App und
   * NICHT wieder Schwarz, denn genau das war der Befund.
   */
  border: var(--room-chip-border-width) solid var(--color-border-glass-subtle);

  /*
   * Zwei Schatten, zwei Aufgaben:
   *   `--room-chip-shadow`  Tiefe (nur im Light Mode sichtbar — im Dark
   *                         Mode ist das Shadow-Triplet schwarz).
   *   `--room-chip-inset`   innere Lichtkante. Sie liegt INNEN, ihr
   *                         Kontrast gilt also gegen die Flaeche des
   *                         Chips statt gegen die Karte — dadurch ist sie
   *                         in beiden Themes gleichermassen sichtbar.
   */
  box-shadow: var(--room-chip-shadow), var(--room-chip-inset);
  flex-shrink: 0;
}

/*
 * SPEZIALBEHANDLUNG "Dave" (is_personal)
 * ---------------------------------------
 * Die Anforderung war ausdruecklich: der Personen-Raum ist "nicht nur
 * ein weiterer Raum, sondern speziell markiert". Drei Merkmale, alle
 * zusammen, damit er auch auf dem Daumennagel am Handy erkennbar ist:
 *
 *   1. Andere Form  — oben spitz statt pillenfoermig (Hut-Silhouette).
 *   2. Doppelter Rand — aussen die Raumfarbe, innen die Schriftfarbe.
 *   3. Fett gesetzter Name, Icon etwas groesser.
 *
 * Wichtig: die SPEZIALBEHANDLUNG ist ein ZUSATZ zur Raumfarbe, nicht ihr
 * Ersatz. `is_personal` heisst nicht "immer braun" — der Raumfarbwert
 * bleibt der des Nutzers, die Form und der Rand machen ihn zum
 * Sonderfall. Wer "Dave" auf Salbei setzt, bekommt einen salbeifarbenen
 * Hut-Chip, nicht einen braunen.
 *
 * Harmonisierung mit der neuen Farbleiter-Stufe (Aufgabe 1): der
 * Aussenrand ist jetzt wie bei jedem Chip die Raum-Kontur aus
 * `roomPalette` (Inline-Style, 2px statt 1px), und der Innenring ist
 * `currentColor` — also die Schriftfarbe, die das Inline-Style ebenfalls
 * setzt. Damit ist der doppelte Rand erstmals wirklich doppelt: vorher
 * gab es nur einen einzigen, dicken Rand in der Schriftfarbe und keinen
 * Raumton darin. Der Farbton ist der Primaertraeger, die Spezialbehandlung
 * addiert Form und Ring, ohne die Raumfarbe zu ueberstimmen.
 */
.room-chip--personal {
  border-radius: var(--room-chip-radius) var(--room-chip-radius)
    var(--room-chip-personal-tip-radius) var(--room-chip-personal-tip-radius);
  border-width: var(--room-chip-personal-border-width);
  box-shadow:
    var(--room-chip-shadow),
    var(--room-chip-inset),
    inset 0 0 0 var(--room-chip-personal-ring-width) currentColor;
  font-weight: 700;
}

.room-chip--personal .room-chip__icon {
  font-size: 1.05em;
}

.room-chip__icon {
  font-size: 0.95em;
  line-height: 1;
  flex-shrink: 0;
}

.room-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Nur das Icon, wenn der Name in engen Zeilen nichts mehr beitraegt. */
.room-chip--compact .room-chip__label {
  display: none;
}

.room-chip--compact {
  padding: var(--room-chip-padding-y) var(--room-chip-padding-x);
}
</style>
