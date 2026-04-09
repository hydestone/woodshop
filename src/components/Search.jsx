import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { ISearch } from './Shared.jsx'

const TYPE_COLOR = {
  Project:     '#C97B12',
  Step:        '#7C3AED',
  Shopping:    '#D97706',
  Maintenance: '#B83232',
  'Wood Stock':'#2A7A4A',
  Finish:      '#0369A1',
  Resource:    '#4F46E5',
  Brainstorm:  '#DB2777',
  Shop:        '#D97706',
  Photo:       '#6B7280',
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch() {
  const { data, setTab, navigate } = useCtx()
  const [query, setQuery]           = useState('')
  const [open, setOpen]             = useState(false)
  const [cursor, setCursor]         = useState(-1)
  const [focused, setFocused]       = useState(false)
  const inputRef    = useRef()
  const containerRef = useRef()
  const debounced   = useDebounce(query, 160)

  // Close on outside click
  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase()
    if (q.length < 2) return []
    const hits = []

    const match = (...fields) => fields.some(f => f?.toLowerCase().includes(q))

    data.projects.forEach(p => {
      if (match(p.name, p.wood_type, p.description, p.dimensions_final, p.built_with, p.finish_used, p.category))
        hits.push({ type: 'Project', title: p.name, sub: `${p.wood_type || ''} · ${p.status}`.replace(/^ · /, ''), action: () => navigate('projects', p.id) })
    })
    data.steps.forEach(s => {
      if (match(s.title, s.note)) {
        const proj = data.projects.find(p => p.id === s.project_id)
        hits.push({ type: 'Step', title: s.title, sub: proj?.name || '', action: () => navigate('projects', s.project_id) })
      }
    })
    data.shopping.forEach(s => {
      if (match(s.name, s.store, s.notes))
        hits.push({ type: 'Shopping', title: s.name, sub: s.store || '', action: () => setTab('shopping') })
    })
    data.maintenance.forEach(m => {
      if (match(m.name, m.category, m.notes))
        hits.push({ type: 'Maintenance', title: m.name, sub: m.category || '', action: () => setTab('maintenance') })
    })
    data.woodStock.forEach(s => {
      if (match(s.species, s.location, s.intended_use, s.notes))
        hits.push({ type: 'Wood Stock', title: s.species, sub: `${s.location || ''} · ${s.status || ''}`.replace(/^ · /, ''), action: () => setTab('stock') })
    })
    data.finishProducts.forEach(p => {
      if (match(p.name, p.manufacturer, p.notes, p.feedback))
        hits.push({ type: 'Finish', title: p.name, sub: p.manufacturer || '', action: () => setTab('finishes') })
    })
    data.resources.forEach(r => {
      if (match(r.title, r.url, r.notes, r.category))
        hits.push({ type: 'Resource', title: r.title, sub: r.category || '', action: () => setTab('resources') })
    })
    data.brainstorming.forEach(b => {
      if (match(b.content))
        hits.push({ type: 'Brainstorm', title: b.content.slice(0, 70) + (b.content.length > 70 ? '…' : ''), sub: '', action: () => setTab('brainstorm') })
    })
    data.shopImprovements.forEach(s => {
      if (match(s.title, s.notes, s.category))
        hits.push({ type: 'Shop', title: s.title, sub: s.category || '', action: () => setTab('shop') })
    })
    data.photos.forEach(p => {
      if (match(p.caption, p.tags))
        hits.push({ type: 'Photo', title: p.caption || p.tags || 'Photo', sub: p.photo_type || '', action: () => setTab('photos') })
    })

    return hits.slice(0, 20)
  }, [debounced, data, setTab, navigate])

  useEffect(() => { setCursor(-1) }, [results])

  const select = useCallback((hit) => {
    hit.action()
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }, [setTab, navigate])

  const onKeyDown = e => {
    if (!open || !results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, -1)) }
    if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); select(results[cursor]) }
    if (e.key === 'Escape')    { setOpen(false); setQuery('') }
  }

  const showResults = open && debounced.length >= 2

  return (
    <div ref={containerRef} className="search-wrap">
      <div className={`search-input-wrap ${focused ? 'focused' : ''}`}>
        <ISearch size={15} color="var(--text-4)" sw={2} />
        <input
          ref={inputRef}
          className="search-input"
          type="search"
          placeholder="Search…"
          value={query}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Search all content"
          aria-expanded={showResults}
          aria-haspopup="listbox"
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setFocused(true); if (query.length >= 2) setOpen(true) }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
      </div>

      {showResults && (
        <div className="search-results" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <div className="search-empty">No results for "{debounced}"</div>
          ) : (
            results.map((hit, i) => (
              <div
                key={i}
                className={`search-result-item ${i === cursor ? 'highlighted' : ''}`}
                role="option"
                aria-selected={i === cursor}
                onMouseDown={e => { e.preventDefault(); select(hit) }}
                onTouchEnd={e => { e.preventDefault(); select(hit) }}
                onClick={() => select(hit)}
                onMouseEnter={() => setCursor(i)}
              >
                <span className="search-result-type" style={{ color: TYPE_COLOR[hit.type] || 'var(--text-4)' }}>
                  {hit.type}
                </span>
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
