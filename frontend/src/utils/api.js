// ─── API Client ───────────────────────────────────────────────────────────────
// Thin wrapper around the FastAPI backend.
// Falls back gracefully if backend is unavailable.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  /** POST /reports — submit a field report */
  submitReport: (payload) => request('POST', '/reports', payload),

  /** GET /cases — list all cases */
  getCases: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request('GET', `/cases${qs ? `?${qs}` : ''}`)
  },

  /** GET /cases/:id — single case with risk */
  getCase: (id) => request('GET', `/cases/${id}`),

  /** POST /cases/:id/action — advance status or assign vet */
  caseAction: (id, body) => request('POST', `/cases/${id}/action`, body),

  /** GET /risk/:id — risk score for a case */
  getRisk: (id) => request('GET', `/risk/${id}`),

  /** Health check */
  health: () => request('GET', '/'),
}
