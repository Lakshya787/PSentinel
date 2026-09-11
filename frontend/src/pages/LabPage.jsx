import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FlaskConical, CheckCircle2, AlertTriangle, ChevronRight,
  Send, TestTube, Beaker, ClipboardCheck, Info, Sparkles,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import StatusBadge from '../components/ui/StatusBadge'
import WorkflowStepper from '../components/ui/WorkflowStepper'
import { riskLevelHex } from '../utils/riskEngine'

const PRIMARY_CASE_ID = 'CASE-1042'

const DEMO_REFERRAL_DEFAULTS = {
  sampleId:    'SAMPLE-1042',
  sampleType:  'Vesicular lesion / epithelial tissue',
  labName:     'Regional Veterinary Diagnostic Laboratory, Pune',
  labCode:     'RVDL-PUNE',
  priority:    'URGENT',
  collectedBy: 'Dr. Ramesh Kulkarni',
  location:    'Khandala Village, Junnar Taluk',
  notes:       'Suspected FMD. Vesicular lesions on oral mucosa and feet. Collected from COW-1024.',
}

const DEMO_LAB_RESULT = {
  disease:    'Foot-and-Mouth Disease (FMD)',
  subtype:    'Serotype O',
  outcome:    'POSITIVE',
  confirmationState: 'CONFIRMED',
  confidence: 98.4,
  testedBy:   'Dr. Priya Nair, RVDL Pune',
  method:     'RT-PCR Assay (VP1 sequencing)',
  specimen:   'Epithelial swab & vesicular fluid',
  notes:      'High-confidence positive detection for FMDV Serotype O. Immediate disease containment advisory recommended.',
}

// ─── 5-State Laboratory Lifecycle Stepper ──────────────────────────────────────
const LAB_STAGES = [
  { key: 'NOT_COLLECTED',    label: 'Not Collected'    },
  { key: 'DISPATCHED',       label: 'Dispatched'       },
  { key: 'LAB_TESTING',      label: 'Lab Testing'      },
  { key: 'RESULT_AVAILABLE', label: 'Result Available' },
  { key: 'CONFIRMED',        label: 'Confirmed'        },
]

function LabLifecycleStepper({ currentStage }) {
  const currentIdx = LAB_STAGES.findIndex(s => s.key === currentStage)
  return (
    <div className="w-full bg-slate-50/90 rounded-xl p-3 border border-slate-200">
      <div className="flex items-center justify-between">
        {LAB_STAGES.map((st, i) => {
          const isDone = i < currentIdx
          const isCurrent = i === currentIdx
          return (
            <div key={st.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? 'bg-green-600 text-white shadow-sm'
                      : isCurrent
                        ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                        : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-[10px] font-bold mt-1 text-center uppercase tracking-wider ${
                    isCurrent ? 'text-brand-800' : isDone ? 'text-green-700' : 'text-slate-400'
                  }`}
                >
                  {st.label}
                </span>
              </div>
              {i < LAB_STAGES.length - 1 && (
                <div
                  className={`h-0.5 w-full mx-1 ${
                    i < currentIdx ? 'bg-green-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Referral modal ───────────────────────────────────────────────────────────
function ReferralModal({ c, onSubmit, onClose }) {
  const [form, setForm] = useState(DEMO_REFERRAL_DEFAULTS)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-900">Create Diagnostic Lab Referral</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-semibold">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Case info banner */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3 text-sm border border-slate-200">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Case / Animal</p>
              <p className="font-bold text-slate-900">{c.id} · {c.animalId}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Risk Assessment</p>
              <p className="font-bold text-red-600">{c.risk.score} / 100 — CRITICAL</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Location</p>
              <p className="font-semibold text-slate-700">{c.village}, Junnar</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Suspected Syndrome</p>
              <p className="font-semibold text-slate-700">{c.syndrome}</p>
            </div>
          </div>

          {/* Form fields with defaults ready for 1-click */}
          {[
            { key: 'sampleId',    label: 'Sample ID',           type: 'text' },
            { key: 'sampleType',  label: 'Sample Type',         type: 'text' },
            { key: 'labName',     label: 'Destination Diagnostic Lab', type: 'text' },
            { key: 'collectedBy', label: 'Field Veterinary Officer',   type: 'text' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type={type} className="input"
                value={form[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}

          {/* Priority */}
          <div>
            <label className="label">Referral Priority</label>
            <div className="flex gap-2">
              {['URGENT', 'HIGH', 'ROUTINE'].map(p => (
                <button
                  key={p} type="button"
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all
                    ${form.priority === p
                      ? p === 'URGENT' ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : p === 'HIGH' ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                >{p}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              onClick={() => onSubmit(form)}
              className="btn-primary flex-1 justify-center shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Dispatch Sample to Lab
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Lab result card (Section 10) ─────────────────────────────────────────────
function LabResultCard({ result, sampleId }) {
  return (
    <div className="card overflow-hidden border-2 border-green-500/50 shadow-md">
      {/* Top Banner */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-green-700 via-green-600 to-emerald-700 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <h3 className="text-sm font-black uppercase tracking-wider">
            Official Laboratory Confirmation
          </h3>
        </div>
        <span className="text-[10px] font-black bg-white/20 border border-white/30 px-2 py-0.5 rounded-full uppercase tracking-widest">
          RT-PCR Verified
        </span>
      </div>

      <div className="px-6 py-5 space-y-4">
        {/* Simulation framing notice */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800 font-medium">
            <strong>Demonstration Simulation:</strong> Diagnostic report generated for veterinary early-warning workflow demonstration.
          </p>
        </div>

        {/* Big visual result block as required in Section 10 */}
        <div className="rounded-2xl border-2 border-red-500/60 bg-gradient-to-b from-red-50 to-red-100/50 p-6 text-center space-y-1 shadow-inner">
          <p className="text-xs font-black uppercase tracking-widest text-red-600">
            Detected Pathogen
          </p>
          <h2
            className="text-3xl sm:text-4xl font-black text-red-900 tracking-tight"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            FMD — SEROTYPE O
          </h2>
          <div className="pt-2 flex items-center justify-center gap-3">
            <span className="text-lg font-black text-white bg-red-600 px-4 py-1 rounded-full uppercase tracking-widest shadow-sm">
              POSITIVE
            </span>
            <span className="text-lg font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-4 py-1 rounded-full uppercase tracking-widest">
              CONFIRMED
            </span>
          </div>
          <p className="text-xs font-semibold text-red-700 pt-2">
            Foot-and-Mouth Disease Virus (Aphthovirus) · Serotype O
          </p>
        </div>

        {/* Detailed diagnostic metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/90 rounded-xl p-4 border border-slate-200/80">
          {[
            { label: 'Sample ID',        value: sampleId ?? 'SAMPLE-1042' },
            { label: 'Test Method',      value: result.method },
            { label: 'Analysed By',      value: result.testedBy },
            { label: 'Assay Confidence', value: `${result.confidence}%`, bold: true, highlight: true },
          ].map(({ label, value, bold, highlight }) => (
            <div key={label}>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">{label}</p>
              <p className={`text-xs mt-0.5 ${highlight ? 'text-green-700 font-black' : bold ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {result.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200 italic">
            <strong>Diagnostic Note: </strong>{result.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── LabPage ──────────────────────────────────────────────────────────────────
export default function LabPage() {
  const navigate                     = useNavigate()
  const { getCase, createLabReferral, recordLabResult } = useCaseStore()
  const [showModal, setShowModal]    = useState(false)
  const [simulating, setSimulating]  = useState(false)

  const c = getCase(PRIMARY_CASE_ID)
  if (!c) return null

  const labStatus = c.lab?.status ?? 'NONE'
  const labResult = c.lab?.result ?? null
  const hex       = riskLevelHex(c.risk.level)

  // Compute 5-stage lifecycle
  let currentStage = 'NOT_COLLECTED'
  if (labStatus === 'CONFIRMED' && labResult) {
    currentStage = 'CONFIRMED'
  } else if (simulating) {
    currentStage = 'RESULT_AVAILABLE'
  } else if (labStatus === 'TESTING') {
    currentStage = 'LAB_TESTING'
  } else if (c.status === 'UNDER_INVESTIGATION') {
    currentStage = 'NOT_COLLECTED'
  }

  async function handleSubmitReferral(form) {
    createLabReferral(PRIMARY_CASE_ID, form)
    setShowModal(false)
  }

  async function handleSimulateResult() {
    setSimulating(true)
    await new Promise(r => setTimeout(r, 900))
    recordLabResult(PRIMARY_CASE_ID, DEMO_LAB_RESULT)
    setSimulating(false)
  }

  return (
    <div className="min-h-full pb-12 animate-fadeIn">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-surface-border px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Fraunces', serif" }}>
                Diagnostic Laboratory
              </h1>
              <p className="text-xs text-slate-500">Veterinary Referral &amp; Pathogen Confirmation Pipeline</p>
            </div>
            <div className="flex items-center gap-3">
              <WorkflowStepper caseStatus={c.status} compact />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* 5-State Progression Stepper */}
        <div className="card p-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Laboratory Lifecycle: {PRIMARY_CASE_ID} ({c.animalId})
          </p>
          <LabLifecycleStepper currentStage={currentStage} />
        </div>

        {/* Pending / Active Case Card */}
        <div className="card overflow-hidden">
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: hex + '20', color: hex }}
              >
                <FlaskConical className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-white">{c.id}</span>
                  <span className="text-sm font-bold text-slate-900">{c.animalId}</span>
                  <span
                    className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full"
                    style={{ background: hex + '20', color: hex }}
                  >
                    {c.risk.score} / 100 · {c.risk.level}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium">{c.village} · {c.syndrome}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <StatusBadge status={c.status} size="sm" />
                  <span className="text-xs text-slate-500">
                    Sample Status:{' '}
                    <strong className={
                      labStatus === 'CONFIRMED' ? 'text-green-600'
                      : labStatus === 'TESTING' ? 'text-brand-700'
                      : 'text-amber-600'
                    }>
                      {labStatus === 'CONFIRMED' ? 'Confirmed Positive'
                        : labStatus === 'TESTING' ? 'In Testing at Lab'
                        : 'Awaiting Referral'}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              {labStatus === 'NONE' && (
                <button
                  onClick={() => setShowModal(true)}
                  className="btn-primary shadow-sm"
                >
                  <FlaskConical className="w-4 h-4" />
                  Create Lab Referral
                </button>
              )}
              {labStatus !== 'NONE' && (
                <button
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="btn-secondary text-xs"
                >
                  View Case <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sample metadata if referral created */}
          {labStatus !== 'NONE' && (
            <div className="border-t border-surface-border bg-slate-50/90 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Sample ID</span>
                <p className="font-mono font-bold text-slate-800">{c.lab?.sampleId ?? 'SAMPLE-1042'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Specimen</span>
                <p className="font-semibold text-slate-800 truncate">{c.lab?.sampleType ?? 'Vesicular tissue'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Diagnostic Facility</span>
                <p className="font-semibold text-slate-800">{c.lab?.labCode ?? 'RVDL-PUNE'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Priority</span>
                <p className="font-bold text-red-600">{c.lab?.priority ?? 'URGENT'}</p>
              </div>
            </div>
          )}
        </div>

        {/* STEP 12 Action Card: Simulate Lab Result */}
        {labStatus === 'TESTING' && !labResult && (
          <div className="card p-6 border-2 border-brand-300 bg-brand-50/30 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                <Beaker className="w-5 h-5 text-brand-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Sample Undergoing Pathogen Assay · RVDL Pune
                </h3>
                <p className="text-xs text-slate-500">
                  RT-PCR testing in progress for vesicular syndrome sample {c.lab?.sampleId}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-white/80 p-3 rounded-xl border border-slate-200">
              In field deployment, RT-PCR sequence results arrive digitally via the laboratory API.
              For this 2-minute demonstration, simulate the laboratory confirmation with a single click.
            </p>

            <button
              onClick={handleSimulateResult}
              disabled={simulating}
              className="btn-primary w-full justify-center text-sm py-3 shadow-md bg-brand-700 hover:bg-brand-800"
            >
              {simulating ? (
                <>
                  <span className="animate-spin mr-2">⚙</span>
                  Running RT-PCR Diagnostic Analysis…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  Simulate Lab Result: FMD Serotype O — POSITIVE
                </>
              )}
            </button>
          </div>
        )}

        {/* STEP 12 Final Confirmed Report View */}
        {labStatus === 'CONFIRMED' && labResult && (
          <div className="space-y-4 animate-slideUp">
            <LabResultCard result={labResult} sampleId={c.lab?.sampleId} />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => navigate('/alerts')}
                className="btn-primary flex-1 justify-center text-sm py-3 shadow-md bg-green-600 hover:bg-green-700 border-green-600"
              >
                <Send className="w-4 h-4" />
                Issue Multilingual Advisory Alert →
              </button>
              <button
                onClick={() => navigate(`/cases/${c.id}`)}
                className="btn-secondary justify-center text-xs py-3"
              >
                View Updated Case
              </button>
            </div>
          </div>
        )}

        {/* Additional diagnostic samples for realism */}
        <div>
          <h2 className="section-title mb-3">Active Regional Diagnostic Samples</h2>
          <div className="card divide-y divide-surface-border">
            {[
              { id: 'CASE-1045', animalId: 'COW-1026', village: 'Khandala', sampleId: 'SAMPLE-1045', lab: 'RVDL-PUNE', status: 'In Testing' },
              { id: 'CASE-1052', animalId: 'BUF-0188', village: 'Velhe',    sampleId: 'SAMPLE-1052', lab: 'IVRI-Izatnagar', status: 'In Testing' },
              { id: 'CASE-1054', animalId: 'COW-0920', village: 'Shirur',   sampleId: 'SAMPLE-1054', lab: 'RVDL-PUNE', status: 'Dispatched' },
            ].map(row => (
              <div key={row.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                    <FlaskConical className="w-3.5 h-3.5 text-cyan-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">{row.id}</span>
                      <span className="text-xs font-semibold text-slate-800">{row.animalId}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{row.village} · {row.sampleId} · {row.lab}</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-full uppercase shrink-0">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <ReferralModal
          c={c}
          onSubmit={handleSubmitReferral}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
