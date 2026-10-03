/**
 * components/VetChatWidget.jsx
 *
 * Floating RAG-powered Veterinary Knowledge Assistant chat widget.
 * Appears as a persistent bottom-right FAB on all authenticated pages.
 *
 * Features:
 *  • Multi-turn conversation history passed to backend
 *  • Source document attribution for each AI answer
 *  • Graceful degradation (shows fallback message if Gemini not configured)
 *  • Smooth open/close animation with glassmorphism panel
 *  • Zoonotic warning auto-detection (Anthrax, Rabies, Brucellosis triggers)
 *  • Typing indicator while awaiting response
 *  • Markdown-like formatting of answers
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Category badge colours ─────────────────────────────────────────────────
const CAT_COLORS = {
  disease:      { bg: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
  vaccination:  { bg: '#f0f9ff', border: '#7dd3fc', text: '#0369a1' },
  evm:          { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
  biosecurity:  { bg: '#fff7ed', border: '#fdba74', text: '#c2410c' },
  guidance:     { bg: '#faf5ff', border: '#d8b4fe', text: '#7c3aed' },
}

// ── Suggested starter questions ────────────────────────────────────────────
const STARTERS = [
  'My cow has blisters on its mouth and feet. What should I do?',
  'How often should I vaccinate against FMD?',
  'Signs of Lumpy Skin Disease in cattle?',
  'Home remedy for mild fever in buffalo?',
  'When should I call the veterinarian urgently?',
]

// ── Detect zoonotic keywords to show extra warning ─────────────────────────
const ZOONOTIC_KEYWORDS = ['anthrax', 'brucellosis', 'rabies', 'abortion', 'sudden death', 'bloody discharge']
function isZoonotic(text) {
  const lower = text.toLowerCase()
  return ZOONOTIC_KEYWORDS.some(k => lower.includes(k))
}

// ── Simple text formatter (bold **...**, newlines → <br>) ──────────────────
function formatAnswer(text) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/\*\*(.*?)\*\*/g)
    const formatted = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    )
    return <span key={i}>{formatted}<br /></span>
  })
}

export default function VetChatWidget() {
  const { token, user } = useAuth()
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState([])        // [{role, content, sources, zoonotic}]
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [unread, setUnread]       = useState(0)
  const [showSources, setShowSources] = useState(null)  // msg index whose sources panel is open
  const [pulse, setPulse]         = useState(false)

  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  // Pulse the FAB every 30 s to remind user of the feature
  useEffect(() => {
    if (open) return
    const id = setInterval(() => {
      setPulse(true)
      setTimeout(() => setPulse(false), 1500)
    }, 30000)
    return () => clearInterval(id)
  }, [open])

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when widget opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
      setUnread(0)
    }
  }, [open])

  // ── Send message — MUST be above early return to satisfy Rules of Hooks ───
  const sendMessage = useCallback(async (query) => {
    const q = (query || input).trim()
    if (!q || loading) return

    const userMsg = { role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Build history for multi-turn (exclude the latest user message we just added)
    const history = messages.map(m => ({
      role:    m.role === 'assistant' ? 'model' : 'user',
      content: m.content,
    }))

    try {
      const res = await fetch(`${API_BASE}/rag/chat`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: q,
          history: history.length > 0 ? history : null,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const assistantMsg = {
        role:     'assistant',
        content:  data.answer,
        sources:  data.sources || [],
        fallback: data.fallback || false,
        zoonotic: isZoonotic(data.answer) || isZoonotic(q),
      }
      setMessages(prev => [...prev, assistantMsg])

      if (!open) setUnread(prev => prev + 1)
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role:    'assistant',
          content: `I encountered an error connecting to the knowledge system. Please check your network and try again, or contact your Block Veterinary Officer directly.\n\nHelpline: **1962** (DAHD Animal Helpline)`,
          sources: [],
          error:   true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading, token, open])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setShowSources(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Guard: only show widget when authenticated (placed after ALL hooks)
  if (!user || !token) return null

  return (
    <>
      {/* ── FAB Button ─────────────────────────────────────────────────── */}
      <button
        id="vet-chat-fab"
        onClick={() => setOpen(v => !v)}
        style={{
          position:     'fixed',
          bottom:       '24px',
          right:        '24px',
          zIndex:       9998,
          width:        '60px',
          height:       '60px',
          borderRadius: '50%',
          background:   'linear-gradient(135deg, #5d7052 0%, #3e4c37 100%)',
          border:       'none',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          boxShadow:    '0 8px 32px -4px rgba(93,112,82,0.45), 0 2px 8px rgba(0,0,0,0.15)',
          transition:   'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform:    pulse ? 'scale(1.12)' : open ? 'scale(0.95) rotate(10deg)' : 'scale(1)',
          outline:      'none',
        }}
        title="VetAssist — Veterinary Knowledge Assistant"
        aria-label="Open Veterinary Assistant Chat"
      >
        {/* Pulse ring animation */}
        {pulse && !open && (
          <span style={{
            position:     'absolute',
            inset:        '-4px',
            borderRadius: '50%',
            border:       '2px solid rgba(93,112,82,0.4)',
            animation:    'vet-pulse-ring 1.5s ease-out',
          }} />
        )}

        {/* Icon */}
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f3f4f1" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f3f4f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        )}

        {/* Unread badge */}
        {unread > 0 && !open && (
          <span style={{
            position:      'absolute',
            top:           '-4px',
            right:         '-4px',
            background:    '#dc2626',
            color:         '#fff',
            fontSize:      '11px',
            fontWeight:    '700',
            width:         '20px',
            height:        '20px',
            borderRadius:  '50%',
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'center',
            border:        '2px solid #fdfcf8',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* ── Chat Panel ─────────────────────────────────────────────────── */}
      <div
        id="vet-chat-panel"
        style={{
          position:      'fixed',
          bottom:        '96px',
          right:         '24px',
          zIndex:        9997,
          width:         'min(420px, calc(100vw - 32px))',
          height:        'min(600px, calc(100vh - 120px))',
          display:       'flex',
          flexDirection: 'column',
          borderRadius:  '20px',
          overflow:      'hidden',
          background:    'rgba(253, 252, 248, 0.97)',
          backdropFilter: 'blur(20px)',
          border:        '1px solid rgba(222, 216, 207, 0.8)',
          boxShadow:     '0 24px 80px -12px rgba(44,44,36,0.22), 0 8px 24px -4px rgba(93,112,82,0.15)',
          transform:     open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
          opacity:       open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition:    'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformOrigin: 'bottom right',
        }}
        role="dialog"
        aria-label="Veterinary Knowledge Assistant"
        aria-hidden={!open}
      >
        {/* Header */}
        <div style={{
          background:    'linear-gradient(135deg, #3e4c37 0%, #5d7052 60%, #6f9368 100%)',
          padding:       '14px 16px',
          display:       'flex',
          alignItems:    'center',
          gap:           '12px',
          flexShrink:    0,
          position:      'relative',
          overflow:      'hidden',
        }}>
          {/* Decorative texture overlay */}
          <div style={{
            position:   'absolute',
            inset:      0,
            background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'80\' cy=\'20\' r=\'40\' fill=\'rgba(255,255,255,0.03)\'/%3E%3C/svg%3E")',
            backgroundSize: '100% 100%',
          }} />

          {/* Avatar */}
          <div style={{
            width:        '40px',
            height:       '40px',
            borderRadius: '50%',
            background:   'rgba(255,255,255,0.15)',
            border:       '2px solid rgba(255,255,255,0.25)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            flexShrink:   0,
            position:     'relative',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f3f4f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11m0 0H5m4 0h10m0-11v11m0 0h-4m4 0V9"/>
              <circle cx="12" cy="18" r="3"/>
              <path d="M12 15v-3"/>
            </svg>
            {/* Green dot */}
            <span style={{
              position:     'absolute',
              bottom:       '1px',
              right:        '1px',
              width:        '10px',
              height:       '10px',
              background:   '#4ade80',
              borderRadius: '50%',
              border:       '2px solid #3e4c37',
            }} />
          </div>

          {/* Title */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <div style={{
              color:       '#f3f4f1',
              fontWeight:  '700',
              fontSize:    '15px',
              fontFamily:  'var(--font-serif, Georgia, serif)',
              letterSpacing: '-0.01em',
            }}>
              VetAssist
            </div>
            <div style={{
              color:    'rgba(243,244,241,0.7)',
              fontSize: '11.5px',
              fontWeight: '500',
            }}>
              Veterinary Knowledge Assistant · ICAR-NIVEDI
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear conversation"
                style={{
                  background:    'rgba(255,255,255,0.12)',
                  border:        '1px solid rgba(255,255,255,0.2)',
                  color:         'rgba(243,244,241,0.8)',
                  borderRadius:  '8px',
                  padding:       '5px 8px',
                  cursor:        'pointer',
                  fontSize:      '11px',
                  fontWeight:    '500',
                  transition:    'all 0.15s ease',
                  display:       'flex',
                  alignItems:    'center',
                  gap:           '4px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                </svg>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Disclaimer banner */}
        <div style={{
          background:  '#fff7ed',
          borderBottom: '1px solid #fdba74',
          padding:     '8px 14px',
          fontSize:    '11px',
          color:       '#92400e',
          display:     'flex',
          alignItems:  'center',
          gap:         '6px',
          flexShrink:  0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            <strong>First-aid guidance only.</strong> Always consult your Block Veterinary Officer for diagnosis & prescriptions.
          </span>
        </div>

        {/* Messages area */}
        <div style={{
          flex:      1,
          overflowY: 'auto',
          padding:   '16px 14px',
          display:   'flex',
          flexDirection: 'column',
          gap:       '14px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(93,112,82,0.3) transparent',
        }}>

          {/* Empty state — show starters */}
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🐄</div>
                <div style={{
                  fontFamily:  'var(--font-serif, Georgia, serif)',
                  fontSize:    '15px',
                  fontWeight:  '700',
                  color:       '#3e4c37',
                  marginBottom: '4px',
                }}>
                  How can I help today?
                </div>
                <div style={{ fontSize: '12px', color: '#78786c' }}>
                  Ask about livestock diseases, vaccination, or first-aid
                </div>
              </div>

              {STARTERS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    background:    '#f0f4ee',
                    border:        '1px solid #b9cdb2',
                    borderRadius:  '12px',
                    padding:       '9px 12px',
                    textAlign:     'left',
                    cursor:        'pointer',
                    fontSize:      '12.5px',
                    color:         '#3e4c37',
                    fontWeight:    '500',
                    transition:    'all 0.15s ease',
                    lineHeight:    '1.4',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#dce6d8'
                    e.currentTarget.style.borderColor = '#93b08b'
                    e.currentTarget.style.transform = 'translateX(2px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f0f4ee'
                    e.currentTarget.style.borderColor = '#b9cdb2'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap:           '6px',
            }}>

              {/* Zoonotic warning */}
              {msg.role === 'assistant' && msg.zoonotic && (
                <div style={{
                  background:   '#fef2f2',
                  border:       '1px solid #fca5a5',
                  borderRadius: '10px',
                  padding:      '7px 10px',
                  fontSize:     '11.5px',
                  color:        '#991b1b',
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          '6px',
                  maxWidth:     '95%',
                  lineHeight:   '1.4',
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                  <span>
                    <strong>Zoonotic Risk Detected.</strong> This condition may pose a human health risk.
                    Contact the district <strong>IDSP</strong> in addition to your BVO.
                  </span>
                </div>
              )}

              {/* Bubble */}
              <div style={{
                maxWidth:      '88%',
                padding:       msg.role === 'user' ? '10px 14px' : '12px 14px',
                borderRadius:  msg.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                background:    msg.role === 'user'
                  ? 'linear-gradient(135deg, #5d7052, #4e5f45)'
                  : msg.error
                    ? '#fef2f2'
                    : '#ffffff',
                color:         msg.role === 'user' ? '#f3f4f1' : '#2c2c24',
                fontSize:      '13px',
                lineHeight:    '1.6',
                boxShadow:     msg.role === 'user'
                  ? '0 3px 12px -2px rgba(93,112,82,0.35)'
                  : '0 2px 8px -2px rgba(44,44,36,0.10)',
                border:        msg.role === 'assistant' && !msg.error
                  ? '1px solid rgba(222,216,207,0.7)'
                  : msg.error
                    ? '1px solid #fca5a5'
                    : 'none',
                wordBreak:     'break-word',
              }}>
                {msg.role === 'assistant'
                  ? formatAnswer(msg.content)
                  : msg.content
                }
              </div>

              {/* Sources panel toggle */}
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <button
                  onClick={() => setShowSources(showSources === idx ? null : idx)}
                  style={{
                    background:   'transparent',
                    border:       '1px solid #ded8cf',
                    borderRadius: '8px',
                    padding:      '4px 10px',
                    cursor:       'pointer',
                    fontSize:     '11px',
                    color:        '#78786c',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '4px',
                    transition:   'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f0ebe5'
                    e.currentTarget.style.color = '#3e4c37'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#78786c'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  {msg.sources.length} source{msg.sources.length > 1 ? 's' : ''} · {showSources === idx ? 'Hide' : 'View'}
                </button>
              )}

              {/* Sources expanded */}
              {showSources === idx && msg.sources && (
                <div style={{
                  display:       'flex',
                  flexDirection: 'column',
                  gap:           '5px',
                  width:         '100%',
                  maxWidth:      '95%',
                }}>
                  {msg.sources.map(src => {
                    const cc = CAT_COLORS[src.category] || CAT_COLORS.guidance
                    return (
                      <div key={src.id} style={{
                        background:   cc.bg,
                        border:       `1px solid ${cc.border}`,
                        borderRadius: '8px',
                        padding:      '7px 10px',
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'space-between',
                        gap:          '8px',
                      }}>
                        <div>
                          <div style={{ fontSize: '11.5px', fontWeight: '600', color: cc.text, lineHeight: '1.3' }}>
                            {src.title}
                          </div>
                          <div style={{ fontSize: '10.5px', color: cc.text, opacity: 0.7, marginTop: '2px' }}>
                            {src.category.charAt(0).toUpperCase() + src.category.slice(1)}
                          </div>
                        </div>
                        <div style={{
                          fontSize:     '11px',
                          fontWeight:   '700',
                          color:        cc.text,
                          background:   'rgba(255,255,255,0.6)',
                          borderRadius: '6px',
                          padding:      '2px 6px',
                          flexShrink:   0,
                        }}>
                          {(src.score * 100).toFixed(0)}%
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '8px',
            }}>
              <div style={{
                background:   '#ffffff',
                border:       '1px solid rgba(222,216,207,0.7)',
                borderRadius: '18px 18px 18px 4px',
                padding:      '12px 16px',
                display:      'flex',
                alignItems:   'center',
                gap:          '5px',
                boxShadow:    '0 2px 8px -2px rgba(44,44,36,0.10)',
              }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    width:         '7px',
                    height:        '7px',
                    background:    '#93b08b',
                    borderRadius:  '50%',
                    display:       'inline-block',
                    animation:     `vet-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '11px', color: '#78786c' }}>VetAssist is thinking…</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div style={{
          padding:       '12px 14px 14px',
          borderTop:     '1px solid rgba(222,216,207,0.8)',
          background:    'rgba(253,252,248,0.9)',
          flexShrink:    0,
        }}>
          <div style={{
            display:       'flex',
            gap:           '8px',
            alignItems:    'flex-end',
            background:    '#ffffff',
            border:        '1.5px solid #ded8cf',
            borderRadius:  '16px',
            padding:       '8px 8px 8px 14px',
            boxShadow:     '0 2px 8px -2px rgba(44,44,36,0.08)',
            transition:    'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
            onFocusCapture={e => {
              e.currentTarget.style.borderColor = '#5d7052'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(93,112,82,0.12), 0 2px 8px -2px rgba(44,44,36,0.08)'
            }}
            onBlurCapture={e => {
              e.currentTarget.style.borderColor = '#ded8cf'
              e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(44,44,36,0.08)'
            }}
          >
            <textarea
              ref={inputRef}
              id="vet-chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about symptoms, treatment, vaccination…"
              rows={1}
              style={{
                flex:       1,
                border:     'none',
                outline:    'none',
                resize:     'none',
                background: 'transparent',
                fontSize:   '13px',
                color:      '#2c2c24',
                fontFamily: 'var(--font-sans, Nunito, sans-serif)',
                lineHeight: '1.5',
                maxHeight:  '100px',
                overflowY:  'auto',
                paddingTop: '2px',
              }}
              onInput={e => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
              }}
              disabled={loading}
              aria-label="Type your livestock health question"
            />
            <button
              id="vet-chat-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width:        '36px',
                height:       '36px',
                borderRadius: '12px',
                background:   input.trim() && !loading
                  ? 'linear-gradient(135deg, #5d7052, #4e5f45)'
                  : '#e6dccd',
                border:       'none',
                cursor:       input.trim() && !loading ? 'pointer' : 'default',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                flexShrink:   0,
                transition:   'all 0.2s ease',
                transform:    input.trim() && !loading ? 'scale(1)' : 'scale(0.95)',
              }}
              aria-label="Send message"
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() && !loading ? '#f3f4f1' : '#ded8cf'}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

          {/* Footer note */}
          <div style={{
            textAlign:  'center',
            marginTop:  '7px',
            fontSize:   '10.5px',
            color:      '#a0a09a',
          }}>
            Powered by Gemini · Knowledge: ICAR-NIVEDI & DAHD · Not a substitute for veterinary care
          </div>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes vet-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes vet-pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </>
  )
}
