<template>
  <div class="chores-view">
    <!-- Filter pills -->
    <FilterPills v-model:filter="choreStore.filter" :stats="choreStore.stats" />

    <!--
      Raum-Filter: zweite Achse, gleiche Bildsprache.

      Reihenfolge bewusst: die Zeile sitzt direkt unter der
      Faelligkeits-Zeile, damit die Kette "erst WANN, dann WO" von oben
      nach unten gelesen wird. Sie ist additiv — beide Zeilen bleiben
      gleichzeitig aktiv und ihre Auswahl verfeinert sich gegenseitig.
    -->
    <RoomFilterPills
      :room-filter="choreStore.roomFilter"
      :counts="choreStore.roomCounts"
      @update:room-filter="choreStore.setRoomFilter"
      @clear="choreStore.clearRoomFilter"
    />

    <!-- Performance bar -->
    <PerformanceBar :score="choreStore.householdHealth" label="Health" />

    <!-- Add chore FAB -->
    <button
      @click="showAddForm = true"
      class="fab shadow-elevation-3"
      aria-label="Add chore"
    >
      <span class="mdi mdi-plus" style="font-size: 24px"></span>
    </button>

    <LoadingSpinner v-if="choreStore.loading" context="chores" />

    <EmptyState
      v-else-if="choreStore.filteredChores.length === 0"
      :message="filterMessage"
      show-add-button
      @add="showAddForm = true"
    />

    <div v-else class="chore-list">
      <ChoreCard
        v-for="chore in filteredChores"
        :key="chore.id"
        :chore="chore"
        :completing="completingIds.has(chore.id)"
        @toggle="handleToggle"
        @updateChore="handleUpdateChore"
        @archive="handleArchive"
      />
    </div>

    <!-- Add chore form modal -->
    <AddChoreForm
      v-if="showAddForm"
      @submit="handleAddChore"
      @close="showAddForm = false"
    />

    <!-- Undo banner -->
    <UndoBanner />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useChoreStore } from "@/stores/chore";
import { useAuthStore } from "@/stores/auth";
import { useRoomStore } from "@/stores/room";
import LoadingSpinner from "@/components/layout/LoadingSpinner.vue";
import EmptyState from "@/components/chores/EmptyState.vue";
import FilterPills from "@/components/chores/FilterPills.vue";
import RoomFilterPills from "@/components/chores/RoomFilterPills.vue";
import PerformanceBar from "@/components/layout/PerformanceBar.vue";
import ChoreCard from "@/components/chores/ChoreCard.vue";
import AddChoreForm from "@/components/chores/AddChoreForm.vue";
import UndoBanner from "@/components/logs/UndoBanner.vue";

const choreStore = useChoreStore();
const authStore = useAuthStore();
// Fuer die Raum-Filterzeile. Der Raum-Chip auf der Karte bringt seinen
// Raum eingebettet mit, die Filterzeile braucht aber ALLE Raeume —
// inklusive derer, die gerade kein Chore haben. Das ist derselbe Store
// wie im Room-Picker, also dieselbe Quelle.
const roomStore = useRoomStore();

const showAddForm = ref(false);
const completingIds = ref(new Set());

/**
 * Die Faelligkeits-Labels fuer den Leerzustand. Als Objekt statt als
 * ternaere Kette: die Liste waechst sonst mit jeder neuen Bucket-
 * Konstante an einer Stelle, die man beim Lesen des Leerzustands
 * zuerst sucht.
 */
const DUE_LABEL = {
  overdue: "Overdue",
  today: "Due today",
  tomorrow: "Due tomorrow",
  thisWeek: "Due this week",
  upcoming: "Due later",
};

const filteredChores = computed(() => {
  const base = choreStore.filteredChores;
  if (completingIds.value.size === 0) return base;
  const baseIds = new Set(base.map((c) => c.id));
  const stillCompleting = choreStore.chores.filter(
    (c) => completingIds.value.has(c.id) && !baseIds.has(c.id),
  );
  return [...base, ...stillCompleting];
});

const filterMessage = computed(() => {
  /*
   * Nennt beide Achsen, wenn beide gesetzt sind. "No chores to show"
   * bei einer von zwei aktiven Filtern ist die verwirrendste moegliche
   * Antwort: der User sieht eine leere Liste und weiss nicht, welche der
   * beiden Auswahlen sie verursacht hat.
   */
  const room = roomNameOf(choreStore.roomFilter);
  const due = DUE_LABEL[choreStore.filter];

  if (room && due) return `No chores in ${room} that are ${due.toLowerCase()}.`;
  if (room) return `No chores in ${room}.`;
  if (choreStore.filter === "completed") return "No completed chores yet.";
  if (choreStore.filter === "overdue") return "No overdue chores. Great job!";
  if (choreStore.filter === "due-soon") return "No chores due soon.";
  return "No chores to show.";
});

/** Raum-ID -> Name. Der Store haelt beide Schreibweisen, der Room-Store ist die Quelle. */
function roomNameOf(roomId) {
  if (roomId === null || roomId === undefined) return null;
  return roomStore.roomById.get(roomId)?.name || null;
}

onMounted(async () => {
  /*
   * Beide Requests parallel: die Raumliste ist unabhaengig von den
   * Chores, und das sequentialisieren wuerde die Zeit bis zur ersten
   * Renderbaren Liste verdoppeln — auf dem Handy der Unterschied
   * zwischen "sofort da" und "nach zwei Funk-Roundtrips".
   *
   * `fetchRooms` ist selbst fehlertolerant (faellt auf eine leere Liste
   * zurueck), ein Fehler blockiert die Chores also nicht.
   */
  await Promise.all([choreStore.fetchChores(), roomStore.fetchRooms()]);
});

async function handleToggle(choreId) {
  const chore = choreStore.chores.find((c) => c.id === choreId);
  if (chore && !chore.done) {
    completingIds.value.add(choreId);
    try {
      await choreStore.markDone(choreId, authStore.user.email);
    } catch (err) {
      console.error("Failed to mark chore as done:", err);
    } finally {
      setTimeout(() => {
        completingIds.value.delete(choreId);
      }, 1000);
    }
  }
}

// Kein eigenes Edit-Modal mehr: die ChoreCard editiert inline und emittiert
// `updateChore`. Das Modal lag ueber dem Inline-Editor und blockierte dessen
// Buttons — siehe ChoreCard.vue, Kommentar an der entfernten emit("edit").

async function handleArchive(choreId) {
  try {
    await choreStore.archiveChore(choreId);
  } catch (err) {
    console.error("Failed to archive chore:", err);
  }
}

async function handleAddChore(formData) {
  try {
    await choreStore.addChore(formData);
    showAddForm.value = false;
  } catch (err) {
    console.error("Failed to add chore:", err);
  }
}

async function handleUpdateChore(formData) {
  try {
    await choreStore.updateChore(formData.id, formData);
  } catch (err) {
    console.error("Failed to update chore:", err);
  }
}
</script>

<style scoped>
.chores-view {
  max-width: 800px;
  margin: 0 auto;
}

.chore-list {
  display: flex;
  flex-direction: column;
  gap: var(--md-sys-spacing-sm);
  margin-top: var(--md-sys-spacing-md);
}

.fab {
  position: fixed;
  bottom: calc(120px + env(safe-area-inset-bottom));
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
