// ─── API Client ───────────────────────────────────────────────────────────────
// Thin wrapper around the FastAPI backend.
// Auto-attaches the JWT Bearer token from localStorage on every request.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const TOKEN_KEY = 'ps_auth_token'

/** Read the raw JWT from localStorage (written by AuthContext on login). */
export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

/** Persist a JWT to localStorage. */
export function storeToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Remove the JWT (logout). */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/** Core fetch — attaches token + Content-Type, normalises error shape. */
async function request(method, path, body) {
  const token = getStoredToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const detail =
      Array.isArray(err.detail)
        ? err.detail.map((e) => e.msg).join(', ')
        : err.detail || `HTTP ${res.status}`
    const e = new Error(detail)
    e.status = res.status
    throw e
  }
  return res.json()
}

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  /** POST /auth/register */
  register: (payload) => request('POST', '/auth/register', payload),

  /** POST /auth/login */
  login: (payload) => request('POST', '/auth/login', payload),

  /** GET /auth/me */
  me: () => request('GET', '/auth/me'),

  // ── Reports / Cases ────────────────────────────────────────────────────────
  /** POST /reports — submit a field report (requires auth) */
  submitReport: (payload) => request('POST', '/reports', payload),

  /** GET /cases — list all cases */
  getCases: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/cases${qs ? `?${qs}` : ''}`)
  },

  /** GET /cases/:id — single case with risk */
  getCase: (id) => request('GET', `/cases/${id}`),

  /** POST /cases/:id/action — advance status or assign vet (VET/DVO only) */
  caseAction: (id, body) => request('POST', `/cases/${id}/action`, body),

  /** GET /risk/:id — risk score for a case */
  getRisk: (id) => request('GET', `/risk/${id}`),

  /** Health check */
  health: () => request('GET', '/'),
}
