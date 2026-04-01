import { useState, useRef, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

const STATUSES = ['complete','active','planning','paused']
const DEST = { NEW: 'new', EXISTING: 'existing', STOCK: 'stock' }

function compressImage(file) {
  return new Promise(resolve => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') { resolve(file); return }
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { naturalWidth: w, naturalHeight: h } = img
      const scale = Math.min(1, 1600 / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (blob && blob.size < file.size) resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        else resolve(file)
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function uid() { return Math.random().toString(36).slice(2) }

function PhotoLightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      <img src={src} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
    </div>
  )
}

export default function BulkImport() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const dropRef = useRef()
  const fileRef = useRef()

  const [rows, setRows]           = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress]   = useState(0)
  const [done, setDone]           = useState(false)
  const [lightbox, setLightbox]   = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [groupColors] = useState(() => ['#1D4ED8','#166534','#B45309','#7C3AED','#0891B2','#BE185D','#15803D','#9333EA'])

  const categories   = data.categories   || []
  const speciesList  = data.species      || []
  const finishesList = data.finishes     || []
  const woodStock    = data.woodStock    || []
  const woodLocations= data.woodLocations|| []
  const projects     = data.projects     || []

  const makeRow = (file, preview) => ({
    id: uid(), file, preview,
    dest:         DEST.NEW,
    // New project fields
    name:         file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' '),
    species:      '', category: '', finish: '',
    year:         new Date().getFullYear(),
    status:       'complete',
    builtWith:    '', giftRecipient: '', woodStockId: '',
    groupId:      '',
    // Existing project / stock
    existingProjId: '',
    existingStockId: '',
    tag:          'finished',
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
  const removeRow = id => setRows(prev => prev.filter(r => r.id !== id))
  const toggleSelect = id => setSelected(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const selectAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map(r => r.id)))
  }

  const groupSelected = () => {
    if (selected.size < 2) return
    // Find if any selected row already has a groupId
    const selectedRows = rows.filter(r => selected.has(r.id))
    const existingGroup = selectedRows.find(r => r.groupId?.trim())?.groupId?.trim()
    const groupId = existingGroup || 'g' + Math.random().toString(36).slice(2,6)
    setRows(prev => prev.map(r => selected.has(r.id) ? { ...r, groupId, dest: DEST.NEW } : r))
    setSelected(new Set())
  }

  const ungroup = id => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, groupId: '' } : r))
  }

  // Assign a color per unique groupId
  const groupColorMap = {}
  let colorIdx = 0
  rows.forEach(r => {
    if (r.groupId?.trim() && !groupColorMap[r.groupId]) {
      groupColorMap[r.groupId] = groupColors[colorIdx++ % groupColors.length]
    }
  })

  const copyDown = (fromId, field) => {
    const idx = rows.findIndex(r => r.id === fromId)
    if (idx < 0) return
    const val = rows[idx][field]
    setRows(prev => prev.map((r, i) => i > idx ? { ...r, [field]: val } : r))
  }

  const projectCount = () => {
    const newGroups = new Set()
    const existingProjs = new Set()
    const stockItems = new Set()
    rows.forEach(r => {
      if (r.dest === DEST.NEW) newGroups.add(r.groupId?.trim() || r.id)
      else if (r.dest === DEST.EXISTING) existingProjs.add(r.existingProjId)
      else stockItems.add(r.existingStockId)
    })
    return { newCount: newGroups.size, existingCount: existingProjs.size, stockCount: stockItems.size }
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true); setProgress(0)
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    const BUCKET = 'woodshop-photos'
    let uploaded = 0
    const newProjects = [], newPhotos = []

    const uploadFile = async (file, projectId) => {
      const compressed = await compressImage(file)
      const ext = compressed.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg')
      const path = `${projectId}/${uid()}.${ext}`
      const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': compressed.type, 'x-upsert': 'false' },
        body: compressed,
      })
      if (!resp.ok) throw new Error('Upload failed')
      return path
    }

    // ── New projects ──
    const newGroups = {}
    rows.filter(r => r.dest === DEST.NEW).forEach(r => {
      const key = r.groupId?.trim() || r.id
      if (!newGroups[key]) newGroups[key] = []
      newGroups[key].push(r)
    })
    for (const [, groupRows] of Object.entries(newGroups)) {
      const first = groupRows[0]
      try {
        const sp = speciesList.find(s => s.name === first.species)
        const fi = finishesList.find(f => f.name === first.finish)
        const proj = await db.addProject({
          name: first.name || 'Untitled', category: first.category || '',
          wood_type: first.species || '', species_id: sp?.id || null,
          finish_used: first.finish || '', finish_id: fi?.id || null,
          year_completed: first.year ? parseInt(first.year) : null,
          status: first.status || 'complete',
          built_with: first.builtWith || '', gift_recipient: first.giftRecipient || '',
          description: '', dimensions_final: '',
        })
        // Link wood stock via junction table if set
        if (first.woodStockId) {
          await db.addProjectWoodSource(proj.id, first.woodStockId).catch(() => {})
        }
        newProjects.push(proj)
        for (const row of groupRows) {
          try {
            const path = await uploadFile(row.file, proj.id)
            const photo = await db.addPhotoRecord(proj.id, path, '', row.tag || 'finished', row.tag || 'finished')
            newPhotos.push({ ...photo, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` })
          } catch(e) { console.error(e) }
          uploaded++; setProgress(Math.round(uploaded / rows.length * 100))
        }
      } catch(e) { toast(`Failed: ${first.name}`, 'error'); uploaded += groupRows.length; setProgress(Math.round(uploaded / rows.length * 100)) }
    }

    // ── Existing projects ──
    for (const row of rows.filter(r => r.dest === DEST.EXISTING && r.existingProjId)) {
      try {
        const path = await uploadFile(row.file, row.existingProjId)
        const photo = await db.addPhotoRecord(row.existingProjId, path, '', row.tag || 'finished', row.tag || 'finished')
        newPhotos.push({ ...photo, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` })
      } catch(e) { console.error(e) }
      uploaded++; setProgress(Math.round(uploaded / rows.length * 100))
    }

    // ── Wood stock ──
    for (const row of rows.filter(r => r.dest === DEST.STOCK && r.existingStockId)) {
      try {
        const path = await uploadFile(row.file, `stock_${row.existingStockId}`)
        const photo = await db.addPhotoRecord(null, path, '', 'stock', 'stock')
        // Store stock_id in caption as metadata
        await db.updatePhoto(photo.id, { caption: `stock:${row.existingStockId}` })
        newPhotos.push({ ...photo, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` })
      } catch(e) { console.error(e) }
      uploaded++; setProgress(Math.round(uploaded / rows.length * 100))
    }

    mutate(d => ({ ...d, projects: [...d.projects, ...newProjects], photos: [...newPhotos, ...d.photos] }))
    setImporting(false); setDone(true)
    const { newCount, existingCount, stockCount } = projectCount()
    toast(`Import complete — ${newCount} new projects, ${existingCount} existing, ${stockCount} stock`, 'success')
  }

  if (done) return (
    <div className="scroll-page">
      <div className="page-header"><h1 className="page-title">Bulk Import</h1></div>
      <div className="empty" style={{ paddingTop: 60 }}>
        <div className="empty-icon">🎉</div>
        <div className="empty-title">Import complete</div>
        <p className="empty-sub">{rows.length} photos imported</p>
        <button className="btn-primary" style={{ marginTop: 16, justifyContent: 'center' }} onClick={() => { setRows([]); setDone(false) }}>Import more</button>
      </div>
    </div>
  )

  const counts = rows.length ? projectCount() : { newCount:0, existingCount:0, stockCount:0 }
  const { newCount, existingCount, stockCount } = counts
  const sel = { fontSize: 12, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', cursor: 'pointer', width: '100%' }
  const inp = { fontSize: 12, background: 'transparent', border: 'none', outline: 'none', fontFamily: 'inherit', color: 'var(--text)', width: '100%' }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 100 }}>
        <div className="page-header">
          <h1 className="page-title">Bulk Import</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Drop photos, fill in what you know, import. Then clean up details in Projects → Table view. Fields can be left blank. Same Group ID = same project.</p>
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
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{rows.length} photo{rows.length !== 1 ? 's' : ''}</span>
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => fileRef.current?.click()}>+ Add more</button>
            </div>

            <div style={{ overflowX: 'auto', padding: '0 20px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860, fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#0F1E38' }}>
                    <th style={{ padding: '8px 10px', width: 32 }}>
                        <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={selectAll} style={{ cursor: 'pointer' }}/>
                      </th>
                    {['Photo','Destination','Name / Project / Stock','Species','Category','Finish','Year','Status','Built With','Gift','Tag','Group',''].map((h,i) => (
                      <th key={i} style={{ padding: '8px 10px', color: '#CBD5E1', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => {
                    const isNew = row.dest === DEST.NEW
                    const isExisting = row.dest === DEST.EXISTING
                    const isStock = row.dest === DEST.STOCK
                    const bg = rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--fill-2)'
                    const cell = { padding: '6px 6px', borderBottom: '1px solid var(--border-2)', background: bg }
                    return (
                      <tr key={row.id} style={{ outline: selected.has(row.id) ? '2px solid #1D4ED8' : 'none', outlineOffset: -1 }}>
                        <td style={{ ...cell, padding: '8px 10px' }}>
                          <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} style={{ cursor: 'pointer' }}/>
                        </td>
                        {/* Thumbnail */}
                        <td style={{ ...cell, padding: '8px 10px' }}>
                          <img src={row.preview} alt="" onClick={() => setLightbox(row.preview)}
                            style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'pointer' }} />
                        </td>
                        {/* Destination */}
                        <td style={{ ...cell, minWidth: 110 }}>
                          <select style={sel} value={row.dest} onChange={e => update(row.id, 'dest', e.target.value)} onDoubleClick={() => copyDown(row.id, 'dest')}>
                            <option value={DEST.NEW}>New project</option>
                            <option value={DEST.EXISTING}>Existing project</option>
                            <option value={DEST.STOCK}>Wood stock</option>
                          </select>
                        </td>
                        {/* Name / Project / Stock picker */}
                        <td style={{ ...cell, minWidth: 160 }}>
                          {isNew && <input style={inp} value={row.name} onChange={e => update(row.id, 'name', e.target.value)} placeholder="Project name" />}
                          {isExisting && (
                            <select style={sel} value={row.existingProjId} onChange={e => update(row.id, 'existingProjId', e.target.value)}>
                              <option value="">Pick project…</option>
                              {projects.sort((a,b)=>a.name.localeCompare(b.name)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          )}
                          {isStock && (
                            <select style={sel} value={row.existingStockId} onChange={e => update(row.id, 'existingStockId', e.target.value)}>
                              <option value="">Pick stock entry…</option>
                              {woodLocations.map(loc => {
                                const items = woodStock.filter(w => w.location_id === loc.id)
                                return items.length ? <optgroup key={loc.id} label={loc.name}>{items.map(w => <option key={w.id} value={w.id}>{w.species}{w.harvested_at?' · '+new Date(w.harvested_at).getFullYear():''}</option>)}</optgroup> : null
                              })}
                              {woodStock.filter(w=>!w.location_id).map(w => <option key={w.id} value={w.id}>{w.species}</option>)}
                            </select>
                          )}
                        </td>
                        {/* Species — only for new */}
                        <td style={{ ...cell, minWidth: 110, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <select style={sel} value={row.species} onChange={e => update(row.id,'species',e.target.value)} onDoubleClick={()=>copyDown(row.id,'species')}>
                            <option value="">—</option>{speciesList.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                          </select> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Category */}
                        <td style={{ ...cell, minWidth: 100, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <select style={sel} value={row.category} onChange={e=>update(row.id,'category',e.target.value)} onDoubleClick={()=>copyDown(row.id,'category')}>
                            <option value="">—</option>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                          </select> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Finish */}
                        <td style={{ ...cell, minWidth: 100, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <select style={sel} value={row.finish} onChange={e=>update(row.id,'finish',e.target.value)} onDoubleClick={()=>copyDown(row.id,'finish')}>
                            <option value="">—</option>{finishesList.map(f=><option key={f.id} value={f.name}>{f.name}</option>)}
                          </select> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Year */}
                        <td style={{ ...cell, minWidth: 60, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <input style={{...inp,width:56}} type="number" value={row.year} onChange={e=>update(row.id,'year',e.target.value)} onDoubleClick={()=>copyDown(row.id,'year')}/> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Status */}
                        <td style={{ ...cell, minWidth: 90, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <select style={sel} value={row.status} onChange={e=>update(row.id,'status',e.target.value)} onDoubleClick={()=>copyDown(row.id,'status')}>
                            {STATUSES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                          </select> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Built with */}
                        <td style={{ ...cell, minWidth: 80, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <input style={inp} value={row.builtWith} onChange={e=>update(row.id,'builtWith',e.target.value)} onDoubleClick={()=>copyDown(row.id,'builtWith')}/> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Gift */}
                        <td style={{ ...cell, minWidth: 80, opacity: isNew ? 1 : 0.3 }}>
                          {isNew ? <input style={inp} value={row.giftRecipient} onChange={e=>update(row.id,'giftRecipient',e.target.value)}/> : <span style={{fontSize:12,color:'var(--text-4)'}}>—</span>}
                        </td>
                        {/* Tag */}
                        <td style={{ ...cell, minWidth: 90 }}>
                          <select style={sel} value={row.tag} onChange={e=>update(row.id,'tag',e.target.value)} onDoubleClick={()=>copyDown(row.id,'tag')}>
                            {['finished','progress','inspiration','before','after','stock'].map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        {/* Group indicator */}
                        <td style={{ ...cell, minWidth: 60 }}>
                          {row.groupId ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 3, background: groupColorMap[row.groupId] || '#888', flexShrink: 0 }}/>
                              <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 50 }}>{row.groupId}</span>
                              <button onClick={() => ungroup(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }} title="Remove from group">×</button>
                            </div>
                          ) : <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>}
                        </td>
                        {/* Remove */}
                        <td style={{ ...cell }}>
                          <button onClick={()=>removeRow(row.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:18,padding:'4px',lineHeight:1}}>×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>Tip: double-click any cell to copy its value to all rows below. Click a thumbnail to preview.</p>
            </div>
          </>
        )}
      </div>

      {/* Sticky footer */}
      {rows.length > 0 && !importing && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border-2)', padding: '12px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selected.size >= 2 && (
                <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, justifyContent: 'center' }} onClick={groupSelected}>
                  Group {selected.size} selected
                </button>
              )}
              {selected.size > 0 && selected.size < 2 && (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Select 2+ to group</span>
              )}
              {selected.size === 0 && (
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {newCount > 0 && `${newCount} new`}
                  {newCount > 0 && (existingCount > 0 || stockCount > 0) && ' · '}
                  {existingCount > 0 && `${existingCount} existing`}
                  {existingCount > 0 && stockCount > 0 && ' · '}
                  {stockCount > 0 && `${stockCount} stock`}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" style={{ padding: '10px 20px', justifyContent: 'center' }} onClick={() => { setRows([]); setSelected(new Set()) }}>
                Cancel
              </button>
              <button className="btn-primary" style={{ padding: '10px 28px', justifyContent: 'center' }} onClick={handleImport}>
                Import all
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border-2)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Importing…</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{progress}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--fill)' }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--accent)', width: progress + '%', transition: 'width 200ms' }} />
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
      {lightbox && <PhotoLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
