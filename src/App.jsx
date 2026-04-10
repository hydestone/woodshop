import React from 'react'
import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import * as db from './db.js'
import { getSession, signOut, onAuthStateChange } from './supabase.js'
import Auth from './pages/Auth.jsx'
import { ToastProvider } from './components/Toast.jsx'
import GlobalSearch from './components/Search.jsx'
import {
  IFolder, ICart, IWrench, ICamera, ITree, IBulb, ISaw,
  IStar, ICheck, IGrid, IIdea, IBrain, IDollar,
  IBook, IHouse, IImage, ILayers, IMore, IClose,
  coatStatus, maintStatus,
} from './components/Shared.jsx'

// Pages
import Dashboard        from './pages/Dashboard.jsx'
import Projects, { ProjectDetail } from './pages/Projects.jsx'
import Shopping         from './pages/Shopping.jsx'
import Maintenance      from './pages/Maintenance.jsx'
import Stock, { WoodStockGallery } from './pages/Stock.jsx'
import Brainstorm       from './pages/Brainstorm.jsx'
import Finishes         from './pages/Finishes.jsx'
import Resources        from './pages/Resources.jsx'
import ShopImprovements from './pages/ShopImprovements.jsx'
import AllPhotos        from './pages/Photos.jsx'
import FinishedProducts from './pages/FinishedProducts.jsx'
import Inspiration      from './pages/Inspiration.jsx'
import YearReview      from './pages/YearReview.jsx'
import Settings       from './pages/Settings.jsx'
import ProjectIdeas   from './pages/ProjectIdeas.jsx'
import BulkImport     from './pages/BulkImport.jsx'
import Costs         from './pages/Costs.jsx'
import Audit          from './pages/Audit.jsx'
import Help           from './pages/Help.jsx'
import SmokeTest      from './pages/SmokeTest.jsx'
import Calculators    from './pages/Calculators.jsx'
import ErrorBoundary  from './components/ErrorBoundary.jsx'

// ─── Context ──────────────────────────────────────────────────────────────────
const AppCtx = createContext(null)
export const useCtx = () => useContext(AppCtx)

// ─── Navigation config ────────────────────────────────────────────────────────
// ── Sectioned navigation ────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { id: 'home',        label: 'Home',             Icon: IHouse  },
      { id: 'projects',    label: 'Projects',          Icon: IFolder },
      { id: 'ideas',       label: 'Project Ideas',     Icon: IIdea   },
      { id: 'stock',       label: 'Wood Stock',        Icon: ITree   },
      { id: 'maintenance', label: 'Shop Maintenance',  Icon: IWrench },
      { id: 'shop',        label: 'Shop Improvements', Icon: IHouse  },
      { id: 'shopping',    label: 'Shopping List',     Icon: ICart   },
    ],
  },
  {
    label: 'Creative',
    items: [
      { id: 'brainstorm',  label: 'Brainstorm',        Icon: IBulb   },
      { id: 'calculators', label: 'Calculators',        Icon: ISaw    },
      { id: 'yearreview',  label: 'Year in Review',    Icon: IStar   },
    ],
  },
  {
    label: 'Gallery',
    items: [
      { id: 'photos',      label: 'All Photos',        Icon: ICamera },
      { id: 'finished',    label: 'Finished Work',     Icon: IImage  },
      { id: 'inspiration', label: 'Inspiration',       Icon: IBulb   },
      { id: 'stockgallery', label: 'Wood Stock Gallery', Icon: ITree   },
    ],
  },
  {
    label: 'Library',
    items: [
      { id: 'finishes',    label: 'Finishes',          Icon: ILayers },
      { id: 'resources',   label: 'Resources',         Icon: IBook   },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'settings',    label: 'Categories',         Icon: IWrench },
      { id: 'import',      label: 'Bulk Import',       Icon: ICamera },
      { id: 'costs',       label: 'Costs',             Icon: IDollar },
    ],
  },
]

// Flat list for mobile "more" menu and badge lookups
const ALL_NAV = NAV_SECTIONS.flatMap(s => s.items)


const MOBILE_TABS = [
  { id: 'home',     label: 'Home',     Icon: IHouse  },
  { id: 'projects', label: 'Projects', Icon: IFolder },
  { id: 'shopping', label: 'Shop',     Icon: ICart   },
  { id: 'photos',   label: 'Photos',   Icon: ICamera },
  { id: 'more',     label: 'More',     Icon: IMore   },
]



// ── Feedback Modal ─────────────────────────────────────────────────────────────
// Posts to a Google Apps Script webhook → Google Sheet
// Deploy your own: https://script.google.com → new project → paste handler below
const FEEDBACK_WEBHOOK = 'https://script.google.com/macros/s/AKfycbzyB_ThPvl4xc8DDEwE7_QwjmGBlAsXwerQTnqw8N45pLAIgBsW3uBQ7RSkUZzz4E0/exec'

function FeedbackModal({ session, onClose }) {
  const [msg, setMsg]       = useState('')
  const [rating, setRating] = useState(0)
  const [sent, setSent]     = useState(false)
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!msg.trim()) return
    setSending(true)
    try {
      await fetch(FEEDBACK_WEBHOOK, {
        method: 'POST',
        mode: 'no-cors',  // Apps Script requires no-cors
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session?.user?.email || 'unknown',
          user_id: session?.user?.id || 'unknown',
          rating,
          message: msg.trim(),
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
          app: 'JDH Woodworks',
        }),
      })
      setSent(true)
    } catch (e) {
      // no-cors swallows errors — treat as success
      setSent(true)
    }
    setSending(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', borderRadius:20, padding:'28px 24px', width:'100%', maxWidth:380, display:'flex', flexDirection:'column', gap:16, boxShadow:'var(--shadow-xl)' }}>
        {sent ? (
          <>
            <div style={{ fontSize:40, textAlign:'center' }}>🙏</div>
            <div style={{ textAlign:'center', fontWeight:700, fontSize:18 }}>Thanks for the feedback!</div>
            <button className="btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            <div style={{ fontWeight:700, fontSize:18 }}>Send Feedback</div>
            <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)}
                  style={{ fontSize:24, background:'none', border:'none', cursor:'pointer', opacity: rating >= n ? 1 : 0.3, transition:'opacity 150ms' }}>
                  ⭐
                </button>
              ))}
            </div>
            <textarea
              className="form-input"
              placeholder="What's working? What's not? Any ideas?"
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={5}
              style={{ resize:'vertical', minHeight:100 }}
              autoFocus
            />
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-secondary" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>Cancel</button>
              <button className="btn-primary" style={{ flex:1, justifyContent:'center' }} onClick={send} disabled={!msg.trim() || sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── QR Code Modal ─────────────────────────────────────────────────────────────
function QRModal({ onClose }) {
  const PORTFOLIO_URL = 'https://woodshop-pdd2.vercel.app/portfolio'
  const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&color=0F1E38&bgcolor=ffffff&qzone=1&data=' + encodeURIComponent(PORTFOLIO_URL)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20, padding: '32px 28px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 16, maxWidth: 340, width: '100%',
          boxShadow: '0 24px 60px rgba(0,0,0,.4)',
        }}
      >
        <img src="/New_Logo.png" alt="JDH Woodworks" style={{width:56,height:56,objectFit:'contain'}} />

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1E38', letterSpacing: '-.3px' }}>
            JDH <span style={{ color: '#2D5A3D' }}>WOODWORKS</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Scan to view portfolio</div>
        </div>

        <img
          src={qrSrc}
          alt="QR code for JDH Woodworks portfolio"
          width={260} height={260}
          style={{ borderRadius: 12, border: '1px solid #E2E8F0', display: 'block' }}
        />

        <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
          woodshop-pdd2.vercel.app/portfolio
        </div>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={async () => {
              const url = 'https://woodshop-pdd2.vercel.app/portfolio'
              if (navigator.share) {
                try {
                  await navigator.share({ title: 'JDH Woodworks', text: 'Handcrafted woodworking — bowls, furniture, turning & hand tools.', url })
                } catch (e) { /* cancelled */ }
              } else {
                await navigator.clipboard.writeText(url)
                alert('Link copied to clipboard!')
              }
            }}
            style={{
              flex: 1, padding: '11px', background: '#2D5A3D', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Share
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px', background: '#0F1E38', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

// ── Particle nebula — desktop only ────────────────────────────────────────────
function ParticleNebula({ isDark }) {
  const canvasRef = React.useRef()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.setTransform(1, 0, 0, 1, 0, 0)   // reset before scale to prevent accumulation
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // Particle colours adapt to theme
    const colours = isDark
      ? ['rgba(139,168,208,', 'rgba(74,222,128,', 'rgba(167,139,250,', 'rgba(255,255,255,']
      : ['rgba(29,78,216,',   'rgba(22,101,52,',  'rgba(124,58,237,',  'rgba(180,83,9,']

    const particles = Array.from({ length: 38 }, (_, i) => ({
      x: Math.random() * 100,  // percent
      y: Math.random() * 100,
      vx: (Math.random() - 0.5) * 0.012,
      vy: (Math.random() - 0.5) * 0.008,
      r: 0.6 + Math.random() * 1.4,
      a: 0.08 + Math.random() * 0.18,
      col: colours[i % colours.length],
      phase: Math.random() * Math.PI * 2,
    }))

    const draw = (ts) => {
      ctx.clearRect(0, 0, W(), H())
      const t = ts / 1000
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -2) p.x = 102
        if (p.x > 102) p.x = -2
        if (p.y < -5) p.y = 105
        if (p.y > 105) p.y = -5
        // gentle breathing opacity
        const opacity = p.a * (0.6 + 0.4 * Math.sin(t * 0.7 + p.phase))
        ctx.beginPath()
        ctx.arc(p.x / 100 * W(), p.y / 100 * H(), p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.col + opacity + ')'
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [isDark])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', opacity: 0.9,
      }}
      aria-hidden="true"
    />
  )
}

export default function App() {
  const [session, setSession]   = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [tab, setTabRaw]        = useState('home')
  const [projId, setProjId]     = useState(null)
  const [showMore, setShowMore] = useState(false)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('jdh-theme') || 'dark' } catch { return 'dark' }
  })

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('jdh-theme', theme) } catch {}
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const [showQR, setShowQR] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline  = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  // ── Auth state ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Check for existing session on mount
    getSession().then(s => {
      setSession(s)
      setAuthChecked(true)
    })
    // Listen for auth changes (login / logout)
    const { data: { subscription } } = onAuthStateChange(s => {
      setSession(s)
      if (!s) {
        // Logged out — clear data
        setData(null)
        setLoading(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    try {
      setError(null)
      const d = await db.loadAll()
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data once authenticated
  useEffect(() => {
    if (session) reload()
  }, [session, reload])

  const mutate = useCallback(fn => setData(prev => fn({ ...prev })), [])

  const setTab = useCallback(id => {
    setProjId(null)
    setShowMore(false)
    setTabRaw(id)
  }, [])

  // navigate(tab, projId) — sets tab AND project without the null reset
  const navigate = useCallback((id, pid = null) => {
    setProjId(pid)
    setShowMore(false)
    setTabRaw(id)
  }, [])

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authChecked) return (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  )

  if (!session) return <Auth onLogin={s => setSession(s)} />

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="loading-screen">
      <img src="/New_Logo.png" alt="" className="loading-logo-img loading-logo-anim" style={{ filter: 'brightness(1.4) saturate(2)' }} />
      <div className="loading-wordmark loading-text-anim">JDH <span>WOODWORKS</span></div>
    </div>
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <div className="center-screen">
      <div className="error-box">
        <h2>Connection error</h2>
        <p>Could not connect to Supabase. Check your environment variables and make sure the database tables have been created.</p>
        <div className="error-code">VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_ANON_KEY</div>
        <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</p>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={reload}>
          Try again
        </button>
      </div>
    </div>
  )

  const urgentCoats = data.coats.filter(c => coatStatus(c).urgent).length
  const urgentMaint = data.maintenance.filter(m => maintStatus(m).urgent).length
  const shopCount   = data.shopping.filter(s => !s.completed).length

  const badgeFor = id => {
    if (id === 'projects')    return urgentCoats
    if (id === 'maintenance') return urgentMaint
    if (id === 'shopping')    return shopCount
    return 0
  }

  const ctx = { data, mutate, reload, tab, setTab, navigate, projId, setProjId, theme }

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>
        <div className="app-wrapper">

          {/* ── Top bar ── */}
          <header className="top-bar" role="banner" style={{ position: 'relative' }}>
            {window.matchMedia && window.matchMedia('(pointer: fine)').matches && <ParticleNebula isDark={theme === 'dark'} />}
            <div className="top-bar-brand">
              <img src="/New_Logo.png" alt="" aria-hidden="true" className="top-bar-logo" />
              <div className="top-bar-title">JDH <span className="top-bar-accent">WOODWORKS</span></div>
            </div>
            <div className="top-bar-search-right"><GlobalSearch /></div>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark'
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              }
            </button>
          </header>

          <div className="app">
            {/* ── Sidebar ── */}
            <nav className="sidebar" aria-label="Main navigation">
              <div className="sidebar-nav">
                {NAV_SECTIONS.map((section, si) => (
                  <div key={si}>
                    {section.label && (
                      <>
                        <div className="sidebar-divider" role="separator" />
                        <span className="sidebar-section-label">{section.label}</span>
                      </>
                    )}
                    {section.items.map(t => {
                      const badge  = badgeFor(t.id)
                      const active = tab === t.id && !projId
                      return (
                        <button
                          key={t.id}
                          className={`sidebar-item ${active ? 'active' : ''}`}
                          onClick={() => setTab(t.id)}
                          aria-current={active ? 'page' : undefined}
                        >
                          <t.Icon size={16} color={active ? '#0F172A' : 'currentColor'} sw={active ? 2.2 : 1.6} />
                          {t.label}
                          {badge > 0 && <span className="sidebar-badge" aria-label={`${badge} urgent`}>{badge}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
              {/* Dev tools — sidebar only, not in mobile More menu */}
              <div style={{ padding: '4px 8px 0' }}>
                {[{ id: 'audit', label: 'Data Audit' }, { id: 'smoketest', label: 'Smoke Test' }].map(t => (
                  <button key={t.id} className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} style={{ fontSize: 12, opacity: 0.5 }}>
                    <span style={{ fontSize: 11 }}>⚙</span> {t.label}
                  </button>
                ))}
              </div>
              <div style={{ padding: '12px 8px', borderTop: '1px solid var(--sb-divider)' }}>
                <button className="sidebar-footer-btn" onClick={() => setShowFeedback(true)}>
                  <IBrain size={16} color="currentColor" sw={1.8} />
                  Send Feedback
                </button>
                <button className="sidebar-footer-btn" onClick={() => setShowQR(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
                  </svg>
                  Share Portfolio
                </button>
                <a className="sidebar-footer-btn" href="/portfolio" target="_blank" rel="noopener noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  View Portfolio
                </a>
                <button className="sidebar-footer-btn" onClick={() => signOut()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </nav>

            {/* ── Content ── */}
            <main className="main-area" id="main-content">
              <ErrorBoundary>
              {projId ? (
                <ProjectDetail />
              ) : (
                <>
                  {tab === 'home'        && <Dashboard />}
                  {tab === 'projects'    && <Projects />}
                  {tab === 'shopping'    && <Shopping />}
                  {tab === 'maintenance' && <Maintenance />}
                  {tab === 'stock'       && <Stock />}
                  {tab === 'brainstorm'  && <Brainstorm />}
                  {tab === 'finishes'    && <Finishes />}
                  {tab === 'resources'   && <Resources />}
                  {tab === 'shop'        && <ShopImprovements />}
                  {tab === 'photos'      && <AllPhotos />}
                  {tab === 'finished'    && <FinishedProducts />}
                  {tab === 'inspiration' && <Inspiration />}
                  {tab === 'stockgallery' && <div className="scroll-page" style={{paddingBottom:40}}><div className="page-header"><h1 className="page-title">Wood Stock Gallery</h1><p className="page-subtitle">Photos of raw lumber, blanks, and prep work</p></div><WoodStockGallery /></div>}
                  {tab === 'yearreview'  && <YearReview />}
                  {tab === 'settings'    && <Settings />}
                  {tab === 'ideas'       && <ProjectIdeas />}
                  {tab === 'import'      && <BulkImport />}
                  {tab === 'costs'       && <Costs />}
                  {tab === 'audit'       && <Audit />}
                  {tab === 'help'        && <Help />}
                  {tab === 'smoketest'   && <SmokeTest />}
                  {tab === 'calculators' && <Calculators />}
                </>
              )}
              </ErrorBoundary>

              {/* Mobile tab bar */}
              <nav className="tabbar" aria-label="Mobile navigation">
                {MOBILE_TABS.map(t => {
                  const isMore = t.id === 'more'
                  const active = isMore ? showMore : (tab === t.id && !projId)
                  const badge  = badgeFor(t.id)
                  return (
                    <button
                      key={t.id}
                      className={`tab-btn ${active ? 'active' : ''}`}
                      onClick={() => isMore ? setShowMore(s => !s) : setTab(t.id)}
                      aria-label={t.label}
                      aria-current={active && !isMore ? 'page' : undefined}
                    >
                      <t.Icon size={22} color={active ? 'var(--accent)' : 'var(--text-3)'} sw={active ? 2.2 : 1.6} />
                      <span>{t.label}</span>
                      {badge > 0 && <div className="tab-badge" aria-hidden="true">{badge}</div>}
                    </button>
                  )
                })}
              </nav>
            </main>
          </div>
        </div>

        {/* QR Code modal */}
        {showQR && <QRModal onClose={() => setShowQR(false)} />}
        {showFeedback && <FeedbackModal session={session} onClose={() => setShowFeedback(false)} />}
      {isOffline && (
        <div className="offline-banner">
          ⚡ Offline — showing cached data
        </div>
      )}

        {/* More sheet (mobile) */}
        {showMore && (
          <div
            className="overlay"
            onClick={() => setShowMore(false)}
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
          >
            <div className="sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <span />
                <span className="sheet-title">More</span>
                <button className="sheet-cancel" onClick={() => setShowMore(false)} aria-label="Close">
                  <IClose size={18} color="var(--text-3)" sw={2} />
                </button>
              </div>
              <div className="sheet-body">
                {/* Portfolio links */}
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <div className="more-item" style={{ borderBottom: '1px solid var(--border-2)', padding: '13px 16px' }}
                    onClick={() => { setShowMore(false); setShowFeedback(true) }} role="button" tabIndex={0}>
                    <IBrain size={20} color="var(--accent)" sw={1.8} />
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>Send Feedback</span>
                  </div>
                  <div className="more-item" style={{ borderBottom: '1px solid var(--border-2)', padding: '13px 16px' }}
                    onClick={() => { setShowMore(false); setShowQR(true) }} role="button" tabIndex={0}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                      <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>Share Portfolio</span>
                  </div>
                  <a href="/portfolio" target="_blank" rel="noopener noreferrer"
                    className="more-item"
                    style={{ borderBottom: 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px' }}
                    onClick={() => setShowMore(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>View Portfolio</span>
                  </a>
                </div>

                {/* Grouped nav sections — skip items already in tab bar */}
                {NAV_SECTIONS.map(section => {
                  const items = section.items.filter(t => !['home','projects','shopping','photos'].includes(t.id))
                  if (!items.length) return null
                  // Give the first (null-label) section a "Workshop" heading in mobile more menu
                  const label = section.label || 'Workshop'
                  return (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.8px', padding: '4px 16px 6px' }}>
                        {label}
                      </div>
                      <div className="form-group">
                        {items.map((t, i) => {
                          const badge = badgeFor(t.id)
                          return (
                            <div key={t.id} className="more-item"
                              style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '13px 16px' }}
                              onClick={() => { setTab(t.id); setShowMore(false) }}
                              role="button" tabIndex={0}
                              onKeyDown={e => e.key === 'Enter' && (setTab(t.id), setShowMore(false))}>
                              <t.Icon size={20} color="var(--accent)" sw={1.8} />
                              <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>{t.label}</span>
                              {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </ToastProvider>
    </AppCtx.Provider>
  )
}
