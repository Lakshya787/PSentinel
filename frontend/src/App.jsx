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

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Redirects to /login if unauthenticated.
// Redirects to role-appropriate default if the user's role isn't allowed.
function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    // FARMER goes back to field report; others to dashboard
    return <Navigate to={user.role === 'FARMER' ? '/field-report' : '/dashboard'} replace />
  }

  return children
}

// ─── Root redirect ────────────────────────────────────────────────────────────
// Default route '/' always lands directly on the Login Page.
function RootRedirect() {
  return <Navigate to="/login" replace />
}

// ─── App ──────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root — role-based redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Field report — FARMER (and VET/DVO can also submit) */}
        <Route
          path="/field-report"
          element={
            <ProtectedRoute roles={['FARMER', 'VET', 'DVO']}>
              <FieldReport />
            </ProtectedRoute>
          }
        />

        {/* App layout shell for Dashboard, Cases, Map, Alerts, Actions */}
        <Route
          element={
            <ProtectedRoute roles={['FARMER', 'VET', 'DVO']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/cases/all"  element={<CasesListPage />} />
          <Route path="/cases/:id"  element={<CaseDetail />} />
          <Route path="/lab"        element={<LabPage />} />
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
    </AuthProvider>
  )
}
