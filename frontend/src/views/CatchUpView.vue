<template>
  <!-- tabindex="-1": nicht in der Tab-Folge, aber programmatisch
       fokussierbar. Das ist der Fokus-Ziel nach dem Schliessen eines
       Overlays, wenn kein Stapel (und damit keine Karte) mehr da ist —
       sonst hinge der Fokus auf dem Ausloeser-Knopf und die Deck-Tasten
       waeren tot (siehe focusDeck/hasDeckFocus). -->
  <div class="catchup-view" ref="viewRef" tabindex="-1">
    <!-- Header -->
    <div class="catchup-header">
      <button class="back-btn" @click="$router.push('/')" aria-label="Zurück">
        <span class="mdi mdi-arrow-left"></span>
        <span>Zurück</span>
      </button>

      <div class="catchup-title-area">
        <h1>Aufholen</h1>
        <p class="subtitle">
          {{ completedInSession }} von {{ progress.total }} Chores abgearbeitet
        </p>
      </div>

      <!-- Verlauf der Runde (Befund B5). Der Knopf bleibt sichtbar, auch wenn
           der Stapel leer ist: genau dann ist Rueckwaerts am wertvollsten. -->
      <button
        class="history-btn"
        :disabled="!history.length"
        aria-keyshortcuts="u"
        :aria-label="
          history.length
            ? `Verlauf der Runde, ${history.length} Aktionen rueckgaengig`
            : 'Verlauf der Runde, nichts rueckgaengig'
        "
        @click="openHistory"
      >
        <span class="mdi mdi-undo-variant"></span>
        <span class="history-btn-label">Verlauf</span>
        <span v-if="history.length" class="history-btn-count">{{
          history.length
        }}</span>
      </button>
    </div>

    <!-- Filter Chips -->
    <div class="filter-row" v-if="!loading && stackLength > 0">
      <button
        class="filter-chip"
        :class="{ active: displayFilter === 'all' }"
        @click="setFilter('all')"
      >
        Alle
      </button>
      <button
        class="filter-chip"
        :class="{ active: displayFilter === 'urgent' }"
        @click="setFilter('urgent')"
      >
        Überfällig + Heute
      </button>
      <!-- Tastatur ist der zweite vollwertige Bedienweg, deshalb gehoert ihr
           Einstieg (Taste "?") neben die Filter, nicht in ein Menue. -->
      <button
        class="filter-chip shortcuts-trigger"
        aria-keyshortcuts="?"
        @click="helpOpen = true"
      >
        <span class="mdi mdi-keyboard-outline"></span>
        Tastatur
      </button>
    </div>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" class="loader-center" />

    <!-- Empty States. Der Grund unterscheidet, WAS der Nutzer sieht: eine
         abgearbeitete Runde, ein Filter, der alles ausblendet, oder von
         Anfang an nichts. -->
    <CatchUpEmptyState
      v-else-if="stackLength === 0 && emptyReason === 'nothing'"
      icon="mdi-check-circle-outline"
      title="Alles erledigt"
      message="Keine offenen Chores. Du bist top! 🎉"
      action-label="Chore anlegen"
      action-icon="mdi-plus"
      @action="$router.push('/chores')"
    />

    <CatchUpEmptyState
      v-else-if="stackLength === 0 && emptyReason === 'filtered-out'"
      icon="mdi-filter-remove-outline"
      title="Filter blendet alles aus"
      message="Es sind noch Chores offen, der Filter zeigt sie nicht."
      action-label="Filter zurücksetzen"
      action-icon="mdi-filter-off-outline"
      @action="setFilter('all')"
    />

    <!-- Session-Ende (Befund D1): Zusammenfassung statt Auto-Redirect. -->
    <CatchUpSummary
      v-else-if="stackLength === 0 && emptyReason === 'complete'"
      :summary="summary"
      :last-entry="history[0] || null"
      :busy="historyBusyId !== null"
      @continue="startNextRound"
      @exit="$router.push('/')"
      @undo="undoHistoryEntry"
    />

    <!-- Card Stack: nur die oberste Card + max. 1 Deck-Peek rendern.
         Bei grossen Stacks (50+) war das Voll-Rendering der Perf-Killer
         (Swipe-Handler + backdrop-filter pro Card). -->
    <div v-else class="stack-area" ref="stackAreaRef">
      <!-- Fortschritt als EIN Element: Position im Stapel + Balken. Vorher
           standen drei Anzeigen fuer dieselbe Zahl (`.subtitle`,
           `.stack-counter`, `.progress-bar`). Der Balken ist in den Counter
           gewandert, damit er die Position visuell erklaert statt eine
           eigene Zeile unter dem Deck zu belegen. -->
      <div class="stack-counter" role="status" aria-live="polite">
        <span class="stack-counter-label">
          Karte {{ currentCardNumber }} von {{ progress.total }}
        </span>
        <span class="stack-counter-track" aria-hidden="true">
          <span
            class="stack-counter-fill"
            :style="{ width: progressPct + '%' }"
          ></span>
        </span>
      </div>
      <div class="stack-container" ref="containerRef" role="list" aria-label="Aufholen-Stapel">
        <CatchUpCard
          v-for="(chore, index) in visibleStack"
          :key="chore.id"
          :chore="chore"
          :position="index"
          :total="stackLength"
          :is-active="index === 0"
          :busy="isBusy(chore.id)"
          @toggle="handleToggle"
          @snooze="handleSnooze"
        />
      </div>

      <!-- Aktionen als sichtbare Leiste unter der Karte (Befund A1): die
           Geste bleibt der schnellste Weg, ist aber nicht mehr der einzige. -->
      <CatchUpActionBar
        :chore="visibleStack[0] || null"
        :pending="pendingAction"
        :disabled="pending !== null"
        @done="handleToggle(visibleStack[0].id)"
        @snooze="handleSnooze(visibleStack[0])"
      />
    </div>

    <!-- Snooze Action Sheet -->
    <SnoozeSheet
      :visible="snoozeOpen"
      :chore-name="snoozeChoreName"
      @select="applySnooze"
      @close="snoozeOpen = false"
    />

    <!-- Tastatur-Kurzhilfe -->
    <CatchUpShortcuts
      v-if="helpOpen"
      :shortcuts="shortcutHelp"
      @close="helpOpen = false"
    />

    <!-- Undo-Historie der Runde -->
    <CatchUpHistoryPanel
      v-if="historyOpen"
      :entries="history"
      :busy-id="historyBusyId"
      @close="closeTopOverlay()"
      @undo="undoHistoryEntry"
    />

    <!-- Action Toast (Done / Undo / Snooze) -->
    <transition name="toast-enter">
      <div
        v-if="toast.visible"
        class="catchup-toast"
        role="alert"
        aria-live="polite"
      >
        <span class="toast-message">{{ toast.message }}</span>
        <button v-if="toast.action" class="toast-action" @click="triggerAction">
          {{ toast.action }}
        </button>
        <span
          class="toast-close mdi mdi-close"
          role="button"
          tabindex="0"
          aria-label="Hinweis schließen"
          @click="hideToast"
          @keydown.enter.prevent="hideToast"
        ></span>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useChoreStore } from "@/stores/chore";
import { useAuthStore } from "@/stores/auth";
import {
  applyCatchUpFilter,
  buildSessionStack,
  emptyDeckReason,
  sessionProgress,
} from "@/utils/catchUpStack";

import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import CatchUpCard from "@/components/chores/CatchUpCard.vue";
import CatchUpActionBar from "@/components/chores/catchup/CatchUpActionBar.vue";
import CatchUpEmptyState from "@/components/chores/catchup/CatchUpEmptyState.vue";
import CatchUpHistoryPanel from "@/components/chores/catchup/CatchUpHistoryPanel.vue";
import CatchUpSummary from "@/components/chores/catchup/CatchUpSummary.vue";
import CatchUpShortcuts from "@/components/chores/catchup/CatchUpShortcuts.vue";
import SnoozeSheet from "@/components/chores/SnoozeSheet.vue";

const choreStore = useChoreStore();
const authStore = useAuthStore();

const loading = ref(true);
// `sessionStack` ist der UNGEFILTERTE Stapel der laufenden Runde. Der Filter
// aendert nur noch `visibleStack` — er fasst `sessionStack` nicht an. Damit
// kann kein Filterklick den Fortschritt zuruecksetzen (Befund B4).
const sessionStack = ref([]);
// Groesse des Stapels beim Session-Start. Wird nur dort gesetzt und bei einer
// neuen Runde ("Weitere Runde") neu bestimmt.
const sessionTotal = ref(0);
const containerRef = ref(null);
const stackAreaRef = ref(null);
const viewRef = ref(null);

// IDs der in dieser Runde aufgeschobenen Chores. Runde-Zustand, weil eine
// verschobene Chore offen bleibt und ohne diese Merkung nach dem naechsten
// Stack-Neubau in "upcoming" wieder im Deck auftauchen wuerde.
const snoozedIds = ref(new Set());

// Fortschritt relativ zur GESAMTEN Runde (Befund B4). `remaining` ist bewusst
// die ungefilterte Menge: ein Filter darf Fortschritt anzeigen, aber nicht
// veraendern.
const progress = computed(() =>
  sessionProgress(sessionTotal.value, sessionStack.value.length),
);
const completedInSession = computed(() => progress.value.resolved);
const progressPct = computed(() => progress.value.pct);
const currentCardNumber = computed(() => progress.value.currentCardNumber);

// Warum ist das Deck leer? Sonst kann ein Filter "Ende der Runde" vortaeuschen.
const emptyReason = computed(() =>
  emptyDeckReason({
    remaining: sessionStack.value.length,
    sessionTotal: sessionTotal.value,
  }),
);

// Sichtbare Menge: Filter auf den Session-Stapel, dann die Ein-Karte-plus-Peek-
// Optimierung. Der Index im Slice entspricht dem echten Stack-Index
// (Sortierung bleibt erhalten), damit Deck-Styling und Zaehler stimmen.
const filteredStack = computed(() =>
  applyCatchUpFilter(sessionStack.value, displayFilter.value),
);
const visibleStack = computed(() => filteredStack.value.slice(0, 2));
// Alles, was der Filter gerade zeigt — steuert Empty-State, Filterleiste und
// den z-index der Karten.
const stackLength = computed(() => filteredStack.value.length);

// Bilanz der Runde fuer die Zusammenfassung (Befund D1). Bewusst Zaehler und
// nicht die Historie: die Historie ist auf 20 Eintraege gedeckelt, die Bilanz
// darf es nicht sein — bei 30 Aktionen zeigte eine Zaehlung der Liste
// "10 erledigt" fuer eine Runde mit 30.
const tally = ref({ done: 0, snoozed: 0 });
const countTally = (kind, delta) => {
  tally.value = { ...tally.value, [kind]: tally.value[kind] + delta };
};

// Laufzeit der Runde. Die Uhr laeuft nur, solange der Session-Ende-Screen
// sichtbar ist — ein Intervall, das im Leerlauf ueber eine nicht gelesene
// Ref tickt, waere Energie ohne Information.
const startedAt = ref(Date.now());
const elapsedMs = ref(0);
let elapsedTimer = null;
const tickElapsed = () => {
  elapsedMs.value = Date.now() - startedAt.value;
};

const showSummary = computed(() => emptyReason.value === "complete");

const summary = computed(() => ({
  ...tally.value,
  remaining: sessionStack.value.length,
  total: sessionTotal.value,
  elapsedMs: elapsedMs.value,
}));

watch(showSummary, (isShown) => {
  if (isShown) {
    tickElapsed();
    if (!elapsedTimer) elapsedTimer = setInterval(tickElapsed, 1000);
  } else if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
});

/**
 * Naechste Runde: Stapel frisch vom Server holen, Filter und Bilanz
 * zuruecksetzen. Der Neuaufruf ist noetig, weil waehrend der Runde Chores
 * hinzugekommen sein koennen (anderes Geraet, Kopilot) und der
 * `snoozedIds`-Satz der Runde fuer eine neue Runde nicht gilt.
 */
async function startNextRound() {
  const loaded = await callStore(() => choreStore.fetchChores(), "");
  if (loaded === null) return;
  history.value = [];
  tally.value = { done: 0, snoozed: 0 };
  snoozedIds.value = new Set();
  setFilter("all");
  startedAt.value = Date.now();
  elapsedMs.value = 0;
  rebuildStack(true);
  focusDeck();
}

// Filter: "all" | "urgent" (nur Überfällig + Heute)
const displayFilter = ref("all");

// Pending-Aktion: der Busy-Guard war vorher ein `Set` ohne jedes Template-
// Binding (Befund B3) — geschuetzt wurde, sichtbar war nichts. Jetzt EIN
// Zustand statt einer Menge: das Deck zeigt immer nur eine Karte, es kann
// also hoechstens eine Aktion gleichzeitig in Arbeit sein. Dieselbe Quelle
// speist den Guard (`isBusy`), den Spinner und den Disabled-State.
const pending = ref(null); // { id, kind: "done" | "snooze" }
const isBusy = (id) => pending.value?.id === id;
const pendingAction = computed(() =>
  isBusy(visibleStack.value[0]?.id) ? pending.value?.kind || "" : "",
);

// Snooze
const snoozeOpen = ref(false);
const snoozeChore = ref(null);
const snoozeChoreName = computed(() => snoozeChore.value?.name || "");

// Tastatur-Kurzhilfe (Befund A2)
const helpOpen = ref(false);
// Anzeige und Tastatur-Handler teilen sich diese Liste, damit die Doku nicht
// veralten kann, solange jemand sie pflegt.
const shortcutHelp = [
  { keys: ["Eingabe", "␣", "1"], text: "Aktuelle Chore erledigen" },
  { keys: ["2"], text: "Aktuelle Chore aufschieben" },
  { keys: ["u"], text: "Letzte Aktion zurücknehmen" },
  { keys: ["Esc"], text: "Offenes Fenster schließen" },
  { keys: ["?"], text: "Diese Übersicht" },
];

// Undo-Historie der Runde (Befund B5). Vorher gab es nur den Toast der
// LETZTEN Aktion (4s) — bei zehn schnellen Swipes war der Toast weg, die
// Runde nicht, und rueckwaerts ging nichts mehr. Die Historie ist auf 20
// Eintraege gedeckelt: das ist eine Bedienhilfe fuer die laufende Runde,
// kein Audit-Log (das macht die Logs-Seite).
const HISTORY_LIMIT = 20;
const history = ref([]);
const historyOpen = ref(false);
const historyBusyId = ref(null);
let historySeq = 0;

function pushHistory(entry) {
  historySeq += 1;
  history.value = [{ ...entry, id: historySeq }, ...history.value].slice(
    0,
    HISTORY_LIMIT,
  );
}

function dropHistory(id) {
  history.value = history.value.filter((entry) => entry.id !== id);
}

/** Nimmt die juengste Aktion der Runde zurueck (Taste `u`, Toast-Knopf). */
function undoLastAction() {
  const entry = history.value[0];
  if (!entry) return;
  return undoHistoryEntry(entry.id);
}

/** Verlauf oeffnen — fuehrt den Fokus aus dem Knopf ins Deck, damit die
 *  Deck-Tasten direkt danach greifen. */
function openHistory() {
  if (!history.value.length) return;
  historyOpen.value = true;
  focusDeck();
}

async function undoHistoryEntry(id) {
  const entry = history.value.find((item) => item.id === id);
  if (!entry || historyBusyId.value !== null) return;
  historyBusyId.value = id;
  try {
    const ok = await entry.undo();
    // Nur bei Erfolg aus der Historie nehmen: ein fehlgeschlagener Undo
    // bleibt als Angebot stehen, statt spurlos zu verschwinden.
    if (ok) dropHistory(id);
  } finally {
    historyBusyId.value = null;
  }
}

// Toast
const toast = ref({ visible: false, message: "", action: null, handler: null });
const toastTimer = ref(null);

onMounted(async () => {
  try {
    await choreStore.fetchChores();
    rebuildStack(true);
  } catch (err) {
    console.error("Failed to fetch chores for catchup:", err);
  } finally {
    loading.value = false;
  }
  document.addEventListener("keydown", onKeydown);
});

// Cleanup beim Verlassen: laufende Timer stoppen, sonst tickt der
// Laufzeit-Zaehler nach dem Verlassen weiter und der Toast-Timer tickt ins
// Leere.
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  if (elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  if (toastTimer.value) {
    clearTimeout(toastTimer.value);
    toastTimer.value = null;
  }
});

// --- Tastatursteuerung (Befund A2) -------------------------------------
// Vorher gab es zwar `tabindex="0"` auf der Karte, aber keinen keydown-Handler:
// Enter und Space taten nichts, die pure Tastaturnutzung war blind.
//
// EIN Handler auf document-Ebene statt einer Handkante je Karte: die Karten
// werden bei jedem Swipe neu gerendert, ein Karte-lokaler Handler muesste also
// an jedem Kartenwechsel neu gebunden werden. Zusaetzlich ist eine einzige
// Quelle leichter zu pruefen als N.
const DECK_FOCUS = ".stack-area, .catchup-actions";

/** Text-Eingaben gehoeren dem Dokument, nicht dem Deck. */
function isTextEntry(el) {
  return !!(
    el &&
    el.closest &&
    el.closest("input, textarea, select, [contenteditable='true']")
  );
}

/**
 * Darf eine Aktionstaste greifen? Ja, wenn nichts fokussiert ist (der Fokus
 * liegt dann auf der View) oder wenn der Fokus im Deck liegt. Steht der Fokus
 * z. B. auf der Bottom-Nav, gehoert die Taste dorthin und nicht hierher.
 */
function hasDeckFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return true;
  if (el.closest && el.closest(DECK_FOCUS)) return true;
  // Der View-Root selbst: der Zustand nach dem Schliessen eines Overlays,
  // wenn das Deck leer ist und es keine Karte zum Fokussieren gibt.
  return el === viewRef.value;
}

/**
 * Setzt den Fokus zurueck auf das Deck.
 *
 * Nach dem Schliessen eines Overlays bleibt der Fokus sonst auf dem Knopf, der
 * ihn geoeffnet hat. Damit faellt er aus `hasDeckFocus()` heraus, und die
 * Deck-Tasten (u, 1, 2) sind tot, bis der Nutzer wieder irgendwo ins Deck
 * klickt. Rueckgabe des Fokus auf den Ausloeser ist zugleich die
 * erwartete Dialog-Bedienung (WCAG 2.1.2) — der Weg durch den Dialog fuehrt
 * zum Ausgangspunkt zurueck.
 *
 * Reihenfolge: aktive Karte, dann der Stapel-Container, dann der View-Root.
 * Die letzten beiden sind die Faelle "Deck leer" (Summary/Empty-State) und
 * "noch nichts gerendert".
 */
function focusDeck() {
  const target =
    containerRef.value?.querySelector(".catchup-card") ||
    containerRef.value ||
    viewRef.value;
  target?.focus?.({ preventScroll: true });
}

/** Overlay obenauf? Dann hat es eigene Bedienung (inkl. Escape). */
function isOverlayOpen() {
  return snoozeOpen.value || helpOpen.value || historyOpen.value;
}

/** Schliesst das oberste Overlay, sonst nichts. */
function closeTopOverlay() {
  const wasOpen = snoozeOpen.value || helpOpen.value || historyOpen.value;
  snoozeOpen.value = false;
  helpOpen.value = false;
  historyOpen.value = false;
  if (wasOpen) focusDeck();
  return wasOpen;
}

function onKeydown(e) {
  if (e.defaultPrevented) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Escape hat Vorrang und greift auch aus dem Datumseingabefeld des
  // Snooze-Sheets: dort ist das Schliessen der einzige sinnvolle Ausgang.
  if (e.key === "Escape") {
    if (closeTopOverlay()) e.preventDefault();
    return;
  }

  if (isTextEntry(e.target)) return;
  if (isOverlayOpen()) return;
  if (!hasDeckFocus()) return;
  if (pending.value) return;

  // Enter/Leertaste auf einem Knopf gehoeren dem Knopf — der Browser
  // erzeugt daraus selbst den Click. Ohne diese Ausnahme wuerde die Karte
  // zweimal reagieren.
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.closest &&
    e.target.closest("button, a")
  ) {
    return;
  }

  const top = visibleStack.value[0];

  if (e.key === "Enter" || e.key === " " || e.key === "1") {
    if (!top) return;
    e.preventDefault();
    handleToggle(top.id);
    return;
  }
  if (e.key === "2") {
    if (!top) return;
    e.preventDefault();
    handleSnooze(top);
    return;
  }
  if (e.key === "u" || e.key === "U") {
    e.preventDefault();
    undoLastAction();
    return;
  }
  if (e.key === "?") {
    e.preventDefault();
    helpOpen.value = true;
  }
}

/**
 * Baut den Session-Stapel neu auf.
 *
 * @param {boolean} resetSession - nur beim Session-Start und bei einer neuen
 *   Runde. `setFilter()` ruft rebuildStack() OHNE dieses Flag: die Filterung
 *   darf die Basis der Fortschrittsanzeige nicht verschieben (Befund B4).
 */
function rebuildStack(resetSession = false) {
  const { stack } = buildSessionStack(choreStore.chores, {
    excludeIds: [...snoozedIds.value],
  });
  sessionStack.value = stack;
  if (resetSession) {
    sessionTotal.value = stack.length;
  }
}

function setFilter(filter) {
  displayFilter.value = filter;
}

// --- Date helpers (lokale Zeit, YYYY-MM-DD wie bestehende Chores) ---
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parst "YYYY-MM-DD" LOKAL (nicht als UTC), damit der angezeigte Wochentag/Tag
// bei Offset-Zeitzonen nicht um einen Tag abweicht. Konsistent zu localDateStr()
// und zu normalizeToLocalDate() (choreBuckets).
function parseLocalDate(raw) {
  if (raw instanceof Date) return raw;
  const parts = String(raw).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [y, m, d] = parts;
  return new Date(y, m - 1, d);
}

function formatNextDue(raw) {
  if (!raw) return "";
  const d = parseLocalDate(raw);
  if (!d) return "";
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function showToast(message, action = null, handler = null, duration = 4000) {
  hideToast();
  toast.value = { visible: true, message, action, handler };
  if (duration > 0) {
    toastTimer.value = setTimeout(hideToast, duration);
  }
}

function hideToast() {
  if (toastTimer.value) clearTimeout(toastTimer.value);
  toastTimer.value = null;
  toast.value.visible = false;
  toast.value.action = null;
  toast.value.handler = null;
}

function triggerAction() {
  const handler = toast.value.handler;
  hideToast();
  if (handler) handler();
}

// --- Interactions -------------------------------------------------------

/**
 * Die Server-Aufrufe sind von der UI-Logik getrennt, damit ein Fehler in der
 * UI nicht als Server-Fehler gemeldet wird.
 *
 * Vorher umschloss EIN try/catch in handleToggle den kompletten Ablauf —
 * markDone, rebuildStack, showToast und den Erfolgstimer. Ein ReferenceError
 * im Rebuild (aufgetreten bei dieser Umstellung) landete damit als "Fehler
 * beim Erledigen" beim Nutzer, obwohl die Chore erledigt war. Die Meldung
 * "Fehler beim Erledigen" ist nur dann wahr, wenn der Server nicht
 * geantwortet hat.
 *
 * Rueckgabe `null` = Fehlerfall, bereits gemeldet. `undefined` ist als
 * Antwortwert nicht zu erwarten (der Store liefert `response.data`).
 */
async function callStore(action, errorMessage) {
  try {
    return await action();
  } catch (err) {
    console.error(`CatchUp: ${errorMessage}`, err);
    showToast(errorMessage, null, null, 3000);
    return null;
  }
}

async function handleToggle(choreId) {
  if (isBusy(choreId)) return;
  const chore = sessionStack.value.find((c) => c.id === choreId);
  pending.value = { id: choreId, kind: "done" };
  const response = await callStore(
    () => choreStore.markDone(choreId, authStore.user?.email),
    "Fehler beim Erledigen",
  );
  try {
    if (!response) return;
    rebuildStack();

    // Recurrence-Hinweis, falls vorhanden
    const nextDue = response?.due_date ?? response?.new_due_date;
    const msg = nextDue
      ? `Erledigt ✓ Nächste Fälligkeit: ${formatNextDue(nextDue)}`
      : `Erledigt ✓`;
    showToast(msg, "RÜCKGÄNGIG", () => undoLastAction());

    pushHistory({
      kind: "done",
      choreId,
      choreName: chore?.name || "Chore",
      label: "erledigt",
      icon: "mdi-check-bold",
      undo: () => handleUndo(choreId),
    });
    countTally("done", 1);
  } finally {
    pending.value = null;
  }
}

async function handleUndo(choreId) {
  if (isBusy(choreId)) return;
  pending.value = { id: choreId, kind: "done" };
  const result = await callStore(
    () => choreStore.undoDone(choreId),
    "Fehler beim Rückgängig machen",
  );
  try {
    if (!result) return false;
    rebuildStack();
    countTally("done", -1);
    showToast("Chore wieder geöffnet", null, null, 2500);
    return true;
  } finally {
    pending.value = null;
  }
}

/**
 * Nimmt ein Aufschieben zurueck: das alte `due_date` zurueckschreiben und die
 * Chore wieder in den Stapel dieser Runde aufnehmen.
 *
 * Das Gegenstueck zu `applySnooze`, das vorher fehlte: aufgeschobene Chores
 * waren ein Einbahnstrasse — der Toast hatte fuer sie keine Aktion. Mit der
 * Historie ist beides rueckgaengig.
 */
async function handleSnoozeUndo(choreId, prevDue, choreName) {
  if (isBusy(choreId)) return false;
  pending.value = { id: choreId, kind: "snooze" };
  const result = await callStore(
    () => choreStore.snoozeChore(choreId, prevDue),
    "Fehler beim Rückgängig machen",
  );
  try {
    if (!result) return false;
    snoozedIds.value = new Set(
      [...snoozedIds.value].filter((id) => id !== choreId),
    );
    rebuildStack();
    countTally("snoozed", -1);
    showToast(`${choreName} zurück im Aufholen-Stapel`, null, null, 2500);
    return true;
  } finally {
    pending.value = null;
  }
}

function handleSnooze(chore) {
  if (!chore || isBusy(chore.id)) return;
  snoozeChore.value = chore;
  snoozeOpen.value = true;
}

async function applySnooze(offsetDays, customDate) {
  const chore = snoozeChore.value;
  snoozeOpen.value = false;
  if (!chore || isBusy(chore.id)) return;
  pending.value = { id: chore.id, kind: "snooze" };

  // Das alte Datum merken: es ist der Anker fuer den Undo. Gespeichert wird
  // der Chore-Zustand VOR dem Aufschieben, nicht der daraus errechnete
  // Termin — sonst waere der Undo ein zweiter Aufschub.
  const prevDue = chore.dueDate || chore.due_date || null;

  const newDate =
    customDate ||
    (() => {
      const base = new Date();
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      d.setDate(d.getDate() + offsetDays);
      return localDateStr(d);
    })();

  const result = await callStore(
    () => choreStore.snoozeChore(chore.id, newDate),
    "Fehler beim Aufschieben",
  );
  try {
    if (!result) return;
    // Aufgeschoben = in dieser Runde erledigt. Die Chore bleibt am Backend
    // offen und wandert nur in einen spaeteren Bucket — im Deck der aktuellen
    // Runde steht sie damit nicht mehr (und wird beim naechsten Rebuild nicht
    // wieder aufgenommen).
    snoozedIds.value = new Set([...snoozedIds.value, chore.id]);
    rebuildStack();
    showToast(`Aufgeschoben auf ${formatNextDue(newDate)}`, "RÜCKGÄNGIG", () =>
      undoLastAction(),
    );
    pushHistory({
      kind: "snooze",
      choreId: chore.id,
      choreName: chore.name,
      prevDue,
      label: "aufgeschoben",
      icon: "mdi-clock-outline",
      undo: () => handleSnoozeUndo(chore.id, prevDue, chore.name),
    });
    countTally("snoozed", 1);
  } finally {
    pending.value = null;
  }
}
</script>

<style scoped>
.catchup-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  /* Platz fuer die fixe Bottom-Nav (AppBottomNav: 80px + Safe-Area). Die
     Aktionsleiste ist das Einzige, was der User zwingend anfasst — sie darf
     nie hinter der Navigation liegen. Dieselbe Konstante steht in
     AppBottomNav.vue; ein gemeinsames Token steht als Folgearbeit aus. */
  padding-bottom: calc(
    80px + env(safe-area-inset-bottom, 0px) + var(--md-sys-spacing-lg)
  );
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 80px);
}

/* Header */
.catchup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 8px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--md-sys-radius-small);
  transition: background-color var(--transition-fast);
  font-family: inherit;
}

.back-btn:hover {
  background: var(--color-primary-subtle);
}

.catchup-title-area {
  flex: 1;
}

.catchup-title-area h1 {
  font-size: 1.6rem;
  margin: 0;
  color: var(--color-primary);
}

.subtitle {
  margin: 2px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

/* Verlauf-Knopf (Befund B5) */
.history-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-height: 36px;
  padding: 4px 12px;
  border: var(--border-hairline) solid var(--color-border-glass);
  border-radius: var(--md-sys-radius-full);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.history-btn:hover:not(:disabled) {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.history-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.history-btn-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--md-sys-radius-full);
  background: var(--color-primary);
  color: var(--color-on-accent);
  font-size: 0.7rem;
  font-weight: 800;
}

@media (max-width: 420px) {
  .history-btn-label {
    display: none;
  }
}

/* Filter chips */
.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.filter-chip {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, var(--color-text) 15%, transparent);
  background: var(--color-surface);
  color: var(--color-text-muted);
  border-radius: var(--md-sys-radius-full);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition:
    background-color var(--transition-fast),
    color var(--transition-fast);
}

.filter-chip.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-accent);
}

/* Der Einstieg in die Tastaturhilfe ist ein Chip, aber kein Filter: er traegt
   kein Icon-Label-Paar wie die beiden Filter und sitzt daher am Ende. */
.shortcuts-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--color-primary);
}

.shortcuts-trigger .mdi {
  font-size: 0.95rem;
}

/* Fortschritts-Anzeige "Karte X von Y" + Balken (Befund C5).
   Der Balken ist Teil des Counters und erklaert die Position, statt als
   eigene, fast randlose Zeile unter dem Header zu liegen — die App hatte
   drei Fortschrittsanzeigen fuer eine Zahl. */
.stack-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--md-sys-spacing-xs);
  width: 100%;
  max-width: 420px;
  margin-bottom: var(--md-sys-spacing-md);
}

.stack-counter-label {
  padding: 4px 18px;
  border-radius: var(--md-sys-radius-full);
  background: var(--color-primary);
  color: var(--color-on-accent);
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  box-shadow: var(--shadow-md);
}

.stack-counter-track {
  width: 100%;
  height: 6px;
  border-radius: var(--md-sys-radius-full);
  background: color-mix(in srgb, var(--color-text) 8%, transparent);
  overflow: hidden;
}

.stack-counter-fill {
  display: block;
  height: 100%;
  border-radius: var(--md-sys-radius-full);
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-success)
  );
  transition: width var(--transition-normal) var(--motion-soft);
}


/* Loading */
.loader-center {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

/* Stack Area */
.stack-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--md-sys-spacing-md);
}

/* Fortschritts-Anzeige: siehe .stack-counter (Befund C5). */

.stack-container {
  position: relative;
  width: 100%;
  max-width: 420px;
  min-height: 160px;
  margin: 0 auto;
}

/* Empty State Override */
:deep(.empty-state) {
  margin-top: 40px;
}

/* Action Toast */
.catchup-toast {
  position: fixed;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  /* Der Toast invertiert gegen --color-text: im Light Mode dunkler
     Hintergrund/helle Schrift, im Dark Mode heller Hintergrund/dunkle
     Schrift. Ein festes #ffffff waere im Dark Mode unsichtbar. */
  background: var(--color-text);
  color: var(--color-background);
  padding: 10px 16px;
  border-radius: var(--md-sys-radius-full);
  box-shadow: var(--shadow-lg);
  z-index: var(--md-sys-zindex-toast); /* über dem Success-Overlay (1400), damit UNDO immer klickbar bleibt */
  max-width: calc(100vw - 32px);
  font-size: 0.85rem;
}

.toast-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-action {
  background: none;
  border: none;
  color: var(--color-success);
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  font-family: inherit;
}

.toast-close {
  cursor: pointer;
  opacity: 0.7;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

</style>
