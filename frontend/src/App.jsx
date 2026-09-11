import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import FieldReport from './pages/FieldReport'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import CaseDetail from './pages/CaseDetail'
import LabPage from './pages/LabPage'
import AlertsPage from './pages/AlertsPage'
import ActionsPage from './pages/ActionsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home / role selector — no shell layout */}
        <Route path="/" element={<Home />} />

        {/* All other routes get the app shell */}
        <Route element={<AppLayout />}>
          <Route path="/field-report" element={<FieldReport />} />
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/map"          element={<MapPage />} />
          <Route path="/cases/:id"    element={<CaseDetail />} />
          <Route path="/lab"          element={<LabPage />} />
          <Route path="/alerts"       element={<AlertsPage />} />
          <Route path="/actions"      element={<ActionsPage />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
