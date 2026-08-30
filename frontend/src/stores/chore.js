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
      const response = await choreApi.get("/");
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
      if (Object.prototype.hasOwnProperty.call(updates, "private") || Object.prototype.hasOwnProperty.call(updates, "is_private")) {
        payload.is_private = !!(updates.private ?? updates.is_private);
      }

      const response = await choreApi.put(`/${id}`, payload);
      const normalized = normalizeChore(response.data.chore || response.data);
      const index = chores.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        chores.value[index] = {
          ...chores.value[index],
          ...normalized,
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
      const response = await choreApi.put(`/${id}/done`, { done_by: doneBy });
      const index = chores.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        const updated = normalizeChore({
          ...chores.value[index],
          done: true,
          dueDate: response.data.new_due_date,
          due_date: response.data.new_due_date,
          lastDone: response.data.last_done,
          last_done: response.data.last_done,
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
    archiveChore,
    unarchiveChore,
    deleteChore,
    setFilter,
    clearError,
  };
});
