import { useState, useCallback } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'

const TAGS = ['finished', 'portfolio', 'progress', 'inspiration', 'before', 'after']

// ── Inline editable cell ───────────────────────────────────────────────────────
function Cell({ value, onSave, type = 'text', options, missing, placeholder }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')

  const commit = async () => {
    setEditing(false)
    if (val !== (value || '')) await onSave(val)
  }

  const style = {
    padding: '4px 8px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
    background: missing ? 'var(--red-dim)' : 'transparent',
    color: missing ? 'var(--red)' : val ? 'var(--text)' : 'var(--text-4)',
    border: missing ? '1px solid var(--red)' : '1px solid transparent',
    minWidth: 80, display: 'inline-block', whiteSpace: 'nowrap',
    maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
  }

  if (!editing) return (
    <div style={style} onClick={() => { setEditing(true); setVal(value || '') }}>
      {val || (missing ? '⚠ missing' : '—')}
    </div>
  )

  if (type === 'select') return (
    <select autoFocus className="form-select" style={{ fontSize: 13, padding: '3px 6px', minWidth: 100 }}
      value={val} onChange={e => { setVal(e.target.value); setEditing(false); if (e.target.value !== (value || '')) onSave(e.target.value) }}
      onBlur={() => setEditing(false)}>
      <option value="">{placeholder || '—'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <input autoFocus className="edit-input" style={{ fontSize: 13, padding: '3px 6px', minWidth: 100 }}
      value={val} onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
    />
  )
}

// ── Tags cell — special multi-tag editor ────────────────────────────────────
function TagsCell({ tags, onSave }) {
  const [editing, setEditing] = useState(false)
  const arr = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []

  const toggle = async tag => {
    const next = arr.includes(tag) ? arr.filter(t => t !== tag) : [...arr, tag]
    await onSave(next.join(','))
  }

  const missingFinished = !arr.includes('finished')
  const missingPortfolio = !arr.includes('portfolio')

  if (!editing) return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', cursor: 'pointer', minWidth: 140 }}
      onClick={() => setEditing(true)}>
      {arr.length === 0
        ? <span style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-dim)', padding: '2px 7px', borderRadius: 99, border: '1px solid var(--red)' }}>⚠ no tags</span>
        : arr.map(t => (
          <span key={t} style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 99,
            background: t === 'finished' ? 'var(--green-dim)' : t === 'portfolio' ? 'var(--blue-dim)' : 'var(--fill)',
            color: t === 'finished' ? 'var(--forest)' : t === 'portfolio' ? 'var(--blue)' : 'var(--text-3)',
            fontWeight: 600,
          }}>{t}</span>
        ))
      }
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {TAGS.map(t => (
        <button key={t} onClick={() => toggle(t)} style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit',
          background: arr.includes(t) ? (t === 'finished' ? 'var(--forest)' : t === 'portfolio' ? 'var(--accent)' : '#555') : 'var(--fill)',
          color: arr.includes(t) ? '#fff' : 'var(--text-3)',
          border: 'none', fontWeight: 600,
        }}>{t}</button>
      ))}
      <button onClick={() => setEditing(false)} style={{
        fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', padding: '0 4px', lineHeight: 1,
      }} aria-label="Close tags">✕</button>
    </div>
  )
}

// ── Photos tab ─────────────────────────────────────────────────────────────────
function PhotosAudit() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [filter, setFilter] = useState('all')

  const projects = data.projects || []
  const photos = (data.photos || []).slice().sort((a, b) => {
    const ap = projects.find(p => p.id === a.project_id)?.name || ''
    const bp = projects.find(p => p.id === b.project_id)?.name || ''
    return ap.localeCompare(bp)
  })

  const save = useCallback(async (id, fields) => {
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
  }, [mutate, toast])

  const filtered = filter === 'all' ? photos
    : filter === 'no-tags' ? photos.filter(p => !p.tags)
    : filter === 'no-finished' ? photos.filter(p => !p.tags?.includes('finished'))
    : filter === 'no-portfolio' ? photos.filter(p => !p.tags?.includes('portfolio'))
    : filter === 'no-project' ? photos.filter(p => !p.project_id)
    : photos

  const counts = {
    total: photos.length,
    noTags: photos.filter(p => !p.tags).length,
    noFinished: photos.filter(p => !p.tags?.includes('finished')).length,
    noPortfolio: photos.filter(p => !p.tags?.includes('portfolio')).length,
    noProject: photos.filter(p => !p.project_id).length,
  }

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 20px', borderBottom: '1px solid var(--border-2)' }}>
        {[
          { id: 'all', label: `All (${counts.total})` },
          { id: 'no-tags', label: `No tags (${counts.noTags})`, warn: counts.noTags > 0 },
          { id: 'no-finished', label: `Missing finished (${counts.noFinished})`, warn: counts.noFinished > 0 },
          { id: 'no-portfolio', label: `Not in portfolio (${counts.noPortfolio})` },
          { id: 'no-project', label: `No project (${counts.noProject})`, warn: counts.noProject > 0 },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: filter === f.id ? '#0F1E38' : f.warn ? 'var(--red-dim)' : 'var(--fill)',
            color: filter === f.id ? '#fff' : f.warn ? 'var(--red)' : 'var(--text-3)',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-2)', background: 'var(--fill)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', width: 56 }}>Photo</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Caption</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Tags</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Project</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((photo, i) => {
              const proj = projects.find(p => p.id === photo.project_id)
              return (
                <tr key={photo.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'transparent' : 'var(--fill)' }}>
                  <td style={{ padding: '6px 12px' }}>
                    <img src={photo.url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <Cell value={photo.caption} missing={!photo.caption}
                      onSave={v => save(photo.id, { caption: v })} />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <TagsCell tags={photo.tags}
                      onSave={v => save(photo.id, { tags: v })} />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <Cell value={proj?.name} missing={!photo.project_id}
                      type="select"
                      placeholder="Select project…"
                      options={[...projects.map(p => p.name).sort((a, b) => a.localeCompare(b)), '＋ New Project']}
                      onSave={async v => {
                        if (v === '＋ New Project') {
                          const name = prompt('New project name:')
                          if (!name?.trim()) return
                          try {
                            const proj = await db.addProject({ name: name.trim(), status: 'planning' })
                            mutate(d => ({ ...d, projects: [...d.projects, proj] }))
                            await db.updatePhoto(photo.id, { project_id: proj.id })
                            mutate(d => ({ ...d, photos: d.photos.map(p => p.id === photo.id ? { ...p, project_id: proj.id } : p) }))
                            toast(`Created "${name.trim()}" and linked photo`, 'success')
                          } catch (e) { toast(e.message, 'error') }
                          return
                        }
                        const p = projects.find(x => x.name === v)
                        if (p) save(photo.id, { project_id: p.id })
                      }} />
                  </td>
                  <td style={{ padding: '6px 12px' }}>
                    <Cell value={photo.photo_type}
                      type="select" options={['progress', 'finished', 'inspiration', 'before', 'after']}
                      onSave={v => save(photo.id, { photo_type: v })} />
                  </td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-4)', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {photo.created_at ? new Date(photo.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-4)' }}>Nothing to show</div>
        )}
      </div>
    </div>
  )
}

// ── Projects tab ───────────────────────────────────────────────────────────────
function ProjectsAudit() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [filter, setFilter] = useState('all')

  const woodStock = data.woodStock || []
  const woodLocations = data.woodLocations || []
  const categories = data.categories || []
  const finishes = data.finishes || []

  const projectsWithSource = (data.projects || []).map(p => {
    const pws = (data.projectWoodSources || []).find(x => x.project_id === p.id)
    const stock = pws ? woodStock.find(w => w.id === pws.wood_stock_id) : null
    const loc = stock ? woodLocations.find(l => l.id === stock?.location_id) : null
    return { ...p, _stock: stock, _loc: loc }
  })

  const save = useCallback(async (id, fields) => {
    mutate(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updateProject(id, fields).catch(e => toast(e.message, 'error'))
  }, [mutate, toast])

  const counts = {
    total: projectsWithSource.length,
    noWood: projectsWithSource.filter(p => !p._stock).length,
    noYear: projectsWithSource.filter(p => !p.year_completed).length,
    noFinish: projectsWithSource.filter(p => !p.finish_used).length,
    noCat: projectsWithSource.filter(p => !p.category).length,
  }

  const filtered = filter === 'all' ? projectsWithSource
    : filter === 'no-wood' ? projectsWithSource.filter(p => !p._stock)
    : filter === 'no-year' ? projectsWithSource.filter(p => !p.year_completed)
    : filter === 'no-finish' ? projectsWithSource.filter(p => !p.finish_used)
    : filter === 'no-cat' ? projectsWithSource.filter(p => !p.category)
    : projectsWithSource

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 20px', borderBottom: '1px solid var(--border-2)' }}>
        {[
          { id: 'all', label: `All (${counts.total})` },
          { id: 'no-wood', label: `No wood source (${counts.noWood})`, warn: counts.noWood > 0 },
          { id: 'no-year', label: `No year (${counts.noYear})`, warn: counts.noYear > 0 },
          { id: 'no-finish', label: `No finish (${counts.noFinish})`, warn: counts.noFinish > 0 },
          { id: 'no-cat', label: `No category (${counts.noCat})`, warn: counts.noCat > 0 },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: filter === f.id ? '#0F1E38' : f.warn ? 'var(--red-dim)' : 'var(--fill)',
            color: filter === f.id ? '#fff' : f.warn ? 'var(--red)' : 'var(--text-3)',
          }}>{f.label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-2)', background: 'var(--fill)' }}>
              {['Project', 'Status', 'Category', 'Wood source', 'Wood type', 'Finish', 'Year', 'Gift / recipient'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((proj, i) => (
              <tr key={proj.id} style={{ borderBottom: '1px solid var(--border-2)', background: i % 2 === 0 ? 'transparent' : 'var(--fill)' }}>
                <td style={{ padding: '6px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <Cell value={proj.name}
                    onSave={v => save(proj.id, { name: v })} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <Cell value={proj.status} type="select"
                    options={['planning', 'active', 'paused', 'complete']}
                    onSave={v => save(proj.id, { status: v })} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <Cell value={proj.category} missing={!proj.category}
                    type="select" options={categories.map(c => c.name)}
                    onSave={v => save(proj.id, { category: v })} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <div style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 6,
                    background: !proj._stock ? 'var(--red-dim)' : 'var(--fill)',
                    color: !proj._stock ? 'var(--red)' : 'var(--text-3)',
                    border: !proj._stock ? '1px solid var(--red)' : '1px solid transparent',
                    whiteSpace: 'nowrap',
                  }}>
                    {proj._stock
                      ? `${proj._stock.species}${proj._loc ? ' · ' + proj._loc.name : ''}`
                      : '⚠ missing'}
                  </div>
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <Cell value={proj.wood_type}
                    onSave={v => save(proj.id, { wood_type: v })} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <Cell value={proj.finish_used} missing={!proj.finish_used}
                    type="select" options={finishes.map(f => f.name)}
                    onSave={v => save(proj.id, { finish_used: v })} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <Cell value={proj.year_completed ? String(proj.year_completed) : ''} missing={!proj.year_completed}
                    onSave={v => save(proj.id, { year_completed: v ? parseInt(v) : null })} />
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <Cell value={proj.gift_recipient}
                    onSave={v => save(proj.id, { gift_recipient: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-4)' }}>Nothing to show</div>
        )}
      </div>
    </div>
  )
}

// ── Main Audit page ────────────────────────────────────────────────────────────
export default function Audit() {
  const [tab, setTab] = useState('photos')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <h1 className="page-title">Data Audit</h1>
        <p className="page-subtitle">Click any cell to edit inline. Missing fields are highlighted.</p>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, borderBottom: '1px solid var(--border-2)' }}>
          {[{ id: 'photos', label: 'Photos' }, { id: 'projects', label: 'Projects' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 20px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 14, fontWeight: 600, background: 'transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--text-3)',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'photos' ? <PhotosAudit /> : <ProjectsAudit />}
      </div>
    </div>
  )
}
