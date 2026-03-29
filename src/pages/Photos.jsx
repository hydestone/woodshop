import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { DropZone, PhotoGrid, TagInput, Sheet, FormCell, IUpload } from '../components/Shared.jsx'

export default function AllPhotos() {
  const { data, mutate } = useCtx()
  const [filter, setFilter]         = useState('all')
  const [uploading, setUploading]   = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]       = useState(false)
  const fileRef = useRef()

  const photos = filter === 'all'
    ? data.photos
    : data.photos.filter(p => p.photo_type === filter)

  const handleFiles = (files) => {
    const arr = Array.from(files)
    if (!arr.length) return
    setPendingFiles(arr)
    setShowTag(true)
  }

  const doUpload = async (caption, tags) => {
    setShowTag(false)
    for (const file of pendingFiles) {
      setUploading(true)
      try {
        const photo = await db.uploadPhoto(null, file, caption, 'progress', tags)
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
      } catch (e) { alert('Upload failed: ' + e.message) }
      setUploading(false)
    }
    setPendingFiles([])
  }

  const del = async (photo) => {
    mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== photo.id) }))
    await db.deletePhoto(photo).catch(e => alert('Error: ' + e.message))
  }

  const edit = async (id, fields) => {
    if (fields._delete) {
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      const photo = data.photos.find(p => p.id === id)
      if (photo) await db.deletePhoto(photo).catch(e => alert('Error: ' + e.message))
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => alert('Error: ' + e.message))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar">
          <h1>Photos</h1>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {[['all','All'],['progress','Progress'],['inspiration','Inspiration']].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--fb)',
                background: filter === val ? 'var(--blue)' : 'var(--fill)',
                color: filter === val ? '#fff' : 'var(--text3)'
              }}>{label} {val === 'all' ? `(${data.photos.length})` : `(${data.photos.filter(p => p.photo_type === val).length})`}</button>
            ))}
          </div>
        </div>
        <DropZone onFiles={handleFiles} uploading={uploading} />
        {photos.length > 0
          ? <PhotoGrid photos={photos} onDelete={del} onEdit={edit} showProject projects={data.projects} />
          : <div className="empty"><div className="empty-icon">📷</div><div className="empty-title">No photos</div><div className="empty-sub">Drop photos above or tap the upload button</div></div>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <button className="fab" onClick={() => fileRef.current.click()} disabled={uploading}>
        {uploading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : <IUpload size={22} c="#fff" sw={2} />}
      </button>
      {showTag && <PhotoTagSheet onSave={doUpload} onClose={() => { setShowTag(false); setPendingFiles([]) }} count={pendingFiles.length} />}
    </div>
  )
}

function PhotoTagSheet({ onSave, onClose, count }) {
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState([])
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose}>Cancel</button>
          <span className="sheet-title">{count > 1 ? `${count} Photos` : 'Upload Photo'}</span>
          <button className="sheet-save" onClick={() => onSave(caption, tags.join(','))}>Upload</button>
        </div>
        <div className="sheet-body" style={{ paddingBottom: 20 }}>
          <div className="form-group">
            <FormCell label="Caption" last>
              <input className="form-input" placeholder="Optional" value={caption} onChange={e => setCaption(e.target.value)} autoFocus />
            </FormCell>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 4px 8px' }}>Tags</p>
          <TagInput tags={tags} onChange={setTags} />
          <p style={{ fontSize: 12, color: 'var(--text4)', marginTop: 6, padding: '0 4px' }}>Use "finished" to include in the Finished Products gallery.</p>
        </div>
      </div>
    </div>
  )
}
