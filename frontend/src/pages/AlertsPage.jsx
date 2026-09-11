import { Bell } from 'lucide-react'
export default function AlertsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
        <Bell className="w-7 h-7 text-red-600" />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Alerts</h1>
      <p className="text-sm text-slate-500 max-w-sm">
        District alerts, movement restrictions, and notifications will appear here in Phase 4.
      </p>
      <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
        Coming in Phase 4
      </span>
    </div>
  )
}
