import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Wifi, WifiOff, PlusCircle, AlertTriangle,
  CheckCircle2, ChevronRight, Heart,
  MessageCircle, Bell, LogOut,
  Sparkles, Stethoscope, BookOpen, Phone,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

function Blob({ style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', pointerEvents: 'none',
        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
        filter: 'blur(72px)', ...style,
      }}
    />
  )
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)',
      borderRadius: '1.25rem', border: '1px solid rgba(222,216,207,0.7)',
      boxShadow: '0 2px 12px rgba(93,112,82,0.08)', padding: '1rem',
      display: 'flex', flexDirection: 'column', gap: '0.5rem',
    }}>
      <div style={{
        width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem',
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: '1rem', height: '1rem', color }} />
      </div>
      <p style={{ fontSize: '1.75rem', fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums', margin: 0 }}>{value}</p>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#5a5a50', margin: 0 }}>{label}</p>
    </div>
  )
}

function QuickAction({ icon: Icon, label, sub, color, bg, border, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1rem', borderRadius: '1rem',
        border: `1px solid ${border}`,
        background: hover ? bg.replace('0.08', '0.16') : bg,
        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
        transform: hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? `0 4px 16px ${border}` : 'none', width: '100%',
      }}
    >
      <div style={{
        width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
        background: bg, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon style={{ width: '1.125rem', height: '1.125rem', color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2c2c24', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '0.7rem', color: '#78786c', margin: 0 }}>{sub}</p>
      </div>
      <ChevronRight style={{ width: '1rem', height: '1rem', color: '#a0a08c', flexShrink: 0 }} />
    </button>
  )
}

function ReportRow({ report }) {
  const STATUS_CONFIG = {
    synced:  { label: 'Synced',  color: '#5d7052', bg: 'rgba(93,112,82,0.12)'  },
    pending: { label: 'Pending', color: '#b45309', bg: 'rgba(180,83,9,0.12)'  },
    offline: { label: 'Offline', color: '#78786c', bg: 'rgba(120,120,108,0.12)'},
  }
  const s = STATUS_CONFIG[report.syncStatus] ?? STATUS_CONFIG.offline
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 0', borderBottom: '1px solid rgba(222,216,207,0.5)',
    }}>
      <div style={{
        width: '2.25rem', height: '2.25rem', borderRadius: '0.75rem',
        background: 'rgba(93,112,82,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <ClipboardList style={{ width: '1rem', height: '1rem', color: '#5d7052' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2c2c24', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {report.animalId} · {report.village}
        </p>
        <p style={{ fontSize: '0.68rem', color: '#78786c', margin: 0 }}>{report.symptoms} · {report.time}</p>
      </div>
      <span style={{
        fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: s.color, background: s.bg, padding: '0.2rem 0.5rem', borderRadius: '99px',
      }}>{s.label}</span>
    </div>
  )
}

const RECENT_REPORTS = [
  { animalId: 'COW-1024', village: 'Khandala', symptoms: 'Fever, Oral vesicles', time: '2h ago', syncStatus: 'synced' },
  { animalId: 'COW-1031', village: 'Khandala', symptoms: 'Lameness, Salivation', time: '3h ago', syncStatus: 'synced' },
  { animalId: 'GOAT-0208', village: 'Narayangaon', symptoms: 'Diarrhoea, Fever', time: 'Pending sync', syncStatus: 'offline' },
]

const ADVISORY_TIPS = [
  { emoji: '🌡️', title: 'Monitor for Fever', body: 'Check your animals\' temperature daily. Above 39.5°C (103°F) in cattle is a warning sign — report immediately.', color: '#dc2626' },
  { emoji: '💧', title: 'Clean Water Sources', body: 'Clean water troughs every 2 days. Contaminated water spreads diarrhoeal diseases rapidly in the monsoon season.', color: '#0891b2' },
  { emoji: '🔒', title: 'Restrict Movement', body: 'Active FMD alert for Junnar block. Avoid taking livestock to weekly mandi until further notice.', color: '#b45309' },
]

export default function FarmerDashboard() {
  const { user, logout } = useAuth()
  const { isOnline } = useOnlineStatus()
  const navigate = useNavigate()
  const [greeting, setGreeting] = useState('Good morning')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 12) setGreeting('Good morning')
    else if (h < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'Farmer'

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1a2315 0%, #2c3820 30%, #253320 60%, #1f2a1a 100%)',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>
      <Blob style={{ width: '28rem', height: '28rem', top: '-8rem', left: '-6rem', background: 'rgba(93,112,82,0.3)', opacity: 0.35 }} />
      <Blob style={{ width: '20rem', height: '20rem', bottom: '-4rem', right: '-5rem', background: 'rgba(193,140,93,0.3)', opacity: 0.2, borderRadius: '40% 60% 70% 30% / 40% 70% 30% 60%' }} />

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(26,35,21,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0.875rem 1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/psentinel.png" alt="Pashu Sentinel" style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', objectFit: 'contain' }} />
          <div>
            <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#86efac', letterSpacing: '0.05em', margin: 0, fontFamily: "'Fraunces', serif" }}>PASHU SENTINEL</p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Farmer Portal</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            fontSize: '0.7rem', fontWeight: 700,
            color: isOnline ? '#86efac' : '#fbbf24',
            background: isOnline ? 'rgba(134,239,172,0.1)' : 'rgba(251,191,36,0.1)',
            padding: '0.3rem 0.625rem', borderRadius: '99px',
          }}>
            {isOnline ? <Wifi style={{ width: '0.875rem', height: '0.875rem' }} /> : <WifiOff style={{ width: '0.875rem', height: '0.875rem' }} />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          {/* Field Report shortcut */}
          <button
            id="btn-farmer-new-report"
            onClick={() => navigate('/field-report')}
            style={{
              background: 'rgba(93,112,82,0.25)', border: '1px solid rgba(134,239,172,0.3)',
              borderRadius: '99px', color: '#86efac',
              fontSize: '0.7rem', fontWeight: 800,
              padding: '0.3rem 0.75rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <PlusCircle style={{ width: '0.75rem', height: '0.75rem' }} /> New Report
          </button>
          {/* Logout */}
          <button
            id="btn-farmer-logout"
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '99px', color: '#f87171',
              fontSize: '0.7rem', fontWeight: 800,
              padding: '0.3rem 0.625rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}
          >
            <LogOut style={{ width: '0.75rem', height: '0.75rem' }} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '0 1.25rem 6rem', position: 'relative', zIndex: 10 }}>

        {/* Greeting */}
        <div style={{ padding: '1.5rem 0 1.25rem' }}>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>{greeting},</p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff', fontFamily: "'Fraunces', serif", letterSpacing: '-0.02em', margin: '0.25rem 0 0.5rem' }}>
            {firstName} 👋
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, margin: 0 }}>
            Khandala Village · Junnar Taluk, Pune
          </p>
        </div>

        {/* Active alert banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.2), rgba(168,84,72,0.15))',
          border: '1px solid rgba(220,38,38,0.4)', borderRadius: '1.125rem',
          padding: '0.875rem 1rem', marginBottom: '1.25rem',
          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        }}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '0.625rem',
            background: 'rgba(220,38,38,0.2)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle style={{ width: '1rem', height: '1rem', color: '#f87171' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fca5a5', margin: '0 0 0.2rem' }}>🚨 Active FMD Alert — Junnar Block</p>
            <p style={{ fontSize: '0.7rem', color: 'rgba(252,165,165,0.8)', margin: 0, lineHeight: 1.4 }}>
              Foot-and-Mouth Disease confirmed in Khandala. Restrict animal movement. Contact 1962.
            </p>
          </div>
          <button onClick={() => navigate('/field-report')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', flexShrink: 0 }}>
            <ChevronRight style={{ width: '1rem', height: '1rem' }} />
          </button>
        </div>

        {/* Herd stats */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', margin: '0 0 0.625rem' }}>My Herd Summary</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
            <StatCard icon={Heart} label="Healthy" value="7" color="#5d7052" bg="rgba(93,112,82,0.12)" />
            <StatCard icon={AlertTriangle} label="Sick" value="3" color="#ea580c" bg="rgba(234,88,12,0.12)" />
            <StatCard icon={CheckCircle2} label="Reports" value="2" color="#0891b2" bg="rgba(8,145,178,0.12)" />
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', margin: '0 0 0.625rem' }}>Quick Actions</p>
          <div style={{
            background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)',
            borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)',
            padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '0.375rem',
          }}>
            <QuickAction icon={PlusCircle} label="Report Sick Animal" sub="Works offline — syncs automatically" color="#86efac" bg="rgba(134,239,172,0.08)" border="rgba(134,239,172,0.3)" onClick={() => navigate('/field-report')} />
            <QuickAction icon={MessageCircle} label="Ask Vet AI" sub="Get instant guidance on symptoms" color="#67e8f9" bg="rgba(103,232,249,0.08)" border="rgba(103,232,249,0.25)" onClick={() => navigate('/field-report')} />
            <QuickAction icon={BookOpen} label="Disease Guide" sub="Learn symptoms & prevention tips" color="#c4b5fd" bg="rgba(196,181,253,0.08)" border="rgba(196,181,253,0.25)" onClick={() => navigate('/field-report')} />
            <QuickAction icon={Phone} label="Call Helpline 1962" sub="24×7 veterinary emergency line" color="#fbbf24" bg="rgba(251,191,36,0.08)" border="rgba(251,191,36,0.25)" onClick={() => window.open('tel:1962')} />
          </div>
        </div>

        {/* Recent reports */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>My Recent Reports</p>
            <button onClick={() => navigate('/field-report')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#86efac', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              View all <ChevronRight style={{ width: '0.75rem', height: '0.75rem' }} />
            </button>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
            borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)',
            padding: '0.25rem 1rem',
          }}>
            {RECENT_REPORTS.map((r, i) => <ReportRow key={i} report={r} />)}
          </div>
        </div>

        {/* AI Advisory */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
            <Sparkles style={{ width: '0.875rem', height: '0.875rem', color: '#c4b5fd' }} />
            <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', margin: 0 }}>AI Advisory — Today</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ADVISORY_TIPS.map((tip, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)',
                borderRadius: '1rem', border: `1px solid ${tip.color}30`,
                padding: '0.875rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{tip.emoji}</span>
                <div>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', margin: '0 0 0.25rem' }}>{tip.title}</p>
                  <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, margin: 0 }}>{tip.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nearby vets */}
        <div>
          <p style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', margin: '0 0 0.625rem' }}>Nearby Veterinary Support</p>
          <div style={{
            background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
            borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.1)',
            padding: '0.875rem 1rem',
          }}>
            {[
              { name: 'Dr. Deshmukh', role: 'Block Veterinary Officer', location: 'Junnar PHC', distance: '8.2 km', color: '#67e8f9' },
              { name: 'Dr. Kulkarni', role: 'Livestock Supervisor', location: 'Narayangaon Dispensary', distance: '12.4 km', color: '#86efac' },
            ].map((vet, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0',
                borderBottom: i < 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              }}>
                <div style={{
                  width: '2.25rem', height: '2.25rem', borderRadius: '99px',
                  background: `${vet.color}20`, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Stethoscope style={{ width: '1rem', height: '1rem', color: vet.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', margin: 0 }}>{vet.name}</p>
                  <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>{vet.role} · {vet.location}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: vet.color, margin: 0 }}>{vet.distance}</p>
                  <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', margin: 0 }}>away</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
        background: 'rgba(26,35,21,0.92)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '0.875rem 1.25rem', display: 'flex', gap: '0.75rem',
      }}>
        <button
          id="btn-farmer-report"
          onClick={() => navigate('/field-report')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            padding: '0.875rem', borderRadius: '1rem', border: 'none',
            background: 'linear-gradient(135deg, rgba(93,112,82,0.9), rgba(93,112,82,0.7))',
            color: '#fff', fontWeight: 800, fontSize: '0.9rem',
            cursor: 'pointer', boxShadow: '0 4px 20px rgba(93,112,82,0.4)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <ClipboardList style={{ width: '1.1rem', height: '1.1rem' }} />
          Report New Case
        </button>
      </div>
    </div>
  )
}
