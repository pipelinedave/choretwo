// Zentraler Copilot-Flow (Chat + Confirm/Execute) für ChatWidget, CopilotBar
// und AIView. Vermeidet 3x duplizierte /chat + /execute-Logik.
//
// Backend-Vertrag:
//   POST /api/ai/chat    { message, user_id } -> ChatResponse:
//       { intent, parameters, confidence, requires_confirmation,
//         suggested_action, message, proposal_id }
//   POST /api/ai/execute { proposal_id }      -> ExecuteResponse:
//       { success, message, data }
// Der Copilot führt NIE selbst aus — das Backend erzeugt einen Vorschlag
// (Proposal), der User bestätigt, erst dann wendet /execute ihn an.

import { aiApi } from "@/api";
import { useChoreStore } from "@/stores/chore";
import { useLogStore } from "@/stores/log";

// Intents, die eine Bestätigung erfordern (Aktions-Intents).
const ACTION_INTENTS = [
  "mark_done",
  "create_chore",
  "update_chore",
  "archive",
];

// Direkt anzeigbarer Text aus der Chat-Antwort.
export function assistantText(responseData) {
  return (
    responseData?.message ||
    responseData?.suggested_action ||
    "I'm not sure how to help with that."
  );
}

// Sendet eine Nachricht an /chat und liefert das parsebare Ergebnis.
export async function sendToCopilot(text, userEmail) {
  const res = await aiApi.post("/chat", {
    message: text,
    user_id: userEmail || undefined,
  });
  return res.data;
}

// Führt ein bestätigtes Proposal aus und refreshed die Stores.
export async function executeProposal(proposalId) {
  const res = await aiApi.post("/execute", { proposal_id: proposalId });
  const choreStore = useChoreStore();
  const logStore = useLogStore();
  // Nach einer realen Aktion (anlegen/erledigen/aktualisieren/archivieren)
  // die Listen und das Aktivitätslog aktualisieren.
  await Promise.allSettled([choreStore.fetchChores(), logStore.fetchLogs()]);
  return res.data;
}

export function isActionIntent(intent) {
  return ACTION_INTENTS.includes(intent);
}

export { ACTION_INTENTS };
