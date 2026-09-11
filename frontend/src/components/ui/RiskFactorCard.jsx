// ─── Risk factor color by score ──────────────────────────────────────────────
function factorColor(score) {
  if (score >= 80) return '#dc2626' // CRITICAL red
  if (score >= 65) return '#ea580c' // HIGH orange
  if (score >= 45) return '#ca8a04' // MEDIUM amber
  return '#16a34a'                   // LOW green
}

/**
 * RiskFactorCard — horizontal bar visualization for a single risk factor.
 * @param {{ label: string, score: number, level: string, description?: string }} props
 */
export default function RiskFactorCard({ label, score, level, description }) {
  const color = factorColor(score)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-sm font-semibold text-slate-800 leading-tight">{label}</p>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
        <span className="text-base font-black tabular-nums shrink-0" style={{ color }}>
          {score}
          <span className="text-slate-400 font-normal text-xs"> / 100</span>
        </span>
      </div>
      {/* Track */}
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            backgroundColor: color,
            transition: 'width 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  )
}
