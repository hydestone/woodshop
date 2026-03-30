import { useCtx } from '../App.jsx'
import { coatStatus, maintStatus, fmtShort, IChevR, PhotoGrid } from '../components/Shared.jsx'

export default function Dashboard() {
  const { data, setProjId, setTab } = useCtx()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const urgCoats = data.coats
    .filter(c => c.applied_at && coatStatus(c).urgent)
    .map(c => ({ ...c, proj: data.projects.find(p => p.id === c.project_id) }))

  const upCoats = data.coats
    .filter(c => c.applied_at && !coatStatus(c).urgent)
    .map(c => ({ ...c, proj: data.projects.find(p => p.id === c.project_id) }))
    .slice(0, 3)

  const urgMaint = data.maintenance.filter(m => maintStatus(m).urgent)

  const nextSteps = data.projects
    .filter(p => p.status === 'active')
    .flatMap(p => {
      const step = data.steps.filter(s => s.project_id === p.id && !s.completed).sort((a, b) => a.sort_order - b.sort_order)[0]
      return step ? [{ p, step }] : []
    })

  const recentPhotos = data.photos.slice(0, 8)

  return (
    <div className="scroll-page">
      <div className="page-header">
        <p className="page-subtitle">{today}</p>
        <h1 className="page-title">Today</h1>
      </div>

      <div style={{ paddingBottom: 24 }}>
        {urgCoats.length > 0 && <>
          <span className="section-label">Ready to Apply</span>
          <div className="group">
            {urgCoats.map(c => (
              <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)} role="button" tabIndex={0}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--orange)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>Now</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{c.product}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name}</div>
                </div>
                <IChevR size={14} color="var(--text-4)" />
              </div>
            ))}
          </div>
        </>}

        {urgMaint.length > 0 && <>
          <span className="section-label">Needs Attention</span>
          <div className="group">
            {urgMaint.map(m => { const st = maintStatus(m); return (
              <div key={m.id} className="cell">
                <span style={{ fontSize: 12, fontWeight: 600, color: st.color, background: st.color === 'var(--red)' ? 'var(--red-dim)' : 'var(--orange-dim)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{st.label}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{m.category}</div>
                </div>
              </div>
            )})}
          </div>
        </>}

        {nextSteps.length > 0 && <>
          <span className="section-label">Active Projects</span>
          <div className="group">
            {nextSteps.map(({ p, step }) => (
              <div key={p.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(p.id)} role="button" tabIndex={0}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Next: {step.title}</div>
                </div>
                <IChevR size={14} color="var(--text-4)" />
              </div>
            ))}
          </div>
        </>}

        {upCoats.length > 0 && <>
          <span className="section-label">Upcoming Coats</span>
          <div className="group">
            {upCoats.map(c => { const st = coatStatus(c); return (
              <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{c.product}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name} · {fmtShort(c.applied_at)}</div>
                </div>
                <span style={{ fontSize: 14, color: st.color, fontWeight: 500 }}>{st.label}</span>
              </div>
            )})}
          </div>
        </>}

        {!urgCoats.length && !urgMaint.length && !nextSteps.length && !recentPhotos.length && (
          <div className="empty" style={{ paddingTop: 80 }}>
            <div className="empty-icon">🪵</div>
            <div className="empty-title">All clear</div>
            <p className="empty-sub">Nothing urgent today.</p>
          </div>
        )}

        {recentPhotos.length > 0 && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 20px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Recent Photos</span>
            <button className="btn-text" onClick={() => setTab('photos')}>See all</button>
          </div>
          <PhotoGrid photos={recentPhotos} showProject projects={data.projects} />
        </>}
      </div>
    </div>
  )
}
