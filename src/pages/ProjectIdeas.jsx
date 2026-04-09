import { useState, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import { Sheet, FormCell, TagInput, ConfirmSheet, IPlus, ITrash } from '../components/Shared.jsx'
import * as db from '../db.js'
import { supabase, getCurrentUserId } from '../supabase.js'

export default function ProjectIdeas() {
  const { data, mutate, navigate } = useCtx()
  const toast = useToast()
  const [ideas, setIdeas]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState(null)
  const [confirming, setConfirming] = useState(null)

  // Load ideas from Supabase
  const load = async () => {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('project_ideas')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setIdeas(rows || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const save = async (fields) => {
    try {
      const user_id = await getCurrentUserId()
      if (editing) {
        const { data: row, error } = await supabase.from('project_ideas').update(fields).eq('id', editing.id).select().single()
        if (error) throw new Error(error.message)
        if (row) setIdeas(prev => prev.map(i => i.id === editing.id ? row : i))
        toast('Idea updated', 'success')
      } else {
        const { data: row, error } = await supabase.from('project_ideas').insert({ ...fields, status: 'idea', user_id }).select().single()
        if (error) throw new Error(error.message)
        if (row) setIdeas(prev => [row, ...prev])
        toast('Idea saved', 'success')
      }
      setShowAdd(false)
      setEditing(null)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const remove = async (id) => {
    const { error } = await supabase.from('project_ideas').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    setIdeas(prev => prev.filter(i => i.id !== id))
    setConfirming(null)
    toast('Idea removed', 'success')
  }

  // Convert idea → full project
  const convertToProject = async (idea) => {
    try {
      const proj = await db.addProject({ name: idea.title, description: idea.notes || '', status: 'planning' })
      mutate(d => ({ ...d, projects: [proj, ...d.projects] }))
      await supabase.from('project_ideas').update({ status: 'converted' }).eq('id', idea.id)
      setIdeas(prev => prev.filter(i => i.id !== idea.id))
      navigate('projects', proj.id)
      toast(`"${idea.title}" converted to project`, 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  const active  = ideas.filter(i => i.status !== 'converted')
  const tags    = [...new Set(ideas.flatMap(i => i.tags?.split(',').map(t=>t.trim()).filter(Boolean) || []))]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Project Ideas</h1>
          <button className="icon-btn" onClick={() => { setEditing(null); setShowAdd(true) }} aria-label="Add idea">
            <IPlus size={20} color="var(--accent)" />
          </button>
        </div>
        <p className="page-subtitle">{active.length} idea{active.length !== 1 ? 's' : ''} · tap to develop, convert to start building</p>
      </div>

      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : active.length === 0 ? (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon">💡</div>
            <div className="empty-title">No ideas yet</div>
            <p className="empty-sub">Capture something you want to build someday</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>Add First Idea</button>
          </div>
        ) : (
          <div className="group" style={{ marginTop: 8 }}>
            {active.map((idea, i) => (
              <div key={idea.id} style={{
                padding: '14px 16px',
                borderBottom: i < active.length - 1 ? '1px solid var(--border-2)' : 'none',
                cursor: 'pointer',
              }}
                onClick={() => { setEditing(idea); setShowAdd(true) }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{idea.title}</div>
                    {idea.notes && (
                      <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineClamp: 2 }}>
                        {idea.notes}
                      </div>
                    )}
                    {idea.tags && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {idea.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                          <span key={t} style={{ fontSize: 11, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 99, padding: '1px 8px', fontWeight: 500 }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}
                      onClick={e => { e.stopPropagation(); convertToProject(idea) }}
                      title="Convert to project"
                    >
                      → Project
                    </button>
                    <button
                      className="icon-btn"
                      onClick={e => { e.stopPropagation(); setConfirming(idea) }}
                      aria-label="Delete idea"
                      style={{ color: 'var(--red)' }}
                    >
                      <ITrash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <IdeaSheet
          idea={editing}
          onSave={save}
          onClose={() => { setShowAdd(false); setEditing(null) }}
        />
      )}
      {confirming && (
        <ConfirmSheet
          message={`Delete "${confirming.title}"?`}
          confirmLabel="Delete"
          onConfirm={() => remove(confirming.id)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

function IdeaSheet({ idea, onSave, onClose }) {
  const [title, setTitle]   = useState(idea?.title || '')
  const [notes, setNotes]   = useState(idea?.notes || '')
  const [tags, setTags]     = useState(idea?.tags ? idea.tags.split(',').map(t=>t.trim()).filter(Boolean) : [])

  const handleSave = async () => {
    if (!title.trim()) return
    await onSave({ title: title.trim(), notes: notes.trim(), tags: tags.join(', ') })
  }

  return (
    <Sheet title={idea ? 'Edit Idea' : 'New Idea'} onClose={onClose} onSave={handleSave} saveLabel={idea ? 'Update' : 'Save'}>
      <div className="form-group">
        <FormCell label="Title">
          <input
            className="form-input"
            placeholder="What do you want to build?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </FormCell>
        <FormCell label="Notes">
          <textarea
            className="form-input"
            placeholder="Inspiration, dimensions, materials, techniques..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
        </FormCell>
        <FormCell label="Tags" last>
          <TagInput tags={tags} onChange={setTags} />
        </FormCell>
      </div>
    </Sheet>
  )
}
