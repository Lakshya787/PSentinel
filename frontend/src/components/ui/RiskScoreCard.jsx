import { riskLevelClasses, riskLevelHex } from '../../utils/riskEngine'

/**
 * RiskScoreCard — circular gauge + level label.
 * @param {{ score: number, level: string, size?: 'sm'|'md'|'lg' }} props
 */
export default function RiskScoreCard({ score, level, size = 'md' }) {
  const hex    = riskLevelHex(level)
  const cls    = riskLevelClasses(level)

  const radius = { sm: 32, md: 48, lg: 64 }[size]
  const stroke = { sm: 6,  md: 8,  lg: 10 }[size]
  const dim    = { sm: 80, md: 112, lg: 144 }[size]
  const fSize  = { sm: 'text-lg',  md: 'text-3xl', lg: 'text-5xl' }[size]
  const lSize  = { sm: 'text-[9px]', md: 'text-xs', lg: 'text-sm' }[size]

  const circumference = 2 * Math.PI * radius
  const progress      = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          {/* Track */}
          <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none"
            stroke="#e2e8f0" strokeWidth={stroke} />
          {/* Progress */}
          <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none"
            stroke={hex} strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold leading-none ${fSize}`} style={{ color: hex }}>{score}</span>
          <span className={`text-slate-400 font-medium ${lSize}`}>/100</span>
        </div>
      </div>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${cls}`}>
        {level}
      </span>
    </div>
  )
}
