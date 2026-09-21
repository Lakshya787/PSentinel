// ─── useReportStore ───────────────────────────────────────────────────────────
// IndexedDB-backed store for offline field reports (ref.md §15).
//
// BEFORE: localStorage.setItem / JSON.parse — synchronous, 5 MB cap, tab-scoped
// NOW:    Dexie (IndexedDB) — async, durable, structured, no size limit
//
// Key design points:
//   • useLiveQuery() from dexie-react-hooks gives REACTIVE reads — the component
//     re-renders automatically whenever the IndexedDB table changes.
//   • All writes (addReport, updateReport, clearAll) return Promises.
//   • syncStatus field ('PENDING' | 'SYNCED' | 'FAILED') is used by the
//     Background Sync queue in the Workbox service worker.

import { useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { pashuDB } from '../db/pashuDB'

// ─── Public hook ─────────────────────────────────────────────────────────────
export function useReportStore() {
  // useLiveQuery: reactive — re-renders whenever the 'reports' table changes.
  // Returns [] while IndexedDB is loading (Dexie handles the async transparently).
  const reports = useLiveQuery(
    () => pashuDB.reports.orderBy('createdAt').reverse().toArray(),
    [],
    []   // fallback while the first query is loading
  )

  // ── Add (or upsert by reportId) ───────────────────────────────────────────
  // Dexie.put() is idempotent: if reportId already exists it updates, else inserts.
  // This matches the idempotency requirement for Background Sync retries (ref.md §15).
  const addReport = useCallback(async (report) => {
    const record = {
      ...report,
      syncStatus: report.syncStatus ?? 'PENDING',
      createdAt:  report.createdAt  ?? new Date().toISOString(),
    }
    await pashuDB.reports.put(record)
    return record
  }, [])

  // ── Patch existing report (e.g. update syncStatus after successful sync) ──
  const updateReport = useCallback(async (reportId, patch) => {
    await pashuDB.reports.update(reportId, patch)
  }, [])

  // ── Read single report by ID directly from DB (non-reactive, one-shot) ───
  const getReport = useCallback(async (reportId) => {
    return (await pashuDB.reports.get(reportId)) ?? null
  }, [])

  // ── Get all PENDING reports (for manual sync trigger) ─────────────────────
  const getPendingReports = useCallback(async () => {
    return pashuDB.reports.where('syncStatus').equals('PENDING').toArray()
  }, [])

  // ── Clear all reports from IndexedDB ──────────────────────────────────────
  const clearAll = useCallback(async () => {
    await pashuDB.reports.clear()
  }, [])

  return { reports, addReport, updateReport, getReport, getPendingReports, clearAll }
}
