import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { PhotoGrid, DropZone } from '../components/Shared.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, TagInput } from '../components/Shared.jsx'
import { ICamera } from '../components/Shared.jsx'

export default function Inspiration() {
  const { data, mutate, navigate } = useCtx()
  const toast = useToast()
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag] = useState(false)

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
      const prev = data.photos
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      if (photo) {
        try {
          const trashed = await db.deletePhoto(photo)
          if (trashed) {
            mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
            toast('Photo deleted', 'success', 4000, {
              label: 'Undo',
              onClick: async () => {
                try {
                  await db.restoreFromTrash(trashed.id, trashed)
                  mutate(d => ({ ...d, photos: [photo, ...d.photos], trash: d.trash.filter(t => t.id !== trashed.id) }))
                } catch(e) { toast(e.message, 'error') }
              }
            })
          }
        } catch(e) { mutate(d => ({ ...d, photos: prev })); toast(e.message, 'error') }
      }
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
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
        <Sheet title="Add to Inspiration" onClose={() => { setShowTag(false); setPendingFiles([]) }}>
          <InspirationTagBody count={pendingFiles.length} onSave={doUpload} />
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
