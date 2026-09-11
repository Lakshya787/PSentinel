import { useNavigate } from 'react-router-dom'
import { useCaseStore } from '../hooks/useCaseStore'
import StatusBadge from '../components/ui/StatusBadge'
import { riskLevelHex } from '../utils/riskEngine'
import { ChevronRight } from 'lucide-react'

export default function CasesListPage() {
  const navigate           = useNavigate()
  const { casesByRisk }    = useCaseStore()

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-6 py-4">
        <h1 className="text-lg font-bold text-slate-900">All Cases</h1>
        <p className="text-xs text-slate-500">{casesByRisk.length} cases · sorted by risk</p>
      </header>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="card divide-y divide-surface-border overflow-hidden">
          {casesByRisk.map(c => {
            const hex = riskLevelHex(c.risk.level)
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/cases/${c.id}`)}
                className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: hex }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500">{c.id}</span>
                    <span className="text-xs font-semibold text-slate-800">{c.animalId}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{c.village} · {c.species} · {c.syndrome}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-black" style={{ color: hex }}>{c.risk.score}</p>
                  <p className="text-[9px] uppercase font-bold" style={{ color: hex }}>{c.risk.level}</p>
                </div>
                <StatusBadge status={c.status} size="sm" />
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
