import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, IPlus, ITrash, IEdit } from '../components/Shared.jsx'

const CATEGORIES = ['Topcoat','Sealer','Oil','Wax','Stain','Dye','Paint','Other']

export default function Finishes() {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd]   = useState(false)
  const [editItem, setEditItem] = useState(null)

  const del = async (id) => {
    mutate(d => ({ ...d, finishProducts: d.finishProducts.filter(p => p.id !== id) }))
    await db.deleteFinishProduct(id).catch(e => alert('Error: ' + e.message))
  }

  const handleAdd = async (fields) => {
    try {
      const item = await db.addFinishProduct(fields)
      mutate(d => ({ ...d, finishProducts: [...d.finishProducts, item] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, finishProducts: d.finishProducts.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updateFinishProduct(id, fields).catch(e => alert('Error: ' + e.message))
    setEditItem(null)
  }

  const byCat = {}
  for (const p of data.finishProducts) {
    const cat = p.category || 'Other'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(p)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar"><h1>Finishes</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {CATEGORIES.filter(c => byCat[c]?.length).map(cat => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {byCat[cat].map((p, i, arr) => (
                  <div key={p.id} style={{ borderBottom: i < arr.length - 1 ? '.5px solid var(--sep2)' : 'none', background: 'var(--surface)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, paddingRight: 12 }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.manufacturer && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{p.manufacturer}</div>}
                        {p.notes && (
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--text4)', fontSize: 12 }}>Notes: </span>{p.notes}
                          </div>
                        )}
                        {p.feedback && (
                          <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5, background: 'rgba(0,122,255,.06)', borderRadius: 8, padding: '6px 10px' }}>
                            <span style={{ color: 'var(--blue)', fontSize: 12, fontWeight: 600 }}>Feedback: </span>{p.feedback}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="icon-btn" onClick={() => setEditItem(p)}><IEdit size={15} /></button>
                        <button className="icon-btn" onClick={() => del(p.id)}><ITrash size={15} /></button>
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
              <div className="empty-sub">Build your own finish library with notes and feedback</div>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}>
        <IPlus size={22} c="#fff" sw={2.5} />
      </button>
      {showAdd && <FinishSheet onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editItem && <FinishSheet item={editItem} onSave={f => handleEdit(editItem.id, f)} onClose={() => setEditItem(null)} />}
    </div>
  )
}

function FinishSheet({ item, onSave, onClose }) {
  const refs = { name: useRef(), mfr: useRef(), cat: useRef(), notes: useRef(), feedback: useRef() }
  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    await onSave({
      name,
      manufacturer: refs.mfr.current?.value.trim() || '',
      category:     refs.cat.current?.value || 'Topcoat',
      notes:        refs.notes.current?.value.trim() || '',
      feedback:     refs.feedback.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Finish' : 'Add Finish'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Product name"><input ref={refs.name} className="form-input" placeholder="Arm-R-Seal" defaultValue={item?.name || ''} autoFocus /></FormCell>
        <FormCell label="Manufacturer"><input ref={refs.mfr} className="form-input" placeholder="General Finishes" defaultValue={item?.manufacturer || ''} /></FormCell>
        <FormCell label="Category" last>
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'Topcoat'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 4px 8px' }}>Application notes</p>
      <textarea ref={refs.notes} className="bulk-textarea" style={{ minHeight: 80 }} placeholder="Dilution, application method, drying tips…" defaultValue={item?.notes || ''} />
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '12px 4px 8px' }}>Your feedback</p>
      <textarea ref={refs.feedback} className="bulk-textarea" style={{ minHeight: 80 }} placeholder="What worked, what didn't, would you use again?" defaultValue={item?.feedback || ''} />
      <div style={{ height: 8 }} />
    </Sheet>
  )
}
