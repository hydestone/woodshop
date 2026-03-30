import { useState, useRef, useEffect } from 'react'

// ─── SVG Icons ────────────────────────────────────────────────────────────────
export const Svg = ({ d, size = 22, c = 'currentColor', sw = 1.8, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
)
export const IPlus    = p => <Svg {...p} d="M12 5v14M5 12h14" />
export const ITrash   = p => <Svg {...p} d={['M3 6h18','M19 6l-1 14H6L5 6','M8 6V4h8v2']} />
export const ICirc    = p => <Svg {...p} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20" />
export const IDone    = p => <Svg {...p} d={['M22 11.08V12a10 10 0 1 1-5.93-9.14','M22 4 12 14.01l-3-3']} />
export const IChev    = p => <Svg {...p} d="M9 18l6-6-6-6" />
export const IBack    = p => <Svg {...p} d="M15 18l-6-6 6-6" />
export const IEdit    = p => <Svg {...p} d={['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7','M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z']} />
export const ICalendar = p => <Svg {...p} d={['M8 2v4','M16 2v4','M3 10h18','M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} />
export const ICamera  = p => <Svg {...p} d={['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']} />
export const IUpload  = p => <Svg {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M17 8l-5-5-5 5','M12 3v12']} />
export const IX       = p => <Svg {...p} d="M18 6 6 18M6 6l12 12" />
export const ILink    = p => <Svg {...p} d={['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71','M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']} />
export const IGrid    = p => <Svg {...p} d={['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z']} />
export const IFolder  = p => <Svg {...p} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
export const ICart    = p => <Svg {...p} d={['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z','M3 6h18','M16 10a4 4 0 0 1-8 0']} />
export const IWrench  = p => <Svg {...p} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
export const ITree    = p => <Svg {...p} d={['M17 14l3-3-3-3','M7 10l-3 3 3 3','M11 5l-2 14','M13 5l2 14']} />
export const IBulb    = p => <Svg {...p} d={['M9 18h6','M10 22h4','M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z']} />
export const IBook    = p => <Svg {...p} d={['M4 19.5A2.5 2.5 0 0 1 6.5 17H20','M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z']} />
export const IShop    = p => <Svg {...p} d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M9 22V12h6v10']} />
export const IPhoto   = p => <Svg {...p} d={['M21 15l-5-5L5 21','M3 3h18v18H3z','M8.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z']} fill={p.fill||'none'} />
export const IFinish  = p => <Svg {...p} d={['M12 2L2 7l10 5 10-5-10-5','M2 17l10 5 10-5','M2 12l10 5 10-5']} />
export const IMore    = p => <Svg {...p} d="M5 12h.01M12 12h.01M19 12h.01" sw={3} />
export const IBell    = p => <Svg {...p} d={['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 0 1-3.46 0']} />

// ─── Auto-expand textarea ────────────────────────────────────────────────────
export const autoExpand = (e) => {
  e.target.style.height = 'auto'
  e.target.style.height = e.target.scrollHeight + 'px'
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
export function Sheet({ title, onClose, onSave, children }) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose}>Cancel</button>
          <span className="sheet-title">{title}</span>
          <button className="sheet-save" onClick={onSave}>Save</button>
        </div>
        <div className="sheet-body">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── FormCell ─────────────────────────────────────────────────────────────────
export function FormCell({ label, children, last }) {
  return (
    <div className="form-cell" style={{ borderBottom: last ? 'none' : undefined }}>
      <span className="form-label">{label}</span>
      {children}
    </div>
  )
}

// ─── BulkAddSheet ─────────────────────────────────────────────────────────────
export function BulkAddSheet({ title, hint, onSave, onClose }) {
  const ref = useRef()
  const handleSave = () => {
    const lines = (ref.current?.value || '').split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length) onSave(lines)
  }
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose}>Cancel</button>
          <span className="sheet-title">{title}</span>
          <button className="sheet-save" onClick={handleSave}>Add</button>
        </div>
        <div className="sheet-body" style={{ paddingBottom: 20 }}>
          <textarea ref={ref} className="bulk-textarea" placeholder={hint + '\n...'} autoFocus />
          <p className="bulk-hint">One item per line. All added at once.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Tag input ────────────────────────────────────────────────────────────────
export function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  const addTag = () => {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  const removeTag = (tag) => onChange(tags.filter(t => t !== tag))
  return (
    <div className="tag-input-wrap">
      {tags.map(t => (
        <span key={t} className="tag-pill">
          {t}
          <button onClick={() => removeTag(t)}><IX size={10} c="currentColor" sw={2.5} /></button>
        </span>
      ))}
      <input
        className="tag-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
        onBlur={addTag}
        placeholder={tags.length === 0 ? 'Add tags…' : ''}
      />
    </div>
  )
}

// ─── Undo toast ───────────────────────────────────────────────────────────────
export function UndoToast({ message, onUndo, onDone }) {
  const [progress, setProgress] = useState(100)
  useEffect(() => {
    const start = Date.now()
    const duration = 5000
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(pct)
      if (pct === 0) { clearInterval(tick); onDone() }
    }, 50)
    return () => clearInterval(tick)
  }, [onDone])
  return (
    <div style={{ position: 'fixed', bottom: 'calc(var(--tabh) + 16px + var(--sb))', left: '50%', transform: 'translateX(-50%)', background: '#1c1c1e', color: '#fff', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, zIndex: 300, boxShadow: '0 4px 20px rgba(0,0,0,.4)', minWidth: 220, maxWidth: 340 }}>
      <span style={{ flex: 1, fontSize: 14 }}>{message}</span>
      <button onClick={onUndo} style={{ background: 'none', border: 'none', color: 'var(--blue)', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fb)', padding: 0, flexShrink: 0 }}>Undo</button>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'var(--blue)', borderRadius: '0 0 12px 12px', width: `${progress}%`, transition: 'width .05s linear' }} />
    </div>
  )
}

// ─── Lightbox with infinite zoom + pan ───────────────────────────────────────
function Lightbox({ photos, index, onClose }) {
  const [cur, setCur] = useState(index)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [origin, setOrigin] = useState({ x: 0.5, y: 0.5 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const containerRef = useRef()
  const imgRef = useRef()
  const lastTouchDist = useRef(null)
  const lastTouchMid = useRef(null)
  const dragStart = useRef(null)
  const panStart = useRef(null)
  const swipeStartX = useRef(null)

  const resetZoom = () => { setScale(1); setPan({ x: 0, y: 0 }); setRotation(0) }

  useEffect(() => { resetZoom() }, [cur])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (scale > 1) return
      if (e.key === 'ArrowRight') setCur(i => Math.min(i + 1, photos.length - 1))
      if (e.key === 'ArrowLeft')  setCur(i => Math.max(i - 1, 0))
    }
    const handleWheel = (e) => {
      e.preventDefault()
      const delta = -e.deltaY * 0.001
      setScale(s => Math.max(1, Math.min(10, s * (1 + delta))))
    }
    window.addEventListener('keydown', handleKey)
    containerRef.current?.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKey)
      containerRef.current?.removeEventListener('wheel', handleWheel)
    }
  }, [photos.length, onClose, scale])

  const photo = photos[cur]
  const tags = photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  const hasPrev = cur > 0 && scale === 1
  const hasNext = cur < photos.length - 1 && scale === 1

  // Mouse drag to pan
  const onMouseDown = (e) => {
    if (scale <= 1) return
    e.preventDefault()
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...pan }
  }
  const onMouseMove = (e) => {
    if (!dragStart.current) return
    setPan({ x: panStart.current.x + e.clientX - dragStart.current.x, y: panStart.current.y + e.clientY - dragStart.current.y })
  }
  const onMouseUp = () => { dragStart.current = null }

  // Touch: pinch-to-zoom + pan + swipe
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastTouchDist.current = Math.sqrt(dx*dx + dy*dy)
      lastTouchMid.current = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
      panStart.current = { ...pan }
      swipeStartX.current = null
    } else if (e.touches.length === 1) {
      swipeStartX.current = e.touches[0].clientX
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      panStart.current = { ...pan }
    }
  }
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && lastTouchDist.current) {
      e.preventDefault()
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx*dx + dy*dy)
      const ratio = dist / lastTouchDist.current
      setScale(s => Math.max(1, Math.min(10, s * ratio)))
      lastTouchDist.current = dist
      // Pan with pinch midpoint
      const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
      if (lastTouchMid.current) {
        setPan(p => ({ x: p.x + mid.x - lastTouchMid.current.x, y: p.y + mid.y - lastTouchMid.current.y }))
      }
      lastTouchMid.current = mid
    } else if (e.touches.length === 1 && scale > 1 && dragStart.current) {
      e.preventDefault()
      setPan({ x: panStart.current.x + e.touches[0].clientX - dragStart.current.x, y: panStart.current.y + e.touches[0].clientY - dragStart.current.y })
    }
  }
  const onTouchEnd = (e) => {
    if (e.touches.length < 2) { lastTouchDist.current = null; lastTouchMid.current = null }
    // Swipe to next/prev only when not zoomed
    if (scale === 1 && swipeStartX.current !== null && e.changedTouches.length > 0) {
      const diff = swipeStartX.current - e.changedTouches[0].clientX
      if (diff > 60 && hasNext) setCur(i => i + 1)
      if (diff < -60 && hasPrev) setCur(i => i - 1)
    }
    swipeStartX.current = null
    dragStart.current = null
  }

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.96)', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: scale > 1 ? 'grab' : 'default', touchAction: 'none' }}
      onClick={e => { if (e.target === e.currentTarget && scale === 1) onClose() }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        ref={imgRef}
        src={photo.url}
        alt={photo.caption}
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '85vh',
          objectFit: 'contain',
          borderRadius: scale > 1 ? 0 : 6,
          transform: `scale(${scale}) translate(${pan.x / scale}px, ${pan.y / scale}px) rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: scale === 1 && !dragStart.current ? 'transform .25s' : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onClick={e => e.stopPropagation()}
      />

      {/* Caption & tags - hide when zoomed */}
      {scale === 1 && (photo.caption || tags.length > 0) && (
        <div style={{ marginTop: 14, textAlign: 'center', padding: '0 60px' }}>
          {photo.caption && <p style={{ color: '#fff', fontSize: 15, marginBottom: 6 }}>{photo.caption}</p>}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              {tags.map(t => <span key={t} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 12 }}>{t}</span>)}
            </div>
          )}
        </div>
      )}

      {/* Counter */}
      {scale === 1 && photos.length > 1 && (
        <div style={{ marginTop: 10, color: 'rgba(255,255,255,.4)', fontSize: 13 }}>{cur + 1} / {photos.length}</div>
      )}

      {/* Prev / Next */}
      {hasPrev && (
        <button onClick={e => { e.stopPropagation(); setCur(i => i - 1) }}
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 99, width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <IBack size={20} c="#fff" sw={2} />
        </button>
      )}
      {hasNext && (
        <button onClick={e => { e.stopPropagation(); setCur(i => i + 1) }}
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 99, width: 44, height: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <IChev size={20} c="#fff" sw={2} />
        </button>
      )}

      {/* Top bar: close + reset zoom */}
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 1 }}>
        {scale > 1 && (
          <button onClick={e => { e.stopPropagation(); resetZoom() }}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 99, padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: 13, fontFamily: 'var(--fb)' }}>
            Reset
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); setRotation(r => r - 90) }}
          style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}
          title="Rotate left">
          ↺
        </button>
        <button onClick={e => { e.stopPropagation(); setRotation(r => r + 90) }}
          style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}
          title="Rotate right">
          ↻
        </button>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 99, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <IX size={20} c="#fff" sw={2.5} />
        </button>
      </div>
    </div>
  )
}

// ─── Photo grid ───────────────────────────────────────────────────────────────
export function PhotoGrid({ photos, onDelete, onEdit, showProject, projects }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [undoPending, setUndoPending] = useState(null) // { photo, timer }

  const handleDelete = (photo) => {
    // Optimistic remove from grid immediately — parent handles actual DB call
    if (undoPending) { clearTimeout(undoPending.timer); undoPending.commit() }
    let committed = false
    const commit = () => { if (!committed) { committed = true; onDelete(photo) } }
    const timer = setTimeout(commit, 5000)
    setUndoPending({ photo, timer, commit })
    // Tell parent to remove from display immediately — we pass a special signal
    onDelete({ ...photo, _undoable: true })
  }

  const handleUndo = () => {
    if (!undoPending) return
    clearTimeout(undoPending.timer)
    // Restore by triggering a reload — simplest approach
    window.location.reload()
  }

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, idx) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onEdit={onEdit}
            showProject={showProject}
            projects={projects}
            onOpen={() => setLightboxIndex(idx)}
          />
        ))}
      </div>
      {lightboxIndex !== null && (
        <Lightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </>
  )
}

// ─── Photo card ───────────────────────────────────────────────────────────────
export function PhotoCard({ photo, onEdit, onOpen, showProject, projects }) {
  const [err, setErr] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const proj = showProject && projects ? projects.find(p => p.id === photo.project_id) : null
  const tags = photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  return (
    <div className="photo-card">
      {!err
        ? <img src={photo.url} alt={photo.caption} onError={() => setErr(true)}
            onClick={onOpen} style={{ cursor: onOpen ? 'zoom-in' : 'default' }} />
        : <div className="photo-placeholder">No image</div>}
      {(photo.caption || proj || tags.length > 0) && (
        <div className="photo-footer">
          {proj && <div style={{ fontSize: 11, color: 'var(--text4)', marginBottom: 2 }}>{proj.name}</div>}
          {photo.caption && <div className="photo-caption">{photo.caption}</div>}
          {tags.length > 0 && (
            <div className="photo-tags">
              {tags.map(t => <span key={t} className="photo-tag">{t}</span>)}
            </div>
          )}
        </div>
      )}
      {onEdit && (
        <button className="photo-del" style={{ left: 6, right: 'auto' }} onClick={e => { e.stopPropagation(); setShowEdit(true) }}>
          <IEdit size={12} c="#fff" sw={2} />
        </button>
      )}
      {showEdit && (
        <PhotoEditSheet
          photo={photo}
          onSave={async (fields) => {
            if (onEdit) await onEdit(photo.id, fields)
            setShowEdit(false)
          }}
          onDelete={onEdit ? async () => {
            if (window.confirm('Delete this photo?')) {
              await onEdit(photo.id, { _delete: true })
              setShowEdit(false)
            }
          } : null}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}

// ─── Photo edit sheet ─────────────────────────────────────────────────────────
function PhotoEditSheet({ photo, onSave, onDelete, onClose }) {
  const [caption, setCaption] = useState(photo.caption || '')
  const [tags, setTags] = useState(
    photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  )
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose}>Cancel</button>
          <span className="sheet-title">Edit Photo</span>
          <button className="sheet-save" onClick={() => onSave({ caption, tags: tags.join(',') })}>Save</button>
        </div>
        <div className="sheet-body" style={{ paddingBottom: 20 }}>
          <div className="form-group">
            <FormCell label="Caption" last>
              <input className="form-input" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Optional" autoFocus />
            </FormCell>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 4px 8px' }}>Tags</p>
          <TagInput tags={tags} onChange={setTags} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {['finished','inspiration','progress','before','after'].map(preset => (
              <button key={preset} onClick={() => setTags(t => t.includes(preset) ? t.filter(x => x !== preset) : [...t, preset])}
                style={{ padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--fb)', fontWeight: 500, background: tags.includes(preset) ? 'var(--blue)' : 'var(--fill)', color: tags.includes(preset) ? '#fff' : 'var(--text3)' }}>
                {preset}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text4)', marginTop: 8, padding: '0 4px' }}>Tap a preset or type custom tags above.</p>
          {onDelete && (
            <button onClick={onDelete}
              style={{ width: '100%', marginTop: 20, padding: '12px', background: 'rgba(255,59,48,.1)', color: 'var(--red)', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fb)' }}>
              Delete Photo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Drop zone ────────────────────────────────────────────────────────────────
export function DropZone({ onFiles, uploading }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()
  return (
    <div
      className={`drop-zone ${drag ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files) }}
      onClick={() => ref.current.click()}
    >
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => onFiles(e.target.files)} />
      <div className="drop-zone-icon">{uploading ? '⏳' : '📁'}</div>
      <p>{uploading ? 'Uploading…' : 'Drop photos here or click to select — JPEG, PNG, HEIC'}</p>
    </div>
  )
}

// ─── Status styles ────────────────────────────────────────────────────────────
export const STATUS = {
  planning: { bg: '#EEF2FF', color: '#3730A3' },
  active:   { bg: '#DCFCE7', color: '#15803D' },
  paused:   { bg: '#FEF3C7', color: '#92400E' },
  complete: { bg: '#D1FAE5', color: '#065F46' },
}

export const STOCK_STATUS = {
  'Freshly cut': { bg: '#D1F2E0', color: '#1A7A3C' },
  'Drying':      { bg: '#FFF0CC', color: '#8A5A00' },
  'Ready to use':{ bg: '#D1ECF1', color: '#0C6878' },
  'Used up':     { bg: '#E5E5EA', color: '#8E8E93' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const fmt = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

export const fmtShort = iso => iso
  ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  : '—'

export const localDt = () => {
  const off = new Date().getTimezoneOffset() * 60000
  return new Date(Date.now() - off).toISOString().slice(0, 16)
}

export function coatStatus(coat) {
  if (!coat.applied_at) return { label: 'Not applied', color: 'var(--text3)', urgent: false }
  const ms = coat.interval_unit === 'hours'
    ? coat.interval_value * 3600000
    : coat.interval_value * 86400000
  const diff = new Date(coat.applied_at).getTime() + ms - Date.now()
  if (diff <= 0) return { label: 'Ready now', color: 'var(--orange)', urgent: true }
  if (diff < 3600000) return { label: `${Math.ceil(diff / 60000)}m`, color: '#FFCC00', urgent: false }
  if (diff < 86400000) return { label: `In ${Math.ceil(diff / 3600000)}h`, color: 'var(--text3)', urgent: false }
  return { label: `In ${Math.ceil(diff / 86400000)}d`, color: 'var(--green)', urgent: false }
}

export function maintStatus(m) {
  if (!m.last_done) return { label: 'Never done', color: 'var(--red)', urgent: true }
  const diff = new Date(m.last_done).getTime() + m.interval_days * 86400000 - Date.now()
  if (diff < 0) return { label: `${Math.ceil(-diff / 86400000)}d overdue`, color: 'var(--red)', urgent: true }
  if (diff < 3 * 86400000) return { label: `Due in ${Math.ceil(diff / 86400000)}d`, color: 'var(--orange)', urgent: true }
  return { label: `Due in ${Math.ceil(diff / 86400000)}d`, color: 'var(--green)', urgent: false }
}
