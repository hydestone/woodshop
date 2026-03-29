import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { ITrash, IEdit } from '../components/Shared.jsx'

export default function Brainstorm() {
  const { data, mutate } = useCtx()
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState('')
  const [composing, setComposing] = useState('')

  const notes = data.brainstorming

  const saveNew = async () => {
    const content = composing.trim()
    if (!content) return
    try {
      const note = await db.addBrainstorm(content)
      mutate(d => ({ ...d, brainstorming: [note, ...d.brainstorming] }))
      setComposing('')
    } catch (e) { alert('Error: ' + e.message) }
  }

  const del = async (id) => {
    mutate(d => ({ ...d, brainstorming: d.brainstorming.filter(n => n.id !== id) }))
    await db.deleteBrainstorm(id).catch(e => alert('Error: ' + e.message))
  }

  const saveEdit = async (id) => {
    const content = editVal.trim()
    if (!content) return
    mutate(d => ({ ...d, brainstorming: d.brainstorming.map(n => n.id === id ? { ...n, content } : n) }))
    await db.updateBrainstorm(id, content).catch(e => alert('Error: ' + e.message))
    setEditId(null)
  }

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="navbar"><h1>Brainstorm</h1></div>
      <div className="scroll-page" style={{ paddingBottom: 24 }}>

        {/* Compose area */}
        <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '.5px solid var(--sep2)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            className="bulk-textarea"
            style={{ minHeight: 80, flex: 1 }}
            placeholder="Type an idea…"
            value={composing}
            onChange={e => setComposing(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNew() }}
          />
          <button
            className="btn-primary"
            style={{ padding: '8px 14px', borderRadius: 9, alignSelf: 'flex-end' }}
            onClick={saveNew}
            disabled={!composing.trim()}
          >Save</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text4)', padding: '6px 20px', marginBottom: 4 }}>Cmd+Enter to save quickly.</p>

        {/* Notes list */}
        <div style={{ padding: '8px 0 24px' }}>
          {notes.map(note => (
            <div key={note.id} style={{ background: 'var(--surface)', borderBottom: '.5px solid var(--sep2)', padding: '14px 20px' }}>
              {editId === note.id ? (
                <div>
                  <textarea
                    className="bulk-textarea"
                    style={{ minHeight: 80 }}
                    value={editVal}
                    onChange={e => setEditVal(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button className="btn-primary" style={{ padding: '7px 16px' }} onClick={() => saveEdit(note.id)}>Save</button>
                    <button className="btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{note.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text4)' }}>{fmtDate(note.created_at)}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="icon-btn" onClick={() => { setEditId(note.id); setEditVal(note.content) }}><IEdit size={15} /></button>
                      <button className="icon-btn" onClick={() => del(note.id)}><ITrash size={15} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!notes.length && (
            <div className="empty">
              <div className="empty-icon">💡</div>
              <div className="empty-title">Nothing yet</div>
              <div className="empty-sub">Type an idea above and click Save</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
