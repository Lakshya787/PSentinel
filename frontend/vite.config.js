import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ── Strategy ──────────────────────────────────────────────────────────
      // 'generateSW' lets Workbox auto-build the SW from the config below.
      // This gives us real precaching + runtime strategies without a manual sw.js
      strategies: 'generateSW',
      registerType: 'autoUpdate',    // SW auto-updates when new version is built
      injectRegister: 'auto',        // Auto-injects <script> registration in index.html

      // ── Workbox config ────────────────────────────────────────────────────
      workbox: {
        // Precache the entire app shell (JS, CSS, HTML, images, fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime caching strategies
        runtimeCaching: [
          // ── Google Fonts (cache-first, long TTL) ──────────────────────────
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Tile / map images (StaleWhileRevalidate) ─────────────────────
          {
            urlPattern: /^https:\/\/.*\.tile\.(openstreetmap|mapbox)\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── FastAPI backend (NetworkFirst with fallback) ──────────────────
          // When offline, returns last cached API response so dashboard still loads.
          {
            urlPattern: /^http:\/\/localhost:8000\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pashu-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
              // Background Sync: queue failed POST /reports for retry when online
              backgroundSync: {
                name: 'field-reports-sync',    // matches ref.md §15 SyncManager queue name
                options: {
                  onSync: async ({ queue }) => {
                    let entry
                    while ((entry = await queue.shiftRequest())) {
                      try {
                        await fetch(entry.request)
                      } catch (err) {
                        await queue.unshiftRequest(entry)
                        throw err
                      }
                    }
                  },
                  maxRetentionTime: 24 * 60,   // retry for up to 24 hours
                },
              },
            },
          },
        ],

        // Clean up old caches on SW activation
        cleanupOutdatedCaches: true,
        // Skip waiting so updated SW activates immediately
        skipWaiting: true,
        clientsClaim: true,
      },

      // ── Web App Manifest (fully spec-compliant per ref.md §23) ───────────
      manifest: {
        name: 'Pashu Sentinel — Veterinary Intelligence',
        short_name: 'PashuSentinel',
        description: 'Livestock disease early-warning and veterinary decision support platform.',
        theme_color: '#5d7052',
        background_color: '#fdfcf8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['health', 'medical', 'utilities'],

        icons: [
          {
            src: '/psentinel.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/psentinel.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],

        shortcuts: [
          {
            name: 'File Field Report',
            short_name: 'Report',
            description: 'Submit a livestock disease report',
            url: '/field-report',
            icons: [{ src: '/psentinel.png', sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Veterinary Dashboard',
            short_name: 'Dashboard',
            description: 'View prioritised case triage',
            url: '/dashboard',
            icons: [{ src: '/psentinel.png', sizes: '96x96', type: 'image/png' }],
          },
        ],

        screenshots: [],
      },

      // ── Dev options ───────────────────────────────────────────────────────
      // Enable SW in dev so we can test offline behaviour without building
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],

  server: {
    host: true,
    port: 5173,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/cases': 'http://127.0.0.1:8000',
      '/reports': 'http://127.0.0.1:8000',
      '/risk': 'http://127.0.0.1:8000',
      '/clusters': 'http://127.0.0.1:8000',
      '/neighbours': 'http://127.0.0.1:8000',
      '/health': 'http://127.0.0.1:8000',
    },
  },
})
