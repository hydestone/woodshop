import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, BulkAddSheet, ConfirmSheet, IPlus, ITrash, IEdit, ICircle, ICheck } from '../components/Shared.jsx'

export default function Shopping() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]     = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const toggle = async item => {
    const completed = !item.completed
    const updates   = { completed }
    if (completed && !item.purchased_at) updates.purchased_at = new Date().toISOString()
    mutate(d => ({ ...d, shopping: d.shopping.map(s => s.id === item.id ? { ...s, ...updates } : s) }))
    await db.updateShopItem(item.id, updates).catch(e => toast(e.message, 'error'))
  }

  const del = async id => {
    const prev = data.shopping
    mutate(d => ({ ...d, shopping: d.shopping.filter(s => s.id !== id) }))
    try {
      const trashed = await db.deleteShopItem(id)
      if (trashed) mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
    } catch(e) { mutate(d => ({ ...d, shopping: prev })); toast(e.message, 'error') }
    setDeleteItem(null)
  }

  const clearDone = async () => {
    mutate(d => ({ ...d, shopping: d.shopping.filter(s => !s.completed) }))
    await db.clearDoneItems().catch(e => toast(e.message, 'error'))
    toast('Cleared', 'success')
  }

  const handleBulkAdd = async lines => {
    try {
      const rows  = lines.map(name => ({ name, qty: '', unit: '', store: '', notes: '', cost: null }))
      const saved = await db.addShopItemsBulk(rows)
      mutate(d => ({ ...d, shopping: [...d.shopping, ...saved] }))
      toast(`${saved.length} items added`, 'success')
      setShowAdd(false)
    } catch (e) { toast(e.message, 'error') }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, shopping: d.shopping.map(s => s.id === id ? { ...s, ...fields } : s) }))
    await db.updateShopItem(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
    setEditItem(null)
  }

  const active    = data.shopping.filter(s => !s.completed)
  const done      = data.shopping.filter(s => s.completed)
  const stores    = [...new Set(active.map(s => s.store || 'Other'))]
  const totalSpent = done.filter(s => s.cost > 0).reduce((sum, s) => sum + Number(s.cost), 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Shopping List</h1>
            {done.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {totalSpent > 0 && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>${totalSpent.toFixed(2)} spent</span>}
                <button className="btn-text" onClick={clearDone}>Clear done</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ paddingBottom: 24 }}>
          {stores.map(store => (
            <div key={store}>
              <span className="section-label">{store}</span>
              <div className="group">
                {active.filter(s => (s.store || 'Other') === store).map((item, i, arr) => (
                  <ShopRow key={item.id} item={item}
                    last={i === arr.length - 1}
                    onToggle={() => toggle(item)}
                    onEdit={() => setEditItem(item)}
                    onDelete={() => setDeleteItem(item)}
                  />
                ))}
              </div>
            </div>
          ))}
          {!active.length && !done.length && (
            <div className="empty">
              <div className="empty-icon">🛒</div>
              <div className="empty-title">List is empty</div>
              <p className="empty-sub">Click + to add items</p>
            </div>
          )}
          {done.length > 0 && <>
            <span className="section-label">Got it</span>
            <div className="group">
              {done.map((item, i) => (
                <ShopRow key={item.id} item={item}
                  last={i === done.length - 1}
                  onToggle={() => toggle(item)}
                  onEdit={() => setEditItem(item)}
                  onDelete={() => setDeleteItem(item)}
                />
              ))}
            </div>
          </>}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add items">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      {showAdd    && <BulkAddSheet title="Add Items" hint="Enter one item per line" onSave={handleBulkAdd} onClose={() => setShowAdd(false)} />}
      {editItem   && <EditShopSheet item={editItem} projects={data.projects} onSave={f => handleEdit(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem && <ConfirmSheet message={`Delete "${deleteItem.name}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
    </div>
  )
}

function ShopRow({ item, onToggle, onEdit, onDelete, last }) {
  return (
    <div className="cell" style={{ borderBottom: last ? 'none' : '1px solid var(--border-2)' }}>
      <button className="check-btn" onClick={onToggle} aria-label={item.completed ? 'Mark not purchased' : 'Mark purchased'}>
        {item.completed
          ? <ICheck size={22} color="var(--green)" sw={2} />
          : <ICircle size={22} color="var(--text-4)" sw={1.5} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-3)' : 'var(--text)' }}>
          {item.name}
          {item.qty && <span style={{ color: 'var(--text-3)' }}> · {item.qty}{item.unit ? ` ${item.unit}` : ''}</span>}
          {item.cost > 0 && <span style={{ color: 'var(--green)', fontWeight: 500 }}> · ${Number(item.cost).toFixed(2)}</span>}
        </div>
        {item.notes && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{item.notes}</div>}
      </div>
      <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${item.name}`}><IEdit size={15} /></button>
      <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${item.name}`}><ITrash size={15} /></button>
    </div>
  )
}

function EditShopSheet({ item, onSave, onClose, projects = [] }) {
  const refs = { name: useRef(), qty: useRef(), unit: useRef(), store: useRef(), notes: useRef(), cost: useRef() }
  const [projectId, setProjectId] = useState(item.project_id || '')
  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    const costVal = refs.cost.current?.value.trim()
    await onSave({
      name,
      qty:   refs.qty.current?.value.trim()   || '',
      unit:  refs.unit.current?.value.trim()  || '',
      store: refs.store.current?.value.trim() || '',
      notes: refs.notes.current?.value.trim() || '',
      cost:  costVal ? parseFloat(costVal) : null,
      project_id: projectId || null,
    })
  }
  return (
    <Sheet title="Edit Item" onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Item"><input ref={refs.name} className="form-input" defaultValue={item.name} autoFocus /></FormCell>
        <FormCell label="Qty"><input ref={refs.qty} className="form-input" defaultValue={item.qty} placeholder="1" /></FormCell>
        <FormCell label="Unit"><input ref={refs.unit} className="form-input" defaultValue={item.unit} placeholder="qt" /></FormCell>
        <FormCell label="Store"><input ref={refs.store} className="form-input" defaultValue={item.store} placeholder="Woodcraft" /></FormCell>
        <FormCell label="Notes"><input ref={refs.notes} className="form-input" defaultValue={item.notes} placeholder="Optional" /></FormCell>
        <FormCell label="Cost (USD)">
          <input ref={refs.cost} className="form-input" type="number" step="0.01" defaultValue={item.cost || ''} placeholder="0.00" />
        </FormCell>
        <FormCell label="Project" last>
          <select
            className="form-input"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
          >
            <option value="">— General shop —</option>
            {projects.filter(p => p.status !== 'complete').sort((a,b) => a.name.localeCompare(b.name)).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </FormCell>
      </div>
      <p className="form-hint">Cost logs to your total when you check the item as purchased.</p>
    </Sheet>
  )
}
