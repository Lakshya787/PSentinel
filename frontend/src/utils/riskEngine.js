// ─── Risk Engine (frontend mirror of backend/risk_engine.py) ─────────────────

export const RISK_WEIGHTS = {
  clinical:      0.30,
  vaccination:   0.25,
  environmental: 0.25,
  spatial:       0.20,
}

export const RISK_LEVELS = {
  CRITICAL: { label: 'CRITICAL', min: 80, tailwind: 'text-red-700 bg-red-50 border-red-200',    hex: '#dc2626' },
  HIGH:     { label: 'HIGH',     min: 60, tailwind: 'text-orange-700 bg-orange-50 border-orange-200', hex: '#ea580c' },
  MEDIUM:   { label: 'MEDIUM',   min: 40, tailwind: 'text-yellow-700 bg-yellow-50 border-yellow-200', hex: '#ca8a04' },
  LOW:      { label: 'LOW',      min: 0,  tailwind: 'text-green-700 bg-green-50 border-green-200',  hex: '#16a34a' },
}

/**
 * Calculate composite risk score.
 * COW-1024: { clinical:92, vaccination:80, environmental:85, spatial:95 } → { score:88, level:'CRITICAL' }
 *
 * @param {{ clinical: number, vaccination: number, environmental: number, spatial: number }} factors
 * @returns {{ score: number, level: string, levelMeta: object, factors: object }}
 */
export function calculateRisk({ clinical, vaccination, environmental, spatial }) {
  const raw =
    clinical      * RISK_WEIGHTS.clinical +
    vaccination   * RISK_WEIGHTS.vaccination +
    environmental * RISK_WEIGHTS.environmental +
    spatial       * RISK_WEIGHTS.spatial

  const score = Math.round(raw)

  let level = 'LOW'
  if      (score >= 80) level = 'CRITICAL'
  else if (score >= 60) level = 'HIGH'
  else if (score >= 40) level = 'MEDIUM'

  return { score, level, levelMeta: RISK_LEVELS[level], factors: { clinical, vaccination, environmental, spatial } }
}

export function riskLevelClasses(level) {
  return RISK_LEVELS[level]?.tailwind ?? RISK_LEVELS.LOW.tailwind
}

export function riskLevelHex(level) {
  return RISK_LEVELS[level]?.hex ?? RISK_LEVELS.LOW.hex
}
