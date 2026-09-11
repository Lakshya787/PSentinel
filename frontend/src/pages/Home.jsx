import { useNavigate } from 'react-router-dom'
import { Shield, Stethoscope, ClipboardList, ArrowRight } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-brand-900 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-10 pb-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-5 backdrop-blur-sm">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Pashu Sentinel</h1>
        <p className="text-brand-300 text-sm mt-1 font-medium">
          Livestock Disease Early-Warning &amp; Veterinary Intelligence
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-300 text-xs font-semibold">System Active · Junnar, Pune</span>
        </div>
      </header>

      {/* Role cards */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-4 pb-12 max-w-md mx-auto w-full">
        <p className="text-brand-400 text-xs font-semibold uppercase tracking-widest mb-2">
          Select your role to continue
        </p>

        {/* Field Worker */}
        <button
          onClick={() => navigate('/field-report')}
          className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20
                     rounded-2xl p-5 text-left transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-brand-500/30 flex items-center justify-center mb-4">
              <ClipboardList className="w-5 h-5 text-brand-200" />
            </div>
            <ArrowRight className="w-4 h-4 text-brand-400 mt-1 group-hover:translate-x-1 transition-transform" />
          </div>
          <h2 className="text-white font-bold text-lg leading-tight">Field Worker</h2>
          <p className="text-brand-300 text-sm mt-1">
            Pashu Sakhi · Community Volunteer
          </p>
          <p className="text-brand-400 text-xs mt-2">
            Report livestock cases from the field. Works offline.
          </p>
        </button>

        {/* Vet Officer */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/20
                     rounded-2xl p-5 text-left transition-all group"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-teal-500/30 flex items-center justify-center mb-4">
              <Stethoscope className="w-5 h-5 text-teal-200" />
            </div>
            <ArrowRight className="w-4 h-4 text-brand-400 mt-1 group-hover:translate-x-1 transition-transform" />
          </div>
          <h2 className="text-white font-bold text-lg leading-tight">Veterinary Officer</h2>
          <p className="text-brand-300 text-sm mt-1">
            District AHD · State Command
          </p>
          <p className="text-brand-400 text-xs mt-2">
            Monitor cases, risk intelligence, and geographic clusters.
          </p>
        </button>
      </main>

      <footer className="text-center pb-8">
        <p className="text-brand-600 text-xs">Ministry of Fisheries, Animal Husbandry &amp; Dairying · GoI</p>
      </footer>
    </div>
  )
}
