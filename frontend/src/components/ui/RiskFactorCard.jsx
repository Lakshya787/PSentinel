import { riskLevelHex } from '../../utils/riskEngine'

/**
 * RiskFactorCard — horizontal bar visualization for a single risk factor.
 * @param {{ label: string, score: number, level: string, description?: string }} props
 */
export default function RiskFactorCard({ label, score, level, description }) {
  const hex = riskLevelHex(level)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color: hex }}>
          {score} <span className="text-slate-400 font-normal text-xs">/ 100</span>
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: hex }}
        />
      </div>
    </div>
  )
}
