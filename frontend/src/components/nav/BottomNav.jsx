import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, FolderOpen, Plus } from 'lucide-react'

const BOTTOM_NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Overview' },
  { to: '/map',        icon: Map,             label: 'Risk Map' },
  { to: '/cases/all',  icon: FolderOpen,      label: 'Cases'   },
  { to: '/field-report', icon: Plus,          label: 'Report'  },
]

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-surface-border
                    flex items-stretch safe-area-bottom">
      {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-brand-600' : 'text-slate-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
