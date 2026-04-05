import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import * as db from './db.js'
import { getSession, signOut, onAuthStateChange } from './supabase.js'
import Auth from './pages/Auth.jsx'
import { ToastProvider } from './components/Toast.jsx'
import GlobalSearch from './components/Search.jsx'
import {
  IFolder, ICart, IWrench, ICamera, ITree, IBulb,
  IBook, IHouse, IImage, ILayers, IMore, IClose,
  coatStatus, maintStatus,
} from './components/Shared.jsx'

// Pages
import Dashboard        from './pages/Dashboard.jsx'
import Projects, { ProjectDetail } from './pages/Projects.jsx'
import Shopping         from './pages/Shopping.jsx'
import Maintenance      from './pages/Maintenance.jsx'
import Stock            from './pages/Stock.jsx'
import Brainstorm       from './pages/Brainstorm.jsx'
import Finishes         from './pages/Finishes.jsx'
import Resources        from './pages/Resources.jsx'
import ShopImprovements from './pages/ShopImprovements.jsx'
import AllPhotos        from './pages/Photos.jsx'
import FinishedProducts from './pages/FinishedProducts.jsx'
import Inspiration      from './pages/Inspiration.jsx'
import YearReview      from './pages/YearReview.jsx'
import Settings       from './pages/Settings.jsx'
import BulkImport     from './pages/BulkImport.jsx'
import Audit          from './pages/Audit.jsx'

// ─── Context ──────────────────────────────────────────────────────────────────
const AppCtx = createContext(null)
export const useCtx = () => useContext(AppCtx)

// ─── Navigation config ────────────────────────────────────────────────────────
const MAIN_NAV = [
  { id: 'home',        label: 'Home',             Icon: IHouse   },
  { id: 'projects',    label: 'Projects',          Icon: IFolder  },
  { id: 'stock',       label: 'Wood Stock',        Icon: ITree    },
  { id: 'finishes',    label: 'Finishes',          Icon: ILayers  },
  { id: 'maintenance', label: 'Maintenance',       Icon: IWrench  },
  { id: 'shop',        label: 'Shop Improvements', Icon: IHouse   },
  { id: 'shopping',    label: 'Shopping List',     Icon: ICart    },
  { id: 'resources',   label: 'Resources',         Icon: IBook    },
  { id: 'brainstorm',  label: 'Brainstorm',        Icon: IBulb    },
  { id: 'yearreview',  label: 'Year in Review',    Icon: IBulb    },
  { id: 'audit',       label: 'Data Audit',         Icon: IWrench  },
  { id: 'settings',    label: 'Settings',          Icon: IWrench  },
  { id: 'import',      label: 'Bulk Import',       Icon: ICamera  },
]

const GALLERY_NAV = [
  { id: 'photos',      label: 'All Photos',    Icon: ICamera },
  { id: 'finished',    label: 'Finished Work', Icon: IImage  },
  { id: 'inspiration', label: 'Inspiration',   Icon: IBulb   },
]

const MOBILE_TABS = [
  { id: 'home',     label: 'Home',     Icon: IHouse  },
  { id: 'projects', label: 'Projects', Icon: IFolder },
  { id: 'shopping', label: 'Shop',     Icon: ICart   },
  { id: 'photos',   label: 'Photos',   Icon: ICamera },
  { id: 'more',     label: 'More',     Icon: IMore   },
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
        <svg width="36" height="32" viewBox="0 0 80 72" fill="none">
          <path d="M10 52 L28 24 L40 38 L52 18 L70 52 Z" fill="#2D5A3D" opacity="0.85"/>
          <path d="M10 52 L28 24 L40 38" fill="#1C3A2A"/>
          <path d="M15 60 Q40 52 65 60" stroke="#4A7A5A" strokeWidth="1.2" fill="none" opacity="0.6"/>
          <path d="M12 65 Q40 57 68 65" stroke="#4A7A5A" strokeWidth="1.2" fill="none" opacity="0.45"/>
          <path d="M10 70 Q40 62 70 70" stroke="#4A7A5A" strokeWidth="1.2" fill="none" opacity="0.3"/>
        </svg>

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
export default function App() {
  const [session, setSession]   = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [tab, setTabRaw]        = useState('home')
  const [projId, setProjId]     = useState(null)
  const [showMore, setShowMore] = useState(false)
  const [showQR, setShowQR] = useState(false)

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

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!authChecked) return (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  )

  if (!session) return <Auth onLogin={s => setSession(s)} />

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="center-screen">
      <img src="/logo.png" style={{ width: 72, height: 72, marginBottom: 12, opacity: .6 }} alt="" />
      <div className="spinner" />
      <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading workshop…</p>
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

  const ctx = { data, mutate, reload, tab, setTab, projId, setProjId }

  return (
    <AppCtx.Provider value={ctx}>
      <ToastProvider>
        <div className="app-wrapper">

          {/* ── Top bar ── */}
          <header className="top-bar" role="banner">
            <div className="top-bar-brand" style={{flex:1}}>
              {/* Mountain Grain logo - L12 */}
              <svg width="48" height="48" viewBox="0 0 80 72" fill="none" aria-hidden="true" style={{flexShrink:0}}>
                <path d="M10 52 L28 24 L40 38 L52 18 L70 52 Z" fill="#2D5A3D" opacity="0.85"/>
                <path d="M10 52 L28 24 L40 38" fill="#1C3A2A"/>
                <path d="M15 60 Q40 52 65 60" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.6"/>
                <path d="M12 65 Q40 57 68 65" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.45"/>
                <path d="M10 70 Q40 62 70 70" stroke="#4A7A5A" strokeWidth="0.9" fill="none" opacity="0.3"/>
              </svg>
              <div className="top-bar-title">JDH <span className="top-bar-accent">WOODWORKS</span></div>
            </div>
            <GlobalSearch />
          </header>

          <div className="app">
            {/* ── Sidebar ── */}
            <nav className="sidebar" aria-label="Main navigation">
              <div className="sidebar-nav">
                {MAIN_NAV.map(t => {
                  const badge  = badgeFor(t.id)
                  const active = tab === t.id && !projId
                  return (
                    <button
                      key={t.id}
                      className={`sidebar-item ${active ? 'active' : ''}`}
                      onClick={() => setTab(t.id)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <t.Icon size={16} color={active ? "#0F172A" : "currentColor"} sw={active ? 2.2 : 1.6} />
                      {t.label}
                      {badge > 0 && <span className="sidebar-badge" aria-label={`${badge} urgent`}>{badge}</span>}
                    </button>
                  )
                })}

                <div className="sidebar-divider" role="separator" />
                <span className="sidebar-section-label">Gallery</span>

                {GALLERY_NAV.map(t => {
                  const active = tab === t.id && !projId
                  return (
                    <button
                      key={t.id}
                      className={`sidebar-item ${active ? 'active' : ''}`}
                      onClick={() => setTab(t.id)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <t.Icon size={16} color={active ? "#0F172A" : "currentColor"} sw={active ? 2.2 : 1.6} />
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <button
                  onClick={() => setShowQR(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 10px',
                    background: 'transparent', border: 'none',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: 'rgba(203,213,225,.6)',
                    fontFamily: 'inherit', marginBottom: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(203,213,225,.6)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
                  </svg>
                  Share Portfolio
                </button>
                <a
                  href="/portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 10px',
                    background: 'transparent', border: 'none',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: 'rgba(203,213,225,.6)',
                    fontFamily: 'inherit', textDecoration: 'none',
                    marginBottom: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(203,213,225,.6)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Public Portfolio
                </a>
                <button
                  onClick={() => signOut()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 10px',
                    background: 'transparent', border: 'none',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500,
                    color: 'rgba(203,213,225,.6)',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(203,213,225,.6)'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                  {tab === 'yearreview'  && <YearReview />}
                  {tab === 'settings'    && <Settings />}
                  {tab === 'import'      && <BulkImport />}
                  {tab === 'audit'       && <Audit />}
                </>
              )}

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
                <div className="form-group">
                  <div
                    className="more-item"
                    style={{ borderBottom: '1px solid var(--border-2)' }}
                    onClick={() => { setShowMore(false); setShowQR(true) }}
                    role="button" tabIndex={0}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                      <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
                    </svg>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>Share Portfolio</span>
                  </div>
                  {[...MAIN_NAV.slice(2), ...GALLERY_NAV].map((t, i, arr) => {
                    const badge = badgeFor(t.id)
                    return (
                      <div
                        key={t.id}
                        className="more-item"
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none' }}
                        onClick={() => setTab(t.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && setTab(t.id)}
                      >
                        <t.Icon size={20} color="var(--accent)" sw={1.8} />
                        <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>{t.label}</span>
                        {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </ToastProvider>
    </AppCtx.Provider>
  )
}
