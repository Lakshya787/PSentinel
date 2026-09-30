import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.tile\.(openstreetmap|mapbox)\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^http:\/\/localhost:8000\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pashu-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
              backgroundSync: {
                name: 'field-reports-sync',
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
                  maxRetentionTime: 24 * 60,
                },
              },
            },
          },
        ],

        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },

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
          { src: '/psentinel.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/psentinel.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
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
            url: '/vet',
            icons: [{ src: '/psentinel.png', sizes: '96x96', type: 'image/png' }],
          },
        ],

        screenshots: [],
      },

      // ── DEV: Service worker DISABLED in dev — it causes massive slowdowns ──
      // The SW intercepts every HMR request and adds 2-5s per page load in dev.
      // PWA features (offline, caching) are only active in the production build.
      devOptions: {
        enabled: false,
      },
    }),
  ],

  // ── Pre-bundle all heavy deps so Vite never re-optimizes during a session ──
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
      'leaflet',
      'react-leaflet',
    ],
    force: false,
  },

  server: {
    host: true,
    port: 5173,
    // Faster HMR — only send the changed module, don't full-reload
    hmr: {
      overlay: true,
    },
    proxy: {
      '/auth':       'http://127.0.0.1:8000',
      '/cases':      'http://127.0.0.1:8000',
      '/reports':    'http://127.0.0.1:8000',
      '/risk':       'http://127.0.0.1:8000',
      '/clusters':   'http://127.0.0.1:8000',
      '/neighbours': 'http://127.0.0.1:8000',
      '/health':     'http://127.0.0.1:8000',
    },
  },

  // Faster builds — skip type-checking (already handled by TS/IDE)
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
})

