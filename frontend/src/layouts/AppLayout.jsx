import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Sidebar from '../components/nav/Sidebar'
import BottomNav from '../components/nav/BottomNav'
import OfflineBanner from '../components/ui/OfflineBanner'
import DemoControls from '../components/ui/DemoControls'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useCaseStore } from '../hooks/useCaseStore'
import { useAuth } from '../context/AuthContext'

// ─── Role colours ─────────────────────────────────────────────────────────────
const ROLE_STYLE = {
  VET:    { bg: 'rgba(8,145,178,0.2)',   color: '#67e8f9', label: 'Vet' },
  DVO:    { bg: 'rgba(193,140,93,0.2)',  color: '#fbbf24', label: 'DVO' },
  FARMER: { bg: 'rgba(93,112,82,0.2)',   color: '#86efac', label: 'Farmer' },
}

export default function AppLayout() {
  const { isOnline, setDemoOnline } = useOnlineStatus()
  const { resetAll } = useCaseStore()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleToggleOnline() { setDemoOnline(!isOnline) }

  function handleReset() {
    resetAll()
    localStorage.removeItem('ps_field_reports')
    localStorage.removeItem('ps_demo_online_override')
    window.location.reload()
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const rs = ROLE_STYLE[user?.role] ?? ROLE_STYLE.FARMER

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <Sidebar isOnline={isOnline} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OfflineBanner isOnline={isOnline} />

        {/* ── User bar ──────────────────────────────────────────────────────── */}
        {user && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: '0.625rem', padding: '0.5rem 1.25rem',
              borderBottom: '1px solid rgba(222,216,207,0.4)',
              background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(8px)',
            }}
          >
            {/* Role badge */}
            <span style={{
              background: rs.bg, color: rs.color,
              padding: '0.2rem 0.6rem', borderRadius: '99px',
              fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              {rs.label}
            </span>

            {/* Name */}
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3d3d30' }}>
              {user.name}
            </span>

            {/* Logout */}
            <button
              id="btn-logout"
              onClick={handleLogout}
              title="Log out"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                padding: '0.3rem 0.6rem', borderRadius: '0.5rem',
                background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
                color: '#dc2626', fontSize: '0.72rem', fontWeight: 600,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.08)')}
            >
              <LogOut style={{ width: '0.8rem', height: '0.8rem' }} />
              Logout
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <BottomNav />

      <DemoControls
        isOnline={isOnline}
        onToggleOnline={handleToggleOnline}
        onLoadDemo={() => window.location.assign('/field-report?demo=1')}
        onReset={handleReset}
      />
    </div>
  )
}
