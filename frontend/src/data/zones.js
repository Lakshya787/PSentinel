// Primary outbreak epicentre — COW-1024 / CASE-1042
export const PRIMARY_OUTBREAK = {
  caseId: 'CASE-1042', animalId: 'COW-1024',
  lat: 18.7831, lng: 73.9286,
  village: 'Khandala', taluk: 'Junnar', district: 'Pune',
}

export const ZONES = [
  {
    id: 'zone-protection', name: 'Protection Zone', type: 'PROTECTION',
    center: { lat: PRIMARY_OUTBREAK.lat, lng: PRIMARY_OUTBREAK.lng },
    radiusMeters: 3000,
    color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.08,
    description: 'Immediate containment — livestock movement restricted.',
  },
  {
    id: 'zone-surveillance', name: 'Surveillance Zone', type: 'SURVEILLANCE',
    center: { lat: PRIMARY_OUTBREAK.lat, lng: PRIMARY_OUTBREAK.lng },
    radiusMeters: 10000,
    color: '#ea580c', fillColor: '#ea580c', fillOpacity: 0.04,
    description: 'Active daily surveillance required.',
  },
]

// Khandala cluster definition (deterministic for demo)
export const KHANDALA_CLUSTER = {
  id: 'CLU-JUN-01',
  label: 'Cluster #JUN-01',
  village: 'Khandala',
  taluk: 'Junnar',
  caseIds: ['CASE-1042', 'CASE-1043', 'CASE-1044', 'CASE-1045', 'CASE-1046'],
  highestRisk: 88,
  activeSince: new Date('2026-09-10T08:30:00Z').toISOString(),
}
