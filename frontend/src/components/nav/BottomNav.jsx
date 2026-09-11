import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Map, FlaskConical, Bell, Zap } from 'lucide-react'

const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/map',       icon: Map,             label: 'Risk Map' },
  { to: '/lab',       icon: FlaskConical,    label: 'Lab'      },
  { to: '/alerts',    icon: Bell,            label: 'Alerts'   },
  { to: '/actions',   icon: Zap,             label: 'Actions'  },
]

export default function BottomNav() {
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
      {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-all duration-200"
          style={({ isActive }) => ({
            color: isActive ? '#5d7052' : '#78786c',
          })}
        >
          {({ isActive }) => (
            <>
              <div
                className="w-8 h-6 flex items-center justify-center rounded-full transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(93,112,82,0.12)' : 'transparent',
                }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: isActive ? '#5d7052' : '#a0a090' }}
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
