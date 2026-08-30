<template>
  <div class="modal-overlay" role="dialog" aria-modal="true" aria-label="About Choretwo" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h2>About Choretwo</h2>
      </div>

      <div class="modal-body">
        <div class="app-brand">
          <span class="brand-title">CHORETWO</span>
          <span class="brand-subtitle">Tactile Microservice Household Task Tracker</span>
        </div>

        <div class="info-list">
          <div class="info-item">
            <span class="info-label">Version</span>
            <span class="info-val">v2.0.0</span>
          </div>
          <div class="info-item">
            <span class="info-label">Architecture</span>
            <span class="info-val">Microservices (Go / Python / Node)</span>
          </div>
          <div class="info-item">
            <span class="info-label">Infrastructure</span>
            <span class="info-val">K3s · FluxCD · Dex OIDC · PostgreSQL</span>
          </div>
          <div class="info-item">
            <span class="info-label">Design Spirit</span>
            <span class="info-val">Material You & Choremane UX</span>
          </div>
        </div>

        <div class="about-links">
          <a href="https://github.com/pipelinedave/choretwo" target="_blank" rel="noopener" class="btn btn-tonal btn-sm">
            <span class="mdi mdi-github"></span> GitHub Repo
          </a>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" @click="$emit('close')">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(["close"]);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 45, 44, 0.45);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-content {
  background: var(--color-background);
  background-image:
    radial-gradient(120% 160% at 10% 10%, rgba(253, 232, 213, 0.6) 0%, rgba(253, 232, 213, 0) 45%),
    radial-gradient(90% 120% at 90% 20%, rgba(189, 233, 221, 0.6) 0%, rgba(189, 233, 221, 0) 52%);
  color: var(--color-text);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 440px;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255, 255, 255, 0.7);
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
}

.app-brand {
  text-align: center;
}

.brand-title {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--color-primary);
}

.brand-subtitle {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-surface);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-surface-lighter);
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
}

.info-label {
  color: var(--color-text-muted);
  font-weight: 500;
}

.info-val {
  font-weight: 600;
  color: var(--color-text);
}

.about-links {
  display: flex;
  justify-content: center;
}

.modal-footer {
  padding: 1rem 1.5rem;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-surface-lighter);
  background: rgba(255, 255, 255, 0.3);
}
</style>
