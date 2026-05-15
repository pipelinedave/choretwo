import { defineStore } from "pinia";
import { ref } from "vue";
import { choreApi, logApi } from "@/api";

function getDefaultTheme() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("settings-theme");
    if (saved && ["light", "dark", "system"].includes(saved)) {
      return saved;
    }
    // Fallback to prefers-color-scheme
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
  }
  return "system";
}

export const useSettingsStore = defineStore("settings", () => {
  const notifications = ref({
    enabled: true,
    notify_times: ["09:00", "18:00"],
    notify_overdue: true,
    notify_soon: true,
  });
  const ai = ref({
    learning_enabled: true,
    suggestion_types: ["recurrence", "timing", "assignment"],
  });
  const appearance = ref({
    theme: getDefaultTheme(),
  });

  const loading = ref(false);
  const error = ref(null);
  const lastSaved = ref(null);

  async function fetchSettings() {
    loading.value = true;
    error.value = null;

    try {
      const response = await choreApi.get("/settings");
      const data = response.data;

      notifications.value = {
        enabled: data.notifications?.enabled ?? true,
        notify_times: data.notifications?.notify_times ?? ["09:00", "18:00"],
        notify_overdue: data.notifications?.notify_overdue ?? true,
        notify_soon: data.notifications?.notify_soon ?? true,
      };
      ai.value = {
        learning_enabled: data.ai?.learning_enabled ?? true,
        suggestion_types: data.ai?.suggestion_types ?? [
          "recurrence",
          "timing",
          "assignment",
        ],
      };
      appearance.value = {
        theme: data.appearance?.theme ?? "system",
      };
    } catch (err) {
      error.value = err.message || "Failed to fetch settings";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateSettings(updates) {
    loading.value = true;
    error.value = null;

    try {
      const payload = {};

      if (updates.notifications) {
        const n = updates.notifications;
        payload.notifications = {};
        payload.notifications.enabled = n.enabled;
        payload.notifications.notify_times = n.notify_times;
        payload.notifications.notify_overdue = n.notify_overdue;
        payload.notifications.notify_soon = n.notify_soon;
      }

      if (updates.ai) {
        const a = updates.ai;
        payload.ai = {};
        payload.ai.learning_enabled = a.learning_enabled;
        payload.ai.suggestion_types = a.suggestion_types;
      }

      if (updates.appearance) {
        payload.appearance = {
          theme: updates.appearance.theme,
        };
      }

      await choreApi.put("/settings", payload);

      // Update local state
      if (updates.notifications)
        notifications.value = { ...updates.notifications };
      if (updates.ai) ai.value = { ...updates.ai };
      if (updates.appearance) appearance.value = { ...updates.appearance };

      // Persist theme
      if (updates.appearance) {
        localStorage.setItem("settings-theme", updates.appearance.theme);
      }

      // Apply theme immediately
      applyTheme();

      lastSaved.value = new Date().toISOString();
    } catch (err) {
      error.value = err.message || "Failed to update settings";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function applyTheme() {
    const theme = appearance.value.theme;
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  function applyThemeImmediate(theme) {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  async function exportData() {
    try {
      const [chores, logsRaw] = await Promise.all([
        choreApi.get("/"),
        logApi.get("/?limit=1000"),
      ]);

      const data = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        appName: "choretwo",
        chores: chores.data || [],
        logs: logsRaw.data || [],
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "choretwo-export-" + new Date().toISOString().split("T")[0] + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (err) {
      error.value = err.message || "Failed to export data";
      throw err;
    }
  }

  async function importData(fileContent) {
    const data = JSON.parse(fileContent);

    if (!data.exportedAt) {
      throw new Error("Invalid export file: missing exportedAt timestamp");
    }

    console.log("Import plan:", {
      choresCount: (data.chores || []).length,
      logsCount: (data.logs || []).length,
    });

    return true;
  }

  function clearError() {
    error.value = null;
  }

  function reset() {
    notifications.value = {
      enabled: true,
      notify_times: ["09:00", "18:00"],
      notify_overdue: true,
      notify_soon: true,
    };
    ai.value = {
      learning_enabled: true,
      suggestion_types: ["recurrence", "timing", "assignment"],
    };
    appearance.value = { theme: getDefaultTheme() };
  }

  return {
    notifications,
    ai,
    appearance,
    loading,
    error,
    lastSaved,
    fetchSettings,
    updateSettings,
    applyTheme,
    applyThemeImmediate,
    exportData,
    importData,
    reset,
    clearError,
  };
});
