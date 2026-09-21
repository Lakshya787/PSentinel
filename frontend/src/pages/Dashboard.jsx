import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, TrendingUp, FlaskConical, MapPin,
  Wifi, WifiOff, Bell, ChevronRight, Map, Activity,
  ArrowUpRight, Leaf, RefreshCw,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import StatusBadge from '../components/ui/StatusBadge'
import { riskLevelHex } from '../utils/riskEngine'
import { formatDateTime } from '../utils/formatters'
import { api } from '../utils/api'
import { calculateRisk } from '../utils/riskEngine'

// ─── Organic KPI card ─────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, iconBg, valueCls, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left w-full transition-all duration-300 ${onClick ? 'cursor-pointer' : 'cursor-default'} hover:-translate-y-0.5`}
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(8px)',
        borderRadius: '1.25rem',
        border: '1px solid rgba(222,216,207,0.6)',
        boxShadow: '0 2px 12px -2px rgba(93,112,82,0.08)',
        padding: '1.1rem',
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div
          className="w-9 h-9 flex items-center justify-center"
          style={{ background: iconBg, borderRadius: '0.875rem' }}
        >
          <Icon className="w-4 h-4" style={{ color: 'inherit' }} />
        </div>
        {onClick && <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#a0a08c' }} />}
      </div>
      <p className={`text-2xl font-black tabular-nums leading-none ${valueCls}`}>{value}</p>
      <p className="text-xs font-semibold mt-1" style={{ color: '#5a5a50' }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: '#a0a08c' }}>{sub}</p>}
    </button>
  )
}

// ─── Case row ─────────────────────────────────────────────────────────────────
function CaseRow({ c, isPrimary, onClick }) {
  const hex = riskLevelHex(c.risk.level)
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-all duration-200 hover:bg-black/[0.03]"
      style={{
        background: isPrimary
          ? 'linear-gradient(90deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.02) 100%)'
          : 'transparent',
        borderLeft: isPrimary ? '4px solid #dc2626' : '4px solid transparent',
        borderBottom: '1px solid rgba(222,216,207,0.5)',
      }}
    >
      {/* Mobile */}
      <div className="md:hidden flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: '#a0a08c' }}>{c.id}</span>
            {isPrimary && (
              <span
                className="text-[9px] font-black uppercase px-1.5 py-0.5"
                style={{
                  color: '#a85448',
                  background: 'rgba(168,84,72,0.1)',
                  borderRadius: '99px',
                  border: '1px solid rgba(168,84,72,0.2)',
                }}
              >
                Primary
              </span>
            )}
          </div>
          <p className="text-sm font-bold mt-0.5" style={{ color: '#2c2c24' }}>{c.animalId}</p>
          <p className="text-xs" style={{ color: '#78786c' }}>{c.village} · {c.syndrome}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <StatusBadge status={c.status} size="sm" />
            {c.mortality > 0 && (
              <span className="text-[10px] font-bold" style={{ color: '#dc2626' }}>
                ✕{c.mortality} mortality
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-black tabular-nums" style={{ color: hex }}>{c.risk.score}</p>
          <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: hex }}>
            {c.risk.level}
          </p>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: '#a0a08c' }}>{c.id}</span>
            {isPrimary && (
              <span
                className="text-[9px] font-black uppercase px-1.5 py-0.5"
                style={{
                  color: '#a85448',
                  background: 'rgba(168,84,72,0.1)',
                  borderRadius: '99px',
                  border: '1px solid rgba(168,84,72,0.2)',
                }}
              >
                Primary
              </span>
            )}
          </div>
          <p className="text-sm font-semibold truncate" style={{ color: '#2c2c24' }}>{c.animalId}</p>
          <p className="text-xs" style={{ color: '#78786c' }}>{c.species}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#2c2c24' }}>{c.village}</p>
          <p className="text-xs truncate" style={{ color: '#78786c' }}>{c.syndrome}</p>
        </div>
        <div className="text-center w-16">
          <p className="text-lg font-black tabular-nums leading-none" style={{ color: hex }}>{c.risk.score}</p>
          <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: hex }}>{c.risk.level}</p>
        </div>
        <div className="text-center w-14">
          {c.mortality > 0
            ? <span className="text-xs font-bold" style={{ color: '#dc2626' }}>✕{c.mortality}</span>
            : <span className="text-xs" style={{ color: '#a0a08c' }}>—</span>
          }
        </div>
        <div><StatusBadge status={c.status} size="sm" /></div>
        <ChevronRight className="w-4 h-4" style={{ color: '#ded8cf' }} />
      </div>
    </button>
  )
}

// ─── Normalise backend snake_case case → frontend camelCase ───────────────────
function normaliseCase(c) {
  const rf = c.risk_factors ?? {}
  return {
    id:              c.id ?? c.tag_id,
    animalId:        c.tag_id ?? c.id,
    species:         c.species,
    village:         c.village,
    taluk:           c.taluk,
    district:        c.district,
    state:           c.state,
    lat:             c.lat,
    lng:             c.lng,
    symptoms:        c.symptoms ?? [],
    affectedAnimals: c.affected_animals ?? 1,
    mortality:       c.mortality ?? 0,
    reportedBy:      c.reported_by ?? '',
    assignedVet:     c.assigned_vet ?? null,
    status:          c.status,
    syndrome:        c.syndrome ?? 'Undetermined',
    riskFactors:     rf,
    risk:            c.risk ?? (Object.keys(rf).length === 4 ? calculateRisk(rf.clinical, rf.vaccination, rf.environmental, rf.spatial) : { score: 0, level: 'LOW', label: 'Low' }),
    reportedAt:      c.reported_at,
    updatedAt:       c.updated_at,
    notes:           c.notes ?? '',
    tier1Triage:     c.tier1_triage,
    // keep existing camelCase fields if already present (from local store)
    timeline:        c.timeline ?? [],
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate               = useNavigate()
  const { casesByRisk: localCases, kpis: localKpis } = useCaseStore()
  const { isOnline }           = useOnlineStatus()

  const [liveCases,   setLiveCases]   = useState(null)   // null = loading
  const [liveError,   setLiveError]   = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)

  async function fetchCases() {
    try {
      setRefreshing(true)
      const data = await api.getCases({ limit: 100 })
      // Normalise and sort by risk score desc
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

  // Fetch on mount + when coming back online
  useEffect(() => { fetchCases() }, [])                    // eslint-disable-line
  useEffect(() => { if (isOnline) fetchCases() }, [isOnline]) // eslint-disable-line

  // Decide which data source to show
  const isLoading     = liveCases === null && !liveError
  const displayCases  = (liveCases && liveCases.length > 0) ? liveCases : localCases
  const isLive        = liveCases && liveCases.length > 0

  const priorityCases = displayCases.slice(0, 10)

  // Derive KPIs from whichever source is active
  const kpis = isLive
    ? {
        criticalCases:  displayCases.filter(c => c.risk?.level === 'CRITICAL').length,
        highRiskCases:  displayCases.filter(c => c.risk?.level === 'HIGH').length,
        activeClusters: 2,
        pendingLab:     displayCases.filter(c => c.status === 'LAB_TESTING').length,
      }
    : localKpis

  return (
    <div className="min-h-full animate-fadeIn">

      {/* ── Sticky header ───────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 px-6 py-4"
        style={{
          background: 'rgba(253,252,248,0.88)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(222,216,207,0.6)',
          boxShadow: '0 2px 16px rgba(93,112,82,0.06)',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1
              className="text-lg font-bold leading-tight"
              style={{ fontFamily: "'Fraunces', serif", color: '#2c2c24', letterSpacing: '-0.02em' }}
            >
              Veterinary Intelligence
            </h1>
            <p className="text-xs mt-0.5" style={{ color: '#78786c' }}>
              Junnar Taluk, Pune · Maharashtra
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live / seed data badge */}
            <div
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5"
              style={{
                color: isLive ? '#5d7052' : '#c18c5d',
                background: isLive ? 'rgba(93,112,82,0.1)' : 'rgba(193,140,93,0.1)',
                borderRadius: '99px',
              }}
            >
              {isLoading
                ? <><RefreshCw className="w-3 h-3 animate-spin" /> Loading…</>
                : isLive
                  ? <><Wifi className="w-3 h-3" /> Live ({displayCases.length})</>
                  : <><WifiOff className="w-3 h-3" /> Demo data</>
              }
            </div>

            {/* Manual refresh */}
            <button
              id="btn-refresh-cases"
              onClick={fetchCases}
              disabled={refreshing}
              title="Refresh cases from server"
              className="p-2 transition-colors hover:bg-black/5"
              style={{ borderRadius: '0.75rem' }}
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                style={{ color: '#78786c' }}
              />
            </button>

            <button
              className="relative p-2 transition-colors"
              style={{ borderRadius: '0.75rem' }}
            >
              <Bell className="w-4 h-4" style={{ color: '#78786c' }} />
              <span
                className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: '#dc2626' }}
              />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">

        {/* ── Critical alert banner — dynamic ─────────────────────────── */}
        {(() => {
          const topCritical = displayCases.find(c => c.risk?.level === 'CRITICAL')
          if (!topCritical) return null
          return (
            <div
              className="flex items-center gap-4 px-4 py-3 animate-slideUp"
              style={{
                background: 'linear-gradient(135deg, rgba(168,84,72,0.08), rgba(220,38,38,0.05))',
                border: '1px solid rgba(168,84,72,0.25)',
                borderRadius: '1.25rem',
              }}
            >
              <div
                className="w-8 h-8 flex items-center justify-center shrink-0"
                style={{ background: 'rgba(168,84,72,0.15)', borderRadius: '0.75rem' }}
              >
                <AlertTriangle className="w-4 h-4" style={{ color: '#a85448' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: '#7a3028' }}>
                  Active Outbreak Alert · {topCritical.village}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#a85448' }}>
                  {topCritical.syndrome} — {topCritical.animalId} · <strong>{topCritical.risk.score}/100 CRITICAL</strong> · Veterinary investigation required
                </p>
              </div>
              <button
                onClick={() => navigate(`/cases/${topCritical.id}`)}
                className="shrink-0 text-xs font-bold flex items-center gap-1 transition-opacity hover:opacity-80"
                style={{ color: '#a85448' }}
              >
                View <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })()
        }

        {/* ── KPI cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            icon={AlertTriangle}
            label="Critical Cases"
            value={kpis.criticalCases}
            sub="Immediate attention"
            iconBg="rgba(168,84,72,0.12)"
            valueCls="text-red-700"
            onClick={() => navigate('/cases/all')}
          />
          <KPICard
            icon={TrendingUp}
            label="High Risk"
            value={kpis.highRiskCases}
            sub="Elevated risk"
            iconBg="rgba(193,140,93,0.15)"
            valueCls="text-orange-600"
          />
          <KPICard
            icon={Activity}
            label="Active Clusters"
            value={kpis.activeClusters}
            sub="Khandala · Khed"
            iconBg="rgba(109,40,217,0.1)"
            valueCls="text-violet-700"
            onClick={() => navigate('/map')}
          />
          <KPICard
            icon={FlaskConical}
            label="Pending Lab"
            value={kpis.pendingLab}
            sub="Awaiting results"
            iconBg="rgba(8,145,178,0.1)"
            valueCls="text-cyan-700"
          />
        </div>

        {/* ── Main grid ─────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Priority cases */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2
                className="section-title"
                style={{ fontFamily: "'Fraunces', serif", color: '#2c2c24' }}
              >
                Priority Cases
              </h2>
              <span className="text-xs" style={{ color: '#a0a08c' }}>Sorted by risk score</span>
            </div>

            <div
              className="overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.75)',
                borderRadius: '1.25rem',
                border: '1px solid rgba(222,216,207,0.6)',
                boxShadow: '0 2px 16px -2px rgba(93,112,82,0.08)',
              }}
            >
              {/* Table header (desktop) */}
              <div
                className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5"
                style={{
                  background: 'rgba(240,235,229,0.5)',
                  borderBottom: '1px solid rgba(222,216,207,0.6)',
                }}
              >
                {['Case / Animal', 'Location · Syndrome', 'Risk', 'Mortality', 'Status', ''].map((h, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: '#a0a08c', textAlign: i === 2 || i === 3 ? 'center' : 'left' }}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {priorityCases.map((c) => (
                <CaseRow
                  key={c.id}
                  c={c}
                  isPrimary={c.id === 'CASE-1042'}
                  onClick={() => navigate(`/cases/${c.id}`)}
                />
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Map preview */}
            <div
              className="overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.75)',
                borderRadius: '1.25rem',
                border: '1px solid rgba(222,216,207,0.6)',
                boxShadow: '0 2px 12px -2px rgba(93,112,82,0.08)',
              }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(222,216,207,0.5)' }}
              >
                <h3 className="section-title">Risk Map</h3>
                <button
                  onClick={() => navigate('/map')}
                  className="text-xs font-bold flex items-center gap-1 transition-opacity hover:opacity-70"
                  style={{ color: '#5d7052' }}
                >
                  <Map className="w-3.5 h-3.5" /> Full Map
                </button>
              </div>
              <div
                className="h-48 flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(93,112,82,0.08), rgba(93,112,82,0.04))',
                }}
                onClick={() => navigate('/map')}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center mb-2"
                  style={{ background: 'rgba(93,112,82,0.12)', borderRadius: '50%' }}
                >
                  <MapPin className="w-6 h-6" style={{ color: '#5d7052' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: '#4e5f45' }}>View Live Risk Map</p>
                <p className="text-xs mt-1" style={{ color: '#78786c' }}>
                  {kpis.criticalCases} critical · {kpis.activeClusters} clusters
                </p>
              </div>
            </div>

            {/* Active cluster summary */}
            <div
              className="p-4"
              style={{
                background: 'rgba(255,255,255,0.75)',
                borderRadius: '1.25rem',
                border: '1px solid rgba(222,216,207,0.6)',
                boxShadow: '0 2px 12px -2px rgba(93,112,82,0.08)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#dc2626' }} />
                <h3 className="section-title">Active Cluster</h3>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Cluster ID',        value: 'CLU-JUN-01' },
                  { label: 'Primary village',   value: 'Khandala' },
                  { label: 'Cases in cluster',  value: '5', highlight: true },
                  { label: 'Highest risk',      value: '88 · CRITICAL', danger: true },
                  { label: 'Protection zone',   value: '3 km' },
                  { label: 'Surveillance zone', value: '10 km' },
                ].map(({ label, value, highlight, danger }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: '#78786c' }}>{label}</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: danger ? '#a85448' : highlight ? '#dc2626' : '#2c2c24',
                        fontWeight: highlight || danger ? 800 : 600,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/map')}
                className="btn-primary w-full justify-center mt-4 text-xs"
              >
                <MapPin className="w-3.5 h-3.5" /> View on Map
              </button>
            </div>

            {/* Recent activity */}
            <div
              className="p-4"
              style={{
                background: 'rgba(255,255,255,0.75)',
                borderRadius: '1.25rem',
                border: '1px solid rgba(222,216,207,0.6)',
                boxShadow: '0 2px 12px -2px rgba(93,112,82,0.08)',
              }}
            >
              <h3 className="section-title mb-3">Recent Activity</h3>
              <div className="space-y-3">
                {casesByRisk.slice(0, 4).map(c => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="w-full text-left flex items-start gap-2.5 group"
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ background: riskLevelHex(c.risk.level) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-semibold truncate transition-colors"
                        style={{ color: '#2c2c24' }}
                      >
                        {c.animalId} · {c.village}
                      </p>
                      <p className="text-[10px]" style={{ color: '#a0a08c' }}>{c.id}</p>
                    </div>
                    <span
                      className="text-[10px] font-black shrink-0"
                      style={{ color: riskLevelHex(c.risk.level) }}
                    >
                      {c.risk.score}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
