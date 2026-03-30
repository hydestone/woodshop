import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, ConfirmSheet, IPlus, ITrash, IEdit } from '../components/Shared.jsx'

const CATEGORIES = ['Topcoat', 'Sealer', 'Oil', 'Wax', 'Stain', 'Dye', 'Paint', 'Other']

const autoExpand = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }

export default function Finishes() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const del = async id => {
    mutate(d => ({ ...d, finishProducts: d.finishProducts.filter(p => p.id !== id) }))
    await db.deleteFinishProduct(id).catch(e => toast(e.message, 'error'))
    setDeleteItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, finishProducts: d.finishProducts.map(p => p.id === id ? { ...p, ...fields } : p) }))
      await db.updateFinishProduct(id, fields).catch(e => toast(e.message, 'error'))
      toast('Saved', 'success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addFinishProduct(fields)
        mutate(d => ({ ...d, finishProducts: [...d.finishProducts, item] }))
        toast('Added', 'success')
        setShowAdd(false)
      } catch (e) { toast(e.message, 'error') }
    }
  }

  const byCat = CATEGORIES.reduce((acc, c) => {
    const items = data.finishProducts.filter(p => p.category === c)
    if (items.length) acc.push({ cat: c, items })
    return acc
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header"><h1 className="page-title">Finishes</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {byCat.map(({ cat, items }) => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {items.map((p, i, arr) => (
                  <div key={p.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '12px 16px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.manufacturer && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{p.manufacturer}</div>}
                        {p.notes && (
                          <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--text-4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Notes </span>{p.notes}
                          </div>
                        )}
                        {p.feedback && (
                          <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.5, background: 'var(--accent-dim)', borderRadius: 8, padding: '8px 10px' }}>
                            <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Feedback </span>{p.feedback}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="icon-btn" onClick={() => setEditItem(p)} aria-label={`Edit ${p.name}`}><IEdit size={15} /></button>
                        <button className="icon-btn" onClick={() => setDeleteItem(p)} aria-label={`Delete ${p.name}`}><ITrash size={15} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!data.finishProducts.length && (
            <div className="empty">
              <div className="empty-icon">🎨</div>
              <div className="empty-title">No products yet</div>
              <p className="empty-sub">Build your finish library with notes and feedback</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add finish product">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      {showAdd     && <FinishSheet onSave={f => handleSave(null, f)} onClose={() => setShowAdd(false)} />}
      {editItem    && <FinishSheet item={editItem} onSave={f => handleSave(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem  && <ConfirmSheet message={`Delete "${deleteItem.name}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
    </div>
  )
}

function FinishSheet({ item, onSave, onClose }) {
  const refs    = { name: useRef(), mfr: useRef(), cat: useRef() }
  const notesRef    = useRef()
  const feedbackRef = useRef()
  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    await onSave({
      name,
      manufacturer: refs.mfr.current?.value.trim()  || '',
      category:     refs.cat.current?.value          || 'Topcoat',
      notes:        notesRef.current?.value.trim()   || '',
      feedback:     feedbackRef.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Finish' : 'Add Finish'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Product"><input ref={refs.name} className="form-input" placeholder="Arm-R-Seal" defaultValue={item?.name || ''} autoFocus /></FormCell>
        <FormCell label="Manufacturer"><input ref={refs.mfr} className="form-input" placeholder="General Finishes" defaultValue={item?.manufacturer || ''} /></FormCell>
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
