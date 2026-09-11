import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'

/**
 * SyncStatus — small inline indicator for sync state.
 * @param {{ syncStatus: 'PENDING'|'SYNCING'|'SYNCED'|'ERROR', isOnline: boolean }} props
 */
export default function SyncStatus({ syncStatus, isOnline }) {
  if (syncStatus === 'SYNCED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Synced
      </span>
    )
  }
  if (syncStatus === 'SYNCING') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-medium">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Syncing…
      </span>
    )
  }
  if (!isOnline) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
        <WifiOff className="w-3.5 h-3.5" />
        Saved locally
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
      <Wifi className="w-3.5 h-3.5" />
      Pending sync
    </span>
  )
}
