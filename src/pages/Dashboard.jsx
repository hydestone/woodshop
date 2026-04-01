import { useMemo, useState, useEffect, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { coatStatus, maintStatus, fmtShort, fmt, IChevR, PhotoGrid } from '../components/Shared.jsx'
import * as db from '../db.js'

const SC = { active:'#1D4ED8', planning:'#7C3AED', paused:'#B45309', complete:'#166534' }
const SL = { active:'Active', planning:'Planning', paused:'Paused', complete:'Complete' }
const SO = ['complete','active','planning','paused']
const CARD = { background:'var(--surface)', borderRadius:'var(--r-md)', border:'1px solid var(--border-2)', padding:'16px 20px', boxShadow:'var(--shadow-sm)' }
const CARD_TITLE = { fontSize:12, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 }

// ── Year bar click panel ──────────────────────────────────────────────────────
function ProjectsByYear({ projects, photos, onOpen }) {
  const [selected, setSelected] = useState(null)
  const grouped = useMemo(() => {
    const m = {}
    projects.forEach(p => {
      const y = p.year_completed; if (!y) return
      if (!m[y]) m[y] = { active:0, planning:0, paused:0, complete:0 }
      m[y][p.status] = (m[y][p.status]||0)+1
    })
    return Object.entries(m).sort((a,b)=>Number(a[0])-Number(b[0]))
  }, [projects])

  if (!grouped.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No years set on projects yet</div>
  const max = Math.max(...grouped.map(([,c])=>Object.values(c).reduce((a,b)=>a+b,0)))

  const yearProjects = selected ? projects.filter(p => p.year_completed === Number(selected)) : []
  const thumbFor = pid => photos.find(ph => ph.project_id === pid && ph.tags?.includes('finished')) || photos.find(ph => ph.project_id === pid)

  return (
    <div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:14}}>
        {SO.map(s=><div key={s} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:SC[s]}}/><span style={{fontSize:11,color:'var(--text-3)'}}>{SL[s]}</span></div>)}
      </div>
      <div style={{display:'flex',alignItems:'flex-end',gap:8,overflowX:'auto',paddingBottom:4,minHeight:120}}>
        {grouped.map(([y,c])=>{
          const tot=Object.values(c).reduce((a,b)=>a+b,0)
          const h=Math.max(20,(tot/max)*100)
          const isSelected = selected === y
          return (
            <div key={y} onClick={()=>setSelected(isSelected?null:y)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flexShrink:0,minWidth:40,cursor:'pointer',opacity:selected&&!isSelected?0.4:1,transition:'opacity 150ms'}}>
              <span style={{fontSize:11,fontWeight:600,color:'var(--text-2)'}}>{tot}</span>
              <div style={{display:'flex',flexDirection:'column-reverse',width:28,height:h,borderRadius:4,overflow:'hidden',outline:isSelected?'2px solid var(--accent)':'none',outlineOffset:2}}>
                {SO.map(s=>c[s]>0&&<div key={s} style={{background:SC[s],height:(c[s]/tot*100)+'%',minHeight:2}}/>)}
              </div>
              <span style={{fontSize:10,color:isSelected?'var(--accent)':'var(--text-3)',fontWeight:isSelected?700:400}}>{y}</span>
            </div>
          )
        })}
      </div>

      {selected && (
        <div style={{marginTop:16,borderTop:'1px solid var(--border-2)',paddingTop:14}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--text-2)',marginBottom:10}}>{selected} — {yearProjects.length} project{yearProjects.length!==1?'s':''}</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {yearProjects.map(p=>{
              const thumb = thumbFor(p.id)
              return (
                <div key={p.id} onClick={()=>onOpen(p.id)} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',padding:'6px 8px',borderRadius:8,background:'var(--fill-2)'}}>
                  {thumb
                    ? <img src={thumb.url} alt={p.name} style={{width:40,height:40,objectFit:'cover',borderRadius:6,flexShrink:0}}/>
                    : <div style={{width:40,height:40,borderRadius:6,background:'var(--fill)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🪵</div>
                  }
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                    <div style={{fontSize:11,color:'var(--text-3)'}}>{[p.wood_type,p.category].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{width:8,height:8,borderRadius:2,background:SC[p.status],flexShrink:0}}/>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Species Donut ─────────────────────────────────────────────────────────────
function SpeciesDonut({ projects }) {
  const data = useMemo(() => {
    const m = {}
    projects.forEach(p => { const s=p.wood_type?.trim(); if(s) m[s]=(m[s]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8)
  }, [projects])
  const COLORS = ['#1D4ED8','#166534','#B45309','#7C3AED','#0891B2','#BE185D','#15803D','#9333EA']
  const total = data.reduce((a,[,v])=>a+v,0)
  if (!data.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No species logged yet</div>
  let angle = -90
  const slices = data.map(([name,count],i) => {
    const pct = count/total, deg = pct*360
    const start = angle, end = angle+deg; angle+=deg
    const r=40, cx=50, cy=50
    const toRad=d=>d*Math.PI/180
    const x1=cx+r*Math.cos(toRad(start)), y1=cy+r*Math.sin(toRad(start))
    const x2=cx+r*Math.cos(toRad(end)),   y2=cy+r*Math.sin(toRad(end))
    const large=deg>180?1:0
    return { name, count, pct, color:COLORS[i%COLORS.length], d:`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z` }
  })
  return (
    <div style={{display:'flex',alignItems:'center',gap:16}}>
      <svg viewBox="0 0 100 100" style={{width:90,height:90,flexShrink:0}}>
        {slices.map((s,i)=><path key={i} d={s.d} fill={s.color}/>)}
        <circle cx="50" cy="50" r="22" fill="var(--surface)"/>
        <text x="50" y="47" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-2)">{total}</text>
        <text x="50" y="57" textAnchor="middle" fontSize="7" fill="var(--text-3)">projects</text>
      </svg>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
        {slices.slice(0,6).map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
            <span style={{fontSize:11,color:'var(--text-2)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
            <span style={{fontSize:11,color:'var(--text-3)',flexShrink:0}}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Category Heatmap ──────────────────────────────────────────────────────────
function CategoryHeatmap({ projects, categories }) {
  const { years, cats, grid } = useMemo(() => {
    const ySet=new Set(), cSet=new Set()
    projects.forEach(p=>{ if(p.year_completed) ySet.add(p.year_completed); if(p.category) cSet.add(p.category) })
    const years=[...ySet].sort((a,b)=>a-b).slice(-8)
    const cats=categories.length ? categories.map(c=>c.name) : [...cSet]
    const grid={}
    projects.forEach(p=>{ if(p.year_completed&&p.category) { const k=p.category+'|'+p.year_completed; grid[k]=(grid[k]||0)+1 } })
    return { years, cats, grid }
  }, [projects, categories])
  if (!years.length||!cats.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>Add categories + years to projects</div>
  const max=Math.max(1,...Object.values(grid))
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',fontSize:11,width:'100%'}}>
        <thead><tr>
          <td style={{padding:'2px 6px',color:'var(--text-4)',width:80}}></td>
          {years.map(y=><th key={y} style={{padding:'2px 6px',fontWeight:500,color:'var(--text-3)',textAlign:'center'}}>{y}</th>)}
        </tr></thead>
        <tbody>{cats.map(cat=>(
          <tr key={cat}>
            <td style={{padding:'3px 6px',color:'var(--text-2)',fontWeight:500,fontSize:11,whiteSpace:'nowrap',maxWidth:80,overflow:'hidden',textOverflow:'ellipsis'}}>{cat}</td>
            {years.map(y=>{
              const v=grid[cat+'|'+y]||0
              const intensity=v/max
              return <td key={y} style={{padding:'2px 4px',textAlign:'center'}}>
                <div style={{width:28,height:20,borderRadius:4,background:v?`rgba(22,101,52,${0.15+intensity*0.8})`:'var(--fill-2)',margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {v>0&&<span style={{fontSize:10,fontWeight:600,color:intensity>0.5?'#fff':'var(--forest)'}}>{v}</span>}
                </div>
              </td>
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

// ── Finish Usage ──────────────────────────────────────────────────────────────
function FinishUsage({ projects }) {
  const data = useMemo(() => {
    const m={}
    projects.forEach(p=>{ const f=p.finish_used?.trim(); if(f) m[f]=(m[f]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8)
  }, [projects])
  if (!data.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No finishes logged yet</div>
  const max=data[0][1]
  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {data.map(([name,count])=>(
        <div key={name}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
            <span style={{fontSize:12,color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'80%'}}>{name}</span>
            <span style={{fontSize:12,color:'var(--text-3)',flexShrink:0,marginLeft:8}}>{count}</span>
          </div>
          <div style={{height:6,borderRadius:3,background:'var(--fill)'}}>
            <div style={{height:6,borderRadius:3,background:'#166534',width:(count/max*100)+'%'}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Status Pipeline ───────────────────────────────────────────────────────────
function StatusPipeline({ projects }) {
  const counts = useMemo(()=>SO.reduce((acc,s)=>({...acc,[s]:projects.filter(p=>p.status===s).length}),{}), [projects])
  const total = projects.length
  return (
    <div>
      <div style={{display:'flex',borderRadius:8,overflow:'hidden',height:20,marginBottom:12}}>
        {SO.map(s=>counts[s]>0&&<div key={s} style={{background:SC[s],flex:counts[s],minWidth:4}} title={SL[s]+': '+counts[s]}/>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {SO.map(s=>(
          <div key={s} style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:10,height:10,borderRadius:2,background:SC[s],flexShrink:0}}/>
            <div>
              <div style={{fontSize:15,fontWeight:600,color:'var(--text)'}}>{counts[s]}</div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>{SL[s]}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:8,fontSize:12,color:'var(--text-4)'}}>{total} projects total</div>
    </div>
  )
}

// ── Wood Source Leaflet Map ───────────────────────────────────────────────────
function WoodSourceMap({ locations, projects }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)

  const sourceCounts = useMemo(()=>{
    const m={}
    projects.forEach(p=>{ if(p.wood_location_id) m[p.wood_location_id]=(m[p.wood_location_id]||0)+1 })
    return m
  },[projects])

  const mappable = locations.filter(l=>l.lat&&l.lng)

  useEffect(()=>{
    if (!mapRef.current || mappable.length===0) return
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current=null }

    const L = window.L
    if (!L) return

    const lats = mappable.map(l=>l.lat), lngs = mappable.map(l=>l.lng)
    const centerLat = (Math.min(...lats)+Math.max(...lats))/2
    const centerLng = (Math.min(...lngs)+Math.max(...lngs))/2

    const map = L.map(mapRef.current, { zoomControl:true, scrollWheelZoom:false }).setView([centerLat||43.5, centerLng||-71.5], mappable.length===1?10:7)
    mapInstance.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      attribution:'© OpenStreetMap', maxZoom:19
    }).addTo(map)

    mappable.forEach(loc=>{
      const count = sourceCounts[loc.id]||0
      const size = Math.max(24, Math.min(40, 24+count*4))
      const icon = L.divIcon({
        className:'',
        html:`<div style="width:${size}px;height:${size}px;border-radius:50%;background:#0F1E38;border:2px solid #BFDBFE;display:flex;align-items:center;justify-content:center;color:#fff;font-size:${count>0?11:9}px;font-weight:700;font-family:system-ui">${count>0?count:'📍'}</div>`,
        iconSize:[size,size], iconAnchor:[size/2,size/2]
      })
      L.marker([loc.lat,loc.lng],{icon}).addTo(map)
        .bindPopup(`<strong>${loc.name}</strong>${loc.address?'<br>'+loc.address:''}${count?'<br>'+count+' project'+(count>1?'s':''):''}`)
    })

    return ()=>{ if(mapInstance.current) { mapInstance.current.remove(); mapInstance.current=null } }
  },[mappable, sourceCounts])

  if (!locations.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No wood locations added yet</div>

  if (mappable.length===0) return (
    <div>
      {locations.map(l=>(
        <div key={l.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--border-2)'}}>
          <span style={{fontSize:12,color:'var(--text-2)'}}>{l.name}</span>
          <span style={{fontSize:12,color:'var(--text-3)'}}>{sourceCounts[l.id]||0} projects</span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div ref={mapRef} style={{height:200,borderRadius:8,overflow:'hidden',border:'1px solid var(--border-2)'}}/>
      <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:4}}>
        {locations.slice(0,4).map(l=>(
          <div key={l.id} style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
            <span style={{color:'var(--text-2)'}}>{l.name}</span>
            <span style={{color:'var(--text-3)'}}>{sourceCounts[l.id]||0} uses</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Build Rate ────────────────────────────────────────────────────────────────
function BuildRate({ projects }) {
  const data = useMemo(()=>{
    const m={}
    projects.forEach(p=>{ const y=p.year_completed; if(!y) return; m[y+'']=( m[y+'']||0)+1 })
    const now=new Date().getFullYear()
    const years=[]
    for(let y=now-4;y<=now;y++) years.push(String(y))
    return years.map(y=>({label:y,count:m[y]||0}))
  }, [projects])
  const max=Math.max(1,...data.map(d=>d.count))
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height:80}}>
      {data.map(d=>(
        <div key={d.label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
          <span style={{fontSize:11,color:'var(--text-3)'}}>{d.count||''}</span>
          <div style={{width:'100%',borderRadius:4,background:d.count?'#1D4ED8':'var(--fill)',height:d.count?Math.max(8,(d.count/max)*56):8}}/>
          <span style={{fontSize:10,color:'var(--text-4)'}}>{d.label.slice(2)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Moisture Trend ────────────────────────────────────────────────────────────
function MoistureTrend({ woodStock }) {
  const [selected, setSelected] = useState(null)
  const [logs, setLogs] = useState({})

  const loadLog = async (item) => {
    if (logs[item.id]!==undefined) { setSelected(item); return }
    try {
      const rows = await db.loadMoistureLog(item.id)
      setLogs(prev=>({...prev,[item.id]:rows}))
      setSelected(item)
    } catch(e) { setLogs(prev=>({...prev,[item.id]:[]})); setSelected(item) }
  }

  if (!woodStock.length) return <div style={{textAlign:'center',padding:'24px 0',color:'var(--text-3)',fontSize:13}}>No wood stock logged yet</div>

  const cur = selected ? (logs[selected.id]||[]).sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)) : []
  const target = 8
  const maxMC = cur.length ? Math.max(target+2,...cur.map(r=>r.reading)) : 30

  return (
    <div>
      <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:12,paddingBottom:4}}>
        {woodStock.slice(0,8).map(w=>(
          <button key={w.id} onClick={()=>loadLog(w)} style={{
            padding:'4px 10px',borderRadius:99,border:'none',cursor:'pointer',flexShrink:0,
            fontSize:12,fontFamily:'inherit',fontWeight:500,
            background:selected?.id===w.id?'#0F1E38':'var(--fill)',
            color:selected?.id===w.id?'#fff':'var(--text-2)'
          }}>{w.species}</button>
        ))}
      </div>
      {!selected && <div style={{textAlign:'center',padding:'16px 0',color:'var(--text-3)',fontSize:13}}>Select a log above</div>}
      {selected && cur.length===0 && <div style={{textAlign:'center',padding:'16px 0',color:'var(--text-3)',fontSize:13}}>No readings for {selected.species}</div>}
      {selected && cur.length>0 && (
        <div>
          <div style={{position:'relative',height:80}}>
            <svg viewBox="0 0 200 80" style={{width:'100%',height:'100%'}}>
              <line x1="0" y1={80*(1-target/maxMC)} x2="200" y2={80*(1-target/maxMC)} stroke="#166534" strokeWidth="1" strokeDasharray="4,2" opacity="0.5"/>
              {cur.length>1&&<polyline points={cur.map((r,i)=>`${i/(cur.length-1)*200},${80*(1-r.reading/maxMC)}`).join(' ')} fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinejoin="round"/>}
              {cur.map((r,i)=><circle key={i} cx={cur.length>1?i/(cur.length-1)*200:100} cy={80*(1-r.reading/maxMC)} r="3" fill="#1D4ED8"/>)}
            </svg>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
            <span style={{fontSize:11,color:'var(--text-3)'}}>{fmt(cur[0]?.logged_at)}</span>
            <span style={{fontSize:11,color:'var(--forest)'}}>— target {target}%</span>
            <span style={{fontSize:11,color:'var(--text-3)'}}>{fmt(cur[cur.length-1]?.logged_at)}</span>
          </div>
          <div style={{marginTop:6,fontSize:12,color:'var(--text-2)'}}>
            Latest: <strong>{cur[cur.length-1]?.reading}%</strong>
            {cur[cur.length-1]?.reading<=target&&<span style={{color:'var(--forest)',marginLeft:8,fontSize:11,fontWeight:600}}>✓ Ready</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data, setProjId, setTab } = useCtx()
  const today = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})
  const [locations, setLocations] = useState(data.woodLocations||[])

  useEffect(()=>{
    // Load Leaflet CSS + JS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id='leaflet-css'; link.rel='stylesheet'
      link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!window.L) {
      const script = document.createElement('script')
      script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      document.head.appendChild(script)
    }
    db.loadWoodLocations().then(locs=>setLocations(locs)).catch(()=>{})
  },[])

  const urgCoats = data.coats.filter(c=>c.applied_at&&coatStatus(c).urgent).map(c=>({...c,proj:data.projects.find(p=>p.id===c.project_id)}))
  const upCoats  = data.coats.filter(c=>c.applied_at&&!coatStatus(c).urgent).map(c=>({...c,proj:data.projects.find(p=>p.id===c.project_id)})).slice(0,3)
  const urgMaint = data.maintenance.filter(m=>maintStatus(m).urgent)
  const nextSteps = data.projects.filter(p=>p.status==='active').flatMap(p=>{
    const step=data.steps.filter(s=>s.project_id===p.id&&!s.completed).sort((a,b)=>a.sort_order-b.sort_order)[0]
    return step?[{p,step}]:[]
  })
  const hasUrgent = urgCoats.length||urgMaint.length||nextSteps.length
  const cats = data.categories||[]

  return (
    <div className="scroll-page">
      <div className="page-header">
        <p className="page-subtitle">{today}</p>
        <h1 className="page-title">Today</h1>
      </div>
      <div style={{paddingBottom:32}}>

        {urgCoats.length>0&&<>
          <span className="section-label">Ready to Apply</span>
          <div className="group">
            {urgCoats.map(c=>(
              <div key={c.id} className="cell" style={{cursor:'pointer'}} onClick={()=>setProjId(c.project_id)}>
                <span style={{fontSize:11,fontWeight:700,color:'#fff',background:'var(--orange)',borderRadius:6,padding:'2px 8px',flexShrink:0}}>Now</span>
                <div style={{flex:1}}><div style={{fontWeight:500}}>{c.product}</div><div style={{fontSize:13,color:'var(--text-3)'}}>Coat {c.coat_number} · {c.proj?.name}</div></div>
                <IChevR size={14} color="var(--text-4)"/>
              </div>
            ))}
          </div>
        </>}

        {urgMaint.length>0&&<>
          <span className="section-label">Needs Attention</span>
          <div className="group">
            {urgMaint.map(m=>{const st=maintStatus(m);return(
              <div key={m.id} className="cell">
                <span style={{fontSize:12,fontWeight:600,color:st.color,background:st.color==='var(--red)'?'var(--red-dim)':'var(--orange-dim)',borderRadius:6,padding:'2px 8px',flexShrink:0}}>{st.label}</span>
                <div style={{flex:1}}><div style={{fontWeight:500}}>{m.name}</div><div style={{fontSize:13,color:'var(--text-3)'}}>{m.category}</div></div>
              </div>
            )})}
          </div>
        </>}

        {nextSteps.length>0&&<>
          <span className="section-label">Active Projects</span>
          <div className="group">
            {nextSteps.map(({p,step})=>(
              <div key={p.id} className="cell" style={{cursor:'pointer'}} onClick={()=>setProjId(p.id)}>
                <div style={{flex:1}}><div style={{fontWeight:500}}>{p.name}</div><div style={{fontSize:13,color:'var(--text-3)'}}>Next: {step.title}</div></div>
                <IChevR size={14} color="var(--text-4)"/>
              </div>
            ))}
          </div>
        </>}

        {!hasUrgent&&<div className="empty" style={{paddingTop:32,paddingBottom:0}}><div className="empty-icon">🪵</div><div className="empty-title">All clear</div><p className="empty-sub">Nothing urgent today.</p></div>}

        <span className="section-label" style={{marginTop:28}}>Analytics</span>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,padding:'0 20px'}}>
          <div style={CARD}><div style={CARD_TITLE}>Projects by Year</div><ProjectsByYear projects={data.projects} photos={data.photos} onOpen={setProjId}/></div>
          <div style={CARD}><div style={CARD_TITLE}>Species Breakdown</div><SpeciesDonut projects={data.projects}/></div>
          <div style={CARD}><div style={CARD_TITLE}>Category Heatmap</div><CategoryHeatmap projects={data.projects} categories={cats}/></div>
          <div style={CARD}><div style={CARD_TITLE}>Finish Usage</div><FinishUsage projects={data.projects}/></div>
          <div style={CARD}><div style={CARD_TITLE}>Project Status</div><StatusPipeline projects={data.projects}/></div>
          <div style={{...CARD,gridColumn:'span 1'}}><div style={CARD_TITLE}>Wood Source Map</div><WoodSourceMap locations={locations} projects={data.projects}/></div>
          <div style={CARD}><div style={CARD_TITLE}>Build Rate (5yr)</div><BuildRate projects={data.projects}/></div>
          <div style={CARD}><div style={CARD_TITLE}>Moisture Trends</div><MoistureTrend woodStock={data.woodStock}/></div>
        </div>

        {data.photos.length>0&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'24px 20px 6px'}}>
            <span style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px'}}>Recent Photos</span>
            <button className="btn-text" onClick={()=>setTab('photos')}>See all</button>
          </div>
          <PhotoGrid photos={data.photos.slice(0,8)} showProject projects={data.projects}/>
        </>}

        {upCoats.length>0&&<>
          <span className="section-label" style={{marginTop:8}}>Upcoming Coats</span>
          <div className="group">
            {upCoats.map(c=>{const st=coatStatus(c);return(
              <div key={c.id} className="cell" style={{cursor:'pointer'}} onClick={()=>setProjId(c.project_id)}>
                <div style={{flex:1}}><div style={{fontWeight:500}}>{c.product}</div><div style={{fontSize:13,color:'var(--text-3)'}}>Coat {c.coat_number} · {c.proj?.name} · {fmtShort(c.applied_at)}</div></div>
                <span style={{fontSize:14,color:st.color,fontWeight:500}}>{st.label}</span>
              </div>
            )})}
          </div>
        </>}

      </div>
    </div>
  )
}
