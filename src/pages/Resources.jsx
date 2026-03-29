import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, IPlus, ITrash, IEdit, ILink } from '../components/Shared.jsx'

const CATEGORIES = ['General','Finishing','Joinery','Wood Species','Turning','Carving','Tools','Safety','Business','Other']

export default function Resources() {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd]     = useState(false)
  const [prefill, setPrefill]     = useState(null)
  const [editItem, setEditItem]   = useState(null)
  const [filter, setFilter]       = useState('All')

  // Handle bookmarklet ?save=1&title=...&url=... query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('save') === '1') {
      const title = decodeURIComponent(params.get('title') || '')
      const url   = decodeURIComponent(params.get('url') || '')
      if (url) {
        setPrefill({ title, url })
        setShowAdd(true)
        // Clean up URL without reload
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  const del = async (id) => {
    mutate(d => ({ ...d, resources: d.resources.filter(r => r.id !== id) }))
    await db.deleteResource(id).catch(e => alert('Error: ' + e.message))
  }

  const handleAdd = async (fields) => {
    try {
      const item = await db.addResource(fields)
      mutate(d => ({ ...d, resources: [item, ...d.resources] }))
      setShowAdd(false)
      setPrefill(null)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, resources: d.resources.map(r => r.id === id ? { ...r, ...fields } : r) }))
    await db.updateResource(id, fields).catch(e => alert('Error: ' + e.message))
    setEditItem(null)
  }

  const allCats = ['All', ...CATEGORIES.filter(c => data.resources.some(r => r.category === c))]
  const filtered = filter === 'All' ? data.resources : data.resources.filter(r => r.category === filter)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar">
          <h1>Resources</h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {allCats.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--fb)',
                background: filter === cat ? 'var(--blue)' : 'var(--fill)',
                color: filter === cat ? '#fff' : 'var(--text3)'
              }}>{cat}</button>
            ))}
          </div>
        </div>

        <div style={{ paddingBottom: 24 }}>
          {/* Built-in reference guides */}
          {filter === 'All' && (
            <>
              <span className="section-label">Built-in Guides</span>
              <div className="group">
                {[
                  { title: 'Wood Species Guide', url: 'https://www.wood-database.com/', desc: 'Hardness, grain, workability' },
                  { title: 'Finishing Basics', url: 'https://www.finewoodworking.com/finishing', desc: 'Fine Woodworking finishing reference' },
                  { title: 'Joint Reference', url: 'https://www.popularwoodworking.com/joinery', desc: 'Common woodworking joints' },
                  { title: 'Lumber Calculator', url: 'https://www.thecalculatorsite.com/construction/boards.php', desc: 'Board feet & lumber estimates' },
                ].map((g, i, arr) => (
                  <a key={i} href={g.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < arr.length - 1 ? '.5px solid var(--sep2)' : 'none', background: 'var(--surface)', textDecoration: 'none', color: 'inherit' }}>
                    <ILink size={16} c="var(--blue)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, color: 'var(--blue)', fontWeight: 500 }}>{g.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{g.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}

          {/* Saved resources */}
          {filtered.length > 0 && <>
            <span className="section-label">Saved{filter !== 'All' ? ` · ${filter}` : ''}</span>
            <div className="group">
              {filtered.map((r, i, arr) => (
                <div key={r.id} style={{ borderBottom: i < arr.length - 1 ? '.5px solid var(--sep2)' : 'none', background: 'var(--surface)', padding: '11px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <ILink size={15} c="var(--blue)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 15, color: 'var(--blue)', fontWeight: 500, textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </a>
                      <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.url}</div>
                      {r.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{r.notes}</div>}
                      <span style={{ fontSize: 11, background: 'var(--fill)', color: 'var(--text3)', borderRadius: 99, padding: '2px 8px', display: 'inline-block', marginTop: 6 }}>{r.category}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="icon-btn" onClick={() => setEditItem(r)}><IEdit size={15} /></button>
                      <button className="icon-btn" onClick={() => del(r.id)}><ITrash size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>}

          {filter !== 'All' && !filtered.length && (
            <div className="empty"><div className="empty-icon">🔖</div><div className="empty-title">No {filter} resources</div></div>
          )}
          {filter === 'All' && !data.resources.length && (
            <div style={{ padding: '16px 20px' }}>
              <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
                Save resources from any webpage using the bookmarklet. Go to <a href="/bookmarklet.html" target="_blank" style={{ color: 'var(--blue)' }}>bookmarklet setup page</a> to install it.
              </p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}>
        <IPlus size={22} c="#fff" sw={2.5} />
      </button>
      {showAdd && <ResourceSheet prefill={prefill} onSave={handleAdd} onClose={() => { setShowAdd(false); setPrefill(null) }} />}
      {editItem && <ResourceSheet item={editItem} onSave={f => handleEdit(editItem.id, f)} onClose={() => setEditItem(null)} />}
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
    <Sheet title={item ? 'Edit Resource' : 'Save Resource'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Title"><input ref={refs.title} className="form-input" placeholder="Article or video title" defaultValue={item?.title || prefill?.title || ''} autoFocus /></FormCell>
        <FormCell label="URL"><input ref={refs.url} className="form-input" type="url" placeholder="https://…" defaultValue={item?.url || prefill?.url || ''} /></FormCell>
        <FormCell label="Category" last>
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'General'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 4px 8px' }}>Notes (optional)</p>
      <textarea ref={refs.notes} className="bulk-textarea" style={{ minHeight: 70 }} placeholder="Why you saved this, key takeaways…" defaultValue={item?.notes || ''} />
      <div style={{ height: 8 }} />
    </Sheet>
  )
}
