import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { IClose, ISearch, IChevR, IChevL } from './Icons.jsx'
import { createPortal } from 'react-dom'

// ─── Sheet ────────────────────────────────────────────────────────────────────
export function Sheet({ title, onClose, onSave, saveLabel = 'Save', children }) {
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const overlayRef = useRef()

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

  // iOS keyboard: resize overlay to match visual viewport so sheet stays above keyboard
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      if (!overlayRef.current) return
      overlayRef.current.style.height = vv.height + 'px'
      overlayRef.current.style.top = vv.offsetTop + 'px'
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // iOS keyboard: scroll focused input into view inside sheet-body
  useEffect(() => {
    const handleFocus = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setTimeout(() => {
          if (document.activeElement === e.target) {
            e.target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
          }
        }, 350)
      }
    }
    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
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
