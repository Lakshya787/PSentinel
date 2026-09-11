import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, MapPin, Shield, Eye, ChevronRight,
  Layers, X,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import { KHANDALA_CLUSTER } from '../data/zones'
import { riskLevelHex } from '../utils/riskEngine'
import MapView from '../components/map/MapView'
import StatusBadge from '../components/ui/StatusBadge'

// ─── Zone legend ──────────────────────────────────────────────────────────────
function ZoneLegend() {
  return (
    <div className="space-y-2 text-xs">
      <p className="font-bold text-slate-700 text-[10px] uppercase tracking-widest mb-2">Markers</p>
      {[
        { color: '#7c3aed', label: 'Primary Case (COW-1024)' },
        { color: '#dc2626', label: 'Critical' },
        { color: '#ea580c', label: 'High Risk' },
        { color: '#ca8a04', label: 'Medium Risk' },
        { color: '#16a34a', label: 'Low Risk' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-slate-600">{label}</span>
        </div>
      ))}
      <div className="border-t border-surface-border my-2" />
      <p className="font-bold text-slate-700 text-[10px] uppercase tracking-widest mb-2">Zones</p>
      <div className="flex items-center gap-2">
        <span className="w-8 h-0.5 rounded-full bg-red-500" />
        <span className="text-slate-600">3 km Protection Zone</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 border-t-2 border-dashed border-orange-400" />
        <span className="text-slate-600">10 km Surveillance Zone</span>
      </div>
    </div>
  )
}

// ─── Info panel ───────────────────────────────────────────────────────────────
function GeoInfoPanel({ cluster, cases, onClose, onNavigate }) {
  const clusterCases = cases.filter(c => cluster.caseIds.includes(c.id))
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-900">Geographic Intelligence</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cluster alert */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <p className="text-sm font-bold text-red-800">Active Cluster Detected</p>
          </div>
          <p className="text-xs font-bold text-red-700">{cluster.label}</p>
          <p className="text-xs text-red-600 mt-1">Primary village: {cluster.village}, {cluster.taluk}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Cases in cluster', value: cluster.caseIds.length, color: 'text-red-600' },
            { label: 'Highest risk',     value: `${cluster.highestRisk} — Critical`, color: 'text-red-600' },
            { label: 'Protection zone',  value: '3 km radius' },
            { label: 'Surveillance',     value: '10 km radius' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card px-3 py-2.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
              <p className={`text-sm font-bold mt-0.5 ${color ?? 'text-slate-800'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Suggested action */}
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-widest mb-1">
            Suggested Action
          </p>
          <p className="text-sm font-bold text-brand-800">Immediate Veterinary Investigation</p>
          <p className="text-xs text-brand-600 mt-1">
            Deploy to Khandala village. Prioritise COW-1024 and nearby Khandala cases.
          </p>
        </div>

        {/* Cluster cases */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            Cluster Cases ({clusterCases.length})
          </p>
          <div className="space-y-1.5">
            {clusterCases.map(c => (
              <button
                key={c.id}
                onClick={() => onNavigate(`/cases/${c.id}`)}
                className="w-full text-left flex items-center justify-between px-3 py-2
                           rounded-lg bg-white border border-surface-border hover:border-brand-300
                           hover:bg-brand-50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: riskLevelHex(c.risk.level) }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{c.animalId}</p>
                    <p className="text-[10px] text-slate-400">{c.village} · {c.risk.score}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge status={c.status} size="sm" />
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-xs font-bold text-slate-600">Map Legend</p>
          </div>
          <ZoneLegend />
        </div>
      </div>
    </div>
  )
}

// ─── MapPage ──────────────────────────────────────────────────────────────────
export default function MapPage() {
  const navigate           = useNavigate()
  const { cases }          = useCaseStore()
  const [panelOpen, setPanelOpen] = useState(true)

  return (
    <div className="relative flex h-full min-h-screen lg:min-h-0 lg:h-[calc(100vh-0px)]">

      {/* ── Full-height map ──────────────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3
                        bg-white border-b border-surface-border absolute top-0 inset-x-0 z-10">
          <div>
            <h1 className="text-sm font-bold text-slate-900">Risk Map</h1>
            <p className="text-xs text-slate-500">Junnar Taluk, Pune</p>
          </div>
          <button
            onClick={() => setPanelOpen(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold"
          >
            <Eye className="w-3.5 h-3.5" />
            Intelligence
          </button>
        </div>

        <div className="absolute inset-0 lg:top-0 top-12">
          <MapView cases={cases} height="100%" />
        </div>

        {/* Map attribution overlay */}
        <div className="absolute bottom-8 left-3 z-10 bg-white/90 backdrop-blur-sm
                        border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-600 shadow-sm">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Shield className="w-3.5 h-3.5 text-brand-600" />
            Pashu Sentinel · Risk Map
          </div>
          <p className="text-slate-500 mt-0.5">{cases.length} cases · Pune District</p>
        </div>
      </div>

      {/* ── Desktop side panel ────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-80 shrink-0 bg-white border-l border-surface-border overflow-hidden">
        <GeoInfoPanel
          cluster={KHANDALA_CLUSTER}
          cases={cases}
          onNavigate={navigate}
        />
      </div>

      {/* ── Mobile bottom sheet ───────────────────────────────────── */}
      {panelOpen && (
        <div className="lg:hidden fixed inset-x-0 bottom-16 z-20 max-h-[60vh] overflow-hidden
                        bg-white rounded-t-2xl border-t border-surface-border shadow-2xl flex flex-col">
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <GeoInfoPanel
              cluster={KHANDALA_CLUSTER}
              cases={cases}
              onClose={() => setPanelOpen(false)}
              onNavigate={navigate}
            />
          </div>
        </div>
      )}
    </div>
  )
}
