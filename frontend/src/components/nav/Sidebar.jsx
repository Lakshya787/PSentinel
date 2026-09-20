import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Map, FolderOpen, FlaskConical,
  Bell, Zap, Leaf, Wifi, WifiOff, ClipboardList,
} from 'lucide-react'

const NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Overview'     },
  { to: '/field-report', icon: ClipboardList,   label: 'Field Report' },
  { to: '/map',          icon: Map,             label: 'Risk Map'     },
  { to: '/cases/all',    icon: FolderOpen,      label: 'Cases'        },
  { to: '/lab',          icon: FlaskConical,    label: 'Laboratory'   },
  { to: '/alerts',       icon: Bell,            label: 'Alerts'       },
  { to: '/actions',      icon: Zap,             label: 'Actions'      },
]

export default function Sidebar({ isOnline }) {
  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 z-30"
      style={{
        background: 'rgba(253,252,248,0.85)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(222,216,207,0.7)',
        boxShadow: '2px 0 16px rgba(93,112,82,0.06)',
      }}
    >
      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: '1px solid rgba(222,216,207,0.6)' }}
      >
        <img
          src="/psentinel.png"
          alt="Pashu Sentinel"
          className="w-9 h-9 object-contain shrink-0 rounded-xl shadow-sm"
        />
        <div className="min-w-0">
          <p
            className="text-sm font-bold leading-tight truncate"
            style={{
              fontFamily: "'Fraunces', serif",
              color: '#2c2c24',
              letterSpacing: '-0.02em',
            }}
          >
            Pashu Sentinel
          </p>
          <p className="text-[10px] leading-tight truncate" style={{ color: '#78786c' }}>
            Veterinary Intelligence
          </p>
        </div>
      </div>

      {/* ── Active region ─────────────────────────────────────────────── */}
      <div
        className="px-5 py-2.5"
        style={{
          borderBottom: '1px solid rgba(222,216,207,0.5)',
          background: 'rgba(240,235,229,0.4)',
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#a0a08c' }}>
          Active Region
        </p>
        <p className="text-xs font-semibold" style={{ color: '#2c2c24' }}>Junnar Taluk, Pune</p>
        <p className="text-[10px]" style={{ color: '#78786c' }}>Maharashtra · India</p>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isActive ? 'active-nav-item' : 'inactive-nav-item'
              }`
            }
            style={({ isActive }) => ({
              borderRadius: '0.875rem',
              background: isActive
                ? 'linear-gradient(135deg, rgba(93,112,82,0.12), rgba(93,112,82,0.07))'
                : 'transparent',
              color: isActive ? '#4e5f45' : '#5a5a50',
              boxShadow: isActive ? '0 2px 8px rgba(93,112,82,0.1)' : 'none',
            })}
          >
            {({ isActive }) => (
              <>
                <div
                  className="w-7 h-7 flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    borderRadius: '0.625rem',
                    background: isActive ? 'rgba(93,112,82,0.15)' : 'transparent',
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{ color: isActive ? '#5d7052' : '#78786c' }}
                  />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div
        className="px-5 py-4"
        style={{ borderTop: '1px solid rgba(222,216,207,0.6)' }}
      >
        <div
          className="flex items-center gap-2 text-xs font-semibold"
          style={{ color: isOnline ? '#5d7052' : '#c18c5d' }}
        >
          {isOnline
            ? <><Wifi className="w-3.5 h-3.5" /> System Online</>
            : <><WifiOff className="w-3.5 h-3.5" /> Offline Mode</>
          }
        </div>
        <p className="text-[10px] mt-1" style={{ color: '#a0a08c' }}>Phase 5 · Demo Build</p>
      </div>
    </aside>
  )
}
