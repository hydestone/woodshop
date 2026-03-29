import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import * as db from './db.js'

import Home             from './pages/Home.jsx'
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

import {
  IFolder, ICart, IWrench, ICamera,
  ITree, IBulb, IBook, IShop, IPhoto, IFinish, IMore, IX,
  coatStatus, maintStatus
} from './components/Shared.jsx'

const Ctx = createContext(null)
export const useCtx = () => useContext(Ctx)

// Sidebar: items before Gallery divider
const MAIN_TABS = [
  { id: 'home',        label: 'Home',             Icon: IPhoto },
  { id: 'projects',    label: 'Projects',          Icon: IFolder },
  { id: 'stock',       label: 'Wood Stock',        Icon: ITree },
  { id: 'finishes',    label: 'Finishes',          Icon: IFinish },
  { id: 'maintenance', label: 'Maintenance',       Icon: IWrench },
  { id: 'shop',        label: 'Shop Improvements', Icon: IShop },
  { id: 'shopping',    label: 'Shopping List',     Icon: ICart },
  { id: 'resources',   label: 'Resources',         Icon: IBook },
  { id: 'brainstorm',  label: 'Brainstorm',        Icon: IBulb },
]

// Gallery section
const GALLERY_TABS = [
  { id: 'photos',      label: 'All Photos',    Icon: ICamera },
  { id: 'finished',    label: 'Finished Work', Icon: IPhoto },
  { id: 'inspiration', label: 'Inspiration',   Icon: IBulb },
]

export default function App() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [tab, setTabState]      = useState('home')
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
  const mutate = useCallback(fn => setData(prev => fn(prev)), [])

  const setTab = useCallback((id) => {
    setProjId(null)
    setShowMore(false)
    setTabState(id)
  }, [])

  if (loading) return (
    <div className="center-screen">
      <img src="/logo.png" style={{ width: 80, height: 80, marginBottom: 16, opacity: .5, filter: "brightness(0)" }} alt="" />
      <div className="spinner" />
      <p style={{ color: 'var(--text3)', fontSize: 14 }}>Loading workshop…</p>
    </div>
  )

  if (error) return (
    <div className="center-screen">
      <div className="error-box">
        <h2>Connection error</h2>
        <p>Could not connect to Supabase. Check your environment variables.</p>
        <div className="error-code">VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_ANON_KEY</div>
        <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>{error}</p>
        <button className="btn-primary" style={{ width: '100%' }} onClick={reload}>Try again</button>
      </div>
    </div>
  )

  const urgentCoats = data.coats.filter(c => coatStatus(c).urgent).length
  const urgentMaint = data.maintenance.filter(m => maintStatus(m).urgent).length
  const shopCount   = data.shopping.filter(s => !s.completed).length

  const badgeFor = (id) => {
    if (id === 'projects')    return urgentCoats
    if (id === 'maintenance') return urgentMaint
    if (id === 'shopping')    return shopCount
    return 0
  }

  const ctx = { data, mutate, reload, tab, setTab, projId, setProjId }

  const SidebarItem = ({ t }) => {
    const badge  = badgeFor(t.id)
    const active = tab === t.id && !projId
    return (
      <button className={`sidebar-item ${active ? 'active' : ''}`} onClick={() => setTab(t.id)}>
        <t.Icon size={16} c="currentColor" sw={active ? 2.2 : 1.6} />
        {t.label}
        {badge > 0 && <span className="sidebar-badge">{badge}</span>}
      </button>
    )
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className="app-wrapper">

        {/* Full-width top bar */}
        <div className="top-bar">
          <img src="/logo.png" className="top-bar-logo" alt="JDH Woodworks" />
          <span className="top-bar-title">JDH WOODWORKS</span>
        </div>

        <div className="app">
          {/* Desktop sidebar */}
          <nav className="sidebar">
            <div style={{ padding: '12px 8px' }}>
              {MAIN_TABS.map(t => <SidebarItem key={t.id} t={t} />)}
            </div>

            {/* Gallery divider */}
            <div style={{ margin: '8px 16px', borderTop: '1px solid rgba(139,168,208,.2)' }} />
            <div style={{ padding: '8px 8px 12px' }}>
              <span className="sidebar-section-label" style={{ marginBottom: 6 }}>Gallery</span>
              {GALLERY_TABS.map(t => <SidebarItem key={t.id} t={t} />)}
            </div>
          </nav>

          {/* Content */}
          <div className="main-area">
            {projId ? (
              <ProjectDetail />
            ) : (
              <>
                {tab === 'home'        && <Home />}
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
              </>
            )}

            {/* Mobile tab bar */}
            <div className="tabbar">
              {[
                { id: 'home',     label: 'Home',     Icon: IPhoto },
                { id: 'projects', label: 'Projects', Icon: IFolder, badge: urgentCoats },
                { id: 'shopping', label: 'Shop',     Icon: ICart,   badge: shopCount },
                { id: 'photos',   label: 'Photos',   Icon: ICamera },
                { id: 'more',     label: 'More',     Icon: IMore },
              ].map(t => {
                const isMore = t.id === 'more'
                const active = isMore ? showMore : (tab === t.id && !projId)
                return (
                  <button key={t.id} className={`tab-btn ${active ? 'active' : ''}`}
                    onClick={() => isMore ? setShowMore(s => !s) : setTab(t.id)}>
                    <t.Icon size={22} c={active ? 'var(--blue)' : 'var(--text3)'} sw={active ? 2.2 : 1.6} />
                    <span>{t.label}</span>
                    {t.badge > 0 && <div className="tab-badge">{t.badge}</div>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* More sheet (mobile) */}
      {showMore && (
        <div className="overlay" onClick={() => setShowMore(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span />
              <span className="sheet-title">More</span>
              <button className="sheet-cancel" onClick={() => setShowMore(false)}><IX size={18} c="var(--text3)" sw={2} /></button>
            </div>
            <div className="sheet-body" style={{ paddingBottom: 20 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', border: '.5px solid var(--sep2)', marginBottom: 16 }}>
                {[...MAIN_TABS.slice(2)].map((t, i, arr) => {
                  const badge = badgeFor(t.id)
                  return (
                    <div key={t.id} className="more-item"
                      style={{ borderBottom: i < arr.length - 1 ? '.5px solid var(--sep2)' : 'none' }}
                      onClick={() => setTab(t.id)}>
                      <t.Icon size={20} c="var(--blue)" sw={1.8} />
                      <span style={{ fontSize: 16, flex: 1 }}>{t.label}</span>
                      {badge > 0 && <span className="sidebar-badge">{badge}</span>}
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, padding: '0 4px' }}>Gallery</p>
              <div style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', border: '.5px solid var(--sep2)' }}>
                {GALLERY_TABS.map((t, i) => (
                  <div key={t.id} className="more-item"
                    style={{ borderBottom: i < GALLERY_TABS.length - 1 ? '.5px solid var(--sep2)' : 'none' }}
                    onClick={() => setTab(t.id)}>
                    <t.Icon size={20} c="var(--blue)" sw={1.8} />
                    <span style={{ fontSize: 16, flex: 1 }}>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
