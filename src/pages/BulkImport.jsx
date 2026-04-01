import { useState, useRef, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { uid } from '../db.js'

const DEST = { NEW: 'new', EXISTING: 'existing', STOCK: 'stock' }

function PhotoLightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      <img src={src} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
    </div>
  )
}

// ── Phase 2: Cleanup table ────────────────────────────────────────────────────
function CleanupTable({ newProjects, onDone }) {
  const { data, mutate } = useCtx()
  const toast = useToast()

  const categories  = data.categories  || []
  const speciesList = data.species     || []
  const finishesList= data.finishes    || []
  const woodStock   = data.woodStock   || []
  const woodLocations = data.woodLocations || []

  const save = async (id, field, value) => {
    try {
      mutate(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, [field]: value } : p) }))
      await db.updateProject(id, { [field]: value })
    } catch(e) { toast(e.message, 'error') }
  }

  const inp = { background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 13, color: 'var(--text)', width: '100%' }
  const sel = { ...inp, cursor: 'pointer' }
  const th = { padding: '9px 10px', color: '#CBD5E1', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'left', whiteSpace: 'nowrap', background: '#0F1E38' }
  const td = (i) => ({ padding: '7px 8px', borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--fill-2)' })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Clean Up</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{newProjects.length} projects imported — fill in details, click Done when finished.</p>
          </div>
          <button className="btn-primary" style={{ padding: '10px 28px', justifyContent: 'center' }} onClick={onDone}>Done</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '0 20px 40px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              {['Project','Species','Category','Finish','Year','Status','Built With','Gift / Recipient'].map((h,i) => (
                <th key={i} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {newProjects.map((proj, i) => {
              const live = data.projects.find(p => p.id === proj.id) || proj
              return (
                <tr key={proj.id}>
                  <td style={{ ...td(i), minWidth: 140, fontWeight: 500 }}>
                    <input style={inp} defaultValue={live.name}
                      onBlur={e => { if (e.target.value.trim() !== live.name) save(proj.id, 'name', e.target.value.trim()) }} />
                  </td>
                  <td style={{ ...td(i), minWidth: 110 }}>
                    <select style={sel} value={live.wood_type || ''} onChange={e => save(proj.id, 'wood_type', e.target.value)}>
                      <option value="">—</option>
                      {speciesList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td(i), minWidth: 100 }}>
                    <select style={sel} value={live.category || ''} onChange={e => save(proj.id, 'category', e.target.value)}>
                      <option value="">—</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td(i), minWidth: 110 }}>
                    <select style={sel} value={live.finish_used || ''} onChange={e => save(proj.id, 'finish_used', e.target.value)}>
                      <option value="">—</option>
                      {finishesList.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td(i), minWidth: 64 }}>
                    <input style={{ ...inp, width: 64 }} type="number" min="1900" max="2100" step="1"
                      defaultValue={live.year_completed || new Date().getFullYear()}
                      onBlur={e => { const v = e.target.value ? parseInt(e.target.value) : null; if (v !== live.year_completed) save(proj.id, 'year_completed', v) }} />
                  </td>
                  <td style={{ ...td(i), minWidth: 90 }}>
                    <select style={sel} value={live.status || 'complete'} onChange={e => save(proj.id, 'status', e.target.value)}>
                      {['complete','active','planning','paused'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                    </select>
                  </td>
                  <td style={{ ...td(i), minWidth: 100 }}>
                    <input style={inp} defaultValue={live.built_with || ''}
                      onBlur={e => { if (e.target.value !== (live.built_with||'')) save(proj.id, 'built_with', e.target.value) }} />
                  </td>
                  <td style={{ ...td(i), minWidth: 110 }}>
                    <input style={inp} defaultValue={live.gift_recipient || ''}
                      onBlur={e => { if (e.target.value !== (live.gift_recipient||'')) save(proj.id, 'gift_recipient', e.target.value) }} />
                  </td>
                  <td style={{ ...td(i), minWidth: 130, fontSize: 12, color: 'var(--text-4)', padding: '7px 8px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-4)' }}>Edit in Projects</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Phase 1: Import table ─────────────────────────────────────────────────────
export default function BulkImport() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const dropRef = useRef()
  const fileRef = useRef()

  const [rows, setRows]           = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [lightbox, setLightbox]   = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [phase, setPhase]         = useState(1)
  const [newProjects, setNewProjects] = useState([])
  const [groupColors]             = useState(() => ['#1D4ED8','#166534','#B45309','#7C3AED','#0891B2','#BE185D'])

  const projects      = data.projects      || []

  const makeRow = (file, preview) => ({
    id: uid(), file, preview,
    dest: DEST.NEW,
    name: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' '),
    existingProjId: '',
    existingStockId: '',
    groupId: '',
  })

  const addFiles = useCallback(files => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!arr.length) return
    Promise.all(arr.map(f => new Promise(res => {
      const reader = new FileReader()
      reader.onload = e => res(makeRow(f, e.target.result))
      reader.readAsDataURL(f)
    }))).then(newRows => setRows(prev => [...prev, ...newRows]))
  }, [])

  const onDrop = e => {
    e.preventDefault()
    dropRef.current?.classList.remove('drag-over')
    addFiles(e.dataTransfer.files)
  }

  const update = (id, field, value) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  const removeRow = id => { setRows(prev => prev.filter(r => r.id !== id)); setSelected(prev => { const s=new Set(prev); s.delete(id); return s }) }

  const toggleSelect = id => setSelected(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const selectAll = () => selected.size===rows.length ? setSelected(new Set()) : setSelected(new Set(rows.map(r=>r.id)))

  const groupColorMap = {}
  let colorIdx = 0
  rows.forEach(r => { if (r.groupId?.trim() && !groupColorMap[r.groupId]) groupColorMap[r.groupId]=groupColors[colorIdx++%groupColors.length] })

  const groupSelected = () => {
    if (selected.size < 2) return
    const selectedRows = rows.filter(r => selected.has(r.id))
    const existingGroup = selectedRows.find(r => r.groupId?.trim())?.groupId?.trim()
    const groupId = existingGroup || 'g' + Math.random().toString(36).slice(2,5)
    setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, groupId, dest: DEST.NEW } : r))
    setSelected(new Set())
  }

  const getProjectCount = () => {
    const ng = new Set(), ep = new Set(), st = new Set()
    rows.forEach(r => {
      if (r.dest===DEST.NEW) ng.add(r.groupId?.trim()||r.id)
      else if (r.dest===DEST.EXISTING) ep.add(r.existingProjId)
      else st.add(r.existingStockId)
    })
    return { newCount: ng.size, existingCount: ep.size, stockCount: st.size }
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true); setProgress(0)
    let uploaded = 0
    const created = []

    // Group new project rows
    const groups = {}
    rows.filter(r => r.dest===DEST.NEW).forEach(r => {
      const key = r.groupId?.trim() || r.id
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })

    // Create new projects + upload photos
    for (const [, groupRows] of Object.entries(groups)) {
      const first = groupRows[0]
      try {
        const proj = await db.addProject({
          name: first.name?.trim() || 'Untitled',
          status: 'complete', description: '', dimensions_final: '',
          category: '', wood_type: '', finish_used: '', built_with: '', gift_recipient: '',
          year_completed: null,
        })
        created.push(proj)
        for (const row of groupRows) {
          try {
            const photo = await db.uploadPhoto(proj.id, row.file, '', 'progress', 'finished')
            mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
          } catch(e) { console.error('Photo failed:', e) }
          uploaded++; setProgress(Math.round(uploaded/rows.length*100))
        }
      } catch(e) { toast(`Failed: ${first.name}`, 'error'); uploaded+=groupRows.length; setProgress(Math.round(uploaded/rows.length*100)) }
    }

    // Existing projects
    for (const row of rows.filter(r => r.dest===DEST.EXISTING && r.existingProjId)) {
      try {
        const photo = await db.uploadPhoto(row.existingProjId, row.file, '', 'progress', 'finished')
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
      } catch(e) { console.error('Existing photo failed:', e) }
      uploaded++; setProgress(Math.round(uploaded/rows.length*100))
    }

    // Wood stock
    for (const row of rows.filter(r => r.dest===DEST.STOCK && r.existingStockId)) {
      try {
        const photo = await db.uploadPhoto(null, row.file, `stock:${row.existingStockId}`, 'progress', 'stock')
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
      } catch(e) { console.error('Stock photo failed:', e) }
      uploaded++; setProgress(Math.round(uploaded/rows.length*100))
    }

    mutate(d => ({ ...d, projects: [...d.projects, ...created] }))
    setNewProjects(created)
    setImporting(false)
    if (created.length > 0) setPhase(2)
    else { toast('Import complete', 'success'); setRows([]) }
  }

  // Phase 2
  if (phase === 2) return <CleanupTable newProjects={newProjects} onDone={() => { setPhase(1); setRows([]); setNewProjects([]) }} />

  const { newCount, existingCount, stockCount } = rows.length ? getProjectCount() : { newCount:0, existingCount:0, stockCount:0 }
  const sel = { fontSize: 13, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', cursor: 'pointer', width: '100%' }
  const inp = { ...sel, cursor: 'text' }
  const th = { padding: '9px 10px', color: '#CBD5E1', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'left', whiteSpace: 'nowrap', background: '#0F1E38' }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 100 }}>
        <div className="page-header">
          <h1 className="page-title">Bulk Import</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Drop photos, set destination, import. Fill in details in Phase 2.</p>
        </div>

        {!rows.length ? (
          <div ref={dropRef} onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('drag-over') }}
            onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
            onClick={() => fileRef.current?.click()}
            style={{ margin: '16px 20px', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--fill-2)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-2)', marginBottom: 6 }}>Drop photos here</div>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Or click to select. Multiple files supported.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 12px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{rows.length} photo{rows.length!==1?'s':''}</span>
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => fileRef.current?.click()}>+ Add more</button>
            </div>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', padding: '0 20px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560, fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ ...th, width: 36 }}><input type="checkbox" checked={selected.size===rows.length&&rows.length>0} onChange={selectAll} style={{ cursor:'pointer' }}/></th>
                    <th style={th}>Photo</th>
                    <th style={th}>Destination</th>
                    <th style={th}>Name / Project / Stock</th>
                    <th style={th}>Group</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const bg = rowIdx%2===0?'var(--surface)':'var(--fill-2)'
                    const cell = { padding: '8px 8px', borderBottom: '1px solid var(--border-2)', background: bg }
                    const isNew = row.dest===DEST.NEW
                    const isExisting = row.dest===DEST.EXISTING
                    const isStock = row.dest===DEST.STOCK
                    return (
                      <tr key={row.id} style={{ outline: selected.has(row.id)?'2px solid #1D4ED8':'none', outlineOffset: -1 }}>
                        <td style={cell}><input type="checkbox" checked={selected.has(row.id)} onChange={()=>toggleSelect(row.id)} style={{ cursor:'pointer' }}/></td>
                        <td style={{ ...cell, padding: '8px 10px' }}>
                          <img src={row.preview} alt="" onClick={()=>setLightbox(row.preview)}
                            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'pointer' }}/>
                        </td>
                        <td style={{ ...cell, minWidth: 130 }}>
                          <select style={sel} value={row.dest} onChange={e=>update(row.id,'dest',e.target.value)}>
                            <option value={DEST.NEW}>New project</option>
                            <option value={DEST.EXISTING}>Existing project</option>
                            <option value={DEST.STOCK}>Wood stock</option>
                          </select>
                        </td>
                        <td style={{ ...cell, minWidth: 180 }}>
                          {isNew && <input style={inp} value={row.name} onChange={e=>update(row.id,'name',e.target.value)} placeholder="Project name"/>}
                          {isExisting && (
                            <select style={sel} value={row.existingProjId} onChange={e=>update(row.id,'existingProjId',e.target.value)}>
                              <option value="">Pick project…</option>
                              {projects.sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          )}
                          {isStock && (
                            <select style={sel} value={row.existingStockId} onChange={e=>update(row.id,'existingStockId',e.target.value)}>
                              <option value="">Pick stock entry…</option>
                              {woodLocations.map(loc=>{
                                const items=woodStock.filter(w=>w.location_id===loc.id)
                                return items.length?<optgroup key={loc.id} label={loc.name}>{items.map(w=><option key={w.id} value={w.id}>{w.species}{w.harvested_at?' · '+new Date(w.harvested_at).getFullYear():''}</option>)}</optgroup>:null
                              })}
                              {woodStock.filter(w=>!w.location_id).map(w=><option key={w.id} value={w.id}>{w.species}</option>)}
                            </select>
                          )}
                        </td>
                        <td style={{ ...cell, minWidth: 80 }}>
                          {isNew ? (
                            row.groupId ? (
                              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <div style={{ width:10, height:10, borderRadius:3, background:groupColorMap[row.groupId]||'#888', flexShrink:0 }}/>
                                <span style={{ fontSize:11, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:50 }}>{row.groupId}</span>
                                <button onClick={()=>update(row.id,'groupId','')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-4)', fontSize:14, padding:0, lineHeight:1 }}>×</button>
                              </div>
                            ) : <span style={{ fontSize:12, color:'var(--text-4)' }}>—</span>
                          ) : <span style={{ fontSize:12, color:'var(--text-4)' }}>—</span>}
                        </td>
                        <td style={cell}>
                          <button onClick={()=>removeRow(row.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:18, padding:'4px', lineHeight:1 }}>×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p style={{ fontSize:12, color:'var(--text-4)', marginTop:8 }}>Click a thumbnail to preview. Select 2+ rows and click Group to link them to one project.</p>
            </div>
          </>
        )}
      </div>

      {rows.length>0 && !importing && (
        <div style={{ position:'sticky', bottom:0, background:'var(--surface)', borderTop:'1px solid var(--border-2)', padding:'12px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {selected.size>=2 && <button className="btn-primary" style={{ padding:'8px 16px', fontSize:13, justifyContent:'center' }} onClick={groupSelected}>Group {selected.size} selected</button>}
              {selected.size>0 && selected.size<2 && <span style={{ fontSize:12, color:'var(--text-3)' }}>Select 2+ to group</span>}
              {selected.size===0 && <span style={{ fontSize:13, color:'var(--text-3)' }}>
                {newCount>0&&`${newCount} new`}{newCount>0&&(existingCount>0||stockCount>0)&&' · '}
                {existingCount>0&&`${existingCount} existing`}{existingCount>0&&stockCount>0&&' · '}
                {stockCount>0&&`${stockCount} stock`}
              </span>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-secondary" style={{ padding:'10px 20px', justifyContent:'center' }} onClick={()=>{ setRows([]); setSelected(new Set()) }}>Cancel</button>
              <button className="btn-primary" style={{ padding:'10px 28px', justifyContent:'center' }} onClick={handleImport}>Import →</button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div style={{ position:'sticky', bottom:0, background:'var(--surface)', borderTop:'1px solid var(--border-2)', padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:500 }}>Uploading…</span>
            <span style={{ fontSize:13, color:'var(--text-3)' }}>{progress}%</span>
          </div>
          <div style={{ height:6, borderRadius:3, background:'var(--fill)' }}>
            <div style={{ height:6, borderRadius:3, background:'var(--accent)', width:progress+'%', transition:'width 200ms' }}/>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e=>addFiles(e.target.files)}/>
      {lightbox && <PhotoLightbox src={lightbox} onClose={()=>setLightbox(null)}/>}
    </div>
  )
}
