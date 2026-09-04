import { useMemo, useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useCtx } from '../App.jsx'
import { coatStatus, maintStatus, IChevR, IFolder, ITree, PhotoGrid, PhotoImg, KineticTitle } from '../components/Shared.jsx'

const SC = { active:'var(--accent)', planning:'var(--purple)', paused:'var(--orange)', complete:'var(--green)' }
const SL = { active:'Active', planning:'Planning', paused:'Paused', complete:'Complete' }
const AnalyticsSection = lazy(() => import('./DashboardAnalytics.jsx'))

// Mount children only once the placeholder nears the viewport (rootMargin 400px)
function LazyOnView({ children, fallback }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (inView || !ref.current || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect() } }, { rootMargin: '400px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [inView])
  return <div ref={ref}>{inView ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}</div>
}

// ── Drill-down list (YearReview pattern) ──────────────────────────────────────
function DrillList({ title, projects, onBack, onOpen }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1 className="page-title" style={{ margin: 0, fontSize: 20 }}>
            {title}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-text-muted)', marginLeft: 8 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </span>
          </h1>
        </div>
      </div>
      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        {projects.length === 0 ? (
          <div className="empty"><div className="empty-icon"><ITree size={32} color="var(--c-text-muted)" sw={1.5} /></div><div className="empty-title">No projects</div></div>
        ) : (
          <div className="group" style={{ marginTop: 12 }}>
            {projects.map((p, i) => (
              <div key={p.id} onClick={() => onOpen(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < projects.length - 1 ? '1px solid var(--c-border-light)' : 'none', cursor: 'pointer' }}
              >
                <div style={{ width: 9, height: 9, borderRadius: 2, background: SC[p.status] || 'var(--c-text-faint)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>
                    {[p.wood_type, p.category, p.finish_used, p.gift_recipient && '🎁 ' + p.gift_recipient].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <IChevR size={14} color="var(--c-text-faint)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data, setProjId, setTab, navigate, theme, setTabAction } = useCtx()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const locations = data.woodLocations || []

  // Drill-down state
  const [drill, setDrill] = useState(null) // { type, value, title }

  const handleDrill = (type, value) => {
    const titles = { species: value, category: value, finish: value, status: SL[value] || value }
    setDrill({ type, value, title: titles[type] || value })
  }

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!window.L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      document.head.appendChild(script)
    }
  }, [])

  const urgCoats  = data.coats.filter(c => {
    if (!c.applied_at || !coatStatus(c).urgent) return false
    // Only show if there's a next unapplied coat in the same project+product
    if (!data.coats.some(cc => cc.project_id === c.project_id && cc.product === c.product && cc.coat_number > c.coat_number && !cc.applied_at)) return false
    // Only show if this is the LAST applied coat in the group (prevents duplicate cards)
    if (data.coats.some(cc => cc.project_id === c.project_id && cc.product === c.product && cc.coat_number > c.coat_number && cc.applied_at)) return false
    return true
  }).map(c => ({ ...c, proj: data.projects.find(p => p.id === c.project_id) }))
  const upCoats   = data.coats.filter(c => {
    if (!c.applied_at || coatStatus(c).urgent) return false
    if (!data.coats.some(cc => cc.project_id === c.project_id && cc.product === c.product && cc.coat_number > c.coat_number && !cc.applied_at)) return false
    if (data.coats.some(cc => cc.project_id === c.project_id && cc.product === c.product && cc.coat_number > c.coat_number && cc.applied_at)) return false
    return true
  }).map(c => ({ ...c, proj: data.projects.find(p => p.id === c.project_id) })).slice(0, 3)
  const urgMaint  = data.maintenance.filter(m => maintStatus(m).urgent)
  const nextSteps = data.projects.filter(p => p.status === 'active').flatMap(p => {
    const step = data.steps.filter(s => s.project_id === p.id && !s.completed).sort((a, b) => a.sort_order - b.sort_order)[0]
    return step ? [{ p, step }] : []
  })
  const cats = data.categories || []

  // Stats for dashboard cards
  const activeProjects = data.projects.filter(p => p.status === 'active').length
  const planningProjects = data.projects.filter(p => p.status === 'planning').length
  const completeProjects = data.projects.filter(p => p.status === 'complete').length
  const shopRemaining = data.shopping.filter(s => !s.completed).length
  const coatsDue = urgCoats.length
  const photoCount = data.photos.length

  // Project thumbnails — latest photo per project
  const projThumb = useMemo(() => {
    const m = {}
    data.photos.forEach(p => {
      if (p.project_id && !m[p.project_id]) m[p.project_id] = p
    })
    return m
  }, [data.photos])

  // Steps progress per project
  const projProgress = useMemo(() => {
    const m = {}
    data.projects.forEach(p => {
      const steps = data.steps.filter(s => s.project_id === p.id)
      m[p.id] = { total: steps.length, done: steps.filter(s => s.completed).length }
    })
    return m
  }, [data.projects, data.steps])

  // Recent active/planning projects for "Continue Working" cards
  const recentProjects = useMemo(() =>
    [...data.projects]
      .filter(p => p.status !== 'complete')
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 4),
  [data.projects])

  // Drill-down view
  if (drill) {
    const drillProjects = data.projects.filter(p => {
      if (drill.type === 'species')  return p.wood_type === drill.value
      if (drill.type === 'category') return p.category  === drill.value
      if (drill.type === 'finish')   return p.finish_used === drill.value
      if (drill.type === 'status')   return p.status    === drill.value
      return false
    })
    return <DrillList title={drill.title} projects={drillProjects} onBack={() => setDrill(null)} onOpen={setProjId} />
  }

  return (
    <div className="scroll-page">
      <div className="page-header" data-tutorial-target="dashboard" style={{ paddingBottom: 12 }}>
        <p className="page-subtitle">
          <span className="live-dot" aria-hidden="true" />
          {today}
        </p>
        <KineticTitle text="Today" className="page-title" delay={80} />
      </div>
      <div style={{ paddingBottom: 32 }}>

        {/* Stats row */}
        <div data-tutorial-target="quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 20px 16px' }}>
          <div className="dash-stat-card" onClick={() => setTab('projects')} style={{ cursor: 'pointer' }}>
            <div className="dash-stat-num" style={{ color: 'var(--accent)' }}>{activeProjects}</div>
            <div className="dash-stat-label">Active</div>
          </div>
          <div className="dash-stat-card" onClick={() => setTab('projects')} style={{ cursor: 'pointer' }}>
            <div className="dash-stat-num" style={{ color: 'var(--green)' }}>{completeProjects}</div>
            <div className="dash-stat-label">Complete</div>
          </div>
          <div className="dash-stat-card" onClick={() => setTab('photos')} style={{ cursor: 'pointer' }}>
            <div className="dash-stat-num">{photoCount}</div>
            <div className="dash-stat-label">Photos</div>
          </div>
          <div className="dash-stat-card" onClick={() => setTab('shopping')} style={{ cursor: 'pointer' }}>
            <div className="dash-stat-num" style={{ color: shopRemaining > 0 ? 'var(--orange)' : 'var(--c-text-muted)' }}>{shopRemaining}</div>
            <div className="dash-stat-label">To Buy</div>
          </div>
        </div>

        {/* Urgent coats — compact cards */}
        {urgCoats.length > 0 && <>
          <span className="section-label">Ready to Apply</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, padding: '0 20px 12px' }}>
            {urgCoats.map(c => {
              const projCoats = data.coats.filter(cc => cc.project_id === c.project_id && cc.product === c.product)
              const applied = projCoats.filter(cc => cc.applied_at).length
              return (
                <div key={c.id} onClick={() => setProjId(c.project_id)} style={{
                  background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', gap: 14, alignItems: 'center',
                  transition: 'transform 300ms ease',
                }}>
                  {/* Progress ring */}
                  <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                    <svg width={44} height={44} viewBox="0 0 44 44">
                      <circle cx={22} cy={22} r={18} fill="none" stroke="var(--c-border)" strokeWidth={3} />
                      <circle cx={22} cy={22} r={18} fill="none" stroke="var(--orange)" strokeWidth={3}
                        strokeDasharray={`${(applied / projCoats.length) * 113} 113`}
                        strokeLinecap="round" transform="rotate(-90 22 22)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>
                      {applied}/{projCoats.length}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.product}</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 1 }}>Coat {c.coat_number} · {c.proj?.name}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--orange)', borderRadius: 4, padding: '3px 8px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>Now</span>
                </div>
              )
            })}
          </div>
        </>}

        {/* Maintenance alerts */}
        {urgMaint.length > 0 && <>
          <span className="section-label">Needs Attention</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, padding: '0 20px 12px' }}>
            {urgMaint.map(m => { const st = maintStatus(m); return (
              <div key={m.id} style={{
                background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
                padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.color === 'var(--red)' ? 'var(--red-dim)' : 'var(--orange-dim)', borderRadius: 4, padding: '3px 8px', flexShrink: 0 }}>{st.label}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{m.category}</div>
                </div>
              </div>
            )})}
          </div>
        </>}

        {!urgCoats.length && !urgMaint.length && (
          <div style={{ padding: '0 20px 12px', fontSize: 13, color: 'var(--c-text-muted)' }}>✓ All clear — nothing urgent today.</div>
        )}

        {/* Upcoming coats — compact */}
        {upCoats.length > 0 && <>
          <span className="section-label">Upcoming Coats</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, padding: '0 20px 12px' }}>
            {upCoats.map(c => { const st = coatStatus(c); return (
              <div key={c.id} onClick={() => setProjId(c.project_id)} style={{
                background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
                padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.product}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 1 }}>Coat {c.coat_number} · {c.proj?.name}</div>
                </div>
                <span style={{ fontSize: 12, color: st.color, fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
              </div>
            )})}
          </div>
        </>}

        {/* Continue Working — project cards with thumbnails */}
        {recentProjects.length > 0 && <>
          <span className="section-label" style={{ marginTop: 4 }}>Continue Working</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, padding: '0 20px 12px' }}>
            {recentProjects.map(p => {
              const thumb = projThumb[p.id]
              const prog = projProgress[p.id] || { total: 0, done: 0 }
              const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : null
              return (
                <div key={p.id} onClick={() => setProjId(p.id)} style={{
                  background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
                  cursor: 'pointer', overflow: 'hidden', display: 'flex',
                  transition: 'transform 300ms ease',
                }}>
                  {/* Thumbnail */}
                  <div style={{
                    width: 72, flexShrink: 0, position: 'relative',
                    background: 'var(--c-bg-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {thumb
                      ? <PhotoImg photo={thumb} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <IFolder size={20} color="var(--c-text-faint)" sw={1.5} />}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                        color: p.status === 'active' ? 'var(--accent)' : 'var(--purple)',
                        background: p.status === 'active' ? 'var(--accent-dim)' : 'var(--purple-dim)',
                        padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                      }}>{SL[p.status]}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>
                      {[p.wood_type, p.category].filter(Boolean).join(' · ') || 'No details'}
                    </div>
                    {pct !== null && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 3, background: 'var(--c-bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--c-text-faint)', flexShrink: 0 }}>{prog.done}/{prog.total}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>}

        <span className="section-label" style={{ marginTop: 16 }}>Analytics</span>
        <LazyOnView fallback={
          <div className="dash-grid" aria-busy="true">
            {[0,1,2,3,4].map(i => <div key={i} className="card" style={{ minHeight: 220 }} />)}
          </div>
        }>
          <AnalyticsSection
            data={data} categories={cats} locations={locations}
            isDark={theme === 'dark'} onDrill={handleDrill}
            onLocationClick={(locName) => { setTab('projects'); window.__woodLocationFilter = locName; }}
          />
        </LazyOnView>

        {data.photos.length > 0 && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 20px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Recent Photos</span>
            <button className="btn-text" onClick={() => setTab('photos')}>See all</button>
          </div>
          <PhotoGrid photos={data.photos.slice(0, 12)} showProject projects={data.projects} />
        </>}

      </div>
    </div>
  )
}

