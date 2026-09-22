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
 * Supports both object argument: { clinical, vaccination, environmental, spatial }
 * and positional arguments: calculateRisk(clinical, vaccination, environmental, spatial).
 *
 * @param {object|number} arg1 - factors object or clinical score
 * @param {number} [arg2] - vaccination score
 * @param {number} [arg3] - environmental score
 * @param {number} [arg4] - spatial score
 * @returns {{ score: number, level: string, levelMeta: object, factors: object }}
 */
export function calculateRisk(arg1, arg2, arg3, arg4) {
  let clinical = 50, vaccination = 50, environmental = 50, spatial = 50

  if (typeof arg1 === 'object' && arg1 !== null) {
    clinical      = Number(arg1.clinical ?? 50)
    vaccination   = Number(arg1.vaccination ?? 50)
    environmental = Number(arg1.environmental ?? 50)
    spatial       = Number(arg1.spatial ?? 50)
  } else {
    clinical      = Number(arg1 ?? 50)
    vaccination   = Number(arg2 ?? 50)
    environmental = Number(arg3 ?? 50)
    spatial       = Number(arg4 ?? 50)
  }

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
