import { Wifi, WifiOff } from 'lucide-react'

/**
 * OfflineBanner — sticky top banner shown when the device is offline.
 * @param {{ isOnline: boolean }} props
 */
export default function OfflineBanner({ isOnline }) {
  if (isOnline) return null

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2.5
                    bg-amber-500 text-white text-sm font-medium shadow-md">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>No internet connection — reports are saved securely on this device.</span>
    </div>
  )
}
