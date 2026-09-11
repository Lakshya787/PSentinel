import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import { riskLevelHex } from '../../utils/riskEngine'
import { ZONES, PRIMARY_OUTBREAK } from '../../data/zones'
import StatusBadge from '../ui/StatusBadge'

// Fix Leaflet default icon in Vite
import L from 'leaflet'
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const RADIUS_BY_LEVEL = { CRITICAL: 13, HIGH: 10, MEDIUM: 8, LOW: 6 }
const WEIGHT_BY_LEVEL = { CRITICAL: 3,  HIGH: 2.5, MEDIUM: 2, LOW: 1.5 }

// Fly to primary case on mount
function FlyToOnMount({ lat, lng, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true, duration: 0.8 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

/**
 * MapView — Leaflet map with case markers, protection/surveillance zones, popups.
 * @param {{ cases: Array, focusCaseId?: string, height?: string }} props
 */
export default function MapView({ cases = [], focusCaseId, height = '100%' }) {
  const navigate = useNavigate()

  const focus     = cases.find(c => c.id === focusCaseId) ?? cases.find(c => c.id === 'CASE-1042')
  const centerLat = focus?.lat ?? PRIMARY_OUTBREAK.lat
  const centerLng = focus?.lng ?? PRIMARY_OUTBREAK.lng

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={11}
      style={{ height, width: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FlyToOnMount lat={centerLat} lng={centerLng} zoom={11} />

      {/* Surveillance zone (outer) — rendered first so markers sit on top */}
      {ZONES.map(zone => (
        <Circle
          key={zone.id}
          center={[zone.center.lat, zone.center.lng]}
          radius={zone.radiusMeters}
          pathOptions={{
            color:       zone.color,
            fillColor:   zone.fillColor,
            fillOpacity: zone.fillOpacity,
            weight:      zone.type === 'PROTECTION' ? 2.5 : 1.5,
            dashArray:   zone.type === 'SURVEILLANCE' ? '8 5' : undefined,
          }}
        />
      ))}

      {/* Primary case — outer pulse ring */}
      {focus && (
        <CircleMarker
          center={[focus.lat, focus.lng]}
          radius={26}
          pathOptions={{
            color:       '#7c3aed',
            fillColor:   '#7c3aed',
            fillOpacity: 0.12,
            weight:      1.5,
            dashArray:   '4 3',
          }}
        />
      )}

      {/* Case markers */}
      {cases.map(c => {
        const hex       = riskLevelHex(c.risk.level)
        const radius    = RADIUS_BY_LEVEL[c.risk.level] ?? 8
        const weight    = WEIGHT_BY_LEVEL[c.risk.level] ?? 2
        const isPrimary = c.id === 'CASE-1042'

        return (
          <CircleMarker
            key={c.id}
            center={[c.lat, c.lng]}
            radius={isPrimary ? 17 : radius}
            pathOptions={{
              color:       isPrimary ? '#7c3aed' : hex,
              fillColor:   isPrimary ? '#7c3aed' : hex,
              fillOpacity: isPrimary ? 0.92 : 0.82,
              weight:      isPrimary ? 3 : weight,
            }}
          >
            <Popup minWidth={230} maxWidth={280}>
              <div className="font-sans text-slate-800 space-y-2.5 py-1">
                {/* Case header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {c.id}
                      </p>
                      {isPrimary && (
                        <span className="text-[9px] font-black text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full uppercase">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-900">{c.animalId}</p>
                    <p className="text-xs text-slate-500">{c.village}, {c.taluk}</p>
                  </div>
                  <StatusBadge status={c.status} size="sm" />
                </div>

                {/* Risk score */}
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: riskLevelHex(c.risk.level) + '12' }}
                >
                  <span className="text-xs text-slate-600 font-medium">Risk Score</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black tabular-nums" style={{ color: riskLevelHex(c.risk.level) }}>
                      {c.risk.score}
                    </span>
                    <span className="text-xs font-bold uppercase" style={{ color: riskLevelHex(c.risk.level) }}>
                      {c.risk.level}
                    </span>
                  </div>
                </div>

                {/* Syndrome */}
                {c.syndrome && c.syndrome !== 'Undetermined' && (
                  <p className="text-xs text-slate-600 italic">{c.syndrome}</p>
                )}

                {/* Meta */}
                <div className="text-xs text-slate-500">
                  {c.species} · {c.affectedAnimals} affected{c.mortality > 0 ? ` · ${c.mortality} mortality` : ''}
                </div>

                {/* CTA */}
                <button
                  onClick={() => navigate(`/cases/${c.id}`)}
                  className="w-full text-center text-xs font-semibold text-brand-600
                             hover:text-brand-700 border border-brand-200 hover:border-brand-300
                             rounded-lg py-1.5 transition-colors bg-brand-50 hover:bg-brand-100"
                >
                  View Case Details →
                </button>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
