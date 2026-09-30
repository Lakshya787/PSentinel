import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, FlaskConical, Bell, Zap, ClipboardList, FolderOpen, PlusCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const BOTTOM_NAV_BY_ROLE = {
  FARMER: [
    { to: '/field-report', icon: ClipboardList, label: 'Report' },
  ],
  VET: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Triage'  },
    { to: '/cases/all',    icon: FolderOpen,      label: 'Cases'   },
    { to: '/lab',          icon: FlaskConical,    label: 'Lab'     },
    { to: '/alerts',       icon: Bell,            label: 'Alerts'  },
    { to: '/map',          icon: Map,             label: 'Map'     },
  ],
  DVO: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Command' },
    { to: '/map',          icon: Map,             label: 'Map'     },
    { to: '/alerts',       icon: Bell,            label: 'Alerts'  },
    { to: '/cases/all',    icon: FolderOpen,      label: 'Cases'   },
    { to: '/actions',      icon: Zap,             label: 'Actions' },
  ],
}

const ROLE_COLOR = {
  FARMER: '#5d7052',
  VET:    '#0891b2',
  DVO:    '#b45309',
}

export default function BottomNav() {
  const { user } = useAuth()
  const role = user?.role ?? 'FARMER'
  const nav = BOTTOM_NAV_BY_ROLE[role] ?? BOTTOM_NAV_BY_ROLE.FARMER
  const activeColor = ROLE_COLOR[role] ?? '#5d7052'

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch"
      style={{
        background: 'rgba(253,252,248,0.92)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(222,216,207,0.8)',
        boxShadow: '0 -4px 20px rgba(93,112,82,0.08)',
      }}
    >
      {nav.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200"
          style={({ isActive }) => ({
            color: isActive ? activeColor : '#78786c',
          })}
        >
          {({ isActive }) => (
            <>
              <div
                className="w-8 h-6 flex items-center justify-center rounded-full transition-all duration-200"
                style={{
                  background: isActive ? `${activeColor}20` : 'transparent',
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: isActive ? activeColor : '#a0a090' }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
