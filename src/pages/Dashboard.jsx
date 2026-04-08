import { useMemo, useState, useEffect, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { coatStatus, maintStatus, fmtShort, fmt, IChevR, IChevL, PhotoGrid } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

const SC = { active:'var(--accent)', planning:'#7C3AED', paused:'var(--orange)', complete:'var(--green)' }
const SL = { active:'Active', planning:'Planning', paused:'Paused', complete:'Complete' }
const SO = ['complete','active','planning','paused']

// ── Drill-down list (YearReview pattern) ──────────────────────────────────────
function DrillList({ title, projects, onBack, onOpen }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h1 className="page-title" style={{ margin: 0, fontSize: 20 }}>
            {title}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-3)', marginLeft: 8 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </span>
          </h1>
        </div>
      </div>
      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        {projects.length === 0 ? (
          <div className="empty"><div className="empty-icon">🪵</div><div className="empty-title">No projects</div></div>
        ) : (
          <div className="group" style={{ marginTop: 12 }}>
            {projects.map((p, i) => (
              <div key={p.id} onClick={() => onOpen(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < projects.length - 1 ? '1px solid var(--border-2)' : 'none', cursor: 'pointer' }}
              >
                <div style={{ width: 9, height: 9, borderRadius: 2, background: SC[p.status] || 'var(--text-4)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {[p.wood_type, p.category, p.finish_used, p.gift_recipient && '🎁 ' + p.gift_recipient].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <IChevR size={14} color="var(--text-4)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Year Carousel ─────────────────────────────────────────────────────────────
function YearCarousel({ year, projects, photos, onClose }) {
  const yearProjects = projects.filter(p => p.year_completed === Number(year))
  const carouselPhotos = yearProjects.flatMap(p => {
    const projPhotos = photos.filter(ph => ph.project_id === p.id && ph.photo_type === 'finished')
    if (!projPhotos.length) {
      const any = photos.find(ph => ph.project_id === p.id)
      if (any) return [{ ...any, _projName: p.name, _projWood: p.wood_type, _projCat: p.category }]
      return []
    }
    return projPhotos.map(ph => ({ ...ph, _projName: p.name, _projWood: p.wood_type, _projCat: p.category }))
  })
  const [cur, setCur] = useState(0)
  const photo = carouselPhotos[cur]

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && cur < carouselPhotos.length - 1) setCur(i => i + 1)
      if (e.key === 'ArrowLeft' && cur > 0) setCur(i => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur, carouselPhotos.length, onClose])

  if (!carouselPhotos.length) return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '32px 24px', maxWidth: 360, width: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{year} — No photos yet</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>{yearProjects.length} project{yearProjects.length !== 1 ? 's' : ''} but no finished photos uploaded.</p>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Close</button>
      </div>
    </div>
  )

  return (
    <div className="fs-overlay">
      <div className="fs-overlay-bar">
        <button onClick={onClose} className="fs-back-btn"><IChevL size={16} color="#fff" sw={2} /> Back</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{year}</div>
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{cur + 1} of {carouselPhotos.length}</div>
        </div>
        <div style={{ width: 60 }} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <img src={photo.url} alt={photo._projName} style={{ maxWidth: '100vw', maxHeight: '100vh', objectFit: 'contain' }} />
        {cur > 0 && <button onClick={() => setCur(i => i - 1)} className="fs-nav-btn prev"><IChevL size={20} color="#fff" sw={2} /></button>}
        {cur < carouselPhotos.length - 1 && <button onClick={() => setCur(i => i + 1)} className="fs-nav-btn next"><IChevR size={20} color="#fff" sw={2} /></button>}
      </div>
      <div className="fs-overlay-caption">
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{photo._projName}</div>
        <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, marginTop: 2 }}>{[photo._projWood, photo._projCat, photo.caption].filter(Boolean).join(' · ')}</div>
        {carouselPhotos.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {carouselPhotos.map((ph, i) => (
              <img key={ph.id} src={ph.url} alt="" onClick={() => setCur(i)} loading="lazy"
                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0, cursor: 'pointer', opacity: cur === i ? 1 : 0.5, outline: cur === i ? '2px solid #fff' : 'none', outlineOffset: 1 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Projects by Year (animated bars) ─────────────────────────────────────────
function ProjectsByYear({ projects, photos, onDrill }) {
  const [carouselYear, setCarouselYear] = useState(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t) }, [])

  const grouped = useMemo(() => {
    const m = {}
    projects.forEach(p => {
      const y = p.year_completed; if (!y) return
      if (!m[y]) m[y] = { active: 0, planning: 0, paused: 0, complete: 0 }
      m[y][p.status] = (m[y][p.status] || 0) + 1
    })
    return Object.entries(m).sort((a, b) => Number(a[0]) - Number(b[0]))
  }, [projects])

  if (!grouped.length) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>No years set on projects yet</div>
  const max = Math.max(...grouped.map(([, c]) => Object.values(c).reduce((a, b) => a + b, 0)))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {SO.map(s => <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: SC[s] }} /><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{SL[s]}</span></div>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, overflowX: 'auto', paddingBottom: 4, minHeight: 120 }}>
        {grouped.map(([y, c], gi) => {
          const tot = Object.values(c).reduce((a, b) => a + b, 0)
          const h = Math.max(20, (tot / max) * 100)
          return (
            <div key={y} onClick={() => setCarouselYear(y)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 40, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{tot}</span>
              <div style={{ display: 'flex', flexDirection: 'column-reverse', width: 28, height: h, borderRadius: 4, overflow: 'hidden' }}>
                {SO.map((s, si) => c[s] > 0 && (
                  <div key={s}
                    className={mounted ? 'bar-animate' : ''}
                    style={{ background: SC[s], height: (c[s] / tot * 100) + '%', minHeight: 2, animationDelay: `${gi * 60 + si * 20}ms` }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{y}</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>Tap a bar to browse that year's pieces</div>
      {carouselYear && <YearCarousel year={carouselYear} projects={projects} photos={photos} onClose={() => setCarouselYear(null)} />}
    </div>
  )
}

// ── Species Donut (animated slices) ──────────────────────────────────────────
function SpeciesDonut({ projects, onDrill }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t) }, [])

  const data = useMemo(() => {
    const m = {}
    projects.forEach(p => { const s = p.wood_type?.trim(); if (s) m[s] = (m[s] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [projects])
  const COLORS = ['#1D4ED8', '#166534', '#B45309', '#7C3AED', '#0891B2', '#BE185D', '#15803D', '#9333EA']
  const total = data.reduce((a, [, v]) => a + v, 0)
  if (!data.length) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>No species logged yet</div>
  let angle = -90
  const slices = data.map(([name, count], i) => {
    const pct = count / total, deg = pct * 360
    const start = angle, end = angle + deg; angle += deg
    const r = 40, cx = 50, cy = 50
    const toRad = d => d * Math.PI / 180
    const x1 = cx + r * Math.cos(toRad(start)), y1 = cy + r * Math.sin(toRad(start))
    const x2 = cx + r * Math.cos(toRad(end)), y2 = cy + r * Math.sin(toRad(end))
    const large = deg > 180 ? 1 : 0
    return { name, count, pct, color: COLORS[i % COLORS.length], d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z` }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 100 100" style={{ width: 90, height: 90, flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color}
            className={mounted ? 'slice-animate' : ''}
            style={{ animationDelay: `${i * 60}ms`, cursor: 'pointer' }}
            onClick={() => onDrill('species', s.name)}
          />
        ))}
        <circle cx="50" cy="50" r="22" fill="var(--surface)" />
        <text x="50" y="47" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-2)">{total}</text>
        <text x="50" y="57" textAnchor="middle" fontSize="7" fill="var(--text-3)">projects</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {slices.slice(0, 6).map((s, i) => (
          <div key={i} onClick={() => onDrill('species', s.name)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{s.count} →</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Category Heatmap ──────────────────────────────────────────────────────────
function CategoryHeatmap({ projects, categories, onDrill }) {
  const { years, cats, grid } = useMemo(() => {
    const ySet = new Set(), cSet = new Set()
    projects.forEach(p => { if (p.year_completed) ySet.add(p.year_completed); if (p.category) cSet.add(p.category) })
    const years = [...ySet].sort((a, b) => a - b).slice(-8)
    const cats = categories.length ? categories.map(c => c.name) : [...cSet]
    const grid = {}
    projects.forEach(p => { if (p.year_completed && p.category) { const k = p.category + '|' + p.year_completed; grid[k] = (grid[k] || 0) + 1 } })
    return { years, cats, grid }
  }, [projects, categories])
  if (!years.length || !cats.length) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>Add categories + years to projects</div>
  const max = Math.max(1, ...Object.values(grid))
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
        <thead><tr>
          <td style={{ padding: '2px 6px', color: 'var(--text-4)', width: 80 }}></td>
          {years.map(y => <th key={y} style={{ padding: '2px 6px', fontWeight: 500, color: 'var(--text-3)', textAlign: 'center' }}>{y}</th>)}
        </tr></thead>
        <tbody>{cats.map(cat => (
          <tr key={cat}>
            <td onClick={() => onDrill('category', cat)} style={{ padding: '3px 6px', color: 'var(--text-2)', fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>{cat}</td>
            {years.map(y => {
              const v = grid[cat + '|' + y] || 0
              const intensity = v / max
              return <td key={y} style={{ padding: '2px 4px', textAlign: 'center' }}>
                <div style={{ width: 28, height: 20, borderRadius: 4, background: v ? `rgba(22,101,52,${0.15 + intensity * 0.8})` : 'var(--fill-2)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {v > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: intensity > 0.5 ? '#fff' : 'var(--forest)' }}>{v}</span>}
                </div>
              </td>
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

// ── Finish Usage (animated bars) ──────────────────────────────────────────────
function FinishUsage({ projects, onDrill }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t) }, [])

  const data = useMemo(() => {
    const m = {}
    projects.forEach(p => { const f = p.finish_used?.trim(); if (f) m[f] = (m[f] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [projects])
  if (!data.length) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>No finishes logged yet</div>
  const max = data[0][1]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(([name, count], i) => (
        <div key={name} onClick={() => onDrill('finish', name)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{name}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0, marginLeft: 8 }}>{count} →</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--fill)', overflow: 'hidden' }}>
            <div className={mounted ? 'bar-animate' : ''}
              style={{ height: 6, borderRadius: 3, background: 'var(--green)', width: (count / max * 100) + '%', animationDelay: `${i * 60}ms` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Status Pipeline ───────────────────────────────────────────────────────────
function StatusPipeline({ projects, onDrill }) {
  const counts = useMemo(() => SO.reduce((acc, s) => ({ ...acc, [s]: projects.filter(p => p.status === s).length }), {}), [projects])
  const total = projects.length
  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 20, marginBottom: 12 }}>
        {SO.map(s => counts[s] > 0 && (
          <div key={s} onClick={() => onDrill('status', s)}
            style={{ background: SC[s], flex: counts[s], minWidth: 4, cursor: 'pointer', transition: 'opacity 150ms' }}
            title={SL[s] + ': ' + counts[s]}
            onMouseEnter={e => e.currentTarget.style.opacity = '.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {SO.map(s => (
          <div key={s} onClick={() => onDrill('status', s)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: SC[s], flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{counts[s]}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{SL[s]} →</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-4)' }}>{total} projects total</div>
    </div>
  )
}

// ── Wood Source Map ───────────────────────────────────────────────────────────
function WoodSourceMap({ locations, woodStock, projectWoodSources }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const [expanded, setExpanded] = useState(false)

  const sourceCounts = useMemo(() => {
    const m = {}
    ;(projectWoodSources || []).forEach(pws => {
      const stock = (woodStock || []).find(w => w.id === pws.wood_stock_id)
      if (stock?.location_id) m[stock.location_id] = (m[stock.location_id] || 0) + 1
    })
    return m
  }, [projectWoodSources, woodStock])

  const mappable = locations.filter(l => l.lat && l.lng)

  useEffect(() => {
    if (!mapRef.current || mappable.length === 0) return
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
    const L = window.L; if (!L) return
    const lats = mappable.map(l => l.lat), lngs = mappable.map(l => l.lng)
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([centerLat || 43.5, centerLng || -71.5], mappable.length === 1 ? 10 : 7)
    mapInstance.current = map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
    mappable.forEach(loc => {
      const count = sourceCounts[loc.id] || 0
      const size = Math.max(24, Math.min(40, 24 + count * 4))
      const icon = L.divIcon({ className: '', html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#0F1E38;border:2px solid #BFDBFE;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${count > 0 ? 11 : 9}px;font-weight:700;font-family:system-ui">${count > 0 ? count : '📍'}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
      L.marker([loc.lat, loc.lng], { icon }).addTo(map).bindPopup(`<strong>${loc.name}</strong>${loc.address ? '<br>' + loc.address : ''}${count ? '<br>' + count + ' project' + (count > 1 ? 's' : '') : ''}`)
    })
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null } }
  }, [mappable, sourceCounts])

  if (!locations.length) return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-3)', fontSize: 13 }}>No wood locations added yet</div>
  if (mappable.length === 0) return (
    <div>{locations.map(l => (
      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-2)' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{l.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{sourceCounts[l.id] || 0} projects</span>
      </div>
    ))}</div>
  )
  return (
    <div>
      <div ref={mapRef} onClick={() => setExpanded(true)} style={{ height: 200, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-2)', cursor: 'pointer', position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 1000, background: 'rgba(255,255,255,.85)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: '#333', pointerEvents: 'none' }}>⤢ Expand</div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {locations.slice(0, 4).map(l => (
          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-2)' }}>{l.name}</span>
            <span style={{ color: 'var(--text-3)' }}>{sourceCounts[l.id] || 0} uses</span>
          </div>
        ))}
      </div>
      {expanded && (
        <div onClick={e => { if (e.target === e.currentTarget) setExpanded(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="map-modal-card">
            <div className="map-modal-header">
              <span style={{ color: 'var(--white)', fontWeight: 600, fontSize: 15 }}>Wood Source Locations</span>
              <button onClick={() => setExpanded(false)} className="map-modal-close">×</button>
            </div>
            <div ref={mapRef} style={{ flex: 1 }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data, setProjId, setTab } = useCtx()
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

  const urgCoats  = data.coats.filter(c => c.applied_at && coatStatus(c).urgent).map(c => ({ ...c, proj: data.projects.find(p => p.id === c.project_id) }))
  const upCoats   = data.coats.filter(c => c.applied_at && !coatStatus(c).urgent).map(c => ({ ...c, proj: data.projects.find(p => p.id === c.project_id) })).slice(0, 3)
  const urgMaint  = data.maintenance.filter(m => maintStatus(m).urgent)
  const nextSteps = data.projects.filter(p => p.status === 'active').flatMap(p => {
    const step = data.steps.filter(s => s.project_id === p.id && !s.completed).sort((a, b) => a.sort_order - b.sort_order)[0]
    return step ? [{ p, step }] : []
  })
  const hasUrgent = urgCoats.length || urgMaint.length || nextSteps.length
  const cats = data.categories || []

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
      <div className="page-header">
        <p className="page-subtitle">
          <span className="live-dot" aria-hidden="true" />
          {today}
        </p>
        <h1 className="page-title">Today</h1>
      </div>
      <div style={{ paddingBottom: 32 }}>

        {urgCoats.length > 0 && <>
          <span className="section-label">Ready to Apply</span>
          <div className="group">
            {urgCoats.map(c => (
              <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--white)', background: 'var(--orange)', borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>Now</span>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{c.product}</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name}</div></div>
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
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{m.name}</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>{m.category}</div></div>
              </div>
            )})}
          </div>
        </>}

        {nextSteps.length > 0 && <>
          <span className="section-label">Active Projects</span>
          <div className="group">
            {nextSteps.map(({ p, step }) => (
              <div key={p.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(p.id)}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>Next: {step.title}</div></div>
                <IChevR size={14} color="var(--text-4)" />
              </div>
            ))}
          </div>
        </>}

        {!hasUrgent && <div className="empty" style={{ paddingTop: 32, paddingBottom: 0 }}><div className="empty-icon">🪵</div><div className="empty-title">All clear</div><p className="empty-sub">Nothing urgent today.</p></div>}

        {(() => {
          const recent = [...data.projects]
            .filter(p => p.status !== 'complete')
            .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
            .slice(0, 3)
          if (!recent.length) return null
          return (<>
            <span className="section-label" style={{ marginTop: 20 }}>Continue Working</span>
            <div className="group">
              {recent.map(p => (
                <div key={p.id} className="cell" style={{ cursor:'pointer' }} onClick={() => setProjId(p.id)}>
                  <div style={{ width:9, height:9, borderRadius:2, background:SC[p.status]||'var(--text-4)', flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:15 }}>{p.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)' }}>{[p.wood_type, p.category].filter(Boolean).join(' · ')}</div>
                  </div>
                  <IChevR size={14} color="var(--text-4)" />
                </div>
              ))}
            </div>
          </>)
        })()}
        <span className="section-label" style={{ marginTop: 28 }}>Analytics</span>
        <div className="dash-grid">
          <div className="card"><div className="label-caps-sm">Projects by Year</div><ProjectsByYear projects={data.projects} photos={data.photos} onDrill={handleDrill} /></div>
          <div className="card"><div className="label-caps-sm">Species Breakdown</div><SpeciesDonut projects={data.projects} onDrill={handleDrill} /></div>
          <div className="card"><div className="label-caps-sm">Category Heatmap</div><CategoryHeatmap projects={data.projects} categories={cats} onDrill={handleDrill} /></div>
          <div className="card"><div className="label-caps-sm">Finish Usage</div><FinishUsage projects={data.projects} onDrill={handleDrill} /></div>
          <div className="card"><div className="label-caps-sm">Project Status</div><StatusPipeline projects={data.projects} onDrill={handleDrill} /></div>
          <div className="card"><div className="label-caps-sm">Wood Source Map</div><WoodSourceMap locations={locations} woodStock={data.woodStock} projectWoodSources={data.projectWoodSources} /></div>
        </div>

        {data.photos.length > 0 && <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 20px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Recent Photos</span>
            <button className="btn-text" onClick={() => setTab('photos')}>See all</button>
          </div>
          <PhotoGrid photos={data.photos.slice(0, 8)} showProject projects={data.projects} />
        </>}

        {upCoats.length > 0 && <>
          <span className="section-label" style={{ marginTop: 8 }}>Upcoming Coats</span>
          <div className="group">
            {upCoats.map(c => { const st = coatStatus(c); return (
              <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{c.product}</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name} · {fmtShort(c.applied_at)}</div></div>
                <span style={{ fontSize: 14, color: st.color, fontWeight: 500 }}>{st.label}</span>
              </div>
            )})}
          </div>
        </>}
      </div>
      <AddPhotoFAB />
    </div>
  )
}

function AddPhotoFAB() {
  const { mutate } = useCtx()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()
  const handleFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const photo = await db.uploadPhoto(null, file, '', 'progress', '')
      mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
      toast('Photo added', 'success')
    } catch(err) { toast(err.message, 'error') }
    finally { setUploading(false); e.target.value = '' }
  }
  return (<>
    <input ref={inputRef} type="file" accept="image/*" capture="environment"
      style={{ display:'none' }} onChange={handleFile} />
    <button className="fab" onClick={() => inputRef.current?.click()}
      aria-label="Add photo"
      style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 16px)' }}>
      {uploading
        ? <div className="spinner" style={{ width:22, height:22, borderWidth:2 }}/>
        : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
      }
    </button>
  </>)
}

