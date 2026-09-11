// ─── useOnlineStatus ─────────────────────────────────────────────────────────
// Tracks real browser online/offline events AND exposes a demo override.
// The demo override lets us simulate offline for the video demo.

import { useState, useEffect, useCallback } from 'react'

const DEMO_OVERRIDE_KEY = 'ps_demo_online_override'

export function useOnlineStatus() {
  const [realOnline, setRealOnline] = useState(navigator.onLine)
  const [demoOverride, setDemoOverride] = useState(() => {
    const stored = localStorage.getItem(DEMO_OVERRIDE_KEY)
    return stored === null ? null : stored === 'true'
  })

  useEffect(() => {
    const handleOnline  = () => setRealOnline(true)
    const handleOffline = () => setRealOnline(false)
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const isOnline = demoOverride !== null ? demoOverride : realOnline

  const setDemoOnline = useCallback((value) => {
    setDemoOverride(value)
    localStorage.setItem(DEMO_OVERRIDE_KEY, String(value))
  }, [])

  const clearDemoOverride = useCallback(() => {
    setDemoOverride(null)
    localStorage.removeItem(DEMO_OVERRIDE_KEY)
  }, [])

  return { isOnline, realOnline, demoOverride, setDemoOnline, clearDemoOverride }
}
