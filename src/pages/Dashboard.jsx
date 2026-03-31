import { useMemo } from 'react'
import { useCtx } from '../App.jsx'
import { coatStatus, maintStatus, fmtShort, IChevR, PhotoGrid } from '../components/Shared.jsx'

const STATUS_COLORS = {
  active:   '#1D4ED8',
  planning: '#7C3AED',
  paused:   '#B45309',
  complete: '#166534',
}
const STATUS_LABEL  = { active: 'Active', planning: 'Planning', paused: 'Paused', complete: 'Complete' }
const STATUS_ORDER  = ['complete', 'active', 'planning', 'paused']

function ProjectsByYear({ projects }) {
  const grouped = useMemo(() => {
    const byYear = {}
    projects.forEach(p => {
      const year = p.year_completed
      if (!year) return
      if (!byYear[year]) byYear[year] = { active: 0, planning: 0, paused: 0, complete: 0 }
      byYear[year][p.status] = (byYear[year][p.status] || 0) + 1
    })
    return Object.entries(byYear).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [projects])

  if (!grouped.length) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-3)', fontSize: 14 }}>
      No projects with a year completed set yet.
    </div>
  )

  const maxCount = Math.max(...grouped.map(([, counts]) => Object.values(counts).reduce((a, b) => a + b, 0)))

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        {STATUS_ORDER.map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[s] }} />
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, overflowX: 'auto', paddingBottom: 8, minHeight: 160 }}>
        {grouped.map(([year, counts]) => {
          const total = Object.values(counts).reduce((a, b) => a + b, 0)
          const barH  = Math.max(24, (total / maxCount) * 140)
          return (
            <div key={year} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 48 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{total}</span>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', width: 36, height: barH, borderRadius: 6, overflow: 'hidden' }}>
                {STATUS_ORDER.map(s => counts[s] > 0 && (
                  <div key={s} style={{ background: STATUS_COLORS[s], height: (counts[s] / total * 100) + "%", minHeight: 3 }} title={counts[s] + " " + s} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{year}</span>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>
        {projects.filter(p => !p.year_completed).length} projects have no year set
      </p>
    </div>
  )
}

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
  const hasUrgent    = urgCoats.length || urgMaint.length || nextSteps.length

  return (
    <div className="scroll-page">
      <div className="page-header">
        <p className="page-subtitle">{today}</p>
        <h1 className="page-title">Today</h1>
      </div>

      <div style={{ paddingBottom: 32 }}>

        {urgCoats.length > 0 && (
          <>
            <span className="section-label">Ready to Apply</span>
            <div className="group">
              {urgCoats.map(c => (
                <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--orange)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>Now</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{c.product}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name}</div>
                  </div>
                  <IChevR size={14} color="var(--text-4)" />
                </div>
              ))}
            </div>
          </>
        )}

        {urgMaint.length > 0 && (
          <>
            <span className="section-label">Needs Attention</span>
            <div className="group">
              {urgMaint.map(m => {
                const st = maintStatus(m)
                return (
                  <div key={m.id} className="cell">
                    <span style={{ fontSize: 12, fontWeight: 600, color: st.color, background: st.color === 'var(--red)' ? 'var(--red-dim)' : 'var(--orange-dim)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{st.label}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{m.category}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {nextSteps.length > 0 && (
          <>
            <span className="section-label">Active Projects</span>
            <div className="group">
              {nextSteps.map(({ p, step }) => (
                <div key={p.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(p.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Next: {step.title}</div>
                  </div>
                  <IChevR size={14} color="var(--text-4)" />
                </div>
              ))}
            </div>
          </>
        )}

        {!hasUrgent && (
          <div className="empty" style={{ paddingTop: 40, paddingBottom: 0 }}>
            <div className="empty-icon">🪵</div>
            <div className="empty-title">All clear</div>
            <p className="empty-sub">Nothing urgent today.</p>
          </div>
        )}

        <span className="section-label" style={{ marginTop: 32 }}>Projects by Year</span>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)', margin: '0 20px', padding: '16px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <ProjectsByYear projects={data.projects} />
        </div>

        {recentPhotos.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 20px 6px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Recent Photos</span>
              <button className="btn-text" onClick={() => setTab('photos')}>See all</button>
            </div>
            <PhotoGrid photos={recentPhotos} showProject projects={data.projects} />
          </>
        )}

        {upCoats.length > 0 && (
          <>
            <span className="section-label" style={{ marginTop: 8 }}>Upcoming Coats</span>
            <div className="group">
              {upCoats.map(c => {
                const st = coatStatus(c)
                return (
                  <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{c.product}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name} · {fmtShort(c.applied_at)}</div>
                    </div>
                    <span style={{ fontSize: 14, color: st.color, fontWeight: 500 }}>{st.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
