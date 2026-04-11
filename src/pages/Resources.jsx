import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, ConfirmSheet, IPlus, ITrash, IEdit, ILink } from '../components/Shared.jsx'

const CATEGORIES = ['General', 'Finishing', 'Joinery', 'Wood Species', 'Turning', 'Carving', 'Tools', 'Safety', 'Business', 'Other']

const DEFAULT_GUIDES = [
  { title: 'Wood Database',                       url: 'https://www.wood-database.com/',                                         category: 'Wood Species', desc: 'Species guide — Janka hardness, grain, workability, typical uses' },
  { title: 'Fine Woodworking — Finishing',        url: 'https://www.finewoodworking.com/finishing',                              category: 'Finishing',    desc: 'Finishing reference articles from Fine Woodworking' },
  { title: 'Lumber Calculator',                   url: 'https://www.thecalculatorsite.com/construction/boards.php',              category: 'General',      desc: 'Board feet and lumber estimates' },
  { title: 'American Association of Woodturners', url: 'https://www.woodturner.org/',                                            category: 'Turning',      desc: 'AAW turning resources, community, and symposium info' },
  { title: 'Blocklayer — Segmented Turning',      url: 'https://www.blocklayer.com/woodturning-segments',                        category: 'Turning',      desc: 'Free online segmented turning calculator — segments, angles, dimensions' },
  { title: 'Wood Species Explorer — USDA',        url: 'https://www.fpl.fs.usda.gov/documnts/FPLGTR/fplgtr190.pdf',             category: 'Wood Species', desc: 'USDA Forest Products Lab wood handbook — definitive species reference' },
  { title: 'Finishing Reference — Bob Flexner',   url: 'https://www.popularwoodworking.com/finishing/',                          category: 'Finishing',    desc: 'Practical finishing advice from Popular Woodworking' },
  { title: 'Sharpening Angles Reference',         url: 'https://www.worksharpening.com/sharpening-angles.html',                  category: 'Tools',        desc: 'Correct sharpening angles for chisels, plane irons, gouges, and more' },
]

export default function Resources() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [prefill, setPrefill]       = useState(null)
  const [filter, setFilter]         = useState('All')
  const [importing, setImporting]   = useState(false)

  // Handle bookmarklet params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('save') === '1') {
      const title = decodeURIComponent(params.get('title') || '')
      const url   = decodeURIComponent(params.get('url') || '')
      if (url) { setPrefill({ title, url }); setShowAdd(true) }
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const del = async id => {
    const prev = data.resources
    mutate(d => ({ ...d, resources: d.resources.filter(r => r.id !== id) }))
    try {
      const trashed = await db.deleteResource(id)
      if (trashed) mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
    } catch(e) { mutate(d => ({ ...d, resources: prev })); toast(e.message, 'error') }
    setDeleteItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, resources: d.resources.map(r => r.id === id ? { ...r, ...fields } : r) }))
      await db.updateResource(id, fields).catch(e => toast(e.message, 'error'))
      toast('Saved', 'success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addResource(fields)
        mutate(d => ({ ...d, resources: [item, ...d.resources] }))
        toast('Saved', 'success')
        setShowAdd(false)
        setPrefill(null)
      } catch (e) { toast(e.message, 'error') }
    }
  }

  const importDefaults = async () => {
    setImporting(true)
    try {
      const existingUrls = new Set((data.resources || []).map(r => r.url))
      const toImport = DEFAULT_GUIDES.filter(g => !existingUrls.has(g.url))
      if (!toImport.length) { toast('All default guides already imported', 'success'); setImporting(false); return }
      const added = []
      for (const g of toImport) {
        const item = await db.addResource({ title: g.title, url: g.url, category: g.category, notes: g.desc })
        added.push(item)
      }
      mutate(d => ({ ...d, resources: [...added, ...d.resources] }))
      toast(`${added.length} guide${added.length > 1 ? 's' : ''} imported`, 'success')
    } catch(e) { toast(e.message, 'error') }
    setImporting(false)
  }

  const allCats = ['All', ...CATEGORIES.filter(c => (data.resources || []).some(r => r.category === c))]
  const resources = data.resources || []
  const filtered  = filter === 'All' ? resources : resources.filter(r => r.category === filter)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <h1 className="page-title">Resources</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            {allCats.length > 1 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', flex: 1 }}>
                {allCats.map(c => (
                  <button key={c} onClick={() => setFilter(c)} style={{
                    padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                    background: filter === c ? 'var(--accent)' : 'var(--fill)',
                    color: filter === c ? '#fff' : 'var(--text-2)',
                  }} aria-pressed={filter === c}>{c}</button>
                ))}
              </div>
            )}
            {resources.length === 0 && (
              <button className="btn-secondary" onClick={importDefaults} disabled={importing} style={{ flexShrink: 0, fontSize: 13 }}>
                {importing ? 'Importing…' : '↓ Import default guides'}
              </button>
            )}
          </div>
        </div>

        {/* Resource list */}
        <div style={{ paddingBottom: 24 }}>
          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-icon">📚</div>
              <div className="empty-title">No resources yet</div>
              <p className="empty-sub">
                {resources.length === 0
                  ? 'Import the default guides to get started, or add your own'
                  : `No resources in ${filter}`}
              </p>
              {resources.length === 0 && (
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={importDefaults} disabled={importing}>
                  {importing ? 'Importing…' : 'Import default guides'}
                </button>
              )}
            </div>
          )}

          {CATEGORIES.filter(cat => filtered.some(r => r.category === cat)).map(cat => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {filtered.filter(r => r.category === cat).map((r, i, arr) => (
                  <div key={r.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '12px 16px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {r.title}
                          <ILink size={12} color="var(--accent)" />
                        </a>
                        {r.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{r.notes}</div>}
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 11, background: 'var(--fill)', color: 'var(--text-3)', borderRadius: 99, padding: '2px 8px' }}>{r.category}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="icon-btn" onClick={() => setEditItem(r)} aria-label={`Edit ${r.title}`}><IEdit size={15} /></button>
                        <button className="icon-btn" onClick={() => setDeleteItem(r)} aria-label={`Delete ${r.title}`}><ITrash size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Uncategorized */}
          {filtered.filter(r => !r.category || !CATEGORIES.includes(r.category)).length > 0 && (
            <div>
              <span className="section-label">Other</span>
              <div className="group">
                {filtered.filter(r => !r.category || !CATEGORIES.includes(r.category)).map((r, i, arr) => (
                  <div key={r.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '12px 16px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, fontSize: 15, color: 'var(--accent)', textDecoration: 'none', flex: 1 }}>{r.title}</a>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="icon-btn" onClick={() => setEditItem(r)}><IEdit size={15} /></button>
                        <button className="icon-btn" onClick={() => setDeleteItem(r)} style={{ color: 'var(--red)' }}><ITrash size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add resource">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>

      {showAdd     && <ResourceSheet prefill={prefill} onSave={f => handleSave(null, f)} onClose={() => { setShowAdd(false); setPrefill(null) }} />}
      {editItem    && <ResourceSheet item={editItem} onSave={f => handleSave(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem  && <ConfirmSheet message={`Delete "${deleteItem.title}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
    </div>
  )
}

function ResourceSheet({ item, prefill, onSave, onClose }) {
  const refs = { title: useRef(), url: useRef(), cat: useRef(), notes: useRef() }

  const handleSave = async () => {
    const title = refs.title.current?.value.trim()
    const url   = refs.url.current?.value.trim()
    if (!title || !url) return
    await onSave({
      title,
      url,
      category: refs.cat.current?.value || 'General',
      notes:    refs.notes.current?.value.trim() || '',
    })
  }

  return (
    <Sheet title={item ? 'Edit Resource' : 'Add Resource'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Title">
          <input ref={refs.title} className="form-input" placeholder="Article title" defaultValue={item?.title || prefill?.title || ''} autoFocus />
        </FormCell>
        <FormCell label="URL">
          <input ref={refs.url} className="form-input" type="url" placeholder="https://…" defaultValue={item?.url || prefill?.url || ''} />
        </FormCell>
        <FormCell label="Category">
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'General'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
        <FormCell label="Notes" last>
          <input ref={refs.notes} className="form-input" placeholder="Brief description" defaultValue={item?.notes || ''} />
        </FormCell>
      </div>
    </Sheet>
  )
}
