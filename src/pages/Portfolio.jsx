import { useEffect, useState, useRef } from 'react'
import { supabase, BUCKET, photoUrl } from '../supabase.js'

// ── Ron Swanson splash screen ──────────────────────────────────────────────────
function RonSplash({ onDone }) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 4600)
    const doneTimer = setTimeout(() => onDone(), 5200)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0F1E38',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 600ms ease',
      opacity: fade ? 0 : 1,
      pointerEvents: fade ? 'none' : 'all',
    }}>
      <style>{`
        @keyframes ronFadeIn { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
        @keyframes quoteUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
      <img
        src="/ronswanson.webp"
        alt="Ron Swanson"
        style={{
          width: 180, height: 180, objectFit: 'cover', objectPosition: 'top',
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,.15)',
          animation: 'ronFadeIn .5s ease forwards',
          marginBottom: 28,
          boxShadow: '0 8px 40px rgba(0,0,0,.5)',
        }}
      />
      <p style={{
        color: '#BFDBFE',
        fontSize: 13, fontWeight: 700,
        letterSpacing: 3,
        textTransform: 'uppercase',
        marginBottom: 12,
        animation: 'quoteUp .5s .2s ease both',
      }}>
        Welcome
      </p>
      <p style={{
        color: '#fff',
        fontSize: 20, fontWeight: 700,
        maxWidth: 320, textAlign: 'center',
        lineHeight: 1.4,
        animation: 'quoteUp .5s .35s ease both',
        padding: '0 24px',
      }}>
        "Give a man a fish and feed him for a day. Don't teach a man to fish and feed yourself. He's a grown man. Fishing's not that hard."
      </p>
      <p style={{
        color: 'rgba(255,255,255,.3)',
        fontSize: 12, marginTop: 16,
        animation: 'quoteUp .5s .5s ease both',
      }}>— Ron Swanson</p>
    </div>
  )
}

// ── Full-featured lightbox with swipe + pinch zoom ────────────────────────────
function Lightbox({ photos, projects, idx, onClose, onNav }) {
  const photo = photos[idx]
  const proj = projects.find(p => p.id === photo?.project_id)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const touchStart = useRef(null)
  const lastDist = useRef(null)
  const isDragging = useRef(false)
  const dragStart = useRef(null)

  // Keyboard navigation
  useEffect(() => {
    const handler = e => {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Escape')     onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [idx])

  // Reset zoom when photo changes
  useEffect(() => { setScale(1); setOffset({ x: 0, y: 0 }) }, [idx])

  const goPrev = () => { if (idx > 0) onNav(idx - 1) }
  const goNext = () => { if (idx < photos.length - 1) onNav(idx + 1) }

  const getTouchDist = touches =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

  const handleTouchStart = e => {
    if (e.touches.length === 2) {
      lastDist.current = getTouchDist(e.touches)
    } else if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, ox: offset.x, oy: offset.y }
      isDragging.current = false
    }
  }

  const handleTouchMove = e => {
    e.preventDefault()
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches)
      if (lastDist.current) {
        const delta = dist / lastDist.current
        setScale(s => Math.min(5, Math.max(1, s * delta)))
      }
      lastDist.current = dist
    } else if (e.touches.length === 1 && dragStart.current && scale > 1) {
      isDragging.current = true
      const dx = e.touches[0].clientX - dragStart.current.x
      const dy = e.touches[0].clientY - dragStart.current.y
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
    }
  }

  const handleTouchEnd = e => {
    lastDist.current = null
    if (!isDragging.current && touchStart.current && scale === 1) {
      const dx = e.changedTouches[0].clientX - touchStart.current.x
      const dt = Date.now() - touchStart.current.t
      if (Math.abs(dx) > 50 && dt < 400) {
        if (dx < 0) goNext(); else goPrev()
      }
    }
    isDragging.current = false
    touchStart.current = null
    dragStart.current = null
  }

  const handleDoubleTap = () => {
    if (scale > 1) { setScale(1); setOffset({ x: 0, y: 0 }) }
    else setScale(2.5)
  }

  if (!photo) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.95)', zIndex: 2000, display: 'flex', flexDirection: 'column', userSelect: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', zIndex: 10 }}>
        <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>{idx + 1} / {photos.length}</span>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>

      {/* Image */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <img
          src={photo.url}
          alt={photo.caption || ''}
          onDoubleClick={handleDoubleTap}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transition: scale === 1 ? 'transform 200ms ease' : 'none',
            touchAction: 'none',
            cursor: scale > 1 ? 'grab' : 'default',
          }}
        />
        {/* Desktop prev/next arrows */}
        {idx > 0 && (
          <button onClick={goPrev} style={{ position: 'absolute', left: 12, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        )}
        {idx < photos.length - 1 && (
          <button onClick={goNext} style={{ position: 'absolute', right: 12, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        )}
      </div>

      {/* Caption */}
      {(photo.caption || proj) && (
        <div style={{ padding: '12px 20px 24px', textAlign: 'center' }}>
          {photo.caption && <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{photo.caption}</div>}
          {proj && <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginTop: 4 }}>
            {[proj.wood_type, proj.year_completed, proj.finish_used].filter(Boolean).join(' · ')}
          </div>}
        </div>
      )}
    </div>
  )
}

// Category sort priority — Bowls first, then Spoons, Kitchen Utensils, then others
const CAT_PRIORITY = ['Bowls', 'Spoons', 'Kitchen Utensils', 'Furniture', 'Turning', 'Carving', 'Boxes', 'Signs', 'Other']

function catPriority(cat) {
  const idx = CAT_PRIORITY.indexOf(cat)
  return idx >= 0 ? idx : CAT_PRIORITY.length
}

export default function Portfolio() {
  const [photos, setPhotos]           = useState([])
  const [projects, setProjects]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [showSplash, setShowSplash]   = useState(true)
  const [activeFilter, setActiveFilter] = useState('All')

  useEffect(() => {
    Promise.all([
      supabase.from('photos').select('*').ilike('tags','%portfolio%').order('created_at',{ascending:false}),
      supabase.from('projects').select('*'),
    ]).then(([ph, pr]) => {
      setPhotos((ph.data||[]).map(p => ({ ...p, url: photoUrl(p.storage_path) })))
      setProjects(pr.data||[])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const projFor = id => projects.find(p => p.id === id)

  // Build category list from actual project categories, sorted by priority
  const usedCats = [...new Set(
    photos.map(p => projFor(p.project_id)?.category).filter(Boolean)
  )].sort((a, b) => catPriority(a) - catPriority(b))

  // Filter then sort photos by project category priority
  const filtered = (activeFilter === 'All' ? photos : photos.filter(p => projFor(p.project_id)?.category === activeFilter))
    .slice()
    .sort((a, b) => {
      const ca = projFor(a.project_id)?.category || ''
      const cb = projFor(b.project_id)?.category || ''
      return catPriority(ca) - catPriority(cb)
    })

  return (
    <>
      {showSplash && <RonSplash onDone={() => setShowSplash(false)} />}

      {/* Back to Workshop — only visible in PWA standalone mode (CSS handles show/hide) */}
      <button
        className="portfolio-back-btn"
        onClick={() => window.location.href = '/'}
        aria-label="Back to Workshop"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Workshop
      </button>

      <div style={{
        minHeight: '100vh', background: '#F0F4F8',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif',
        opacity: showSplash ? 0 : 1,
        transition: 'opacity 400ms ease',
      }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{ background: '#0F1E38', padding: '48px 24px 32px', textAlign: 'center' }}>
          <img
            src="/New_Logo.png" alt="JDH WOODWORKS"
            style={{ width: 80, height: 80, objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 16 }}
          />
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: '#BFDBFE', textTransform: 'uppercase', marginBottom: 10 }}>
            Handcrafted in Sherborn, MA
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
            JDH <span style={{ color: '#4ADE80' }}>WOODWORKS</span>
          </h1>
          <p style={{ color: '#8BA8D0', marginTop: 10, fontSize: 15 }}>
            Bowls · Spoons · Furniture · Turning · Hand Tools
          </p>
          <div style={{ marginTop: 12, fontSize: 13, color: '#475569' }}>
            {photos.length} finished piece{photos.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Category filter tabs */}
        {usedCats.length > 0 && (
          <div style={{ background: '#0F1E38', paddingBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '0 20px' }}>
              {['All', ...usedCats].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  style={{
                    padding: '6px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    background: activeFilter === cat ? '#fff' : 'rgba(255,255,255,.1)',
                    color: activeFilter === cat ? '#0F1E38' : 'rgba(255,255,255,.7)',
                    transition: 'all 150ms ease',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#64748B' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #0F1E38', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#64748B' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🪵</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>
              {photos.length === 0 ? 'No pieces yet' : `No ${activeFilter} pieces`}
            </div>
            <p>{photos.length === 0 ? 'Tag photos "portfolio" in JDH Woodworks to populate this page.' : 'Try a different filter above.'}</p>
          </div>
        ) : (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ columns: '280px', columnGap: 16 }}>
              {filtered.map(photo => {
                const proj = projFor(photo.project_id)
                return (
                  <div
                    key={photo.id}
                    style={{ breakInside: 'avoid', marginBottom: 16, background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)', cursor: 'pointer' }}
                    onClick={() => setLightboxIdx(filtered.indexOf(photo))}
                  >
                    <img src={photo.url} alt={photo.caption || proj?.name || 'Finished piece'} loading="lazy" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                    {(photo.caption || proj) && (
                      <div style={{ padding: '12px 14px' }}>
                        {photo.caption && <div style={{ fontWeight: 500, fontSize: 14, color: '#0F172A' }}>{photo.caption}</div>}
                        {proj && (
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            {[proj.wood_type, proj.year_completed, proj.finish_used].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ background: '#0F1E38', padding: '24px', textAlign: 'center', marginTop: 32 }}>
          <img src="/New_Logo.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)', marginBottom: 8, opacity: 0.5, display: 'block', margin: '0 auto 8px' }} />
          <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>JDH WOODWORKS · All pieces handcrafted in Sherborn, MA</p>
        </div>

        {/* Lightbox */}
        {lightboxIdx !== null && (
          <Lightbox
            photos={photos}
            projects={projects}
            idx={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
            onNav={setLightboxIdx}
          />
        )}
      </div>
    </>
  )
}
