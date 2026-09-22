import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, MapPin, CheckCircle2, Clock, Zap,
  Globe, Building2, Activity, AlertTriangle, ChevronRight,
  Send, Plus, FileText, Check, Copy, ExternalLink,
  Users, RefreshCw, X, Radio, Filter, ChevronDown, Award
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import WorkflowStepper from '../components/ui/WorkflowStepper'
import StatusBadge from '../components/ui/StatusBadge'
import { calculateRisk, riskLevelHex } from '../utils/riskEngine'
import { api } from '../utils/api'

// ─── Initial action definitions ────────────────────────────────────────────────
const DEFAULT_ACTIONS = {
  isolate: {
    id: 'isolate',
    label: 'Isolate affected animals in quarantine shed',
    category: 'immediate',
    priority: 'URGENT',
    status: 'PENDING',
    target: 'Farm Level',
    protocol: 'Separate symptomatic cattle min 50m away from healthy herd; dedicate separate feed & water troughs.',
  },
  movement: {
    id: 'movement',
    label: 'Enforce livestock movement restriction (3 km radius)',
    category: 'immediate',
    priority: 'URGENT',
    status: 'PENDING',
    target: 'Village Perimeter',
    protocol: 'Halt all inter-village animal transport, weekly cattle markets (haats), and grazing migration.',
  },
  vetVisit: {
    id: 'vetVisit',
    label: 'Deploy Rapid Response Veterinary Team (RRT)',
    category: 'immediate',
    priority: 'URGENT',
    status: 'PENDING',
    target: 'Taluk Level',
    protocol: 'Deploy Dr. Deshmukh + 2 Livestock Supervisors with PPE, sample transport kits, and emergency supportive drugs.',
  },
  disinfection: {
    id: 'disinfection',
    label: 'Deep disinfection of sheds & water sources',
    category: 'immediate',
    priority: 'HIGH',
    status: 'PENDING',
    target: 'Farm Level',
    protocol: 'Spray 4% Sodium Carbonate (washing soda) or 1% Virkon-S on shed floors, stalls, and farm entry points.',
  },
  vaccination: {
    id: 'vaccination',
    label: 'Ring vaccination campaign (3-10 km perimeter)',
    category: 'area',
    priority: 'URGENT',
    status: 'PENDING',
    target: 'Protection Zone',
    protocol: 'Administer polyvalent FMD trivalent oil-adjuvant vaccine to all susceptible cloven-hoofed livestock starting outer ring inward.',
  },
  advisory: {
    id: 'advisory',
    label: 'Broadcast vernacular SMS/IVR farmer advisory',
    category: 'area',
    priority: 'HIGH',
    status: 'PENDING',
    target: 'Gram Panchayat',
    protocol: 'Send automated Marathi & Hindi voice and text alerts to registered cattle owners via Pashu Sentinel SMS Gateway.',
  },
  checkpoints: {
    id: 'checkpoints',
    label: 'Erect quarantine road checkpoints at major junctions',
    category: 'area',
    priority: 'HIGH',
    status: 'PENDING',
    target: 'Access Corridors',
    protocol: 'Station police & revenue personnel with lime-wash wheel dips on Khandala-Narayangaon & Otur junction routes.',
  },
  fieldVisits: {
    id: 'fieldVisits',
    label: 'Active syndromic house-to-house screening',
    category: 'monitoring',
    priority: 'HIGH',
    status: 'PENDING',
    target: 'Surveillance Zone',
    protocol: 'Daily physical thermal and oral examination of all herds within 10 km by Livestock Development Officers.',
  },
  milkScreening: {
    id: 'milkScreening',
    label: 'Bulk milk collection center surveillance',
    category: 'monitoring',
    priority: 'MEDIUM',
    status: 'PENDING',
    target: 'Dairy Cooperatives',
    protocol: 'Coordinate with Junnar Taluk Dairy Cooperatives to screen incoming bulk tank milk and report drop in yields.',
  },
  trackReports: {
    id: 'trackReports',
    label: 'Real-time syndromic telemetry tracking',
    category: 'monitoring',
    priority: 'MEDIUM',
    status: 'PENDING',
    target: 'Command Hub',
    protocol: 'Monitor continuous incoming mobile field reports and spatial cluster expansion on DBSCAN live map.',
  },
  vaccGap: {
    id: 'vaccGap',
    label: 'Audit historical vaccination coverage gaps',
    category: 'monitoring',
    priority: 'MEDIUM',
    status: 'PENDING',
    target: 'Taluk Database',
    protocol: 'Cross-reference INAPH/NDDB records for missed booster shots in adjacent villages (Jejuri, Saswad, Khed).',
  },
}

const CATEGORY_META = {
  immediate: {
    label: 'Immediate Response (0–24h)',
    color: 'text-red-700 bg-red-50 border-red-200',
    badgeBg: 'bg-red-500',
  },
  area: {
    label: 'Area Containment (24–48h)',
    color: 'text-orange-700 bg-orange-50 border-orange-200',
    badgeBg: 'bg-orange-500',
  },
  monitoring: {
    label: 'Surveillance & Monitoring (Day 3–14)',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeBg: 'bg-emerald-500',
  },
}

const PRIORITY_COLOR = {
  URGENT: 'text-red-700 bg-red-50 border-red-200',
  HIGH:   'text-orange-700 bg-orange-50 border-orange-200',
  MEDIUM: 'text-amber-700 bg-amber-50 border-amber-200',
}

// ─── Single Action Card ────────────────────────────────────────────────────────
function ActionCard({ action, onActivate, onComplete, onReset }) {
  const [expanded, setExpanded] = useState(false)

  const isCompleted  = action.status === 'COMPLETED'
  const isInProgress = action.status === 'IN_PROGRESS'
  const isPending    = !isInProgress && !isCompleted

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isCompleted
          ? 'bg-emerald-50/70 border-emerald-200 shadow-sm'
          : isInProgress
            ? 'bg-amber-50/60 border-amber-300 shadow-md ring-1 ring-amber-200'
            : 'bg-white border-surface-border hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Status icon indicator */}
            <button
              onClick={() => {
                if (isPending) onActivate(action.id)
                else if (isInProgress) onComplete(action.id)
                else onReset(action.id)
              }}
              title={isPending ? 'Click to activate' : isInProgress ? 'Click to mark completed' : 'Click to reset'}
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                isCompleted
                  ? 'bg-emerald-600 text-white shadow'
                  : isInProgress
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : isInProgress ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className={`text-sm font-bold ${
                    isCompleted
                      ? 'text-emerald-900 line-through decoration-emerald-500/60'
                      : isInProgress
                        ? 'text-amber-950 font-black'
                        : 'text-slate-800'
                  }`}
                >
                  {action.label}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[action.priority]}`}>
                  {action.priority}
                </span>

                {action.target && (
                  <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                    📍 {action.target}
                  </span>
                )}

                {isInProgress && action.startedAt && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    In Progress
                  </span>
                )}

                {isCompleted && action.completedAt && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                    ✓ Enforced & Completed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isPending && (
              <button
                onClick={() => onActivate(action.id)}
                className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100
                           border border-emerald-200 px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                Activate
              </button>
            )}

            {isInProgress && (
              <button
                onClick={() => onComplete(action.id)}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700
                           px-3 py-1.5 rounded-lg transition-all shadow-sm flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete
              </button>
            )}

            {isCompleted && (
              <button
                onClick={() => onReset(action.id)}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                title="Reset status"
              >
                Reset
              </button>
            )}

            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              title="View operational protocol"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expandable Protocol Drawer */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-2 bg-slate-50/60 p-3 rounded-lg animate-fadeIn">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-brand-600" />
              Standard Operating Protocol (SOP):
            </p>
            <p className="text-slate-600 leading-relaxed pl-5">
              {action.protocol || 'Follow standard state veterinary containment guidelines.'}
            </p>
            {action.startedAt && (
              <p className="text-[10px] text-slate-400 pl-5">
                Activated at: {new Date(action.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Official Containment Directive Modal ──────────────────────────────────────
function OrderModal({ caseObj, onClose }) {
  const [copied, setCopied] = useState(false)

  const orderNumber = `MH/PUNE/VET-EPID/${new Date().getFullYear()}/${caseObj?.id || '1042'}`
  const orderDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })

  const orderText = `GOVERNMENT OF MAHARASHTRA
DEPARTMENT OF ANIMAL HUSBANDRY & DISASTER MANAGEMENT
DISTRICT EPIDEMIOLOGICAL COMMAND CENTER — PUNE

ORDER NO: ${orderNumber}
DATE: ${orderDate}

SUBJECT: DECLARATION OF CONTROLLED AREA & CONTAINMENT NOTIFICATION UNDER SECTION 6 OF THE PREVENTION AND CONTROL OF INFECTIOUS AND CONTAGIOUS DISEASES IN ANIMALS ACT, 2009.

WHEREAS, an acute outbreak of suspected/confirmed ${caseObj?.syndrome || 'Foot-and-Mouth Disease (FMD)'} (Case Ref: ${caseObj?.id || 'CASE-1042'}) has been recorded in Village: ${caseObj?.village || 'Khandala'}, Taluk: ${caseObj?.taluk || 'Junnar'}, District: Pune.

NOW THEREFORE, in exercise of powers vested under the Act, the following containment measures are hereby enforced with immediate effect:

1. PROTECTION ZONE (3 KM RADIUS):
   - Strict prohibition of ingress and egress of cloven-hoofed livestock.
   - Immediate suspension of weekly animal haats/markets in Khandala, Narayangaon and Otur.
   - Ring vaccination of all susceptible stock within 72 hours.

2. SURVEILLANCE ZONE (10 KM RADIUS):
   - Daily syndromic house-to-house screening by assigned Livestock Supervisors.
   - Bulk milk cooling tank monitoring across all dairy cooperative units.

3. RAPID RESPONSE TEAMS:
   - Veterinary Officer in-charge: Dr. Deshmukh (Junnar Taluk).
   - Checkpoints Alpha & Beta activated with 24x7 chemical wheel dips.

BY ORDER OF:
District Veterinary Officer (DVO), Pune
In Coordination with District Collector & Magistrate`

  function handleCopy() {
    navigator.clipboard.writeText(orderText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">Government Gazette Containment Order</h3>
              <p className="text-[10px] text-slate-400">Section 6, Infectious Diseases in Animals Act, 2009</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 space-y-3 bg-amber-50/30">
          <pre className="whitespace-pre-wrap leading-relaxed text-slate-700 select-all">{orderText}</pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-sans">Official Gazetted Document</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy Order Text'}
            </button>
            <button
              onClick={() => {
                window.print()
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-700 rounded-xl hover:bg-brand-800 transition-colors shadow-sm"
            >
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ActionsPage Main Component ───────────────────────────────────────────────
export default function ActionsPage() {
  const navigate = useNavigate()
  const { cases, casesByRisk, getCase, updateContainment, updateNotifications, advanceStatus } = useCaseStore()

  // Selected case state (defaults to CASE-1042 or highest risk)
  const [selectedCaseId, setSelectedCaseId] = useState('CASE-1042')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [newActionModal, setNewActionModal] = useState(false)
  const [customLabel,    setCustomLabel]    = useState('')
  const [customCategory, setCustomCategory] = useState('immediate')
  const [customPriority, setCustomPriority] = useState('HIGH')
  const [vaxCount,       setVaxCount]       = useState(420)
  const [toastMsg,       setToastMsg]       = useState(null)
  const [advancing,      setAdvancing]      = useState(false)

  // Find active case safely
  const availableCases = casesByRisk.length > 0 ? casesByRisk : cases
  const c = getCase(selectedCaseId) || availableCases[0] || {
    id: 'CASE-1042',
    animalId: 'COW-1024',
    species: 'Cattle',
    village: 'Khandala',
    taluk: 'Junnar',
    district: 'Pune',
    syndrome: 'Foot-and-Mouth Disease (FMD)',
    status: 'ALERT_SENT',
    risk: { score: 88, level: 'CRITICAL' },
    lab: { result: { disease: 'Foot-and-Mouth Disease', subtype: 'Serotype O' } },
  }

  // Merge saved action state
  const savedActions = c?.containment?.actions ?? {}
  const [actions, setActionsLocal] = useState(() => {
    const merged = { ...DEFAULT_ACTIONS }
    Object.keys(savedActions).forEach(k => {
      if (merged[k]) merged[k] = { ...merged[k], ...savedActions[k] }
      else merged[k] = savedActions[k]
    })
    return merged
  })

  // Sync actions when selected case changes
  useEffect(() => {
    const currentSaved = c?.containment?.actions ?? {}
    const merged = { ...DEFAULT_ACTIONS }
    Object.keys(currentSaved).forEach(k => {
      if (merged[k]) merged[k] = { ...merged[k], ...currentSaved[k] }
      else merged[k] = currentSaved[k]
    })
    setActionsLocal(merged)
  }, [c?.id])

  const notifications = c?.notifications ?? {}
  const hex = riskLevelHex(c?.risk?.level ?? 'HIGH')

  // Feedback Toast Helper
  function triggerToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // Action mutation handlers
  function handleActivateAction(id) {
    const updated = {
      ...actions,
      [id]: { ...actions[id], status: 'IN_PROGRESS', startedAt: new Date().toISOString() },
    }
    setActionsLocal(updated)
    updateContainment(c.id, { actions: updated, status: 'ACTIVE' })
    triggerToast(`Activated: ${actions[id].label}`)
  }

  function handleCompleteAction(id) {
    const updated = {
      ...actions,
      [id]: { ...actions[id], status: 'COMPLETED', completedAt: new Date().toISOString() },
    }
    setActionsLocal(updated)
    updateContainment(c.id, { actions: updated, status: 'ACTIVE' })
    triggerToast(`Completed: ${actions[id].label}`)
  }

  function handleResetAction(id) {
    const updated = {
      ...actions,
      [id]: { ...actions[id], status: 'PENDING', startedAt: null, completedAt: null },
    }
    setActionsLocal(updated)
    updateContainment(c.id, { actions: updated })
  }

  // Add custom action
  function handleAddCustomAction(e) {
    e.preventDefault()
    if (!customLabel.trim()) return
    const id = `custom_${Date.now()}`
    const newAct = {
      id,
      label: customLabel.trim(),
      category: customCategory,
      priority: customPriority,
      status: 'PENDING',
      target: 'Field Team',
      protocol: 'Ad-hoc field task assigned by Veterinary Officer.',
    }
    const updated = { ...actions, [id]: newAct }
    setActionsLocal(updated)
    updateContainment(c.id, { actions: updated })
    setCustomLabel('')
    setNewActionModal(false)
    triggerToast('Added new containment action item.')
  }

  // District Authority notifications
  function handleDistrictNotify() {
    const current = notifications.district ?? 'NONE'
    const next = current === 'NONE' ? 'GENERATED' : 'SENT'
    updateNotifications(c.id, {
      district: next,
      districtAt: new Date().toISOString(),
      orderNo: `MH/PUNE/VET-EPID/${c.id}`,
    })
    triggerToast(next === 'GENERATED' ? 'Official Directive Drafted!' : 'Official Order Dispatched to District Collectorate!')
  }

  // One Health Public Health notification
  function handleOneHealth() {
    updateNotifications(c.id, {
      oneHealth: 'NOTIFIED',
      oneHealthAt: new Date().toISOString(),
    })
    triggerToast('Integrated Disease Surveillance Programme (IDSP) Notified!')
  }

  // Advance lifecycle stage
  async function handleAdvanceStage() {
    setAdvancing(true)
    try {
      advanceStatus(c.id, 'Containment response protocol verified and executed.')
      try {
        await api.caseAction(c.id, { action: 'ADVANCE_STATUS', notes: 'Containment actions initiated.' })
      } catch (err) {
        // Backend action is optional if offline
      }
      triggerToast('Case Lifecycle advanced to next phase!')
    } finally {
      setAdvancing(false)
    }
  }

  // Metrics
  const allActionList   = Object.values(actions)
  const inProgressCount = allActionList.filter(a => a.status === 'IN_PROGRESS').length
  const completedCount  = allActionList.filter(a => a.status === 'COMPLETED').length
  const totalCount      = allActionList.length
  const progressPct     = totalCount > 0 ? Math.round(((completedCount + (inProgressCount * 0.5)) / totalCount) * 100) : 0

  const categories = ['immediate', 'area', 'monitoring']

  return (
    <div className="min-h-full pb-12 animate-fadeIn relative">

      {/* ── Toast Notification Banner ─────────────────────────────── */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2 animate-slideDown">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 px-6 py-4"
        style={{
          background: 'rgba(253,252,248,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(222,216,207,0.7)',
          boxShadow: '0 2px 16px rgba(93,112,82,0.06)',
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                className="text-lg font-bold leading-tight"
                style={{ fontFamily: "'Fraunces', serif", color: '#2c2c24', letterSpacing: '-0.02em' }}
              >
                Containment Action Command
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                Phase 6 · Response
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#78786c' }}>
              Standard Operating Protocols under Epidemic Prevention Act
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <WorkflowStepper caseStatus={c?.status} compact />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-6 space-y-6">

        {/* ── Case Control Bar & Case Switcher ──────────────────────── */}
        <div
          className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '1.25rem',
            border: '1px solid rgba(222,216,207,0.7)',
            boxShadow: '0 2px 14px rgba(93,112,82,0.06)',
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
              style={{ background: hex + '1a', color: hex, border: `1px solid ${hex}30` }}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black" style={{ color: '#2c2c24' }}>
                  {c.id} · {c.animalId}
                </span>
                <StatusBadge status={c.status} size="sm" />
                {c.lab?.result && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200">
                    ✓ Lab Confirmed: {c.lab.result.disease}
                  </span>
                )}
              </div>
              <p className="text-xs font-medium mt-0.5" style={{ color: '#5a5a50' }}>
                📍 {c.village}, {c.taluk} · Species: {c.species || 'Cattle'} · {c.syndrome}
              </p>
            </div>
          </div>

          {/* Controls: Case selector & Advance stage button */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end shrink-0">
            {/* Case selector dropdown */}
            {availableCases.length > 1 && (
              <div className="relative">
                <select
                  value={selectedCaseId}
                  onChange={e => setSelectedCaseId(e.target.value)}
                  className="text-xs font-semibold px-3 py-2 pr-8 rounded-xl border border-slate-200 bg-white/90 text-slate-700 focus:outline-none focus:border-brand-500 shadow-sm cursor-pointer"
                >
                  {availableCases.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.id} — {item.village} ({item.risk?.score ?? 0} pts)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Risk Score Pill */}
            <div className="text-right px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
              <p className="text-xs font-black tabular-nums leading-none" style={{ color: hex }}>
                {c.risk?.score ?? 0}/100
              </p>
              <p className="text-[9px] font-black uppercase tracking-wider mt-0.5" style={{ color: hex }}>
                {c.risk?.level ?? 'LOW'}
              </p>
            </div>

            {/* Advance lifecycle button */}
            {c.status !== 'CONTAINMENT' && (
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className="btn-primary text-xs whitespace-nowrap shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${advancing ? 'animate-spin' : ''}`} />
                Advance to Containment
              </button>
            )}
          </div>
        </div>

        {/* ── Operational Response Progress Dashboard ───────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Progress % */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Containment Execution</span>
              <Award className="w-4 h-4 text-brand-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 tabular-nums">{progressPct}%</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-brand-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5 font-medium">
              {completedCount} completed · {inProgressCount} in progress
            </p>
          </div>

          {/* Rapid Response Teams */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Response Units</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700 tabular-nums">2 Teams</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-emerald-700 font-bold">RRT Pune Deployed</p>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Dr. Deshmukh Lead</p>
          </div>

          {/* Ring Vaccination Tracker */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ring Vaccination</span>
              <Zap className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-black text-orange-600 tabular-nums">{vaxCount}</p>
              <span className="text-xs font-semibold text-slate-400">/ 650 cattle</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] font-bold text-orange-700">64.6% Coverage</span>
              <button
                onClick={() => setVaxCount(v => Math.min(650, v + 25))}
                className="text-[10px] font-bold text-brand-600 hover:text-brand-800 underline"
                title="Simulate +25 doses"
              >
                + Log Batch
              </button>
            </div>
          </div>

          {/* District Status */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Legal Protocol</span>
              <Building2 className="w-4 h-4 text-violet-600" />
            </div>
            <p className="text-base font-black text-slate-800 truncate">
              {notifications.district === 'SENT' ? 'Order Enforced' : notifications.district === 'GENERATED' ? 'Order Drafted' : 'Draft Pending'}
            </p>
            <button
              onClick={() => setShowOrderModal(true)}
              className="mt-2 text-[11px] font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              View Gazette Order
            </button>
          </div>
        </div>

        {/* ── Main Command Grid ─────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left Column: Action Items by Category (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2
                  className="text-base font-bold"
                  style={{ fontFamily: "'Fraunces', serif", color: '#2c2c24' }}
                >
                  Containment Action Matrix
                </h2>
                <p className="text-xs text-slate-500">Interactive execution of veterinary directives</p>
              </div>

              <button
                onClick={() => setNewActionModal(true)}
                className="text-xs font-bold text-brand-700 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Action
              </button>
            </div>

            {/* Action categories */}
            {categories.map(cat => {
              const meta  = CATEGORY_META[cat]
              const items = Object.values(actions).filter(a => a.category === cat)

              return (
                <div key={cat} className="space-y-2.5">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-extrabold ${meta.color}`}>
                    <span className={`w-2 h-2 rounded-full ${meta.badgeBg}`} />
                    {meta.label} ({items.filter(i => i.status === 'COMPLETED').length}/{items.length})
                  </div>

                  <div className="space-y-2">
                    {items.map(action => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        onActivate={handleActivateAction}
                        onComplete={handleCompleteAction}
                        onReset={handleResetAction}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Column: Zone Intelligence & External Directives ── */}
          <div className="space-y-5">

            {/* 1. Zone-Based Containment Command */}
            <div className="card p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-surface-border pb-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-600" />
                  <h3 className="section-title">Containment Zones</h3>
                </div>
                <button
                  onClick={() => navigate('/map')}
                  className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" /> Map
                </button>
              </div>

              {/* 3 km Protection Zone */}
              <div className="border border-red-200 bg-red-50/70 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                    <p className="text-xs font-black text-red-900">3 km Protection Zone</p>
                  </div>
                  <span className="text-[10px] font-bold text-red-700 bg-red-200/60 px-1.5 py-0.5 rounded">
                    Active Perimeter
                  </span>
                </div>
                <ul className="text-xs text-red-800 space-y-1 pl-4 list-disc">
                  <li><strong>Khandala epicenter</strong> — full movement restriction</li>
                  <li>Checkpoints Alpha &amp; Beta active with wheel wash</li>
                  <li>Target: 650 cloven-hoofed animals</li>
                </ul>
              </div>

              {/* 10 km Surveillance Zone */}
              <div className="border border-orange-200 bg-orange-50/70 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <p className="text-xs font-black text-orange-900">10 km Surveillance Zone</p>
                  </div>
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-200/60 px-1.5 py-0.5 rounded">
                    8 Villages
                  </span>
                </div>
                <p className="text-xs text-orange-800 leading-relaxed">
                  Daily thermal and oral cavity screening across Otur, Narayangaon, and Junnar periphery.
                </p>
              </div>

              <button
                onClick={() => navigate('/map')}
                className="btn-secondary w-full justify-center text-xs"
              >
                <MapPin className="w-3.5 h-3.5" />
                View Real-time Spatial Map
              </button>
            </div>

            {/* 2. District Administration Directive */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-surface-border pb-2.5">
                <Building2 className="w-4 h-4 text-violet-600" />
                <h3 className="section-title">District Authority</h3>
              </div>

              <div className="text-xs space-y-1.5 text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Jurisdiction:</span>
                  <span className="font-semibold text-slate-800">Junnar Sub-Division, Pune</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Authority:</span>
                  <span className="font-semibold text-slate-800">District Magistrate &amp; DVO</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Directive Status:</span>
                  <span className="font-bold text-emerald-700">
                    {notifications.district === 'SENT' ? '✓ Dispatched & Enforced' : notifications.district === 'GENERATED' ? 'Draft Ready' : 'Pending'}
                  </span>
                </div>
              </div>

              {notifications.district === 'SENT' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Directive Gazetted to Collectorate
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    Ref: MH/PUNE/VET-EPID/{c.id} · Dispatched electronically
                  </p>
                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="text-xs font-bold text-emerald-800 underline hover:text-emerald-900 block"
                  >
                    View Official Order
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleDistrictNotify}
                    className="btn-primary w-full justify-center text-xs"
                  >
                    {notifications.district === 'GENERATED' ? (
                      <><Send className="w-3.5 h-3.5" /> Dispatch Order to Collector</>
                    ) : (
                      <><Building2 className="w-3.5 h-3.5" /> Generate Containment Directive</>
                    )}
                  </button>

                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="text-xs text-slate-500 hover:text-slate-700 font-semibold w-full text-center py-1"
                  >
                    Preview Gazette Draft
                  </button>
                </div>
              )}
            </div>

            {/* 3. One Health Coordination */}
            <div className="card p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-surface-border pb-2.5">
                <Globe className="w-4 h-4 text-teal-600" />
                <h3 className="section-title">One Health Coordination</h3>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Zoonotic Cross-Transmission Assessment
                </p>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  FMD exhibits minimal direct human zoonosis, but secondary livelihood and food security impacts require Primary Health Centre (PHC) coordination.
                </p>
              </div>

              {notifications.oneHealth === 'NOTIFIED' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800">IDSP Public Health Unit Linked</p>
                    <p className="text-[10px] text-emerald-600">Junnar Rural Hospital alerted</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleOneHealth}
                  className="btn-secondary w-full justify-center text-xs"
                >
                  <Globe className="w-3.5 h-3.5 text-teal-600" />
                  Alert Public Health / IDSP
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Gazette Order Modal ────────────────────────────────────── */}
      {showOrderModal && (
        <OrderModal caseObj={c} onClose={() => setShowOrderModal(false)} />
      )}

      {/* ── Add Custom Action Modal ────────────────────────────────── */}
      {newActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Field Directive</h3>
              <button onClick={() => setNewActionModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomAction} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Action Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Set up emergency fodder depot in Khandala"
                  value={customLabel}
                  onChange={e => setCustomLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-brand-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-brand-600 text-xs"
                  >
                    <option value="immediate">Immediate Response</option>
                    <option value="area">Area Containment</option>
                    <option value="monitoring">Surveillance &amp; Monitoring</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select
                    value={customPriority}
                    onChange={e => setCustomPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-brand-600 text-xs"
                  >
                    <option value="URGENT">Urgent (Red)</option>
                    <option value="HIGH">High (Orange)</option>
                    <option value="MEDIUM">Medium (Amber)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewActionModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Create Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
