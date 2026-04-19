import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { PhotoGrid, DropZone } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, TagInput } from '../components/Shared.jsx'
import { ICamera } from '../components/Shared.jsx'
import { supabase, getCurrentUserId } from '../supabase.js'

export default function Inspiration() {
  const { data, mutate, navigate } = useCtx()
  const toast = useToast()
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag] = useState(false)
  const [ideaPhoto, setIdeaPhoto] = useState(null)

  const photos = data.photos.filter(p => {
    const tags = p.tags ? p.tags.split(',').map(t => t.trim().toLowerCase()) : []
    return tags.includes('inspiration') || p.photo_type === 'inspiration'
  })

  const handleFiles = files => {
    const arr = Array.from(files)
    if (!arr.length) return
    setPendingFiles(arr)
    setShowTag(true)
  }

  const doUpload = async (caption, tags) => {
    setShowTag(false)
    setUploading(true)
    for (const file of pendingFiles) {
      try {
        const allTags = [...new Set([...(tags || []), 'inspiration'])].join(',')
        const photo = await db.uploadPhoto(null, file, caption, 'inspiration', allTags)
        mutate(d => ({ ...d, photos: [{ ...photo }, ...d.photos] }))
      } catch (e) { toast('Upload failed: ' + e.message, 'error') }
    }
    setPendingFiles([])
    setUploading(false)
    toast('Photo added to Inspiration', 'success')
  }

  const edit = async (id, fields) => {
    if (fields._delete) {
      const photo = data.photos.find(p => p.id === id)
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      if (photo) await db.deletePhoto(photo).catch(e => toast(e.message, 'error'))
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
  }

  // F1: Create project idea from inspiration photo
  const saveIdea = async (fields) => {
    try {
      const user_id = await getCurrentUserId()
      const { error } = await supabase.from('project_ideas').insert({ ...fields, status: 'idea', user_id })
      if (error) throw new Error(error.message)
      setIdeaPhoto(null)
      toast('Idea saved! View in Project Ideas.', 'success')
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page">
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Inspiration</h1>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <DropZone onFiles={handleFiles} uploading={uploading} />

        {photos.length > 0 ? (
          <PhotoGrid
            photos={photos}
            onEdit={edit}
            showProject
            projects={data.projects}
            onNavigateProject={id => navigate('projects', id)}
            onCreateIdea={photo => setIdeaPhoto(photo)}
          />
        ) : (
          <div className="empty" style={{ paddingTop: 60 }}>
            <div className="empty-icon">✨</div>
            <div className="empty-title">No inspiration photos yet</div>
            <p className="empty-sub">Drag photos here or tap + to add</p>
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

      <button className="fab" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Add inspiration photo">
        {uploading
          ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff' }} />
          : <ICamera size={22} color="#fff" sw={2} />}
      </button>

      {showTag && (
        <Sheet title="Add to Inspiration" onClose={() => { setShowTag(false); setPendingFiles([]) }} onSave={async () => {}}>
          <InspirationTagBody count={pendingFiles.length} onSave={doUpload} />
        </Sheet>
      )}

      {ideaPhoto && (
        <Sheet title="Create Project Idea" onClose={() => setIdeaPhoto(null)} onSave={async () => {}}>
          <IdeaFromPhotoBody photo={ideaPhoto} onSave={saveIdea} />
        </Sheet>
      )}
    </div>
  )
}

function InspirationTagBody({ count, onSave }) {
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState([])
  return (
    <div>
      <div className="form-group">
        <FormCell label="Caption">
          <input className="form-input" placeholder="Optional" value={caption} onChange={e => setCaption(e.target.value)} autoFocus />
        </FormCell>
        <FormCell label="Tags" last>
          <TagInput tags={tags} onChange={setTags} />
        </FormCell>
      </div>
      <p className="form-hint">{count} photo{count !== 1 ? 's' : ''} · will be tagged as inspiration automatically</p>
      <button className="btn-primary" style={{ width: '100%', marginTop: 12, justifyContent: 'center' }} onClick={() => onSave(caption, tags)}>
        Upload {count > 1 ? `${count} Photos` : 'Photo'}
      </button>
    </div>
  )
}

function IdeaFromPhotoBody({ photo, onSave }) {
  const [title, setTitle] = useState(photo.caption || '')
  const [notes, setNotes] = useState('')
  const [tags, setTags]   = useState([])

  return (
    <div>
      {/* Photo thumbnail */}
      <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', maxHeight: 160 }}>
        <img src={photo.url} alt="" style={{ width: '100%', objectFit: 'cover', maxHeight: 160, display: 'block' }} />
      </div>

      <div className="form-group">
        <FormCell label="What do you want to build?">
          <input
            className="form-input"
            placeholder="e.g., Walnut serving board like this"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </FormCell>
        <FormCell label="Notes">
          <textarea
            className="form-input"
            placeholder="Dimensions, materials, techniques..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            style={{ resize: 'vertical', minHeight: 60 }}
          />
        </FormCell>
        <FormCell label="Tags" last>
          <TagInput tags={tags} onChange={setTags} />
        </FormCell>
      </div>

      <button
        className="btn-primary"
        style={{ width: '100%', marginTop: 12, justifyContent: 'center' }}
        onClick={() => { if (title.trim()) onSave({ title: title.trim(), notes: notes.trim(), tags: tags.join(', ') }) }}
        disabled={!title.trim()}
      >
        Save Idea
      </button>
    </div>
  )
}
