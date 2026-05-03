import { useState, useRef, useMemo } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { PhotoGrid, Sheet, FormCell, TagInput, ICamera, IPlus, FilterSelect } from '../components/Shared.jsx'
import PhotoTriage from '../components/PhotoTriage.jsx'

export default function AllPhotos() {
  const { navigate, data, mutate } = useCtx()
  const toast = useToast()
  const [uploading, setUploading]       = useState(false)
  const [filter, setFilter]             = useState('all')
  const [sortBy, setSortBy]             = useState('date')
  const [includeComplete, setIncludeComplete] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]           = useState(false)
  const [showTriage, setShowTriage]     = useState(false)
  const fileRef = useRef()
  const quickRef = useRef()

  const unsortedCount = data.photos.filter(p => p.photo_type === 'unsorted').length

  const handleFiles = files => {
    const arr = Array.from(files)
    if (!arr.length) return
    setPendingFiles(arr)
    setShowTag(true)
  }

  // Quick upload — skip tag sheet, upload as 'unsorted'
  const handleQuickUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    let uploaded = 0
    for (const file of files) {
      setUploading(true)
      try {
        const photo = await db.uploadPhoto(null, file, '', 'unsorted', '')
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
        uploaded++
      } catch (err) { toast('Upload failed: ' + err.message, 'error') }
      setUploading(false)
    }
    if (uploaded > 0) toast(`${uploaded} photo${uploaded !== 1 ? 's' : ''} added to Inbox`, 'success')
    e.target.value = ''
  }

  const doUpload = async (caption, tags) => {
    setShowTag(false)
    let uploaded = 0
    for (const file of pendingFiles) {
      setUploading(true)
      try {
        const photo = await db.uploadPhoto(null, file, caption, 'progress', tags)
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
        uploaded++
      } catch (e) { toast('Upload failed: ' + e.message, 'error') }
      setUploading(false)
    }
    setPendingFiles([])
    if (uploaded > 0) toast(`${uploaded} photo${uploaded !== 1 ? 's' : ''} uploaded`, 'success')
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

  // O(1) project lookup — avoids repeated .find() in filters and sort
  const projMap = useMemo(() => {
    const m = {}
    data.projects.forEach(p => { m[p.id] = p })
    return m
  }, [data.projects])

  // Build category list from projects that have photos
  const projectCategories = [...new Set(
    data.photos
      .map(p => projMap[p.project_id]?.category)
      .filter(Boolean)
  )].sort()

  const getFiltered = () => {
    let photos = filter === 'all' ? data.photos.filter(p => p.photo_type !== 'unsorted')
      : filter === 'unsorted' ? data.photos.filter(p => p.photo_type === 'unsorted')
      : filter.startsWith('cat:')
        ? data.photos.filter(p => projMap[p.project_id]?.category === filter.slice(4))
        : data.photos.filter(p => p.tags?.split(',').map(t => t.trim()).includes(filter))

    // Unless includeComplete is on, hide photos from completed projects
    if (!includeComplete && filter !== 'unsorted') {
      photos = photos.filter(p => !p.project_id || projMap[p.project_id]?.status !== 'complete')
    }

    photos = photos.slice().sort((a, b) => {
      if (sortBy === 'date') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      if (sortBy === 'project') {
        const projA = projMap[a.project_id]
        const projB = projMap[b.project_id]
        const catA = projA?.category || 'zzz'
        const catB = projB?.category || 'zzz'
        if (catA !== catB) return catA.localeCompare(catB)
        return (projA?.name || '').localeCompare(projB?.name || '')
      }
      if (sortBy === 'tag') {
        const tagA = (a.tags || '').split(',')[0]?.trim() || 'zzz'
        const tagB = (b.tags || '').split(',')[0]?.trim() || 'zzz'
        return tagA.localeCompare(tagB)
      }
      return 0
    })
    return photos
  }

  const [dragging, setDragging] = useState(false)
  const dragCount = useRef(0)

  const onGridDragEnter = e => { e.preventDefault(); dragCount.current++; setDragging(true) }
  const onGridDragLeave = () => { dragCount.current--; if (dragCount.current <= 0) { setDragging(false); dragCount.current = 0 } }
  const onGridDragOver = e => e.preventDefault()
  const onGridDrop = e => { e.preventDefault(); setDragging(false); dragCount.current = 0; handleFiles(e.dataTransfer.files) }

  if (showTriage) {
    return <PhotoTriage onClose={() => setShowTriage(false)} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        {/* Compact header with inline filters */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h1 className="page-title" style={{ margin: 0 }}>All Photos</h1>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{data.photos.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <FilterSelect
                value={filter.startsWith('cat:') ? 'all' : filter}
                onChange={v => setFilter(v)}
                options={[
                  ...(unsortedCount > 0 ? [{ value: 'unsorted', label: `Inbox (${unsortedCount})` }] : []),
                  { value: 'finished', label: 'Finished' },
                  { value: 'portfolio', label: 'Portfolio' },
                  { value: 'progress', label: 'Progress' },
                  { value: 'inspiration', label: 'Inspiration' },
                  { value: 'before', label: 'Before' },
                  { value: 'after', label: 'After' },
                ]}
                allLabel="All Types"
                label="Filter by type"
              />
              {projectCategories.length > 0 && (
                <FilterSelect
                  value={filter.startsWith('cat:') ? filter.slice(4) : 'all'}
                  onChange={v => setFilter(v === 'all' ? 'all' : 'cat:' + v)}
                  options={projectCategories.map(c => ({ value: c, label: c }))}
                  allLabel="All Categories"
                  label="Filter by category"
                />
              )}
              <div className="filter-select-wrap">
                <select className={`filter-select${sortBy !== 'date' ? ' active' : ''}`}
                  value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="date">Date Added</option>
                  <option value="project">By Project</option>
                  <option value="tag">By Tag</option>
                </select>
                <span className="filter-select-chevron" aria-hidden="true">▾</span>
              </div>
              <button
                onClick={() => setIncludeComplete(v => !v)}
                style={{
                  padding: '5px 10px', fontSize: 12, fontWeight: 600,
                  background: includeComplete ? 'var(--forest-dim)' : 'var(--c-bg-subtle)',
                  color: includeComplete ? 'var(--forest)' : 'var(--c-text-muted)',
                  border: `1.5px solid ${includeComplete ? 'var(--forest)' : 'var(--c-border)'}`,
                  borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
                title="Include photos from completed projects"
              >
                + Complete
              </button>
            </div>
          </div>
        </div>

        {/* Inbox banner */}
        {unsortedCount > 0 && filter !== 'unsorted' && (
          <div
            onClick={() => setFilter('unsorted')}
            style={{
              margin: '0 16px 12px', padding: '10px 14px',
              background: 'var(--orange-dim)', borderRadius: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              cursor: 'pointer', border: '1px solid var(--orange)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)' }}>
              {unsortedCount} unsorted
            </span>
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={e => { e.stopPropagation(); setShowTriage(true) }}>
              Sort →
            </button>
          </div>
        )}

        {/* Photo grid with drag-drop */}
        <div
          onDragEnter={onGridDragEnter}
          onDragLeave={onGridDragLeave}
          onDragOver={onGridDragOver}
          onDrop={onGridDrop}
          style={{
            position: 'relative',
            ...(dragging ? { outline: '3px dashed var(--accent)', outlineOffset: -3, borderRadius: 12, background: 'var(--accent-dim)' } : {}),
            transition: 'background 150ms, outline 150ms',
            minHeight: 200,
          }}
        >
          {dragging && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent)', background: 'var(--c-bg-surface)', padding: '8px 20px', borderRadius: 8, boxShadow: 'var(--shadow-lg)' }}>
                Drop to upload
              </span>
            </div>
          )}
        {(() => {
          const filtered = getFiltered()
          if (filtered.length > 0) {
            return (
              <>
                {filter === 'unsorted' && (
                  <div style={{ padding: '0 16px 12px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 13 }} onClick={() => setShowTriage(true)}>
                      Sort {filtered.length} photo{filtered.length !== 1 ? 's' : ''} →
                    </button>
                  </div>
                )}
                <PhotoGrid photos={filtered} onEdit={edit} showProject projects={data.projects} onNavigateProject={id => navigate('projects', id)} />
              </>
            )
          }
          return (
            <div className="empty" style={{ paddingTop: 60 }}>
              <ICamera size={32} color="var(--c-text-muted)" sw={1.5} />
              <div className="empty-title" style={{ marginTop: 12 }}>{filter === 'unsorted' ? 'Inbox is empty' : filter === 'all' ? 'No photos yet' : 'No photos in this filter'}</div>
              <p className="empty-sub">{filter === 'unsorted' ? 'Use Quick Upload to add photos for sorting later' : filter === 'all' ? 'Drop photos above or tap the camera button' : 'Try a different filter above'}</p>
            </div>
          )
        })()}
        </div>
      </div>

      {/* Quick Upload — hidden input */}
      <input ref={quickRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleQuickUpload} />

      {/* Tag Upload — hidden input */}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

      {/* Two FABs — Quick Upload (secondary, above) + Tag Upload (primary) */}
      <button
        className="fab fab-secondary"
        onClick={() => quickRef.current?.click()}
        disabled={uploading}
        aria-label="Quick upload to inbox"
        title="Quick upload — no tagging, sort later"
        style={{ background: 'var(--orange)', boxShadow: '0 4px 12px rgba(245,158,11,.3)' }}
      >
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      <button className="fab" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload photos with tags">
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
      <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 8 }}>Tags</p>
      <TagInput tags={tags} onChange={setTags} />
    </Sheet>
  )
}
