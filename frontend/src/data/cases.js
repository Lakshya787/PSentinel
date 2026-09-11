// ─── Shared Case Data Store ───────────────────────────────────────────────────
// Single source of truth for ALL case data across the entire application.
// Dashboard, Map, CaseDetail, and FieldReport all import from here.
// Uses localStorage for persistence so state survives refreshes.

import { calculateRisk } from '../utils/riskEngine'

const STORAGE_KEY = 'ps_cases'

// ─── Seeded Cases ─────────────────────────────────────────────────────────────
// ~25 deterministic cases. Timestamps are relative to a fixed reference point
// so the demo always produces the same visual result.

const REF = new Date('2026-09-10T08:30:00Z').getTime()
const ts  = (offsetHours) => new Date(REF + offsetHours * 3600000).toISOString()

export const SEED_CASES = [
  // ── PRIMARY OUTBREAK ─────────────────────────────────────────────────────
  {
    id: 'CASE-1042', animalId: 'COW-1024', species: 'Cattle', breed: 'Gir', ageYears: 4,
    village: 'Khandala', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7831, lng: 73.9286,
    symptoms: ['Fever', 'Oral vesicles', 'Excessive salivation', 'Lameness'],
    affectedAnimals: 3, mortality: 1,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-001',
    status: 'RISK_ANALYZED',
    riskFactors: { clinical: 92, vaccination: 80, environmental: 85, spatial: 95 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(0), updatedAt: ts(1.5),
    notes: 'Owner reports 3 more animals showing similar symptoms. Vaccination record incomplete.',
    timeline: [
      { status: 'REPORTED',       label: 'Report received',             at: ts(0),   note: 'Filed by Pashu Sakhi, Khandala' },
      { status: 'RISK_ANALYZED',  label: 'Risk analysis complete',      at: ts(1.5), note: 'Score: 88/100 — CRITICAL. Vesicular / Podal Syndrome suspected.' },
    ],
  },

  // ── CLUSTER — within 3 km protection zone ────────────────────────────────
  {
    id: 'CASE-1043', animalId: 'COW-1025', species: 'Cattle', breed: 'Khillari', ageYears: 6,
    village: 'Khandala', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7860, lng: 73.9310,
    symptoms: ['Fever', 'Oral vesicles'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-001',
    status: 'REPORTED',
    riskFactors: { clinical: 78, vaccination: 70, environmental: 82, spatial: 93 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(2), updatedAt: ts(2),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(2), note: 'Filed by Pashu Sakhi, Khandala' },
    ],
  },
  {
    id: 'CASE-1044', animalId: 'GOAT-0310', species: 'Goat', breed: 'Osmanabadi', ageYears: 2,
    village: 'Khandala', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7812, lng: 73.9255,
    symptoms: ['Fever', 'Lameness'],
    affectedAnimals: 4, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-002',
    status: 'UNDER_INVESTIGATION',
    riskFactors: { clinical: 68, vaccination: 55, environmental: 80, spatial: 91 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-5), updatedAt: ts(1),
    notes: '',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',       at: ts(-5), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete',at: ts(-3), note: 'Score: 73/100 — HIGH' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started', at: ts(1),  note: 'Dr. Ramesh Kulkarni assigned' },
    ],
  },
  {
    id: 'CASE-1045', animalId: 'COW-1026', species: 'Cattle', breed: 'HF Cross', ageYears: 3,
    village: 'Khandala', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7845, lng: 73.9298,
    symptoms: ['Excessive salivation', 'Oral vesicles'],
    affectedAnimals: 1, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-001',
    status: 'LAB_TESTING',
    riskFactors: { clinical: 74, vaccination: 65, environmental: 83, spatial: 94 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-10), updatedAt: ts(-1),
    notes: 'Swab sample collected. Awaiting FMD PCR result.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',       at: ts(-10), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete',at: ts(-8),  note: 'Score: 78/100 — HIGH' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started', at: ts(-5),  note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',    at: ts(-1),  note: 'Swab sample collected for FMD PCR.' },
    ],
  },
  {
    id: 'CASE-1046', animalId: 'SHP-0088', species: 'Sheep', breed: 'Deccani', ageYears: 1,
    village: 'Khandala', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7800, lng: 73.9270,
    symptoms: ['Fever', 'Lameness'],
    affectedAnimals: 6, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-003',
    status: 'REPORTED',
    riskFactors: { clinical: 58, vaccination: 50, environmental: 78, spatial: 90 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(3), updatedAt: ts(3),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(3), note: '' },
    ],
  },

  // ── SURVEILLANCE ZONE — 3–10 km ───────────────────────────────────────────
  {
    id: 'CASE-1047', animalId: 'BUF-0205', species: 'Buffalo', breed: 'Murrah', ageYears: 8,
    village: 'Rajuri', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7650, lng: 73.9600,
    symptoms: ['Oral vesicles', 'Lameness'],
    affectedAnimals: 2, mortality: 1,
    reportedBy: 'Field Worker', assignedVet: 'VET-001',
    status: 'ALERT_SENT',
    riskFactors: { clinical: 82, vaccination: 40, environmental: 88, spatial: 87 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-72), updatedAt: ts(-2),
    notes: 'High-risk case. Movement restriction imposed.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',         at: ts(-72), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete',  at: ts(-70), note: 'Score: 82/100 — CRITICAL' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',   at: ts(-48), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',      at: ts(-24), note: '' },
      { status: 'LAB_CONFIRMED',       label: 'Lab confirmed',           at: ts(-12), note: 'FMD Serotype O confirmed.' },
      { status: 'ALERT_SENT',          label: 'District alert issued',   at: ts(-2),  note: 'Movement restrictions imposed.' },
    ],
  },
  {
    id: 'CASE-1048', animalId: 'COW-0899', species: 'Cattle', breed: 'Sahiwal', ageYears: 7,
    village: 'Narayangaon', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.8150, lng: 73.9850,
    symptoms: ['Fever'],
    affectedAnimals: 1, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-002',
    status: 'REPORTED',
    riskFactors: { clinical: 42, vaccination: 75, environmental: 60, spatial: 70 },
    syndrome: 'Undetermined',
    reportedAt: ts(-24), updatedAt: ts(-24),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(-24), note: '' },
    ],
  },
  {
    id: 'CASE-1049', animalId: 'COW-1010', species: 'Cattle', breed: 'Gir', ageYears: 5,
    village: 'Wadaj', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7900, lng: 74.0100,
    symptoms: ['Fever', 'Reduced milk'],
    affectedAnimals: 3, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-004',
    status: 'LAB_CONFIRMED',
    riskFactors: { clinical: 65, vaccination: 45, environmental: 72, spatial: 75 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-48), updatedAt: ts(-6),
    notes: 'Confirmed FMD serotype O.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-48), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-46), note: 'Score: 64/100 — HIGH' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-36), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',     at: ts(-24), note: '' },
      { status: 'LAB_CONFIRMED',       label: 'Lab confirmed',          at: ts(-6),  note: 'FMD Serotype O confirmed.' },
    ],
  },
  {
    id: 'CASE-1050', animalId: 'COW-1030', species: 'Cattle', breed: 'Jersey Cross', ageYears: 4,
    village: 'Otur', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.8300, lng: 73.9400,
    symptoms: ['Fever'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-005',
    status: 'RISK_ANALYZED',
    riskFactors: { clinical: 55, vaccination: 72, environmental: 58, spatial: 68 },
    syndrome: 'Undetermined',
    reportedAt: ts(-18), updatedAt: ts(-10),
    notes: '',
    timeline: [
      { status: 'REPORTED',      label: 'Report received',        at: ts(-18), note: '' },
      { status: 'RISK_ANALYZED', label: 'Risk analysis complete', at: ts(-10), note: 'Score: 62/100 — HIGH' },
    ],
  },

  // ── OUTER / BACKGROUND ────────────────────────────────────────────────────
  {
    id: 'CASE-1051', animalId: 'COW-0630', species: 'Cattle', breed: 'Sahiwal', ageYears: 6,
    village: 'Khed', taluk: 'Khed', district: 'Pune', state: 'Maharashtra',
    lat: 18.8500, lng: 73.8600,
    symptoms: ['Fever', 'Oral vesicles', 'Lameness'],
    affectedAnimals: 4, mortality: 1,
    reportedBy: 'Field Worker', assignedVet: 'VET-004',
    status: 'ALERT_SENT',
    riskFactors: { clinical: 85, vaccination: 35, environmental: 80, spatial: 78 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-40), updatedAt: ts(-5),
    notes: 'High-risk. District officer alerted.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-40), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-38), note: 'Score: 81/100 — CRITICAL' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-24), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',     at: ts(-12), note: '' },
      { status: 'LAB_CONFIRMED',       label: 'Lab confirmed',          at: ts(-8),  note: '' },
      { status: 'ALERT_SENT',          label: 'District alert issued',  at: ts(-5),  note: '' },
    ],
  },
  {
    id: 'CASE-1052', animalId: 'BUF-0188', species: 'Buffalo', breed: 'Murrah', ageYears: 5,
    village: 'Velhe', taluk: 'Velhe', district: 'Pune', state: 'Maharashtra',
    lat: 18.2700, lng: 73.6500,
    symptoms: ['Oral vesicles', 'Excessive salivation'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-004',
    status: 'LAB_TESTING',
    riskFactors: { clinical: 72, vaccination: 42, environmental: 68, spatial: 62 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-55), updatedAt: ts(-15),
    notes: 'Swab sample sent to IVRI.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-55), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-52), note: 'Score: 63/100 — HIGH' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-40), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',     at: ts(-15), note: 'Swab sent to IVRI.' },
    ],
  },
  {
    id: 'CASE-1053', animalId: 'GOAT-0311', species: 'Goat', breed: 'Osmanabadi', ageYears: 3,
    village: 'Ale', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 18.7550, lng: 73.8900,
    symptoms: ['Cough', 'Nasal discharge'],
    affectedAnimals: 8, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-003',
    status: 'UNDER_INVESTIGATION',
    riskFactors: { clinical: 48, vaccination: 60, environmental: 55, spatial: 65 },
    syndrome: 'Respiratory Syndrome',
    reportedAt: ts(-36), updatedAt: ts(-12),
    notes: '',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-36), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-30), note: 'Score: 57/100 — MEDIUM' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-12), note: '' },
    ],
  },
  {
    id: 'CASE-1054', animalId: 'COW-0920', species: 'Cattle', breed: 'HF Cross', ageYears: 5,
    village: 'Shirur', taluk: 'Shirur', district: 'Pune', state: 'Maharashtra',
    lat: 18.8000, lng: 74.3500,
    symptoms: ['Fever', 'Diarrhoea'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-004',
    status: 'LAB_TESTING',
    riskFactors: { clinical: 60, vaccination: 55, environmental: 65, spatial: 45 },
    syndrome: 'Gastrointestinal Syndrome',
    reportedAt: ts(-60), updatedAt: ts(-20),
    notes: '',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-60), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-55), note: 'Score: 57/100 — MEDIUM' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-40), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',     at: ts(-20), note: '' },
    ],
  },
  {
    id: 'CASE-1055', animalId: 'SHP-0110', species: 'Sheep', breed: 'Deccani', ageYears: 2,
    village: 'Purandar', taluk: 'Purandar', district: 'Pune', state: 'Maharashtra',
    lat: 18.2800, lng: 74.0200,
    symptoms: ['Cough', 'Nasal discharge'],
    affectedAnimals: 12, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-005',
    status: 'RISK_ANALYZED',
    riskFactors: { clinical: 38, vaccination: 70, environmental: 42, spatial: 30 },
    syndrome: 'Respiratory Syndrome',
    reportedAt: ts(-144), updatedAt: ts(-90),
    notes: '',
    timeline: [
      { status: 'REPORTED',      label: 'Report received',        at: ts(-144), note: '' },
      { status: 'RISK_ANALYZED', label: 'Risk analysis complete', at: ts(-90),  note: 'Score: 44/100 — MEDIUM' },
    ],
  },
  {
    id: 'CASE-1056', animalId: 'COW-0750', species: 'Cattle', breed: 'Khillari', ageYears: 9,
    village: 'Ambegaon', taluk: 'Ambegaon', district: 'Pune', state: 'Maharashtra',
    lat: 18.8600, lng: 73.8500,
    symptoms: ['Reduced milk', 'Lethargy'],
    affectedAnimals: 1, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-004',
    status: 'REPORTED',
    riskFactors: { clinical: 35, vaccination: 80, environmental: 40, spatial: 30 },
    syndrome: 'Undetermined',
    reportedAt: ts(-96), updatedAt: ts(-96),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(-96), note: '' },
    ],
  },
  {
    id: 'CASE-1057', animalId: 'GOAT-0220', species: 'Goat', breed: 'Sangamneri', ageYears: 2,
    village: 'Manchar', taluk: 'Ambegaon', district: 'Pune', state: 'Maharashtra',
    lat: 18.8400, lng: 73.8100,
    symptoms: ['Cough'],
    affectedAnimals: 3, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-005',
    status: 'CONTAINMENT',
    riskFactors: { clinical: 30, vaccination: 85, environmental: 35, spatial: 25 },
    syndrome: 'Respiratory Syndrome',
    reportedAt: ts(-120), updatedAt: ts(-48),
    notes: 'Resolved. Containment measures lifted.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-120), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-115), note: '' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-100), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',     at: ts(-80),  note: '' },
      { status: 'LAB_CONFIRMED',       label: 'Lab confirmed',          at: ts(-60),  note: '' },
      { status: 'ALERT_SENT',          label: 'Alert issued',           at: ts(-55),  note: '' },
      { status: 'CONTAINMENT',         label: 'Containment active',     at: ts(-48),  note: 'Measures lifted after clearance.' },
    ],
  },
  {
    id: 'CASE-1058', animalId: 'BUF-0310', species: 'Buffalo', breed: 'Surti', ageYears: 6,
    village: 'Baramati', taluk: 'Baramati', district: 'Pune', state: 'Maharashtra',
    lat: 18.1520, lng: 74.5820,
    symptoms: ['Mastitis', 'Reduced milk'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-003',
    status: 'UNDER_INVESTIGATION',
    riskFactors: { clinical: 45, vaccination: 60, environmental: 50, spatial: 35 },
    syndrome: 'Udder / Mastitis Syndrome',
    reportedAt: ts(-80), updatedAt: ts(-40),
    notes: '',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-80), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-75), note: '' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-40), note: '' },
    ],
  },
  {
    id: 'CASE-1059', animalId: 'COW-0444', species: 'Cattle', breed: 'Gir', ageYears: 3,
    village: 'Indapur', taluk: 'Indapur', district: 'Pune', state: 'Maharashtra',
    lat: 17.9600, lng: 75.0200,
    symptoms: ['Fever', 'Reduced milk', 'Nasal discharge'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-002',
    status: 'REPORTED',
    riskFactors: { clinical: 52, vaccination: 65, environmental: 48, spatial: 40 },
    syndrome: 'Respiratory Syndrome',
    reportedAt: ts(-108), updatedAt: ts(-108),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(-108), note: '' },
    ],
  },
  {
    id: 'CASE-1060', animalId: 'COW-1055', species: 'Cattle', breed: 'Sahiwal', ageYears: 6,
    village: 'Bhor', taluk: 'Bhor', district: 'Pune', state: 'Maharashtra',
    lat: 18.1500, lng: 73.8500,
    symptoms: ['Fever', 'Lethargy'],
    affectedAnimals: 1, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-001',
    status: 'CONTAINMENT',
    riskFactors: { clinical: 40, vaccination: 78, environmental: 45, spatial: 32 },
    syndrome: 'Undetermined',
    reportedAt: ts(-200), updatedAt: ts(-72),
    notes: 'Resolved. Animal recovering.',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-200), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-195), note: '' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-170), note: '' },
      { status: 'LAB_TESTING',         label: 'Sample sent to lab',     at: ts(-140), note: '' },
      { status: 'LAB_CONFIRMED',       label: 'Lab confirmed',          at: ts(-100), note: '' },
      { status: 'ALERT_SENT',          label: 'Alert issued',           at: ts(-90),  note: '' },
      { status: 'CONTAINMENT',         label: 'Containment active',     at: ts(-72),  note: 'Animal recovering.' },
    ],
  },
  {
    id: 'CASE-1061', animalId: 'GOAT-0415', species: 'Goat', breed: 'Osmanabadi', ageYears: 1,
    village: 'Mulshi', taluk: 'Mulshi', district: 'Pune', state: 'Maharashtra',
    lat: 18.5200, lng: 73.5100,
    symptoms: ['Diarrhoea', 'Lethargy'],
    affectedAnimals: 15, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-003',
    status: 'REPORTED',
    riskFactors: { clinical: 33, vaccination: 60, environmental: 38, spatial: 28 },
    syndrome: 'Gastrointestinal Syndrome',
    reportedAt: ts(-168), updatedAt: ts(-168),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(-168), note: '' },
    ],
  },
  {
    id: 'CASE-1062', animalId: 'COW-0780', species: 'Cattle', breed: 'Khillari', ageYears: 8,
    village: 'Mawal', taluk: 'Mawal', district: 'Pune', state: 'Maharashtra',
    lat: 18.6200, lng: 73.5800,
    symptoms: ['Fever', 'Lameness'],
    affectedAnimals: 3, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-002',
    status: 'UNDER_INVESTIGATION',
    riskFactors: { clinical: 62, vaccination: 50, environmental: 65, spatial: 55 },
    syndrome: 'Vesicular / Podal Syndrome',
    reportedAt: ts(-90), updatedAt: ts(-30),
    notes: '',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-90), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-85), note: '' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-30), note: '' },
    ],
  },
  {
    id: 'CASE-1063', animalId: 'BUF-0400', species: 'Buffalo', breed: 'Surti', ageYears: 7,
    village: 'Haveli', taluk: 'Haveli', district: 'Pune', state: 'Maharashtra',
    lat: 18.5900, lng: 73.9600,
    symptoms: ['Mastitis'],
    affectedAnimals: 1, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-002',
    status: 'REPORTED',
    riskFactors: { clinical: 32, vaccination: 70, environmental: 38, spatial: 28 },
    syndrome: 'Udder / Mastitis Syndrome',
    reportedAt: ts(-220), updatedAt: ts(-220),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(-220), note: '' },
    ],
  },
  {
    id: 'CASE-1064', animalId: 'COW-0555', species: 'Cattle', breed: 'Jersey Cross', ageYears: 4,
    village: 'Daund', taluk: 'Daund', district: 'Pune', state: 'Maharashtra',
    lat: 18.4600, lng: 74.5800,
    symptoms: ['Reduced milk', 'Fever'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-005',
    status: 'RISK_ANALYZED',
    riskFactors: { clinical: 50, vaccination: 68, environmental: 52, spatial: 40 },
    syndrome: 'Undetermined',
    reportedAt: ts(-130), updatedAt: ts(-80),
    notes: '',
    timeline: [
      { status: 'REPORTED',      label: 'Report received',        at: ts(-130), note: '' },
      { status: 'RISK_ANALYZED', label: 'Risk analysis complete', at: ts(-80),  note: '' },
    ],
  },
  {
    id: 'CASE-1065', animalId: 'COW-1100', species: 'Cattle', breed: 'Gir', ageYears: 5,
    village: 'Junnar', taluk: 'Junnar', district: 'Pune', state: 'Maharashtra',
    lat: 19.2000, lng: 73.8900,
    symptoms: ['Fever', 'Nasal discharge'],
    affectedAnimals: 2, mortality: 0,
    reportedBy: 'Pashu Sakhi', assignedVet: 'VET-001',
    status: 'UNDER_INVESTIGATION',
    riskFactors: { clinical: 55, vaccination: 60, environmental: 58, spatial: 48 },
    syndrome: 'Respiratory Syndrome',
    reportedAt: ts(-50), updatedAt: ts(-25),
    notes: '',
    timeline: [
      { status: 'REPORTED',            label: 'Report received',        at: ts(-50), note: '' },
      { status: 'RISK_ANALYZED',       label: 'Risk analysis complete', at: ts(-45), note: '' },
      { status: 'UNDER_INVESTIGATION', label: 'Investigation started',  at: ts(-25), note: '' },
    ],
  },
  {
    id: 'CASE-1066', animalId: 'SHP-0055', species: 'Sheep', breed: 'Deccani', ageYears: 3,
    village: 'Panshet', taluk: 'Velhe', district: 'Pune', state: 'Maharashtra',
    lat: 18.3500, lng: 73.7200,
    symptoms: ['Cough'],
    affectedAnimals: 20, mortality: 0,
    reportedBy: 'Field Worker', assignedVet: 'VET-003',
    status: 'REPORTED',
    riskFactors: { clinical: 28, vaccination: 75, environmental: 30, spatial: 22 },
    syndrome: 'Respiratory Syndrome',
    reportedAt: ts(-180), updatedAt: ts(-180),
    notes: '',
    timeline: [
      { status: 'REPORTED', label: 'Report received', at: ts(-180), note: '' },
    ],
  },
]

// ─── Enriched Cases (with computed risk attached) ─────────────────────────────
export const ENRICHED_SEED_CASES = SEED_CASES.map(c => ({
  ...c,
  risk: calculateRisk(c.riskFactors),
}))

// ─── localStorage persistence ─────────────────────────────────────────────────
const CASE_STORAGE_KEY = 'ps_case_db'

export function loadCaseDB() {
  try {
    const raw = localStorage.getItem(CASE_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  // First load — hydrate from seed
  const db = Object.fromEntries(ENRICHED_SEED_CASES.map(c => [c.id, c]))
  localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(db))
  return db
}

export function saveCaseDB(db) {
  localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(db))
}

export function resetCaseDB() {
  localStorage.removeItem(CASE_STORAGE_KEY)
  return loadCaseDB()
}

// ─── Derived helpers ──────────────────────────────────────────────────────────
export function getCasesArray(db) {
  return Object.values(db)
}

export function getCaseById(db, id) {
  return db[id] ?? null
}

export function getCaseByAnimalId(db, animalId) {
  return Object.values(db).find(c => c.animalId === animalId) ?? null
}

export function getCasesSortedByRisk(db) {
  return getCasesArray(db).sort((a, b) => b.risk.score - a.risk.score)
}

export function getKPIs(db) {
  const cases = getCasesArray(db)
  const criticalCases    = cases.filter(c => c.risk.level === 'CRITICAL').length
  const highRiskCases    = cases.filter(c => c.risk.level === 'HIGH').length
  const pendingLab       = cases.filter(c => c.status === 'LAB_TESTING').length
  const activeClusters   = 2 // deterministic for demo
  return { criticalCases, highRiskCases, pendingLab, activeClusters }
}
