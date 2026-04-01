import { useEffect, useState } from 'react'
import { supabase, BUCKET, photoUrl } from '../supabase.js'

export default function Portfolio() {
  const [photos, setPhotos]     = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('photos').select('*').eq('photo_type','finished').order('created_at',{ascending:false}),
      supabase.from('projects').select('*').eq('status','complete'),
    ]).then(([ph, pr]) => {
      setPhotos((ph.data||[]).map(p=>({...p,url:photoUrl(p.storage_path)})))
      setProjects(pr.data||[])
      setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  const projFor = id => projects.find(p=>p.id===id)

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F0F4F8'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:48,height:48,border:'3px solid #0F1E38',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 16px'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{color:'#64748B',fontSize:14}}>Loading portfolio…</p>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:'#F0F4F8',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif'}}>
      {/* Header */}
      <div style={{background:'#0F1E38',padding:'48px 24px 40px',textAlign:'center'}}>
        <div style={{fontSize:13,fontWeight:600,letterSpacing:2,color:'#BFDBFE',textTransform:'uppercase',marginBottom:12}}>Handcrafted in Sherborn, MA</div>
        <h1 style={{fontSize:32,fontWeight:700,color:'#fff',margin:0}}>JDH Woodworks</h1>
        <p style={{color:'#8BA8D0',marginTop:8,fontSize:15}}>Bowls · Furniture · Turning · Hand Tools</p>
        <div style={{marginTop:16,fontSize:13,color:'#64748B'}}>{photos.length} finished piece{photos.length!==1?'s':''}</div>
      </div>

      {/* Grid */}
      {photos.length===0 ? (
        <div style={{textAlign:'center',padding:'80px 24px',color:'#64748B'}}>
          <div style={{fontSize:48,marginBottom:16}}>🪵</div>
          <div style={{fontSize:18,fontWeight:600,color:'#1E293B',marginBottom:8}}>No pieces yet</div>
          <p>Upload photos tagged "finished" in JDH Woodworks to populate your portfolio.</p>
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
        <p style={{color:'#64748B',fontSize:13,margin:0}}>Built with JDH Woodworks · All pieces handcrafted</p>
      </div>

      {/* Lightbox */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.9)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,cursor:'pointer'}}>
          <img src={lightbox.url} alt="" style={{maxWidth:'90vw',maxHeight:'90vh',objectFit:'contain',borderRadius:8}}/>
        </div>
      )}
    </div>
  )
}
