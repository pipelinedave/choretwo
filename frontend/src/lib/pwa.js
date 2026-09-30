import { registerSW } from "virtual:pwa-register";

// Aktiviert die PWA-Service-Worker-Registrierung im autoUpdate-Modus
// (vite.config.js: registerType "autoUpdate" + workbox skipWaiting/clientsClaim).
// In diesem Modus laedt die Service-Worker-Logik die Seite automatisch neu,
// sobald der neue Build aktiviert wurde — wir brauchen hier also kein
// needRefresh/Update-Banner, sondern nur die regulaere Update-Erkennung:
// Wenn ein frischer Build deployt wird, soll er kurz darauf aktiv werden,
// auch waehrend der Tab offen ist.
export function initPWA() {
  registerSW({
    immediate: true,
    onRegisteredSW(_swScriptUrl, registration) {
      if (registration) {
        // Regelmaessig nach Updates suchen ...
        setInterval(
          () => {
            registration.update();
          },
          15 * 60 * 1000,
        );
        // ... und jedes Mal, wenn der User zurueck zum Tab kommt.
        window.addEventListener("focus", () => {
          registration.update();
        });
      }
    },
  });
}
