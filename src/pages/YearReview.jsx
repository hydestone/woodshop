import { useState, useMemo, useEffect, useRef } from 'react'
import { useCtx } from '../App.jsx'

const STATUS_COLORS = { active:'var(--accent)', planning:'#7C3AED', paused:'var(--orange)', complete:'var(--green)' }
const CAT_COLORS = ['#1D4ED8','#166534','#B45309','#7C3AED','#0891B2','#BE185D','#15803D','#9333EA']


// ── Animated count-up for hero stat ──────────────────────────────────────────
function HeroCount({ value, duration = 1000 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!value) { setDisplay(0); return }
    let start = null
    const step = (ts) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(ease * value))
      if (progress < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{display}</>
}

export default function YearReview() {
  const { data, setProjId } = useCtx()
  const currentYear = new Date().getFullYear()

  const availableYears = useMemo(() => {
    const ys = new Set(data.projects.map(p => p.year_completed).filter(Boolean))
    ys.add(currentYear)
    return [...ys].sort((a, b) => b - a)
  }, [data.projects, currentYear])

  const [year, setYear] = useState(() => {
    const withProjects = data.projects.map(p => p.year_completed).filter(Boolean)
    return withProjects.length ? Math.max(...withProjects) : currentYear
  })

  // Drill-down state
  const [drillType, setDrillType] = useState(null)  // 'species' | 'category' | 'finish' | 'status' | 'projects'
  const [drillValue, setDrillValue] = useState(null)

  const stats = useMemo(() => {
    const projs = data.projects.filter(p => p.year_completed === year)
    const species = {}, finishes = {}, categories = {}, statuses = {}, recipients = []
    projs.forEach(p => {
      if (p.wood_type)       species[p.wood_type]    = (species[p.wood_type]    || 0) + 1
      if (p.finish_used)     finishes[p.finish_used] = (finishes[p.finish_used] || 0) + 1
      if (p.category)        categories[p.category]  = (categories[p.category]  || 0) + 1
      if (p.status)          statuses[p.status]      = (statuses[p.status]      || 0) + 1
      if (p.gift_recipient)  recipients.push({ name: p.gift_recipient, project: p.name, id: p.id })
    })
    const topSpecies  = Object.entries(species).sort((a, b) => b[1] - a[1])
    const topFinishes = Object.entries(finishes).sort((a, b) => b[1] - a[1])
    const topCats     = Object.entries(categories).sort((a, b) => b[1] - a[1])
    const photos      = data.photos.filter(ph => {
      const proj = data.projects.find(p => p.id === ph.project_id)
      return proj?.year_completed === year && ph.photo_type === 'finished'
    })
    return { projs, species, finishes, categories, statuses, topSpecies, topFinishes, topCats, recipients, photos }
  }, [data, year])

  // Drilled projects
  const drilledProjects = useMemo(() => {
    if (!drillType) return []
    if (drillType === 'projects') return stats.projs
    if (drillType === 'species')  return stats.projs.filter(p => p.wood_type === drillValue)
    if (drillType === 'category') return stats.projs.filter(p => p.category === drillValue)
    if (drillType === 'finish')   return stats.projs.filter(p => p.finish_used === drillValue)
    if (drillType === 'status')   return stats.projs.filter(p => p.status === drillValue)
    if (drillType === 'gifts')    return stats.projs.filter(p => p.gift_recipient)
    return []
  }, [drillType, drillValue, stats])

  const drill = (type, value = null) => {
    setDrillType(type); setDrillValue(value)
  }
  const clearDrill = () => { setDrillType(null); setDrillValue(null) }

  const shareText = `JDH Woodworks ${year} in Review: ${stats.projs.length} pieces completed${stats.topSpecies[0] ? `, mostly in ${stats.topSpecies[0][0]}` : ''}. #woodworking #handmade`

  // ── Drill-down overlay ───────────────────────────────────────────────────────
  if (drillType) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={clearDrill}>← Back</button>
          <h1 className="page-title" style={{ margin: 0, fontSize: 20 }}>
            {drillValue || (drillType === 'projects' ? 'All Projects' : drillType === 'gifts' ? 'Gifts' : drillType)}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginLeft: 8 }}>
              {drilledProjects.length} project{drilledProjects.length !== 1 ? 's' : ''}
            </span>
          </h1>
        </div>
      </div>
      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        <div style={{ padding: '12px 0' }}>
          {drilledProjects.length === 0 ? (
            <div className="empty"><div className="empty-icon">🪵</div><div className="empty-title">No projects</div></div>
          ) : (
            <div className="group">
              {drilledProjects.map((p, i) => (
                <div key={p.id}
                  onClick={() => setProjId(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < drilledProjects.length - 1 ? '1px solid var(--border-2)' : 'none', cursor: 'pointer' }}
                >
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: STATUS_COLORS[p.status] || 'var(--text-4)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                      {[p.wood_type, p.category, p.finish_used, p.gift_recipient && '🎁 ' + p.gift_recipient].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <div className="scroll-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Year in Review</h1>
          <select className="form-select" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 'auto' }}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '0 20px 40px' }}>
        {stats.projs.length === 0 ? (
          <div className="empty" style={{ paddingTop: 40 }}>
            <div className="empty-icon">📅</div>
            <div className="empty-title">No projects in {year}</div>
            <p className="empty-sub">Add a year_completed to your projects to see your review</p>
          </div>
        ) : (
          <>
            {/* Hero — clickable */}
            <button
              onClick={() => drill('projects')}
              style={{ width: '100%', background: 'var(--navy)', borderRadius: 16, padding: '28px 24px', marginBottom: 12, textAlign: 'center', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--white)', lineHeight: 1 }}><HeroCount value={stats.projs.length} /></div>
              <div style={{ fontSize: 16, color: 'var(--sb-text)', marginTop: 4 }}>piece{stats.projs.length !== 1 ? 's' : ''} completed in {year}</div>
              {stats.topSpecies[0] && <div style={{ fontSize: 13, color: 'var(--accent-light)', marginTop: 8 }}>Favourite wood: {stats.topSpecies[0][0]}</div>}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 10 }}>Tap to see all →</div>
            </button>

            {/* KPI grid — each card clickable */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Species used',  value: Object.keys(stats.species).length,   type: 'projects', val: null },
                { label: 'Top finish',    value: stats.topFinishes[0]?.[0] || '—',    type: 'finish',   val: stats.topFinishes[0]?.[0] },
                { label: 'Top category',  value: stats.topCats[0]?.[0] || '—',        type: 'category', val: stats.topCats[0]?.[0] },
                { label: 'Gifts given',   value: stats.recipients.length,             type: 'gifts',    val: null },
                { label: 'Photos taken',  value: stats.photos.length,                 type: null,       val: null },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={s.type && (s.val !== undefined || s.type === 'gifts' || s.type === 'projects') ? () => drill(s.type, s.val) : undefined}
                  style={{
                    background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)',
                    padding: '14px 16px', textAlign: 'left', fontFamily: 'inherit',
                    cursor: s.type && (s.val !== undefined || s.type === 'gifts' || s.type === 'projects') ? 'pointer' : 'default',
                    transition: 'box-shadow 150ms',
                  }}
                  onMouseEnter={e => { if (s.type) e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.value}</div>
                  {s.type && s.value !== '—' && s.value !== 0 && <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 4 }}>Tap to drill in →</div>}
                </button>
              ))}
            </div>

            {/* Species breakdown — each bar clickable */}
            {stats.topSpecies.length > 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)', padding: '16px', marginBottom: 12 }}>
                <div className="label-caps-sm">Species Breakdown</div>
                {stats.topSpecies.map(([name, count]) => (
                  <button key={name} onClick={() => drill('species', name)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: '4px 0 4px', marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{count} →</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--fill)' }}>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--green)', width: (count / stats.projs.length * 100) + '%', transition: 'width 400ms ease' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Category breakdown — each bar clickable */}
            {stats.topCats.length > 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)', padding: '16px', marginBottom: 12 }}>
                <div className="label-caps-sm">By Category</div>
                {stats.topCats.map(([name, count], ci) => (
                  <button key={name} onClick={() => drill('category', name)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: '4px 0', marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{count} →</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--fill)' }}>
                      <div style={{ height: 6, borderRadius: 3, background: CAT_COLORS[ci % CAT_COLORS.length], width: (count / stats.projs.length * 100) + '%', transition: 'width 400ms ease' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Gifts */}
            {stats.recipients.length > 0 && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-2)', padding: '16px', marginBottom: 12 }}>
                <div className="label-caps-sm">Gifts & Recipients</div>
                {stats.recipients.map((r, i) => (
                  <div key={i} onClick={() => setProjId(r.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < stats.recipients.length - 1 ? '1px solid var(--border-2)' : 'none', cursor: 'pointer' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{r.project}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>🎁 {r.name}</span>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => {
              if (navigator.share) navigator.share({ title: `JDH Woodworks ${year}`, text: shareText })
              else navigator.clipboard?.writeText(shareText)
            }}>
              Share {year} Summary
            </button>
          </>
        )}
      </div>
    </div>
  )
}
