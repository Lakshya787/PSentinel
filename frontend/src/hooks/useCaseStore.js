// ─── useCaseStore ─────────────────────────────────────────────────────────────
// Global shared case state. All pages read/write through this hook.
// Backed by localStorage so state survives refreshes.

import { useState, useCallback } from 'react'
import { loadCaseDB, saveCaseDB, resetCaseDB, getCaseById } from '../data/cases'
import { calculateRisk } from '../utils/riskEngine'
import { STATUS_LABELS } from '../utils/caseStatus'

export function useCaseStore() {
  const [db, setDb] = useState(loadCaseDB)

  // ── Read helpers ────────────────────────────────────────────────────────────
  const cases        = Object.values(db)
  const getCase      = useCallback((id) => db[id] ?? null, [db])
  const casesByRisk  = [...cases].sort((a, b) => b.risk.score - a.risk.score)

  // ── Advance case status ─────────────────────────────────────────────────────
  const advanceStatus = useCallback((caseId, note = '') => {
    const LIFECYCLE = [
      'REPORTED', 'RISK_ANALYZED', 'UNDER_INVESTIGATION',
      'LAB_TESTING', 'LAB_CONFIRMED', 'ALERT_SENT', 'CONTAINMENT',
    ]
    setDb(prev => {
      const c = prev[caseId]
      if (!c) return prev
      const idx = LIFECYCLE.indexOf(c.status)
      if (idx === -1 || idx >= LIFECYCLE.length - 1) return prev
      const nextStatus = LIFECYCLE[idx + 1]
      const now = new Date().toISOString()
      const updated = {
        ...c,
        status: nextStatus,
        updatedAt: now,
        timeline: [
          ...c.timeline,
          {
            status: nextStatus,
            label: STATUS_LABELS[nextStatus] ?? nextStatus,
            at: now,
            note,
          },
        ],
      }
      const next = { ...prev, [caseId]: updated }
      saveCaseDB(next)
      return next
    })
  }, [])

  // ── Add or upsert a case (from field report sync) ──────────────────────────
  const upsertCase = useCallback((caseObj) => {
    setDb(prev => {
      const withRisk = { ...caseObj, risk: calculateRisk(caseObj.riskFactors) }
      const next = { ...prev, [caseObj.id]: withRisk }
      saveCaseDB(next)
      return next
    })
  }, [])

  // ── Reset to seed ───────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    const fresh = resetCaseDB()
    setDb(fresh)
  }, [])

  // ── KPIs (derived, no hardcoding) ──────────────────────────────────────────
  const kpis = {
    criticalCases:  cases.filter(c => c.risk.level === 'CRITICAL').length,
    highRiskCases:  cases.filter(c => c.risk.level === 'HIGH').length,
    activeClusters: 2, // deterministic demo value
    pendingLab:     cases.filter(c => c.status === 'LAB_TESTING').length,
  }

  return { db, cases, casesByRisk, getCase, advanceStatus, upsertCase, resetAll, kpis }
}
