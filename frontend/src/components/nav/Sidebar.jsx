import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, FolderOpen, FlaskConical,
  Bell, Zap, Leaf, Wifi, WifiOff, ClipboardList,
  PlusCircle, MessageCircle, LogOut, User,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// ─── Nav items per role ───────────────────────────────────────────────────────
const NAV_BY_ROLE = {
  FARMER: [
    { to: '/field-report', icon: ClipboardList,   label: 'Report Case',  desc: 'Report sick animals' },
  ],
  VET: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Triage Board', desc: 'Prioritised case queue' },
    { to: '/cases/all',    icon: FolderOpen,      label: 'Cases',        desc: 'All reported cases' },
    { to: '/lab',          icon: FlaskConical,    label: 'Laboratory',   desc: 'Lab referrals & results' },
    { to: '/alerts',       icon: Bell,            label: 'Alerts',       desc: 'Active outbreak alerts' },
    { to: '/map',          icon: Map,             label: 'Risk Map',     desc: 'Geospatial view' },
    { to: '/field-report', icon: PlusCircle,      label: 'New Report',   desc: 'Submit field report' },
  ],
  DVO: [
    { to: '/dashboard',    icon: LayoutDashboard, label: 'Command',      desc: 'District overview' },
    { to: '/map',          icon: Map,             label: 'Risk Map',     desc: 'Disease spread map' },
    { to: '/alerts',       icon: Bell,            label: 'Alerts',       desc: 'District-wide alerts' },
    { to: '/cases/all',    icon: FolderOpen,      label: 'All Cases',    desc: 'District case ledger' },
    { to: '/actions',      icon: Zap,             label: 'Actions',      desc: 'Response & containment' },
    { to: '/field-report', icon: PlusCircle,      label: 'New Report',   desc: 'Submit field report' },
  ],
}

const ROLE_META = {
  FARMER: { label: 'Farmer',                  color: '#5d7052', bg: 'rgba(93,112,82,0.12)'   },
  VET:    { label: 'Block Veterinary Officer', color: '#0891b2', bg: 'rgba(8,145,178,0.12)'  },
  DVO:    { label: 'District Vet. Officer',    color: '#b45309', bg: 'rgba(180,83,9,0.12)'   },
}

export default function Sidebar({ isOnline }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = user?.role ?? 'FARMER'
  const nav = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.FARMER
  const meta = ROLE_META[role] ?? ROLE_META.FARMER

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 z-30"
      style={{
        background: 'rgba(253,252,248,0.9)',
        backdropFilter: 'blur(14px)',
        borderRight: '1px solid rgba(222,216,207,0.7)',
        boxShadow: '2px 0 16px rgba(93,112,82,0.06)',
      }}
    >
      {/* ── Brand ──────────────────────────────────────────────────────────── */}
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
            style={{ fontFamily: "'Fraunces', serif", color: '#2c2c24', letterSpacing: '-0.02em' }}
          >
            Pashu Sentinel
          </p>
          <p className="text-[10px] leading-tight truncate" style={{ color: '#78786c' }}>
            Veterinary Intelligence
          </p>
        </div>
      </div>

      {/* ── Logged-in user / role pill ──────────────────────────────────────── */}
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ borderBottom: '1px solid rgba(222,216,207,0.5)', background: 'rgba(240,235,229,0.35)' }}
      >
        <div
          className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
          style={{ background: meta.bg }}
        >
          <User className="w-4 h-4" style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold truncate" style={{ color: '#2c2c24' }}>{user?.name ?? 'User'}</p>
          <p className="text-[9px] font-semibold truncate" style={{ color: meta.color }}>{meta.label}</p>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* Section label */}
        <p className="text-[9px] font-bold uppercase tracking-widest px-3 pb-2" style={{ color: '#a0a08c' }}>
          {role === 'FARMER' ? 'My Tools' : role === 'VET' ? 'Clinical Workspace' : 'District Command'}
        </p>

        {nav.map(({ to, icon: Icon, label, desc }) => (
          <NavLink
            key={to}
            to={to}
            title={desc}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                isActive ? 'active-nav-item' : 'inactive-nav-item'
              }`
            }
            style={({ isActive }) => ({
              borderRadius: '0.875rem',
              background: isActive
                ? `linear-gradient(135deg, ${meta.bg}, rgba(93,112,82,0.04))`
                : 'transparent',
              color: isActive ? meta.color : '#5a5a50',
              boxShadow: isActive ? `0 2px 8px ${meta.bg}` : 'none',
            })}
          >
            {({ isActive }) => (
              <>
                <div
                  className="w-7 h-7 flex items-center justify-center shrink-0 transition-all duration-200"
                  style={{
                    borderRadius: '0.625rem',
                    background: isActive ? meta.bg : 'transparent',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: isActive ? meta.color : '#78786c' }} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-2" style={{ borderTop: '1px solid rgba(222,216,207,0.6)' }}>
        {/* Online status */}
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: isOnline ? '#5d7052' : '#c18c5d' }}>
          {isOnline
            ? <><Wifi className="w-3.5 h-3.5" /> System Online</>
            : <><WifiOff className="w-3.5 h-3.5" /> Offline Mode</>
          }
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={{
            background: 'rgba(220,38,38,0.07)',
            border: '1px solid rgba(220,38,38,0.18)',
            color: '#dc2626',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.07)')}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>

        <p className="text-[10px]" style={{ color: '#a0a08c' }}>Phase 5 · Demo Build</p>
      </div>
    </aside>
  )
}
