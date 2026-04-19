import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, ConfirmSheet, IPlus, ITrash, IEdit, ICircle, ICheck } from '../components/Shared.jsx'

const CATEGORIES = ['Wish List', 'Planned Upgrade', 'Layout Idea', 'Tool Acquisition', 'Safety', 'Other']
const autoExpand = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }

export default function ShopImprovements() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [filter, setFilter]         = useState('active')

  const toggle = async item => {
    const completed = !item.completed
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.map(s => s.id === item.id ? { ...s, completed } : s) }))
    await db.updateShopImprovement(item.id, { completed }).catch(e => toast(e.message, 'error'))
  }

  const del = async id => {
    const item = data.shopImprovements.find(s => s.id === id)
    const prev = data.shopImprovements
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.filter(s => s.id !== id) }))
    try {
      const trashed = await db.deleteShopImprovement(id)
      if (trashed) {
        mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
        toast(`"${item?.title || 'Item'}" deleted`, 'success', 4000, {
          label: 'Undo',
          onClick: async () => {
            try {
              await db.restoreFromTrash(trashed.id, trashed)
              mutate(d => ({ ...d, shopImprovements: [item, ...d.shopImprovements], trash: d.trash.filter(t => t.id !== trashed.id) }))
            } catch(e) { toast(e.message, 'error') }
          }
        })
      }
    } catch(e) { mutate(d => ({ ...d, shopImprovements: prev })); toast(e.message, 'error') }
    setDeleteItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, shopImprovements: d.shopImprovements.map(s => s.id === id ? { ...s, ...fields } : s) }))
      await db.updateShopImprovement(id, fields).catch(e => toast(e.message, 'error'))
      toast('Saved', 'success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addShopImprovement(fields)
        mutate(d => ({ ...d, shopImprovements: [...d.shopImprovements, item] }))
        toast('Added', 'success')
        setShowAdd(false)
      } catch (e) { toast(e.message, 'error') }
    }
  }

  const active = data.shopImprovements.filter(s => !s.completed)
  const done   = data.shopImprovements.filter(s => s.completed)
  const items  = filter === 'active' ? active : done

  const byCat = CATEGORIES.reduce((acc, c) => {
    const catItems = items.filter(s => s.category === c)
    if (catItems.length) acc.push({ cat: c, catItems })
    return acc
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Shop</h1>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
              <button className={filter === 'active' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => setFilter('active')}>Active ({active.length})</button>
              <button className={filter === 'done'   ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 14px', fontSize: 13 }} onClick={() => setFilter('done')}>Done ({done.length})</button>
            </div>
          </div>
        </div>
        <div style={{ paddingBottom: 24 }}>
          {byCat.map(({ cat, catItems }) => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {catItems.map((item, i, arr) => (
                  <div key={item.id} className="cell" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                    <button className="check-btn" style={{ marginTop: 2 }} onClick={() => toggle(item)} aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}>
                      {item.completed ? <ICheck size={22} color="var(--green)" sw={2} /> : <ICircle size={22} color="var(--text-4)" sw={1.5} />}
                    </button>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-3)' : 'var(--text)' }}>{item.title}</div>
                      {item.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.5 }}>{item.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                      <button className="icon-btn" onClick={() => setEditItem(item)} aria-label={`Edit ${item.title}`}><IEdit size={15} /></button>
                      <button className="icon-btn" onClick={() => setDeleteItem(item)} aria-label={`Delete ${item.title}`}><ITrash size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!items.length && (
            <div className="empty">
              <div className="empty-icon">🏠</div>
              <div className="empty-title">{filter === 'active' ? 'Nothing planned yet' : 'Nothing completed yet'}</div>
              <p className="empty-sub">Track planned upgrades, wish list items, and layout ideas</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add improvement">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      {showAdd     && <ImprovementSheet onSave={f => handleSave(null, f)} onClose={() => setShowAdd(false)} />}
      {editItem    && <ImprovementSheet item={editItem} onSave={f => handleSave(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem  && <ConfirmSheet message={`Delete "${deleteItem.title}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
    </div>
  )
}

function ImprovementSheet({ item, onSave, onClose }) {
  const refs     = { title: useRef(), cat: useRef() }
  const notesRef = useRef()
  const handleSave = async () => {
    const title = refs.title.current?.value.trim()
    if (!title) return
    await onSave({
      title,
      category: refs.cat.current?.value || 'Wish List',
      notes:    notesRef.current?.value.trim() || '',
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
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Notes</p>
      <textarea ref={notesRef} className="form-textarea" style={{ width: '100%', marginBottom: 4 }} placeholder="Details, cost estimate…" defaultValue={item?.notes || ''} onChange={autoExpand} />
    </Sheet>
  )
}
