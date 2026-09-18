import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { choreApi } from "@/api";
import { bucketChores, normalizeToLocalDate } from "@/utils/choreBuckets";

const normalizeChore = (raw) => {
  const chore = raw?.chore || raw || {};
  return {
    ...chore,
    id: chore.id,
    name: chore.name,
    dueDate: chore.due_date || chore.dueDate,
    due_date: chore.due_date || chore.dueDate,
    doneBy: chore.done_by || chore.doneBy,
    done_by: chore.done_by || chore.doneBy,
    interval: chore.interval_days || chore.interval || 0,
    interval_days: chore.interval_days || chore.interval || 0,
    lastDone: chore.last_done || chore.lastDone,
    last_done: chore.last_done || chore.lastDone,
    ownerEmail: chore.owner_email || chore.ownerEmail,
    owner_email: chore.owner_email || chore.ownerEmail,
    isPrivate: !!(chore.is_private ?? chore.isPrivate),
    is_private: !!(chore.is_private ?? chore.isPrivate),
    done: !!chore.done,
    archived: !!chore.archived,
  };
};

export const useChoreStore = defineStore("chores", () => {
  const chores = ref([]);
  // Merkt beim markDone den ursprünglichen due_date pro Chore, damit undoDone
  // ihn wiederherstellen kann (Backend zieht due_date beim Done nach vorn).
  const pendingUndoDates = new Map();
  const archivedChores = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const filter = ref("all");
  const totalCounts = ref({
    all: 0,
    overdue: 0,
    today: 0,
    tomorrow: 0,
    thisWeek: 0,
    upcoming: 0,
  });
  const householdHealth = ref(100);

  const sortedByUrgency = computed(() => {
    return [...chores.value].sort((a, b) => {
      const dateA = normalizeToLocalDate(a.dueDate || a.due_date);
      const dateB = normalizeToLocalDate(b.dueDate || b.due_date);
      return (dateA?.getTime() ?? Infinity) - (dateB?.getTime() ?? Infinity);
    });
  });

  const sortedArchivedChores = computed(() => {
    return [...archivedChores.value].sort((a, b) => {
      const dateA = normalizeToLocalDate(a.dueDate || a.due_date);
      const dateB = normalizeToLocalDate(b.dueDate || b.due_date);
      return (dateA?.getTime() ?? Infinity) - (dateB?.getTime() ?? Infinity);
    });
  });

  const bucketedChores = computed(() => bucketChores(sortedByUrgency.value));

  const filteredChores = computed(() => {
    if (filter.value === "completed") {
      return sortedByUrgency.value.filter((c) => c.done);
    }
    const buckets = bucketedChores.value.buckets;
    const bucket = buckets[filter.value];
    if (bucket && filter.value !== "all") return bucket;
    return sortedByUrgency.value.filter((c) => !c.archived);
  });

  const bucketCounts = computed(() => bucketedChores.value.counts);

  const stats = computed(() => {
    const total = chores.value.length;
    const completed = chores.value.filter((c) => c.done).length;
    const overdue = bucketCounts.value.overdue;
    const dueSoon = bucketCounts.value.today;
    return { total, completed, overdue, dueSoon };
  });

  async function fetchChores() {
    loading.value = true;
    error.value = null;

    try {
      const response = await choreApi.get("/", {
        params: { limit: 100 },
      });
      chores.value = (response.data || []).map(normalizeChore);
      await fetchChoreCounts();
      return chores.value;
    } catch (err) {
      error.value = err.message || "Failed to fetch chores";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchArchivedChores() {
    loading.value = true;
    error.value = null;

    try {
      const response = await choreApi.get("/archived");
      archivedChores.value = (response.data || []).map(normalizeChore);
      return archivedChores.value;
    } catch (err) {
      error.value = err.message || "Failed to fetch archived chores";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchChoreCounts() {
    try {
      const response = await choreApi.get("/count");
      totalCounts.value = response.data;
      await fetchHouseholdHealth();
    } catch (err) {
      console.error("Failed to fetch chore counts:", err);
    }
  }

  async function fetchHouseholdHealth() {
    try {
      const response = await choreApi.get("/household-health");
      householdHealth.value = response.data?.score ?? 100;
    } catch (err) {
      console.error("Failed to fetch household health:", err);
    }
  }

  async function addChore(choreData) {
    try {
      const payload = { name: choreData.name };
      const interval = choreData.interval || choreData.interval_days;
      if (interval >= 1) {
        payload.interval_days = interval;
      }
      const dueDate = choreData.dueDate || choreData.due_date;
      if (dueDate) payload.due_date = dueDate;
      payload.is_private = !!(choreData.private || choreData.is_private);

      const response = await choreApi.post("/", payload);
      const created = normalizeChore(response.data.chore || response.data);
      chores.value.push(created);
      await fetchChoreCounts();
      return created;
    } catch (err) {
      error.value = err.message || "Failed to add chore";
      throw err;
    }
  }

  async function updateChore(id, updates) {
    try {
      const payload = {};
      if (updates.name) payload.name = updates.name;
      const interval = updates.interval || updates.interval_days;
      if (interval >= 1) {
        payload.interval_days = interval;
      }
      const dueDate = updates.dueDate || updates.due_date;
      if (dueDate) payload.due_date = dueDate;
      if (Object.prototype.hasOwnProperty.call(updates, "done")) {
        payload.done = !!updates.done;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "done_by")) {
        payload.done_by = updates.done_by;
      }
      if (
        Object.prototype.hasOwnProperty.call(updates, "private") ||
        Object.prototype.hasOwnProperty.call(updates, "is_private")
      ) {
        payload.is_private = !!(updates.private ?? updates.is_private);
      }

      const response = await choreApi.put(`/${id}`, payload);
      // Die PUT-Update-Route liefert teils nur { message } ohne Chore-Objekt.
      // In dem Fall NICHT mit einem leeren/partialen normalisierten Objekt
      // überschreiben (sonst würde z.B. `name` auf undefined gesetzt und der
      // CatchUp-Kartentitel nach Undo leer erscheinen). Nur mergen, wenn die
      // Response tatsächlich ein gültiges Chore-Objekt enthält.
      const updatedRaw =
        response.data?.chore || (response.data?.id ? response.data : null);
      const normalized = updatedRaw ? normalizeChore(updatedRaw) : null;
      const index = chores.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        chores.value[index] = {
          ...chores.value[index],
          ...(normalized || {}),
          ...updates,
        };
      }
      await fetchChoreCounts();
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to update chore";
      throw err;
    }
  }

  async function markDone(id, doneBy) {
    try {
      const index = chores.value.findIndex((c) => c.id === id);
      // Ursprünglichen due_date merken, damit undoDone ihn wiederherstellen kann
      // (das Backend zieht due_date beim Done auf das nächste Recurrence-Vorkommen vor).
      if (index !== -1) {
        pendingUndoDates.set(id, chores.value[index].due_date);
      }
      const response = await choreApi.put(`/${id}/done`, { done_by: doneBy });
      if (index !== -1) {
        const updated = normalizeChore({
          ...chores.value[index],
          done: true,
          dueDate: response.data.due_date ?? response.data.new_due_date,
          due_date: response.data.due_date ?? response.data.new_due_date,
          lastDone: response.data.last_done ?? response.data.lastDone,
          last_done: response.data.last_done ?? response.data.lastDone,
          doneBy: response.data.done_by || doneBy,
          done_by: response.data.done_by || doneBy,
        });
        chores.value[index] = updated;
      }
      await fetchChoreCounts();
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to mark chore as done";
      throw err;
    }
  }

  async function undoDone(id) {
    // Backend setzt bei done_by == "undo" nur done=false/done_by=None, lässt aber
    // die beim Done VORGEZOGENE due_date stehen. Damit die Chore an ihren
    // ursprünglichen Termin zurückkehrt (CatchUp-Stack), stellen wir die zuvor
    // gemerkte due_date explizit wieder her.
    try {
      const storedOldDue = pendingUndoDates.get(id) || null;
      const response = await choreApi.put(`/${id}/done`, { done_by: "undo" });
      const index = chores.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        const restored = { ...chores.value[index] };
        if (storedOldDue) {
          restored.due_date = storedOldDue;
          restored.dueDate = storedOldDue;
        }
        restored.done = false;
        restored.doneBy = null;
        restored.done_by = null;
        chores.value[index] = restored;
      }
      // Altdatum im Backend persistieren, falls gemerkt (nur wenn nötig)
      if (storedOldDue && index !== -1) {
        await updateChore(id, {
          due_date: storedOldDue,
          dueDate: storedOldDue,
        });
      }
      pendingUndoDates.delete(id);
      await fetchChoreCounts();
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to undo chore";
      throw err;
    }
  }

  async function snoozeChore(id, dueDate) {
    return updateChore(id, { due_date: dueDate, dueDate });
  }

  async function archiveChore(id) {
    try {
      const response = await choreApi.put(`/${id}/archive`);
      const index = chores.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        const archivedChore = { ...chores.value[index], archived: true };
        chores.value.splice(index, 1);
        archivedChores.value.push(archivedChore);
      }
      await fetchChoreCounts();
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to archive chore";
      throw err;
    }
  }

  async function unarchiveChore(id) {
    try {
      const response = await choreApi.put(`/${id}/unarchive`);
      const index = archivedChores.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        const unarchived = { ...archivedChores.value[index], archived: false };
        archivedChores.value.splice(index, 1);
        chores.value.push(unarchived);
      }
      await fetchChoreCounts();
      return response.data;
    } catch (err) {
      error.value = err.message || "Failed to unarchive chore";
      throw err;
    }
  }

  async function deleteChore(id) {
    try {
      await choreApi.delete(`/${id}`);
      chores.value = chores.value.filter((c) => c.id !== id);
      archivedChores.value = archivedChores.value.filter((c) => c.id !== id);
    } catch (err) {
      error.value = err.message || "Failed to delete chore";
      throw err;
    }
  }

  function setFilter(newFilter) {
    filter.value = newFilter;
  }

  function clearError() {
    error.value = null;
  }

  return {
    chores,
    archivedChores,
    loading,
    error,
    filter,
    sortedByUrgency,
    sortedArchivedChores,
    bucketedChores,
    filteredChores,
    stats,
    bucketCounts,
    totalCounts,
    householdHealth,
    fetchChores,
    fetchArchivedChores,
    fetchChoreCounts,
    fetchHouseholdHealth,
    addChore,
    updateChore,
    markDone,
    markChoreDone: markDone,
    undoDone,
    snoozeChore,
    archiveChore,
    unarchiveChore,
    deleteChore,
    setFilter,
    clearError,
  };
});
