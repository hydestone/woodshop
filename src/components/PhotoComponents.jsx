import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { Sheet, FormCell, TagInput, ConfirmSheet } from './UICore.jsx'
import { IEdit, IClose, IChevR, IChevL, IPlus, ITrash, IImage, IBulb } from './Icons.jsx'

// ─── Lightbox ─────────────────────────────────────────────────────────────────
export function Lightbox({ photos, index, onClose, onEdit }) {
  const [cur, setCur]                   = useState(index)
  const [scale, setScale]               = useState(1)
  const [rotation, setRotation]         = useState(photos[index]?.rotation || 0)
  const [pan, setPan]                   = useState({ x: 0, y: 0 })
  const [showEdit, setShowEdit]         = useState(false)
  const [showSaveRotation, setShowSaveRotation] = useState(false)
  const containerRef   = useRef()
  const lastDist       = useRef(null)
  const lastMid        = useRef(null)
  const dragStart      = useRef(null)
  const panStart       = useRef({ x: 0, y: 0 })
  const swipeStartX    = useRef(null)

  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }) }
  useEffect(() => { reset(); setRotation(photos[cur]?.rotation || 0); setShowSaveRotation(false) }, [cur])

  // Keyboard navigation
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (scale > 1) return
      if (e.key === 'ArrowRight' && cur < photos.length - 1) setCur(i => i + 1)
      if (e.key === 'ArrowLeft'  && cur > 0)                  setCur(i => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur, scale, photos.length, onClose])

  // Scroll-wheel zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = e => {
      e.preventDefault()
      setScale(s => Math.max(1, Math.min(10, s * (1 - e.deltaY * 0.001))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const photo = photos[cur]
  const tags  = photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  // Mouse pan
  const onMouseDown = e => { if (scale <= 1) return; dragStart.current = { x: e.clientX, y: e.clientY }; panStart.current = { ...pan } }
  const onMouseMove = e => { if (!dragStart.current || !panStart.current) return; setPan({ x: panStart.current.x + e.clientX - dragStart.current.x, y: panStart.current.y + e.clientY - dragStart.current.y }) }
  const onMouseUp   = () => { dragStart.current = null }

  // Touch handlers — useEffect with passive:false required for iOS Safari
  // React synthetic onTouchMove is passive by default and cannot call preventDefault
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = e => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastDist.current = Math.hypot(dx, dy)
        lastMid.current  = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
        panStart.current = { x: 0, y: 0 }
        swipeStartX.current = null
      } else if (e.touches.length === 1) {
        swipeStartX.current = e.touches[0].clientX
        dragStart.current   = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        panStart.current    = { x: 0, y: 0 }
      }
    }

    const onTouchMove = e => {
      if (e.touches.length === 2) {
        const prevDist = lastDist.current
        if (!prevDist) return
        e.preventDefault()
        const dx   = e.touches[0].clientX - e.touches[1].clientX
        const dy   = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        setScale(s => Math.max(1, Math.min(10, s * (dist / prevDist))))
        const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
        const prevMid = lastMid.current
        if (prevMid) setPan(p => ({ x: p.x + mid.x - (prevMid?.x ?? 0), y: p.y + mid.y - (prevMid?.y ?? 0) }))
        lastDist.current = dist
        lastMid.current  = mid
      } else if (e.touches.length === 1) {
        const ds = dragStart.current
        const ps = panStart.current
        if (!ds || !ps) return
        setScale(s => {
          if (s <= 1) return s
          e.preventDefault()
          setPan({ x: (ps?.x ?? 0) + e.touches[0].clientX - (ds?.x ?? 0), y: (ps?.y ?? 0) + e.touches[0].clientY - (ds?.y ?? 0) })
          return s
        })
      }
    }

    const onTouchEnd = e => {
      if (e.touches.length < 2) { lastDist.current = null; lastMid.current = null }
      const startX = swipeStartX.current
      swipeStartX.current = null
      dragStart.current   = null
      if (startX !== null && e.changedTouches.length > 0) {
        const diff = startX - e.changedTouches[0].clientX
        setScale(s => {
          if (s === 1) {
            if (diff > 60)  setCur(i => Math.min(i + 1, photos.length - 1))
            if (diff < -60) setCur(i => Math.max(i - 1, 0))
          }
          return s
        })
      }
    }

    el.addEventListener('touchstart',  onTouchStart, { passive: true  })
    el.addEventListener('touchmove',   onTouchMove,  { passive: false })
    el.addEventListener('touchend',    onTouchEnd,   { passive: true  })
    return () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onTouchEnd)
    }
  }, [cur])

  // Keep pan refs in sync
  useEffect(() => { panStart.current = { ...pan } }, [pan])

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Photo ${cur + 1} of ${photos.length}`}
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,8,.96)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: scale > 1 ? 'grab' : 'default', touchAction: 'none' }}
      onClick={e => { if (e.target === e.currentTarget && scale === 1) onClose() }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}

    >
      <img
        src={photo.url} alt={photo.caption || 'Photo'}
        draggable={false}
        style={{
          maxWidth: '100%', maxHeight: '82vh',
          objectFit: 'contain', borderRadius: 6,
          transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px) rotate(${rotation}deg)`,
          transformOrigin: 'center',
          transition: scale === 1 ? 'transform .22s ease' : 'none',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
        onClick={e => e.stopPropagation()}
      />

      {scale === 1 && (photo.caption || tags.length > 0) && (
        <div style={{ marginTop: 14, textAlign: 'center', padding: '0 60px', maxWidth: 600 }}>
          {photo.caption && <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, marginBottom: 6 }}>{photo.caption}</p>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              {tags.map(t => (
                <span key={t} style={{ background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.7)', borderRadius: 99, padding: '2px 10px', fontSize: 12 }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {scale === 1 && photos.length > 1 && (
        <div style={{ marginTop: 10, color: 'rgba(255,255,255,.35)', fontSize: 13 }}>{cur + 1} / {photos.length}</div>
      )}

      {/* Prev */}
      {cur > 0 && scale === 1 && (
        <button
          aria-label="Previous photo"
          onClick={e => { e.stopPropagation(); setCur(i => i - 1) }}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IChevL size={20} color="#fff" sw={2} />
        </button>
      )}

      {/* Next */}
      {cur < photos.length - 1 && scale === 1 && (
        <button
          aria-label="Next photo"
          onClick={e => { e.stopPropagation(); setCur(i => i + 1) }}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <IChevR size={20} color="#fff" sw={2} />
        </button>
      )}

      {/* Top controls */}
      <div className="lightbox-controls">
        {scale > 1 && (
          <button onClick={e => { e.stopPropagation(); reset() }}
            style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}>
            Reset
          </button>
        )}
        {onEdit && scale === 1 && (
          <button aria-label="Edit photo" onClick={e => { e.stopPropagation(); setShowEdit(true) }}
            style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IEdit size={16} color="#fff" sw={1.8} />
          </button>
        )}
        <button aria-label="Rotate left"  onClick={e => { e.stopPropagation(); setRotation(r => r - 90) }}
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ↺
        </button>
        <button aria-label="Rotate right" onClick={e => { e.stopPropagation(); setRotation(r => r + 90) }}
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ↻
        </button>
        <button aria-label="Close" onClick={e => {
          e.stopPropagation()
          const stored = photos[cur]?.rotation || 0
          const current = ((rotation % 360) + 360) % 360
          if (onEdit && current !== stored) {
            setShowSaveRotation(true)
          } else {
            onClose()
          }
        }}
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IClose size={18} color="#fff" sw={2.5} />
        </button>
      </div>

      {showSaveRotation && (
        <div style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,.88)', borderRadius: 12, padding: '16px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 10,
          boxShadow: '0 4px 24px rgba(0,0,0,.5)', whiteSpace: 'nowrap' }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>Save rotated photo?</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={() => { setShowSaveRotation(false); setRotation(photos[cur]?.rotation || 0) }}
              style={{ background: 'rgba(255,255,255,.18)', border: 'none', borderRadius: 8,
                padding: '8px 18px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
              Discard
            </button>
            <button type="button" onClick={async () => {
              const newRot = ((rotation % 360) + 360) % 360
              await onEdit(photos[cur].id, { rotation: newRot })
              setShowSaveRotation(false)
              onClose()
            }}
              style={{ background: 'var(--forest)', border: 'none', borderRadius: 8,
                padding: '8px 18px', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600 }}>
              Save
            </button>
          </div>
        </div>
      )}
      {showEdit && onEdit && (
        <PhotoEditSheet
          photo={photos[cur]}
          onSave={async fields => { await onEdit(photos[cur].id, fields); setShowEdit(false) }}
          onDelete={async () => { await onEdit(photos[cur].id, { _delete: true }); setShowEdit(false); onClose() }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>,
    document.body
  )
}

// ─── PhotoGrid ────────────────────────────────────────────────────────────────
const PHOTO_PAGE = 40  // photos rendered per batch

export function PhotoGrid({ photos, onEdit, showProject, projects, onNavigateProject, onCreateIdea }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [visible, setVisible]         = useState(PHOTO_PAGE)
  const sentinelRef = useRef(null)

  // Reset visible count when photo set changes (filter change, etc.)
  useEffect(() => { setVisible(PHOTO_PAGE) }, [photos])

  // IntersectionObserver — load next batch when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisible(v => Math.min(v + PHOTO_PAGE, photos.length))
      }
    }, { rootMargin: '300px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [photos.length])

  if (!photos.length) return null

  const shown = photos.slice(0, visible)

  return (
    <>
      <div className="photo-grid" data-tutorial-target="photo-grid">
        {shown.map((photo, i) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            tileIndex={i}
            onEdit={onEdit}
            showProject={showProject}
            projects={projects}
            onOpen={() => setLightboxIdx(photos.indexOf(photo))}
            onNavigateProject={onNavigateProject}
            onCreateIdea={onCreateIdea}
          />
        ))}
      </div>
      {/* Sentinel — triggers loading next batch */}
      {visible < photos.length && (
        <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
          <span style={{ fontSize: 12, color: 'var(--c-text-faint)' }}>
            Showing {visible} of {photos.length}
          </span>
        </div>
      )}
      {lightboxIdx !== null && (
        <Lightbox photos={photos} index={lightboxIdx} onClose={() => setLightboxIdx(null)} onEdit={onEdit} />
      )}
    </>
  )
}

// ─── PhotoCard ────────────────────────────────────────────────────────────────
export const PhotoCard = memo(function PhotoCard({ photo, onEdit, onOpen, showProject, projects, tileIndex = 0, onNavigateProject, onCreateIdea }) {
  const cardRef = useRef()
  const onMove = useCallback(e => {
    const el = cardRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width  - 0.5
    const y = (e.clientY - r.top)  / r.height - 0.5
    el.style.transform = `perspective(600px) rotateY(${x*7}deg) rotateX(${-y*7}deg) scale(1.03)`
    el.style.boxShadow = `${-x*8}px ${y*8}px 24px rgba(0,0,0,.18)`
  }, [])
  const onLeave = useCallback(() => {
    const el = cardRef.current; if (!el) return
    el.style.transform = ''
    el.style.boxShadow = ''
  }, [])
  const [err, setErr]           = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const proj = showProject && projects ? projects.find(p => p.id === photo.project_id) : null
  const tags = photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <div
      ref={cardRef}
      className="photo-card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: 'transform 200ms cubic-bezier(.25,.46,.45,.94), box-shadow 200ms ease' }}
    >
      {!err ? (
        <img
          src={photo.url}
          alt={photo.caption || 'Workshop photo'}
          loading="lazy"
          onError={() => setErr(true)}
          onClick={onOpen}
          style={photo.rotation ? { transform: `rotate(${photo.rotation}deg)` } : undefined}
        />
      ) : (
        <div className="photo-placeholder">No image</div>
      )}

      {(photo.caption || proj || tags.length > 0) && (
        <div className="photo-footer">
          {proj && (
            <div
              style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 2, cursor: 'pointer', fontWeight: 500 }}
              onClick={e => { e.stopPropagation(); onNavigateProject && onNavigateProject(proj.id) }}
              title={`Open ${proj.name}`}
            >
              ↗ {proj.name}
            </div>
          )}
          {photo.caption && <div className="photo-caption-text">{photo.caption}</div>}
          {tags.length > 0 && (
            <div className="photo-tags-row">
              {tags.map(t => <span key={t} className="photo-tag">{t}</span>)}
            </div>
          )}
        </div>
      )}

      {onEdit && (
        <button
          className="photo-overlay-btn photo-edit-btn"
          onClick={e => { e.stopPropagation(); setShowEdit(true) }}
          aria-label="Edit photo"
        >
          <IEdit size={13} color="#fff" sw={2} />
        </button>
      )}

      {onCreateIdea && (
        <button
          className="photo-overlay-btn photo-idea-btn"
          onClick={e => { e.stopPropagation(); onCreateIdea(photo) }}
          aria-label="Create idea from photo"
        >
          💡
        </button>
      )}

      {showEdit && (
        <PhotoEditSheet
          photo={photo}
          projects={projects}
          onSave={async fields => { await onEdit(photo.id, fields); setShowEdit(false) }}
          onDelete={onEdit ? async () => { await onEdit(photo.id, { _delete: true }); setShowEdit(false) } : null}
          onClose={() => setShowEdit(false)}
          onOpenLightbox={() => { setShowEdit(false); onOpen && onOpen() }}
        />
      )}
    </div>
  )
})

// ─── PhotoEditSheet ───────────────────────────────────────────────────────────
function PhotoEditSheet({ photo, projects, onSave, onDelete, onClose, onOpenLightbox }) {
  const [caption, setCaption]   = useState(photo.caption || '')
  const [tags, setTags]         = useState(photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
  const [projectId, setProjectId] = useState(photo.project_id || '')
  const [photoType, setPhotoType] = useState(photo.photo_type || '')
  const [confirm, setConfirm]   = useState(false)

  if (confirm) return (
    <ConfirmSheet
      message="Delete this photo? It will go to Trash."
      onConfirm={onDelete}
      onClose={() => setConfirm(false)}
    />
  )

  const activeProjects = projects ? [...projects].sort((a,b) => a.name.localeCompare(b.name)) : []

  return (
    <Sheet title="Edit Photo" onClose={onClose} onSave={() => onSave({
      caption,
      tags: tags.join(','),
      project_id: projectId || null,
      ...(photoType ? { photo_type: photoType } : {}),
    })}>
      {/* Preview tap to open */}
      {onOpenLightbox && (
        <div style={{ marginBottom: 12, borderRadius: 0, overflow: 'hidden', cursor: 'pointer', maxHeight: 180, position: 'relative' }} onClick={onOpenLightbox}>
          <img src={photo.url} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, background: 'rgba(0,0,0,.4)', padding: '4px 12px', borderRadius: 99 }}>Tap to view full size</span>
          </div>
        </div>
      )}
      <div className="form-group">
        <FormCell label="Caption">
          <input
            className="form-input"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Optional"
            autoFocus
          />
        </FormCell>
        <FormCell label="Type">
          <select className="form-select" value={photoType} onChange={e => setPhotoType(e.target.value)}>
            <option value="">— Unchanged —</option>
            {['progress','finished','portfolio','before','after','inspiration','unsorted'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </FormCell>
        <FormCell label="Project" last>
          <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {activeProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 8, marginTop: 12 }}>Tags</p>
      <TagInput tags={tags} onChange={setTags} />
      {onDelete && (
        <button className="btn-danger" onClick={() => setConfirm(true)} style={{ marginTop: 20 }}>
          Delete Photo
        </button>
      )}
    </Sheet>
  )
}
