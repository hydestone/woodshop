import { useState, useRef, useEffect, useCallback } from 'react'
import { useCtx } from '../App.jsx'

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  )
}

export default function GlobalSearch() {
  const { data, setTab, setProjId } = useCtx()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef()
  const containerRef = useRef()

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const results = useCallback(() => {
    if (!query.trim() || query.length < 2) return []
    const q = query.toLowerCase()
    const hits = []

    // Projects
    data.projects.forEach(p => {
      if ([p.name, p.wood_type, p.description, p.dimensions_rough, p.dimensions_final].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Project', title: p.name, sub: p.wood_type || p.status, action: () => { setProjId(p.id); setTab('projects') } })
      }
    })

    // Steps
    data.steps.forEach(s => {
      if ([s.title, s.note].some(f => f?.toLowerCase().includes(q))) {
        const proj = data.projects.find(p => p.id === s.project_id)
        hits.push({ type: 'Step', title: s.title, sub: proj?.name || '', action: () => { setProjId(s.project_id); setTab('projects') } })
      }
    })

    // Shopping
    data.shopping.forEach(s => {
      if ([s.name, s.store, s.notes].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Shopping', title: s.name, sub: s.store || s.notes || '', action: () => setTab('shopping') })
      }
    })

    // Maintenance
    data.maintenance.forEach(m => {
      if ([m.name, m.category, m.notes].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Maintenance', title: m.name, sub: m.category || '', action: () => setTab('maintenance') })
      }
    })

    // Wood stock
    data.woodStock.forEach(s => {
      if ([s.species, s.location, s.intended_use, s.notes].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Wood Stock', title: s.species, sub: s.location || s.status || '', action: () => setTab('stock') })
      }
    })

    // Finishes
    data.finishProducts.forEach(p => {
      if ([p.name, p.manufacturer, p.notes, p.feedback].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Finish', title: p.name, sub: p.manufacturer || p.category || '', action: () => setTab('finishes') })
      }
    })

    // Resources
    data.resources.forEach(r => {
      if ([r.title, r.url, r.notes, r.category].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Resource', title: r.title, sub: r.category || '', action: () => setTab('resources') })
      }
    })

    // Brainstorm
    data.brainstorming.forEach(b => {
      if (b.content?.toLowerCase().includes(q)) {
        hits.push({ type: 'Brainstorm', title: b.content.slice(0, 60) + (b.content.length > 60 ? '…' : ''), sub: '', action: () => setTab('brainstorm') })
      }
    })

    // Shop improvements
    data.shopImprovements.forEach(s => {
      if ([s.title, s.notes, s.category].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Shop', title: s.title, sub: s.category || '', action: () => setTab('shop') })
      }
    })

    // Photos (caption + tags)
    data.photos.forEach(p => {
      if ([p.caption, p.tags].some(f => f?.toLowerCase().includes(q))) {
        hits.push({ type: 'Photo', title: p.caption || p.tags || 'Photo', sub: p.photo_type || '', action: () => setTab('photos') })
      }
    })

    return hits.slice(0, 20)
  }, [query, data, setTab, setProjId])

  const hits = results()

  const handleSelect = (hit) => {
    hit.action()
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const TYPE_COLOR = {
    'Project': '#2563EB', 'Step': '#7C3AED', 'Shopping': '#D97706',
    'Maintenance': '#DC2626', 'Wood Stock': '#16A34A', 'Finish': '#0891B2',
    'Resource': '#6366F1', 'Brainstorm': '#EC4899', 'Shop': '#F59E0B', 'Photo': '#64748B'
  }

  return (
    <div ref={containerRef} className="top-bar-search">
      <span className="top-bar-search-icon"><SearchIcon /></span>
      <input
        ref={inputRef}
        type="search"
        placeholder="Search everything…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setQuery('') } }}
        autoComplete="off"
      />
      {open && query.length >= 2 && (
        <div className="search-results">
          {hits.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              No results for "{query}"
            </div>
          ) : (
            hits.map((hit, i) => (
              <div key={i} className="search-result-item" onClick={() => handleSelect(hit)}>
                <span className="search-result-type" style={{ color: TYPE_COLOR[hit.type] || 'var(--text4)' }}>{hit.type}</span>
                <span className="search-result-title">{hit.title}</span>
                {hit.sub && <span className="search-result-sub">{hit.sub}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
