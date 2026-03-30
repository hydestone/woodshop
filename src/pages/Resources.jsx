import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, ConfirmSheet, IPlus, ITrash, IEdit, ILink } from '../components/Shared.jsx'

const CATEGORIES = ['General', 'Finishing', 'Joinery', 'Wood Species', 'Turning', 'Carving', 'Tools', 'Safety', 'Business', 'Other']

const BUILT_IN = [
  { title: 'Wood Database',          url: 'https://www.wood-database.com/',               desc: 'Species guide — hardness, grain, workability' },
  { title: 'Fine Woodworking',       url: 'https://www.finewoodworking.com/finishing',    desc: 'Finishing reference articles' },
  { title: 'Lumber Calculator',      url: 'https://www.thecalculatorsite.com/construction/boards.php', desc: 'Board feet & lumber estimates' },
  { title: 'American Association of Woodturners', url: 'https://www.woodturner.org/',    desc: 'Turning resources and community' },
]

export default function Resources() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [prefill, setPrefill]       = useState(null)
  const [filter, setFilter]         = useState('All')

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
    mutate(d => ({ ...d, resources: d.resources.filter(r => r.id !== id) }))
    await db.deleteResource(id).catch(e => toast(e.message, 'error'))
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

  const allCats = ['All', ...CATEGORIES.filter(c => data.resources.some(r => r.category === c))]
  const filtered = filter === 'All' ? data.resources : data.resources.filter(r => r.category === filter)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <h1 className="page-title">Resources</h1>
          {allCats.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
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
        </div>
        <div style={{ paddingBottom: 24 }}>
          {filter === 'All' && (
            <>
              <span className="section-label">Built-in Guides</span>
              <div className="group">
                {BUILT_IN.map((g, i) => (
                  <a key={i} href={g.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < BUILT_IN.length - 1 ? '1px solid var(--border-2)' : 'none', background: 'var(--surface)', textDecoration: 'none', color: 'inherit' }}>
                    <ILink size={15} color="var(--accent)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 500 }}>{g.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{g.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
          {filtered.length > 0 && (
            <>
              <span className="section-label">Saved{filter !== 'All' ? ` · ${filter}` : ''}</span>
              <div className="group">
                {filtered.map((r, i, arr) => (
                  <div key={r.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '11px 16px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <ILink size={15} color="var(--accent)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={r.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 15, color: 'var(--accent)', fontWeight: 500, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.title}
                        </a>
                        <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</div>
                        {r.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{r.notes}</div>}
                        <span style={{ fontSize: 11, background: 'var(--fill)', color: 'var(--text-3)', borderRadius: 99, padding: '2px 8px', display: 'inline-block', marginTop: 6 }}>{r.category}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="icon-btn" onClick={() => setEditItem(r)} aria-label={`Edit ${r.title}`}><IEdit size={15} /></button>
                        <button className="icon-btn" onClick={() => setDeleteItem(r)} aria-label={`Delete ${r.title}`}><ITrash size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {filter !== 'All' && !filtered.length && (
            <div className="empty"><div className="empty-icon">🔖</div><div className="empty-title">No {filter} resources</div></div>
          )}
          {filter === 'All' && !data.resources.length && (
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
                Save resources from any webpage using the bookmarklet.{' '}
                <a href="/bookmarklet.html" target="_blank" style={{ color: 'var(--accent)' }}>Set up the bookmarklet →</a>
              </p>
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
  const refs    = { title: useRef(), url: useRef(), cat: useRef() }
  const notesRef = useRef()
  const handleSave = async () => {
    const title = refs.title.current?.value.trim()
    const url   = refs.url.current?.value.trim()
    if (!title || !url) return
    await onSave({
      title,
      url,
      category: refs.cat.current?.value || 'General',
      notes:    notesRef.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Resource' : 'Save Resource'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Title"><input ref={refs.title} className="form-input" placeholder="Article title" defaultValue={item?.title || prefill?.title || ''} autoFocus /></FormCell>
        <FormCell label="URL"><input ref={refs.url} className="form-input" type="url" placeholder="https://…" defaultValue={item?.url || prefill?.url || ''} /></FormCell>
        <FormCell label="Category" last>
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'General'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Notes (optional)</p>
      <textarea ref={notesRef} className="form-textarea" style={{ width: '100%', marginBottom: 4 }} placeholder="Why you saved this, key takeaways…" defaultValue={item?.notes || ''} />
    </Sheet>
  )
}
