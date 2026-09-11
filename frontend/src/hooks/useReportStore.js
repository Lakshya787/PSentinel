// ─── useReportStore ───────────────────────────────────────────────────────────
// localStorage-backed store for field reports.
// Reports persist across page refreshes — this is the core of the offline-first demo.

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'ps_field_reports'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

export function useReportStore() {
  const [reports, setReports] = useState(loadFromStorage)

  const addReport = useCallback((report) => {
    setReports(prev => {
      const next = [report, ...prev.filter(r => r.reportId !== report.reportId)]
      saveToStorage(next)
      return next
    })
    return report
  }, [])

  const updateReport = useCallback((reportId, patch) => {
    setReports(prev => {
      const next = prev.map(r => r.reportId === reportId ? { ...r, ...patch } : r)
      saveToStorage(next)
      return next
    })
  }, [])

  const getReport = useCallback((reportId) => {
    return loadFromStorage().find(r => r.reportId === reportId) ?? null
  }, [])

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setReports([])
  }, [])

  return { reports, addReport, updateReport, getReport, clearAll }
}
