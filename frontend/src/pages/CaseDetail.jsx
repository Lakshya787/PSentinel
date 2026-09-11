import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  ChevronLeft, MapPin, AlertTriangle, Stethoscope, FlaskConical,
  Clock, CheckCircle2, Circle, ArrowRight, AlertCircle, User,
  Activity, ShieldAlert,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import StatusBadge from '../components/ui/StatusBadge'
import RiskScoreCard from '../components/ui/RiskScoreCard'
import RiskFactorCard from '../components/ui/RiskFactorCard'
import { riskLevelHex } from '../utils/riskEngine'
import { formatDateTime } from '../utils/formatters'
import { CASE_STATUSES, STATUS_LABELS } from '../utils/caseStatus'

// ─── Factor explanations ──────────────────────────────────────────────────────
const FACTOR_EXPLANATIONS = {
  clinical:      'Symptom profile strongly matches a high-risk vesicular syndrome.',
  vaccination:   'Local vaccination coverage is insufficient for this population.',
  environmental: 'Current environmental conditions elevate transmission probability.',
  spatial:       'Multiple nearby reports indicate active spatial clustering.',
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
  const [confirming, setConfirming] = useState(false)
  const [justAdvanced, setJustAdvanced] = useState(false)

  const c = getCase(id)

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

  const risk = c.risk
  const hex  = riskLevelHex(risk.level)

  // Build full timeline including pending future steps
  const completedStatuses = new Set(c.timeline.map(t => t.status))
  const currentIdx        = CASE_STATUSES.indexOf(c.status)

  const fullTimeline = CASE_STATUSES.map((status, i) => {
    const done    = completedStatuses.has(status)
    const current = status === c.status
    const future  = i > currentIdx
    const entry   = c.timeline.find(t => t.status === status)
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

  function handleAdvance() {
    if (!confirming) { setConfirming(true); return }
    advanceStatus(c.id, `Status advanced by veterinary officer.`)
    setConfirming(false)
    setJustAdvanced(true)
    setTimeout(() => setJustAdvanced(false), 4000)
  }

  const nextStatus = CASE_STATUSES[currentIdx + 1]

  return (
    <div className="min-h-full pb-8">
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-4 md:px-6 py-3">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">{c.id}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-semibold text-slate-700">{c.animalId}</span>
              <StatusBadge status={c.status} size="sm" />
            </div>
            <p className="text-xs text-slate-400 truncate">
              {c.village}, {c.taluk} · {c.species}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black tabular-nums" style={{ color: hex }}>{risk.score}</p>
            <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: hex }}>
              {risk.level}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">

        {/* ── RISK BANNER ───────────────────────────────────────────── */}
        <div
          className="rounded-xl border p-4 flex flex-col sm:flex-row items-center sm:items-start gap-4"
          style={{ borderColor: hex + '40', background: hex + '08' }}
        >
          <RiskScoreCard score={risk.score} level={risk.level} size="md" />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <ShieldAlert className="w-4 h-4" style={{ color: hex }} />
              <p className="text-sm font-bold" style={{ color: hex }}>
                High-Risk Syndrome Detected
              </p>
            </div>
            <p className="text-base font-black text-slate-900">{c.syndrome}</p>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              <strong>Veterinary investigation required.</strong>{' '}
              This system provides decision-support signals — not a veterinary diagnosis.
              Please consult a qualified veterinary officer immediately.
            </p>
          </div>
        </div>

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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                               font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
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

            {/* Location */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Location</h2>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {c.village}, {c.taluk} Taluk
              </p>
              <p className="text-xs text-slate-500">{c.district} · {c.state}</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {c.lat.toFixed(4)}° N, {c.lng.toFixed(4)}° E
              </p>
              <button
                onClick={() => navigate('/map')}
                className="mt-3 text-xs text-brand-600 font-semibold hover:text-brand-700 flex items-center gap-1"
              >
                View on Risk Map <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Investigation action */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Case Actions</h2>
              </div>

              {justAdvanced && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-sm font-semibold text-green-700">
                    Status updated to: {STATUS_LABELS[c.status]}
                  </p>
                </div>
              )}

              {canAdvance ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Next step: <strong className="text-slate-700">{STATUS_LABELS[nextStatus]}</strong>
                  </p>
                  {!confirming ? (
                    <button onClick={handleAdvance} className="btn-primary w-full justify-center">
                      {nextStatus === 'UNDER_INVESTIGATION'
                        ? 'Start Investigation'
                        : nextStatus === 'LAB_TESTING'
                          ? 'Send to Lab'
                          : `Advance → ${STATUS_LABELS[nextStatus]}`
                      }
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleAdvance} className="btn-danger flex-1 justify-center">
                        Confirm
                      </button>
                      <button onClick={() => setConfirming(false)} className="btn-secondary flex-1 justify-center">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">This case has reached its final status.</p>
              )}

              {c.notes && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-surface-border">
                  <span className="font-semibold">Notes: </span>{c.notes}
                </div>
              )}
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-6">

            {/* Explainable risk */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Why is this case high risk?</h2>
              </div>
              <div className="space-y-4">
                {[
                  { key: 'clinical',      label: 'Clinical indicators',     score: c.riskFactors.clinical      },
                  { key: 'vaccination',   label: 'Vaccination gap',         score: c.riskFactors.vaccination   },
                  { key: 'environmental', label: 'Environmental conditions', score: c.riskFactors.environmental },
                  { key: 'spatial',       label: 'Spatial clustering',      score: c.riskFactors.spatial       },
                ].map(({ key, label, score }) => (
                  <div key={key}>
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
                <span className="text-sm font-bold text-slate-700">Composite Risk Score</span>
                <span className="text-2xl font-black tabular-nums" style={{ color: hex }}>
                  {risk.score}<span className="text-sm font-normal text-slate-400">/100</span>
                </span>
              </div>
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
