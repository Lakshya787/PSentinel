import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Home from './pages/Home'
import FieldReport from './pages/FieldReport'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import CaseDetail from './pages/CaseDetail'
import CasesListPage from './pages/CasesListPage'
import LabPage from './pages/LabPage'
import AlertsPage from './pages/AlertsPage'
import ActionsPage from './pages/ActionsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home — no app shell */}
        <Route path="/" element={<Home />} />

        {/* Field report — mobile-first, own layout handled inside */}
        <Route path="/field-report" element={<FieldReport />} />

        {/* All vet/dashboard routes inside AppLayout shell */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/map"          element={<MapPage />} />
          <Route path="/cases/all"    element={<CasesListPage />} />
          <Route path="/cases/:id"    element={<CaseDetail />} />
          <Route path="/lab"          element={<LabPage />} />
          <Route path="/alerts"       element={<AlertsPage />} />
          <Route path="/actions"      element={<ActionsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
