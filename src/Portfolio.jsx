import { useEffect, useState } from 'react'
import { supabase, BUCKET, photoUrl } from '../supabase.js'

// ── Ron Swanson splash screen ──────────────────────────────────────────────────
function RonSplash({ onDone }) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 1800)
    const doneTimer = setTimeout(() => onDone(), 2400)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0F1E38',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 600ms ease',
      opacity: fade ? 0 : 1,
      pointerEvents: fade ? 'none' : 'all',
    }}>
      <style>{`
        @keyframes ronFadeIn { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
        @keyframes quoteUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
      <img
        src="/ronswanson.webp"
        alt="Ron Swanson"
        style={{
          width: 180, height: 180, objectFit: 'cover', objectPosition: 'top',
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,.15)',
          animation: 'ronFadeIn .5s ease forwards',
          marginBottom: 28,
          boxShadow: '0 8px 40px rgba(0,0,0,.5)',
        }}
      />
      <p style={{
        color: '#BFDBFE',
        fontSize: 13, fontWeight: 700,
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 12,
        animation: 'quoteUp .5s .2s ease both',
      }}>
        Welcome
      </p>
      <p style={{
        color: '#fff',
        fontSize: 20, fontWeight: 700,
        maxWidth: 320, textAlign: 'center',
        lineHeight: 1.4,
        animation: 'quoteUp .5s .35s ease both',
        padding: '0 24px',
      }}>
        "Give a man a fish and feed him for a day. Don't teach a man to fish and feed yourself. He's a grown man. Fishing's not that hard."
      </p>
      <p style={{
        color: 'rgba(255,255,255,.3)',
        fontSize: 12, marginTop: 16,
        animation: 'quoteUp .5s .5s ease both',
      }}>— Ron Swanson</p>
    </div>
  )
}

export default function Portfolio() {
  const [photos, setPhotos]       = useState([])
  const [projects, setProjects]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [lightbox, setLightbox]   = useState(null)
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('photos').select('*').ilike('tags','%portfolio%').order('created_at',{ascending:false}),
      supabase.from('projects').select('*').eq('status','complete'),
    ]).then(([ph, pr]) => {
      setPhotos((ph.data||[]).map(p=>({...p,url:photoUrl(p.storage_path)})))
      setProjects(pr.data||[])
      setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  const projFor = id => projects.find(p=>p.id===id)

  return (
    <>
      {showSplash && <RonSplash onDone={() => setShowSplash(false)} />}

      <div style={{
        minHeight:'100vh', background:'#F0F4F8',
        fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
        opacity: showSplash ? 0 : 1,
        transition: 'opacity 400ms ease',
      }}>

        {/* Header */}
        <div style={{background:'#0F1E38',padding:'48px 24px 40px',textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:600,letterSpacing:2,color:'#BFDBFE',textTransform:'uppercase',marginBottom:12}}>Handcrafted in Sherborn, MA</div>
          <h1 style={{fontSize:32,fontWeight:700,color:'#fff',margin:0}}>JDH Woodworks</h1>
          <p style={{color:'#8BA8D0',marginTop:8,fontSize:15}}>Bowls · Furniture · Turning · Hand Tools</p>
          <div style={{marginTop:16,fontSize:13,color:'#64748B'}}>{photos.length} finished piece{photos.length!==1?'s':''}</div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{textAlign:'center',padding:'80px 24px',color:'#64748B'}}>
            <div style={{width:32,height:32,border:'3px solid #0F1E38',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : photos.length===0 ? (
          <div style={{textAlign:'center',padding:'80px 24px',color:'#64748B'}}>
            <div style={{fontSize:48,marginBottom:16}}>🪵</div>
            <div style={{fontSize:18,fontWeight:600,color:'#1E293B',marginBottom:8}}>No pieces yet</div>
            <p>Tag photos "portfolio" in JDH Woodworks to populate this page.</p>
          </div>
        ) : (
          <div style={{maxWidth:1100,margin:'0 auto',padding:'32px 16px'}}>
            <div style={{columns:'280px',columnGap:16}}>
              {photos.map(photo=>{
                const proj = projFor(photo.project_id)
                return (
                  <div key={photo.id} style={{breakInside:'avoid',marginBottom:16,background:'#fff',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.08)',cursor:'pointer'}} onClick={()=>setLightbox(photo)}>
                    <img src={photo.url} alt={photo.caption||proj?.name||'Finished piece'} loading="lazy" style={{width:'100%',display:'block',objectFit:'cover'}}/>
                    {(photo.caption||proj) && (
                      <div style={{padding:'12px 14px'}}>
                        {photo.caption&&<div style={{fontWeight:500,fontSize:14,color:'#0F172A'}}>{photo.caption}</div>}
                        {proj&&<div style={{fontSize:12,color:'#64748B',marginTop:2}}>
                          {proj.wood_type&&<span>{proj.wood_type}</span>}
                          {proj.year_completed&&<span> · {proj.year_completed}</span>}
                          {proj.finish_used&&<span> · {proj.finish_used}</span>}
                        </div>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{background:'#0F1E38',padding:'24px',textAlign:'center',marginTop:32}}>
          <p style={{color:'#64748B',fontSize:13,margin:0}}>JDH Woodworks · All pieces handcrafted in Sherborn, MA</p>
        </div>

        {/* Lightbox */}
        {lightbox&&(
          <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,cursor:'pointer'}}>
            <img src={lightbox.url} alt="" style={{maxWidth:'90vw',maxHeight:'90vh',objectFit:'contain',borderRadius:8}}/>
          </div>
        )}
      </div>
    </>
  )
}
