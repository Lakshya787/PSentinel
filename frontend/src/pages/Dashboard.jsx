import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, TrendingUp, FlaskConical, MapPin,
  Wifi, WifiOff, Bell, ChevronRight, Map, Activity,
  ArrowUpRight,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import StatusBadge from '../components/ui/StatusBadge'
import { riskLevelHex, riskLevelClasses } from '../utils/riskEngine'
import { formatDateTime } from '../utils/formatters'

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`card p-5 text-left w-full transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {onClick && <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />}
      </div>
      <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs font-semibold text-slate-600 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    </button>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { casesByRisk, kpis } = useCaseStore()
  const { isOnline } = useOnlineStatus()

  // Show top 10 by risk
  const priorityCases = casesByRisk.slice(0, 10)

  return (
    <div className="min-h-full">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              Veterinary Intelligence Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Junnar Taluk, Pune · Maharashtra
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg
              ${isOnline ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── CRITICAL ALERT BANNER ─────────────────────────────────── */}
        <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">
              Active Outbreak Alert · Khandala Cluster
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              High-risk syndrome detected. Vesicular / Podal — COW-1024 · 88/100 Critical. Veterinary investigation required.
            </p>
          </div>
          <button
            onClick={() => navigate('/cases/CASE-1042')}
            className="shrink-0 text-xs font-semibold text-red-700 hover:text-red-900 flex items-center gap-1"
          >
            View <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── KPI CARDS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={AlertTriangle}
            label="Critical Cases"
            value={kpis.criticalCases}
            sub="Immediate attention required"
            color="bg-red-100 text-red-600"
            onClick={() => navigate('/cases/all')}
          />
          <KPICard
            icon={TrendingUp}
            label="High Risk"
            value={kpis.highRiskCases}
            sub="Elevated disease risk"
            color="bg-orange-100 text-orange-600"
          />
          <KPICard
            icon={Activity}
            label="Active Clusters"
            value={kpis.activeClusters}
            sub="Khandala · Khed"
            color="bg-violet-100 text-violet-600"
            onClick={() => navigate('/map')}
          />
          <KPICard
            icon={FlaskConical}
            label="Pending Lab"
            value={kpis.pendingLab}
            sub="Awaiting results"
            color="bg-cyan-100 text-cyan-600"
          />
        </div>

        {/* ── MAIN GRID ─────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Priority Cases — takes 2/3 width */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Priority Cases</h2>
              <span className="text-xs text-slate-400">Sorted by risk score</span>
            </div>

            <div className="card overflow-hidden">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 px-4 py-2.5
                              bg-slate-50 border-b border-surface-border text-[10px] font-semibold
                              text-slate-500 uppercase tracking-widest">
                <span>Case / Animal</span>
                <span>Location · Syndrome</span>
                <span className="text-center">Risk</span>
                <span className="text-center">Mortality</span>
                <span>Status</span>
                <span />
              </div>

              {/* Rows */}
              <div className="divide-y divide-surface-border">
                {priorityCases.map((c, i) => {
                  const hex      = riskLevelHex(c.risk.level)
                  const isPrimary = c.id === 'CASE-1042'
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors
                        ${isPrimary ? 'bg-red-50/60 hover:bg-red-50' : ''}`}
                    >
                      {/* Mobile layout */}
                      <div className="md:hidden flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-500">{c.id}</span>
                            {isPrimary && (
                              <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full uppercase">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-900">{c.animalId}</p>
                          <p className="text-xs text-slate-500">{c.village} · {c.syndrome}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <StatusBadge status={c.status} size="sm" />
                            {c.mortality > 0 && (
                              <span className="text-[10px] font-semibold text-red-600">
                                ✕{c.mortality} mortality
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-black tabular-nums" style={{ color: hex }}>
                            {c.risk.score}
                          </p>
                          <p className="text-[10px] font-bold uppercase" style={{ color: hex }}>
                            {c.risk.level}
                          </p>
                        </div>
                      </div>

                      {/* Desktop layout */}
                      <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-3 items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">{c.id}</span>
                            {isPrimary && (
                              <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full uppercase">
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-900 truncate">{c.animalId}</p>
                          <p className="text-xs text-slate-500">{c.species}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{c.village}</p>
                          <p className="text-xs text-slate-500 truncate">{c.syndrome}</p>
                        </div>
                        <div className="text-center w-16">
                          <p className="text-lg font-black tabular-nums leading-none" style={{ color: hex }}>
                            {c.risk.score}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: hex }}>
                            {c.risk.level}
                          </p>
                        </div>
                        <div className="text-center w-16">
                          {c.mortality > 0
                            ? <span className="text-xs font-semibold text-red-600">✕{c.mortality}</span>
                            : <span className="text-xs text-slate-400">—</span>
                          }
                        </div>
                        <div>
                          <StatusBadge status={c.status} size="sm" />
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right panel — Map preview + stats */}
          <div className="space-y-4">
            {/* Map preview card */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
                <h3 className="section-title">Risk Map</h3>
                <button
                  onClick={() => navigate('/map')}
                  className="text-xs text-brand-600 font-semibold flex items-center gap-1 hover:text-brand-700"
                >
                  <Map className="w-3.5 h-3.5" />
                  Full Map
                </button>
              </div>
              <div
                className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col
                           items-center justify-center cursor-pointer hover:from-brand-50 hover:to-brand-100 transition-colors"
                onClick={() => navigate('/map')}
              >
                <MapPin className="w-8 h-8 text-brand-400 mb-2" />
                <p className="text-sm font-semibold text-slate-600">View Live Risk Map</p>
                <p className="text-xs text-slate-400 mt-1">
                  {kpis.criticalCases} critical · {kpis.activeClusters} clusters
                </p>
              </div>
            </div>

            {/* Cluster summary */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="section-title">Active Cluster</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cluster ID</span>
                  <span className="font-semibold text-slate-800">CLU-JUN-01</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Primary village</span>
                  <span className="font-semibold text-slate-800">Khandala</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Cases in cluster</span>
                  <span className="font-bold text-red-600">5</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Highest risk</span>
                  <span className="font-black text-red-600">88 · CRITICAL</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Protection zone</span>
                  <span className="font-semibold text-slate-800">3 km</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Surveillance zone</span>
                  <span className="font-semibold text-slate-800">10 km</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/map')}
                className="btn-primary w-full mt-4 justify-center text-xs"
              >
                <MapPin className="w-3.5 h-3.5" />
                View on Map
              </button>
            </div>

            {/* Recent activity */}
            <div className="card p-4">
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
                      <p className="text-xs font-semibold text-slate-800 group-hover:text-brand-700 truncate">
                        {c.animalId} · {c.village}
                      </p>
                      <p className="text-[10px] text-slate-400">{c.id}</p>
                    </div>
                    <span className="text-[10px] font-bold shrink-0" style={{ color: riskLevelHex(c.risk.level) }}>
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
