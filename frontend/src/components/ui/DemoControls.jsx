import { Wifi, WifiOff, RotateCcw, FlaskConical } from 'lucide-react'

/**
 * DemoControls — small floating panel for demo/video recording.
 * Deliberately understated — meant for demo operator use only.
 *
 * @param {{
 *   isOnline: boolean,
 *   onToggleOnline: () => void,
 *   onLoadDemo: () => void,
 *   onReset: () => void,
 * }} props
 */
export default function DemoControls({ isOnline, onToggleOnline, onLoadDemo, onReset }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-1 items-end">
      {/* Label */}
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest pr-1">
        Demo Controls
      </p>

      <div className="flex items-center gap-1 bg-white border border-surface-border
                      shadow-lg rounded-xl p-1.5">
        {/* Load Demo Case */}
        <button
          onClick={onLoadDemo}
          title="Load Demo Case (COW-1024)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Demo Case
        </button>

        <div className="w-px h-5 bg-surface-border" />

        {/* Toggle Online/Offline */}
        <button
          onClick={onToggleOnline}
          title={isOnline ? 'Switch to Offline' : 'Switch to Online'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
            ${isOnline
              ? 'text-green-700 hover:bg-green-50'
              : 'text-amber-700 hover:bg-amber-50'
            }`}
        >
          {isOnline
            ? <><Wifi className="w-3.5 h-3.5" /> Online</>
            : <><WifiOff className="w-3.5 h-3.5" /> Offline</>
          }
        </button>

        <div className="w-px h-5 bg-surface-border" />

        {/* Reset */}
        <button
          onClick={onReset}
          title="Reset Demo"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                     text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>
    </div>
  )
}
