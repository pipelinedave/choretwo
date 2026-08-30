import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { logApi } from "@/api";
import { useChoreStore } from "@/stores/chore";

const MAX_ENTRIES = 100;

const normalizeDetails = (rawDetails) => {
  if (!rawDetails) return {};
  if (typeof rawDetails === "string") {
    try {
      return JSON.parse(rawDetails);
    } catch (e) {
      return { raw: rawDetails };
    }
  }
  return rawDetails;
};

const getChoreLabel = (details, entry) => {
  if (entry?.chore_title) return entry.chore_title;
  if (details?.name) return details.name;
  if (details?.previous_state?.name) return details.previous_state.name;
  if (details?.new_state?.name) return details.new_state.name;
  if (details?.action_type && details?.undone) return null;
  return entry?.chore_id ? `Chore #${entry.chore_id}` : null;
};

const getActionDescription = (action, details) => {
  switch (action) {
    case "marked_done":
    case "chore:completed":
      return "marked done";
    case "created":
    case "chore:created":
      return "created";
    case "updated":
    case "chore:updated":
      return "updated";
    case "archived":
    case "chore:archived":
      return "archived";
    case "unarchived":
    case "chore:unarchived":
      return "restored";
    case "undo":
      return null;
    case "import":
      return `imported (${details?.imported_chores?.length || details?.count || 0} chores)`;
    case "export":
      return `exported (${details?.chore_count || 0} chores)`;
    default:
      return action || "activity";
  }
};

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
};

const normalizeEntry = (entry) => {
  const details = normalizeDetails(entry?.action_details || entry?.details);
  const action = entry?.action_type || details?.action_type || entry?.action || null;
  const timestamp = entry?.done_at || entry?.timestamp || new Date().toISOString();
  const choreName = getChoreLabel(details, entry);
  const actionDescription = getActionDescription(action, details);
  const user = entry?.done_by || entry?.user_email || null;

  return {
    id: entry?.id || `local-${Date.now()}`,
    action,
    choreName,
    chore_title: choreName,
    actionDescription,
    user,
    timestamp,
    timeAgo: formatTimeAgo(timestamp),
    raw: entry,
    isLocal: String(entry?.id).startsWith("local-"),
    isHidden: action === "undo" || (!choreName && action !== "import" && action !== "export"),
  };
};

export const useLogStore = defineStore("logs", () => {
  const logEntries = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const lastAction = ref(null);

  const logs = computed(() => logEntries.value);

  const visibleEntries = computed(() => {
    return logEntries.value.filter((e) => !e.isHidden);
  });

  const latestEntry = computed(() => {
    return visibleEntries.value[0] || null;
  });

  async function fetchLogs(limit = 50) {
    loading.value = true;
    error.value = null;

    try {
      const response = await logApi.get(`/?limit=${limit}`);
      const rawData = response.data || [];
      logEntries.value = rawData.map(normalizeEntry).slice(0, MAX_ENTRIES);
      return logEntries.value;
    } catch (err) {
      error.value = err.message || "Failed to fetch logs";
      console.error("Error fetching logs:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function undo(logId) {
    const entry = logEntries.value.find((l) => l.id === logId);
    if (!entry) throw new Error("Log entry not found");

    try {
      await logApi.post("/undo", { log_id: logId });

      // Refresh chores and counts
      const choreStore = useChoreStore();
      await choreStore.fetchChores();
      await choreStore.fetchChoreCounts();
      await fetchLogs();

      lastAction.value = { type: "undo", logId };
      return true;
    } catch (err) {
      error.value = err.message || "Failed to undo action";
      throw err;
    }
  }

  function addLocalLogEntry(message, action = null) {
    const newEntry = normalizeEntry({
      id: `local-${Date.now()}`,
      action_type: action,
      action_details: { name: message },
      done_at: new Date().toISOString(),
    });
    logEntries.value.unshift(newEntry);
    if (logEntries.value.length > MAX_ENTRIES) {
      logEntries.value = logEntries.value.slice(0, MAX_ENTRIES);
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    logEntries,
    logs,
    visibleEntries,
    latestEntry,
    loading,
    error,
    lastAction,
    fetchLogs,
    undo,
    addLocalLogEntry,
    clearError,
  };
});
