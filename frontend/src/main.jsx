import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './index.css'
import App from './App.jsx'

// ─── PWA Update Prompt ────────────────────────────────────────────────────────
// Rendered as a sibling to App so it never interferes with routing.
function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Silently poll every 60 s for a new SW version in the background
      r && setInterval(() => r.update(), 60_000)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: '#1a2315', color: '#e8e4dc', padding: '0.75rem 1.25rem',
        borderRadius: '1rem', boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
        fontSize: '0.8rem', fontWeight: 600,
      }}
    >
      <span>🔄 New version available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#5d7052', color: '#fff',
          border: 'none', borderRadius: '0.5rem',
          padding: '0.35rem 0.75rem', cursor: 'pointer', fontWeight: 700,
        }}
      >
        Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        style={{ background: 'transparent', color: '#a0a08c', border: 'none', cursor: 'pointer' }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Root render ──────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PWAUpdatePrompt />
  </StrictMode>,
)

