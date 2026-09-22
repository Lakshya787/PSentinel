import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCaseStore } from '../hooks/useCaseStore'
import StatusBadge from '../components/ui/StatusBadge'
import { calculateRisk, riskLevelHex } from '../utils/riskEngine'
import { ChevronRight, RefreshCw, Wifi, WifiOff, Search } from 'lucide-react'
import { api } from '../utils/api'

function normaliseCase(c) {
  const rf = c.risk_factors ?? {}
  const risk = c.risk ?? (Object.keys(rf).length === 4
    ? calculateRisk(rf)
    : { score: 0, level: 'LOW' })
  return {
    id:              c.id ?? c.tag_id,
    animalId:        c.tag_id ?? c.id,
    species:         c.species ?? 'Cattle',
    village:         c.village ?? '',
    syndrome:        c.syndrome ?? 'Undetermined',
    status:          c.status ?? 'REPORTED',
    mortality:       c.mortality ?? 0,
    riskFactors:     rf,
    risk,
  }
}

export default function CasesListPage() {
  const navigate          = useNavigate()
  const { casesByRisk }   = useCaseStore()

  const [liveCases,   setLiveCases]  = useState(null)
  const [refreshing,  setRefreshing] = useState(false)
  const [liveError,   setLiveError]  = useState(false)
  const [query,       setQuery]      = useState('')

  async function fetchCases() {
    try {
      setRefreshing(true)
      const data = await api.getCases({ limit: 200 })
      const normalised = (data.cases ?? []).map(normaliseCase)
      normalised.sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0))
      setLiveCases(normalised)
      setLiveError(false)
    } catch {
      setLiveError(true)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchCases() }, []) // eslint-disable-line

  const displayCases = (liveCases && liveCases.length > 0) ? liveCases : casesByRisk
  const isLive       = liveCases && liveCases.length > 0

  const filtered = query
    ? displayCases.filter(c =>
        [c.id, c.animalId, c.village, c.syndrome, c.species]
          .join(' ').toLowerCase()
          .includes(query.toLowerCase())
      )
    : displayCases

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-6 py-4">
        <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-slate-900">All Cases</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500">{filtered.length} cases · sorted by risk</p>
              <span
                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  color: isLive ? '#5d7052' : '#c18c5d',
                  background: isLive ? 'rgba(93,112,82,0.1)' : 'rgba(193,140,93,0.1)',
                }}
              >
                {isLive
                  ? <><Wifi className="w-3 h-3" /> Live</>
                  : <><WifiOff className="w-3 h-3" /> Local</>
                }
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search cases…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-surface-border rounded-lg bg-white focus:outline-none focus:border-brand-400 w-44"
              />
            </div>
            {/* Refresh */}
            <button
              onClick={fetchCases}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              title="Refresh from server"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {liveError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200">
            ⚠ Could not reach backend — showing local data. Make sure the server is running on port 8000.
          </div>
        )}
        <div className="card divide-y divide-surface-border overflow-hidden">
          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-sm">
              {query ? 'No cases match your search.' : 'No cases yet. Submit a field report to get started.'}
            </div>
          )}
          {filtered.map(c => {
            const hex = riskLevelHex(c.risk?.level ?? 'LOW')
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/cases/${c.id}`)}
                className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: hex }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500">{c.id}</span>
                    <span className="text-xs font-semibold text-slate-800">{c.animalId}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{c.village} · {c.species} · {c.syndrome}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black" style={{ color: hex }}>{c.risk?.score ?? '—'}</p>
                  <p className="text-[9px] uppercase font-bold" style={{ color: hex }}>{c.risk?.level ?? 'LOW'}</p>
                </div>
                <StatusBadge status={c.status} size="sm" />
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
