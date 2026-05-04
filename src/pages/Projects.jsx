import React, { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { hapticLight } from '../db.js'
import {
  Sheet, FormCell, BulkAddSheet, ConfirmSheet, DropZone, PhotoGrid, TagInput, FilterSelect,
  STATUS, coatStatus, fmtShort, localDt, useLongPress, BeforeAfterCompare,
  IPlus, ITrash, ICircle, ICheck, IChevR, IChevL, IEdit, ICal, ICamera, IBell, IGrid, IStar, IList,
} from '../components/Shared.jsx'
import { ProjectDetail, ProjectSheet, StarBurst } from './ProjectDetail.jsx'

const STATUS_ORDER = ['active', 'planning', 'paused', 'complete']
const STATUS_LABEL = { active: 'Active', planning: 'Planning', paused: 'Paused', complete: 'Complete' }

// ─── Projects list ────────────────────────────────────────────────────────────
export default function Projects() {
  const { data, mutate, projId, setProjId, navigate, sampleIds, tabAction, setTabAction } = useCtx()
  const toast   = useToast()
  const [showAdd, setShowAdd]   = useState(false)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'
  const [filter, setFilter]         = useState('all')
  const [showFavOnly, setShowFavOnly] = useState(false)
  const [sortBy, setSortBy]           = useState('status')
  const [statusFilter, setStatusFilter]     = useState('all')
  const [locationFilter, setLocationFilter] = useState(() => {
    const v = window.__woodLocationFilter || ''
    window.__woodLocationFilter = ''
    return v
  })
  const scrollRef   = useRef(null)
  const savedScroll = useRef(0)

  // Consume tabAction — e.g. open new project modal immediately on mount
  useEffect(() => {
    if (tabAction === 'new-project') {
      setShowAdd(true)
      setTabAction(null)
    }
  }, [tabAction])

  // Save scroll position when navigating into a project
  const openProject = useCallback((id) => {
    if (scrollRef.current) savedScroll.current = scrollRef.current.scrollTop
    setProjId(id)
  }, [setProjId])

  // Restore scroll position when returning from a project
  useEffect(() => {
    if (!projId && scrollRef.current && savedScroll.current > 0) {
      scrollRef.current.scrollTop = savedScroll.current
    }
  }, [projId])

  const handleAdd = async (fields, woodStockId) => {
    try {
      const proj = await db.addProject(fields)
      let pws = null
      if (woodStockId) {
        try {
          pws = await db.addProjectWoodSource(proj.id, woodStockId)
        } catch (wsErr) {
          // Wood source failed — roll back the project so we don't leave an orphan
          await db.deleteProject(proj.id).catch(() => {})
          toast(`Failed to link wood stock: ${wsErr.message}`, 'error')
          return
        }
      }
      mutate(d => ({
        ...d,
        projects: [...d.projects, proj],
        projectWoodSources: pws
          ? [...d.projectWoodSources, pws]
          : d.projectWoodSources
      }))
      toast(`${fields.name || 'Project'} added`, 'success')
      setShowAdd(false)
      navigate('projects', proj.id)
    } catch (e) { toast(e.message, 'error') }
  }

  const categories = data.categories || []
  const filtered = useMemo(() =>
    data.projects
      .filter(p => !showFavOnly || p.is_favorite)
      .filter(p => filter === 'all' || p.category === filter)
      .filter(p => statusFilter === 'all' || p.status === statusFilter),
    [data.projects, filter, statusFilter, showFavOnly]
  )

  const sorted = useMemo(() => {
    const s = [...filtered]
    if (sortBy === 'name')     s.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'category') s.sort((a, b) => (a.category||'').localeCompare(b.category||''))
    if (sortBy === 'year')     s.sort((a, b) => (b.year_completed||0) - (a.year_completed||0))
    if (sortBy === 'recent')   s.sort((a, b) => new Date(b.created_at||0) - new Date(a.created_at||0))
    return s
  }, [filtered, sortBy])

  const groups = useMemo(() =>
    STATUS_ORDER.reduce((acc, s) => {
      const items = sorted.filter(p => p.status === s)
      if (items.length) acc.push({ status: s, items })
      return acc
    }, []),
    [sorted]
  )

  // Pre-computed lookup maps — O(1) per card instead of O(n) inline filter
  const stepCountMap = useMemo(() => {
    const m = {}
    data.steps.forEach(s => {
      if (!m[s.project_id]) m[s.project_id] = { total: 0, done: 0 }
      m[s.project_id].total++
      if (s.completed) m[s.project_id].done++
    })
    return m
  }, [data.steps])

  const urgentCoatMap = useMemo(() => {
    const m = {}
    data.coats.forEach(c => {
      if (c.project_id && c.applied_at && coatStatus(c).urgent)
        m[c.project_id] = (m[c.project_id] || 0) + 1
    })
    return m
  }, [data.coats])

  // Stable card wrapper avoids re-creating inline arrow functions in map
  const MemoCard = useCallback(({ project, openProject: op, onFavorite, onDelete, ...rest }) =>
    <ProjectCard project={project} onOpen={() => op(project.id)} onFavorite={onFavorite} onDelete={onDelete} {...rest} />
  , [])

  const handleFavorite = useCallback(async (id, value) => {
    mutate(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, is_favorite: value } : p) }))
    await db.toggleFavorite(id, value).catch(e => toast(e.message, 'error'))
    toast(value ? 'Added to favorites' : 'Removed from favorites', 'success')
  }, [mutate, toast])

  const handleDelete = useCallback(async (id) => {
    const p = data.projects.find(pr => pr.id === id)
    mutate(d => ({ ...d, projects: d.projects.filter(pr => pr.id !== id) }))
    await db.deleteProject(id).catch(e => toast(e.message, 'error'))
    toast(`${p?.name || 'Project'} deleted`, 'success')
  }, [mutate, data.projects, toast])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollRef} className="scroll-page" style={{ paddingBottom: 100 }}>
        <div className="page-header" data-tutorial-target="projects-header">
          <div className="page-header-row">
            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
              <h1 className="page-title">Projects</h1>
              {locationFilter && (
                <span style={{ fontSize:11, background:'var(--green-dim,rgba(22,101,52,.12))', color:'var(--green)', borderRadius:99, padding:'2px 8px', fontWeight:600, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                  📍{locationFilter}
                  <button onClick={() => setLocationFilter('')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)', fontSize:14, lineHeight:1, padding:'0 0 0 2px' }} aria-label="Clear location filter">×</button>
                </span>
              )}
            </div>
          </div>
          {/* Filter bar — two rows: row1=status+fav, row2=category+sort */}
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:10 }}>
            {/* Row 1: Status pills + Favorites */}
            <div style={{ display:'flex', gap:4, alignItems:'center', overflowX:'auto', scrollbarWidth:'none' }}>
              {[
                { id: 'all',      label: 'All' },
                { id: 'active',   label: 'Active' },
                { id: 'planning', label: 'Planning' },
                { id: 'paused',   label: 'Paused' },
                { id: 'complete', label: 'Complete' },
              ].map(s => (
                <button key={s.id} onClick={() => setStatusFilter(s.id)} style={{
                  padding: '7px 10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', borderRadius: 0, flexShrink: 0,
                  background: statusFilter === s.id ? 'var(--navy)' : 'var(--c-bg-subtle)',
                  color: statusFilter === s.id ? 'var(--white)' : 'var(--c-text-muted)',
                  border: '1.5px solid var(--c-border)',
                  transition: 'background 120ms, color 120ms',
                }}>{s.label}</button>
              ))}
              <button
                onClick={() => setShowFavOnly(f => !f)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  padding: '7px 10px', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer',
                  background: showFavOnly ? 'var(--navy)' : 'var(--c-bg-subtle)',
                  color: showFavOnly ? 'var(--white)' : 'var(--c-text-muted)',
                  border: '1.5px solid var(--c-border)', borderRadius: 0,
                  transition: 'background 150ms, color 150ms',
                }}
                title={showFavOnly ? 'Show all' : 'Favorites only'}
              >
                <IStar size={13} fill={showFavOnly ? '#fff' : 'none'} color={showFavOnly ? '#fff' : '#F59E0B'} />
                Fav
              </button>
            </div>
            {/* Row 2: Category + Sort */}
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {categories.length > 0 && (
              <FilterSelect
                value={filter}
                onChange={setFilter}
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                allLabel="All Categories"
                label="Filter by category"
              />
            )}
            {/* Sort */}
            <div className="filter-select-wrap">
              <select className={`filter-select${sortBy !== 'status' ? ' active' : ''}`}
                value={sortBy} onChange={e => setSortBy(e.target.value)}
              >
                <option value="status">By Status</option>
                <option value="name">By Name</option>
                <option value="category">By Category</option>
                <option value="year">By Year</option>
                <option value="recent">Recently Added</option>
              </select>
              <span className="filter-select-chevron" aria-hidden="true">▾</span>
            </div>
            </div>{/* end row 2 */}
            {/* Table view — desktop only */}
            <button
              style={{
                padding: '7px 12px', fontSize: 14, fontWeight: 500,
                fontFamily: 'inherit', cursor: 'pointer', marginLeft: 'auto',
                background: viewMode === 'table' ? 'var(--navy)' : 'var(--c-bg-subtle)',
                color: viewMode === 'table' ? 'var(--white)' : 'var(--c-text-primary)',
                border: '1.5px solid var(--c-border)', borderRadius: 0,
                transition: 'background 150ms, color 150ms',
              }}
              id="table-toggle-btn"
              onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
            >
              {viewMode === 'table' ? 'Card view' : 'Table view'}
            </button>
          </div>
        </div>

        {/* Desktop table view */}
        {viewMode === 'table'
          ? <ProjectTable projects={filtered} categories={categories} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
          : (
            <div>
              {groups.map(({ status, items }) => (
                <div key={status}>
                  <span className="section-label">{STATUS_LABEL[status]}</span>
                  <div className="proj-cards-grid" data-tutorial-target="project-grid">
                    {items.map(p => <MemoCard key={p.id} project={p} openProject={openProject} onFavorite={handleFavorite} onDelete={handleDelete} data={data} stepCounts={stepCountMap[p.id]} urgentCoats={urgentCoatMap[p.id] || 0} sampleProjectId={sampleIds?.projectId} />)}
                  </div>
                </div>
              ))}
              {!filtered.length && (
                <div className="empty">
                  <div className="empty-icon"><IList size={32} color="var(--c-text-muted)" sw={1.5} /></div>
                  <div className="empty-title">{filter === 'all' ? 'No projects yet' : `No ${filter} projects`}</div>
                  <p className="empty-sub">{filter === 'all' ? 'Click + to start your first build' : 'Try a different category filter'}</p>
                </div>
              )}
            </div>
          )
        }
      </div>
      <button className="fab" data-tutorial-target="add-project" onClick={() => setShowAdd(true)} aria-label="Add project">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      {showAdd && <ProjectSheet categories={categories} onSave={handleAdd} onClose={() => setShowAdd(false)} mutate={mutate} />}
    </div>
  )
}

// ─── Project table (desktop) ──────────────────────────────────────────────────
function ProjectTable({ projects, categories, statusFilter, setStatusFilter }) {
  const { data, mutate, setProjId } = useCtx()
  const toast = useToast()

  const update = async (id, field, value) => {
    mutate(d => ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, [field]: value } : p) }))
    await db.updateProject(id, { [field]: value }).catch(e => toast(e.message, 'error'))
  }

  // Get first photo for a project (prefer 'finished' tagged, fall back to any)
  const thumbFor = (projId) => {
    const photos = data.photos.filter(p => p.project_id === projId)
    if (!photos.length) return null
    const finished = photos.find(p => p.tags?.includes('finished'))
    return (finished || photos[0])?.url || null
  }

  const STATUS_FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'active',   label: 'Active' },
    { id: 'planning', label: 'Planning' },
    { id: 'paused',   label: 'Paused' },
    { id: 'complete', label: 'Complete' },
  ]

  return (
    <div>
      {/* Status filter */}
      <div style={{ padding: '12px 20px 4px' }}>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTERS.filter(f => f.id !== 'all').map(f => ({ value: f.id, label: f.label }))}
          allLabel="All Statuses"
          label="Filter by status"
        />
      </div>

      <div className="proj-table-wrap">
        <table className="proj-table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>Photo</th>
              <th>Project</th>
              <th>Category</th>
              <th>Status</th>
              <th>Wood</th>
              <th>Source</th>
              <th>Built With</th>
              <th>Finish</th>
              <th>Year</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => {
              const thumb = thumbFor(p.id)
              const ss = STATUS[p.status] || STATUS.planning
              return (
                <tr key={p.id}>
                  <td style={{ padding: '6px 12px' }}>
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={p.name}
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, display: 'block', cursor: 'pointer' }}
                        onClick={() => setProjId(p.id)}
                      />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--c-bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🪵</div>
                    )}
                  </td>
                  <td><input className="proj-table-input" defaultValue={p.name} onBlur={e => { if (e.target.value !== p.name) update(p.id, 'name', e.target.value) }} /></td>
                  <td>
                    <select className="proj-table-select" value={p.category || ''} onChange={e => update(p.id, 'category', e.target.value)}>
                      <option value="">—</option>
                      {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="proj-table-select" value={p.status} onChange={e => update(p.id, 'status', e.target.value)}>
                      {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td><input className="proj-table-input" defaultValue={p.wood_type} onBlur={e => { if (e.target.value !== (p.wood_type||'')) update(p.id, 'wood_type', e.target.value) }} /></td>
                  <td><input className="proj-table-input" defaultValue={p.wood_source} onBlur={e => { if (e.target.value !== (p.wood_source||'')) update(p.id, 'wood_source', e.target.value) }} /></td>
                  <td><input className="proj-table-input" defaultValue={p.built_with} onBlur={e => { if (e.target.value !== (p.built_with||'')) update(p.id, 'built_with', e.target.value) }} /></td>
                  <td><input className="proj-table-input" defaultValue={p.finish_used} onBlur={e => { if (e.target.value !== (p.finish_used||'')) update(p.id, 'finish_used', e.target.value) }} /></td>
                  <td><input className="proj-table-input" type="number" defaultValue={p.year_completed} placeholder={new Date().getFullYear()} style={{ width: 64 }} onBlur={e => { const v = e.target.value ? parseInt(e.target.value) : null; if (v !== p.year_completed) update(p.id, 'year_completed', v) }} /></td>
                  <td><button className="btn-text" onClick={() => setProjId(p.id)}>Open →</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!projects.length && (
          <div className="empty">
            <div className="empty-icon"><IList size={32} color="var(--c-text-muted)" sw={1.5} /></div>
            <div className="empty-title">No {statusFilter === 'all' ? '' : statusFilter + ' '}projects</div>
            <p className="empty-sub">{statusFilter !== 'all' ? 'Try a different status filter' : 'Click + to add your first project'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────
const ProjectCard = memo(function ProjectCard({ project, onOpen, data, stepCounts, urgentCoats = 0, onFavorite, onDelete, sampleProjectId }) {
  const total = stepCounts?.total || 0
  const done  = stepCounts?.done  || 0
  const rc    = urgentCoats
  const ss    = STATUS[project.status] || STATUS.planning
  const isSample = sampleProjectId === project.id
  const [showDelete, setShowDelete] = useState(false)
  const [starBurst, setStarBurst]   = useState(false)
  const longPress = useLongPress(() => setShowDelete(true))

  // Thumbnail: prefer 'finished' tagged photo, fall back to any
  const thumb = useMemo(() => {
    const photos = data.photos.filter(p => p.project_id === project.id)
    const fin = photos.find(p => p.tags?.split(',').map(t => t.trim()).includes('finished'))
    return (fin || photos[0])?.url || null
  }, [data.photos, project.id])

  const handleFavoriteClick = (e) => {
    e.stopPropagation()
    const newVal = !project.is_favorite
    if (newVal) setStarBurst(true)
    onFavorite?.(project.id, newVal)
  }

  return (
    <>
    {showDelete && (
      <ConfirmSheet
        message={`Delete "${project.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { setShowDelete(false); onDelete?.(project.id) }}
        onClose={() => setShowDelete(false)}
      />
    )}
    <button className={`proj-card proj-card--${project.status || 'planning'}`} onClick={onOpen} {...longPress}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: total ? 10 : 0 }}>
        <div style={{ flex: 1, paddingRight: 12, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
            {project.name}
            {isSample && <span className="sample-badge">SAMPLE</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {project.wood_type && <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{project.wood_type}</span>}
            {project.category  && <span style={{ fontSize: 12, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 99, padding: '1px 8px', fontWeight: 500 }}>{project.category}</span>}
            {project.year_completed && <span style={{ fontSize: 12, color: 'var(--c-text-faint)' }}>{project.year_completed}</span>}
            {project.gift_recipient && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>🎁 {project.gift_recipient}</span>}
          </div>
          {project.description && <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginTop: 4 }}>{project.description}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          {/* Thumbnail */}
          {thumb && (
            <img
              src={thumb}
              alt=""
              loading="lazy"
              style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid var(--c-border-light)' }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {rc > 0 && <span className="badge-pill" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>coat ready</span>}
            {onFavorite && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={handleFavoriteClick}
                  style={{ background:'none', border:'none', padding:2, cursor:'pointer', lineHeight:1, position:'relative', zIndex:1 }}
                  aria-label={project.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <IStar size={18}
                    fill={project.is_favorite ? '#F59E0B' : 'none'}
                    color={project.is_favorite ? '#F59E0B' : 'var(--c-text-faint)'}
                    style={{ transition: 'transform 200ms', transform: project.is_favorite ? 'scale(1.2)' : 'scale(1)' }}
                  />
                </button>
                {starBurst && (
                  <StarBurst onDone={() => setStarBurst(false)} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {total > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>Build progress</span>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{done}/{total}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(done / total) * 100}%`, background: project.status === 'complete' ? 'var(--forest)' : 'var(--accent)' }} />
          </div>
        </>
      )}
    </button>
    </>
  )
})

// ─── Project detail ───────────────────────────────────────────────────────────