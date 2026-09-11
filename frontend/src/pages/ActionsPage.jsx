import { Zap } from 'lucide-react'
export default function ActionsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
        <Zap className="w-7 h-7 text-violet-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Actions</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        Containment actions, vaccination drives, and response coordination will appear here in Phase 4.
      </p>
      <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-full">
        Coming in Phase 4
      </span>
    </div>
  )
}
