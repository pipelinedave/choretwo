<template>
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    @click.self="$emit('close')"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2>App Settings</h2>
      </div>

      <div class="modal-body">
        <!--
          Ab hier ist dies die EINZIGE Settings-Oberflaeche der App.

          Vorher gab es zwei: die Route /settings (Notification, Appearance,
          Data, AI) und dieses Modal (nur Theme + eine AI-Checkbox). Die Route
          war seit 5671fd nicht mehr erreichbar — die Bottom-Nav war ihr
          einziger Zugang — und damit toter Code. Der User hat entschieden:
          Route entfaellt, das Modal uebernimmt.

          Die doppelt vorhandene Einstellung "AI aktiviert" ist dabei auf eine
          reduziert: die alte Modal-Checkbox schrieb nach localStorage
          (`choretwo_ai_enabled`) und war eine zweite, schlechtere
          Implementierung derselben Sache. Jetzt gilt allein AiSettingsSection
          (Draft/Discard/Save gegen den Store).
        -->
        <NotificationSettings />
        <AppearanceSettings />
        <DataSettings />
        <AiSettingsSection ref="aiSection" />
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * Settings-Modal — ab jetzt die einzige Einstellungs-Oberflaeche.
 *
 * Saettigung ueber `useSettingsStore` (`GET /api/settings`), damit die
 * Sektionen aus dem Backend kommen statt aus localStorage. Der Theme-Teil
 * bleibt bewusst lokal: `choretwo_theme` ist die Quelle, die auch App.vue
 * beim Start liest, und AppearanceSettings schreibt ebenfalls dorthin.
 */
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useSettingsStore } from "@/stores/settings";
import NotificationSettings from "@/components/settings/NotificationSettings.vue";
import AppearanceSettings from "@/components/settings/AppearanceSettings.vue";
import DataSettings from "@/components/settings/DataSettings.vue";
import AiSettingsSection from "@/components/settings/AiSettingsSection.vue";

const emit = defineEmits(["close"]);
const s = useSettingsStore();
const aiSection = ref(null);

onMounted(async () => {
  try {
    await s.fetchSettings();
    s.applyTheme();
    // Der AI-Entwurf braucht die geholten Werte, sonst zeigt er die Defaults
    // und "Discard" setzt auf etwas zurueck, das nie gespeichert war.
    aiSection.value?.loadFromStore();
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
});

// Scroll im Modal: mit allen Sektionen ist es regelmaessig hoeher als der
// Viewport, und ohne das scrollt die Seite dahinter beim Scrollen mit.
const prevOverflow = document.body.style.overflow;
document.body.style.overflow = "hidden";
onBeforeUnmount(() => {
  document.body.style.overflow = prevOverflow;
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-overlay-scrim);
  backdrop-filter: blur(4px);
  z-index: var(--md-sys-zindex-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: var(--color-background);
  background-image:
    radial-gradient(
      120% 160% at 10% 10%,
      rgb(var(--md-sys-color-accent-warm-rgb) / 0.6) 0%,
      rgb(var(--md-sys-color-accent-warm-rgb) / 0) 45%
    ),
    radial-gradient(
      90% 120% at 90% 20%,
      rgb(var(--md-sys-color-accent-cool-rgb) / 0.6) 0%,
      rgb(var(--md-sys-color-accent-cool-rgb) / 0) 52%
    );
  color: var(--color-text);
  border-radius: var(--md-sys-radius-large);
  width: 100%;
  /* Breiter als die 440px von vorher: mit Notification, Appearance, Data und
     AI ist der Inhalt zweispaltig zu breit fuer schmale Spalten. */
  max-width: 560px;
  /* Hoehe begrenzen, damit Kopf und Fuss sichtbar bleiben. `dvh` statt `vh`,
     weil auf Mobil die Adressleiste die vh-Zahl verflaescht. */
  max-height: min(88dvh, 900px);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border-glass);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-surface-lighter);
}

.modal-header h2 {
  font-size: 1.25rem;
  margin: 0;
}

.modal-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  /* Der Body ist der scrollende Teil: Kopf ("App Settings") und Fuss ("Done")
     bleiben stehen. Ohne das ragt der Inhalt aus dem Modal heraus und der
     Done-Knopf ist auf kleinen Bildschirmen nicht erreichbar. */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  /* Platz fuer den eigenen Scrollbalken, damit er nicht auf den Text legt. */
  scrollbar-gutter: stable;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-muted);
}

.theme-options {
  display: flex;
  gap: 8px;
}

.custom-checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-text {
  font-size: 0.9rem;
  font-weight: 500;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-surface-lighter);
  background: var(--color-surface-overlay-soft);
}
</style>
