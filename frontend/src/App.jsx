import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import LoginPage from './pages/LoginPage'
import FieldReport from './pages/FieldReport'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import CaseDetail from './pages/CaseDetail'
import CasesListPage from './pages/CasesListPage'
import LabPage from './pages/LabPage'
import AlertsPage from './pages/AlertsPage'
import ActionsPage from './pages/ActionsPage'
import VetChatWidget from './components/VetChatWidget'

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Redirects to /login if unauthenticated.
// Redirects to role-appropriate default if the user's role isn't allowed.
function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    // Send each role to their own home page
    if (user.role === 'FARMER') return <Navigate to="/field-report" replace />
    if (user.role === 'VET')    return <Navigate to="/dashboard" replace />
    if (user.role === 'DVO')    return <Navigate to="/dashboard" replace />
    return <Navigate to="/login" replace />
  }

  return children
}

// ─── Role-based default landing page ────────────────────────────────────────
function RoleHome() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'FARMER') return <Navigate to="/field-report" replace />
  return <Navigate to="/dashboard" replace />
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

        {/* ── FARMER routes ─────────────────────────────────────────────── */}
        {/* Field report — all roles can submit */}
        <Route
          path="/field-report"
          element={
            <ProtectedRoute roles={['FARMER', 'VET', 'DVO']}>
              <FieldReport />
            </ProtectedRoute>
          }
        />

        {/* ── VET + DVO routes (AppLayout shell) ───────────────────────── */}
        <Route
          element={
            <ProtectedRoute roles={['VET', 'DVO']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          {/* Shared by VET + DVO */}
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/cases/all"  element={<CasesListPage />} />
          <Route path="/cases/:id"  element={<CaseDetail />} />
          <Route path="/alerts"     element={<AlertsPage />} />

          {/* VET only */}
          <Route
            path="/lab"
            element={
              <ProtectedRoute roles={['VET']}>
                <LabPage />
              </ProtectedRoute>
            }
          />

          {/* DVO only */}
          <Route
            path="/actions"
            element={
              <ProtectedRoute roles={['DVO']}>
                <ActionsPage />
              </ProtectedRoute>
            }
          />
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
