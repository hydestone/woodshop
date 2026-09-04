import { useState, useRef, useMemo, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { PhotoGrid, PhotoImg, Sheet, FormCell, TagInput, ICamera, IPlus, IClose, IDuplicates, ISearch, IGrid, FilterSelect } from '../components/Shared.jsx'
import PhotoTriage from '../components/PhotoTriage.jsx'

export default function AllPhotos() {
  const { navigate, data, mutate, isOwner } = useCtx()
  const toast = useToast()
  const [uploading, setUploading]       = useState(false)
  const [showLimit, setShowLimit]       = useState(false)
  const [filter, setFilter]             = useState('all')
  const [sortBy, setSortBy]             = useState('date')
  const [includeComplete, setIncludeComplete] = useState(false)
  const [unsortedStatus, setUnsortedStatus]   = useState('all') // 'all'|'active'|'planning'|'paused'
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]           = useState(false)
  const [showTriage, setShowTriage]     = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [scanning, setScanning]             = useState(false)
  const [scanProgress, setScanProgress]     = useState({ done: 0, total: 0 })
  const [scanKind, setScanKind]             = useState('duplicates') // 'duplicates' | 'optimize'
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState([])
  const [selectMode, setSelectMode]     = useState(false)
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [showFabMenu, setShowFabMenu]   = useState(false)
  const [search, setSearch]             = useState('')
  const [gridCols, setGridCols]         = useState(0) // 0 = auto (CSS default)
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
      } catch (err) {
        if (err.message?.startsWith('PHOTO_LIMIT_REACHED')) {
          setShowLimit(true); setUploading(false); break
        }
        toast('Upload failed: ' + err.message, 'error')
      }
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
      } catch (e) {
        if (e.message?.startsWith('PHOTO_LIMIT_REACHED')) {
          setShowLimit(true); setUploading(false); break
        }
        toast('Upload failed: ' + e.message, 'error')
      }
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

  const handleScanDuplicates = useCallback(async () => {
    setScanning(true)
    setScanProgress({ done: 0, total: 0 })
    try {
      // Backfill phashes for any photos missing one
      const needsHash = data.photos.filter(p => !p.phash).length
      if (needsHash > 0) {
        setScanProgress({ done: 0, total: needsHash })
        await db.backfillPhashes(data.photos, (done, total) => {
          setScanProgress({ done, total })
        })
        // Update local data with the new hashes
        mutate(d => ({ ...d, photos: [...d.photos] }))
      }
      // Find duplicate groups
      const groups = db.findDuplicateGroups(data.photos)
      if (groups.length > 0) {
        setDuplicateGroups(groups)
        setShowDuplicates(true)
      } else {
        toast('No duplicates found', 'success')
      }
    } catch (e) {
      toast('Scan failed: ' + e.message, 'error')
    }
    setScanning(false)
  }, [data.photos, mutate, toast])

  // Owner-only maintenance: generate thumb/medium derivatives for photos uploaded
  // before the derivative pipeline existed. Safe to re-run.
  const handleOptimize = useCallback(async () => {
    setScanKind('optimize')
    setScanning(true)
    setScanProgress({ done: 0, total: data.photos.length })
    try {
      const n = await db.backfillDerivatives(data.photos, (done, total) => setScanProgress({ done, total }))
      toast(`Optimized ${n} photo${n === 1 ? '' : 's'}`, 'success')
    } catch (e) {
      toast('Optimize failed: ' + e.message, 'error')
    }
    setScanning(false)
    setScanKind('duplicates')
  }, [data.photos, toast])

  const handleDeleteDuplicates = useCallback(async (photoIds) => {
    let deleted = 0
    for (const id of photoIds) {
      const photo = data.photos.find(p => p.id === id)
      if (!photo) continue
      try {
        await db.deletePhoto(photo)
        mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
        deleted++
      } catch (e) {
        toast(`Failed to delete photo: ${e.message}`, 'error')
      }
    }
    if (deleted > 0) toast(`${deleted} duplicate${deleted !== 1 ? 's' : ''} removed`, 'success')
    setShowDuplicates(false)
    setDuplicateGroups([])
  }, [data.photos, mutate, toast])

  // ── Selection mode ──────────────────────────────────────────────────────────
  const handleEnterSelectMode = useCallback((photoId) => {
    setSelectMode(true)
    setSelectedIds(new Set([photoId]))
  }, [])

  const handleToggleSelect = useCallback((photoId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(photoId)) next.delete(photoId)
      else next.add(photoId)
      return next
    })
  }, [])

  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleSelectAll = () => {
    const filtered = getFiltered()
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)))
    }
  }

  const handleBatchDelete = useCallback(async () => {
    const count = selectedIds.size
    if (count === 0) return
    let deleted = 0
    for (const id of selectedIds) {
      const photo = data.photos.find(p => p.id === id)
      if (!photo) continue
      try {
        await db.deletePhoto(photo)
        mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
        deleted++
      } catch (e) {
        toast(`Delete failed: ${e.message}`, 'error')
      }
    }
    if (deleted > 0) toast(`${deleted} photo${deleted !== 1 ? 's' : ''} deleted`, 'success')
    handleExitSelectMode()
  }, [selectedIds, data.photos, mutate, toast, handleExitSelectMode])

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

  // Count photos per type/tag for filter labels
  const typeCounts = useMemo(() => {
    const counts = {}
    const types = ['finished', 'portfolio', 'progress', 'inspiration', 'before', 'after']
    types.forEach(t => { counts[t] = 0 })
    data.photos.forEach(p => {
      const tags = (p.tags || '').split(',').map(t => t.trim())
      types.forEach(t => { if (tags.includes(t)) counts[t]++ })
    })
    return counts
  }, [data.photos])

  const getFiltered = () => {
    let photos = filter === 'all'
      ? data.photos.filter(p => p.photo_type !== 'unsorted')  // all types except inbox
      : filter === 'unsorted'
        ? (() => {
            let u = data.photos.filter(p => p.photo_type === 'unsorted')
            if (!includeComplete) u = u.filter(p => !p.project_id || projMap[p.project_id]?.status !== 'complete')
            if (unsortedStatus !== 'all') u = u.filter(p => projMap[p.project_id]?.status === unsortedStatus)
            return u
          })()
        : filter.startsWith('cat:')
          ? data.photos.filter(p => projMap[p.project_id]?.category === filter.slice(4))
          : data.photos.filter(p => p.tags?.split(',').map(t => t.trim()).includes(filter))

    // Search filter — matches caption, tags, and project name
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      photos = photos.filter(p => {
        const caption = (p.caption || '').toLowerCase()
        const tags = (p.tags || '').toLowerCase()
        const projName = (projMap[p.project_id]?.name || '').toLowerCase()
        return caption.includes(q) || tags.includes(q) || projName.includes(q)
      })
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

  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const [dragging, setDragging] = useState(false)
  const dragCount = useRef(0)

  const onGridDragEnter = e => { e.preventDefault(); dragCount.current++; setDragging(true) }
  const onGridDragLeave = () => { dragCount.current--; if (dragCount.current <= 0) { setDragging(false); dragCount.current = 0 } }
  const onGridDragOver = e => e.preventDefault()
  const onGridDrop = e => { e.preventDefault(); setDragging(false); dragCount.current = 0; handleFiles(e.dataTransfer.files) }

  if (showTriage) {
    return (
      <>
        <PhotoTriage
          onClose={() => setShowTriage(false)}
          onNewProject={() => setShowNewProject(true)}
        />
        {showNewProject && (
          <QuickNewProjectSheet
            categories={data.categories || []}
            onSave={async fields => {
              try {
                const proj = await db.addProject(fields)
                mutate(d => ({ ...d, projects: [proj, ...d.projects] }))
                toast(`"${fields.name}" created`, 'success')
                setShowNewProject(false)
              } catch (e) { toast(e.message, 'error') }
            }}
            onClose={() => setShowNewProject(false)}
          />
        )}
      </>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        {/* Compact header with inline filters — sticky */}
        <div style={{ padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, background: 'var(--c-bg-raised)', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h1 className="page-title" style={{ margin: 0 }}>All Photos</h1>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{data.photos.length}</span>
            </div>
            <div className="filter-bar" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
              <FilterSelect
                value={filter.startsWith('cat:') ? 'all' : filter}
                onChange={v => { setFilter(v); if (v !== 'unsorted') { setUnsortedStatus('all'); setIncludeComplete(false) } }}
                options={[
                  ...(unsortedCount > 0 ? [{ value: 'unsorted', label: `Inbox (${unsortedCount})` }] : []),
                  { value: 'finished', label: `Finished${typeCounts.finished ? ` (${typeCounts.finished})` : ''}` },
                  { value: 'portfolio', label: `Portfolio${typeCounts.portfolio ? ` (${typeCounts.portfolio})` : ''}` },
                  { value: 'progress', label: `Progress${typeCounts.progress ? ` (${typeCounts.progress})` : ''}` },
                  { value: 'inspiration', label: `Inspiration${typeCounts.inspiration ? ` (${typeCounts.inspiration})` : ''}` },
                  { value: 'before', label: `Before${typeCounts.before ? ` (${typeCounts.before})` : ''}` },
                  { value: 'after', label: `After${typeCounts.after ? ` (${typeCounts.after})` : ''}` },
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
              {/* Inline unsorted pill — desktop only */}
              {!isMobile && unsortedCount > 0 && filter !== 'unsorted' && (
                <div
                  onClick={() => setFilter('unsorted')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                    background: 'var(--orange-dim)', border: '1px solid var(--orange)',
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)', whiteSpace: 'nowrap' }}>
                    {unsortedCount} unsorted
                  </span>
                  <button className="btn-primary" style={{ padding: '3px 10px', fontSize: 11, flexShrink: 0, lineHeight: 1.4 }}
                    onClick={e => { e.stopPropagation(); setShowTriage(true) }}>
                    Sort →
                  </button>
                </div>
              )}
              {/* Optimize (owner only) */}
              {isOwner && (
                <button onClick={handleOptimize} disabled={scanning} title="Generate fast-loading thumbnails for older photos"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                    background: 'var(--c-bg-subtle)', border: '1.5px solid var(--c-border)',
                    color: 'var(--c-text-muted)', fontSize: 12, fontWeight: 600,
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}>
                  <IGrid size={14} sw={2} />
                  {!isMobile && <span>Optimize</span>}
                </button>
              )}
              {/* Find duplicates button */}
              <button
                onClick={handleScanDuplicates}
                disabled={scanning}
                title="Find duplicate photos"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
                  background: 'var(--c-bg-subtle)', border: '1.5px solid var(--c-border)',
                  color: 'var(--c-text-muted)', fontSize: 12, fontWeight: 600,
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  transition: 'border-color 150ms, color 150ms',
                }}
              >
                <IDuplicates size={14} sw={2} />
                {!isMobile && <span>Duplicates</span>}
              </button>
            </div>
          </div>
          {/* Search + grid density row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <ISearch size={14} color="var(--c-text-muted)" sw={2} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search captions, tags, projects…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px 7px 30px',
                  fontSize: 13, fontFamily: 'inherit',
                  background: 'var(--c-bg-subtle)', border: '1.5px solid var(--c-border)',
                  borderRadius: 6, color: 'var(--c-text-primary)',
                  outline: 'none',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'var(--c-text-muted)', border: 'none', borderRadius: '50%',
                    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  <IClose size={10} color="var(--c-bg-surface)" sw={3} />
                </button>
              )}
            </div>
            {/* Grid density toggle — desktop only */}
            {!isMobile && (
              <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setGridCols(gridCols === n ? 0 : n)}
                    title={`${n} columns`}
                    style={{
                      padding: '6px 10px', fontSize: 11, fontWeight: 700,
                      fontFamily: 'inherit', cursor: 'pointer',
                      background: gridCols === n ? 'var(--navy)' : 'var(--c-bg-subtle)',
                      color: gridCols === n ? 'var(--white)' : 'var(--c-text-muted)',
                      border: '1.5px solid var(--c-border)',
                      borderRight: 'none',
                    }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setGridCols(gridCols === 5 ? 0 : 5)}
                  title="5 columns"
                  style={{
                    padding: '6px 10px', fontSize: 11, fontWeight: 700,
                    fontFamily: 'inherit', cursor: 'pointer',
                    background: gridCols === 5 ? 'var(--navy)' : 'var(--c-bg-subtle)',
                    color: gridCols === 5 ? 'var(--white)' : 'var(--c-text-muted)',
                    border: '1.5px solid var(--c-border)',
                  }}
                >
                  5
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Photo grid with drag-drop (desktop only) */}
        <div
          onDragEnter={isMobile ? undefined : onGridDragEnter}
          onDragLeave={isMobile ? undefined : onGridDragLeave}
          onDragOver={isMobile ? undefined : onGridDragOver}
          onDrop={isMobile ? undefined : onGridDrop}
          style={{
            position: 'relative',
            ...(dragging ? { outline: '3px dashed var(--accent)', outlineOffset: -3, borderRadius: 12, background: 'var(--accent-dim)' } : {}),
            transition: 'background 150ms, outline 150ms',
            minHeight: 200,
          }}
        >
          {dragging && !isMobile && (
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
          return (
            <>
              {/* Unsorted controls — always visible when in unsorted view */}
              {filter === 'unsorted' && (
                <div style={{ padding: '0 16px 12px' }}>
                  {/* Row 1: Status filters */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {[
                      { id: 'all',      label: 'All' },
                      { id: 'active',   label: 'Active' },
                      { id: 'planning', label: 'Planning' },
                      { id: 'paused',   label: 'Paused' },
                    ].map(s => (
                      <button key={s.id} onClick={() => setUnsortedStatus(s.id)} style={{
                        padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', borderRadius: 0,
                        background: unsortedStatus === s.id ? 'var(--navy)' : 'var(--c-bg-subtle)',
                        color: unsortedStatus === s.id ? 'var(--white)' : 'var(--c-text-muted)',
                        border: '1.5px solid var(--c-border)',
                      }}>{s.label}</button>
                    ))}
                    <button onClick={() => setIncludeComplete(v => !v)} style={{
                      padding: '5px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'inherit', borderRadius: 0,
                      background: includeComplete ? 'var(--forest-dim)' : 'var(--c-bg-subtle)',
                      color: includeComplete ? 'var(--forest)' : 'var(--c-text-muted)',
                      border: `1.5px solid ${includeComplete ? 'var(--forest)' : 'var(--c-border)'}`,
                    }}>+ Complete</button>
                  </div>
                  {/* Row 2: Sort action + New Project (separate row) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}
                      onClick={() => setShowNewProject(true)}>
                      + New Project
                    </button>
                    {filtered.length > 0 && (
                      <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}
                        onClick={() => setShowTriage(true)}>
                        Sort {filtered.length} photo{filtered.length !== 1 ? 's' : ''} →
                      </button>
                    )}
                  </div>
                </div>
              )}
              {filtered.length > 0
                ? <PhotoGrid
                    photos={filtered}
                    onEdit={edit}
                    showProject
                    projects={data.projects}
                    onNavigateProject={id => navigate('projects', id)}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onEnterSelectMode={handleEnterSelectMode}
                    sortBy={sortBy}
                    gridCols={gridCols}
                  />
                : (
                  <div className="empty" style={{ paddingTop: 60 }}>
                    <ICamera size={32} color="var(--c-text-muted)" sw={1.5} />
                    <div className="empty-title" style={{ marginTop: 12 }}>{filter === 'unsorted' ? 'No photos match' : filter === 'all' ? 'No photos yet' : 'No photos in this filter'}</div>
                    <p className="empty-sub">{filter === 'unsorted' ? 'Try a different filter above' : filter === 'all' ? 'Drop photos above or tap the camera button' : 'Try a different filter above'}</p>
                  </div>
                )
              }
            </>
          )
        })()}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={quickRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleQuickUpload} />
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />

      {/* FAB menu backdrop */}
      {showFabMenu && (
        <div
          onClick={() => setShowFabMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 39 }}
        />
      )}

      {/* FAB popover menu */}
      {showFabMenu && (
        <div className="fab-menu">
          <button
            onClick={() => { setShowFabMenu(false); quickRef.current?.click() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '14px 16px', border: 'none', borderBottom: '1px solid var(--c-border)',
              background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)',
              textAlign: 'left',
            }}
          >
            <IPlus size={18} color="var(--orange)" sw={2.5} />
            <div>
              <div>Quick Upload</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--c-text-muted)', marginTop: 1 }}>Skip tagging, sort later</div>
            </div>
          </button>
          <button
            onClick={() => { setShowFabMenu(false); fileRef.current?.click() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '14px 16px', border: 'none',
              background: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)',
              textAlign: 'left',
            }}
          >
            <ICamera size={18} color="var(--accent)" sw={2} />
            <div>
              <div>Upload with Tags</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--c-text-muted)', marginTop: 1 }}>Add caption and tags</div>
            </div>
          </button>
        </div>
      )}

      {/* Single FAB */}
      <button
        className="fab"
        onClick={() => setShowFabMenu(v => !v)}
        disabled={uploading}
        aria-label="Upload photos"
      >
        {uploading
          ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff' }} />
          : <ICamera size={22} color="#fff" sw={2} />}
      </button>
      {showLimit && <PhotoLimitSheet onClose={() => setShowLimit(false)} count={data.photos.length} />}
      {showTag && (
        <PhotoTagSheet
          count={pendingFiles.length}
          onSave={doUpload}
          onClose={() => { setShowTag(false); setPendingFiles([]) }}
        />
      )}
      {showNewProject && (
        <QuickNewProjectSheet
          categories={data.categories || []}
          onSave={async fields => {
            try {
              const proj = await db.addProject(fields)
              mutate(d => ({ ...d, projects: [proj, ...d.projects] }))
              toast(`"${fields.name}" created`, 'success')
              setShowNewProject(false)
            } catch (e) { toast(e.message, 'error') }
          }}
          onClose={() => setShowNewProject(false)}
        />
      )}
      {/* Scanning progress overlay */}
      {scanning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--c-bg-surface)', border: '1px solid var(--c-border)',
            padding: '32px 36px', maxWidth: 340, width: '100%',
            textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,.4)',
          }}>
            <IDuplicates size={36} color="var(--accent)" sw={1.5} />
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-primary)', margin: '16px 0 8px' }}>
              {scanKind === 'optimize' ? 'Optimizing photos' : 'Scanning for duplicates'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--c-text-muted)', margin: '0 0 20px' }}>
              {scanProgress.total > 0
                ? `${scanKind === 'optimize' ? 'Processing' : 'Analyzing'} ${scanProgress.done} of ${scanProgress.total} photos…`
                : 'Preparing scan…'
              }
            </p>
            {scanProgress.total > 0 && (
              <div style={{ height: 4, background: 'var(--c-bg-subtle)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: 'var(--accent)', borderRadius: 2,
                  width: `${Math.round((scanProgress.done / scanProgress.total) * 100)}%`,
                  transition: 'width 200ms ease',
                }} />
              </div>
            )}
          </div>
        </div>
      )}
      {/* Duplicate review screen */}
      {showDuplicates && (
        <DuplicateReview
          groups={duplicateGroups}
          projects={data.projects}
          onDelete={handleDeleteDuplicates}
          onClose={() => { setShowDuplicates(false); setDuplicateGroups([]) }}
        />
      )}
      {/* Selection toolbar */}
      {selectMode && (
        <div className="select-toolbar">
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)', whiteSpace: 'nowrap' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSelectAll}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                background: 'var(--c-bg-subtle)', color: 'var(--c-text-primary)',
                border: '1.5px solid var(--c-border)', cursor: 'pointer',
                fontFamily: 'inherit', borderRadius: 0,
              }}
            >
              {selectedIds.size === getFiltered().length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 700,
                background: selectedIds.size > 0 ? 'var(--red)' : 'var(--c-bg-subtle)',
                color: selectedIds.size > 0 ? '#fff' : 'var(--c-text-muted)',
                border: 'none', cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                fontFamily: 'inherit', borderRadius: 0,
              }}
            >
              Delete
            </button>
            <button
              onClick={handleExitSelectMode}
              style={{
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                background: 'var(--accent)', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', borderRadius: 0,
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoLimitSheet({ onClose, count }) {
  return (
    <div style={{ position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 20px' }}>
      <div style={{ background:'var(--c-bg-surface)',border:'1px solid var(--c-border)',maxWidth:400,width:'100%',padding:'32px 28px',boxShadow:'0 24px 60px rgba(0,0,0,.4)' }}>
        <div style={{ fontSize:36,marginBottom:16 }}>📷</div>
        <h2 style={{ fontSize:20,fontWeight:800,color:'var(--c-text-primary)',marginBottom:8 }}>Photo limit reached</h2>
        <p style={{ fontSize:14,color:'var(--c-text-muted)',lineHeight:1.7,marginBottom:20 }}>
          You've reached the free tier limit of <strong>{count} photos</strong>. To upload more photos, contact us to discuss an upgrade. Existing photos are safe and unaffected.
        </p>
        <div style={{ display:'flex',gap:10 }}>
          <a href="mailto:johnhyde23@gmail.com?subject=JDH Woodworks Photo Upgrade"
            style={{ flex:1,padding:'10px',background:'var(--accent)',color:'#fff',border:'none',textDecoration:'none',textAlign:'center',fontSize:14,fontWeight:700,cursor:'pointer' }}>
            Contact for upgrade
          </a>
          <button onClick={onClose} style={{ flex:1,padding:'10px',background:'var(--c-bg-subtle)',color:'var(--c-text-primary)',border:'1.5px solid var(--c-border)',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>
            OK
          </button>
        </div>
      </div>
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

function QuickNewProjectSheet({ categories, onSave, onClose }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState('active')
  return (
    <Sheet title="New Project" onClose={onClose} onSave={async () => {
      if (!name.trim()) return
      await onSave({ name: name.trim(), status, description: '' })
    }} saveLabel="Create">
      <div className="form-group">
        <FormCell label="Name">
          <input className="form-input" placeholder="Project name" value={name}
            onChange={e => setName(e.target.value)} autoFocus />
        </FormCell>
        <FormCell label="Status" last>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </FormCell>
      </div>
    </Sheet>
  )
}

function DuplicateReview({ groups, projects, onDelete, onClose }) {
  // Default: keep newest in each group, mark rest for deletion
  const [toDelete, setToDelete] = useState(() => {
    const ids = new Set()
    groups.forEach(group => {
      const sorted = [...group].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      sorted.slice(1).forEach(p => ids.add(p.id))
    })
    return ids
  })

  const projMap = {}
  projects.forEach(p => { projMap[p.id] = p })

  const toggle = (id) => {
    setToDelete(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fmtDate = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'var(--c-bg-raised)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'max(env(safe-area-inset-top), 12px)',
      paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--c-border)',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-primary)', margin: 0 }}>
            {groups.length} Duplicate Group{groups.length !== 1 ? 's' : ''} Found
          </h2>
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: '2px 0 0' }}>
            Tap a photo to toggle keep / delete
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 8,
            color: 'var(--c-text-muted)',
          }}
          aria-label="Close"
        >
          <IClose size={22} sw={2} />
        </button>
      </div>

      {/* Groups */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {groups.map((group, gi) => {
          const sorted = [...group].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          return (
            <div key={gi} style={{
              marginBottom: 20, background: 'var(--c-bg-surface)',
              border: '1px solid var(--c-border)', borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--c-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)' }}>
                  Group {gi + 1}
                </span>
                <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {sorted.length} copies
                </span>
              </div>
              <div style={{
                display: 'flex', gap: 12, overflowX: 'auto',
                padding: 14, scrollbarWidth: 'none',
              }}>
                {sorted.map(photo => {
                  const proj = projMap[photo.project_id]
                  const willDelete = toDelete.has(photo.id)
                  return (
                    <div
                      key={photo.id}
                      onClick={() => toggle(photo.id)}
                      style={{
                        flexShrink: 0, width: 140, cursor: 'pointer',
                        borderRadius: 8, overflow: 'hidden',
                        border: `2px solid ${willDelete ? 'var(--red)' : 'var(--forest)'}`,
                        opacity: willDelete ? 0.6 : 1,
                        transition: 'opacity 200ms, border-color 200ms',
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', background: 'var(--c-bg-subtle)' }}>
                        <PhotoImg
                          photo={photo}
                          alt={photo.caption || ''}
                          loading="lazy"
                          style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', display: 'block',
                          }}
                        />
                        {/* Keep / Delete badge */}
                        <div style={{
                          position: 'absolute', top: 6, left: 6,
                          padding: '2px 8px', borderRadius: 4,
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: willDelete ? 'var(--red)' : 'var(--forest)',
                          color: '#fff',
                        }}>
                          {willDelete ? 'Delete' : 'Keep'}
                        </div>
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        {proj && (
                          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, marginBottom: 2 }}>
                            {proj.name}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                          {fmtDate(photo.created_at)}
                        </div>
                        {photo.tags && (
                          <div style={{ fontSize: 10, color: 'var(--c-text-faint)', marginTop: 2 }}>
                            {photo.tags}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action bar */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--c-border)',
        display: 'flex', gap: 10, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1, padding: '12px', fontSize: 14, fontWeight: 600,
            background: 'var(--c-bg-subtle)', color: 'var(--c-text-primary)',
            border: '1.5px solid var(--c-border)', cursor: 'pointer',
            fontFamily: 'inherit', borderRadius: 0,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onDelete([...toDelete])}
          disabled={toDelete.size === 0}
          style={{
            flex: 1, padding: '12px', fontSize: 14, fontWeight: 700,
            background: toDelete.size > 0 ? 'var(--red)' : 'var(--c-bg-subtle)',
            color: toDelete.size > 0 ? '#fff' : 'var(--c-text-muted)',
            border: 'none', cursor: toDelete.size > 0 ? 'pointer' : 'default',
            fontFamily: 'inherit', borderRadius: 0,
          }}
        >
          Delete {toDelete.size} Photo{toDelete.size !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}
