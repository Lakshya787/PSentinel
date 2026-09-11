import { Outlet } from 'react-router-dom'
import Sidebar from '../components/nav/Sidebar'
import BottomNav from '../components/nav/BottomNav'
import OfflineBanner from '../components/ui/OfflineBanner'
import DemoControls from '../components/ui/DemoControls'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useCaseStore } from '../hooks/useCaseStore'

export default function AppLayout() {
  const { isOnline, setDemoOnline } = useOnlineStatus()
  const { resetAll } = useCaseStore()

  function handleToggleOnline() { setDemoOnline(!isOnline) }

  function handleReset() {
    resetAll()
    localStorage.removeItem('ps_field_reports')
    localStorage.removeItem('ps_demo_online_override')
    window.location.reload()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <Sidebar isOnline={isOnline} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OfflineBanner isOnline={isOnline} />

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
