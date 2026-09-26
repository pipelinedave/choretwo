// src/lib/spinnerPick.js — Kontextsensitiver Spinner mit Anti-Wiederholungs-Cache
// Passend zu tobi-autos spinnerPick.ts, optimiert für Haushalt & Gamification.

export const SPINNER_VARIANTS = [
  { id: "broom", defaultLabel: "Chores werden gefegt…" },
  { id: "washer", defaultLabel: "Wäsche wird geschleudert…" },
  { id: "sponge", defaultLabel: "Alles auf Hochglanz bringen…" },
  { id: "robot", defaultLabel: "Saugroboter flitzt über den Teppich…" },
  { id: "plant", defaultLabel: "Haushalt wird gehegt und gepflegt…" },
  { id: "pan", defaultLabel: "Da brutzelt was Feines…" },
  { id: "trash", defaultLabel: "Haushalt wird sortiert und entrümpelt…" },
  { id: "rocket_task", defaultLabel: "Aufgabe hebt ab… Macher-Modus! 🚀" },
  { id: "bubbles", defaultLabel: "Porentief rein & synchronisiert…" },
  { id: "ai_robot", defaultLabel: "KI-Copilot plant den nächsten Zug…" },
  { id: "handshake", defaultLabel: "Deal besiegelt… Aufgabe abgehakt! 🤝" },
  { id: "clock_snooze", defaultLabel: "Aufgeschoben, nicht aufgehoben… ⏰" },
  { id: "sync_pulse", defaultLabel: "Daten werden synchronisiert…" },
];

const POOLS = {
  chores: ["broom", "sponge", "robot", "washer", "bubbles"],
  ai: ["ai_robot", "rocket_task", "bubbles"],
  auth: ["robot", "handshake", "bubbles", "rocket_task"],
  logs: ["broom", "trash", "plant", "clock_snooze"],
  catchup: ["rocket_task", "robot", "handshake", "sponge", "broom"],
  sync: ["sync_pulse", "bubbles", "robot"],
  form: ["plant", "sponge", "rocket_task"],
  export: ["trash", "plant", "sync_pulse"],
};

const lastPick = new Map();

export function pickSpinner(context = "chores") {
  const pool = POOLS[context] || POOLS.chores;
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && pool[idx] === lastPick.get(context)) {
    idx = (idx + 1) % pool.length;
  }
  const chosenVariant = pool[idx];
  lastPick.set(context, chosenVariant);

  const meta = SPINNER_VARIANTS.find((v) => v.id === chosenVariant);
  return {
    variant: chosenVariant,
    label: meta?.defaultLabel || "Lädt…",
  };
}
