import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Phone, Lock, User, ChevronRight, AlertCircle, Loader2, Leaf,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// ─── Role options ─────────────────────────────────────────────────────────────
const ROLES = [
  {
    value: 'FARMER',
    label: 'Farmer / Pashu Sakhi',
    sub: 'Field reporter · Community volunteer',
    color: '#86efac',
    bg: 'rgba(93,112,82,0.25)',
    border: 'rgba(93,112,82,0.5)',
  },
  {
    value: 'VET',
    label: 'Veterinary Officer',
    sub: 'Block / district AHD veterinarian',
    color: '#67e8f9',
    bg: 'rgba(8,145,178,0.2)',
    border: 'rgba(8,145,178,0.45)',
  },
  {
    value: 'DVO',
    label: 'District Veterinary Officer',
    sub: 'DVO · State Command Centre',
    color: '#fbbf24',
    bg: 'rgba(193,140,93,0.2)',
    border: 'rgba(193,140,93,0.45)',
  },
]

// ─── Ambient blob ─────────────────────────────────────────────────────────────
function Blob({ style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
        filter: 'blur(72px)',
        ...style,
      }}
    />
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
function Input({ id, icon: Icon, type = 'text', placeholder, value, onChange, autoComplete }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon
        style={{
          position: 'absolute', left: '0.875rem', top: '50%',
          transform: 'translateY(-50%)', width: '1rem', height: '1rem',
          color: 'rgba(255,255,255,0.35)',
          pointerEvents: 'none',
        }}
      />
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '0.875rem',
          padding: '0.75rem 0.875rem 0.75rem 2.5rem',
          color: '#fff',
          fontSize: '0.9rem',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'rgba(93,112,82,0.7)')}
        onBlur={(e)  => (e.target.style.borderColor = 'rgba(255,255,255,0.14)')}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const { login, register, demoLogin } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('login') // 'login' | 'register'

  // Form state
  const [name,     setName]     = useState('')
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState('FARMER')

  // UI state
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function defaultRoute(userRole) {
    return userRole === 'FARMER' ? '/field-report' : '/dashboard'
  }

  function handleQuickDemo(demoRole, demoName, demoPhone) {
    const user = demoLogin(demoRole, demoName, demoPhone)
    navigate(defaultRoute(user.role), { replace: true })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let user
      if (tab === 'login') {
        user = await login(phone, password)
      } else {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return }
        user = await register(name.trim(), phone, password, role)
      }
      navigate(defaultRoute(user.role), { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #1a2315 0%, #2c3820 40%, #1f2a1a 70%, #151a12 100%)',
        padding: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Blobs */}
      <Blob style={{ width: '22rem', height: '22rem', top: '-8rem', left: '-6rem', background: 'rgba(93,112,82,0.35)', opacity: 0.4 }} />
      <Blob style={{ width: '18rem', height: '18rem', bottom: '-6rem', right: '-4rem', background: 'rgba(193,140,93,0.35)', opacity: 0.25, borderRadius: '40% 60% 70% 30% / 40% 70% 30% 60%' }} />

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '26rem',
          background: 'rgba(253,252,248,0.06)',
          backdropFilter: 'blur(20px)',
          borderRadius: '1.75rem',
          border: '1px solid rgba(255,255,255,0.13)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.35)',
          padding: '2rem',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '4rem', height: '4rem', marginBottom: '0.875rem',
            background: 'rgba(255,255,255,0.08)', borderRadius: '1.125rem',
            border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
          }}>
            <img src="/psentinel.png" alt="Pashu Sentinel" style={{ width: '2.75rem', height: '2.75rem', objectFit: 'contain', borderRadius: '0.5rem' }} />
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', margin: 0 }}>
            PASHU SENTINEL
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Livestock Disease Early-Warning Platform
          </p>
        </div>

        {/* Quick Demo Personas */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', textAlign: 'center' }}>
            ⚡ 1-Click Persona Login (Video Demo)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem' }}>
            <button
              type="button"
              id="demo-farmer"
              onClick={() => handleQuickDemo('FARMER', 'Sunita Gawade (Pashu Sakhi)', '9876543201')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.55rem 0.75rem', borderRadius: '0.75rem',
                border: '1px solid rgba(134,239,172,0.35)', background: 'rgba(134,239,172,0.08)',
                color: '#86efac', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(134,239,172,0.18)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(134,239,172,0.08)'}
            >
              <span>👩‍🌾 Sunita (Pashu Sakhi · Khandala)</span>
              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Field Report →</span>
            </button>
            <button
              type="button"
              id="demo-vet"
              onClick={() => handleQuickDemo('VET', 'Dr. Deshmukh (BVO Junnar)', '9876543202')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.55rem 0.75rem', borderRadius: '0.75rem',
                border: '1px solid rgba(103,232,249,0.35)', background: 'rgba(103,232,249,0.08)',
                color: '#67e8f9', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(103,232,249,0.18)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(103,232,249,0.08)'}
            >
              <span>🩺 Dr. Deshmukh (Block Vet · Junnar)</span>
              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Vet Triage →</span>
            </button>
            <button
              type="button"
              id="demo-dvo"
              onClick={() => handleQuickDemo('DVO', 'Dr. Shinde (DVO Pune)', '9876543203')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.55rem 0.75rem', borderRadius: '0.75rem',
                border: '1px solid rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.08)',
                color: '#fbbf24', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(251,191,36,0.18)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(251,191,36,0.08)'}
            >
              <span>🏛️ Dr. Shinde (DVO Command Centre)</span>
              <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>Command Map →</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: '0.5rem', marginBottom: '1.25rem',
          background: 'rgba(0,0,0,0.2)', borderRadius: '0.875rem', padding: '0.25rem',
        }}>
          {['login', 'register'].map((t) => (
            <button
              key={t}
              id={`tab-${t}`}
              onClick={() => { setTab(t); setError('') }}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '0.625rem',
                border: 'none', cursor: 'pointer', fontWeight: 600,
                fontSize: '0.8rem', transition: 'all 0.2s',
                background: tab === t ? 'rgba(93,112,82,0.55)' : 'transparent',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              {t === 'login' ? 'Standard Login' : 'New Registration'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Name — register only */}
          {tab === 'register' && (
            <Input
              id="input-name"
              icon={User}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}

          <Input
            id="input-phone"
            icon={Phone}
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />

          <Input
            id="input-password"
            icon={Lock}
            type="password"
            placeholder={tab === 'login' ? 'Password' : 'Choose a password (min 6 chars)'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />

          {/* Role selector — register only */}
          {tab === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Select your role
              </p>
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  id={`role-${r.value.toLowerCase()}`}
                  onClick={() => setRole(r.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 0.875rem', borderRadius: '0.875rem',
                    border: `1px solid ${role === r.value ? r.border : 'rgba(255,255,255,0.1)'}`,
                    background: role === r.value ? r.bg : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                    boxShadow: role === r.value ? `0 0 0 1px ${r.border}` : 'none',
                  }}
                >
                  <span style={{
                    width: '0.625rem', height: '0.625rem', borderRadius: '50%',
                    background: role === r.value ? r.color : 'rgba(255,255,255,0.2)',
                    flexShrink: 0, transition: 'background 0.2s',
                  }} />
                  <div>
                    <p style={{ color: role === r.value ? r.color : 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: '0.82rem', margin: 0 }}>
                      {r.label}
                    </p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0 }}>{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)',
              borderRadius: '0.75rem', padding: '0.75rem',
            }}>
              <AlertCircle style={{ width: '1rem', height: '1rem', color: '#f87171', flexShrink: 0, marginTop: '0.05rem' }} />
              <p style={{ color: '#f87171', fontSize: '0.8rem', margin: 0, lineHeight: 1.4 }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            id="btn-submit-auth"
            type="submit"
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.825rem', borderRadius: '0.875rem', border: 'none',
              background: loading ? 'rgba(93,112,82,0.4)' : 'rgba(93,112,82,0.8)',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, transform 0.15s',
              boxShadow: '0 4px 16px rgba(93,112,82,0.3)',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(93,112,82,1)' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(93,112,82,0.8)' }}
          >
            {loading
              ? <Loader2 style={{ width: '1.1rem', height: '1.1rem', animation: 'spin 1s linear infinite' }} />
              : <>{tab === 'login' ? 'Log In' : 'Create Account'} <ChevronRight style={{ width: '1rem', height: '1rem' }} /></>
            }
          </button>
        </form>

        {/* Footer */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', marginTop: '1.25rem' }}>
          Ministry of Fisheries, Animal Husbandry &amp; Dairying · Govt. of India
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  )
}
