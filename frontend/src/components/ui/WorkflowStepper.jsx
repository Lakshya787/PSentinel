import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Brain, Stethoscope, FlaskConical,
  Megaphone, ShieldCheck, RefreshCcw, ChevronRight,
} from 'lucide-react'

const STEPS = [
  { key: 'REPORT',     label: 'Report',      icon: ClipboardList,  to: '/field-report', statuses: ['REPORTED']                    },
  { key: 'RISK',       label: 'Risk',         icon: Brain,          to: '/dashboard',    statuses: ['RISK_ANALYZED']               },
  { key: 'VET',        label: 'Vet',          icon: Stethoscope,    to: '/dashboard',    statuses: ['UNDER_INVESTIGATION']         },
  { key: 'LAB',        label: 'Lab',          icon: FlaskConical,   to: '/lab',          statuses: ['LAB_TESTING','LAB_CONFIRMED'] },
  { key: 'ALERT',      label: 'Alert',        icon: Megaphone,      to: '/alerts',       statuses: ['ALERT_SENT']                  },
  { key: 'ACTION',     label: 'Action',       icon: ShieldCheck,    to: '/actions',      statuses: ['CONTAINMENT']                 },
  { key: 'FEEDBACK',   label: 'Feedback',     icon: RefreshCcw,     to: '/dashboard',    statuses: []                              },
]

function getStepState(stepStatuses, caseStatus) {
  if (!caseStatus) return 'pending'
  const LIFECYCLE = [
    'REPORTED','RISK_ANALYZED','UNDER_INVESTIGATION',
    'LAB_TESTING','LAB_CONFIRMED','ALERT_SENT','CONTAINMENT',
  ]
  const statusIdx = LIFECYCLE.indexOf(caseStatus)

  if (stepStatuses.length === 0) {
    // FEEDBACK — active only at CONTAINMENT
    return caseStatus === 'CONTAINMENT' ? 'active' : statusIdx === LIFECYCLE.length - 1 ? 'done' : 'pending'
  }

  const stepMin = Math.min(...stepStatuses.map(s => LIFECYCLE.indexOf(s)))
  const stepMax = Math.max(...stepStatuses.map(s => LIFECYCLE.indexOf(s)))

  if (statusIdx > stepMax) return 'done'
  if (statusIdx >= stepMin && statusIdx <= stepMax) return 'active'
  return 'pending'
}

/**
 * WorkflowStepper — compact horizontal pipeline.
 * @param {{ caseStatus: string, compact?: boolean }} props
 */
export default function WorkflowStepper({ caseStatus, compact = false }) {
  const navigate = useNavigate()

  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-0.5 overflow-x-auto'}`}>
      {STEPS.map((step, i) => {
        const state = getStepState(step.statuses, caseStatus)
        const isLast = i === STEPS.length - 1

        return (
          <div key={step.key} className="flex items-center shrink-0">
            <button
              onClick={() => navigate(step.to)}
              title={step.label}
              className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all
                ${state === 'done'    ? 'text-green-600'  : ''}
                ${state === 'active'  ? 'text-brand-700 bg-brand-50' : ''}
                ${state === 'pending' ? 'text-slate-300'  : ''}
                hover:bg-slate-100
              `}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center
                ${state === 'done'    ? 'bg-green-100 text-green-600'  : ''}
                ${state === 'active'  ? 'bg-brand-100 text-brand-700'  : ''}
                ${state === 'pending' ? 'bg-slate-100 text-slate-300'  : ''}
              `}>
                <step.icon className="w-3.5 h-3.5" />
              </div>
              {!compact && (
                <span className={`text-[9px] font-bold uppercase tracking-widest leading-none
                  ${state === 'active' ? 'text-brand-700' : state === 'done' ? 'text-green-600' : 'text-slate-300'}
                `}>
                  {step.label}
                </span>
              )}
            </button>

            {!isLast && (
              <ChevronRight className={`w-3 h-3 shrink-0 mx-0.5
                ${state === 'done' ? 'text-green-400' : 'text-slate-200'}
              `} />
            )}
          </div>
        )
      })}
    </div>
  )
}
