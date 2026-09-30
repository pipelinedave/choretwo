import { createApp } from "vue";
import { createPinia } from "pinia";
import "@mdi/font/css/materialdesignicons.css";
import "./assets/styles/main.css";
import App from "./App.vue";
import router from "./router";
import { initPWA } from "./lib/pwa";

const app = createApp(App);

app.use(createPinia());
app.use(router);

// PWA-Service-Worker registrieren (autoUpdate: Seite laedt nach neuem
// Deploy automatisch neu). No-op, wenn 'serviceWorker' nicht verfuegbar ist.
initPWA();

app.mount("#app");
