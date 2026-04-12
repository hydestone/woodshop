import * as echarts from 'echarts'
import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCtx } from '../App.jsx'
import { coatStatus, maintStatus, fmtShort, fmt, IChevR, IChevL, PhotoGrid, KineticTitle } from '../components/Shared.jsx'
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

  if (!carouselPhotos.length) return createPortal(
    <div className="overlay" onClick={onClose} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '32px 24px', maxWidth: 360, width: '90%', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{year} — No photos yet</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>{yearProjects.length} project{yearProjects.length !== 1 ? 's' : ''} but no finished photos uploaded.</p>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
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

// ── Projects by Year — ECharts stacked bar ───────────────────────────────────
function ProjectsByYear({ projects, photos, onDrill , isDark = false }) {
  const [carouselYear, setCarouselYear] = useState(null)
  const chartRef = useRef()

  const grouped = useMemo(() => {
    const m = {}
    projects.forEach(p => {
      const y = p.year_completed; if (!y) return
      if (!m[y]) m[y] = { active:0, planning:0, paused:0, complete:0 }
      m[y][p.status] = (m[y][p.status]||0)+1
    })
    return Object.entries(m).sort((a,b) => Number(a[0])-Number(b[0]))
  }, [projects])

  const getOption = (dark) => ({
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: dark ? '#1C2333' : '#fff',
      borderColor: dark ? 'rgba(240,246,252,.1)' : '#E2E8F0',
      textStyle: { color: EC.text(dark), fontSize: 12 },
    },
    legend: {
      data: ['Complete','Active','Planning','Paused'],
      bottom: 0,
      textStyle: { color: EC.text2(dark), fontSize: 11 },
      icon: 'roundRect',
      itemWidth: 10, itemHeight: 10,
    },
    grid: { top: 8, left: 32, right: 8, bottom: 56, containLabel: false },
    xAxis: {
      type: 'category',
      data: grouped.map(([y]) => y),
      axisLine: { lineStyle: { color: EC.grid(dark) } },
      axisTick: { show: false },
      axisLabel: { color: EC.text2(dark), fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: EC.grid(dark) } },
      axisLabel: { color: EC.text2(dark), fontSize: 10 },
    },
    series: ['complete','active','planning','paused'].map((status, idx) => ({
      name: SL[status],
      type: 'bar',
      stack: 'total',
      barMaxWidth: 36,
      itemStyle: { color: SC[status], borderRadius: idx === 0 ? [4,4,0,0] : 0 },
      data: grouped.map(([,c]) => c[status] || 0),
      emphasis: { itemStyle: { opacity: 0.85 } },
    })),
  })

  useECharts(chartRef, getOption, [grouped], isDark)

  // Handle click on bar to open year carousel
  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const chart = echarts.getInstanceByDom(el)
    if (!chart) return
    const handler = (params) => setCarouselYear(String(params.name || grouped[params.dataIndex]?.[0]))
    chart.on('click', handler)
    return () => chart.off('click', handler)
  }, [grouped])

  if (!grouped.length) return <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-3)', fontSize:13 }}>No years set on projects yet</div>

  return (
    <div>
      <div ref={chartRef} style={{ width:'100%', height: 220 }} />
      <div style={{ fontSize:11, color:'var(--text-4)', marginTop:4 }}>Click a bar to browse that year</div>
      {carouselYear && <YearCarousel year={carouselYear} projects={projects} photos={photos} onClose={()=>setCarouselYear(null)}/>}
    </div>
  )
}

// ── Species Breakdown — ECharts radial ring ──────────────────────────────────
function SpeciesDonut({ projects, onDrill , isDark = false }) {
  const chartRef = useRef()

  const data = useMemo(() => {
    const m = {}
    projects.forEach(p => { const s = p.wood_type?.trim(); if(s) m[s]=(m[s]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8)
      .map(([name,value],i) => ({ name, value, itemStyle:{color:EC.palette[i%EC.palette.length]} }))
  }, [projects])

  const getOption = (dark) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: dark ? '#1C2333' : '#fff',
      borderColor: dark ? 'rgba(240,246,252,.1)' : '#E2E8F0',
      textStyle: { color: EC.text(dark), fontSize: 12 },
    },
    legend: {
      type: 'scroll', orient: 'horizontal', bottom: 0, left: 'center',
      textStyle: { color: EC.text2(dark), fontSize: 10 },
      icon: 'roundRect', itemWidth: 8, itemHeight: 8,
    },
    series: [{
      type: 'pie', radius: ['38%','62%'], center: ['50%','44%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 12, fontWeight: 700 }, scaleSize: 6 },
      animationType: 'scale', animationEasing: 'elasticOut', animationDelay: (i) => i * 80,
      data,
    }],
  })

  useECharts(chartRef, getOption, [data], isDark)

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const chart = echarts.getInstanceByDom(el)
    if (!chart) return
    const handler = (p) => onDrill('species', p.name)
    chart.on('click', handler)
    return () => chart.off('click', handler)
  }, [data, onDrill])

  if (!data.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No species logged yet</div>
  return <div ref={chartRef} style={{ width:'100%', height: 220 }} />
}


// ── Category Heatmap — ECharts ───────────────────────────────────────────────
function CategoryHeatmap({ projects, categories, onDrill , isDark = false }) {
  const chartRef = useRef()

  const { years, cats, grid } = useMemo(() => {
    const ySet = new Set(), cSet = new Set()
    projects.forEach(p => {
      if (p.year_completed) ySet.add(String(p.year_completed))
      if (p.category) cSet.add(p.category)
    })
    const years = [...ySet].sort().slice(-8)
    const cats = categories.length ? categories.map(c => c.name) : [...cSet].sort()
    const grid = {}
    projects.forEach(p => {
      if (p.year_completed && p.category) {
        const k = `${p.category}||${p.year_completed}`
        grid[k] = (grid[k]||0) + 1
      }
    })
    return { years, cats, grid }
  }, [projects, categories])

  const data = useMemo(() => {
    const rows = []
    cats.forEach((cat, ci) => {
      years.forEach((yr, yi) => {
        const v = grid[`${cat}||${yr}`] || 0
        rows.push([yi, ci, v])
      })
    })
    return rows
  }, [cats, years, grid])

  const getOption = (dark) => ({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: p => `${cats[p.value[1]]} / ${years[p.value[0]]}: ${p.value[2]} project${p.value[2]!==1?'s':''}`,
      backgroundColor: dark ? '#1C2333' : '#fff',
      borderColor: dark ? 'rgba(240,246,252,.1)' : '#E2E8F0',
      textStyle: { color: EC.text(dark), fontSize: 12 },
    },
    grid: { top: 8, left: 80, right: 8, bottom: 24 },
    xAxis: {
      type: 'category', data: years,
      splitArea: { show: true, areaStyle: { color: ['transparent','transparent'] } },
      axisLabel: { color: EC.text2(dark), fontSize: 10 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: 'category', data: cats,
      splitArea: { show: true },
      axisLabel: { color: EC.text(dark), fontSize: 10, width: 72, overflow: 'truncate' },
      axisLine: { show: false }, axisTick: { show: false },
    },
    visualMap: {
      min: 0, max: Math.max(1, ...data.map(d => d[2])),
      show: false,
      inRange: { color: dark
        ? ['#161B22','#0D4429','#006D32','#26A641','#39D353']
        : ['#F0F4F8','#BBDBB4','#6EB86E','#26A641','#166534']
      },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, color: '#fff', fontSize: 10, formatter: p => p.value[2] || '' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.3)' } },
      itemStyle: { borderRadius: 3, borderWidth: 2, borderColor: dark ? '#161B22' : '#F0F4F8' },
      animationDelay: (i) => i * 15,
    }],
  })

  useECharts(chartRef, getOption, [data, cats, years], isDark)

  useEffect(() => {
    const el = chartRef.current; if (!el) return
    const chart = echarts.getInstanceByDom(el); if (!chart) return
    const handler = (p) => onDrill('category', cats[p.value[1]])
    chart.on('click', handler)
    return () => chart.off('click', handler)
  }, [cats, onDrill])

  if (!years.length || !cats.length) return (
    <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-3)', fontSize:13 }}>
      Add categories + years to projects
    </div>
  )
  return <div ref={chartRef} style={{ width:'100%', height: Math.max(120, cats.length * 28 + 40) }} />
}


// ── Finish Usage — ECharts horizontal bar ────────────────────────────────────
function FinishUsage({ projects, onDrill , isDark = false }) {
  const chartRef = useRef()

  const data = useMemo(() => {
    const m={}
    projects.forEach(p=>{ const f=p.finish_used?.trim(); if(f) m[f]=(m[f]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8)
  }, [projects])

  const getOption = (dark) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis', axisPointer:{type:'none'},
      backgroundColor: dark ? '#1C2333' : '#fff',
      borderColor: dark ? 'rgba(240,246,252,.1)' : '#E2E8F0',
      textStyle: { color: EC.text(dark), fontSize: 12 },
    },
    grid: { top:4, left:4, right:40, bottom:4, containLabel:true },
    xAxis: { type:'value', splitLine:{lineStyle:{color:EC.grid(dark)}}, axisLabel:{color:EC.text2(dark),fontSize:10} },
    yAxis: { type:'category', data:data.map(([n])=>n).reverse(), axisLabel:{color:EC.text(dark),fontSize:11}, axisTick:{show:false}, axisLine:{show:false} },
    series: [{
      type:'bar', barMaxWidth:20,
      data: data.map(([,v])=>v).reverse(),
      label: { show:true, position:'right', color:EC.text2(dark), fontSize:10 },
      itemStyle:{ color:{type:'linear',x:0,y:0,x2:1,y2:0, colorStops:[{offset:0,color:EC.green},{offset:1,color:'#4ADE80'}]}, borderRadius:[0,4,4,0] },
      emphasis:{ itemStyle:{opacity:0.8} },
      animationDelay: (i) => i*60,
    }],
  })

  useECharts(chartRef, getOption, [data], isDark)

  useEffect(()=>{
    const el=chartRef.current; if (!el) return
    const chart=echarts.getInstanceByDom(el); if(!chart) return
    const handler=(p)=>onDrill('finish', data[data.length-1-p.dataIndex]?.[0])
    chart.on('click',handler)
    return ()=>chart.off('click',handler)
  },[data,onDrill])

  if (!data.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No finishes logged yet</div>
  return <div ref={chartRef} style={{ width:'100%', height: Math.max(120, data.length*28) }} />
}



// ── Wood Source Map ───────────────────────────────────────────────────────────
function WoodSourceMap({ locations, woodStock, projectWoodSources, onLocationClick }) {
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
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true }).setView([centerLat || 43.5, centerLng || -71.5], mappable.length === 1 ? 10 : 7)
    mapInstance.current = map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{ attribution:'© CartoDB', maxZoom:19, subdomains:'abcd' }).addTo(map)
    mappable.forEach(loc => {
      const count = sourceCounts[loc.id] || 0
      const size = Math.max(24, Math.min(40, 24 + count * 4))
      const icon = L.divIcon({ className: '', html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:rgba(74,222,128,0.9);border:2px solid rgba(255,255,255,0.6);animation:markerPulse 2.4s ease-in-out infinite;display:flex;align-items:center;justify-content:center;color:#0F1E38;font-size:${count > 0 ? 11 : 9}px;font-weight:800;font-family:system-ui">${count > 0 ? count : '•'}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
      const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map)
      marker.bindPopup(`<strong>${loc.name}</strong>${loc.address ? '<br>' + loc.address : ''}${count ? '<br>' + count + ' project' + (count > 1 ? 's' : '') + ' — click to view' : ''}`)
      if (onLocationClick && count > 0) {
        marker.on('click', () => { setTimeout(() => onLocationClick(loc.name), 200) })
      }
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


// ── ECharts hook ──────────────────────────────────────────────────────────────
// Shared debounced ResizeObserver — one observer for all charts
const _chartRefs = new Set()
let _roTimer = null
const _ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
  clearTimeout(_roTimer)
  _roTimer = setTimeout(() => {
    _chartRefs.forEach(el => {
      const c = echarts.getInstanceByDom(el)
      if (c) c.resize()
    })
  }, 150)
}) : null

function useECharts(ref, getOption, deps, isDark) {
  useEffect(() => {
    if (!ref.current) return
    let chart = echarts.getInstanceByDom(ref.current) ||
                echarts.init(ref.current, null, { renderer: 'svg' })

    chart.setOption(getOption(isDark), { notMerge: true })

    // Register with shared observer
    if (_ro) { _ro.observe(ref.current); _chartRefs.add(ref.current) }

    return () => {
      if (_ro && ref.current) { _ro.unobserve(ref.current); _chartRefs.delete(ref.current) }
      chart?.dispose()
      chart = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, isDark])
}


// ── Theme colours ──────────────────────────────────────────────────────────────
const EC = {
  text:   (dark) => dark ? '#C9D1D9' : '#374151',
  text2:  (dark) => dark ? '#8B949E' : '#6B7280',
  bg:     (dark) => dark ? '#161B22' : '#FFFFFF',
  grid:   (dark) => dark ? 'rgba(240,246,252,.06)' : 'rgba(0,0,0,.06)',
  accent: '#1D4ED8',
  green:  '#166534',
  orange: '#B45309',
  purple: '#7C3AED',
  teal:   '#0891B2',
  palette: ['#1D4ED8','#166534','#B45309','#7C3AED','#0891B2','#BE185D','#15803D','#9333EA'],
}


// ── Material Flow Sankey (NEW) — species → category → finish ─────────────────
function MaterialFlow({ projects , isDark = false }) {
  const chartRef = useRef()

  const { nodes, links } = useMemo(() => {
    const nodeSet = new Set()
    const linkMap = {}
    projects.forEach(p => {
      const s = p.wood_type?.trim()
      const c = p.category?.trim()
      const f = p.finish_used?.trim()
      if (!s || !c) return
      const sc = `${s}→${c}`
      nodeSet.add('S:'+s); nodeSet.add('C:'+c)
      linkMap[sc] = (linkMap[sc]||0)+1
      if (f) {
        const cf = `${c}→${f}`
        nodeSet.add('F:'+f)
        linkMap[cf] = (linkMap[cf]||0)+1
      }
    })
    const nodes = [...nodeSet].map(n => ({
      name: n,
      itemStyle: { color: n.startsWith('S:') ? EC.accent : n.startsWith('C:') ? EC.green : EC.orange }
    }))
    const links = Object.entries(linkMap).map(([key,value]) => {
      const [from,to] = key.split('→')
      const src = nodeSet.has('S:'+from) ? 'S:'+from : nodeSet.has('C:'+from) ? 'C:'+from : 'F:'+from
      const tgt = nodeSet.has('C:'+to) ? 'C:'+to : 'F:'+to
      return { source:src, target:tgt, value }
    })
    return { nodes, links }
  }, [projects])

  const getOption = (dark) => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger:'item',
      backgroundColor: dark ? '#1C2333' : '#fff',
      borderColor: dark ? 'rgba(240,246,252,.1)' : '#E2E8F0',
      textStyle: { color:EC.text(dark), fontSize:12 },
      formatter: p => p.data.source
        ? `${p.data.source.slice(2)} → ${p.data.target.slice(2)}: ${p.data.value}`
        : p.name.slice(2),
    },
    series: [{
      type:'sankey', layout:'none',
      emphasis:{focus:'adjacency'},
      nodeWidth:12, nodeGap:8,
      data: nodes,
      links: links,
      label: { color:EC.text(dark), fontSize:10 },
      lineStyle: { color:'gradient', opacity:0.4 },
      animationDuration:1200, animationEasing:'cubicOut',
    }],
  })

  useECharts(chartRef, getOption, [nodes, links], isDark)
  if (!nodes.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>Log species + categories to see material flow</div>
  return <div ref={chartRef} style={{ width:'100%', height: Math.max(160, nodes.length * 18) }} />
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data, setProjId, setTab, navigate, theme } = useCtx()
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
        <KineticTitle text="Today" className="page-title" delay={80} />
      </div>
      <div style={{ paddingBottom: 32 }}>

        {/* ── Action Zone ─────────────────────────────────────────────── */}
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

        {upCoats.length > 0 && <>
          <span className="section-label">Upcoming Coats</span>
          <div className="group">
            {upCoats.map(c => { const st = coatStatus(c); return (
              <div key={c.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(c.project_id)}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{c.product}</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>Coat {c.coat_number} · {c.proj?.name} · {fmtShort(c.applied_at)}</div></div>
                <span style={{ fontSize: 14, color: st.color, fontWeight: 500 }}>{st.label}</span>
              </div>
            )})}
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
          <span className="section-label">Next Steps</span>
          <div className="group">
            {nextSteps.map(({ p, step }) => (
              <div key={p.id} className="cell" style={{ cursor: 'pointer' }} onClick={() => setProjId(p.id)}>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{p.name}</div><div style={{ fontSize: 13, color: 'var(--text-3)' }}>Next: {step.title}</div></div>
                <IChevR size={14} color="var(--text-4)" />
              </div>
            ))}
          </div>
        </>}

        {!hasUrgent && (
          <div className="empty" style={{ paddingTop: 32, paddingBottom: 0 }}>
            <div className="empty-icon">✅</div>
            <div className="empty-title">All clear</div>
            <p className="empty-sub">No coats ready, no overdue maintenance, no pending steps.</p>
          </div>
        )}

        {/* ── Continue Working ────────────────────────────────────────── */}
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

        {/* ── Analytics ───────────────────────────────────────────────── */}
        <span className="section-label" style={{ marginTop: 28 }}>Analytics</span>
        <div className="dash-grid">
          <div className="card"><div className="label-caps-sm">Projects by Year</div><ProjectsByYear projects={data.projects} photos={data.photos} onDrill={handleDrill} isDark={theme === 'dark'} /></div>
          <div className="card"><div className="label-caps-sm">Species Breakdown</div><SpeciesDonut projects={data.projects} onDrill={handleDrill} isDark={theme === 'dark'} /></div>
          <div className="card"><div className="label-caps-sm">Category Heatmap</div><CategoryHeatmap projects={data.projects} categories={cats} onDrill={handleDrill} isDark={theme === 'dark'} /></div>
          <div className="card"><div className="label-caps-sm">Finish Usage</div><FinishUsage projects={data.projects} onDrill={handleDrill} isDark={theme === 'dark'} /></div>
          <div className="card"><div className="label-caps-sm">Wood Source Map</div><WoodSourceMap locations={locations} woodStock={data.woodStock} projectWoodSources={data.projectWoodSources} onLocationClick={(locName) => { setTab('projects'); window.__woodLocationFilter = locName; }} /></div>
          <div className="card" style={{gridColumn:'1/-1'}}><div className="label-caps-sm">Material Flow — Species → Category → Finish</div><MaterialFlow projects={data.projects} isDark={theme === 'dark'} /></div>
        </div>
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

