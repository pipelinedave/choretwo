import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

const plugins = [vue()];

if (process.env.NODE_ENV === "production") {
  plugins.push(
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "Choretwo",
        short_name: "Choretwo",
        description: "Modern chore management with Material You design",
        theme_color: "#673AB7",
        background_color: "#FEF7FF",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        // Never treat /api/* navigations as SPA fallback — let the browser hit
        // the real backend (auth mock-login-page / callback) instead of Vue.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60,
              },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  );
}

export default defineConfig({
  plugins,
  server: {
    port: 3000,
    proxy: {
      // Auth service (Go, standalone) — proxy to auth-service:8001
      "/api/auth": {
        target: "http://localhost:8001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const token =
              req.headers["authorization"] ||
              req.headers["Authorization"] ||
              "";
            if (token) proxyReq.setHeader("Authorization", token);
          });
        },
      },
      // Modular monolith APIs — proxy to monolith:8000
      "/api/chores": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const token =
              req.headers["authorization"] ||
              req.headers["Authorization"] ||
              "";
            if (token) proxyReq.setHeader("Authorization", token);
          });
        },
      },
      "/api/logs": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const token =
              req.headers["authorization"] ||
              req.headers["Authorization"] ||
              "";
            if (token) proxyReq.setHeader("Authorization", token);
          });
        },
      },
      "/api/notify": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const token =
              req.headers["authorization"] ||
              req.headers["Authorization"] ||
              "";
            if (token) proxyReq.setHeader("Authorization", token);
          });
        },
      },
      "/api/ai": {
        target: "http://localhost:8000",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const token =
              req.headers["authorization"] ||
              req.headers["Authorization"] ||
              "";
            if (token) proxyReq.setHeader("Authorization", token);
          });
        },
      },
      // Settings — proxy to monolith:8000
      "/api/settings": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
