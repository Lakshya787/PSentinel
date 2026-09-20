import { useNavigate } from 'react-router-dom'
import {
  Shield, Stethoscope, ClipboardList, ArrowRight,
  Brain, FlaskConical, Megaphone, ShieldCheck, ChevronRight,
  Leaf,
} from 'lucide-react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useCaseStore } from '../hooks/useCaseStore'
import DemoControls from '../components/ui/DemoControls'

/* ── Inline blob background ──────────────────────────────────────────────────── */
function BlobBlur({ className, color }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute pointer-events-none select-none ${className}`}
      style={{
        background: color,
        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
        filter: 'blur(72px)',
      }}
    />
  )
}

/* ── Workflow step ───────────────────────────────────────────────────────────── */
function WorkflowStep({ icon: Icon, label, color, isLast }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col items-center gap-1">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
          style={{ background: color, boxShadow: '0 4px 12px -2px rgba(0,0,0,0.2)' }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
          {label}
        </span>
      </div>
      {!isLast && (
        <ChevronRight className="w-3.5 h-3.5 text-white/25 mb-5 shrink-0" />
      )}
    </div>
  )
}

/* ── Role card ───────────────────────────────────────────────────────────────── */
function RoleCard({ id, icon: Icon, iconBg, title, sub, desc, cta, ctaColor, onClick }) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="w-full text-left group transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: 'rgba(253,252,248,0.07)',
        backdropFilter: 'blur(12px)',
        borderRadius: '1.5rem',
        border: '1px solid rgba(255,255,255,0.14)',
        padding: '1.25rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: iconBg, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <ArrowRight
          className="w-4 h-4 text-white/40 mt-1 transition-transform group-hover:translate-x-1"
        />
      </div>

      <h2 className="text-white font-bold text-base leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>
        {title}
      </h2>
      <p className="text-white/50 text-xs mt-0.5 font-medium">{sub}</p>
      <p className="text-white/40 text-xs mt-2 leading-relaxed">{desc}</p>

      <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold" style={{ color: ctaColor }}>
        <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: ctaColor }} />
        {cta}
      </div>
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════ */
export default function Home() {
  const navigate = useNavigate()
  const { isOnline, setDemoOnline } = useOnlineStatus()
  const { resetAll } = useCaseStore()

  function handleReset() {
    resetAll()
    localStorage.removeItem('ps_field_reports')
    localStorage.removeItem('ps_demo_online_override')
    window.location.reload()
  }

  const WORKFLOW = [
    { icon: ClipboardList, label: 'Report', color: 'rgba(93,112,82,0.9)'   },
    { icon: Brain,         label: 'Risk',   color: 'rgba(124,58,237,0.85)' },
    { icon: Stethoscope,   label: 'Vet',    color: 'rgba(8,145,178,0.85)'  },
    { icon: FlaskConical,  label: 'Lab',    color: 'rgba(15,118,110,0.85)' },
    { icon: Megaphone,     label: 'Alert',  color: 'rgba(193,140,93,0.9)'  },
    { icon: ShieldCheck,   label: 'Action', color: 'rgba(22,163,74,0.85)'  },
  ]

  return (
    <div
      className="min-h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(145deg, #1a2315 0%, #2c3820 40%, #1f2a1a 70%, #151a12 100%)' }}
    >
      {/* ── Ambient blobs ───────────────────────────────────────────────── */}
      <BlobBlur
        className="w-96 h-96 -top-32 -left-24 opacity-30"
        color="rgba(93,112,82,0.6)"
      />
      <BlobBlur
        className="w-80 h-80 top-1/3 -right-20 opacity-20"
        color="rgba(193,140,93,0.5)"
        style={{ borderRadius: '40% 60% 70% 30% / 40% 70% 30% 60%' }}
      />
      <BlobBlur
        className="w-72 h-72 -bottom-20 left-1/4 opacity-15"
        color="rgba(93,112,82,0.4)"
        style={{ borderRadius: '45% 55% 65% 35% / 50% 40% 60% 50%' }}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="relative z-10 px-6 pt-12 pb-6 text-center animate-slideUp">
        <div
          className="inline-flex items-center justify-center w-20 h-20 mb-5 p-2"
          style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '1.5rem',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <img
            src="/psentinel.png"
            alt="Pashu Sentinel Logo"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>

        <h1
          className="text-4xl font-extrabold text-white tracking-tight"
          style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-0.03em' }}
        >
          PASHU SENTINEL
        </h1>
        <p className="text-white/55 text-sm mt-2 font-medium max-w-xs mx-auto leading-relaxed">
          Livestock Disease Early-Warning &amp; Veterinary Decision Support
        </p>

        {/* System status */}
        <div
          className="mt-3 inline-flex items-center gap-2 px-3 py-1.5"
          style={{
            background: 'rgba(93,112,82,0.2)',
            border: '1px solid rgba(93,112,82,0.35)',
            borderRadius: '99px',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-300 text-xs font-bold">System Active · Junnar, Pune</span>
        </div>
      </header>

      {/* ── Product description ──────────────────────────────────────────── */}
      <div className="relative z-10 px-6 pb-4 text-center animate-fadeIn">
        <p className="text-white/35 text-xs leading-relaxed max-w-sm mx-auto">
          Convert field reports into prioritized, explainable and geographically
          actionable veterinary intelligence.
        </p>
      </div>

      {/* ── Workflow pipeline ────────────────────────────────────────────── */}
      <div className="relative z-10 px-4 py-4">
        <div className="max-w-sm mx-auto">
          <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest text-center mb-3">
            Disease Response Pipeline
          </p>
          <div className="flex items-start justify-center flex-wrap gap-y-2">
            {WORKFLOW.map((step, i) => (
              <WorkflowStep
                key={step.label}
                {...step}
                isLast={i === WORKFLOW.length - 1}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Role cards ──────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 gap-3 pb-12 max-w-md mx-auto w-full animate-slideUp">
        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">
          Select your role to continue
        </p>

        <RoleCard
          id="btn-field-report"
          icon={ClipboardList}
          iconBg="rgba(93,112,82,0.7)"
          title="Field Worker"
          sub="Pashu Sakhi · Community Volunteer"
          desc="Report livestock disease cases from the field. Works fully offline — syncs when connection is restored."
          cta="Start Field Report"
          ctaColor="#86efac"
          onClick={() => navigate('/field-report')}
        />

        <RoleCard
          id="btn-vet-dashboard"
          icon={Stethoscope}
          iconBg="rgba(8,145,178,0.7)"
          title="Veterinary Officer"
          sub="District AHD · State Command"
          desc="Monitor cases, risk intelligence, geographic clusters, lab referrals, and district alerts."
          cta="Open Veterinary Dashboard"
          ctaColor="#67e8f9"
          onClick={() => navigate('/dashboard')}
        />
      </main>

      <footer className="relative z-10 text-center pb-8">
        <p className="text-white/20 text-[10px]">
          Ministry of Fisheries, Animal Husbandry &amp; Dairying · Government of India
        </p>
      </footer>

      <DemoControls
        isOnline={isOnline}
        onToggleOnline={() => setDemoOnline(!isOnline)}
        onLoadDemo={() => navigate('/field-report?demo=1')}
        onReset={handleReset}
      />
    </div>
  )
}
