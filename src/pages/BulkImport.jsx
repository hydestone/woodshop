import { useState, useRef, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

const STATUSES = ['complete','active','planning','paused']

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

export default function BulkImport() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const dropRef = useRef()
  const fileRef = useRef()

  const [rows, setRows]         = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone]         = useState(false)

  const categories  = data.categories  || []
  const speciesList = data.species     || []
  const finishesList= data.finishes    || []
  const woodStock   = data.woodStock   || []
  const woodLocations = data.woodLocations || []

  const makeRow = (file, preview) => ({
    id:       uid(),
    file,
    preview,
    name:         file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g,' '),
    species:      '',
    category:     '',
    finish:       '',
    year:         new Date().getFullYear(),
    status:       'complete',
    builtWith:    '',
    giftRecipient:'',
    woodStockId:  '',
    tag:          'finished',
    groupId:      '',  // if set, groups with another row into same project
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

  // Copy field value from one row to all below it
  const copyDown = (fromId, field) => {
    const idx = rows.findIndex(r => r.id === fromId)
    if (idx < 0) return
    const val = rows[idx][field]
    setRows(prev => prev.map((r, i) => i > idx ? { ...r, [field]: val } : r))
  }

  const handleImport = async () => {
    if (!rows.length) return
    setImporting(true); setProgress(0)
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    const BUCKET = 'woodshop-photos'

    let done = 0
    const newProjects = [], newPhotos = []

    // Group rows by groupId (or each row is its own project)
    const groups = {}
    rows.forEach(r => {
      const key = r.groupId?.trim() || r.id
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })

    for (const [, groupRows] of Object.entries(groups)) {
      const first = groupRows[0]
      try {
        // Resolve IDs
        const sp = speciesList.find(s => s.name === first.species)
        const fi = finishesList.find(f => f.name === first.finish)
        const ws = woodStock.find(w => w.id === first.woodStockId)

        // Create project
        const proj = await db.addProject({
          name:           first.name || 'Untitled',
          category:       first.category || '',
          wood_type:      first.species || '',
          species_id:     sp?.id || null,
          finish_used:    first.finish || '',
          finish_id:      fi?.id || null,
          wood_stock_id:  first.woodStockId || null,
          year_completed: first.year ? parseInt(first.year) : null,
          status:         first.status || 'complete',
          built_with:     first.builtWith || '',
          gift_recipient: first.giftRecipient || '',
          description:    '',
          dimensions_final: '',
        })
        newProjects.push(proj)

        // Upload photos for this group
        for (const row of groupRows) {
          try {
            const compressed = await compressImage(row.file)
            const ext = compressed.type === 'image/jpeg' ? 'jpg' : (row.file.name.split('.').pop() || 'jpg')
            const path = `${proj.id}/${uid()}.${ext}`
            const uploadResp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': compressed.type, 'x-upsert': 'false' },
              body: compressed,
            })
            if (!uploadResp.ok) throw new Error('Upload failed')
            const photoRow = await db.addPhotoRecord(proj.id, path, '', row.tag || 'finished', row.tag || 'finished')
            newPhotos.push({ ...photoRow, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}` })
          } catch(e) { console.error('Photo upload failed:', e) }
          done++
          setProgress(Math.round(done / rows.length * 100))
        }
      } catch(e) {
        toast(`Failed: ${first.name} — ${e.message}`, 'error')
        done += groupRows.length
        setProgress(Math.round(done / rows.length * 100))
      }
    }

    mutate(d => ({
      ...d,
      projects: [...d.projects, ...newProjects],
      photos:   [...newPhotos, ...d.photos],
    }))
    setImporting(false)
    setDone(true)
    toast(`${newProjects.length} projects imported`, 'success')
  }

  if (done) return (
    <div className="scroll-page">
      <div className="page-header"><h1 className="page-title">Bulk Import</h1></div>
      <div className="empty" style={{ paddingTop: 60 }}>
        <div className="empty-icon">🎉</div>
        <div className="empty-title">Import complete</div>
        <p className="empty-sub">{rows.length} photos imported across {Object.keys(rows.reduce((a,r)=>({...a,[r.groupId||r.id]:1}),{})).length} projects</p>
        <button className="btn-primary" style={{ marginTop: 16, justifyContent: 'center' }} onClick={() => { setRows([]); setDone(false) }}>Import more</button>
      </div>
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 100 }}>
        <div className="page-header">
          <h1 className="page-title">Bulk Import</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Drop photos, fill in details, import all at once. Photos with the same "Group ID" become one project.</p>
        </div>

        {/* Drop zone */}
        {!rows.length && (
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add('drag-over') }}
            onDragLeave={() => dropRef.current?.classList.remove('drag-over')}
            onClick={() => fileRef.current?.click()}
            style={{ margin: '16px 20px', border: '2px dashed var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', background: 'var(--fill-2)' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-2)', marginBottom: 6 }}>Drop photos here</div>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Or click to select files. Multiple files supported.</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 12px' }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{rows.length} photo{rows.length !== 1 ? 's' : ''} ready</span>
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => fileRef.current?.click()}>+ Add more</button>
            </div>

            {/* Table — desktop */}
            <div style={{ overflowX: 'auto', padding: '0 20px' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0F1E38' }}>
                    {['Photo','Project Name','Species','Category','Finish','Year','Status','Built With','Gift / Recipient','Wood Source','Tag','Group ID',''].map((h,i) => (
                      <th key={i} style={{ padding: '8px 10px', color: '#CBD5E1', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.4px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-2)', background: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--fill-2)' }}>
                      {/* Thumbnail */}
                      <td style={{ padding: '6px 10px' }}>
                        <img src={row.preview} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                      </td>
                      {/* Name */}
                      <td style={{ padding: '6px 6px' }}>
                        <input className="proj-table-input" value={row.name} onChange={e => update(row.id, 'name', e.target.value)} style={{ minWidth: 120 }} />
                      </td>
                      {/* Species */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="proj-table-select" value={row.species} onChange={e => update(row.id, 'species', e.target.value)} title="Double-click to copy down" onDoubleClick={() => copyDown(row.id, 'species')}>
                          <option value="">—</option>
                          {speciesList.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </td>
                      {/* Category */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="proj-table-select" value={row.category} onChange={e => update(row.id, 'category', e.target.value)} onDoubleClick={() => copyDown(row.id, 'category')}>
                          <option value="">—</option>
                          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </td>
                      {/* Finish */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="proj-table-select" value={row.finish} onChange={e => update(row.id, 'finish', e.target.value)} onDoubleClick={() => copyDown(row.id, 'finish')}>
                          <option value="">—</option>
                          {finishesList.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                        </select>
                      </td>
                      {/* Year */}
                      <td style={{ padding: '6px 6px' }}>
                        <input className="proj-table-input" type="number" value={row.year} onChange={e => update(row.id, 'year', e.target.value)} style={{ width: 60 }} onDoubleClick={() => copyDown(row.id, 'year')} />
                      </td>
                      {/* Status */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="proj-table-select" value={row.status} onChange={e => update(row.id, 'status', e.target.value)} onDoubleClick={() => copyDown(row.id, 'status')}>
                          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                        </select>
                      </td>
                      {/* Built with */}
                      <td style={{ padding: '6px 6px' }}>
                        <input className="proj-table-input" value={row.builtWith} onChange={e => update(row.id, 'builtWith', e.target.value)} onDoubleClick={() => copyDown(row.id, 'builtWith')} style={{ minWidth: 80 }} />
                      </td>
                      {/* Gift */}
                      <td style={{ padding: '6px 6px' }}>
                        <input className="proj-table-input" value={row.giftRecipient} onChange={e => update(row.id, 'giftRecipient', e.target.value)} style={{ minWidth: 80 }} />
                      </td>
                      {/* Wood source */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="proj-table-select" value={row.woodStockId} onChange={e => update(row.id, 'woodStockId', e.target.value)} onDoubleClick={() => copyDown(row.id, 'woodStockId')}>
                          <option value="">—</option>
                          {woodLocations.map(loc => {
                            const items = woodStock.filter(w => w.location_id === loc.id)
                            return items.length ? <optgroup key={loc.id} label={loc.name}>{items.map(w => <option key={w.id} value={w.id}>{w.species}{w.harvested_at?' · '+new Date(w.harvested_at).getFullYear():''}</option>)}</optgroup> : null
                          })}
                          {woodStock.filter(w=>!w.location_id).map(w => <option key={w.id} value={w.id}>{w.species}</option>)}
                        </select>
                      </td>
                      {/* Tag */}
                      <td style={{ padding: '6px 6px' }}>
                        <select className="proj-table-select" value={row.tag} onChange={e => update(row.id, 'tag', e.target.value)} onDoubleClick={() => copyDown(row.id, 'tag')}>
                          {['finished','progress','inspiration','before','after'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      {/* Group ID */}
                      <td style={{ padding: '6px 6px' }}>
                        <input className="proj-table-input" value={row.groupId} onChange={e => update(row.id, 'groupId', e.target.value)} placeholder="e.g. bowl1" style={{ width: 70 }} />
                      </td>
                      {/* Delete */}
                      <td style={{ padding: '6px 6px' }}>
                        <button onClick={() => removeRow(row.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, padding: '4px' }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>Tip: double-click any dropdown to copy that value to all rows below it.</p>
            </div>
          </>
        )}
      </div>

      {/* Sticky footer */}
      {rows.length > 0 && !importing && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border-2)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{rows.length} photo{rows.length!==1?'s':''} → {Object.keys(rows.reduce((a,r)=>({...a,[r.groupId||r.id]:1}),{})).length} project{Object.keys(rows.reduce((a,r)=>({...a,[r.groupId||r.id]:1}),{})).length!==1?'s':''}</span>
          <button className="btn-primary" style={{ padding: '10px 28px', justifyContent: 'center' }} onClick={handleImport}>
            Import all
          </button>
        </div>
      )}

      {importing && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border-2)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Importing…</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{progress}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--fill)' }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--accent)', width: progress + '%', transition: 'width 200ms' }} />
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
    </div>
  )
}
