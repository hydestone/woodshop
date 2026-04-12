import React from 'react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ─── Icons ────────────────────────────────────────────────────────────────────
// Lightweight SVG icon factory — no external dependency
const I = ({ d, size = 22, color = 'currentColor', sw = 1.8, fill = 'none' }) => (
  <svg
    width={size} height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={color}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

export const IPlus     = p => <I {...p} d="M12 5v14M5 12h14" />
export const ITrash    = p => <I {...p} d={['M3 6h18','M19 6l-1 14H6L5 6','M8 6V4h8v2']} />
export const ICircle   = p => <I {...p} d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20" />
export const ICheck    = p => <I {...p} d={['M22 11.08V12a10 10 0 1 1-5.93-9.14','M22 4 12 14.01l-3-3']} />
export const IChevR    = p => <I {...p} d="M9 18l6-6-6-6" />
export const IChevL    = p => <I {...p} d="M15 18l-6-6 6-6" />
export const IEdit     = p => <I {...p} d={['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7','M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z']} />
export const ICal      = p => <I {...p} d={['M8 2v4','M16 2v4','M3 10h18','M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z']} />
export const ICamera   = p => <I {...p} d={['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']} />
export const IUpload   = p => <I {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M17 8l-5-5-5 5','M12 3v12']} />
export const IClose    = p => <I {...p} d="M18 6 6 18M6 6l12 12" />
export const ILink     = p => <I {...p} d={['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71','M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71']} />
export const IGrid     = p => <I {...p} d={['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z']} />
export const IFolder   = p => <I {...p} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
export const ICart     = p => <I {...p} d={['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z','M3 6h18','M16 10a4 4 0 0 1-8 0']} />
export const IWrench   = p => <I {...p} d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
export const ITree     = p => <I {...p} d={['M17 14l3-3-3-3','M7 10l-3 3 3 3','M11 5l-2 14','M13 5l2 14']} />
export const IBulb     = p => <I {...p} d={['M9 18h6','M10 22h4','M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z']} />
export const IBook     = p => <I {...p} d={['M4 19.5A2.5 2.5 0 0 1 6.5 17H20','M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z']} />
export const IHouse    = p => <I {...p} d={['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M9 22V12h6v10']} />
export const IImage    = p => <I {...p} d={['M21 15l-5-5L5 21','M3 3h18v18H3z','M8.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z']} />
export const ILayers   = p => <I {...p} d={['M12 2L2 7l10 5 10-5-10-5','M2 17l10 5 10-5','M2 12l10 5 10-5']} />
export const IMore     = p => <I {...p} d="M5 12h.01M12 12h.01M19 12h.01" sw={3} />
export const IBell     = p => <I {...p} d={['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 0 1-3.46 0']} />
export const ISearch   = p => <I {...p} d={['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M21 21l-4.35-4.35']} />
export const ISaw      = p => <I {...p} d={['M3 9h13l4 3-4 3H3V9z','M7 9v6','M10 9v6','M13 9v6','M1 12h2']} />
export const IDollar   = p => <I {...p} d={['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6']} />
export const IBrain    = p => <I {...p} d={['M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.84A2.5 2.5 0 0 1 9.5 2','M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.84A2.5 2.5 0 0 0 14.5 2']} />
export const IIdea    = p => <I {...p} d={['M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z','M9 21h6','M9.5 17.5h5']} />
export const IStar     = p => <I {...p} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={p.fill||'none'} />

// ─── Status palettes ──────────────────────────────────────────────────────────
export const STATUS = {
  planning: { bg: '#F0EFFE', color: '#5B4EBE' },
  active:   { bg: '#ECFDF5', color: '#15803D' },
  paused:   { bg: '#FFFBEB', color: '#92400E' },
  complete: { bg: '#F0FDF4', color: '#166534' },
}

export const STOCK_STATUS = {
  'Freshly cut': { bg: '#ECFDF5', color: '#15803D' },
  'Drying':      { bg: '#FFFBEB', color: '#92400E' },
  'Ready to use':{ bg: '#EFF6FF', color: '#1D4ED8' },
  'Used up':     { bg: '#F9FAFB', color: '#6B7280' },
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
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

// ─── Status computers ─────────────────────────────────────────────────────────
export function coatStatus(coat) {
  if (!coat.applied_at) return { label: 'Not applied', color: 'var(--text-3)', urgent: false }
  const ms = coat.interval_unit === 'hours'
    ? coat.interval_value * 3_600_000
    : coat.interval_value * 86_400_000
  const diff = new Date(coat.applied_at).getTime() + ms - Date.now()
  if (diff <= 0)           return { label: 'Ready now',                         color: 'var(--orange)', urgent: true  }
  if (diff < 3_600_000)   return { label: `${Math.ceil(diff / 60_000)}m`,       color: '#D97706',       urgent: false }
  if (diff < 86_400_000)  return { label: `In ${Math.ceil(diff / 3_600_000)}h`, color: 'var(--text-3)', urgent: false }
  return                          { label: `In ${Math.ceil(diff / 86_400_000)}d`,color: 'var(--green)',  urgent: false }
}

export function maintStatus(m) {
  if (!m.last_done) return { label: 'Never done', color: 'var(--red)', urgent: true }
  const diff = new Date(m.last_done).getTime() + m.interval_days * 86_400_000 - Date.now()
  if (diff < 0)               return { label: `${Math.ceil(-diff / 86_400_000)}d overdue`, color: 'var(--red)',    urgent: true  }
  if (diff < 3 * 86_400_000) return { label: `Due in ${Math.ceil(diff / 86_400_000)}d`,   color: 'var(--orange)', urgent: true  }
  return                              { label: `Due in ${Math.ceil(diff / 86_400_000)}d`,   color: 'var(--green)',  urgent: false }
}

// ─── Sheet ────────────────────────────────────────────────────────────────────
export function Sheet({ title, onClose, onSave, saveLabel = 'Save', children }) {
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const overlayRef = useRef(null)

  const handleSave = useCallback(async () => {
    if (savingRef.current || !onSave) return
    savingRef.current = true
    setSaving(true)
    try { await onSave() }
    finally { savingRef.current = false; setSaving(false) }
  }, [onSave])

  // Close on Escape, save on Enter
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Escape' && !savingRef.current) onClose()
      if (e.key === 'Enter' && onSave && !savingRef.current && document.activeElement?.tagName !== 'TEXTAREA') handleSave()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, handleSave])

  // Lock background scroll when sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // iOS keyboard: resize overlay to visual viewport
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const el = overlayRef.current
      if (!el) return
      el.style.height = vv.height + 'px'
      el.style.top = vv.offsetTop + 'px'
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return createPortal(
    <div
      ref={overlayRef}
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={e => { if (e.target === e.currentTarget) e.currentTarget._shouldClose = true }}
      onMouseUp={e => { if (e.currentTarget._shouldClose && e.target === e.currentTarget && !saving) { onClose(); } e.currentTarget._shouldClose = false }}
      onClick={e => e.stopPropagation()}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose} disabled={saving}>Cancel</button>
          <span className="sheet-title">{title}</span>
          {onSave
            ? <button className="sheet-save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : saveLabel}</button>
            : <span style={{ width: 40 }} />
          }
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

// ─── FormCell ─────────────────────────────────────────────────────────────────
export function FormCell({ label, last, children }) {
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
    if (lines.length) return onSave(lines)
  }
  return (
    <Sheet title={title} onClose={onClose} onSave={handleSave} saveLabel="Add">
      <textarea
        ref={ref}
        className="form-textarea"
        style={{ width: '100%', minHeight: 140 }}
        placeholder={hint + '\n...'}
        autoFocus
      />
      <p className="form-hint">One item per line — all added at once.</p>
    </Sheet>
  )
}

// ─── ConfirmSheet — replaces window.confirm ───────────────────────────────────
export function ConfirmSheet({ message, confirmLabel = 'Delete', onConfirm, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Enter') onConfirm() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onConfirm])

  return (
    <Sheet title="Confirm" onClose={onClose} onSave={null}>
      <div className="confirm-body">
        <p className="confirm-msg">{message}</p>
        <div className="confirm-actions">
          <button className="btn-danger" onClick={onConfirm}>{confirmLabel}</button>
          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Sheet>
  )
}

// ─── TagInput ─────────────────────────────────────────────────────────────────
const PRESETS = ['finished', 'portfolio', 'inspiration', 'progress', 'before', 'after', 'refinished']

export function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')

  const addTag = useCallback(() => {
    const t = input.trim().toLowerCase()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }, [input, tags, onChange])

  const togglePreset = (p) => {
    onChange(tags.includes(p) ? tags.filter(t => t !== p) : [...tags, p])
  }

  return (
    <div>
      <div className="tag-wrap" onClick={e => e.currentTarget.querySelector('input')?.focus()}>
        {tags.map(t => (
          <span key={t} className="tag-pill">
            {t}
            <button
              onClick={() => onChange(tags.filter(x => x !== t))}
              aria-label={`Remove tag ${t}`}
            >
              <IClose size={10} color="currentColor" sw={2.5} />
            </button>
          </span>
        ))}
        <input
          className="tag-input-field"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? 'Add tags…' : ''}
          aria-label="Add tag"
        />
      </div>
      <div className="tag-preset-row">
        {PRESETS.map(p => (
          <button
            key={p}
            className={`tag-preset ${tags.includes(p) ? 'on' : ''}`}
            onClick={() => togglePreset(p)}
            aria-pressed={tags.includes(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="form-hint" style={{ marginTop: 6 }}>
        Tag "finished" → Finished Work gallery. Tag "portfolio" → Public portfolio. Tag "inspiration" → Inspiration gallery.
      </p>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
export function Lightbox({ photos, index, onClose }) {
  const [cur, setCur]           = useState(index)
  const [scale, setScale]       = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan]           = useState({ x: 0, y: 0 })
  const containerRef   = useRef()
  const lastDist       = useRef(null)
  const lastMid        = useRef(null)
  const dragStart      = useRef(null)
  const panStart       = useRef(null)
  const swipeStartX    = useRef(null)

  const reset = () => { setScale(1); setPan({ x: 0, y: 0 }) }
  useEffect(() => { reset(); setRotation(0) }, [cur])

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
  const onMouseMove = e => { if (!dragStart.current) return; setPan({ x: panStart.current.x + e.clientX - dragStart.current.x, y: panStart.current.y + e.clientY - dragStart.current.y }) }
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
      if (e.touches.length === 2 && lastDist.current) {
        e.preventDefault()
        const dx   = e.touches[0].clientX - e.touches[1].clientX
        const dy   = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        setScale(s => Math.max(1, Math.min(10, s * (dist / lastDist.current))))
        const mid = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
        if (lastMid.current) setPan(p => ({ x: p.x + mid.x - lastMid.current.x, y: p.y + mid.y - lastMid.current.y }))
        lastDist.current = dist
        lastMid.current  = mid
      } else if (e.touches.length === 1 && dragStart.current) {
        setScale(s => {
          if (s <= 1) return s
          e.preventDefault()
          setPan({ x: panStart.current.x + e.touches[0].clientX - dragStart.current.x, y: panStart.current.y + e.touches[0].clientY - dragStart.current.y })
          return s
        })
      }
    }

    const onTouchEnd = e => {
      if (e.touches.length < 2) { lastDist.current = null; lastMid.current = null }
      if (swipeStartX.current !== null && e.changedTouches.length > 0) {
        const diff = swipeStartX.current - e.changedTouches[0].clientX
        setScale(s => {
          if (s === 1) {
            if (diff > 60)  setCur(i => Math.min(i + 1, photos.length - 1))
            if (diff < -60) setCur(i => Math.max(i - 1, 0))
          }
          return s
        })
      }
      swipeStartX.current = null
      dragStart.current   = null
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
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8 }}>
        {scale > 1 && (
          <button onClick={e => { e.stopPropagation(); reset() }}
            style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: 13, fontFamily: 'inherit' }}>
            Reset
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
        <button aria-label="Close" onClick={onClose}
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IClose size={18} color="#fff" sw={2.5} />
        </button>
      </div>
    </div>,
    document.body
  )
}

// ─── PhotoGrid ────────────────────────────────────────────────────────────────
export function PhotoGrid({ photos, onEdit, showProject, projects, onNavigateProject }) {
  const [lightboxIdx, setLightboxIdx] = useState(null)

  if (!photos.length) return null

  return (
    <>
      <div className="photo-grid">
        {photos.map((photo, i) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            tileIndex={i}
            onEdit={onEdit}
            showProject={showProject}
            projects={projects}
            onOpen={() => setLightboxIdx(i)}
            onNavigateProject={onNavigateProject}
          />
        ))}
      </div>
      {lightboxIdx !== null && (
        <Lightbox photos={photos} index={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </>
  )
}

// ─── PhotoCard ────────────────────────────────────────────────────────────────
export function PhotoCard({ photo, onEdit, onOpen, showProject, projects, tileIndex = 0, onNavigateProject }) {
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
      style={{ animationDelay: `${Math.min(tileIndex * 35, 400)}ms`, animation: 'photoEnter 380ms cubic-bezier(.34,1.1,.64,1) both', transition: 'transform 200ms cubic-bezier(.25,.46,.45,.94), box-shadow 200ms ease' }}
    >
      {!err ? (
        <img
          src={photo.url}
          alt={photo.caption || 'Workshop photo'}
          loading="lazy"
          onError={() => setErr(true)}
          onClick={onOpen}
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

      {showEdit && (
        <PhotoEditSheet
          photo={photo}
          onSave={async fields => { await onEdit(photo.id, fields); setShowEdit(false) }}
          onDelete={onEdit ? async () => { await onEdit(photo.id, { _delete: true }); setShowEdit(false) } : null}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}

// ─── PhotoEditSheet ───────────────────────────────────────────────────────────
function PhotoEditSheet({ photo, onSave, onDelete, onClose }) {
  const [caption, setCaption] = useState(photo.caption || '')
  const [tags, setTags]       = useState(photo.tags ? photo.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
  const [confirm, setConfirm] = useState(false)

  if (confirm) return (
    <ConfirmSheet
      message={`Delete this photo? This cannot be undone.`}
      onConfirm={onDelete}
      onClose={() => setConfirm(false)}
    />
  )

  return (
    <Sheet title="Edit Photo" onClose={onClose} onSave={() => onSave({ caption, tags: tags.join(',') })}>
      <div className="form-group">
        <FormCell label="Caption" last>
          <input
            className="form-input"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Optional"
            autoFocus
          />
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Tags</p>
      <TagInput tags={tags} onChange={setTags} />
      {onDelete && (
        <button className="btn-danger" onClick={() => setConfirm(true)} style={{ marginTop: 20 }}>
          Delete Photo
        </button>
      )}
    </Sheet>
  )
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

// ─── FilterSelect — consistent native dropdown filter ────────────────────────
export function FilterSelect({ value, onChange, options, allLabel = 'All', label }) {
  const isActive = value !== 'all'
  return (
    <div className="filter-select-wrap" aria-label={label}>
      <select
        className={`filter-select${isActive ? ' active' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="all">{allLabel}</option>
        {options.map(o => {
          const val = typeof o === 'string' ? o : o.value
          const lbl = typeof o === 'string' ? o : o.label
          return <option key={val} value={val}>{lbl}</option>
        })}
      </select>
      <span className="filter-select-chevron" aria-hidden="true">▾</span>
    </div>
  )
}


// ─── Long-press hook (600ms → callback) ──────────────────────────────────────
export function useLongPress(onLongPress, ms = 600) {
  const timerRef = useRef(null)
  const start = useCallback((e) => {
    // prevent context menu on long press
    e.preventDefault()
    timerRef.current = setTimeout(() => onLongPress(), ms)
  }, [onLongPress, ms])
  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
  }, [])
  return {
    onPointerDown:   start,
    onPointerUp:     cancel,
    onPointerLeave:  cancel,
    onPointerCancel: cancel,
  }
}


// ─── Before / After swipe comparison ─────────────────────────────────────────
export function BeforeAfterCompare({ beforeUrl, afterUrl, label }) {
  const [split, setSplit] = useState(50)
  const containerRef = useRef()

  const move = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setSplit(pct)
  }, [])

  const onMouseMove = e => { if (e.buttons === 1) move(e.clientX) }
  const onTouchMove = e => {
    e.preventDefault()
    move(e.touches[0].clientX)
  }

  return (
    <div ref={containerRef}
      style={{ position:'relative', width:'100%', aspectRatio:'4/3', overflow:'hidden', borderRadius:'var(--r-md)', userSelect:'none', touchAction:'none', cursor:'ew-resize' }}
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      onTouchStart={e => move(e.touches[0].clientX)}
    >
      {/* After (full width, base layer) */}
      <img src={afterUrl} alt="After" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none' }} />
      {/* Before (clipped to split%) */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', width: split + '%' }}>
        <img src={beforeUrl} alt="Before" style={{ position:'absolute', inset:0, width: containerRef.current?.getBoundingClientRect().width + 'px' || '100%', height:'100%', objectFit:'cover', maxWidth:'none', pointerEvents:'none' }} />
      </div>
      {/* Divider */}
      <div style={{ position:'absolute', top:0, bottom:0, left: split + '%', transform:'translateX(-50%)', width:3, background:'#fff', boxShadow:'0 0 6px rgba(0,0,0,.5)', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:32, height:32, borderRadius:'50%', background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,.3)', display:'flex', alignItems:'center', justifyContent:'center', gap:2 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l-6-6 6-6"/><path d="M15 6l6 6-6 6"/></svg>
        </div>
      </div>
      {/* Labels */}
      <span style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,.6)', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>BEFORE</span>
      <span style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.6)', color:'#fff', fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:99 }}>AFTER</span>
      {label && <div style={{ position:'absolute', bottom:8, left:0, right:0, textAlign:'center', color:'#fff', fontSize:12, fontWeight:600, textShadow:'0 1px 4px rgba(0,0,0,.6)' }}>{label}</div>}
    </div>
  )
}


// ─── Count-up number animation ───────────────────────────────────────────────
export function useCountUp(target, duration = 1200, enabled = true) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!enabled || !target) { setVal(target); return }
    let start = null
    const step = ts => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])
  return val
}

// ─── Kinetic title — letter-by-letter stagger ────────────────────────────────
export function KineticTitle({ text, className, style, tag: Tag = 'h1', delay = 0 }) {
  return (
    <Tag className={className} style={{ ...style, overflow: 'hidden' }}>
      {text.split('').map((ch, i) => (
        <span key={i} style={{
          display: 'inline-block',
          animation: `letterIn 400ms cubic-bezier(.34,1.56,.64,1) both`,
          animationDelay: `${delay + i * 35}ms`,
          whiteSpace: ch === ' ' ? 'pre' : undefined,
        }}>{ch}</span>
      ))}
    </Tag>
  )
}

export function DropZone({ onFiles, uploading }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  return (
    <div
      className={`drop-zone ${drag ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files) }}
      onClick={() => ref.current?.click()}
      role="button"
      aria-label="Upload photos"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && ref.current?.click()}
    >
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => onFiles(e.target.files)}
      />
      <div className="drop-zone-icon">{uploading ? '⏳' : '📁'}</div>
      <p>{uploading ? 'Uploading…' : 'Drop photos here or click to select — JPEG, PNG, HEIC'}</p>
    </div>
  )
}
