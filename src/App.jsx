import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import * as db from './db.js'
import { ToastProvider } from './components/Toast.jsx'
import GlobalSearch from './components/Search.jsx'
import {
  IFolder, ICart, IWrench, ICamera, ITree, IBulb,
  IBook, IHouse, IImage, ILayers, IMore, IClose,
  coatStatus, maintStatus,
} from './components/Shared.jsx'

// Pages
import Home             from './pages/Home.jsx'
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [tab, setTabRaw]        = useState('home')
  const [projId, setProjId]     = useState(null)
  const [showMore, setShowMore] = useState(false)

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

  useEffect(() => { reload() }, [reload])

  const mutate = useCallback(fn => setData(prev => fn({ ...prev })), [])

  const setTab = useCallback(id => {
    setProjId(null)
    setShowMore(false)
    setTabRaw(id)
  }, [])

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
            <div className="top-bar-brand">
              <img src="/logo.png" className="top-bar-logo" alt="JDH Woodworks" />
              <span className="top-bar-title">JDH <span className="top-bar-accent">Woodworks</span></span>
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
