import { FlaskConical } from 'lucide-react'
export default function LabPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-cyan-100 flex items-center justify-center">
        <FlaskConical className="w-7 h-7 text-cyan-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Laboratory</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        Lab sample tracking, PCR results, and confirmations will appear here in Phase 4.
      </p>
      <span className="text-xs font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-full">
        Coming in Phase 4
      </span>
    </div>
  )
}
