export const CASE_STATUSES = [
  'REPORTED', 'RISK_ANALYZED', 'UNDER_INVESTIGATION',
  'LAB_TESTING', 'LAB_CONFIRMED', 'ALERT_SENT', 'CONTAINMENT',
]

export const STATUS_LABELS = {
  REPORTED:             'Reported',
  RISK_ANALYZED:        'Risk Analyzed',
  UNDER_INVESTIGATION:  'Under Investigation',
  LAB_TESTING:          'Lab Testing',
  LAB_CONFIRMED:        'Lab Confirmed',
  ALERT_SENT:           'Alert Sent',
  CONTAINMENT:          'Containment',
}

export const STATUS_TAILWIND = {
  REPORTED:             'text-slate-600 bg-slate-100 border-slate-200',
  RISK_ANALYZED:        'text-violet-700 bg-violet-50 border-violet-200',
  UNDER_INVESTIGATION:  'text-blue-700 bg-blue-50 border-blue-200',
  LAB_TESTING:          'text-cyan-700 bg-cyan-50 border-cyan-200',
  LAB_CONFIRMED:        'text-teal-700 bg-teal-50 border-teal-200',
  ALERT_SENT:           'text-red-700 bg-red-50 border-red-200',
  CONTAINMENT:          'text-green-700 bg-green-50 border-green-200',
}

export function getStatusIndex(status)  { return CASE_STATUSES.indexOf(status) }
export function getNextStatus(current)  {
  const idx = getStatusIndex(current)
  return (idx === -1 || idx === CASE_STATUSES.length - 1) ? null : CASE_STATUSES[idx + 1]
}
