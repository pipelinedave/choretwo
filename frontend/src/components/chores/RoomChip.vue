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
    Custom-Property-Referenz, die dort nicht deklariert ist. Die Schrift-
    farbe wird aus der Flaeche berechnet (`readableInk`), damit der Chip
    in Light UND Dark Mode lesbar ist, ohne je eine Dark-Variante zu
    brauchen. Siehe utils/roomColor.js fuer die Begruendung.
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
import { readableInk } from "@/utils/roomColor";

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

const chipStyle = computed(() => {
  const bg = props.room?.color || "#c6e7dc";
  return {
    backgroundColor: bg,
    color: readableInk(bg),
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
  box-shadow: var(--room-chip-shadow);
  border: 1px solid rgb(0 0 0 / 0.12);
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
 */
.room-chip--personal {
  border-radius: var(--room-chip-radius) var(--room-chip-radius) 2px 2px;
  border-color: currentColor;
  border-width: 2px;
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
