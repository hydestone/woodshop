import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, IPlus, ITrash, IEdit, ICirc, IDone } from '../components/Shared.jsx'

const CATEGORIES = ['Wish List','Planned Upgrade','Layout Idea','Tool Acquisition','Safety','Other']

export default function ShopImprovements() {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filter, setFilter]     = useState('active')

  const toggle = async (item) => {
    const completed = !item.completed
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.map(s => s.id === item.id ? { ...s, completed } : s) }))
    await db.updateShopImprovement(item.id, { completed }).catch(e => alert('Error: ' + e.message))
  }

  const del = async (id) => {
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.filter(s => s.id !== id) }))
    await db.deleteShopImprovement(id).catch(e => alert('Error: ' + e.message))
  }

  const handleAdd = async (fields) => {
    try {
      const item = await db.addShopImprovement(fields)
      mutate(d => ({ ...d, shopImprovements: [...d.shopImprovements, item] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.map(s => s.id === id ? { ...s, ...fields } : s) }))
    await db.updateShopImprovement(id, fields).catch(e => alert('Error: ' + e.message))
    setEditItem(null)
  }

  const active = data.shopImprovements.filter(s => !s.completed)
  const done   = data.shopImprovements.filter(s => s.completed)
  const items  = filter === 'active' ? active : done

  const byCat = {}
  for (const s of items) {
    const cat = s.category || 'Other'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(s)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar">
          <div className="navbar-row">
            <h1>Shop</h1>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
              <button onClick={() => setFilter('active')} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'var(--fb)', background: filter === 'active' ? 'var(--blue)' : 'var(--fill)', color: filter === 'active' ? '#fff' : 'var(--text3)' }}>Active ({active.length})</button>
              <button onClick={() => setFilter('done')} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, fontFamily: 'var(--fb)', background: filter === 'done' ? 'var(--blue)' : 'var(--fill)', color: filter === 'done' ? '#fff' : 'var(--text3)' }}>Done ({done.length})</button>
            </div>
          </div>
        </div>
        <div style={{ paddingBottom: 24 }}>
          {CATEGORIES.filter(c => byCat[c]?.length).map(cat => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {byCat[cat].map((item, i, arr) => (
                  <div key={item.id} className="cell" style={{ borderBottom: i < arr.length - 1 ? '.5px solid var(--sep2)' : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                    <button className="check-btn" style={{ marginTop: 2 }} onClick={() => toggle(item)}>
                      {item.completed ? <IDone size={22} c="var(--green)" sw={2} /> : <ICirc size={22} c="var(--text4)" sw={1.5} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text3)' : 'var(--text)' }}>{item.title}</div>
                      {item.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{item.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                      <button className="icon-btn" onClick={() => setEditItem(item)}><IEdit size={15} /></button>
                      <button className="icon-btn" onClick={() => del(item.id)}><ITrash size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!items.length && (
            <div className="empty">
              <div className="empty-icon">🏠</div>
              <div className="empty-title">{filter === 'active' ? 'No items yet' : 'Nothing done yet'}</div>
              <div className="empty-sub">Track planned upgrades, wish list items, and layout ideas</div>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}>
        <IPlus size={22} c="#fff" sw={2.5} />
      </button>
      {showAdd && <ImprovementSheet onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editItem && <ImprovementSheet item={editItem} onSave={f => handleEdit(editItem.id, f)} onClose={() => setEditItem(null)} />}
    </div>
  )
}

function ImprovementSheet({ item, onSave, onClose }) {
  const refs = { title: useRef(), cat: useRef(), notes: useRef() }
  const handleSave = async () => {
    const title = refs.title.current?.value.trim()
    if (!title) return
    await onSave({
      title,
      category: refs.cat.current?.value || 'Wish List',
      notes:    refs.notes.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Item' : 'Add Item'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Item"><input ref={refs.title} className="form-input" placeholder="Dust collector upgrade" defaultValue={item?.title || ''} autoFocus /></FormCell>
        <FormCell label="Category" last>
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'Wish List'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 4px 8px' }}>Notes (optional)</p>
      <textarea ref={refs.notes} className="bulk-textarea" style={{ minHeight: 80 }} placeholder="Details, cost estimate, links…" defaultValue={item?.notes || ''} />
      <div style={{ height: 8 }} />
    </Sheet>
  )
}
