import React from 'react'
import { useState, useEffect, useCallback, useRef, createContext, useContext, lazy, Suspense } from 'react'
import { seedSampleData, clearSampleData, getSampleIds } from './seed.js'
import * as db from './db.js'
import { supabase, getSession, signOut, onAuthStateChange } from './supabase.js'
import Auth from './pages/Auth.jsx'
import { ToastProvider } from './components/Toast.jsx'
import GlobalSearch from './components/Search.jsx'
import Onboarding from './components/Onboarding.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
import {
  IFolder, ICart, IWrench, ICamera, ITree, IBulb, ICalc,
  IStar, ICheck, IGrid, IIdea, IBrain, IDollar, ITrash, IBell,
  IBook, IHouse, IImage, ILayers, IMore, IClose,
  coatStatus, maintStatus,
} from './components/Shared.jsx'

// Pages — eager (core tabs)
import Dashboard       from './pages/Dashboard.jsx'
import Projects        from './pages/Projects.jsx'
import { ProjectDetail } from './pages/ProjectDetail.jsx'
import Shopping         from './pages/Shopping.jsx'
import Maintenance      from './pages/Maintenance.jsx'
import Stock, { WoodStockGallery } from './pages/Stock.jsx'
import Brainstorm       from './pages/Brainstorm.jsx'
import Finishes         from './pages/Finishes.jsx'
import Resources        from './pages/Resources.jsx'
import ShopTools from './pages/ShopTools.jsx'
import AllPhotos        from './pages/Photos.jsx'
import FinishedProducts from './pages/FinishedProducts.jsx'
import Inspiration      from './pages/Inspiration.jsx'
import ProjectIdeas     from './pages/ProjectIdeas.jsx'
import YearReview       from './pages/YearReview.jsx'
import Costs            from './pages/Costs.jsx'
import Settings         from './pages/Settings.jsx'
import BulkImport       from './pages/BulkImport.jsx'
import Audit            from './pages/Audit.jsx'
import Help             from './pages/Help.jsx'
import SmokeTest        from './pages/SmokeTest.jsx'
import BetaQuestionnaire from './pages/BetaQuestionnaire.jsx'
import Calculators      from './pages/Calculators.jsx'
import Trash            from './pages/Trash.jsx'
import Privacy          from './pages/Privacy.jsx'
import Tutorial, { useTutorialCheck } from './components/Tutorial.jsx'
import ErrorBoundary  from './components/ErrorBoundary.jsx'

// ─── Context ──────────────────────────────────────────────────────────────────
const AppCtx = createContext(null)
export const useCtx = () => useContext(AppCtx)

// ─── Navigation config ────────────────────────────────────────────────────────
// ── Sectioned navigation ────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null, // "Build" in more menu
    items: [
      { id: 'home',        label: 'Home',             Icon: IHouse  },
      { id: 'projects',    label: 'Projects',          Icon: IFolder },
      { id: 'ideas',       label: 'Project Ideas',     Icon: IIdea   },
      { id: 'shopping',    label: 'Shopping List',     Icon: ICart   },
      { id: 'stock',       label: 'Wood Stock',        Icon: ITree   },
    ],
  },
  {
    label: 'Explore',
    items: [
      { id: 'photos',      label: 'All Photos',        Icon: ICamera },
      { id: 'finished',    label: 'Finished Work',     Icon: IImage  },
      { id: 'inspiration', label: 'Inspiration Photos', Icon: IBulb   },
      { id: 'brainstorm',  label: 'Brainstorm',        Icon: IBrain  },
      { id: 'yearreview',  label: 'Year in Review',    Icon: IStar   },
    ],
  },
  {
    label: 'Workshop',
    items: [
      { id: 'shoptools',   label: 'Shop & Tools',      Icon: IWrench },
      { id: 'calculators', label: 'Calculators',        Icon: ICalc   },
      { id: 'finishes',    label: 'Finishes',          Icon: ILayers },
      { id: 'resources',   label: 'Resources',         Icon: IBook   },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'settings',    label: 'Settings',           Icon: IWrench },
      { id: 'costs',       label: 'Costs',             Icon: IDollar },
      { id: 'import',      label: 'Bulk Import',       Icon: ICamera },
      { id: 'trash',       label: 'Recycling Bin',     Icon: ITrash  },
      { id: 'beta',        label: 'Feedback',          Icon: IBell   },
      { id: 'help',        label: 'Help',              Icon: IBook   },
    ],
  },
]

// Flat list for mobile "more" menu and badge lookups
const ALL_NAV = NAV_SECTIONS.flatMap(s => s.items)

// Mobile More menu — only show essentials (desktop sidebar shows everything)
const MOBILE_MORE_IDS = new Set([
  'ideas', 'shopping', 'stock', 'shoptools', 'shoptools',
  'finishes', 'finished',
  'settings', 'help',
])


const MOBILE_TABS = [
  { id: 'home',        label: 'Home',     Icon: IHouse  },
  { id: 'projects',    label: 'Projects', Icon: IFolder },
  { id: 'calculators', label: 'Calc',     Icon: ICalc   },
  { id: 'photos',      label: 'Photos',   Icon: ICamera },
  { id: 'more',        label: 'More',     Icon: IMore   },
]



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
                const btn = document.activeElement
                if (btn) { const orig = btn.textContent; btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = orig, 1500) }
              }
            }}
            style={{
              flex: 1, padding: '11px', background: '#2D5A3D', color: '#fff',
              border: 'none', borderRadius: 0, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Share
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px', background: '#0F1E38', color: '#fff',
              border: 'none', borderRadius: 0, fontSize: 15, fontWeight: 700,
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

// ── Set Password Screen (for invited users) ──────────────────────────────────
function SetPasswordScreen({ session, onComplete }) {
  const [displayName, setDisplayName] = useState('')
  const [pw, setPw]           = useState('')
  const [pw2, setPw2]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!displayName.trim()) { setError('Please enter your name'); return }
    if (pw.length < 6) { setError('Password must be at least 6 characters'); return }
    if (pw !== pw2) { setError('Passwords do not match'); return }
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.updateUser({
      password: pw,
      data: { display_name: displayName.trim() }
    })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      onComplete()
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', fontSize: 15,
    border: '1px solid #E2E8F0', borderRadius: 8,
    fontFamily: 'inherit', outline: 'none',
    background: '#fff', color: '#0F172A',
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(rgba(15,30,56,.82), rgba(15,30,56,.88)), url(/shavings.jpg) center/cover no-repeat',
    }}>
      <div style={{
        background: 'rgba(255,255,255,.97)', borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(0,0,0,.25)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="40" height="40" viewBox="0 0 80 72" fill="none">
            <path d="M10 52 L28 24 L40 38 L52 18 L70 52 Z" fill="#2D5A3D" opacity="0.85"/>
            <path d="M10 52 L28 24 L40 38" fill="#1C3A2A"/>
            <path d="M15 60 Q40 52 65 60" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.6"/>
            <path d="M12 65 Q40 57 68 65" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.45"/>
            <path d="M10 70 Q40 62 70 70" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.3"/>
          </svg>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.3px', color: '#1a1a1a' }}>
            JDH <span style={{ color: '#2D5A3D' }}>WOODWORKS</span>
          </div>
        </div>

        <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>Welcome!</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 24 }}>
          Set a password to finish setting up your account.
          {session?.user?.email && (
            <span style={{ display: 'block', marginTop: 4, fontWeight: 600, color: '#374151' }}>{session.user.email}</span>
          )}
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Your name
            </label>
            <input
              type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="John Hyde"
              autoComplete="name" autoFocus required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#2D5A3D'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password" autoFocus required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#2D5A3D'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Confirm password
            </label>
            <input
              type="password" value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="Type it again"
              autoComplete="new-password" required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#2D5A3D'}
              onBlur={e => e.target.style.borderColor = '#E2E8F0'}
            />
          </div>

          {error && (
            <div style={{
              background: '#FEE2E2', color: '#B91C1C', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
            background: loading ? '#9CA3AF' : '#2D5A3D',
            color: '#fff', border: 'none', borderRadius: 0,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', letterSpacing: '.2px',
            transition: 'background 150ms',
          }}>
            {loading ? 'Setting up…' : 'Set Password & Continue'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 16, textAlign: 'center' }}>
          You'll use this email and password to sign in next time.
        </p>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

// ── ParticleNebula removed — replaced by shavings.jpg nav bar texture ────────

export default function App() {
  const [session, setSession]   = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [loadPhase, setLoadPhase] = useState('show') // 'show' | 'exit' | null
  const [sampleIds, setSampleIds] = useState(null)
  const [error, setError]       = useState(null)
  const [tab, setTabRaw]        = useState('home')
  const [tabKey, setTabKey]     = useState(0)
  const [tabDir, setTabDir]     = useState('right')
  const [projId, setProjId]     = useState(null)
  const [tabAction, setTabAction] = useState(null)
  const navStack  = useRef([])    // in-app back navigation history
  const loadedRef = useRef(false) // prevents duplicate data loads
  const [showMore, setShowMore]             = useState(false)
  const [theme, setTheme]                   = useState(() => {
    try { return localStorage.getItem('jdh-theme') || 'dark' } catch { return 'dark' }
  })
  const [showQR, setShowQR]                 = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isOffline, setIsOffline]           = useState(!navigator.onLine)
  const [needsPassword, setNeedsPassword]   = useState(false)

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('jdh-theme', theme) } catch {}
  }, [theme])

  // Detect standalone PWA mode (iOS fallback)
  useEffect(() => {
    if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
      document.documentElement.classList.add('pwa-standalone')
    }
  }, [])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  // ── In-app back navigation ────────────────────────────────────────────────
  const goBack = useCallback(() => {
    const prev = navStack.current.pop()
    if (!prev) return false
    setTabDir('left')
    setTabKey(k => k + 1)
    setTabRaw(prev.tab)
    setProjId(prev.projId)
    setShowMore(prev.showMore)
    return true
  }, [])

  useEffect(() => {
    try { window.history.replaceState({ jdh: 0 }, '') } catch {}
    const onPopState = () => {
      const didGoBack = goBack()
      if (didGoBack) {
        try { window.history.pushState({ jdh: navStack.current.length }, '') } catch {}
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [goBack])

  const { showTutorial, dismissTutorial, launchTutorial } = useTutorialCheck()

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
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe
    // — no need for a separate getSession() call (which caused duplicate loads)
    const { data: { subscription } } = onAuthStateChange((s, event) => {
      setSession(s)
      setAuthChecked(true)
      // Detect invite or recovery — user needs to set password
      if (s && (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery'))) {
        setNeedsPassword(true)
        // Clean the URL hash so it doesn't re-trigger
        window.history.replaceState({}, '', window.location.pathname)
      }
      if (!s) {
        // Logged out — clear data
        setData(null)
        setLoading(true)
        setLoadPhase('show')
      }
    })
    // Also check hash on initial load
    if (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')) {
      setNeedsPassword(true)
    }
    return () => subscription.unsubscribe()
  }, [])

  const reload = useCallback(async () => {
    const minTime = new Promise(r => setTimeout(r, 1500))
    try {
      setError(null)
      const [d] = await Promise.all([db.loadAll(), minTime])

      // Always set data first — app loads regardless of seed outcome
      setData(d)

      // Seed check for new users (non-blocking — failures don't prevent app load)
      try {
        const s = await getSession()
        const isNew = s?.user && !s.user.user_metadata?.seeded_at && d.projects.length === 0
        const notOnboarded = s?.user && !s.user.user_metadata?.onboarded_at
        if (isNew) {
          const ids = await seedSampleData()
          if (ids) {
            setSampleIds(ids)
            const d2 = await db.loadAll()
            setData(d2)
          }
        } else {
          setSampleIds(s?.user?.user_metadata?.sample_ids || null)
        }
        // Show onboarding if never seen
        if (notOnboarded) setShowOnboarding(true)
      } catch (seedErr) {
        console.error('Seed check:', seedErr)
      }

      setLoadPhase('exit')
      setTimeout(() => setLoadPhase(null), 400)
    } catch (e) {
      setError(e.message)
      setLoadPhase(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data once authenticated (loadedRef prevents duplicate loads from auth listener firing multiple times)
  useEffect(() => {
    if (session && !loadedRef.current) {
      loadedRef.current = true
      reload()
    }
    if (!session) {
      loadedRef.current = false
    }
  }, [session, reload])

  const mutate = useCallback(fn => setData(prev => fn({ ...prev })), [])

  // Push current location onto stack before navigating
  const pushNav = useCallback((fromTab, fromProjId, fromMore) => {
    navStack.current.push({ tab: fromTab, projId: fromProjId, showMore: fromMore })
  }, [])

  const setTab = useCallback(id => {
    const allIds  = ALL_NAV.map(t => t.id)
    const fromIdx = allIds.indexOf(tab)
    const toIdx   = allIds.indexOf(id)
    setTabDir(toIdx >= fromIdx || fromIdx === -1 ? 'right' : 'left')
    setTabKey(k => k + 1)
    pushNav(tab, projId, showMore)
    try { window.history.pushState({ jdh: navStack.current.length }, '') } catch {}
    setProjId(null)
    setShowMore(false)
    setTabRaw(id)
  }, [tab, projId, showMore, pushNav])

  // navigate(tab, projId) — sets tab AND project without the null reset
  const navigate = useCallback((id, pid = null) => {
    pushNav(tab, projId, showMore)
    try { window.history.pushState({ jdh: navStack.current.length }, '') } catch {}
    setProjId(pid)
    setShowMore(false)
    setTabRaw(id)
  }, [tab, projId, showMore, pushNav])

  const handleClearSamples = useCallback(async () => {
    await clearSampleData()
    setSampleIds(null)
    try { const d = await db.loadAll(); setData(d) } catch {}
  }, [])

  const openProject = useCallback(id => {
    if (id) {
      pushNav(tab, projId, showMore)
      try { window.history.pushState({ jdh: navStack.current.length }, '') } catch {}
    }
    setProjId(id)
  }, [tab, projId, showMore, pushNav])

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authChecked) return (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  )

  if (!session) return <Auth onLogin={s => setSession(s)} />

  // ── Invite: set password ────────────────────────────────────────────────
  if (needsPassword) return (
    <SetPasswordScreen
      session={session}
      onComplete={() => { setNeedsPassword(false); window.location.hash = '' }}
    />
  )

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadPhase) return (
    <div className={`loading-screen ${loadPhase === 'exit' ? 'loading-exit' : ''}`}>
      <img src="/New_Logo.png" alt="" className="loading-logo-img" />
      <div className="loading-wordmark">JDH <span>WOODWORKS</span></div>
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
  const trashCount  = (data.trash || []).length

  const badgeFor = id => {
    if (id === 'projects')    return urgentCoats
    if (id === 'maintenance') return urgentMaint
    if (id === 'shoptools') return urgentMaint
    if (id === 'shopping')    return shopCount
    if (id === 'trash')       return trashCount
    return 0
  }

  const ctx = { data, mutate, reload, tab, setTab, navigate, projId, setProjId: openProject, theme, launchTutorial, sampleIds, tabAction, setTabAction }

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>
        <div className="app-wrapper">
          <a href="#main-content" className="skip-link">Skip to content</a>
          {/* ── Top bar ── */}
          <header className="top-bar" role="banner">
            <div className="top-bar-brand" data-tutorial-target="app-logo">
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
              {/* Dev tools — owner only, sidebar only */}
              {session?.user?.id === '956f2bdd-022b-4e17-8ec9-47246a18e152' && (
              <div style={{ padding: '4px 8px 0' }}>
                {[{ id: 'audit', label: 'Data Audit' }, { id: 'smoketest', label: 'Smoke Test' }].map(t => (
                  <button key={t.id} className={`sidebar-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)} style={{ fontSize: 12, opacity: 0.5 }}>
                    <span style={{ fontSize: 11 }}>⚙</span> {t.label}
                  </button>
                ))}
              </div>
              )}
              <div style={{ padding: '12px 8px', borderTop: '1px solid var(--sb-divider)' }}>
                <button className="sidebar-footer-btn" onClick={() => setTab('beta')}>
                  <IBrain size={16} color="currentColor" sw={1.8} />
                  Feedback
                </button>
                <button className="sidebar-footer-btn" onClick={launchTutorial}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  </svg>
                  Take the Tour
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
                <button className="sidebar-footer-btn" onClick={() => setTab('privacy')} style={{ opacity: 0.55, fontSize: 11 }}>
                  Privacy Policy
                </button>
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
                <div key={tabKey} className="tab-panel">
                  {tab === 'home'        && <>
                    {sampleIds?.projectId && (
                      <div className="sample-banner">
                        <div className="sample-banner-text">
                          <span style={{ marginRight: 8, display: 'flex', alignItems: 'center' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                          </span>
                          <span>Sample data is loaded to help you explore. Add your own projects, then clear the samples when ready.</span>
                        </div>
                        <button className="sample-clear-btn" onClick={handleClearSamples}>Clear sample data</button>
                      </div>
                    )}
                    <Dashboard />
                  </>}
                  {tab === 'projects'    && <Projects />}
                  {tab === 'shopping'    && <Shopping />}
                  {tab === 'maintenance' && <Maintenance />}
                  {tab === 'shoptools'   && <ShopTools />}
                  {tab === 'stock'       && <Stock />}
                  {tab === 'brainstorm'  && <Brainstorm />}
                  {tab === 'finishes'    && <Finishes />}
                  {tab === 'resources'   && <Resources />}
                  
                  {tab === 'photos'      && <AllPhotos />}
                  {tab === 'finished'    && <FinishedProducts />}
                  {tab === 'inspiration' && <Inspiration />}
                  {tab === 'stockgallery' && <div className="scroll-page" style={{paddingBottom:40}}><div className="page-header"><h1 className="page-title">Wood Stock Gallery</h1><p className="page-subtitle">Photos of raw lumber, blanks, and prep work</p></div><WoodStockGallery /></div>}
                  {tab === 'ideas'       && <ProjectIdeas />}
                  {tab === 'yearreview'  && <YearReview />}
                  {tab === 'settings'    && <Settings />}
                  {tab === 'import'      && <BulkImport />}
                  {tab === 'costs'       && <Costs />}
                  {tab === 'audit'       && session?.user?.id === '956f2bdd-022b-4e17-8ec9-47246a18e152' && <Audit />}
                  {tab === 'help'        && <Help />}
                  {tab === 'beta'        && <BetaQuestionnaire />}
                  {tab === 'smoketest'   && session?.user?.id === '956f2bdd-022b-4e17-8ec9-47246a18e152' && <SmokeTest />}
                  {tab === 'calculators' && <Calculators />}
                  {tab === 'trash'       && <Trash />}
                  {tab === 'privacy'     && <Privacy />}
                </div>
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
                      onClick={() => {
                        if (isMore) {
                          if (!showMore) { pushNav(tab, projId, false); try { window.history.pushState({ jdh: navStack.current.length }, '') } catch {} }
                          setShowMore(s => !s)
                        } else if (tab === t.id && !projId) {
                          // Re-tap active tab — scroll to top (iOS convention)
                          const el = document.querySelector('.tab-panel .scroll-page') || document.querySelector('.scroll-page')
                          if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
                        } else {
                          setTab(t.id)
                        }
                      }}
                      aria-label={t.label}
                      aria-current={active && !isMore ? 'page' : undefined}
                    >
                      <t.Icon size={22} color={active ? 'var(--accent)' : 'var(--c-text-muted)'} sw={active ? 2.2 : 1.6} />
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
        {showTutorial && <Tutorial onClose={dismissTutorial} setTab={setTab} />}
        {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}
        <InstallPrompt />
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
            ref={el => {
              if (!el) return
              // Focus trap
              const focusable = el.querySelectorAll('button, [role="button"], [tabindex="0"], a, input, select, textarea')
              if (focusable.length) focusable[0].focus()
              const trap = e => {
                if (e.key === 'Escape') { setShowMore(false); return }
                if (e.key !== 'Tab') return
                const first = focusable[0], last = focusable[focusable.length - 1]
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
              }
              el.addEventListener('keydown', trap)
              el._cleanup = () => el.removeEventListener('keydown', trap)
            }}
          >
            <div className="sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-handle" />
              <div className="sheet-header">
                <span />
                <span className="sheet-title">More</span>
                <button type="button" className="sheet-cancel" onClick={() => setShowMore(false)} aria-label="Close">
                  <IClose size={18} color="var(--c-text-muted)" sw={2} />
                </button>
              </div>
              <div className="sheet-body">
                {/* Portfolio links */}
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <div className="more-item" style={{ borderBottom: '1px solid var(--c-border-light)', padding: '13px 16px' }}
                    onClick={() => { setShowMore(false); setTab('beta') }} role="button" tabIndex={0}>
                    <IBrain size={20} color="var(--accent)" sw={1.8} />
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Feedback</span>
                  </div>
                  <div className="more-item" style={{ borderBottom: '1px solid var(--c-border-light)', padding: '13px 16px' }}
                    onClick={() => { setShowMore(false); setShowQR(true) }} role="button" tabIndex={0}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                      <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Share Portfolio</span>
                  </div>
                  <a href="/portfolio" target="_blank" rel="noopener noreferrer"
                    className="more-item"
                    style={{ borderBottom: 'none', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px' }}
                    onClick={() => setShowMore(false)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>View Portfolio</span>
                  </a>
                </div>

                {/* Grouped nav sections — mobile shows essentials only */}
                {NAV_SECTIONS.map(section => {
                  const items = section.items.filter(t =>
                    !['home','projects','calculators','photos'].includes(t.id) && MOBILE_MORE_IDS.has(t.id)
                  )
                  if (!items.length) return null
                  // Give the first (null-label) section a "Workshop" heading in mobile more menu
                  const label = section.label || 'Build'
                  return (
                    <div key={label} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-faint)', textTransform: 'uppercase', letterSpacing: '.8px', padding: '4px 16px 6px' }}>
                        {label}
                      </div>
                      <div className="form-group">
                        {items.map((t, i) => {
                          const badge = badgeFor(t.id)
                          return (
                            <div key={t.id} className="more-item"
                              style={{ borderBottom: i < items.length - 1 ? '1px solid var(--c-border-light)' : 'none', padding: '13px 16px' }}
                              onClick={() => { setTab(t.id); setShowMore(false) }}
                              role="button" tabIndex={0}
                              onKeyDown={e => e.key === 'Enter' && (setTab(t.id), setShowMore(false))}>
                              <t.Icon size={20} color="var(--accent)" sw={1.8} />
                              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>{t.label}</span>
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
