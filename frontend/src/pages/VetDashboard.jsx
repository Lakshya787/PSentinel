import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, FlaskConical, MapPin, Bell, ChevronRight,
  Activity, Stethoscope, RefreshCw, Wifi, WifiOff,
  CheckCircle2, Clock, ArrowUpRight, UserCheck, Syringe,
  TrendingUp, ClipboardList, Eye,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/ui/StatusBadge'
import { riskLevelHex, calculateRisk } from '../utils/riskEngine'
import { api } from '../utils/api'

// ─── Risk tier badge ──────────────────────────────────────────────────────────
function RiskBadge({ level, score }) {
  const configs = {
    CRITICAL: { bg: 'rgba(220,38,38,0.15)', color: '#dc2626', border: 'rgba(220,38,38,0.35)' },
    HIGH:     { bg: 'rgba(234,88,12,0.12)',  color: '#ea580c', border: 'rgba(234,88,12,0.3)'  },
    MEDIUM:   { bg: 'rgba(202,138,4,0.12)',  color: '#ca8a04', border: 'rgba(202,138,4,0.3)'  },
    LOW:      { bg: 'rgba(93,112,82,0.12)',  color: '#5d7052', border: 'rgba(93,112,82,0.3)'  },
  }
  const c = configs[level] ?? configs.LOW
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '1.2rem', fontWeight: 900, color: c.color, lineHeight: 1, margin: 0 }}>{score}</p>
      <span style={{
        fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: c.color, background: c.bg, border: `1px solid ${c.border}`,
        padding: '0.15rem 0.4rem', borderRadius: '99px', whiteSpace: 'nowrap',
      }}>{level}</span>
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, iconBg, valueColor, sub, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', width: '100%',
        background: hover ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(10px)',
        borderRadius: '1.125rem',
        border: '1px solid rgba(222,216,207,0.7)',
        boxShadow: hover ? '0 4px 20px rgba(93,112,82,0.14)' : '0 2px 10px rgba(93,112,82,0.07)',
        padding: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        transform: hover && onClick ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: '1rem', height: '1rem' }} />
        </div>
        {onClick && <ArrowUpRight style={{ width: '0.875rem', height: '0.875rem', color: '#a0a08c' }} />}
      </div>
      <p style={{ fontSize: '1.6rem', fontWeight: 900, color: valueColor, lineHeight: 1, margin: '0 0 0.25rem', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5a5a50', margin: 0 }}>{label}</p>
      {sub && <p style={{ fontSize: '0.62rem', color: '#a0a08c', margin: '0.125rem 0 0' }}>{sub}</p>}
    </button>
  )
}

// ─── Case triage row ──────────────────────────────────────────────────────────
function TriageRow({ c, onClick }) {
  const [hover, setHover] = useState(false)
  const isCritical = c.risk?.level === 'CRITICAL'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '4px 1fr auto auto auto',
        alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1rem',
        background: hover
          ? isCritical ? 'rgba(220,38,38,0.06)' : 'rgba(0,0,0,0.025)'
          : isCritical ? 'rgba(220,38,38,0.035)' : 'transparent',
        borderBottom: '1px solid rgba(222,216,207,0.45)',
        transition: 'background 0.15s', cursor: 'pointer',
        border: 'none',
      }}
    >
      {/* Risk stripe */}
      <div style={{ width: '4px', height: '2.5rem', borderRadius: '2px', background: riskLevelHex(c.risk?.level ?? 'LOW'), flexShrink: 0 }} />

      {/* Main info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2c2c24' }}>{c.animalId ?? c.id}</span>
          <span style={{ fontSize: '0.68rem', color: '#78786c' }}>{c.species}</span>
          {isCritical && (
            <span style={{
              fontSize: '0.58rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em',
              color: '#a85448', background: 'rgba(168,84,72,0.12)', border: '1px solid rgba(168,84,72,0.25)',
              padding: '0.1rem 0.4rem', borderRadius: '99px',
            }}>Urgent</span>
          )}
        </div>
        <p style={{ fontSize: '0.72rem', color: '#78786c', margin: '0.15rem 0 0' }}>
          {c.village} · <span style={{ fontWeight: 600, color: '#5a5a50' }}>{c.syndrome}</span>
        </p>
        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <StatusBadge status={c.status} size="sm" />
          {c.mortality > 0 && (
            <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#dc2626' }}>✕{c.mortality} deaths</span>
          )}
        </div>
      </div>

      {/* Risk score */}
      <RiskBadge level={c.risk?.level ?? 'LOW'} score={c.risk?.score ?? 0} />

      {/* Assigned */}
      <div style={{ textAlign: 'center', fontSize: '0.65rem', color: '#a0a08c' }}>
        {c.assignedVet ? <UserCheck style={{ width: '0.875rem', height: '0.875rem', color: '#5d7052' }} /> : <Clock style={{ width: '0.875rem', height: '0.875rem', color: '#c18c5d' }} />}
      </div>

      <ChevronRight style={{ width: '1rem', height: '1rem', color: '#d0cbc4', flexShrink: 0 }} />
    </button>
  )
}

// ─── normalise backend case ───────────────────────────────────────────────────
function normaliseCase(c) {
  const rf = c.risk_factors ?? {}
  return {
    id: c.id ?? c.tag_id,
    animalId: c.tag_id ?? c.id,
    species: c.species,
    village: c.village,
    taluk: c.taluk,
    district: c.district,
    symptoms: c.symptoms ?? [],
    affectedAnimals: c.affected_animals ?? 1,
    mortality: c.mortality ?? 0,
    reportedBy: c.reported_by ?? '',
    assignedVet: c.assigned_vet ?? null,
    status: c.status,
    syndrome: c.syndrome ?? 'Undetermined',
    riskFactors: rf,
    risk: c.risk ?? (Object.keys(rf).length === 4
      ? calculateRisk(rf.clinical, rf.vaccination, rf.environmental, rf.spatial)
      : { score: 0, level: 'LOW', label: 'Low' }),
    reportedAt: c.reported_at,
    updatedAt: c.updated_at,
    notes: c.notes ?? '',
    timeline: c.timeline ?? [],
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function VetDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { casesByRisk: localCases, kpis: localKpis } = useCaseStore()
  const { isOnline } = useOnlineStatus()

  const [liveCases, setLiveCases] = useState(null)
  const [liveError, setLiveError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filterLevel, setFilterLevel] = useState('ALL')

  async function fetchCases() {
    try {
      setRefreshing(true)
      const data = await api.getCases({ limit: 100 })
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

  useEffect(() => { fetchCases() }, [])              // eslint-disable-line
  useEffect(() => { if (isOnline) fetchCases() }, [isOnline]) // eslint-disable-line

  const isLoading = liveCases === null && !liveError
  const displayCases = (liveCases && liveCases.length > 0) ? liveCases : localCases
  const isLive = liveCases && liveCases.length > 0

  const filtered = filterLevel === 'ALL' ? displayCases : displayCases.filter(c => c.risk?.level === filterLevel)

  const kpis = isLive ? {
    criticalCases: displayCases.filter(c => c.risk?.level === 'CRITICAL').length,
    highRiskCases: displayCases.filter(c => c.risk?.level === 'HIGH').length,
    pendingLab: displayCases.filter(c => c.status === 'LAB_TESTING').length,
    pendingReview: displayCases.filter(c => c.status === 'REPORTED').length,
  } : { ...localKpis, pendingReview: localCases.filter(c => c.status === 'REPORTED').length }

  const FILTER_OPTIONS = [
    { key: 'ALL',      label: 'All',      color: '#5a5a50' },
    { key: 'CRITICAL', label: 'Critical', color: '#dc2626' },
    { key: 'HIGH',     label: 'High',     color: '#ea580c' },
    { key: 'MEDIUM',   label: 'Medium',   color: '#ca8a04' },
    { key: 'LOW',      label: 'Low',      color: '#5d7052' },
  ]

  return (
    <div className="min-h-full animate-fadeIn" style={{ background: '#faf9f5' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 px-6 py-4"
        style={{
          background: 'rgba(253,252,248,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(222,216,207,0.65)',
          boxShadow: '0 2px 12px rgba(8,145,178,0.06)',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#0891b2' }} />
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 800, color: '#2c2c24', margin: 0, letterSpacing: '-0.02em' }}>
                Clinical Triage Board
              </h1>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#78786c', margin: '0.15rem 0 0' }}>
              Block Veterinary Officer · Junnar Taluk, Pune
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              fontSize: '0.7rem', fontWeight: 700,
              color: isLive ? '#0891b2' : '#c18c5d',
              background: isLive ? 'rgba(8,145,178,0.08)' : 'rgba(193,140,93,0.1)',
              padding: '0.3rem 0.625rem', borderRadius: '99px',
            }}>
              {isLoading
                ? <><RefreshCw style={{ width: '0.75rem', height: '0.75rem', animation: 'spin 1s linear infinite' }} /> Loading</>
                : isLive
                  ? <><Wifi style={{ width: '0.75rem', height: '0.75rem' }} /> Live ({displayCases.length})</>
                  : <><WifiOff style={{ width: '0.75rem', height: '0.75rem' }} /> Demo</>
              }
            </div>
            <button
              id="btn-vet-refresh"
              onClick={fetchCases}
              disabled={refreshing}
              style={{
                padding: '0.45rem', borderRadius: '0.625rem', border: '1px solid rgba(222,216,207,0.8)',
                background: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RefreshCw style={{ width: '0.875rem', height: '0.875rem', color: '#78786c', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              style={{ position: 'relative', padding: '0.45rem', borderRadius: '0.625rem', border: '1px solid rgba(222,216,207,0.8)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
            >
              <Bell style={{ width: '0.875rem', height: '0.875rem', color: '#78786c' }} />
              {kpis.criticalCases > 0 && (
                <span style={{ position: 'absolute', top: '0.3rem', right: '0.3rem', width: '0.45rem', height: '0.45rem', borderRadius: '50%', background: '#dc2626' }} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">

        {/* ── Critical alert ─────────────────────────────────────────────── */}
        {(() => {
          const top = displayCases.find(c => c.risk?.level === 'CRITICAL')
          if (!top) return null
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '0.875rem 1rem',
              background: 'linear-gradient(135deg, rgba(168,84,72,0.1), rgba(220,38,38,0.06))',
              border: '1px solid rgba(168,84,72,0.28)',
              borderRadius: '1.125rem',
            }}>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(168,84,72,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#a85448' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7a3028', margin: '0 0 0.15rem' }}>
                  🔴 CRITICAL Outbreak · {top.village}
                </p>
                <p style={{ fontSize: '0.72rem', color: '#a85448', margin: 0 }}>
                  {top.syndrome} — {top.animalId} · Risk Score {top.risk.score}/100 · Immediate clinical inspection required
                </p>
              </div>
              <button
                onClick={() => navigate(`/cases/${top.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#a85448', fontWeight: 800, fontSize: '0.78rem', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                Inspect <ChevronRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </div>
          )
        })()}

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="lg:grid-cols-4">
          <KPICard icon={AlertTriangle} label="Critical Cases" value={kpis.criticalCases} sub="Needs immediate action" iconBg="rgba(220,38,38,0.1)" valueColor="#dc2626" onClick={() => navigate('/cases/all')} />
          <KPICard icon={TrendingUp} label="High Risk" value={kpis.highRiskCases} sub="Priority follow-up" iconBg="rgba(234,88,12,0.1)" valueColor="#ea580c" />
          <KPICard icon={FlaskConical} label="Pending Lab" value={kpis.pendingLab} sub="Awaiting results" iconBg="rgba(8,145,178,0.1)" valueColor="#0891b2" onClick={() => navigate('/lab')} />
          <KPICard icon={ClipboardList} label="New Reports" value={kpis.pendingReview} sub="Awaiting review" iconBg="rgba(93,112,82,0.1)" valueColor="#5d7052" />
        </div>

        {/* ── Main layout ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: '1.25rem' }} className="lg:grid-cols-3">

          {/* Case triage queue — 2/3 width */}
          <div style={{ gridColumn: 'span 2' }} className="lg:col-span-2">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>
                Prioritised Triage Queue
              </h2>
              <button
                onClick={() => navigate('/cases/all')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0891b2', fontWeight: 700, fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                All cases <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
              </button>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setFilterLevel(opt.key)}
                  style={{
                    fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.03em',
                    padding: '0.3rem 0.625rem', borderRadius: '99px', cursor: 'pointer',
                    border: `1px solid ${filterLevel === opt.key ? opt.color : 'rgba(222,216,207,0.8)'}`,
                    background: filterLevel === opt.key ? `${opt.color}15` : 'rgba(255,255,255,0.7)',
                    color: filterLevel === opt.key ? opt.color : '#78786c',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                  {opt.key !== 'ALL' && (
                    <span style={{ marginLeft: '0.25rem', opacity: 0.7 }}>
                      ({displayCases.filter(c => c.risk?.level === opt.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Case list */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
              boxShadow: '0 2px 16px rgba(8,145,178,0.05)',
              overflow: 'hidden',
            }}>
              {/* Desktop header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '4px 1fr auto auto auto',
                gap: '0.875rem', padding: '0.625rem 1rem',
                background: 'rgba(240,235,229,0.5)',
                borderBottom: '1px solid rgba(222,216,207,0.6)',
              }} className="hidden md:grid">
                {['', 'Case / Animal / Location', 'Risk', 'Vet', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a0a08c', textAlign: i >= 2 ? 'center' : 'left' }}>
                    {h}
                  </span>
                ))}
              </div>

              {isLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <RefreshCw style={{ width: '1.5rem', height: '1.5rem', color: '#0891b2', animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
                  <p style={{ color: '#78786c', fontSize: '0.82rem' }}>Loading cases…</p>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <CheckCircle2 style={{ width: '2rem', height: '2rem', color: '#5d7052', margin: '0 auto 0.5rem' }} />
                  <p style={{ color: '#5d7052', fontWeight: 700, fontSize: '0.85rem' }}>No {filterLevel !== 'ALL' ? filterLevel.toLowerCase() : ''} cases</p>
                </div>
              ) : (
                filtered.slice(0, 12).map(c => (
                  <TriageRow key={c.id} c={c} onClick={() => navigate(`/cases/${c.id}`)} />
                ))
              )}
            </div>
          </div>

          {/* Right panel — 1/3 width */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Quick actions */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
              boxShadow: '0 2px 10px rgba(8,145,178,0.05)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(222,216,207,0.5)' }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '0.875rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>Quick Actions</h3>
              </div>
              <div style={{ padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {[
                  { icon: Eye, label: 'Review All Cases', sub: 'Full case ledger', color: '#5d7052', bg: 'rgba(93,112,82,0.08)', to: '/cases/all' },
                  { icon: FlaskConical, label: 'Lab Referrals', sub: 'Pending sample tests', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', to: '/lab' },
                  { icon: MapPin, label: 'Risk Map', sub: 'Geospatial outbreak view', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', to: '/map' },
                  { icon: Bell, label: 'Alerts', sub: 'Multilingual advisories', color: '#c18c5d', bg: 'rgba(193,140,93,0.08)', to: '/alerts' },
                  { icon: ClipboardList, label: 'New Field Report', sub: 'Submit syndromic case', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', to: '/field-report' },
                ].map(item => (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.75rem', borderRadius: '0.75rem',
                      border: '1px solid transparent',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = item.bg; e.currentTarget.style.borderColor = `${item.color}30` }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                  >
                    <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.icon style={{ width: '0.875rem', height: '0.875rem', color: item.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2c2c24', margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: '0.65rem', color: '#78786c', margin: 0 }}>{item.sub}</p>
                    </div>
                    <ChevronRight style={{ width: '0.875rem', height: '0.875rem', color: '#d0cbc4', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Active cluster */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
              boxShadow: '0 2px 10px rgba(8,145,178,0.05)',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#dc2626', animation: 'pulse 2s infinite', display: 'inline-block' }} />
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '0.875rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>Active Outbreak Cluster</h3>
              </div>
              {[
                { label: 'Cluster ID', value: 'CLU-JUN-01' },
                { label: 'Primary village', value: 'Khandala' },
                { label: 'Cases in cluster', value: '5', highlight: true },
                { label: 'Highest CRS', value: '88 · CRITICAL', danger: true },
                { label: 'Protection zone', value: '3 km cordon' },
                { label: 'Surveillance zone', value: '10 km ring' },
                { label: 'Vax gap', value: '41% unvaccinated', warn: true },
              ].map(({ label, value, highlight, danger, warn }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid rgba(222,216,207,0.4)', fontSize: '0.75rem' }}>
                  <span style={{ color: '#78786c' }}>{label}</span>
                  <span style={{ fontWeight: 700, color: danger ? '#a85448' : highlight ? '#dc2626' : warn ? '#b45309' : '#2c2c24' }}>{value}</span>
                </div>
              ))}
              <button
                onClick={() => navigate('/map')}
                style={{
                  width: '100%', marginTop: '0.875rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                  padding: '0.625rem', borderRadius: '0.75rem',
                  background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(8,145,178,0.25)',
                  color: '#0891b2', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(8,145,178,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(8,145,178,0.1)')}
              >
                <MapPin style={{ width: '0.875rem', height: '0.875rem' }} />
                View on Geospatial Map
              </button>
            </div>

            {/* Lab status summary */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
              boxShadow: '0 2px 10px rgba(8,145,178,0.05)',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '0.875rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>Lab Pipeline</h3>
                <button onClick={() => navigate('/lab')} style={{ color: '#0891b2', fontSize: '0.7rem', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>Open →</button>
              </div>
              {[
                { stage: 'Awaiting Collection', count: 2, color: '#78786c', bg: 'rgba(120,120,108,0.1)' },
                { stage: 'In Transit to Lab', count: 1, color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
                { stage: 'Lab Testing', count: kpis.pendingLab, color: '#0891b2', bg: 'rgba(8,145,178,0.1)' },
                { stage: 'Result Ready', count: 1, color: '#5d7052', bg: 'rgba(93,112,82,0.1)' },
              ].map(item => (
                <div key={item.stage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#5a5a50' }}>{item.stage}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: item.color, background: item.bg, padding: '0.15rem 0.5rem', borderRadius: '99px' }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}
