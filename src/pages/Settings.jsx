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
        <input className="form-input" style={{ flex: 1 }} placeholder={`Add ${title.toLowerCase()}…`} value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button className="btn-secondary" style={{ padding: '0 16px', flexShrink: 0 }} onClick={handleAdd}>Add</button>
      </div>
      {delItem && <ConfirmSheet message={`Delete "${delItem.name}"? Projects using this won't be affected.`} onConfirm={handleDelete} onClose={() => setDelItem(null)} />}
    </div>
  )
}

export default function Settings() {
  const { data, mutate } = useCtx()
  const categories  = data.categories  || []
  const species     = data.species     || []
  const finishes    = data.finishes    || []

  return (
    <div className="scroll-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>
      <div style={{ paddingBottom: 40 }}>

        <ManagedList
          title="Categories"
          items={categories}
          onAdd={async name => {
            const item = await db.addCategory(name)
            mutate(d => ({ ...d, categories: [...(d.categories||[]), item].sort((a,b)=>a.name.localeCompare(b.name)) }))
          }}
          onRename={async (id, name) => {
            await db.updateCategory(id, name)
            mutate(d => ({ ...d, categories: d.categories.map(c => c.id === id ? { ...c, name } : c) }))
            // Update all projects using this category name
            mutate(d => ({
              ...d,
              projects: d.projects.map(p => {
                const old = d.categories.find(c => c.id === id)
                return old && p.category === old.name ? { ...p, category: name } : p
              })
            }))
          }}
          onDelete={async id => {
            await db.deleteCategory(id)
            mutate(d => ({ ...d, categories: d.categories.filter(c => c.id !== id) }))
          }}
        />

        <ManagedList
          title="Wood Species"
          items={species}
          onAdd={async name => {
            const item = await db.addSpecies(name)
            mutate(d => ({ ...d, species: [...(d.species||[]), item].sort((a,b)=>a.name.localeCompare(b.name)) }))
          }}
          onRename={async (id, name) => {
            await db.updateSpecies(id, name)
            // Update species in db for all projects with this species_id
            mutate(d => ({
              ...d,
              species: d.species.map(s => s.id === id ? { ...s, name } : s),
              projects: d.projects.map(p => p.species_id === id ? { ...p, wood_type: name } : p)
            }))
            // Persist to projects table
            const affected = data.projects.filter(p => p.species_id === id)
            await Promise.all(affected.map(p => db.updateProject(p.id, { wood_type: name })))
          }}
          onDelete={async id => {
            await db.deleteSpecies(id)
            mutate(d => ({ ...d, species: d.species.filter(s => s.id !== id) }))
          }}
        />

        <ManagedList
          title="Finishes"
          items={finishes}
          onAdd={async name => {
            const item = await db.addFinish(name)
            mutate(d => ({ ...d, finishes: [...(d.finishes||[]), item].sort((a,b)=>a.name.localeCompare(b.name)) }))
          }}
          onRename={async (id, name) => {
            await db.updateFinish(id, name)
            mutate(d => ({
              ...d,
              finishes: d.finishes.map(f => f.id === id ? { ...f, name } : f),
              projects: d.projects.map(p => p.finish_id === id ? { ...p, finish_used: name } : p)
            }))
            const affected = data.projects.filter(p => p.finish_id === id)
            await Promise.all(affected.map(p => db.updateProject(p.id, { finish_used: name })))
          }}
          onDelete={async id => {
            await db.deleteFinish(id)
            mutate(d => ({ ...d, finishes: d.finishes.filter(f => f.id !== id) }))
          }}
        />

      </div>
    </div>
  )
}
