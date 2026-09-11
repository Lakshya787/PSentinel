import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, MapPin, CheckCircle2, Clock, Zap,
  Globe, Building2, Activity, AlertTriangle, ChevronRight,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import WorkflowStepper from '../components/ui/WorkflowStepper'
import StatusBadge from '../components/ui/StatusBadge'
import { riskLevelHex } from '../utils/riskEngine'

const PRIMARY_CASE_ID = 'CASE-1042'

// ─── Initial action definitions (not stored — derived from defaults) ───────────
const INITIAL_ACTIONS = {
  isolate:      { id: 'isolate',      label: 'Isolate affected animals',      category: 'immediate', priority: 'URGENT', status: 'PENDING' },
  movement:     { id: 'movement',     label: 'Restrict livestock movement',   category: 'immediate', priority: 'URGENT', status: 'PENDING' },
  vetVisit:     { id: 'vetVisit',     label: 'Veterinary investigation',      category: 'immediate', priority: 'HIGH',   status: 'PENDING' },
  surveillance: { id: 'surveillance', label: 'Enhanced surveillance',         category: 'immediate', priority: 'HIGH',   status: 'PENDING' },
  vaccination:  { id: 'vaccination',  label: 'Ring vaccination',              category: 'area',      priority: 'URGENT', status: 'PENDING' },
  advisory:     { id: 'advisory',     label: 'Farmer advisory',               category: 'area',      priority: 'HIGH',   status: 'PENDING' },
  disinfection: { id: 'disinfection', label: 'Disinfection',                  category: 'area',      priority: 'HIGH',   status: 'PENDING' },
  fieldVisits:  { id: 'fieldVisits',  label: 'Veterinary visits',             category: 'area',      priority: 'MEDIUM', status: 'PENDING' },
  monitorVill:  { id: 'monitorVill',  label: 'Monitor nearby villages',       category: 'monitoring',priority: 'HIGH',   status: 'PENDING' },
  trackReports: { id: 'trackReports', label: 'Track new reports',             category: 'monitoring',priority: 'MEDIUM', status: 'PENDING' },
  vaccGap:      { id: 'vaccGap',      label: 'Review vaccination gaps',       category: 'monitoring',priority: 'MEDIUM', status: 'PENDING' },
}

const CATEGORY_META = {
  immediate:  { label: 'Immediate Response', color: 'text-red-700 bg-red-50 border-red-200'    },
  area:       { label: 'Area Response',      color: 'text-orange-700 bg-orange-50 border-orange-200' },
  monitoring: { label: 'Monitoring',         color: 'text-brand-700 bg-brand-50 border-brand-200' },
}

const PRIORITY_COLOR = {
  URGENT: 'text-red-600 bg-red-50 border-red-200',
  HIGH:   'text-orange-600 bg-orange-50 border-orange-200',
  MEDIUM: 'text-amber-600 bg-amber-50 border-amber-200',
}

// ─── Action item ─────────────────────────────────────────────────────────────
function ActionItem({ action, onActivate }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all
      ${action.status === 'IN_PROGRESS' ? 'bg-green-50 border-green-200' : 'bg-white border-surface-border hover:border-slate-300'}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0
          ${action.status === 'IN_PROGRESS' ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-300'}`}
        >
          {action.status === 'IN_PROGRESS'
            ? <CheckCircle2 className="w-3.5 h-3.5" />
            : <Clock className="w-3 h-3" />
          }
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${action.status === 'IN_PROGRESS' ? 'text-green-800' : 'text-slate-700'}`}>
            {action.label}
          </p>
          {action.startedAt && (
            <p className="text-[10px] text-green-600 mt-0.5">Started · In progress</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[action.priority]}`}>
          {action.priority}
        </span>
        {action.status !== 'IN_PROGRESS' && (
          <button
            onClick={() => onActivate(action.id)}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 border border-brand-200
                       hover:border-brand-300 px-2.5 py-1 rounded-lg transition-colors hover:bg-brand-50 whitespace-nowrap"
          >
            Activate
          </button>
        )}
      </div>
    </div>
  )
}

// ─── ActionsPage ──────────────────────────────────────────────────────────────
export default function ActionsPage() {
  const navigate                                     = useNavigate()
  const { getCase, updateContainment, updateNotifications } = useCaseStore()

  const c = getCase(PRIMARY_CASE_ID)
  if (!c) return null

  // Local action state (persisted to case.containment.actions in store)
  const savedActions  = c.containment?.actions ?? {}
  const [actions, setActionsLocal] = useState(() => {
    const merged = { ...INITIAL_ACTIONS }
    Object.keys(savedActions).forEach(k => { if (merged[k]) merged[k] = { ...merged[k], ...savedActions[k] } })
    return merged
  })

  const notifications = c.notifications ?? {}
  const hex           = riskLevelHex(c.risk.level)

  function activateAction(id) {
    const updated = {
      ...actions,
      [id]: { ...actions[id], status: 'IN_PROGRESS', startedAt: new Date().toISOString() },
    }
    setActionsLocal(updated)
    // Persist to store
    const anyActive = Object.values(updated).some(a => a.status === 'IN_PROGRESS')
    updateContainment(PRIMARY_CASE_ID, {
      actions: updated,
      status: anyActive ? 'ACTIVE' : 'PENDING',
    })
  }

  function handleDistrictNotify() {
    const current = notifications.district ?? 'NONE'
    const next = current === 'NONE' ? 'GENERATED' : current === 'GENERATED' ? 'SENT' : 'SENT'
    updateNotifications(PRIMARY_CASE_ID, { district: next, districtAt: new Date().toISOString() })
  }

  function handleOneHealth() {
    updateNotifications(PRIMARY_CASE_ID, { oneHealth: 'NOTIFIED', oneHealthAt: new Date().toISOString() })
  }

  const categories = ['immediate', 'area', 'monitoring']
  const inProgressCount = Object.values(actions).filter(a => a.status === 'IN_PROGRESS').length

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Containment Response</h1>
              <p className="text-xs text-slate-500">Disease Control Action Command</p>
            </div>
            <WorkflowStepper caseStatus={c.status} compact />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Case summary banner */}
        <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 flex items-center gap-4 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: hex + '20', color: hex }}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-bold text-slate-500">{c.id}</span>
                <span className="text-xs font-semibold text-slate-800">{c.animalId}</span>
                <StatusBadge status={c.status} size="sm" />
              </div>
              <p className="text-sm font-semibold text-slate-700">{c.village} · {c.syndrome}</p>
              {c.lab?.result && (
                <p className="text-xs text-red-600 font-semibold mt-0.5">
                  ✓ Lab confirmed: {c.lab.result.disease} ({c.lab.result.subtype})
                </p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black" style={{ color: hex }}>{c.risk.score}</p>
            <p className="text-[10px] font-bold uppercase" style={{ color: hex }}>{c.risk.level}</p>
          </div>
        </div>

        {/* Active actions count */}
        {inProgressCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl">
            <Activity className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-700">
              {inProgressCount} containment action{inProgressCount > 1 ? 's' : ''} in progress
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Recommended actions — takes 2/3 */}
          <div className="lg:col-span-2 space-y-5">
            {categories.map(cat => {
              const meta  = CATEGORY_META[cat]
              const items = Object.values(actions).filter(a => a.category === cat)
              return (
                <div key={cat}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold mb-3 ${meta.color}`}>
                    {cat === 'immediate' && <Zap className="w-3 h-3" />}
                    {cat === 'area'      && <MapPin className="w-3 h-3" />}
                    {cat === 'monitoring'&& <Activity className="w-3 h-3" />}
                    {meta.label}
                  </div>
                  <div className="space-y-2">
                    {items.map(action => (
                      <ActionItem key={action.id} action={action} onActivate={activateAction} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right panel */}
          <div className="space-y-4">

            {/* Zone-based response */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Zone-Based Response</h2>
              </div>
              <div className="space-y-3">
                <div className="border border-red-200 bg-red-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <p className="text-xs font-bold text-red-700">3 km Protection Zone</p>
                  </div>
                  <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
                    <li>Movement restriction enforced</li>
                    <li>Immediate vet visits required</li>
                    <li>Vaccination &amp; containment active</li>
                  </ul>
                </div>
                <div className="border border-orange-200 bg-orange-50 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                    <p className="text-xs font-bold text-orange-700">10 km Surveillance Zone</p>
                  </div>
                  <ul className="text-xs text-orange-600 space-y-1 list-disc list-inside">
                    <li>Enhanced daily surveillance</li>
                    <li>Farmer advisories issued</li>
                    <li>Additional reporting enabled</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => navigate('/map')}
                className="btn-secondary w-full justify-center mt-3 text-xs"
              >
                <MapPin className="w-3.5 h-3.5" />
                View on Risk Map
              </button>
            </div>

            {/* District notification */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">District Authority</h2>
              </div>

              <div className="text-xs space-y-1.5 mb-3 text-slate-600">
                {[
                  { label: 'Case',          value: c.id },
                  { label: 'Risk',          value: `${c.risk.score} — ${c.risk.level}`, danger: true },
                  { label: 'Area',          value: `${c.village}, ${c.taluk}` },
                  { label: 'Lab',           value: c.lab?.result ? `${c.lab.result.disease} (${c.lab.result.subtype})` : 'Pending' },
                  { label: 'Recommended',   value: 'Ring vaccination + Movement restriction' },
                ].map(({ label, value, danger }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <span className="text-slate-400 shrink-0">{label}:</span>
                    <span className={`font-medium text-right ${danger ? 'text-red-600' : 'text-slate-800'}`}>{value}</span>
                  </div>
                ))}
              </div>

              {notifications.district === 'SENT' ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-xs font-bold text-green-700">Notification Sent</p>
                </div>
              ) : (
                <button onClick={handleDistrictNotify} className="btn-primary w-full justify-center text-xs">
                  {notifications.district === 'GENERATED'
                    ? <><Send className="w-3 h-3" /> Send to District Authority</>
                    : <><Building2 className="w-3 h-3" /> Notify District Authority</>
                  }
                </button>
              )}
              {notifications.district === 'GENERATED' && (
                <p className="text-xs text-brand-600 mt-1.5 text-center font-semibold">
                  Notification generated — click to send
                </p>
              )}
            </div>

            {/* One Health */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">One Health Coordination</h2>
              </div>

              <div className="flex items-start gap-2 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  <strong>Potential public-health significance detected.</strong>{' '}
                  FMD has minimal direct zoonotic risk but confirmed disease events may warrant
                  coordination with public-health authorities per One Health protocols.
                </p>
              </div>

              {notifications.oneHealth === 'NOTIFIED' ? (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-green-700">IDSP Notification Generated</p>
                    <p className="text-[10px] text-green-600">Simulated · For demonstration only</p>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={handleOneHealth} className="btn-primary w-full justify-center text-xs">
                    <Globe className="w-3 h-3" />
                    Notify Public Health Authority
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    Simulated workflow — no actual notification is sent
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
