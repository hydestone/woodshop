import { useState } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import { ConfirmSheet, ITrash, IEdit } from '../components/Shared.jsx'
import * as db from '../db.js'

function ManagedList({ title, items, onAdd, onRename, onDelete }) {
  const toast = useToast()
  const [newName, setNewName]   = useState('')
  const [editItem, setEditItem] = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [delItem, setDelItem]   = useState(null)

  const handleAdd = async () => {
    const name = newName.trim(); if (!name) return
    try { await onAdd(name); setNewName(''); toast(`${name} added`, 'success') }
    catch(e) { toast(e.message, 'error') }
  }

  const handleRename = async () => {
    const name = editVal.trim(); if (!name) return
    try { await onRename(editItem.id, name); setEditItem(null); toast('Renamed', 'success') }
    catch(e) { toast(e.message, 'error') }
  }

  const handleDelete = async () => {
    try { await onDelete(delItem.id); setDelItem(null); toast('Deleted', 'success') }
    catch(e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '0 20px', marginBottom: 6 }}>{title}</div>
      <div className="group">
        {items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--border-2)' : 'none', background: 'var(--surface)' }}>
            {editItem?.id === item.id ? (
              <>
                <input className="form-input" style={{ flex: 1 }} value={editVal} onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditItem(null) }} autoFocus />
                <button className="btn-text" style={{ marginLeft: 8 }} onClick={handleRename}>Save</button>
                <button className="btn-text" style={{ marginLeft: 4, color: 'var(--text-3)' }} onClick={() => setEditItem(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 15, color: 'var(--text)' }}>{item.name}</span>
                <button className="icon-btn" onClick={() => { setEditItem(item); setEditVal(item.name) }} aria-label="Rename"><IEdit size={14} /></button>
                <button className="icon-btn" onClick={() => setDelItem(item)} style={{ color: 'var(--red)' }} aria-label="Delete"><ITrash size={14} /></button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-3)', background: 'var(--surface)' }}>None yet</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0' }}>
        <input
          className="calc-input"
          style={{ flex: 1 }}
          placeholder={`Add ${title.toLowerCase()}…`}
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="btn-secondary" style={{ padding: '0 16px', flexShrink: 0 }} onClick={handleAdd}>Add</button>
      </div>
      {delItem && <ConfirmSheet message={`Delete "${delItem.name}"? Projects using this won't be affected.`} onConfirm={handleDelete} onClose={() => setDelItem(null)} />}
    </div>
  )
}

export default function Settings() {
  const { data, mutate } = useCtx()
  const categories = data.categories || []

  return (
    <div className="scroll-page">
      <div className="page-header">
        <h1 className="page-title">Categories</h1>
        <p className="page-subtitle">
          Project categories used to organise your work. Finishes are in Library → Finishes. Species are in Wood Stock.
        </p>
      </div>
      <div style={{ paddingBottom: 40 }}>
        <ManagedList
          title="Project Categories"
          items={categories}
          onAdd={async name => {
            const item = await db.addCategory(name)
            mutate(d => ({ ...d, categories: [...(d.categories||[]), item].sort((a,b)=>a.name.localeCompare(b.name)) }))
          }}
          onRename={async (id, name) => {
            await db.updateCategory(id, name)
            const old = data.categories.find(c => c.id === id)
            mutate(d => ({
              ...d,
              categories: d.categories.map(c => c.id === id ? { ...c, name } : c),
              projects: old ? d.projects.map(p => p.category === old.name ? { ...p, category: name } : p) : d.projects,
            }))
          }}
          onDelete={async id => {
            await db.deleteCategory(id)
            mutate(d => ({ ...d, categories: d.categories.filter(c => c.id !== id) }))
          }}
        />
      </div>
    </div>
  )
}
