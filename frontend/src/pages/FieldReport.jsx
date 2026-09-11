import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft, Wifi, WifiOff, CheckCircle2, AlertTriangle,
  RefreshCw, Upload, MapPin, User, Clipboard,
} from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useReportStore } from '../hooks/useReportStore'
import { useCaseStore } from '../hooks/useCaseStore'
import { calculateRisk } from '../utils/riskEngine'
import DemoControls from '../components/ui/DemoControls'
import RiskScoreCard from '../components/ui/RiskScoreCard'
import RiskFactorCard from '../components/ui/RiskFactorCard'

// ─── Constants ────────────────────────────────────────────────────────────────
const SPECIES = ['Cattle', 'Buffalo', 'Goat', 'Sheep', 'Pig', 'Other']
const REPORTER_TYPES = ['Pashu Sakhi', 'Field Worker', 'Farmer', 'NGO Worker', 'Vet Volunteer']
const ALL_SYMPTOMS = [
  'Fever', 'Oral vesicles', 'Excessive salivation', 'Lameness',
  'Diarrhoea', 'Respiratory distress', 'Abortion', 'Neurological symptoms',
  'Sudden death', 'Skin / nodular lesions',
]
const DEMO_RISK_FACTORS = { clinical: 92, vaccination: 80, environmental: 85, spatial: 95 }

const EMPTY_FORM = {
  species: '', animalId: '', village: '', taluk: 'Junnar', district: 'Pune',
  state: 'Maharashtra', reporterType: '', symptoms: [],
  affectedAnimals: '', mortality: '', notes: '',
}

const DEMO_FORM = {
  species: 'Cattle', animalId: 'COW-1024', village: 'Khandala',
  taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
  reporterType: 'Pashu Sakhi', symptoms: ['Fever', 'Oral vesicles', 'Excessive salivation', 'Lameness'],
  affectedAnimals: '3', mortality: '1', notes: '',
}

// Sync step definitions
const SYNC_STEPS = [
  { key: 'saved',      label: 'Report saved locally'    },
  { key: 'connected', label: 'Connection restored'      },
  { key: 'syncing',   label: 'Synchronising report…'    },
  { key: 'synced',    label: 'Report synchronised'      },
  { key: 'analyzing', label: 'Running risk analysis…'   },
  { key: 'done',      label: 'Risk score calculated'    },
]

// ─── Symptom chip ─────────────────────────────────────────────────────────────
function SymptomChip({ label, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
        ${selected
          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300 hover:text-brand-700'
        }`}
    >
      {selected && '✓ '}{label}
    </button>
  )
}

// ─── Sync progress display ─────────────────────────────────────────────────────
function SyncProgress({ steps, activeStep }) {
  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const idx     = steps.findIndex(s => s.key === activeStep)
        const done    = i < idx
        const current = step.key === activeStep
        const pending = i > idx
        return (
          <div key={step.key} className={`flex items-center gap-3 transition-opacity ${pending ? 'opacity-30' : 'opacity-100'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors
              ${done    ? 'bg-green-500 text-white'
              : current ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-300'}`}
            >
              {done
                ? <CheckCircle2 className="w-3 h-3" />
                : current
                  ? <RefreshCw className="w-3 h-3 animate-spin" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              }
            </div>
            <span className={`text-sm font-medium ${done ? 'text-green-700' : current ? 'text-brand-700' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── FieldReport page ─────────────────────────────────────────────────────────
export default function FieldReport() {
  const navigate             = useNavigate()
  const [params]             = useSearchParams()
  const { isOnline, setDemoOnline } = useOnlineStatus()
  const { addReport, updateReport, clearAll } = useReportStore()
  const { upsertCase, patchCase, resetAll } = useCaseStore()

  const [form,      setForm]      = useState(params.get('demo') === '1' ? DEMO_FORM : EMPTY_FORM)
  const [phase,     setPhase]     = useState('form')   // form | saved | syncing | result
  const [syncStep,  setSyncStep]  = useState('saved')
  const [result,    setResult]    = useState(null)
  const [reportId,  setReportId]  = useState(null)
  const [errors,    setErrors]    = useState({})

  // Load demo if query param
  function loadDemo() {
    setForm(DEMO_FORM)
    setPhase('form')
    setResult(null)
  }

  // Toggle symptom
  function toggleSymptom(s) {
    setForm(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(s)
        ? prev.symptoms.filter(x => x !== s)
        : [...prev.symptoms, s],
    }))
  }

  // Validation
  function validate() {
    const e = {}
    if (!form.species)                e.species      = 'Required'
    if (!form.animalId.trim())        e.animalId     = 'Required'
    if (!form.village.trim())         e.village      = 'Required'
    if (!form.reporterType)           e.reporterType = 'Required'
    if (form.symptoms.length === 0)   e.symptoms     = 'Select at least one symptom'
    if (!form.affectedAnimals)        e.affectedAnimals = 'Required'
    return e
  }

  // Submit
  function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    const id = `R-${Math.floor(1000 + Math.random() * 9000)}`
    const report = {
      reportId:        id,
      animalId:        form.animalId.trim(),
      species:         form.species,
      village:         form.village.trim(),
      taluk:           form.taluk,
      district:        form.district,
      state:           form.state,
      symptoms:        form.symptoms,
      affectedAnimals: parseInt(form.affectedAnimals, 10) || 1,
      mortality:       parseInt(form.mortality, 10)       || 0,
      reportedBy:      form.reporterType,
      notes:           form.notes,
      syncStatus:      'PENDING',
      caseStatus:      'REPORTED',
      createdAt:       new Date().toISOString(),
      riskFactors:     form.animalId.trim() === 'COW-1024'
                         ? DEMO_RISK_FACTORS
                         : { clinical: 55, vaccination: 60, environmental: 55, spatial: 50 },
    }
    addReport(report)
    setReportId(id)
    setPhase('saved')
  }

  // Sync sequence (triggered when coming back online)
  const runSync = useCallback(async (id) => {
    const delay = (ms) => new Promise(r => setTimeout(r, ms))
    setPhase('syncing')

    const steps = ['saved', 'connected', 'syncing', 'synced', 'analyzing', 'done']
    for (const step of steps) {
      setSyncStep(step)
      await delay(step === 'analyzing' ? 1400 : 900)
    }

    // Get saved report
    const raw = localStorage.getItem('ps_field_reports')
    const reports = raw ? JSON.parse(raw) : []
    const report = reports.find(r => r.reportId === id)
    if (!report) return

    // Mark synced
    updateReport(id, { syncStatus: 'SYNCED' })

    // Compute risk (always from utility — never hardcoded)
    const riskResult = calculateRisk(report.riskFactors)
    setResult({ report, risk: riskResult })

    // Upsert into case store so dashboard/map pick it up
    const caseObj = {
      id:             `CASE-${id}`,
      animalId:       report.animalId,
      species:        report.species,
      village:        report.village,
      taluk:          report.taluk,
      district:       report.district,
      state:          report.state,
      lat:            18.7831, lng: 73.9286, // default to Khandala if not GPS-captured
      symptoms:       report.symptoms,
      affectedAnimals: report.affectedAnimals,
      mortality:      report.mortality,
      reportedBy:     report.reportedBy,
      assignedVet:    null,
      status:         'RISK_ANALYZED',
      riskFactors:    report.riskFactors,
      syndrome:       riskResult.level === 'CRITICAL' || riskResult.level === 'HIGH'
                        ? 'Vesicular / Podal Syndrome' : 'Undetermined',
      reportedAt:     report.createdAt,
      updatedAt:      new Date().toISOString(),
      notes:          report.notes,
      timeline: [
        { status: 'REPORTED',      label: 'Report received',         at: report.createdAt,       note: `Filed by ${report.reportedBy}` },
        { status: 'RISK_ANALYZED', label: 'Risk analysis complete',  at: new Date().toISOString(), note: `Score: ${riskResult.score}/100 — ${riskResult.level}` },
      ],
    }
    // Update demo case CASE-1042 or upsert custom case
    if (report.animalId === 'COW-1024') {
      patchCase('CASE-1042', {
        status: 'RISK_ANALYZED',
        updatedAt: new Date().toISOString(),
      })
    } else {
      upsertCase(caseObj)
    }

    setPhase('result')
  }, [updateReport, upsertCase, patchCase])

  // Watch for online recovery while in 'saved' phase
  useEffect(() => {
    if (phase === 'saved' && isOnline && reportId) {
      runSync(reportId)
    }
  }, [isOnline, phase, reportId, runSync])

  function handleReset() {
    setForm(EMPTY_FORM)
    setPhase('form')
    setResult(null)
    setReportId(null)
    setErrors({})
    clearAll()
    resetAll()
    localStorage.removeItem('ps_demo_online_override')
  }

  // ── RENDER: RESULT PHASE ────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const { risk, report } = result
    return (
      <div className="min-h-full bg-surface-muted pb-8">
        <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-sm font-bold text-slate-900">Risk Analysis</h1>
        </header>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
          {/* Sync complete */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm font-semibold text-green-700">Report synchronised · Risk analysis complete</p>
          </div>

          {/* Risk card */}
          <div className={`card p-5 border-2 ${
            risk.level === 'CRITICAL' ? 'border-red-300 bg-red-50/30'
            : risk.level === 'HIGH'   ? 'border-orange-300 bg-orange-50/30'
            : 'border-surface-border'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">High-Risk Syndrome Detected</p>
                <p className="text-xl font-black text-slate-900 mt-0.5">
                  {risk.level === 'CRITICAL' || risk.level === 'HIGH'
                    ? 'Vesicular / Podal Syndrome'
                    : 'Undetermined Syndrome'
                  }
                </p>
              </div>
              <RiskScoreCard score={risk.score} level={risk.level} size="sm" />
            </div>

            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>Veterinary investigation required.</strong>{' '}
                This is a decision-support signal, not a diagnosis.
                A qualified veterinary officer must assess and confirm.
              </p>
            </div>

            {/* Factor bars */}
            <div className="space-y-3">
              {[
                { label: 'Clinical',      score: report.riskFactors.clinical      },
                { label: 'Vaccination',   score: report.riskFactors.vaccination   },
                { label: 'Environmental', score: report.riskFactors.environmental },
                { label: 'Spatial',       score: report.riskFactors.spatial       },
              ].map(({ label, score }) => (
                <RiskFactorCard key={label} label={label} score={score} level={risk.level} />
              ))}
            </div>

            <div className={`mt-4 px-4 py-3 rounded-xl text-center ${
              risk.level === 'CRITICAL' ? 'bg-red-600'
              : risk.level === 'HIGH'   ? 'bg-orange-500'
              : 'bg-brand-600'}`}
            >
              <p className="text-white font-black text-2xl tabular-nums">
                {risk.score} <span className="text-sm font-normal opacity-80">/ 100</span>
              </p>
              <p className="text-white text-sm font-bold uppercase tracking-wider opacity-90">
                {risk.level}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary justify-center"
            >
              View Veterinary Dashboard →
            </button>
            <button
              onClick={() => navigate(`/cases/CASE-1042`)}
              className="btn-secondary justify-center"
            >
              View Full Case Details
            </button>
          </div>
        </div>

        <DemoControls
          isOnline={isOnline}
          onToggleOnline={() => setDemoOnline(!isOnline)}
          onLoadDemo={loadDemo}
          onReset={handleReset}
        />
      </div>
    )
  }

  // ── RENDER: SYNCING PHASE ────────────────────────────────────────────────────
  if (phase === 'syncing') {
    return (
      <div className="min-h-full bg-surface-muted flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-sm w-full card p-6 space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="w-6 h-6 text-brand-600 animate-spin" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Synchronising Report</h2>
            <p className="text-xs text-slate-500 mt-1">Running intelligence pipeline…</p>
          </div>
          <SyncProgress steps={SYNC_STEPS} activeStep={syncStep} />
        </div>
      </div>
    )
  }

  // ── RENDER: SAVED (OFFLINE) PHASE ───────────────────────────────────────────
  if (phase === 'saved') {
    return (
      <div className="min-h-full bg-surface-muted">
        {!isOnline && (
          <div className="bg-amber-500 text-white px-4 py-2.5 text-sm font-medium flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            No Internet Connection — Report saved securely on this device
          </div>
        )}

        <div className="flex flex-col items-center justify-center px-6 py-12 max-w-sm mx-auto">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
            isOnline ? 'bg-green-100' : 'bg-amber-100'}`}>
            {isOnline
              ? <Wifi className="w-7 h-7 text-green-600" />
              : <WifiOff className="w-7 h-7 text-amber-600" />
            }
          </div>

          <h2 className="text-lg font-bold text-slate-900 text-center">
            {isOnline ? 'Connecting…' : 'Report Saved Locally'}
          </h2>
          <p className="text-sm text-slate-500 mt-2 text-center leading-relaxed">
            {isOnline
              ? 'Synchronisation will begin automatically.'
              : 'Your report is saved securely on this device. It will synchronise when internet connection is restored.'
            }
          </p>

          <div className="mt-6 w-full card p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Report ID</span>
              <span className="font-bold text-slate-800">{reportId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Animal ID</span>
              <span className="font-semibold text-slate-800">{form.animalId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Sync status</span>
              <span className="font-semibold text-amber-600">⏳ Pending</span>
            </div>
          </div>

          {!isOnline && (
            <div className="mt-4 text-center text-xs text-slate-400">
              Waiting for synchronisation…
            </div>
          )}
        </div>

        <DemoControls
          isOnline={isOnline}
          onToggleOnline={() => setDemoOnline(!isOnline)}
          onLoadDemo={loadDemo}
          onReset={handleReset}
        />
      </div>
    )
  }

  // ── RENDER: FORM PHASE ───────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-surface-muted pb-8">
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2.5 text-sm font-medium flex items-center gap-2 sticky top-0 z-20">
          <WifiOff className="w-4 h-4 shrink-0" />
          Offline — Report will be saved locally and synced when connected
        </div>
      )}

      <header className="bg-white border-b border-surface-border px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-base font-bold text-slate-900">Field Report</h1>
          <p className="text-xs text-slate-500">Submit a livestock disease report</p>
        </div>
        <button
          type="button"
          onClick={loadDemo}
          className="ml-auto text-xs font-semibold text-brand-600 border border-brand-200
                     hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Clipboard className="w-3.5 h-3.5" />
          Load Demo
        </button>
      </header>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Animal information */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" /> Animal Information
          </h2>

          {/* Species */}
          <div>
            <label className="label">Species *</label>
            <div className="flex flex-wrap gap-2">
              {SPECIES.map(s => (
                <button
                  key={s} type="button"
                  onClick={() => setForm(p => ({ ...p, species: s }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${form.species === s
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                >{s}</button>
              ))}
            </div>
            {errors.species && <p className="text-xs text-red-500 mt-1">{errors.species}</p>}
          </div>

          {/* Animal ID */}
          <div>
            <label className="label">Animal / Tag ID *</label>
            <input
              className="input"
              placeholder="e.g. COW-1024"
              value={form.animalId}
              onChange={e => setForm(p => ({ ...p, animalId: e.target.value }))}
            />
            {errors.animalId && <p className="text-xs text-red-500 mt-1">{errors.animalId}</p>}
          </div>
        </div>

        {/* Location */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" /> Location
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Village *</label>
              <input className="input" placeholder="Khandala" value={form.village}
                onChange={e => setForm(p => ({ ...p, village: e.target.value }))} />
              {errors.village && <p className="text-xs text-red-500 mt-1">{errors.village}</p>}
            </div>
            <div>
              <label className="label">Taluk</label>
              <input className="input" value={form.taluk}
                onChange={e => setForm(p => ({ ...p, taluk: e.target.value }))} />
            </div>
            <div>
              <label className="label">District</label>
              <input className="input" value={form.district}
                onChange={e => setForm(p => ({ ...p, district: e.target.value }))} />
            </div>
            <div>
              <label className="label">State</label>
              <input className="input" value={form.state}
                onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Symptoms */}
        <div className="card p-5 space-y-3">
          <h2 className="section-title">Symptoms Observed *</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_SYMPTOMS.map(s => (
              <SymptomChip
                key={s} label={s}
                selected={form.symptoms.includes(s)}
                onToggle={() => toggleSymptom(s)}
              />
            ))}
          </div>
          {errors.symptoms && <p className="text-xs text-red-500">{errors.symptoms}</p>}
        </div>

        {/* Numbers */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title">Affected Animals</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Animals affected *</label>
              <input type="number" min="1" className="input" placeholder="3"
                value={form.affectedAnimals}
                onChange={e => setForm(p => ({ ...p, affectedAnimals: e.target.value }))} />
              {errors.affectedAnimals && <p className="text-xs text-red-500 mt-1">{errors.affectedAnimals}</p>}
            </div>
            <div>
              <label className="label">Mortality</label>
              <input type="number" min="0" className="input" placeholder="0"
                value={form.mortality}
                onChange={e => setForm(p => ({ ...p, mortality: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Reporter */}
        <div className="card p-5 space-y-3">
          <h2 className="section-title">Reporter</h2>
          <div className="flex flex-wrap gap-2">
            {REPORTER_TYPES.map(r => (
              <button
                key={r} type="button"
                onClick={() => setForm(p => ({ ...p, reporterType: r }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${form.reporterType === r
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                  }`}
              >{r}</button>
            ))}
          </div>
          {errors.reporterType && <p className="text-xs text-red-500">{errors.reporterType}</p>}
        </div>

        {/* Notes + Image */}
        <div className="card p-5 space-y-4">
          <h2 className="section-title">Additional Notes</h2>
          <textarea
            className="input resize-none h-20"
            placeholder="Any other observations…"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />
          <div>
            <label className="label">Photo (optional)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center
                            text-slate-400 hover:border-brand-300 hover:text-brand-400 transition-colors cursor-pointer">
              <Upload className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xs">Tap to attach a photo</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button type="submit" className="btn-primary w-full justify-center py-3 text-sm">
          {isOnline ? 'Submit Report' : 'Save Report (Offline)'}
        </button>
      </form>

      <DemoControls
        isOnline={isOnline}
        onToggleOnline={() => setDemoOnline(!isOnline)}
        onLoadDemo={loadDemo}
        onReset={handleReset}
      />
    </div>
  )
}
