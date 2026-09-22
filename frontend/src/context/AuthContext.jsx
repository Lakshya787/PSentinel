/**
 * context/AuthContext.jsx
 *
 * Provides:
 *   user   — { id, name, phone, role } | null
 *   token  — raw JWT string | null
 *   login(phone, password)  → resolves on success, throws on failure
 *   register(name, phone, password, role) → resolves on success, throws on failure
 *   logout()
 *
 * Token is persisted to localStorage under TOKEN_KEY ('ps_auth_token').
 * On mount, the stored token is decoded client-side (no round-trip) to
 * restore session without a network call.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, storeToken, clearToken, getStoredToken, TOKEN_KEY } from '../utils/api'

// ── Tiny client-side JWT decode (no signature verification — server does that) ──
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function payloadToUser(payload) {
  if (!payload) return null
  return {
    id:    payload.sub,
    name:  payload.name,
    phone: payload.phone,
    role:  payload.role,
  }
}

function isTokenExpired(payload) {
  if (!payload?.exp) return true
  return payload.exp * 1000 < Date.now()
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken())
  const [user,  setUser]  = useState(() => {
    const stored = getStoredToken()
    if (!stored) return null
    const payload = decodeJwtPayload(stored)
    if (isTokenExpired(payload)) {
      clearToken()
      return null
    }
    return payloadToUser(payload)
  })

  // Keep token/user in sync whenever localStorage changes (other tabs)
  useEffect(() => {
    function onStorage(e) {
      if (e.key === TOKEN_KEY) {
        const newToken = e.newValue
        setToken(newToken)
        if (!newToken) {
          setUser(null)
        } else {
          const payload = decodeJwtPayload(newToken)
          setUser(isTokenExpired(payload) ? null : payloadToUser(payload))
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const _applyToken = useCallback((tokenStr) => {
    storeToken(tokenStr)
    setToken(tokenStr)
    const payload = decodeJwtPayload(tokenStr)
    setUser(payloadToUser(payload))
  }, [])

  const login = useCallback(async (phone, password) => {
    const data = await api.login({ phone, password })
    _applyToken(data.access_token)
    return data.user
  }, [_applyToken])

  const register = useCallback(async (name, phone, password, role) => {
    const data = await api.register({ name, phone, password, role })
    _applyToken(data.access_token)
    return data.user
  }, [_applyToken])

  const demoLogin = useCallback(async (role = 'VET', name = 'Dr. Deshmukh', phone = '9876543210') => {
    // Fixed demo passwords for each persona
    const DEMO_PASSWORD = 'Demo@1234'

    try {
      // Try to register first (idempotent — if account exists, catch and login)
      let data
      try {
        data = await api.register({ name, phone, password: DEMO_PASSWORD, role })
      } catch (err) {
        if (err.status === 409 || (err.message && err.message.toLowerCase().includes('already'))) {
          // Already registered — just login
          data = await api.login({ phone, password: DEMO_PASSWORD })
        } else {
          throw err
        }
      }
      _applyToken(data.access_token)
      return data.user
    } catch (err) {
      // Backend unreachable — fall back to local-only mock JWT (read-only mode)
      console.warn('[AuthContext] Backend unavailable for demoLogin, using mock JWT:', err?.message)
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const payload = btoa(JSON.stringify({
        sub: `demo-${role.toLowerCase()}-${Date.now()}`,
        name,
        phone,
        role,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 3600),
      }))
      const mockToken = `${header}.${payload}.demo-signature`
      _applyToken(mockToken)
      return { id: `demo-${role.toLowerCase()}`, name, phone, role }
    }
  }, [_applyToken])

  const logout = useCallback(() => {
    clearToken()
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, register, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
