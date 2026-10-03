import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, MapPin, Bell, ChevronRight,
  Zap, Activity, Globe, Building2, RefreshCw,
  Wifi, WifiOff, Shield, Syringe,
  ArrowUpRight, BarChart3, Users, Radio, LogOut, ClipboardList,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useAuth } from '../context/AuthContext'
import { calculateRisk } from '../utils/riskEngine'
import { api } from '../utils/api'

// ─── District-level data (demo) ───────────────────────────────────────────────
const DISTRICT_BLOCKS = [
  { name: 'Junnar', cases: 8,  critCount: 2, highCount: 3, vaxCoverage: 59, risk: 'CRITICAL', color: '#dc2626' },
  { name: 'Ambegaon', cases: 4, critCount: 1, highCount: 2, vaxCoverage: 71, risk: 'HIGH',     color: '#ea580c' },
  { name: 'Khed',    cases: 5, critCount: 1, highCount: 1, vaxCoverage: 64, risk: 'HIGH',     color: '#ea580c' },
  { name: 'Shirur',  cases: 2, critCount: 0, highCount: 2, vaxCoverage: 82, risk: 'MEDIUM',   color: '#ca8a04' },
  { name: 'Bhor',    cases: 1, critCount: 0, highCount: 0, vaxCoverage: 89, risk: 'LOW',      color: '#5d7052' },
  { name: 'Haveli',  cases: 0, critCount: 0, highCount: 0, vaxCoverage: 93, risk: 'LOW',      color: '#5d7052' },
]

const VACCINATION_CAMPAIGNS = [
  { id: 'CAMP-001', block: 'Junnar', disease: 'FMD (Trivalent)', status: 'ACTIVE',    villages: 12, done: 7,   target: 3200, completed: 1820, color: '#0891b2' },
  { id: 'CAMP-002', block: 'Khed',   disease: 'HS + BQ',         status: 'SCHEDULED', villages: 8,  done: 0,   target: 2100, completed: 0,    color: '#5d7052' },
  { id: 'CAMP-003', block: 'Ambegaon', disease: 'PPR (Goats)',   status: 'COMPLETED', villages: 10, done: 10,  target: 1500, completed: 1500, color: '#16a34a' },
]

const ACTIVE_ACTIONS = [
  { id: 'ACT-01', type: 'QUARANTINE',  label: 'Livestock movement ban', location: 'Khandala, Junnar', priority: 'CRITICAL', since: '18h ago' },
  { id: 'ACT-02', type: 'VACCINATION', label: 'Ring vaccination',        location: '12 villages, Junnar', priority: 'HIGH', since: '6h ago' },
  { id: 'ACT-03', type: 'ALERT',       label: 'Vernacular SMS blast',    location: '450 farmers notified', priority: 'HIGH', since: '4h ago' },
  { id: 'ACT-04', type: 'CHECKPOINT',  label: 'Road checkpoints active', location: 'Khandala–Junnar road', priority: 'MEDIUM', since: '12h ago' },
]

const ZOONOTIC_ALERTS = [
  { disease: 'Brucellosis (zoonotic)', risk: 'HIGH', status: 'Surveillance initiated', notified: 'IDSP District Unit', color: '#ea580c' },
  { disease: 'FMD (human zoonotic risk: low)', risk: 'LOW', status: 'Monitoring only', notified: 'Public Health Unit', color: '#5d7052' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normaliseCase(c) {
  const rf = c.risk_factors ?? {}
  return {
    id: c.id ?? c.tag_id,
    animalId: c.tag_id ?? c.id,
    species: c.species,
    village: c.village,
    syndrome: c.syndrome ?? 'Undetermined',
    risk: c.risk ?? (Object.keys(rf).length === 4
      ? calculateRisk(rf.clinical, rf.vaccination, rf.environmental, rf.spatial)
      : { score: 0, level: 'LOW', label: 'Low' }),
    status: c.status,
    mortality: c.mortality ?? 0,
  }
}

// ─── Mini KPI ─────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, valueColor, iconBg, sub, badge, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left', width: '100%',
        background: hover ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(10px)',
        borderRadius: '1.125rem', border: '1px solid rgba(222,216,207,0.7)',
        boxShadow: hover ? '0 4px 20px rgba(180,83,9,0.12)' : '0 2px 10px rgba(180,83,9,0.06)',
        padding: '1rem', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s', transform: hover && onClick ? 'translateY(-1px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: '1rem', height: '1rem' }} />
        </div>
        {onClick && <ArrowUpRight style={{ width: '0.875rem', height: '0.875rem', color: '#a0a08c' }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
        <p style={{ fontSize: '1.6rem', fontWeight: 900, color: valueColor, lineHeight: 1, margin: 0, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        {badge && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: badge.color, background: badge.bg, padding: '0.1rem 0.375rem', borderRadius: '99px' }}>{badge.text}</span>}
      </div>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5a5a50', margin: '0.25rem 0 0' }}>{label}</p>
      {sub && <p style={{ fontSize: '0.62rem', color: '#a0a08c', margin: '0.1rem 0 0' }}>{sub}</p>}
    </button>
  )
}

// ─── Block row ────────────────────────────────────────────────────────────────
function BlockRow({ block, onClick }) {
  const [hover, setHover] = useState(false)
  const RISK_LABEL = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'WATCH', LOW: 'NORMAL' }
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left',
        display: 'grid', gridTemplateColumns: '3px 1fr auto auto auto auto',
        alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem',
        background: hover ? 'rgba(0,0,0,0.025)' : 'transparent',
        borderBottom: '1px solid rgba(222,216,207,0.45)',
        transition: 'background 0.15s', cursor: 'pointer', border: 'none',
      }}
    >
      <div style={{ width: '3px', height: '2rem', borderRadius: '2px', background: block.color }} />
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>{block.name} Block</p>
        <p style={{ fontSize: '0.68rem', color: '#78786c', margin: 0 }}>Pune District</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: 900, color: '#2c2c24', margin: 0 }}>{block.cases}</p>
        <p style={{ fontSize: '0.58rem', color: '#a0a08c', margin: 0 }}>Cases</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: 900, color: block.critCount > 0 ? '#dc2626' : '#78786c', margin: 0 }}>{block.critCount}</p>
        <p style={{ fontSize: '0.58rem', color: '#a0a08c', margin: 0 }}>Critical</p>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: block.vaxCoverage >= 80 ? '#5d7052' : block.vaxCoverage >= 65 ? '#ca8a04' : '#ea580c', margin: 0 }}>{block.vaxCoverage}%</p>
        <p style={{ fontSize: '0.58rem', color: '#a0a08c', margin: 0 }}>Vax</p>
      </div>
      <span style={{
        fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em',
        color: block.color, background: `${block.color}15`, border: `1px solid ${block.color}35`,
        padding: '0.2rem 0.5rem', borderRadius: '99px', whiteSpace: 'nowrap',
      }}>{RISK_LABEL[block.risk]}</span>
    </button>
  )
}

// ─── Campaign progress bar ────────────────────────────────────────────────────
function CampaignCard({ campaign }) {
  const pct = campaign.target > 0 ? Math.round((campaign.completed / campaign.target) * 100) : 0
  const STATUS_STYLE = {
    ACTIVE:    { color: '#0891b2', bg: 'rgba(8,145,178,0.1)',  label: '● Active'    },
    SCHEDULED: { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)', label: '◑ Scheduled' },
    COMPLETED: { color: '#5d7052', bg: 'rgba(93,112,82,0.1)', label: '✓ Done'      },
  }
  const s = STATUS_STYLE[campaign.status] ?? STATUS_STYLE.SCHEDULED
  return (
    <div style={{
      padding: '0.875rem', borderRadius: '0.875rem',
      border: '1px solid rgba(222,216,207,0.6)',
      background: 'rgba(253,252,248,0.5)', marginBottom: '0.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>{campaign.disease}</p>
          <p style={{ fontSize: '0.67rem', color: '#78786c', margin: '0.1rem 0 0' }}>{campaign.block} Block · {campaign.villages} villages</p>
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: s.color, background: s.bg, padding: '0.2rem 0.5rem', borderRadius: '99px' }}>{s.label}</span>
      </div>
      <div style={{ background: 'rgba(222,216,207,0.4)', borderRadius: '99px', height: '0.375rem', overflow: 'hidden', marginBottom: '0.375rem' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: campaign.color, borderRadius: '99px', transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#78786c' }}>
        <span>{campaign.completed.toLocaleString()} / {campaign.target.toLocaleString()} animals</span>
        <span style={{ fontWeight: 800, color: campaign.color }}>{pct}%</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function DVODashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { casesByRisk: localCases } = useCaseStore()
  const { isOnline } = useOnlineStatus()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const [liveCases, setLiveCases] = useState(null)
  const [liveError, setLiveError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => { fetchCases() }, [])              // eslint-disable-line
  useEffect(() => { if (isOnline) fetchCases() }, [isOnline]) // eslint-disable-line

  const isLoading = liveCases === null && !liveError
  const displayCases = (liveCases && liveCases.length > 0) ? liveCases : localCases
  const isLive = liveCases && liveCases.length > 0

  const totalCases = DISTRICT_BLOCKS.reduce((s, b) => s + b.cases, 0)
  const totalCritical = DISTRICT_BLOCKS.reduce((s, b) => s + b.critCount, 0)
  const avgVax = Math.round(DISTRICT_BLOCKS.reduce((s, b) => s + b.vaxCoverage, 0) / DISTRICT_BLOCKS.length)
  const activeCampaigns = VACCINATION_CAMPAIGNS.filter(c => c.status === 'ACTIVE').length

  return (
    <div className="min-h-full animate-fadeIn" style={{ background: '#faf9f5' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 px-6 py-4"
        style={{
          background: 'rgba(253,252,248,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(222,216,207,0.65)',
          boxShadow: '0 2px 12px rgba(180,83,9,0.07)',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: '#b45309' }} />
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.1rem', fontWeight: 800, color: '#2c2c24', margin: 0, letterSpacing: '-0.02em' }}>
                District Command Centre
              </h1>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#78786c', margin: '0.15rem 0 0' }}>
              District Veterinary Officer · Pune District, Maharashtra
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              fontSize: '0.7rem', fontWeight: 700,
              color: isLive ? '#b45309' : '#c18c5d',
              background: isLive ? 'rgba(180,83,9,0.08)' : 'rgba(193,140,93,0.1)',
              padding: '0.3rem 0.625rem', borderRadius: '99px',
            }}>
              {isLoading
                ? <><RefreshCw style={{ width: '0.75rem', height: '0.75rem', animation: 'spin 1s linear infinite' }} /> Loading</>
                : isLive
                  ? <><Wifi style={{ width: '0.75rem', height: '0.75rem' }} /> Live ({displayCases.length} cases)</>
                  : <><WifiOff style={{ width: '0.75rem', height: '0.75rem' }} /> Demo</>
              }
            </div>
            <button
              id="btn-dvo-refresh"
              onClick={fetchCases}
              disabled={refreshing}
              style={{ padding: '0.45rem', borderRadius: '0.625rem', border: '1px solid rgba(222,216,207,0.8)', background: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw style={{ width: '0.875rem', height: '0.875rem', color: '#78786c', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              onClick={() => navigate('/field-report')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.45rem 0.75rem', borderRadius: '0.625rem',
                background: 'rgba(93,112,82,0.1)', border: '1px solid rgba(93,112,82,0.25)',
                color: '#5d7052', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              <ClipboardList style={{ width: '0.75rem', height: '0.75rem' }} />
              File Report
            </button>
            <button
              onClick={() => navigate('/actions')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.45rem 0.875rem', borderRadius: '0.625rem',
                background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
                color: '#dc2626', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              <Zap style={{ width: '0.75rem', height: '0.75rem' }} />
              Command Actions
            </button>
            <button
              id="btn-dvo-logout"
              onClick={handleLogout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.45rem 0.625rem', borderRadius: '0.625rem',
                background: 'rgba(168,84,72,0.08)', border: '1px solid rgba(168,84,72,0.2)',
                color: '#a85448', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              <LogOut style={{ width: '0.75rem', height: '0.75rem' }} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-5 space-y-5">

        {/* ── District alert banner ──────────────────────────────────────── */}
        <div style={{
          display: 'grid', gap: '0.75rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        }}>
          {/* Primary outbreak */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
            padding: '0.875rem 1rem',
            background: 'linear-gradient(135deg, rgba(168,84,72,0.12), rgba(220,38,38,0.06))',
            border: '1px solid rgba(168,84,72,0.3)',
            borderRadius: '1.125rem',
          }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(168,84,72,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#a85448' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7a3028', margin: '0 0 0.2rem' }}>🔴 Junnar Block — Confirmed FMD Outbreak</p>
              <p style={{ fontSize: '0.7rem', color: '#a85448', margin: 0, lineHeight: 1.4 }}>
                RT-PCR confirmed Serotype O. 3 km movement cordon active. RRT deployed. Ring vaccination initiated.
              </p>
            </div>
            <button
              onClick={() => navigate('/actions')}
              style={{ color: '#a85448', fontWeight: 800, fontSize: '0.72rem', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              Manage <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
            </button>
          </div>

          {/* Zoonotic cross-notification */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
            padding: '0.875rem 1rem',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(124,58,237,0.04))',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: '1.125rem',
          }}>
            <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem', background: 'rgba(124,58,237,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield style={{ width: '1rem', height: '1rem', color: '#7c3aed' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#5b21b6', margin: '0 0 0.2rem' }}>One Health — IDSP Notified</p>
              <p style={{ fontSize: '0.7rem', color: '#7c3aed', margin: 0, lineHeight: 1.4 }}>
                Brucellosis cluster flagged. District IDSP Unit and PHO alerted. Human exposure screening initiated.
              </p>
            </div>
          </div>
        </div>

        {/* ── District KPIs ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }} className="lg:grid-cols-4">
          <KPICard
            icon={Building2} label="District Cases" value={totalCases}
            sub="All 6 blocks" iconBg="rgba(180,83,9,0.1)" valueColor="#b45309"
            onClick={() => navigate('/cases/all')}
          />
          <KPICard
            icon={AlertTriangle} label="Critical Events" value={totalCritical}
            sub="Immediate response" iconBg="rgba(220,38,38,0.1)" valueColor="#dc2626"
            badge={{ text: 'RRT Active', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' }}
          />
          <KPICard
            icon={Syringe} label="Avg Vax Coverage" value={`${avgVax}%`}
            sub="District average" iconBg="rgba(93,112,82,0.1)" valueColor={avgVax >= 80 ? '#5d7052' : '#ea580c'}
            onClick={() => navigate('/actions')}
          />
          <KPICard
            icon={Activity} label="Active Campaigns" value={activeCampaigns}
            sub="Ring vaccination ops" iconBg="rgba(8,145,178,0.1)" valueColor="#0891b2"
          />
        </div>

        {/* ── Main 3-column grid ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gap: '1.25rem' }} className="lg:grid-cols-3">

          {/* LEFT: Block breakdown — 2 cols */}
          <div style={{ gridColumn: 'span 2' }} className="lg:col-span-2">

            {/* Block risk table */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>Block-Level Risk Overview</h2>
                <button onClick={() => navigate('/map')} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#b45309', fontWeight: 700, fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Map View <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
                borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
                boxShadow: '0 2px 16px rgba(180,83,9,0.05)', overflow: 'hidden',
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '3px 1fr auto auto auto auto',
                  gap: '0.875rem', padding: '0.625rem 1rem',
                  background: 'rgba(240,235,229,0.5)', borderBottom: '1px solid rgba(222,216,207,0.6)',
                }}>
                  {['', 'Block', 'Cases', 'Critical', 'Vax %', 'Status'].map((h, i) => (
                    <span key={i} style={{ fontSize: '0.62rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a0a08c', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</span>
                  ))}
                </div>
                {DISTRICT_BLOCKS.map(block => (
                  <BlockRow key={block.name} block={block} onClick={() => navigate('/map')} />
                ))}
              </div>
            </div>

            {/* Vaccination campaigns */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '1rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>Vaccination Campaign Tracker</h2>
                <button onClick={() => navigate('/actions')} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#b45309', fontWeight: 700, fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Manage <ChevronRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
                borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
                boxShadow: '0 2px 16px rgba(180,83,9,0.05)', padding: '1rem',
              }}>
                {VACCINATION_CAMPAIGNS.map(camp => (
                  <CampaignCard key={camp.id} campaign={camp} />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Command panel — 1 col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Quick command actions */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
              boxShadow: '0 2px 10px rgba(180,83,9,0.06)', overflow: 'hidden',
            }}>
              <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(222,216,207,0.5)' }}>
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '0.875rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>District Command Actions</h3>
              </div>
              <div style={{ padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {[
                  { icon: Zap,       label: 'Incident Command',   sub: 'Active response orders', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', to: '/actions' },
                  { icon: MapPin,    label: 'District Risk Map',   sub: 'Outbreak spread view', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', to: '/map' },
                  { icon: Bell,      label: 'Broadcast Alerts',    sub: 'Multilingual SMS/IVR', color: '#b45309', bg: 'rgba(180,83,9,0.08)', to: '/alerts' },
                  { icon: BarChart3, label: 'All Cases',           sub: 'District case ledger', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', to: '/cases/all' },
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

            {/* Active response actions */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
              boxShadow: '0 2px 10px rgba(180,83,9,0.06)', padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <Radio style={{ width: '0.875rem', height: '0.875rem', color: '#dc2626' }} />
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '0.875rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>Active Response Orders</h3>
              </div>
              {ACTIVE_ACTIONS.map(action => {
                const PRIO = {
                  CRITICAL: { color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
                  HIGH:     { color: '#ea580c', bg: 'rgba(234,88,12,0.1)' },
                  MEDIUM:   { color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
                }
                const p = PRIO[action.priority] ?? PRIO.MEDIUM
                return (
                  <div key={action.id} style={{ padding: '0.625rem 0', borderBottom: '1px solid rgba(222,216,207,0.4)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                      <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2c2c24', margin: 0, flex: 1, paddingRight: '0.5rem' }}>{action.label}</p>
                      <span style={{ fontSize: '0.6rem', fontWeight: 800, color: p.color, background: p.bg, padding: '0.15rem 0.375rem', borderRadius: '99px', flexShrink: 0 }}>{action.priority}</span>
                    </div>
                    <p style={{ fontSize: '0.65rem', color: '#78786c', margin: 0 }}>{action.location} · {action.since}</p>
                  </div>
                )
              })}
              <button
                onClick={() => navigate('/actions')}
                style={{
                  width: '100%', marginTop: '0.875rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                  padding: '0.625rem', borderRadius: '0.75rem',
                  background: 'rgba(180,83,9,0.1)', border: '1px solid rgba(180,83,9,0.25)',
                  color: '#b45309', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(180,83,9,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(180,83,9,0.1)')}
              >
                <Zap style={{ width: '0.875rem', height: '0.875rem' }} />
                Full Incident Command
              </button>
            </div>

            {/* One Health / Zoonotic panel */}
            <div style={{
              background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)',
              borderRadius: '1.25rem', border: '1px solid rgba(124,58,237,0.2)',
              boxShadow: '0 2px 10px rgba(124,58,237,0.06)', padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <Globe style={{ width: '0.875rem', height: '0.875rem', color: '#7c3aed' }} />
                <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: '0.875rem', fontWeight: 800, color: '#2c2c24', margin: 0 }}>One Health · IDSP Cross-Alerts</h3>
              </div>
              {ZOONOTIC_ALERTS.map((za, i) => (
                <div key={i} style={{ padding: '0.625rem 0', borderBottom: i < ZOONOTIC_ALERTS.length - 1 ? '1px solid rgba(222,216,207,0.4)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2c2c24', margin: 0 }}>{za.disease}</p>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: za.color, background: `${za.color}15`, padding: '0.15rem 0.375rem', borderRadius: '99px' }}>{za.risk}</span>
                  </div>
                  <p style={{ fontSize: '0.65rem', color: '#78786c', margin: 0 }}>{za.status} · {za.notified}</p>
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
