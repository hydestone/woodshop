import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, ConfirmSheet, IPlus, ITrash, IEdit } from '../components/Shared.jsx'

const autoExpand = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }

export default function Finishes() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [expanded, setExpanded]     = useState(null) // id of expanded row
  const [search, setSearch]         = useState('')

  const del = async id => {
    const prev = data.finishProducts
    mutate(d => ({ ...d, finishProducts: d.finishProducts.filter(p => p.id !== id) }))
    try {
      const trashed = await db.deleteFinishProduct(id)
      if (trashed) mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
    } catch(e) { mutate(d => ({ ...d, finishProducts: prev })); toast(e.message, 'error') }
    setDeleteItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, finishProducts: d.finishProducts.map(p => p.id === id ? { ...p, ...fields } : p) }))
      await db.updateFinishProduct(id, fields).catch(e => toast(e.message, 'error'))
      toast('Finish saved', 'success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addFinishProduct(fields)
        mutate(d => ({ ...d, finishProducts: [...d.finishProducts, item] }))
        // Also add to project dropdown if not already present
        const exists = (d.finishes || []).some(f => f.name.toLowerCase() === fields.name.toLowerCase())
        if (!exists) {
          const dropItem = await db.addFinish(fields.name)
          mutate(d => ({ ...d, finishes: [...(d.finishes||[]), dropItem].sort((a,b) => a.name.localeCompare(b.name)) }))
        }
        toast('Finish added', 'success')
        setShowAdd(false)
      } catch (e) { toast(e.message, 'error') }
    }
  }

  const sorted = [...data.finishProducts]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
                             p.manufacturer?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <h1 className="page-title">Finishes</h1>
          {data.finishProducts.length > 4 && (
            <input
              className="calc-input"
              placeholder="Search finishes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginTop: 10, width: '100%' }}
            />
          )}
        </div>

        <div style={{ paddingBottom: 24 }}>
          {sorted.length > 0 ? (
            <div className="group">
              {sorted.map((p, i) => (
                <div key={p.id} style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border-2)' : 'none' }}>
                  {/* Row */}
                  <div
                    style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                      {p.manufacturer && (
                        <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 1 }}>{p.manufacturer}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                      {p.category && (
                        <span style={{ fontSize: 11, color: 'var(--text-4)', background: 'var(--fill)', borderRadius: 99, padding: '2px 8px' }}>
                          {p.category}
                        </span>
                      )}
                      <button className="icon-btn" onClick={e => { e.stopPropagation(); setEditItem(p) }} aria-label={`Edit ${p.name}`}>
                        <IEdit size={15} />
                      </button>
                      <button className="icon-btn" onClick={e => { e.stopPropagation(); setDeleteItem(p) }} aria-label={`Delete ${p.name}`} style={{ color: 'var(--red)' }}>
                        <ITrash size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expanded === p.id && (p.notes || p.feedback) && (
                    <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-2)', background: 'var(--fill-2)' }}>
                      {p.notes && (
                        <div style={{ paddingTop: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Notes</div>
                          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{p.notes}</div>
                        </div>
                      )}
                      {p.feedback && (
                        <div style={{ marginTop: p.notes ? 10 : 10, background: 'var(--accent-dim)', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Feedback</div>
                          <div style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{p.feedback}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon">🎨</div>
              <div className="empty-title">{search ? 'No results' : 'No finishes yet'}</div>
              <p className="empty-sub">
                {search ? `No finishes matching "${search}"` : 'Build your finish library with notes and feedback on each product'}
              </p>
            </div>
          )}
        </div>
      </div>

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add finish">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>

      {showAdd    && <FinishSheet onSave={f => handleSave(null, f)} onClose={() => setShowAdd(false)} />}
      {editItem   && <FinishSheet item={editItem} onSave={f => handleSave(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem && <ConfirmSheet message={`Delete "${deleteItem.name}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
    </div>
  )
}

const CATEGORIES = ['Topcoat', 'Sealer', 'Oil', 'Wax', 'Stain', 'Dye', 'Paint', 'Other']

function FinishSheet({ item, onSave, onClose }) {
  const refs = { name: useRef(), mfr: useRef(), cat: useRef() }
  const notesRef    = useRef()
  const feedbackRef = useRef()

  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    await onSave({
      name,
      manufacturer: refs.mfr.current?.value.trim()   || '',
      category:     refs.cat.current?.value           || 'Topcoat',
      notes:        notesRef.current?.value.trim()    || '',
      feedback:     feedbackRef.current?.value.trim() || '',
    })
  }

  return (
    <Sheet title={item ? 'Edit Finish' : 'Add Finish'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Product">
          <input ref={refs.name} className="form-input" placeholder="Arm-R-Seal" defaultValue={item?.name || ''} autoFocus />
        </FormCell>
        <FormCell label="Manufacturer">
          <input ref={refs.mfr} className="form-input" placeholder="General Finishes" defaultValue={item?.manufacturer || ''} />
        </FormCell>
        <FormCell label="Category" last>
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'Topcoat'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Application notes</p>
      <textarea ref={notesRef} className="form-textarea" style={{ width: '100%' }} placeholder="Dilution, method, drying tips…" defaultValue={item?.notes || ''} onChange={autoExpand} />
      <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '12px 0 8px' }}>Your feedback</p>
      <textarea ref={feedbackRef} className="form-textarea" style={{ width: '100%', marginBottom: 4 }} placeholder="What worked, what didn't, would you use again?" defaultValue={item?.feedback || ''} onChange={autoExpand} />
    </Sheet>
  )
}
