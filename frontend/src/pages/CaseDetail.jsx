import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  ChevronLeft, MapPin, AlertTriangle, Stethoscope, FlaskConical,
  Clock, CheckCircle2, Circle, ArrowRight, AlertCircle, Loader2,
  Activity, ShieldAlert, Globe, Bell, ShieldCheck, Send, Thermometer,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import StatusBadge from '../components/ui/StatusBadge'
import RiskScoreCard from '../components/ui/RiskScoreCard'
import RiskFactorCard from '../components/ui/RiskFactorCard'
import WorkflowStepper from '../components/ui/WorkflowStepper'
import { calculateRisk, riskLevelHex } from '../utils/riskEngine'
import { formatDateTime } from '../utils/formatters'
import { CASE_STATUSES, STATUS_LABELS } from '../utils/caseStatus'
import { api } from '../utils/api'

// ─── Factor explanations ──────────────────────────────────────────────────────
const FACTOR_EXPLANATIONS = {
  clinical:      'Symptom profile strongly matches high-risk vesicular syndrome (oral vesicles, excessive salivation, lameness).',
  vaccination:   'Local vaccination coverage gap is acute for this sub-population.',
  environmental: 'Current monsoon humidity and high livestock density elevate rapid transmission.',
  spatial:       'Active spatial clustering detected within 3 km protection radius.',
}

// ─── Timeline step ────────────────────────────────────────────────────────────
function TimelineStep({ step, isLast, isCurrent, isFuture }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
          ${isCurrent
            ? 'bg-brand-600 border-brand-600 text-white'
            : isFuture
              ? 'bg-white border-slate-200 text-slate-300'
              : 'bg-green-500 border-green-500 text-white'
          }`}
        >
          {isFuture
            ? <Circle className="w-3 h-3" />
            : <CheckCircle2 className="w-3 h-3" />
          }
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 my-1 rounded-full ${isFuture ? 'bg-slate-100' : 'bg-green-200'}`} />
        )}
      </div>
      <div className={`pb-5 flex-1 min-w-0 ${isLast ? '' : ''}`}>
        <p className={`text-sm font-semibold leading-tight
          ${isCurrent ? 'text-brand-700' : isFuture ? 'text-slate-300' : 'text-slate-800'}`}>
          {step.label}
        </p>
        {step.at && !isFuture && (
          <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(step.at)}</p>
        )}
        {step.note && !isFuture && (
          <p className="text-xs text-slate-500 mt-1 italic">{step.note}</p>
        )}
      </div>
    </div>
  )
}

// ─── CaseDetail ───────────────────────────────────────────────────────────────
export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getCase, advanceStatus } = useCaseStore()
  const [justAdvanced, setJustAdvanced] = useState(false)
  const [remoteCase, setRemoteCase] = useState(null)
  const [loading, setLoading] = useState(true)

  const localCase = getCase(id)
  const c = localCase || remoteCase

  useEffect(() => {
    if (localCase) {
      setLoading(false)
      return
    }
    // Fetch from backend API
    api.getCase(id)
      .then(res => {
        if (res) {
          const rf = res.risk_factors ?? { clinical: 70, vaccination: 60, environmental: 55, spatial: 50 }
          const risk = res.risk ?? calculateRisk(rf)
          const norm = {
            id: res.id || res.tag_id || id,
            animalId: res.tag_id || res.id || id,
            species: res.species || 'Cattle',
            village: res.village || 'Shirur',
            taluk: res.taluk || 'Junnar',
            district: res.district || 'Pune',
            state: res.state || 'Maharashtra',
            lat: res.lat ?? 18.7831,
            lng: res.lng ?? 73.9286,
            symptoms: res.symptoms || [],
            affectedAnimals: res.affected_animals || 1,
            mortality: res.mortality || 0,
            reportedBy: res.reported_by || 'Field Worker',
            assignedVet: res.assigned_vet || null,
            status: res.status || 'REPORTED',
            riskFactors: rf,
            risk,
            syndrome: res.syndrome || 'Vesicular / Podal Syndrome',
            reportedAt: res.reported_at || new Date().toISOString(),
            updatedAt: res.updated_at || new Date().toISOString(),
            notes: res.notes || '',
            timeline: res.timeline || [
              { status: 'REPORTED', label: 'Report received', at: res.reported_at || new Date().toISOString(), note: `Filed by ${res.reported_by || 'Field Worker'}` },
              { status: res.status || 'REPORTED', label: 'Risk analysis complete', at: new Date().toISOString(), note: `Score: ${risk.score}/100 — ${risk.level}` },
            ],
          }
          setRemoteCase(norm)
        }
      })
      .catch(err => {
        console.warn('[CaseDetail] Failed to load case from backend:', err)
      })
      .finally(() => setLoading(false))
  }, [id, localCase])

  if (loading && !c) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3 text-slate-500">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        <p className="font-medium text-sm">Loading case details…</p>
      </div>
    )
  }

  if (!c) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-3 text-slate-500">
        <AlertCircle className="w-10 h-10 text-slate-300" />
        <p className="font-medium">Case not found: {id}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">
          ← Back to Dashboard
        </button>
      </div>
    )
  }

  const risk = c.risk ?? calculateRisk(c.riskFactors ?? {})
  const hex  = riskLevelHex(risk.level)

  // Build full timeline including pending future steps
  const timelineList      = c.timeline || [
    { status: 'REPORTED', label: 'Report received', at: c.reportedAt || new Date().toISOString(), note: `Filed by ${c.reportedBy || 'Field Worker'}` }
  ]
  const completedStatuses = new Set(timelineList.map(t => t.status))
  const currentIdx        = CASE_STATUSES.indexOf(c.status || 'REPORTED')

  const fullTimeline = CASE_STATUSES.map((status, i) => {
    const done    = completedStatuses.has(status)
    const current = status === c.status
    const future  = i > currentIdx
    const entry   = timelineList.find(t => t.status === status)
    return {
      status,
      label:   entry?.label ?? STATUS_LABELS[status],
      at:      entry?.at ?? null,
      note:    entry?.note ?? '',
      done, current, future,
    }
  })

  // Can we advance?
  const canAdvance = currentIdx < CASE_STATUSES.length - 1
  const nextStatus = CASE_STATUSES[currentIdx + 1]

  function handleQuickAdvance() {
    advanceStatus(c.id, `Status updated by veterinary officer.`)
    setJustAdvanced(true)
    setTimeout(() => setJustAdvanced(false), 3500)
  }

  // Phase 4 state
  const lab           = c.lab ?? null
  const alertState    = c.alert?.status ?? 'NONE'
  const containment   = c.containment ?? null
  const notifications = c.notifications ?? {}
  const hasPhase4     = lab || alertState !== 'NONE' || containment || Object.keys(notifications).length > 0

  return (
    <div className="min-h-full pb-12 animate-fadeIn">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-surface-border px-4 md:px-6 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1 text-xs font-semibold text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-900">{c.id}</span>
            <span className="text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-600">{c.animalId}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/map')}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-1 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">View on Map</span>
            </button>
            <WorkflowStepper caseStatus={c.status} compact />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* ── CENTRAL DEMO CASE HEADER ───────────────────────────────── */}
        <div
          className="rounded-2xl p-6 border-2 relative overflow-hidden shadow-sm"
          style={{
            borderColor: hex + '40',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(254,242,242,0.6))',
          }}
        >
          {/* Subtle decorative background ring */}
          <div
            className="absolute -right-12 -top-12 w-48 h-48 rounded-full pointer-events-none opacity-10"
            style={{ background: hex }}
          />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            {/* Case & Animal Primary Identifier */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-slate-900 text-white tracking-wider">
                  {c.id}
                </span>
                <span
                  className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full"
                  style={{
                    color: '#b91c1c',
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                >
                  PRIMARY OUTBREAK CASE
                </span>
                <span className="text-xs text-slate-400 font-semibold">·</span>
                <span className="text-xs font-bold text-slate-600">{c.species} ({c.breed ?? 'Gir'})</span>
              </div>

              <h1
                className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {c.animalId}
              </h1>

              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                <span>
                  <strong>{c.village}</strong>, {c.taluk} Taluk · {c.district}, {c.state}
                </span>
              </div>

              {/* Current prominent workflow status */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-500">Current Status:</span>
                <span
                  className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full text-white shadow-sm"
                  style={{
                    background: c.status === 'LAB_CONFIRMED' ? '#16a34a'
                      : c.status === 'UNDER_INVESTIGATION' ? '#0284c7'
                      : c.status === 'ALERT_SENT' ? '#7c3aed'
                      : c.status === 'CONTAINMENT' ? '#ea580c'
                      : '#dc2626',
                  }}
                >
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                {c.mortality > 0 && (
                  <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    ✕{c.mortality} Mortality Reported
                  </span>
                )}
              </div>
            </div>

            {/* Risk Score & Investigation Required Card */}
            <div className="flex items-center gap-5 shrink-0 bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/80 shadow-sm">
              <RiskScoreCard score={risk.score} level={risk.level} size="md" />
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Composite Risk</p>
                <p className="text-2xl font-black text-red-600 leading-none">
                  {risk.score} <span className="text-xs font-bold text-slate-400">/ 100</span>
                </p>
                <p className="text-xs font-black uppercase tracking-wider text-red-600">{risk.level}</p>
                <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 mt-1">
                  Investigation required
                </p>
              </div>
            </div>
          </div>

          {/* Prompt action banner — What the veterinary officer should do next */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-xs text-slate-700 font-medium">
                <strong>Next Veterinary Decision:</strong>{' '}
                {c.status === 'RISK_ANALYZED' && 'Deploy field investigation team to Khandala to verify vesicular lesions.'}
                {c.status === 'UNDER_INVESTIGATION' && 'Clinical signs verified. Dispatch lesion swab samples to RVDL Pune.'}
                {c.status === 'LAB_TESTING' && 'Sample undergoing RT-PCR test at Regional Diagnostic Laboratory.'}
                {c.status === 'LAB_CONFIRMED' && 'FMD Serotype O confirmed! Broadcast multilingual advisory alert.'}
                {c.status === 'ALERT_SENT' && 'Advisory sent to 8 villages. Initiate ring vaccination containment.'}
                {c.status === 'CONTAINMENT' && 'Active containment and district coordination underway.'}
              </p>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              {c.status === 'RISK_ANALYZED' && (
                <button
                  onClick={handleQuickAdvance}
                  className="btn-primary w-full sm:w-auto justify-center text-xs shadow-md"
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  Start Investigation
                </button>
              )}
              {c.status === 'UNDER_INVESTIGATION' && (
                <button
                  onClick={() => navigate('/lab')}
                  className="btn-primary w-full sm:w-auto justify-center text-xs bg-cyan-700 hover:bg-cyan-800 border-cyan-700 shadow-md"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Create Lab Referral →
                </button>
              )}
              {c.status === 'LAB_TESTING' && (
                <button
                  onClick={() => navigate('/lab')}
                  className="btn-primary w-full sm:w-auto justify-center text-xs bg-cyan-700 hover:bg-cyan-800 border-cyan-700 shadow-md"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  View Lab Testing Status →
                </button>
              )}
              {c.status === 'LAB_CONFIRMED' && (
                <button
                  onClick={() => navigate('/alerts')}
                  className="btn-primary w-full sm:w-auto justify-center text-xs bg-green-600 hover:bg-green-700 border-green-600 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  Issue Advisory Alert →
                </button>
              )}
              {c.status === 'ALERT_SENT' && (
                <button
                  onClick={() => navigate('/actions')}
                  className="btn-primary w-full sm:w-auto justify-center text-xs bg-orange-600 hover:bg-orange-700 border-orange-600 shadow-md"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Activate Containment →
                </button>
              )}
              {c.status === 'CONTAINMENT' && (
                <button
                  onClick={() => navigate('/actions')}
                  className="btn-primary w-full sm:w-auto justify-center text-xs shadow-md"
                >
                  <Activity className="w-3.5 h-3.5" />
                  View Containment Status →
                </button>
              )}
            </div>
          </div>

          {justAdvanced && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-700 animate-slideUp">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Investigation started · Assigned to Dr. Ramesh Kulkarni, Junnar Veterinary Office
            </div>
          )}

          {/* One Health Zoonotic Dimension (ref.md §16) */}
          <div className="mt-3 p-3 bg-emerald-50/90 border border-emerald-300/80 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-emerald-950">One Health Protocol — Human-Animal Surveillance Loop</p>
                  <span className="text-[9px] font-mono font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">IDSP UNIT: NOTIFIED</span>
                </div>
                <p className="text-[11px] text-emerald-700 truncate">
                  Joint animal-human outbreak surveillance channel active for Pune District Health Directorate.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => alert("ONE HEALTH INTER-AGENCY DISPATCH MEMO\n\nTo: District Surveillance Officer (IDSP), Pune\nFrom: Pashu Sentinel Surveillance Engine / BVO Junnar\nSubject: Pre-diagnostic livestock epizootic cluster in Khandala\nStatus: Pre-diagnostic syndromic cross-notification logged under National One Health Mission.\n\nActions:\n- Enhanced surveillance on dairy farm workers for secondary contact rash\n- Joint bio-security containment active")}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 shrink-0 transition-colors"
            >
              View Joint Health Notice
            </button>
          </div>
        </div>

        {/* ── PHASE 4 STATE PANEL ───────────────────────────────── */}
        {hasPhase4 && (
          <div className="card p-4">
            <h2 className="section-title mb-3">Case Intelligence Status</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Risk Score</p>
                <p className="text-sm font-black text-red-600">{risk.score} · {risk.level}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <FlaskConical className="w-3 h-3" /> Lab
                </p>
                <p className={`text-sm font-bold ${
                  lab?.status === 'CONFIRMED' ? 'text-green-600'
                  : lab?.status === 'TESTING'  ? 'text-cyan-700'
                  : 'text-slate-400'
                }`}>
                  {lab?.status === 'CONFIRMED' && lab?.result
                    ? `${lab.result.disease.split(' ')[0]} — ${lab.result.subtype}`
                    : lab?.status === 'TESTING' ? 'In testing'
                    : 'Not sent'}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Alert
                </p>
                <p className={`text-sm font-bold ${
                  alertState === 'SENT'  ? 'text-green-600'
                  : alertState === 'READY' ? 'text-brand-600'
                  : alertState === 'DRAFT' ? 'text-amber-600'
                  : 'text-slate-400'
                }`}>
                  {alertState === 'NONE' ? 'Not issued' : alertState}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Containment
                </p>
                <p className={`text-sm font-bold ${
                  containment?.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'
                }`}>
                  {containment?.status === 'ACTIVE' ? 'Active' : 'Not started'}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  <Globe className="w-3 h-3" /> One Health
                </p>
                <p className={`text-sm font-bold ${
                  notifications.oneHealth === 'NOTIFIED' ? 'text-green-600' : 'text-slate-400'
                }`}>
                  {notifications.oneHealth === 'NOTIFIED' ? 'Notified' : 'Not sent'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN GRID ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* Left col */}
          <div className="space-y-6">

            {/* Clinical signals */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Clinical Signals</h2>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {c.symptoms.map(s => (
                  <span key={s}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs
                               font-semibold bg-red-50 text-red-700 border border-red-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {s}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Species',           value: c.species },
                  { label: 'Breed',             value: c.breed ?? '—' },
                  { label: 'Affected animals',  value: c.affectedAnimals },
                  { label: 'Mortality',         value: c.mortality, danger: c.mortality > 0 },
                  { label: 'Reporter',          value: c.reportedBy },
                  { label: 'Reported',          value: formatDateTime(c.reportedAt) },
                ].map(({ label, value, danger }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className={`font-semibold mt-0.5 ${danger ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Location & Risk Zone */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <h2 className="section-title">Location &amp; Containment Zone</h2>
                </div>
                <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  3 km Protection Zone
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">
                {c.village}, {c.taluk} Taluk
              </p>
              <p className="text-xs text-slate-500">{c.district} · {c.state}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {c.lat.toFixed(4)}° N, {c.lng.toFixed(4)}° E · Khandala Cluster (CLU-JUN-01)
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => navigate('/map')}
                  className="btn-secondary flex-1 justify-center text-xs"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Open in Risk Map
                </button>
              </div>
            </div>

            {/* Case Actions */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Case Actions &amp; Lifecycle</h2>
              </div>

              {canAdvance ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <p className="text-slate-500">
                      Next lifecycle step: <strong className="text-slate-800">{STATUS_LABELS[nextStatus]}</strong>
                    </p>
                  </div>
                  <button onClick={handleQuickAdvance} className="btn-primary w-full justify-center text-xs">
                    {nextStatus === 'UNDER_INVESTIGATION'
                      ? 'Start Investigation'
                      : nextStatus === 'LAB_TESTING'
                        ? 'Refer to Lab'
                        : `Advance → ${STATUS_LABELS[nextStatus]}`
                    }
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">This case has reached its final workflow stage.</p>
              )}

              {c.notes && (
                <div className="mt-4 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-surface-border">
                  <span className="font-semibold">Field Notes: </span>{c.notes}
                </div>
              )}
            </div>
          </div>

          {/* Right col: Explainable Risk & Timeline */}
          <div className="space-y-6">

            {/* Explainable risk - Section 6 */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <h2 className="section-title">Why this case is high risk</h2>
                </div>
                <span className="text-xs font-black text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                  88 / 100 CRITICAL
                </span>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'clinical',      label: 'Clinical',      score: c.riskFactors.clinical      },
                  { key: 'vaccination',   label: 'Vaccination',   score: c.riskFactors.vaccination   },
                  { key: 'environmental', label: 'Environmental', score: c.riskFactors.environmental },
                  { key: 'spatial',       label: 'Spatial',       score: c.riskFactors.spatial       },
                ].map(({ key, label, score }) => (
                  <div key={key} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
                    <RiskFactorCard
                      label={label}
                      score={score}
                      level={risk.level}
                      description={FACTOR_EXPLANATIONS[key]}
                    />
                  </div>
                ))}
              </div>

              <div
                className="mt-5 flex items-center justify-between px-4 py-3 rounded-xl border"
                style={{ borderColor: hex + '40', background: hex + '10' }}
              >
                <div>
                  <p className="text-xs font-bold text-slate-700">Composite Risk Score</p>
                  <p className="text-[10px] text-slate-500">Explainable weighted multi-factor calculation</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black tabular-nums" style={{ color: hex }}>
                    {risk.score}<span className="text-sm font-normal text-slate-400">/100</span>
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: hex }}>
                    {risk.level}
                  </p>
                </div>
              </div>
            </div>

            {/* Biometeorological & Climate Correlation Engine (ref.md §12) */}
            <div className="card p-5 border-amber-200/80 bg-gradient-to-br from-white to-amber-50/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-amber-600" />
                  <h2 className="section-title text-amber-900 mb-0">Biometeorological Correlation (THI Engine)</h2>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  THI: 78.4 (Thermal Stress Alert)
                </span>
              </div>

              <div className="p-3 bg-white/90 rounded-xl border border-amber-200/60 mb-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 font-mono">THI = 0.8·T + (RH/100)·(T - 14.4) + 46.4</span>
                  <span className="font-bold text-red-600 font-mono">THI &gt; 78 (High Susceptibility)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Dry-Bulb Temp</p>
                    <p className="text-sm font-bold text-slate-800">28.4°C</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Relative Humidity</p>
                    <p className="text-sm font-bold text-slate-800">76% (Post-Monsoon)</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Vector Suitability</p>
                    <p className="text-sm font-bold text-amber-600">High (Stomoxys / Midges)</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Epidemiological trigger:</strong> High relative humidity (&gt;60%) stabilizes airborne Aphthovirus droplets while thermal stress suppresses bovine mucosal immunity, accelerating inter-herd transmission across Junnar Taluk.
              </p>
            </div>

            {/* Timeline */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Case Timeline</h2>
              </div>
              <div>
                {fullTimeline.map((step, i) => (
                  <TimelineStep
                    key={step.status}
                    step={step}
                    isLast={i === fullTimeline.length - 1}
                    isCurrent={step.current}
                    isFuture={step.future}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
