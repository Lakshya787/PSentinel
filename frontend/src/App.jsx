import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import LoginPage from './pages/LoginPage'
import FieldReport from './pages/FieldReport'
import Dashboard from './pages/Dashboard'
import VetDashboard from './pages/VetDashboard'
import DVODashboard from './pages/DVODashboard'
import FarmerDashboard from './pages/FarmerDashboard'
import MapPage from './pages/MapPage'
import CaseDetail from './pages/CaseDetail'
import CasesListPage from './pages/CasesListPage'
import LabPage from './pages/LabPage'
import AlertsPage from './pages/AlertsPage'
import ActionsPage from './pages/ActionsPage'
import VetChatWidget from './components/VetChatWidget'

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'FARMER') return <Navigate to="/farmer" replace />
    if (user.role === 'VET')    return <Navigate to="/vet" replace />
    if (user.role === 'DVO')    return <Navigate to="/dvo" replace />
    return <Navigate to="/login" replace />
  }

  return children
}

// ─── Role-based default landing page ─────────────────────────────────────────
function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'FARMER') return <Navigate to="/farmer" replace />
  if (user.role === 'VET')    return <Navigate to="/vet" replace />
  if (user.role === 'DVO')    return <Navigate to="/dvo" replace />
  return <Navigate to="/login" replace />
}

// ─── App ──────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root — send to login if not authed, otherwise role home */}
        <Route path="/" element={<RoleHome />} />

        {/* ── FARMER routes ──────────────────────────────────────────────── */}
        {/* Farmer home dashboard */}
        <Route
          path="/farmer"
          element={
            <ProtectedRoute roles={['FARMER']}>
              <FarmerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Field report — all roles can submit */}
        <Route
          path="/field-report"
          element={
            <ProtectedRoute roles={['FARMER', 'VET', 'DVO']}>
              <FieldReport />
            </ProtectedRoute>
          }
        />

        {/* ── VET routes (AppLayout shell) ───────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute roles={['VET']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/vet"        element={<VetDashboard />} />
          {/* Keep /dashboard for backwards-compat */}
          <Route path="/dashboard"  element={<VetDashboard />} />
          <Route path="/cases/all"  element={<CasesListPage />} />
          <Route path="/cases/:id"  element={<CaseDetail />} />
          <Route path="/lab"        element={<LabPage />} />
          <Route path="/alerts"     element={<AlertsPage />} />
          <Route path="/map"        element={<MapPage />} />
        </Route>

        {/* ── DVO routes (AppLayout shell) ───────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute roles={['DVO']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dvo"        element={<DVODashboard />} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/cases/all"  element={<CasesListPage />} />
          <Route path="/cases/:id"  element={<CaseDetail />} />
          <Route path="/alerts"     element={<AlertsPage />} />
          <Route path="/actions"    element={<ActionsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <VetChatWidget />
    </AuthProvider>
  )
}
