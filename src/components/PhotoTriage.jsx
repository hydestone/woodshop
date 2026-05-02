/**
 * PhotoTriage.jsx — Sort unsorted photos into projects
 * 
 * Mobile: Swipe card stack — photo fills screen, project pills at bottom
 * Desktop: Split view — unsorted grid left, project folders right, drag to assign
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import { photoUrl } from '../supabase.js'
import * as db from '../db.js'
import { IChevL, ICheck, IFolder } from '../components/Shared.jsx'

// ─── Swipe Card (Mobile) ─────────────────────────────────────────────────────
function SwipeCard({ photo, onAssign, onSkip, projects }) {
  const cardRef = useRef()
  const startRef = useRef(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [swiping, setSwiping] = useState(false)
  const [exiting, setExiting] = useState(null) // 'left' | 'right' | null

  const onTouchStart = e => {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
    setSwiping(true)
  }
  const onTouchMove = e => {
    if (!startRef.current) return
    const dx = e.touches[0].clientX - startRef.current.x
    const dy = e.touches[0].clientY - startRef.current.y
    setOffset({ x: dx, y: dy * 0.3 })
  }
  const onTouchEnd = () => {
    if (!startRef.current) return
    setSwiping(false)
    if (Math.abs(offset.x) > 100) {
      setExiting(offset.x > 0 ? 'right' : 'left')
      setTimeout(() => onSkip(), 300)
    } else {
      setOffset({ x: 0, y: 0 })
    }
    startRef.current = null
  }

  const rotation = offset.x * 0.05
  const opacity = 1 - Math.min(Math.abs(offset.x) / 300, 0.5)

  if (exiting) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        transition: 'transform 300ms ease, opacity 300ms ease',
        transform: `translateX(${exiting === 'right' ? '120%' : '-120%'}) rotate(${exiting === 'right' ? 15 : -15}deg)`,
        opacity: 0,
      }}>
        <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 16 }} />
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'absolute', inset: 16,
        transform: `translateX(${offset.x}px) translateY(${offset.y}px) rotate(${rotation}deg)`,
        transition: swiping ? 'none' : 'transform 300ms ease',
        touchAction: 'none',
        cursor: 'grab',
      }}
    >
      <img
        src={photo.url}
        alt={photo.caption || ''}
        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 16, pointerEvents: 'none' }}
        draggable={false}
      />
      {/* Swipe hint overlays */}
      {offset.x > 40 && (
        <div style={{
          position: 'absolute', top: 20, left: 20,
          background: 'rgba(16,185,129,.8)', color: '#fff',
          padding: '8px 16px', borderRadius: 8, fontSize: 16, fontWeight: 700,
          opacity: Math.min((offset.x - 40) / 60, 1),
        }}>SKIP →</div>
      )}
      {offset.x < -40 && (
        <div style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(239,68,68,.8)', color: '#fff',
          padding: '8px 16px', borderRadius: 8, fontSize: 16, fontWeight: 700,
          opacity: Math.min((-offset.x - 40) / 60, 1),
        }}>← SKIP</div>
      )}
    </div>
  )
}

// ─── Mobile Triage View ──────────────────────────────────────────────────────
function MobileTriage({ photos, projects, onAssign, onSkip, onClose }) {
  const [idx, setIdx] = useState(0)
  const photo = photos[idx]

  const assign = (projId) => {
    onAssign(photo.id, projId)
    if (idx < photos.length - 1) setIdx(i => i + 1)
    else onClose()
  }

  const skip = () => {
    if (idx < photos.length - 1) setIdx(i => i + 1)
    else onClose()
  }

  if (!photo) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <ICheck size={48} color="var(--green)" sw={2} />
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text)' }}>All sorted!</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No unsorted photos remaining.</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', flexShrink: 0 }}>
        <button className="back-btn" onClick={onClose}>
          <IChevL size={16} color="currentColor" sw={2.2} /> Back
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>
          {idx + 1} of {photos.length}
        </span>
        <button className="btn-text" onClick={skip} style={{ fontSize: 13 }}>Skip →</button>
      </div>

      {/* Photo card area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <SwipeCard key={photo.id} photo={photo} onSkip={skip} projects={projects} onAssign={assign} />
      </div>

      {/* Project pills */}
      <div style={{ flexShrink: 0, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Assign to project
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
          {projects.map(p => (
            <button key={p.id} onClick={() => assign(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 99,
              border: '1px solid var(--border)', background: 'var(--surface)',
              fontSize: 13, fontWeight: 500, color: 'var(--text)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 120ms',
            }}>
              <IFolder size={14} color="var(--accent)" sw={1.8} />
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Desktop Triage View ─────────────────────────────────────────────────────
function DesktopTriage({ photos, projects, onAssign, onClose }) {
  const [selected, setSelected] = useState(new Set())
  const [draggedOver, setDraggedOver] = useState(null)
  const [dragData, setDragData] = useState(null)

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onDragStart = (e, photoId) => {
    const ids = selected.has(photoId) ? [...selected] : [photoId]
    setDragData(ids)
    e.dataTransfer.setData('text/plain', JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDrop = (e, projId) => {
    e.preventDefault()
    setDraggedOver(null)
    const ids = dragData || []
    ids.forEach(id => onAssign(id, projId))
    setSelected(new Set())
    setDragData(null)
  }

  const bulkAssign = (projId) => {
    selected.forEach(id => onAssign(id, projId))
    setSelected(new Set())
  }

  if (photos.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
        <ICheck size={48} color="var(--green)" sw={2} />
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text)' }}>All sorted!</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No unsorted photos remaining.</p>
        <button className="btn-primary" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button className="back-btn" onClick={onClose}>
          <IChevL size={16} color="currentColor" sw={2.2} /> Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {photos.length} unsorted photo{photos.length !== 1 ? 's' : ''}
        </span>
        {selected.size > 0 && (
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
            {selected.size} selected
          </span>
        )}
      </div>

      {/* Bulk assign bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          background: 'var(--accent-dim)', borderBottom: '1px solid var(--border)',
          flexShrink: 0, overflowX: 'auto',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', marginRight: 4 }}>
            Assign {selected.size} to:
          </span>
          {projects.slice(0, 8).map(p => (
            <button key={p.id} onClick={() => bulkAssign(p.id)} style={{
              padding: '6px 12px', borderRadius: 99,
              border: '1px solid var(--accent)', background: 'var(--surface)',
              fontSize: 12, fontWeight: 600, color: 'var(--accent)',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{p.name}</button>
          ))}
        </div>
      )}

      {/* Split view */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left — unsorted photos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 8,
          }}>
            {photos.map(photo => (
              <div
                key={photo.id}
                draggable
                onDragStart={e => onDragStart(e, photo.id)}
                onClick={() => toggleSelect(photo.id)}
                style={{
                  position: 'relative', aspectRatio: '1/1',
                  borderRadius: 10, overflow: 'hidden', cursor: 'grab',
                  border: selected.has(photo.id) ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'border-color 120ms, transform 120ms',
                  transform: selected.has(photo.id) ? 'scale(0.95)' : 'scale(1)',
                }}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  draggable={false}
                />
                {selected.has(photo.id) && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--accent)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ICheck size={14} color="#fff" sw={2.5} />
                  </div>
                )}
                {/* Unsorted dot */}
                <div style={{
                  position: 'absolute', bottom: 6, left: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--orange)',
                  boxShadow: '0 0 0 2px rgba(0,0,0,.3)',
                }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right — project folders */}
        <div style={{
          width: 260, flexShrink: 0, overflowY: 'auto',
          borderLeft: '1px solid var(--border)', padding: 12,
          background: 'var(--fill)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Drop onto project
          </div>
          {projects.map(p => {
            const isOver = draggedOver === p.id
            return (
              <div
                key={p.id}
                onDragOver={e => { e.preventDefault(); setDraggedOver(p.id) }}
                onDragLeave={() => setDraggedOver(null)}
                onDrop={e => onDrop(e, p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', marginBottom: 4,
                  borderRadius: 10,
                  border: isOver ? '2px solid var(--accent)' : '2px solid transparent',
                  background: isOver ? 'var(--accent-dim)' : 'var(--surface)',
                  transition: 'all 150ms',
                  cursor: 'default',
                }}
              >
                {p._thumb ? (
                  <img src={p._thumb} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IFolder size={16} color="var(--text-3)" sw={1.5} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{p.status}</div>
                </div>
                {isOver && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>DROP</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main PhotoTriage Component ──────────────────────────────────────────────
export default function PhotoTriage({ onClose }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const unsorted = useMemo(() =>
    data.photos
      .filter(p => p.photo_type === 'unsorted')
      .map(p => ({ ...p, url: p.url || photoUrl(p.storage_path) }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [data.photos]
  )

  const projects = useMemo(() => {
    const active = data.projects
      .filter(p => p.status !== 'complete')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Add thumbnail for desktop folder view
    return active.map(p => {
      const photo = data.photos.find(ph => ph.project_id === p.id)
      return { ...p, _thumb: photo ? (photo.url || photoUrl(photo.storage_path)) : null }
    })
  }, [data.projects, data.photos])

  const assign = useCallback(async (photoId, projectId) => {
    // Optimistic update
    mutate(d => ({
      ...d,
      photos: d.photos.map(p =>
        p.id === photoId ? { ...p, project_id: projectId, photo_type: 'progress' } : p
      )
    }))
    try {
      await db.updatePhoto(photoId, { project_id: projectId, photo_type: 'progress' })
    } catch (e) {
      toast('Failed to assign: ' + e.message, 'error')
      // Rollback
      mutate(d => ({
        ...d,
        photos: d.photos.map(p =>
          p.id === photoId ? { ...p, project_id: null, photo_type: 'unsorted' } : p
        )
      }))
    }
  }, [mutate, toast])

  const skip = useCallback(() => {}, [])

  if (isMobile) {
    return <MobileTriage photos={unsorted} projects={projects} onAssign={assign} onSkip={skip} onClose={onClose} />
  }
  return <DesktopTriage photos={unsorted} projects={projects} onAssign={assign} onClose={onClose} />
}
