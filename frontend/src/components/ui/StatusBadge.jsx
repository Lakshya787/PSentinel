import { STATUS_LABELS, STATUS_TAILWIND } from '../../utils/caseStatus'

/**
 * StatusBadge — colour-coded pill for case lifecycle status.
 * @param {{ status: string, size?: 'sm'|'md' }} props
 */
export default function StatusBadge({ status, size = 'md' }) {
  const label   = STATUS_LABELS[status]  ?? status
  const classes = STATUS_TAILWIND[status] ?? 'text-slate-600 bg-slate-100 border-slate-200'
  const sz      = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border tracking-wide uppercase ${sz} ${classes}`}>
      {label}
    </span>
  )
}
