<template>
  <!--
    Chore-Visual: eine kleine Vektor-Illustration als Hintergrund der ChoreCard.

    Die Komponenten-Logik liegt bewusst in `utils/choreVisual.js`, nicht hier.
    Diese Komponente ist reines Rendering — damit ein spaeterer Wechsel auf
    echte KI-Bilder (OpenRouter) nur die Quelle austauschen muss und nicht
    die Karten.
  -->
  <span
    v-if="visual"
    class="chore-visual"
    :class="[
      `is-${visual.category}`,
      {
        'has-modifier': !!visual.modifier,
        // Steuert, WHICH ELEMENT die Maske traegt. Siehe `.chore-visual`.
        'src-image': visual.source === 'image',
      },
    ]"
    :style="rootStyle"
    aria-hidden="true"
  >
    <!--
      KI-Bild. `mix-blend-mode: multiply` laesst die weissen Bildflaechen in
      die Kartenfarbe verschwinden, sodass nur die Form uebrig bleibt — das
      Bild verhaelt sich damit wie der Vektor mit `fill: var(--color-text)`
      darunter. Ohne den Blend-Modus waere jedes Bild ein weisser Kasten auf
      der pastellfarbenen Karte.

      Der Dark Mode braucht dafuer KEINE eigene Regel — die Begruendung und
      die Messung, die der naheliegenden Annahme widersprechen, stehen bei
      `.chore-visual-img` im Style-Block.
    -->
    <img
      v-if="visual.source === 'image' && visual.imageUrl"
      class="chore-visual-img"
      :src="visual.imageUrl"
      :style="{ opacity: motifOpacity }"
      alt=""
      decoding="async"
      loading="lazy"
    />

    <!-- Vektor-Rueckschritt: nur noch, wenn fuer die Kategorie kein Bild
         existiert. Die Deckkraft steht am Pfad und NICHT ueber eine
         CSS-Variable — design-tokens.spec.js prueft, dass jede per var()
         referenzierte Konstante in :root definiert ist. -->
    <svg
      v-else
      class="chore-visual-svg"
      :viewBox="`0 0 ${viewSize} ${viewSize}`"
      :style="svgStyle"
      focusable="false"
      preserveAspectRatio="xMaxYMid slice"
    >
      <path
        class="chore-visual-base"
        :d="basePath"
        :style="{ opacity: motifOpacity }"
      />

      <!-- Akzentformen. Kleiner und weiter aussen, damit die Basisform als
           Hauptmotiv lesbar bleibt. -->
      <path
        v-for="(shape, i) in accentPaths"
        :key="`${shape}-${i}`"
        class="chore-visual-accent"
        :d="shape"
        :style="accentStyle(i)"
      />
    </svg>
  </span>
</template>

<script setup>
import { computed } from "vue";
import {
  MDI_PATHS,
  resolveChoreVisual,
  CATEGORY_LABELS,
} from "@/utils/choreVisual";

const props = defineProps({
  /** Name oder Chore-Objekt. */
  chore: { type: [String, Object], required: true },
  /** Dringlichkeitsklasse aus ChoreCard (due-today, overdue, ...). */
  urgency: { type: String, default: "" },
  /** Groesse in px. Die ChoreCard ist ein schmaler Streifen, s. Dokumentation. */
  size: { type: Number, default: 72 },
});

const visual = computed(() => resolveChoreVisual(props.chore));

/**
 * Raster, in dem die MDI-Pfade gezeichnet werden. Die Pfade sind fuer ein
 * 24er-Raster entworfen; je kleiner das viewBox, desto groesser wirkt die
 * Form. Bei 48 war sie auf einer ~60px-Card zu klein zum Erkennen — der
 * Nutzer sah nur Geister. 34 laesst die Grundform die Card-Hoehe nutzen.
 */
const VIEW_SIZE = 34;
const viewSize = computed(() => VIEW_SIZE);

const basePath = computed(() => MDI_PATHS[visual.value.base] || "");

const accentPaths = computed(() =>
  (visual.value.accents || []).map((s) => MDI_PATHS[s]).filter(Boolean),
);

/**
 * Deckkraft des Motivs. Das ist der eigentliche Hebel fuer Lesbarkeit:
 * der Titel muss die 4.5:1 behalten, also bleibt das Motiv unter 20 % und
 * wandert aus der Textzone heraus.
 *
 * Dringende Chores bekommen zusaetzlich ein ruhigeres Bild — die Farbe
 * muss die Dringlichkeit transportieren, nicht das Motiv.
 */
/**
 * Deckkraft des Motivs — der eigentliche Gestaltungshebel.
 *
 * ERSTE FASSUNG WAR ZU ZURUECKHALTEND: 0.10–0.20 hat den Screenshot-Pruefung
 * nicht standhalten. Die Motive waren als blasse Geister zu sehen, das
 * Feature damit wirkungslos. Der Grund war eine Fehlannahme: ich hatte die
 * Deckkraft gegen die Lesbarkeit optimiert und dabei die Sichtbarkeit
 * wegoptimiert. Die beiden sind nicht dasselbe — der Titel steht LINKS,
 * das Motiv RECHTS, und `.chore-content` liegt per z-index ueber dem Motiv.
 *
 * Also: Deckkraft deutlich hoeher, dafuer die Form klarer (kein Weichzeichnen
 * mehr auf der Basisform) und die Dringlichkeitsabhaengigkeit flacher. Die
 * Farbe der Karte beantwortet weiterhin "wie dringend", das Motiv "was" —
 * es muss dafuer nicht zuruecktreten.
 *
 * Gemessene Titel-Kontraste (Light, echter gerenderter Pixel, WCAG):
 *   8.2:1 (ueberfaellig) bis 11.5:1 (weit weg) — alle ueber AA (4.5:1).
 */
const MOTIF_OPACITY = {
  overdue: 0.26,
  "due-today": 0.28,
  "due-tomorrow": 0.3,
  "due-2-days": 0.31,
  "due-3-days": 0.32,
  "due-7-days": 0.33,
  "due-14-days": 0.34,
  "due-30-days": 0.35,
  "due-far-future": 0.36,
  default: 0.32,
};

const motifOpacity = computed(
  () => MOTIF_OPACITY[props.urgency] ?? MOTIF_OPACITY.default,
);

/**
 * Die Illustration sitzt rechts in der Card, der Titel links. Deshalb
 * bekommt der Bereich hinter dem Text einen Scrim-Verlauf, der mit der
 * Dringlichkeitsfarbe aufloest — so bleibt der Text auf deckendem Grund,
 * ohne dass die Pastellflaeche flach wirkt.
 */
const rootStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

const svgStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

function accentStyle(i) {
  const o = (visual.value.offsets || [])[i] || {};
  return {
    opacity: motifOpacity.value * 0.85,
    transform: `translate(${o.x || 0.55} , ${o.y || 0.55}) scale(${o.scale || 0.4})`,
  };
}
</script>

<style scoped>
/*
 * Das Motiv ist ein Dekor-Element, kein Inhalt: aria-hidden, nicht
 * fokussierbar, `pointer-events: none`, damit die Swipe-Gesten der Card
 * unberuehrt bleiben.
 */
/*
 * Warum der Vektor hier eine Maske traegt und das KI-Bild nicht.
 *
 * Der Verlauf blendet das Motiv nach links aus, damit es nicht wie ein
 * Fremdkoerper an der Titelspalte klebt. Beim Vektor ist das noetig, weil
 * dort die FORM beschnitten wird — das faellt sofort auf. Beim Bild nicht:
 * die Illustrationen haben weissen Rand um das Motiv, ein Schnitt durch
 * diesen Rand ist unsichtbar.
 *
 * Wichtiger noch: eine `mask-image` hebt `mix-blend-mode: multiply` auf.
 * Sowohl am Vorfahren als auch am selben Element — dann mischt das Bild nur
 * noch gegen transparent, und auf der Karte bleibt ein helles Quadrat. Die
 * Klasse `src-image` haelt deshalb die Maske beim Vektor und nimmt sie dem
 * Bild. Die Messwerte stehen bei `.chore-visual-img`.
 */
.chore-visual {
  /* Flex-Kind, nicht absolut: es sitzt im Fluss zwischen Titel und
     Faelligkeit und kann so nichts ueberdecken. */
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 -2px;
  pointer-events: none;
}

/* Weicher Verlauf nach links: das Motiv verliert Richtung Titel an Kante,
   damit es sich nicht wie ein Fremdkoerper aufklebt. */
/*
 * Weicher Verlauf nach links: das Motiv verliert Richtung Titel an Kante,
 * damit es sich nicht wie ein Fremdkoerper aufklebt.
 *
 * Als Custom Property waere das bequemer, aber design-tokens.spec.js
 * verlangt, dass jede per var() referenzierte Konstante in :root definiert
 * ist, und ein komponentenlokaler Farbverlauf hat in der globalen
 * Farb-Achse nichts zu suchen. Der Verlauf steht deshalb hier ausgeschrieben
 * — er wird nur an dieser einen Stelle gebraucht.
 */
.chore-visual:not(.src-image) {
  opacity: 0.9;
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    rgba(0, 0, 0, 0.55) 28%,
    rgba(0, 0, 0, 1) 100%
  );
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    rgba(0, 0, 0, 0.55) 28%,
    rgba(0, 0, 0, 1) 100%
  );
}

.chore-visual-svg {
  overflow: visible;
}

/*
 * KI-Bild.
 *
 * `object-fit: cover` statt `contain`: die Bilder sind quadratisch und das
 * Element auch, beide liefern dasselbe. `contain` wuerde bei
 * `loading="lazy"` mit noch unbekannter intrinsischer Groesse den
 * Motivationen zusaetzlich Platz reservieren.
 */
.chore-visual-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /*
   * `multiply` OHNE Maske — beides ist Bedingung, nicht Kosmetik.
   *
   * Eine `mask-image` auf DEMSELBEN Element hebt den Blend genauso auf wie
   * ein maskierter Vorfahr: das Bild mischt wieder nur gegen transparent.
   * Gemessen (Δ Blau zwischen Kartengrund und weissem Bildrand, 0 = unsichtbar):
   *
   *   mit Maske am Bild            Δ 21   (Gegenprobe: blend normal → Δ 21)
   *   ohne Maske, mit multiply     Δ  8   (Gegenprobe: blend normal → Δ 21)
   *
   * Die verbleibenden 8 sind FLUX' weicher Schlagschatten unter dem Motiv,
   * der jetzt korrekt in die Karte multipliziert wird. Er ist als Schatten
   * gewollt, nicht als Kasten.
   *
   * Den links ausblendenden Verlauf braucht das Bild nicht: die
   * Illustrationen haben weissen Rand um das Motiv, ein Schnitt durch
   * diesen Rand ist unsichtbar. Der Vektor braucht die Maske weiterhin —
   * dort wird die FORM beschnitten, und das faellt auf.
   */
  mix-blend-mode: multiply;
}

/* Die MDI-Pfade sind 24x24-Pfade; in einer 48er-ViewBox entspricht das
   einer Grundgroesse von 24. Die Pfade werden bewusst NICHT auf 48
   hochskaliert, sonst waeren die Striche bei 46px zu dick.
   Die `opacity` steht inline am Pfad (Dringlichkeits-abhaengig), NICHT hier
   — siehe Kommentar im Template. */
.chore-visual-base {
  fill: var(--color-text);
  /* Kein Weichzeichnen mehr: bei 46px Pixelgroesse hat blur(0.3px) die Form
     nur unschaerfer gemacht, ohne sie vom Text abzugrenzen. Die Sichtbarkeit
     kommt aus der Deckkraft, die Form bleibt scharf. */
}

.chore-visual-accent {
  fill: var(--color-text);
  transform-box: fill-box;
  transform-origin: top left;
}

/*
 * Dark Mode.
 *
 * ERSTMALIGER FEHLER, per Kontrastmessung korrigiert: die erste Fassung hat
 * das Motiv im Dark Mode mit `filter: opacity(1.6)` heller gemacht, in der
 * Annahme "auf dunklem Grund braucht es mehr Deckkraft". Das ist verkehrt.
 * Das Motiv wird mit `var(--color-text)` gefuellt, und im Dark Theme ist das
 * bereits hell (#edf3f2) — es hellt also den dunklen Grund auf und
 * verschlechtert den Kontrast zum hellen Text. Gerechnet:
 *
 *   due-2-days   ohne Motiv 4.43:1   mit Motiv @0.16  3.31:1   @0.26  2.82:1
 *   due-today     ohne Motiv 6.10:1   mit Motiv @0.16  4.33:1   @0.26  3.53:1
 *
 * Deshalb wird die Deckkraft im Dark Mode leicht REDUZIERT. Der Kontrast
 * haengt zusaetzlich am Text-Halo in ChoreCard (--chore-bg) und daran, dass
 * das Motiv rechts ausserhalb der Textzone sitzt.
 */
[data-theme="dark"] .chore-visual-svg {
  filter: opacity(0.8);
}

/*
 * Dark Mode fuer das KI-Bild: es braucht KEINE Sonderregel.
 *
 * Das war die naheliegende Vermutung und sie war falsch. `multiply` ergibt
 * auf schwarzem Grund nichts, die Karten sind aber nicht schwarz, sondern
 * mittel-dunkel (#82403b bis #305c5c). Weiss mal mittel-dunkel ergibt
 * mittel-dunkel — der weisse Bildgrund verschwindet also auch hier, und
 * das Motiv bleibt sichtbar. `invert(1)` + `screen` ist die naheliegende
 * "Reparatur", erzeugt aber messbar WENIGER Signal:
 *
 *   multiply         Δ-Luminanz 0,138–0,156   1,79–2,03:1
 *   invert + screen  Δ-Luminanz 0,059–0,076   1,43–1,62:1
 *
 * (gemessen im echten Browser ueber alle fuenf Dringlichkeitsstufen, Region
 * der Motivflaeche). Also: gleiche Regel in beiden Modi, kein Mode-Zweig.
 * Das ist nicht nur kuerzer, es ist auch das bessere Ergebnis.
 */

/* Reduzierte Bewegung: das Motiv bewegt sich ohnehin nicht, aber die
   Komponente wird nach dem globalen Muster hier ausdruecklich als
   animationsfrei dokumentiert, falls das spaeter jemand animiert. */
@media (prefers-reduced-motion: reduce) {
  .chore-visual {
    transition: none;
  }
}
</style>
