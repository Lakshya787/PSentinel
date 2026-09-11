// ─── useCaseStore ─────────────────────────────────────────────────────────────
// Global shared case state — ALL pages read/write through this single hook.
// Phase 4: extended with lab, alert, containment, and notification sub-states.

import { useState, useCallback } from 'react'
import { loadCaseDB, saveCaseDB, resetCaseDB } from '../data/cases'
import { calculateRisk } from '../utils/riskEngine'
import { STATUS_LABELS } from '../utils/caseStatus'

const LIFECYCLE = [
  'REPORTED', 'RISK_ANALYZED', 'UNDER_INVESTIGATION',
  'LAB_TESTING', 'LAB_CONFIRMED', 'ALERT_SENT', 'CONTAINMENT',
]

export function useCaseStore() {
  const [db, setDb] = useState(loadCaseDB)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const cases       = Object.values(db)
  const getCase     = useCallback((id) => db[id] ?? null, [db])
  const casesByRisk = [...cases].sort((a, b) => b.risk.score - a.risk.score)

  // ── Mutate helper ─────────────────────────────────────────────────────────────
  const mutate = useCallback((caseId, patchFn) => {
    setDb(prev => {
      const c = prev[caseId]
      if (!c) return prev
      const updated = patchFn(c)
      const next = { ...prev, [caseId]: updated }
      saveCaseDB(next)
      return next
    })
  }, [])

  // ── Advance status ────────────────────────────────────────────────────────────
  const advanceStatus = useCallback((caseId, note = '') => {
    mutate(caseId, (c) => {
      const idx = LIFECYCLE.indexOf(c.status)
      if (idx === -1 || idx >= LIFECYCLE.length - 1) return c
      const nextStatus = LIFECYCLE[idx + 1]
      const now = new Date().toISOString()
      return {
        ...c,
        status: nextStatus,
        updatedAt: now,
        timeline: [
          ...c.timeline,
          { status: nextStatus, label: STATUS_LABELS[nextStatus] ?? nextStatus, at: now, note },
        ],
      }
    })
  }, [mutate])

  // ── Force status (skip to any status) ────────────────────────────────────────
  const forceStatus = useCallback((caseId, newStatus, timelineEntry) => {
    mutate(caseId, (c) => {
      const now = new Date().toISOString()
      // Only add timeline entry if not already present for this status
      const alreadyHas = c.timeline.some(t => t.status === newStatus)
      return {
        ...c,
        status: newStatus,
        updatedAt: now,
        timeline: alreadyHas
          ? c.timeline
          : [
              ...c.timeline,
              { status: newStatus, label: timelineEntry?.label ?? STATUS_LABELS[newStatus], at: now, note: timelineEntry?.note ?? '' },
            ],
      }
    })
  }, [mutate])

  // ── Patch any sub-field on a case ─────────────────────────────────────────────
  const patchCase = useCallback((caseId, patch) => {
    mutate(caseId, (c) => ({ ...c, ...patch, updatedAt: new Date().toISOString() }))
  }, [mutate])

  // ── Lab: create referral ──────────────────────────────────────────────────────
  const createLabReferral = useCallback((caseId, referral) => {
    const note = `Sample dispatched to ${referral.labName}. Sample ID: ${referral.sampleId}.`
    mutate(caseId, (c) => {
      const now = new Date().toISOString()
      const alreadyLab = c.timeline.some(t => t.status === 'LAB_TESTING')
      return {
        ...c,
        status: 'LAB_TESTING',
        updatedAt: now,
        lab: { ...referral, status: 'TESTING', result: null, resultAt: null },
        timeline: alreadyLab ? c.timeline : [
          ...c.timeline,
          { status: 'LAB_TESTING', label: 'Sample collected & dispatched', at: now, note },
        ],
      }
    })
  }, [mutate])

  // ── Lab: record result ────────────────────────────────────────────────────────
  const recordLabResult = useCallback((caseId, result) => {
    mutate(caseId, (c) => {
      const now = new Date().toISOString()
      const alreadyConfirmed = c.timeline.some(t => t.status === 'LAB_CONFIRMED')
      return {
        ...c,
        status: 'LAB_CONFIRMED',
        updatedAt: now,
        lab: { ...c.lab, status: 'CONFIRMED', result, resultAt: now },
        timeline: alreadyConfirmed ? c.timeline : [
          ...c.timeline,
          {
            status: 'LAB_CONFIRMED',
            label: 'Lab result confirmed',
            at: now,
            note: `${result.disease} (${result.subtype}) — ${result.outcome}`,
          },
        ],
      }
    })
  }, [mutate])

  // ── Alert: update alert state ─────────────────────────────────────────────────
  const updateAlert = useCallback((caseId, alertPatch) => {
    mutate(caseId, (c) => {
      const now = new Date().toISOString()
      const wasAlertSent = alertPatch.status === 'SENT' && c.alert?.status !== 'SENT'
      const updatedAlert = { ...(c.alert ?? {}), ...alertPatch, updatedAt: now }
      const alreadySent = c.timeline.some(t => t.status === 'ALERT_SENT')
      return {
        ...c,
        updatedAt: now,
        alert: updatedAlert,
        status: wasAlertSent ? 'ALERT_SENT' : c.status,
        timeline: wasAlertSent && !alreadySent
          ? [...c.timeline, { status: 'ALERT_SENT', label: 'District alert sent', at: now, note: `${alertPatch.targetVillages ?? 8} villages notified.` }]
          : c.timeline,
      }
    })
  }, [mutate])

  // ── Containment: update action status ────────────────────────────────────────
  const updateContainment = useCallback((caseId, containmentPatch) => {
    mutate(caseId, (c) => {
      const now = new Date().toISOString()
      const updated = { ...(c.containment ?? {}), ...containmentPatch, updatedAt: now }
      // If overall containment status moves to ACTIVE, advance case to CONTAINMENT
      const shouldAdvance = containmentPatch.status === 'ACTIVE' && c.status === 'ALERT_SENT'
      const alreadyContainment = c.timeline.some(t => t.status === 'CONTAINMENT')
      return {
        ...c,
        updatedAt: now,
        containment: updated,
        status: shouldAdvance ? 'CONTAINMENT' : c.status,
        timeline: shouldAdvance && !alreadyContainment
          ? [...c.timeline, { status: 'CONTAINMENT', label: 'Containment response activated', at: now, note: 'Ring vaccination and movement restrictions initiated.' }]
          : c.timeline,
      }
    })
  }, [mutate])

  // ── Notifications ─────────────────────────────────────────────────────────────
  const updateNotifications = useCallback((caseId, notifPatch) => {
    mutate(caseId, (c) => ({
      ...c,
      notifications: { ...(c.notifications ?? {}), ...notifPatch },
      updatedAt: new Date().toISOString(),
    }))
  }, [mutate])

  // ── Upsert (from field report) ────────────────────────────────────────────────
  const upsertCase = useCallback((caseObj) => {
    setDb(prev => {
      const withRisk = { ...caseObj, risk: calculateRisk(caseObj.riskFactors) }
      const next = { ...prev, [caseObj.id]: withRisk }
      saveCaseDB(next)
      return next
    })
  }, [])

  // ── Reset all ─────────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem('ps_field_reports')
      localStorage.removeItem('ps_demo_online_override')
    } catch { /* ignore */ }
    const fresh = resetCaseDB()
    setDb(fresh)
    return fresh
  }, [])

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const kpis = {
    criticalCases:  cases.filter(c => c.risk.level === 'CRITICAL').length,
    highRiskCases:  cases.filter(c => c.risk.level === 'HIGH').length,
    activeClusters: 2,
    pendingLab:     cases.filter(c => c.status === 'LAB_TESTING').length,
  }

  return {
    db, cases, casesByRisk, getCase,
    advanceStatus, forceStatus, patchCase,
    createLabReferral, recordLabResult,
    updateAlert, updateContainment, updateNotifications,
    upsertCase, resetAll, kpis,
  }
}
