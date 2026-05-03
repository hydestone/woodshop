import { useState, useEffect, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import { Sheet, FormCell, TagInput, ConfirmSheet, PhotoGrid, IPlus, ITrash, IBulb, ICamera } from '../components/Shared.jsx'
import * as db from '../db.js'
import { supabase, getCurrentUserId } from '../supabase.js'

const ideaPhotoTag = id => `idea:${id}`

export default function ProjectIdeas() {
  const { data, mutate, navigate } = useCtx()
  const toast = useToast()
  const [ideas, setIdeas]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [showAdd, setShowAdd]       = useState(false)
  const [editing, setEditing]       = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [converting, setConverting] = useState(false)
  const [showConvertPlanning, setShowConvertPlanning] = useState(false)

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

  const convertPlanningToIdeas = async () => {
    const planning = (data.projects || []).filter(p => p.status === 'planning')
    if (!planning.length) { toast('No planning projects found', 'info'); return }
    setConverting(true)
    try {
      const user_id = await getCurrentUserId()
      const newIdeas = []
      for (const p of planning) {
        const noteParts = [p.description || p.notes]
        if (p.wood_type) noteParts.push(`Wood: ${p.wood_type}`)
        if (p.category)  noteParts.push(`Category: ${p.category}`)
        const fields = {
          title: p.name,
          notes: noteParts.filter(Boolean).join('\n'),
          tags: p.tags || '',
          status: 'idea',
          user_id,
        }
        const { data: row, error } = await supabase.from('project_ideas').insert(fields).select().single()
        if (error) throw new Error(error.message)
        newIdeas.push(row)
        await db.deleteProject(p.id)
      }
      mutate(d => ({ ...d, projects: d.projects.filter(p => p.status !== 'planning') }))
      setIdeas(prev => [...newIdeas, ...prev])
      toast(`${planning.length} project${planning.length !== 1 ? 's' : ''} moved to ideas`, 'success')
      setShowConvertPlanning(false)
    } catch (e) {
      toast(e.message, 'error')
    }
    setConverting(false)
  }

  const handleEditPhoto = async (photoId, fields) => {
    if (fields._delete) {
      const photo = data.photos.find(p => p.id === photoId)
      if (photo) {
        await db.deletePhoto(photo)
        mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== photoId) }))
      }
    } else {
      await db.updatePhoto(photoId, fields)
      mutate(d => ({ ...d, photos: d.photos.map(p => p.id === photoId ? { ...p, ...fields } : p) }))
    }
  }

  const planningProjects = (data.projects || []).filter(p => p.status === 'planning')
  const active = ideas.filter(i => i.status !== 'converted')

  const photosByIdea = {}
  ;(data.photos || []).forEach(p => {
    const match = p.tags?.split(',').map(t => t.trim()).find(t => t.startsWith('idea:'))
    if (match) {
      const id = match.slice(5)
      if (!photosByIdea[id]) photosByIdea[id] = []
      photosByIdea[id].push(p)
    }
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <div className="page-header-row">
          <h1 className="page-title">Project Ideas</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {planningProjects.length > 0 && (
              <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}
                onClick={() => setShowConvertPlanning(true)}>
                ↓ {planningProjects.length} Planning
              </button>
            )}
            <button className="icon-btn" onClick={() => { setEditing(null); setShowAdd(true) }} aria-label="Add idea">
              <IPlus size={20} color="var(--accent)" />
            </button>
          </div>
        </div>
        <p className="page-subtitle">{active.length} idea{active.length !== 1 ? 's' : ''} · tap to develop, convert to start building</p>
      </div>

      <div className="scroll-page" style={{ paddingBottom: 40 }}>
        {loading ? (
          <div className="empty"><div className="spinner" /></div>
        ) : active.length === 0 ? (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon"><IBulb size={32} color="var(--c-text-muted)" sw={1.5} /></div>
            <div className="empty-title">No ideas yet</div>
            <p className="empty-sub">Capture something you want to build someday</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setShowAdd(true)}>Add First Idea</button>
          </div>
        ) : (
          <div className="group" style={{ marginTop: 8 }}>
            {active.map((idea, i) => {
              const ideaPhotos = photosByIdea[idea.id] || []
              return (
                <div key={idea.id} style={{ borderBottom: i < active.length - 1 ? '1px solid var(--c-border-light)' : 'none' }}>
                  <div style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}
                    onClick={() => { setEditing(idea); setShowAdd(true) }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{idea.title}</div>
                      {idea.notes && (
                        <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineClamp: 2 }}>
                          {idea.notes}
                        </div>
                      )}
                      {idea.tags && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {idea.tags.split(',').map(t => t.trim()).filter(t => t && !t.startsWith('idea:')).map(t => (
                            <span key={t} style={{ fontSize: 11, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 99, padding: '1px 8px', fontWeight: 500 }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <IdeaPhotoUpload ideaId={idea.id} onUploaded={photo => mutate(d => ({ ...d, photos: [photo, ...d.photos] }))} />
                      <button className="btn-primary" style={{ fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}
                        onClick={e => { e.stopPropagation(); convertToProject(idea) }}>
                        → Project
                      </button>
                      <button className="icon-btn" style={{ color: 'var(--red)' }}
                        onClick={e => { e.stopPropagation(); setConfirming(idea) }}
                        aria-label="Delete idea">
                        <ITrash size={16} />
                      </button>
                    </div>
                  </div>
                  {ideaPhotos.length > 0 && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <PhotoGrid photos={ideaPhotos} onEdit={handleEditPhoto} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAdd && (
        <IdeaSheet idea={editing} onSave={save} onClose={() => { setShowAdd(false); setEditing(null) }} />
      )}
      {confirming && (
        <ConfirmSheet message={`Delete "${confirming.title}"?`} confirmLabel="Delete"
          onConfirm={() => remove(confirming.id)} onClose={() => setConfirming(null)} />
      )}
      {showConvertPlanning && (
        <ConfirmSheet
          message={`Move ${planningProjects.length} planning project${planningProjects.length !== 1 ? 's' : ''} to Project Ideas and delete the originals? Name, notes, wood type, and category will carry over.`}
          confirmLabel={converting ? 'Converting…' : 'Convert All'}
          onConfirm={convertPlanningToIdeas}
          onClose={() => setShowConvertPlanning(false)}
        />
      )}
    </div>
  )
}

function IdeaPhotoUpload({ ideaId, onUploaded }) {
  const toast = useToast()
  const inputRef = useRef()
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (e) => {
    const files = [...e.target.files]
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const photo = await db.uploadPhoto(null, file, '', 'idea', ideaPhotoTag(ideaId))
        onUploaded(photo)
      }
      toast(`Photo${files.length > 1 ? 's' : ''} added`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
    setUploading(false)
    e.target.value = ''
  }

  return (
    <>
      <button className="icon-btn" aria-label="Add photo to idea" disabled={uploading} title="Add photo"
        onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>
        <ICamera size={16} color="var(--accent)" sw={1.8} />
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFiles} />
    </>
  )
}

function IdeaSheet({ idea, onSave, onClose }) {
  const [title, setTitle] = useState(idea?.title || '')
  const [notes, setNotes] = useState(idea?.notes || '')
  const [tags, setTags]   = useState(
    idea?.tags ? idea.tags.split(',').map(t => t.trim()).filter(t => t && !t.startsWith('idea:')) : []
  )

  const handleSave = async () => {
    if (!title.trim()) return
    await onSave({ title: title.trim(), notes: notes.trim(), tags: tags.join(', ') })
  }

  return (
    <Sheet title={idea ? 'Edit Idea' : 'New Idea'} onClose={onClose} onSave={handleSave} saveLabel={idea ? 'Update' : 'Save'}>
      <div className="form-group">
        <FormCell label="Title">
          <input className="form-input" placeholder="What do you want to build?" value={title}
            onChange={e => setTitle(e.target.value)} autoFocus />
        </FormCell>
        <FormCell label="Notes">
          <textarea className="form-input" placeholder="Inspiration, dimensions, materials, techniques..."
            value={notes} onChange={e => setNotes(e.target.value)}
            rows={4} style={{ resize: 'vertical', minHeight: 80 }} />
        </FormCell>
        <FormCell label="Tags" last>
          <TagInput tags={tags} onChange={setTags} />
        </FormCell>
      </div>
    </Sheet>
  )
}
