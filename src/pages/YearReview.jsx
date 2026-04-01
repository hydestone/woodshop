import { useState, useMemo } from 'react'
import { useCtx } from '../App.jsx'

const STATUS_COLORS = { active:'#1D4ED8', planning:'#7C3AED', paused:'#B45309', complete:'#166534' }

export default function YearReview() {
  const { data } = useCtx()
  const currentYear = new Date().getFullYear()
  const availableYears = useMemo(()=>{
    const ys = new Set(data.projects.map(p=>p.year_completed).filter(Boolean))
    if (!ys.has(currentYear)) ys.add(currentYear)
    return [...ys].sort((a,b)=>b-a)
  },[data.projects])

  const [year, setYear] = useState(currentYear)

  const stats = useMemo(()=>{
    const projs = data.projects.filter(p=>p.year_completed===year)
    const species = {}
    const finishes = {}
    const categories = {}
    const recipients = []
    projs.forEach(p=>{
      if(p.wood_type) species[p.wood_type]=(species[p.wood_type]||0)+1
      if(p.finish_used) finishes[p.finish_used]=(finishes[p.finish_used]||0)+1
      if(p.category) categories[p.category]=(categories[p.category]||0)+1
      if(p.gift_recipient) recipients.push({name:p.gift_recipient,project:p.name})
    })
    const topSpecies = Object.entries(species).sort((a,b)=>b[1]-a[1])
    const topFinish  = Object.entries(finishes).sort((a,b)=>b[1]-a[1])[0]?.[0]
    const topCat     = Object.entries(categories).sort((a,b)=>b[1]-a[1])[0]?.[0]
    const photos = data.photos.filter(ph=>{
      const proj = data.projects.find(p=>p.id===ph.project_id)
      return proj?.year_completed===year && ph.photo_type==='finished'
    })
    return { projs, species, finishes, categories, topSpecies, topFinish, topCat, recipients, photos }
  },[data, year])

  const shareText = `JDH Woodworks ${year} in Review: ${stats.projs.length} pieces completed${stats.topSpecies[0]?`, mostly in ${stats.topSpecies[0][0]}`:''}. #woodworking #handmade`

  return (
    <div className="scroll-page">
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <h1 className="page-title" style={{margin:0}}>Year in Review</h1>
          <select className="form-select" value={year} onChange={e=>setYear(Number(e.target.value))} style={{width:'auto'}}>
            {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{padding:'0 20px 40px'}}>
        {stats.projs.length===0 ? (
          <div className="empty" style={{paddingTop:40}}>
            <div className="empty-icon">📅</div>
            <div className="empty-title">No projects in {year}</div>
            <p className="empty-sub">Add year_completed to your projects to see your review</p>
          </div>
        ) : (
          <>
            {/* Hero stat */}
            <div style={{background:'#0F1E38',borderRadius:16,padding:'28px 24px',marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:56,fontWeight:800,color:'#fff',lineHeight:1}}>{stats.projs.length}</div>
              <div style={{fontSize:16,color:'#8BA8D0',marginTop:4}}>piece{stats.projs.length!==1?'s':''} completed in {year}</div>
              {stats.topSpecies[0]&&<div style={{fontSize:13,color:'#BFDBFE',marginTop:8}}>Favourite wood: {stats.topSpecies[0][0]}</div>}
            </div>

            {/* Stat grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
              {[
                {label:'Species used', value:Object.keys(stats.species).length},
                {label:'Top finish',   value:stats.topFinish||'—'},
                {label:'Top category', value:stats.topCat||'—'},
                {label:'Gifts given',  value:stats.recipients.length},
                {label:'Photos taken', value:stats.photos.length},
              ].map(s=>(
                <div key={s.label} style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:'14px 16px'}}>
                  <div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:18,fontWeight:700,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Species breakdown */}
            {stats.topSpecies.length>0&&(
              <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:'16px',marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>Species Breakdown</div>
                {stats.topSpecies.map(([name,count])=>(
                  <div key={name} style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                      <span style={{fontSize:13,color:'var(--text-2)'}}>{name}</span>
                      <span style={{fontSize:13,color:'var(--text-3)'}}>{count}</span>
                    </div>
                    <div style={{height:6,borderRadius:3,background:'var(--fill)'}}>
                      <div style={{height:6,borderRadius:3,background:'#166534',width:(count/stats.projs.length*100)+'%'}}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Projects list */}
            <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:'16px',marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>All {year} Projects</div>
              {stats.projs.map((p,i)=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<stats.projs.length-1?'1px solid var(--border-2)':'none'}}>
                  <div style={{width:8,height:8,borderRadius:2,background:STATUS_COLORS[p.status],flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                    <div style={{fontSize:12,color:'var(--text-3)'}}>{[p.wood_type,p.category,p.gift_recipient&&'🎁 '+p.gift_recipient].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Gifts */}
            {stats.recipients.length>0&&(
              <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:'16px',marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>Gifts & Recipients</div>
                {stats.recipients.map((r,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:i<stats.recipients.length-1?'1px solid var(--border-2)':'none'}}>
                    <span style={{fontSize:13,color:'var(--text-2)'}}>{r.project}</span>
                    <span style={{fontSize:13,color:'var(--text-3)'}}>🎁 {r.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Share button */}
            <button className="btn-secondary" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={()=>{
              if(navigator.share) navigator.share({title:`JDH Woodworks ${year}`,text:shareText})
              else { navigator.clipboard.writeText(shareText); }
            }}>
              Share {year} Summary
            </button>
          </>
        )}
      </div>
    </div>
  )
}
