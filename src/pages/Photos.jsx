import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { DropZone, PhotoGrid, Sheet, FormCell, TagInput, ICamera } from '../components/Shared.jsx'

export default function AllPhotos() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [uploading, setUploading]       = useState(false)
  const [filter, setFilter]             = useState('all')
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]           = useState(false)
  const fileRef = useRef()

  const handleFiles = files => {
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
      } catch (e) { toast('Upload failed: ' + e.message, 'error') }
      setUploading(false)
    }
    setPendingFiles([])
    toast('Photo uploaded', 'success')
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

  // Build category list from projects that have photos
  const projectCategories = [...new Set(
    data.photos
      .map(p => data.projects.find(proj => proj.id === p.project_id)?.category)
      .filter(Boolean)
  )].sort()

  const getFiltered = () => {
    let photos = filter === 'all' ? data.photos
      : filter.startsWith('cat:')
        ? data.photos.filter(p => data.projects.find(proj => proj.id === p.project_id)?.category === filter.slice(4))
        : data.photos.filter(p => p.tags?.split(',').map(t => t.trim()).includes(filter))

    if (filter.startsWith('cat:')) {
      photos = photos.slice().sort((a, b) => {
        const ca = data.projects.find(p => p.id === a.project_id)?.name || ''
        const cb = data.projects.find(p => p.id === b.project_id)?.name || ''
        return ca.localeCompare(cb)
      })
    }
    return photos
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">All Photos</h1>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{data.photos.length} photo{data.photos.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        {/* Tag filter tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '0 20px 8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {['all','finished','portfolio','progress','inspiration','before','after'].map(tag => {
            const count = tag === 'all' ? data.photos.length : data.photos.filter(p => p.tags?.split(',').map(t=>t.trim()).includes(tag)).length
            return (
              <button key={tag} onClick={() => setFilter(tag)} className={`pill-tab${filter === tag ? ' active' : ''}`} style={{ flexShrink: 0 }}>
                {tag === 'all' ? 'All' : tag.charAt(0).toUpperCase() + tag.slice(1)}{count > 0 && tag !== 'all' ? ` (${count})` : ''}
              </button>
            )
          })}
        </div>
        {/* Category filter tabs */}
        {projectCategories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--border-2)', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', alignSelf: 'center', flexShrink: 0, paddingRight: 2 }}>Category:</span>
            {projectCategories.map(cat => (
              <button key={cat} onClick={() => setFilter(filter === 'cat:' + cat ? 'all' : 'cat:' + cat)} className={`pill-tab${filter === 'cat:' + cat ? ' active' : ''}`} style={{ flexShrink: 0 }}>
                {cat}
              </button>
            ))}
          </div>
        )}
        <DropZone onFiles={handleFiles} uploading={uploading} />
        {(() => {
          const filtered = getFiltered()
          return filtered.length > 0
            ? <PhotoGrid photos={filtered} onEdit={edit} showProject projects={data.projects} />
            : <div className="empty" style={{ paddingTop: 60 }}>
                <div className="empty-icon">📷</div>
                <div className="empty-title">{filter === 'all' ? 'No photos yet' : 'No photos in this filter'}</div>
                <p className="empty-sub">{filter === 'all' ? 'Drop photos above or tap the camera button' : 'Try a different filter above'}</p>
              </div>
        })()}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <button className="fab" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload photos">
        {uploading
          ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff' }} />
          : <ICamera size={22} color="#fff" sw={2} />}
      </button>
      {showTag && (
        <PhotoTagSheet
          count={pendingFiles.length}
          onSave={doUpload}
          onClose={() => { setShowTag(false); setPendingFiles([]) }}
        />
      )}
    </div>
  )
}

function PhotoTagSheet({ count, onSave, onClose }) {
  const [caption, setCaption] = useState('')
  const [tags, setTags]       = useState([])
  return (
    <Sheet
      title={count > 1 ? `${count} Photos` : 'Add Photo'}
      onClose={onClose}
      onSave={() => onSave(caption, tags.join(','))}
    >
      <div className="form-group">
        <FormCell label="Caption" last>
          <input
            className="form-input"
            placeholder="Optional"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            autoFocus
          />
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Tags</p>
      <TagInput tags={tags} onChange={setTags} />
    </Sheet>
  )
}
