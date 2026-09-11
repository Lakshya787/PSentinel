import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Globe, CheckCircle2, Send, Users,
  AlertTriangle, Map, Megaphone, Languages,
} from 'lucide-react'
import { useCaseStore } from '../hooks/useCaseStore'
import WorkflowStepper from '../components/ui/WorkflowStepper'

const PRIMARY_CASE_ID = 'CASE-1042'

// ─── Multilingual alert content ───────────────────────────────────────────────
const ALERT_CONTENT = {
  marathi: {
    label: 'मराठी',
    flag: '🇮🇳',
    title: '⚠️ पशुधन रोग सूचना — खंडाळा, जुन्नर',
    body: `सावधान!

आपल्या परिसरात पशुधनामध्ये संसर्गजन्य आजाराची पुष्टी झाली आहे.

📌 बाधित क्षेत्र: खंडाळा आणि आजूबाजूचे गाव (जुन्नर तालुका, पुणे)
🦠 शंकास्पद आजार: लाळ्या खुरकूत (FMD — Foot-and-Mouth Disease)

🚨 तत्काळ कृती करा:
• आजारी जनावरांना निरोगी जनावरांपासून त्वरित वेगळे ठेवा
• जनावरांची अनावश्यक वाहतूक टाळा — हालचालींवर बंधन आहे
• तत्काळ पशुवैद्यकीय अधिकाऱ्यांशी संपर्क साधा
• बाधित जनावरांना स्पर्श केल्यानंतर हात स्वच्छ धुवा
• कोणतेही नवीन लक्षण आढळल्यास लगेच कळवा

📞 पशुसेवा हेल्पलाइन: 1962
📞 जुन्नर पशुवैद्यकीय कार्यालय: 02132-XXXXXX

⚠️ हे एक निर्णय-समर्थन प्रणालीचे संदेश आहे. कृपया पशुवैद्यकीय अधिकाऱ्यांकडून पुष्टी करा.`,
    summary: 'Marathi advisory for farmers in Khandala and surrounding villages. Suspected FMD confirmed — isolation, movement restriction, and immediate veterinary contact advised.',
  },
  hindi: {
    label: 'हिन्दी',
    flag: '🇮🇳',
    title: '⚠️ पशुधन रोग सूचना — खंडाला, जुन्नर',
    body: `चेतावनी!

आपके क्षेत्र में पशुओं में संक्रामक बीमारी की पुष्टि हुई है।

📌 प्रभावित क्षेत्र: खंडाला और आसपास के गाँव (जुन्नर तालुका, पुणे)
🦠 संदिग्ध बीमारी: खुरपका-मुँहपका रोग (FMD)

🚨 तुरंत कदम उठाएं:
• बीमार पशुओं को स्वस्थ पशुओं से तुरंत अलग करें
• पशुओं की अनावश्यक आवाजाही से बचें — प्रतिबंध लागू है
• तुरंत पशु चिकित्सा अधिकारी से संपर्क करें
• संक्रमित पशुओं को छूने के बाद हाथ धोएं
• कोई नया लक्षण दिखने पर तुरंत सूचित करें

📞 पशु सेवा हेल्पलाइन: 1962
📞 जुन्नर पशु चिकित्सालय: 02132-XXXXXX

⚠️ यह एक निर्णय-समर्थन प्रणाली का संदेश है। कृपया पशु चिकित्सा अधिकारी से पुष्टि करें।`,
    summary: 'Hindi advisory for livestock owners in Khandala. Suspected FMD — isolation, movement restrictions, and veterinary contact required.',
  },
  english: {
    label: 'English',
    flag: '🇬🇧',
    title: '⚠️ Livestock Disease Advisory — Khandala, Junnar',
    body: `URGENT ADVISORY

A high-confidence livestock disease event has been detected in your area.

📌 Affected Area: Khandala Village and surrounding villages within 10 km (Junnar Taluk, Pune District)
🦠 Suspected Disease: Foot-and-Mouth Disease (FMD) — Serotype O

🚨 Immediate Actions Required:
• Immediately isolate sick animals from healthy livestock
• Do NOT move animals outside the area — movement restrictions are in effect
• Contact your Veterinary Officer immediately
• Wash hands thoroughly after contact with affected animals
• Report any new symptoms immediately

This advisory is issued by the Pashu Sentinel Early-Warning System.
This is a decision-support signal — official veterinary confirmation is required.

📞 Livestock Helpline: 1962
📞 Junnar Veterinary Office: 02132-XXXXXX`,
    summary: 'English advisory for official communication. Suspected FMD confirmed via risk analysis — isolation, movement restriction, immediate veterinary response required.',
  },
}

const DELIVERY_STATS = {
  targetVillages: 8,
  recipients: 1240,
  delivered: 1198,
  pending: 42,
  rate: 96.6,
}

// ─── AlertsPage ───────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const navigate                  = useNavigate()
  const { getCase, updateAlert }  = useCaseStore()
  const [language, setLanguage]   = useState('marathi')

  const c           = getCase(PRIMARY_CASE_ID)
  if (!c) return null

  const alertState  = c.alert?.status ?? 'NONE'
  const content     = ALERT_CONTENT[language]

  function handleGenerate() {
    updateAlert(PRIMARY_CASE_ID, {
      status: 'DRAFT',
      language,
      targetVillages: DELIVERY_STATS.targetVillages,
      generatedAt: new Date().toISOString(),
    })
  }

  function handleMarkReady() {
    updateAlert(PRIMARY_CASE_ID, { status: 'READY' })
  }

  function handleSend() {
    updateAlert(PRIMARY_CASE_ID, {
      status: 'SENT',
      sentAt: new Date().toISOString(),
      deliveryStats: DELIVERY_STATS,
    })
  }

  return (
    <div className="min-h-full pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-surface-border px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Advisory Alerts</h1>
              <p className="text-xs text-slate-500">Multilingual Livestock Disease Advisory System</p>
            </div>
            <WorkflowStepper caseStatus={c.status} compact />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Alert meta */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Alert Severity',  value: 'CRITICAL',                       color: 'text-red-600 bg-red-50 border-red-200'    },
            { label: 'Alert Type',      value: 'Livestock Disease Advisory',      color: 'text-slate-700 bg-slate-50 border-slate-200' },
            { label: 'Target Area',     value: 'Khandala + 10 km Surveillance',   color: 'text-brand-700 bg-brand-50 border-brand-200' },
            { label: 'Trigger',         value: 'High-risk disease event',         color: 'text-amber-700 bg-amber-50 border-amber-200' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`border rounded-xl px-4 py-3 ${color}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</p>
              <p className="text-sm font-bold mt-0.5 leading-tight">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left — Alert composer */}
          <div className="space-y-4">
            {/* Language selector */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Languages className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Alert Language</h2>
              </div>
              <div className="flex gap-2">
                {Object.entries(ALERT_CONTENT).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setLanguage(key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all
                      ${language === key
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                      }`}
                  >
                    {val.flag} {val.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert preview */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2 bg-slate-50">
                <Megaphone className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Advisory Preview</h2>
                <span className={`ml-auto text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border
                  ${alertState === 'SENT'  ? 'text-green-600 bg-green-50 border-green-200'
                  : alertState === 'READY' ? 'text-brand-600 bg-brand-50 border-brand-200'
                  : alertState === 'DRAFT' ? 'text-amber-600 bg-amber-50 border-amber-200'
                  : 'text-slate-400 bg-slate-50 border-slate-200'
                  }`}
                >
                  {alertState === 'NONE' ? 'Not Generated' : alertState === 'READY' ? 'READY TO SEND' : alertState}
                </span>
              </div>
              <div className="px-4 py-4">
                <p className="text-xs font-bold text-slate-700 mb-2">{content.title}</p>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">
                  {content.body}
                </pre>
              </div>
              {language !== 'english' && (
                <div className="border-t border-surface-border bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">English Summary (for officials)</p>
                  <p className="text-xs text-slate-600 italic">{content.summary}</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="card p-4 space-y-3">
              <h2 className="section-title">Alert Actions</h2>

              {alertState === 'NONE' && (
                <button onClick={handleGenerate} className="btn-primary w-full justify-center">
                  <Bell className="w-3.5 h-3.5" />
                  Generate Alert — DRAFT
                </button>
              )}

              {alertState === 'DRAFT' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-700">Alert generated — DRAFT</p>
                  </div>
                  <button onClick={handleMarkReady} className="btn-primary w-full justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve — Mark as Ready to Send
                  </button>
                </div>
              )}

              {alertState === 'READY' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-brand-600" />
                    <p className="text-sm font-semibold text-brand-700">Alert approved — Ready to Send</p>
                  </div>
                  <button onClick={handleSend} className="btn-primary w-full justify-center bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700">
                    <Send className="w-3.5 h-3.5" />
                    Send Alert to {DELIVERY_STATS.targetVillages} Villages
                  </button>
                </div>
              )}

              {alertState === 'SENT' && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-bold text-green-700">Alert Sent Successfully</p>
                </div>
              )}
            </div>
          </div>

          {/* Right — Delivery stats + Next steps */}
          <div className="space-y-4">
            {/* Delivery stats */}
            {alertState === 'SENT' && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-slate-500" />
                  <h2 className="section-title">Simulated Delivery Statistics</h2>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-700">Simulated delivery data — for demonstration purposes only</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Target villages', value: DELIVERY_STATS.targetVillages, color: 'text-slate-900' },
                    { label: 'Recipients',      value: DELIVERY_STATS.recipients.toLocaleString(), color: 'text-slate-900' },
                    { label: 'Delivered',       value: DELIVERY_STATS.delivered.toLocaleString(), color: 'text-green-600' },
                    { label: 'Pending',         value: DELIVERY_STATS.pending, color: 'text-amber-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card px-3 py-3">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">{label}</p>
                      <p className={`text-xl font-black mt-0.5 tabular-nums ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-700">Delivery rate</span>
                  <span className="text-2xl font-black text-green-600">{DELIVERY_STATS.rate}%</span>
                </div>
              </div>
            )}

            {/* Coverage map info */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Map className="w-4 h-4 text-slate-500" />
                <h2 className="section-title">Alert Coverage Area</h2>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Primary village', value: 'Khandala' },
                  { label: 'Additional villages', value: 'Rajuri, Narayangaon, Otur, Wadaj, Ale, Shirdi, Manchar' },
                  { label: 'Surveillance radius', value: '10 km from primary case' },
                  { label: 'Case cluster', value: 'CLU-JUN-01 · 5 cases' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-3">
                    <span className="text-slate-500 shrink-0">{label}</span>
                    <span className="font-medium text-slate-800 text-right">{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/map')}
                className="mt-4 btn-secondary w-full justify-center text-xs"
              >
                <Map className="w-3.5 h-3.5" />
                View on Risk Map
              </button>
            </div>

            {/* Next step */}
            {alertState === 'SENT' && (
              <div className="card p-4 bg-brand-50 border-brand-200">
                <p className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-2">Next Step</p>
                <p className="text-sm font-semibold text-brand-900">Activate Containment Response</p>
                <p className="text-xs text-brand-600 mt-1">
                  Initiate ring vaccination, movement restrictions, and veterinary field visits.
                </p>
                <button onClick={() => navigate('/actions')} className="btn-primary mt-3 w-full justify-center text-xs">
                  Go to Containment →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
