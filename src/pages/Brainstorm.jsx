import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { ConfirmSheet, ITrash, IEdit } from '../components/Shared.jsx'

const fmtDate = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

const autoExpand = e => {
  e.target.style.height = 'auto'
  e.target.style.height = e.target.scrollHeight + 'px'
}

export default function Brainstorm() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [composing, setComposing]     = useState('')
  const [editId, setEditId]           = useState(null)
  const [editVal, setEditVal]         = useState('')
  const [deleteNote, setDeleteNote]   = useState(null)
  const composingRef = useRef()

  const saveNew = async () => {
    const content = composing.trim()
    if (!content) return
    setComposing('')
    if (composingRef.current) { composingRef.current.style.height = 'auto' }
    const tempId = 'temp_' + Date.now()
    const optimistic = { id: tempId, content, created_at: new Date().toISOString() }
    mutate(d => ({ ...d, brainstorming: [optimistic, ...d.brainstorming] }))
    try {
      const note = await db.addBrainstorm(content)
      mutate(d => ({ ...d, brainstorming: d.brainstorming.map(n => n.id === tempId ? note : n) }))
    } catch (e) {
      mutate(d => ({ ...d, brainstorming: d.brainstorming.filter(n => n.id !== tempId) }))
      toast(e.message, 'error')
    }
  }

  const del = async id => {
    const item = data.brainstorming.find(n => n.id === id)
    const prev = data.brainstorming
    mutate(d => ({ ...d, brainstorming: d.brainstorming.filter(n => n.id !== id) }))
    try {
      const trashed = await db.deleteBrainstorm(id)
      if (trashed) {
        mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
        toast('Note deleted', 'success', 4000, {
          label: 'Undo',
          onClick: async () => {
            try {
              await db.restoreFromTrash(trashed.id, trashed)
              mutate(d => ({ ...d, brainstorming: [item, ...d.brainstorming], trash: d.trash.filter(t => t.id !== trashed.id) }))
            } catch(e) { toast(e.message, 'error') }
          }
        })
      }
    } catch(e) { mutate(d => ({ ...d, brainstorming: prev })); toast(e.message, 'error') }
    setDeleteNote(null)
  }

  const saveEdit = async id => {
    const content = editVal.trim()
    if (!content) { setEditId(null); return }
    mutate(d => ({ ...d, brainstorming: d.brainstorming.map(n => n.id === id ? { ...n, content } : n) }))
    await db.updateBrainstorm(id, content).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
    setEditId(null)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header"><h1 className="page-title">Brainstorm</h1></div>

      <div className="scroll-page" style={{ paddingBottom: 24 }}>
        {/* Compose area */}
        <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <textarea
            ref={composingRef}
            className="form-textarea"
            style={{ flex: 1, minHeight: 76 }}
            placeholder="Type an idea…"
            value={composing}
            onChange={e => { setComposing(e.target.value); autoExpand(e) }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNew() }}
          />
          <button
            className="btn-primary"
            onClick={saveNew}
            disabled={!composing.trim()}
            style={{ alignSelf: 'flex-end', flexShrink: 0 }}
          >
            Save
          </button>
        </div>
        <p className="form-hint" style={{ padding: '6px 20px', marginBottom: 4 }}>⌘+Enter to save quickly.</p>

        {/* Notes list */}
        <div style={{ paddingBottom: 24 }}>
          {data.brainstorming.map(note => (
            <div key={note.id} style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-2)', padding: '14px 20px' }}>
              {editId === note.id ? (
                <div>
                  <textarea
                    className="form-textarea"
                    style={{ width: '100%', minHeight: 80 }}
                    value={editVal}
                    onChange={e => { setEditVal(e.target.value); autoExpand(e) }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button className="btn-primary" style={{ padding: '7px 16px' }} onClick={() => saveEdit(note.id)}>Save</button>
                    <button className="btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{note.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{fmtDate(note.created_at)}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="icon-btn" onClick={() => { setEditId(note.id); setEditVal(note.content) }} aria-label="Edit note"><IEdit size={15} /></button>
                      <button className="icon-btn" onClick={() => setDeleteNote(note)} aria-label="Delete note"><ITrash size={15} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!data.brainstorming.length && (
            <div className="empty">
              <div className="empty-icon">💡</div>
              <div className="empty-title">Nothing yet</div>
              <p className="empty-sub">Type an idea above and click Save</p>
            </div>
          )}
        </div>
      </div>
      {deleteNote && <ConfirmSheet message="Delete this note?" onConfirm={() => del(deleteNote.id)} onClose={() => setDeleteNote(null)} />}
    </div>
  )
}
