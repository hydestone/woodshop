import { useState, useMemo } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import { ConfirmSheet, ITrash, IEdit } from '../components/Shared.jsx'
import * as db from '../db.js'

function TagsSection({ tags, onRename, onDelete }) {
  const toast = useToast()
  const [editTag, setEditTag]   = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [delTag, setDelTag]     = useState(null)

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '0 20px', marginBottom: 6 }}>Photo Tags</div>
      <div className="group">
        {tags.map((tag, i) => (
          <div key={tag} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: i < tags.length - 1 ? '1px solid var(--c-border-light)' : 'none', background: 'var(--c-bg-surface)' }}>
            {editTag === tag ? (
              <>
                <input className="form-input" style={{ flex: 1 }} value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { await onRename(tag, editVal); setEditTag(null); toast('Tag renamed', 'success') }
                    if (e.key === 'Escape') setEditTag(null)
                  }} autoFocus />
                <button className="btn-secondary" style={{ marginLeft: 8, padding: '4px 12px', fontSize: 13 }}
                  onClick={async () => { await onRename(tag, editVal); setEditTag(null); toast('Tag renamed', 'success') }}>Save</button>
                <button className="btn-secondary" style={{ marginLeft: 6, padding: '4px 12px', fontSize: 13 }}
                  onClick={() => setEditTag(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--c-text-primary)' }}>{tag}</span>
                <button className="icon-btn" onClick={() => { setEditTag(tag); setEditVal(tag) }} aria-label="Rename tag"><IEdit size={15} /></button>
                <button className="icon-btn" onClick={() => setDelTag(tag)} aria-label="Delete tag"><ITrash size={15} /></button>
              </>
            )}
          </div>
        ))}
        {tags.length === 0 && <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-text-muted)', background: 'var(--c-bg-surface)' }}>No tags yet — add tags to photos to manage them here.</div>}
      </div>
      {delTag && <ConfirmSheet message={`Remove tag "${delTag}" from all photos? This cannot be undone.`} onConfirm={async () => { await onDelete(delTag); setDelTag(null); toast('Tag removed', 'success') }} onClose={() => setDelTag(null)} />}
    </div>
  )
}

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
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '0 20px', marginBottom: 6 }}>{title}</div>
      <div className="group">
        {items.map((item, i) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: i < items.length - 1 ? '1px solid var(--c-border-light)' : 'none', background: 'var(--c-bg-surface)' }}>
            {editItem?.id === item.id ? (
              <>
                <input className="form-input" style={{ flex: 1 }} value={editVal} onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditItem(null) }} autoFocus />
                <button className="btn-text" style={{ marginLeft: 8 }} onClick={handleRename}>Save</button>
                <button className="btn-text" style={{ marginLeft: 4, color: 'var(--c-text-muted)' }} onClick={() => setEditItem(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>{item.name}</span>
                <button className="icon-btn" onClick={() => { setEditItem(item); setEditVal(item.name) }} aria-label="Rename"><IEdit size={14} /></button>
                <button className="icon-btn" onClick={() => setDelItem(item)} style={{ color: 'var(--red)' }} aria-label="Delete"><ITrash size={14} /></button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--c-text-muted)', background: 'var(--c-bg-surface)' }}>None yet</div>}
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

  // Derive all tags from photos
  const allTags = useMemo(() => {
    const tagSet = new Set()
    ;(data.photos || []).forEach(p => {
      p.tags?.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t))
    })
    return [...tagSet].sort()
  }, [data.photos])

  const handleRenameTag = async (oldTag, newTag) => {
    newTag = newTag.trim()
    if (!newTag || newTag === oldTag) return
    const updates = (data.photos || [])
      .filter(p => p.tags?.split(',').map(t => t.trim()).includes(oldTag))
      .map(p => {
        const tags = p.tags.split(',').map(t => t.trim()).map(t => t === oldTag ? newTag : t).join(', ')
        return db.updatePhoto(p.id, { tags })
      })
    await Promise.all(updates)
    mutate(d => ({
      ...d,
      photos: d.photos.map(p => {
        if (!p.tags?.split(',').map(t => t.trim()).includes(oldTag)) return p
        return { ...p, tags: p.tags.split(',').map(t => t.trim()).map(t => t === oldTag ? newTag : t).join(', ') }
      })
    }))
  }

  const handleDeleteTag = async tag => {
    const updates = (data.photos || [])
      .filter(p => p.tags?.split(',').map(t => t.trim()).includes(tag))
      .map(p => {
        const tags = p.tags.split(',').map(t => t.trim()).filter(t => t !== tag).join(', ')
        return db.updatePhoto(p.id, { tags })
      })
    await Promise.all(updates)
    mutate(d => ({
      ...d,
      photos: d.photos.map(p => ({
        ...p,
        tags: p.tags?.split(',').map(t => t.trim()).filter(t => t !== tag).join(', ')
      }))
    }))
  }

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

        {/* Tags — derived from photos */}
        <TagsSection tags={allTags} onRename={handleRenameTag} onDelete={handleDeleteTag} />
      </div>
    </div>
  )
}
