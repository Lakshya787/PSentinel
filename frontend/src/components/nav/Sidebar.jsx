import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, FolderOpen, FlaskConical,
  Bell, Zap, Shield, Wifi, WifiOff,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Overview',    active: true  },
  { to: '/map',          icon: Map,             label: 'Risk Map',    active: true  },
  { to: '/cases/all',    icon: FolderOpen,      label: 'Cases',       active: true  },
  { to: '/lab',          icon: FlaskConical,    label: 'Laboratory',  active: false },
  { to: '/alerts',       icon: Bell,            label: 'Alerts',      active: false },
  { to: '/actions',      icon: Zap,             label: 'Actions',     active: false },
]

export default function Sidebar({ isOnline }) {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-surface-border h-screen sticky top-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-tight truncate">Pashu Sentinel</p>
          <p className="text-[10px] text-slate-500 leading-tight truncate">Veterinary Intelligence</p>
        </div>
      </div>

      {/* Context */}
      <div className="px-5 py-3 border-b border-surface-border">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Context</p>
        <p className="text-xs font-medium text-slate-700">Junnar Taluk, Pune</p>
        <p className="text-[10px] text-slate-400">Maharashtra · India</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, active }) => (
          active ? (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ) : (
            <div
              key={to}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-400 cursor-not-allowed"
            >
              <span className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">
                Soon
              </span>
            </div>
          )
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-surface-border">
        <div className={`flex items-center gap-2 text-xs font-medium ${isOnline ? 'text-green-600' : 'text-amber-600'}`}>
          {isOnline
            ? <><Wifi className="w-3.5 h-3.5" /> System Online</>
            : <><WifiOff className="w-3.5 h-3.5" /> Offline Mode</>
          }
        </div>
        <p className="text-[10px] text-slate-400 mt-1">v0.1.0 · MVP Demo Build</p>
      </div>
    </aside>
  )
}
