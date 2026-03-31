import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import {
  Sheet, FormCell, BulkAddSheet, ConfirmSheet, DropZone, PhotoGrid, TagInput,
  STATUS, coatStatus, fmtShort, localDt,
  IPlus, ITrash, ICircle, ICheck, IChevR, IChevL, IEdit, ICal, ICamera, IBell, IGrid,
} from '../components/Shared.jsx'

const STATUS_ORDER = ['active', 'planning', 'paused', 'complete']
const STATUS_LABEL = { active: 'Active', planning: 'Planning', paused: 'Paused', complete: 'Complete' }

// ─── Projects list ────────────────────────────────────────────────────────────
export default function Projects() {
  const { data, mutate, setProjId } = useCtx()
  const toast   = useToast()
  const [showAdd, setShowAdd]   = useState(false)
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'
  const [filter, setFilter]         = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const handleAdd = async fields => {
    try {
      const proj = await db.addProject(fields)
      mutate(d => ({ ...d, projects: [...d.projects, proj] }))
      toast('Project added', 'success')
      setShowAdd(false)
    } catch (e) { toast(e.message, 'error') }
  }

  const categories = data.categories || []
  const filtered = data.projects
    .filter(p => filter === 'all' || p.category === filter)
    .filter(p => statusFilter === 'all' || p.status === statusFilter)

  const groups = STATUS_ORDER.reduce((acc, s) => {
    const items = filtered.filter(p => p.status === s)
    if (items.length) acc.push({ status: s, items })
    return acc
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Projects</h1>
            {/* Table view toggle — desktop only */}
            <button
              className={viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '5px 12px', fontSize: 13, display: 'none' }}
              id="table-toggle-btn"
              onClick={() => setViewMode(v => v === 'cards' ? 'table' : 'cards')}
            >
              {viewMode === 'table' ? 'Card view' : 'Table view'}
            </button>
          </div>
          {/* Category filter */}
          {categories.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
              {['all', ...categories.map(c => c.name)].map(cat => (
                <button key={cat} onClick={() => setFilter(cat)} style={{
                  padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  background: filter === cat ? '#0F1E38' : 'var(--fill)',
                  color: filter === cat ? '#fff' : 'var(--text-2)',
                }}>
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table view */}
        <style>{`@media (min-width: 768px) { #table-toggle-btn { display: inline-flex !important; } }`}</style>
        {viewMode === 'table'
          ? <ProjectTable projects={filtered} categories={categories} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
          : (
            <div style={{ paddingTop: 8, paddingBottom: 24 }}>
              {groups.map(({ status, items }) => (
                <div key={status}>
                  <span className="section-label">{STATUS_LABEL[status]}</span>
                  {items.map(p => <ProjectCard key={p.id} project={p} onOpen={() => setProjId(p.id)} data={data} />)}
                </div>
              ))}
              {!filtered.length && (
                <div className="empty">
                  <div className="empty-icon">📋</div>
                  <div className="empty-title">{filter === 'all' ? 'No projects yet' : `No ${filter} projects`}</div>
                  <p className="empty-sub">{filter === 'all' ? 'Click + to start your first build' : 'Try a different category filter'}</p>
                </div>
              )}
            </div>
          )
        }
      </div>
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add project">
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

  const chipStyle = (id) => ({
    padding: '4px 12px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    background: statusFilter === id ? '#0F1E38' : 'var(--fill)',
    color: statusFilter === id ? '#fff' : 'var(--text-2)',
  })

  return (
    <div>
      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {STATUS_FILTERS.map(f => (
          <button key={f.id} style={chipStyle(f.id)} onClick={() => setStatusFilter(f.id)}>
            {f.label}
            {f.id !== 'all' && (
              <span style={{ marginLeft: 5, opacity: .65, fontSize: 11 }}>
                ({data.projects.filter(p => p.status === f.id).length})
              </span>
            )}
          </button>
        ))}
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
                      <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🪵</div>
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
            <div className="empty-icon">📋</div>
            <div className="empty-title">No {statusFilter === 'all' ? '' : statusFilter + ' '}projects</div>
            <p className="empty-sub">{statusFilter !== 'all' ? 'Try a different status filter' : 'Click + to add your first project'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, data }) {
  const ps    = data.steps.filter(s => s.project_id === project.id)
  const done  = ps.filter(s => s.completed).length
  const total = ps.length
  const rc    = data.coats.filter(c => c.project_id === project.id && coatStatus(c).urgent).length
  const ss    = STATUS[project.status] || STATUS.planning

  return (
    <button className="proj-card" onClick={onOpen}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: total ? 10 : 0 }}>
        <div style={{ flex: 1, paddingRight: 12, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{project.name}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
            {project.wood_type && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{project.wood_type}</span>}
            {project.category  && <span style={{ fontSize: 12, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 99, padding: '1px 8px', fontWeight: 500 }}>{project.category}</span>}
            {project.year_completed && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>{project.year_completed}</span>}
          </div>
          {project.description && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>{project.description}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {rc > 0 && <span className="badge-pill" style={{ background: 'var(--orange-dim)', color: 'var(--orange)' }}>coat ready</span>}
        </div>
      </div>
      {total > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Build progress</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{done}/{total}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(done / total) * 100}%`, background: project.status === 'complete' ? 'var(--forest)' : 'var(--accent)' }} />
          </div>
        </>
      )}
    </button>
  )
}

// ─── Project detail ───────────────────────────────────────────────────────────
export function ProjectDetail() {
  const { data, mutate, projId, setProjId } = useCtx()
  const toast = useToast()
  const [sub, setSub]           = useState('steps')
  const [editing, setEditing]   = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showRon, setShowRon]   = useState(false)

  const project = data.projects.find(p => p.id === projId)
  if (!project) return null

  const ss = STATUS[project.status] || STATUS.planning
  const categories = data.categories || []

  const cycleStatus = async () => {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(project.status) + 1) % STATUS_ORDER.length]
    mutate(d => ({ ...d, projects: d.projects.map(p => p.id === projId ? { ...p, status: next } : p) }))
    await db.updateProject(projId, { status: next }).catch(e => toast(e.message, 'error'))
    if (next === 'complete') setShowRon(true)
  }

  const handleUpdate = async fields => {
    try {
      mutate(d => ({ ...d, projects: d.projects.map(p => p.id === projId ? { ...p, ...fields } : p) }))
      await db.updateProject(projId, fields)
      toast('Saved', 'success')
      setEditing(false)
      if (fields.status === 'complete' && project.status !== 'complete') setShowRon(true)
    } catch (e) { toast(e.message, 'error') }
  }

  const handleDelete = async () => {
    try {
      mutate(d => ({
        ...d,
        projects: d.projects.filter(p => p.id !== projId),
        steps:    d.steps.filter(s => s.project_id !== projId),
        coats:    d.coats.filter(c => c.project_id !== projId),
      }))
      await db.deleteProject(projId)
      setProjId(null)
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="slide-in">
      <div className="page-header" style={{ paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="back-btn" onClick={() => setProjId(null)}>
            <IChevL size={16} color="currentColor" sw={2.2} />
            Projects
          </button>
          <div style={{ display: 'flex', gap: 4, paddingBottom: 8 }}>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit project"><IEdit size={17} /></button>
            <button className="icon-btn" onClick={() => setConfirming(true)} aria-label="Delete project" style={{ color: 'var(--red)' }}><ITrash size={17} /></button>
          </div>
        </div>
        <h2 className="page-title" style={{ fontSize: 22 }}>{project.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {project.category && <span style={{ fontSize: 12, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 99, padding: '2px 10px', fontWeight: 600 }}>{project.category}</span>}
          {project.wood_type && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{project.wood_type}</span>}
          {project.year_completed && <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{project.year_completed}</span>}
          <button
            className="badge-pill"
            style={{ background: ss.bg, color: ss.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={cycleStatus}
            title="Tap to change status"
          >
            {project.status} ▾
          </button>
        </div>
        {(project.built_with || project.wood_source || project.finish_used) && (
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {project.built_with  && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>👤 {project.built_with}</span>}
            {project.wood_source && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🌲 {project.wood_source}</span>}
            {project.finish_used && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🎨 {project.finish_used}</span>}
          </div>
        )}
        <div className="sub-tabs">
          {[['steps','Build'],['finishing','Finishing'],['progress','Progress'],['inspiration','Inspiration']].map(([id, label]) => (
            <button key={id} className={`sub-tab ${sub === id ? 'active' : ''}`} onClick={() => setSub(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
        {sub === 'steps'       && <StepsPane      projId={projId} />}
        {sub === 'finishing'   && <FinishingPane   projId={projId} />}
        {sub === 'progress'    && <PhotoPane       projId={projId} type="progress" />}
        {sub === 'inspiration' && <PhotoPane       projId={projId} type="inspiration" />}
      </div>

      {editing && <ProjectSheet project={project} categories={categories} onSave={handleUpdate} onClose={() => setEditing(false)} mutate={mutate} />}
      {confirming && (
        <ConfirmSheet
          message={`Delete "${project.name}"? All steps, coats, and photos will be removed. This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setConfirming(false)}
        />
      )}
      {showRon && <RonSwansonModal onClose={() => setShowRon(false)} />}
    </div>
  )
}

// ─── Steps pane ───────────────────────────────────────────────────────────────
function StepsPane({ projId }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState('')

  const steps = data.steps.filter(s => s.project_id === projId).sort((a, b) => a.sort_order - b.sort_order)
  const done  = steps.filter(s => s.completed).length

  const toggle = async step => {
    const completed = !step.completed
    mutate(d => ({ ...d, steps: d.steps.map(s => s.id === step.id ? { ...s, completed } : s) }))
    await db.updateStep(step.id, { completed }).catch(e => toast(e.message, 'error'))
  }

  const del = async id => {
    mutate(d => ({ ...d, steps: d.steps.filter(s => s.id !== id) }))
    await db.deleteStep(id).catch(e => toast(e.message, 'error'))
  }

  const saveEdit = async id => {
    const title = editVal.trim()
    if (!title) { setEditId(null); return }
    mutate(d => ({ ...d, steps: d.steps.map(s => s.id === id ? { ...s, title } : s) }))
    await db.updateStep(id, { title }).catch(e => toast(e.message, 'error'))
    setEditId(null)
  }

  const handleBulkAdd = async lines => {
    const maxOrder = steps.length ? Math.max(...steps.map(s => s.sort_order)) : 0
    const rows = lines.map((title, i) => ({ project_id: projId, title, note: '', completed: false, sort_order: maxOrder + i + 1 }))
    try {
      const saved = await db.addStepsBulk(rows)
      mutate(d => ({ ...d, steps: [...d.steps, ...saved] }))
      toast(`${saved.length} steps added`, 'success')
      setShowAdd(false)
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '12px 0 24px' }}>
          {steps.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 20px 8px' }}>{done} of {steps.length} complete</p>
          )}
          {steps.length > 0 && (
            <div className="group">
              {steps.map(s => (
                <div key={s.id} className="cell">
                  <button className="check-btn" onClick={() => toggle(s)}>
                    {s.completed
                      ? <ICheck size={22} color="var(--forest)" sw={2} />
                      : <ICircle size={22} color="var(--text-4)" sw={1.5} />}
                  </button>
                  <div style={{ flex: 1 }}>
                    {editId === s.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="edit-input" value={editVal} onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null) }} autoFocus />
                        <button className="btn-text" onClick={() => saveEdit(s.id)}>Save</button>
                      </div>
                    ) : (
                      <div style={{ textDecoration: s.completed ? 'line-through' : 'none', color: s.completed ? 'var(--text-3)' : 'var(--text)', cursor: 'text' }}
                        onDoubleClick={() => { setEditId(s.id); setEditVal(s.title) }}>
                        {s.title}
                      </div>
                    )}
                    {s.note && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{s.note}</div>}
                  </div>
                  <button className="icon-btn" onClick={() => del(s.id)}><ITrash size={15} /></button>
                </div>
              ))}
            </div>
          )}
          {!steps.length && (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No steps yet</div>
              <p className="empty-sub">Click + to add your build sequence</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}><IPlus size={22} color="#fff" sw={2.5} /></button>
      {showAdd && <BulkAddSheet title="Add Build Steps" hint="Enter one step per line" onSave={handleBulkAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ─── Finishing pane ───────────────────────────────────────────────────────────
function FinishingPane({ projId }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]   = useState(false)
  const [markId, setMarkId]     = useState(null)
  const [editCoat, setEditCoat] = useState(null)

  const coats    = data.coats.filter(c => c.project_id === projId).sort((a, b) => a.coat_number - b.coat_number)
  const lastCoat = coats.at(-1)
  const nextNum  = (lastCoat?.coat_number ?? 0) + 1
  const proj     = data.projects.find(p => p.id === projId)

  const del = async id => {
    mutate(d => ({ ...d, coats: d.coats.filter(c => c.id !== id) }))
    await db.deleteCoat(id).catch(e => toast(e.message, 'error'))
  }

  const markApplied = async (id, dt) => {
    const applied_at = new Date(dt).toISOString()
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === id ? { ...c, applied_at } : c) }))
    await db.updateCoat(id, { applied_at }).catch(e => toast(e.message, 'error'))
    toast('Coat logged', 'success')
    setMarkId(null)
  }

  const handleAdd = async fields => {
    try {
      const coat = await db.addCoat({ project_id: projId, applied_at: null, ...fields })
      mutate(d => ({ ...d, coats: [...d.coats, coat] }))
      toast('Coat added', 'success')
      setShowAdd(false)
    } catch (e) { toast(e.message, 'error') }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === id ? { ...c, ...fields } : c) }))
    await db.updateCoat(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
    setEditCoat(null)
  }

  const calReminder = coat => {
    if (!coat.applied_at) { toast('Mark coat as applied first', 'error'); return }
    const ms      = coat.interval_unit === 'hours' ? coat.interval_value * 3_600_000 : coat.interval_value * 86_400_000
    const readyAt = new Date(new Date(coat.applied_at).getTime() + ms)
    addToGoogleCalendar({ title: `Apply coat ${coat.coat_number + 1} — ${coat.product}${proj ? ` (${proj.name})` : ''}`, start: readyAt, end: new Date(readyAt.getTime() + 3_600_000), description: `Coat ${coat.coat_number} is ready.` })
  }

  const appleReminder = coat => {
    if (!coat.applied_at) { toast('Mark coat as applied first', 'error'); return }
    const ms      = coat.interval_unit === 'hours' ? coat.interval_value * 3_600_000 : coat.interval_value * 86_400_000
    const readyAt = new Date(new Date(coat.applied_at).getTime() + ms)
    addToAppleReminders({ title: `Apply coat ${coat.coat_number + 1} — ${coat.product}`, notes: `Coat ${coat.coat_number} is ready.`, dueDate: readyAt })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '12px 0 24px' }}>
          {coats.length > 0 ? (
            <div className="group">
              {coats.map((coat, idx) => {
                const st      = coatStatus(coat)
                const prevOk  = idx === 0 || !!coats[idx - 1].applied_at
                const locked  = !coat.applied_at && !prevOk
                const applied = !!coat.applied_at
                const circleClass = applied ? 'coat-circle applied' : st.urgent ? 'coat-circle urgent' : 'coat-circle'
                return (
                  <div key={coat.id} style={{ borderBottom: idx < coats.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <div className={circleClass}>{coat.coat_number}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600 }}>{coat.product}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: st.color }}>{st.label}</span>
                            <button className="icon-btn" onClick={() => setEditCoat(coat)}><IEdit size={14} /></button>
                            <button className="icon-btn" onClick={() => del(coat.id)} style={{ color: 'var(--red)' }}><ITrash size={14} /></button>
                          </div>
                        </div>
                        {coat.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{coat.notes}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                          {coat.applied_at ? `Applied ${fmtShort(coat.applied_at)} · ` : ''}Wait {coat.interval_value}{coat.interval_unit === 'hours' ? 'h' : 'd'}
                        </div>
                        {!locked && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <button className={st.urgent ? 'btn-primary' : 'btn-secondary'} onClick={() => setMarkId(coat.id)}>
                              {coat.applied_at ? (st.urgent ? 'Apply next coat' : 'Re-log') : 'Mark applied'}
                            </button>
                            {applied && <>
                              <button className="btn-cal" onClick={() => calReminder(coat)}><ICal size={13} color="currentColor" /> Google Calendar</button>
                              <button className="btn-reminder" onClick={() => appleReminder(coat)}><IBell size={13} color="currentColor" /> Add to Reminders</button>
                            </>}
                          </div>
                        )}
                        {locked && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>Waiting for coat {coat.coat_number - 1}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-icon">🎨</div>
              <div className="empty-title">No finish coats</div>
              <p className="empty-sub">Click + to set up your finishing schedule</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}><IPlus size={22} color="#fff" sw={2.5} /></button>
      {showAdd   && <CoatSheet nextNum={nextNum} defaultCoat={lastCoat} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editCoat  && <CoatSheet nextNum={editCoat.coat_number} defaultCoat={editCoat} isEdit onSave={f => handleEdit(editCoat.id, f)} onClose={() => setEditCoat(null)} />}
      {markId    && (
        <Sheet title="Mark Applied" onClose={() => setMarkId(null)} onSave={async () => {
          const el = document.getElementById('coat-dt-input')
          if (el?.value) await markApplied(markId, el.value)
        }}>
          <div className="form-group">
            <FormCell label="Date & time" last>
              <input id="coat-dt-input" className="form-input" type="datetime-local" defaultValue={localDt()} />
            </FormCell>
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ─── Photo pane ───────────────────────────────────────────────────────────────
function PhotoPane({ projId, type }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [uploading, setUploading]       = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]           = useState(false)
  const fileRef = useRef()

  const photos = data.photos.filter(p => p.project_id === projId && p.photo_type === type)

  const handleFiles = files => {
    const arr = Array.from(files)
    if (!arr.length) return
    setPendingFiles(arr)
    setShowTag(true)
  }

  const doUpload = async (caption, tags) => {
    setShowTag(false)
    for (const file of pendingFiles) {
      setUploading(true)
      try {
        const photo = await db.uploadPhoto(projId, file, caption, type, tags)
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
      } catch (e) { toast('Upload failed: ' + e.message, 'error') }
      setUploading(false)
    }
    setPendingFiles([])
    toast('Photo uploaded', 'success')
  }

  const edit = async (id, fields) => {
    if (fields._delete) {
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      const photo = data.photos.find(p => p.id === id)
      if (photo) await db.deletePhoto(photo).catch(e => toast(e.message, 'error'))
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <DropZone onFiles={handleFiles} uploading={uploading} />
        {photos.length > 0
          ? <PhotoGrid photos={photos} onEdit={edit} />
          : <div className="empty"><div className="empty-icon">📷</div><div className="empty-title">No photos yet</div></div>
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <button className="fab" onClick={() => fileRef.current?.click()} disabled={uploading}>
        {uploading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: '#fff' }} /> : <ICamera size={22} color="#fff" sw={2} />}
      </button>
      {showTag && (
        <Sheet title="Add Photo" onClose={() => { setShowTag(false); setPendingFiles([]) }} onSave={async () => {}}>
          <PhotoTagSheetBody count={pendingFiles.length} onSave={doUpload} />
        </Sheet>
      )}
    </div>
  )
}

function PhotoTagSheetBody({ count, onSave }) {
  const [caption, setCaption] = useState('')
  const [tags, setTags]       = useState([])
  return (
    <div>
      <div className="form-group">
        <FormCell label="Caption" last>
          <input className="form-input" placeholder="Optional" value={caption} onChange={e => setCaption(e.target.value)} autoFocus />
        </FormCell>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 8 }}>Tags</p>
      <TagInput tags={tags} onChange={setTags} />
      <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => onSave(caption, tags.join(','))}>
        Upload {count > 1 ? `${count} photos` : 'photo'}
      </button>
    </div>
  )
}

// ─── Project sheet ────────────────────────────────────────────────────────────
function ProjectSheet({ project, categories, onSave, onClose, mutate }) {
  const toast = useToast()
  const refs = {
    name: useRef(), wood: useRef(), desc: useRef(), status: useRef(),
    rough: useRef(), final: useRef(), builtWith: useRef(),
    woodSource: useRef(), finishUsed: useRef(), year: useRef(),
  }
  const [category, setCategory]   = useState(project?.category || '')
  const [newCat, setNewCat]       = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  const addNewCategory = async () => {
    const name = newCat.trim()
    if (!name) return
    try {
      const cat = await db.addCategory(name)
      mutate(d => ({ ...d, categories: [...(d.categories || []), cat].sort((a,b) => a.name.localeCompare(b.name)) }))
      setCategory(name)
      setNewCat('')
      setShowNewCat(false)
      toast('Category added', 'success')
    } catch (e) { toast(e.message, 'error') }
  }

  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    const yearVal = refs.year.current?.value.trim()
    await onSave({
      name,
      category,
      wood_type:        refs.wood.current?.value.trim()       || '',
      description:      refs.desc.current?.value.trim()       || '',
      status:           refs.status.current?.value            || 'active',
      dimensions_rough: refs.rough.current?.value.trim()      || '',
      dimensions_final: refs.final.current?.value.trim()      || '',
      built_with:       refs.builtWith.current?.value.trim()  || '',
      wood_source:      refs.woodSource.current?.value.trim() || '',
      finish_used:      refs.finishUsed.current?.value.trim() || '',
      year_completed:   yearVal ? parseInt(yearVal) : null,
    })
  }

  return (
    <Sheet title={project ? 'Edit Project' : 'New Project'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Name"><input ref={refs.name} className="form-input" placeholder="Cherry Bowl" defaultValue={project?.name || ''} autoFocus /></FormCell>
        <FormCell label="Category">
          <select className="form-select" value={category} onChange={e => {
            if (e.target.value === '__new__') { setShowNewCat(true) }
            else setCategory(e.target.value)
          }}>
            <option value="">None</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value="__new__">+ Add new category…</option>
          </select>
        </FormCell>
        {showNewCat && (
          <FormCell label="New category">
            <input className="form-input" placeholder="e.g. Turning" value={newCat} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNewCategory()} autoFocus />
            <button className="btn-text" style={{ marginLeft: 8, flexShrink: 0 }} onClick={addNewCategory}>Add</button>
          </FormCell>
        )}
        <FormCell label="Status" last>
          <select ref={refs.status} className="form-select" defaultValue={project?.status || 'active'}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="complete">Complete</option>
          </select>
        </FormCell>
      </div>
      <div className="form-group">
        <FormCell label="Wood species"><input ref={refs.wood} className="form-input" placeholder="Cherry" defaultValue={project?.wood_type || ''} /></FormCell>
        <FormCell label="Wood source"><input ref={refs.woodSource} className="form-input" placeholder="Sherborn back lot" defaultValue={project?.wood_source || ''} /></FormCell>
        <FormCell label="Built with"><input ref={refs.builtWith} className="form-input" placeholder="Solo, with dad…" defaultValue={project?.built_with || ''} /></FormCell>
        <FormCell label="Finish used"><input ref={refs.finishUsed} className="form-input" placeholder="Arm-R-Seal" defaultValue={project?.finish_used || ''} /></FormCell>
        <FormCell label="Year completed"><input ref={refs.year} className="form-input" type="number" placeholder={new Date().getFullYear()} defaultValue={project?.year_completed || ''} /></FormCell>
        <FormCell label="Notes"><input ref={refs.desc} className="form-input" placeholder="Optional" defaultValue={project?.description || ''} /></FormCell>
        <FormCell label="Rough dimensions"><input ref={refs.rough} className="form-input" placeholder='12" × 12"' defaultValue={project?.dimensions_rough || ''} /></FormCell>
        <FormCell label="Final dimensions" last><input ref={refs.final} className="form-input" placeholder='10" × 3"' defaultValue={project?.dimensions_final || ''} /></FormCell>
      </div>
    </Sheet>
  )
}

// ─── Coat sheet ───────────────────────────────────────────────────────────────
function CoatSheet({ nextNum, defaultCoat, isEdit, onSave, onClose }) {
  const refs = { prod: useRef(), num: useRef(), iv: useRef(), iu: useRef(), notes: useRef() }
  const handleSave = async () => {
    const product = refs.prod.current?.value.trim()
    if (!product) return
    await onSave({ product, coat_number: parseInt(refs.num.current?.value) || nextNum, interval_value: parseFloat(refs.iv.current?.value) || 4, interval_unit: refs.iu.current?.value || 'hours', notes: refs.notes.current?.value.trim() || '' })
  }
  return (
    <Sheet title={isEdit ? 'Edit Coat' : 'Add Coat'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Product"><input ref={refs.prod} className="form-input" placeholder="Arm-R-Seal" defaultValue={defaultCoat?.product || ''} autoFocus /></FormCell>
        <FormCell label="Coat #"><input ref={refs.num} className="form-input" type="number" defaultValue={isEdit ? defaultCoat?.coat_number : nextNum} /></FormCell>
        <FormCell label="Wait"><input ref={refs.iv} className="form-input" type="number" defaultValue={defaultCoat?.interval_value ?? 4} /></FormCell>
        <FormCell label="Unit"><select ref={refs.iu} className="form-select" defaultValue={defaultCoat?.interval_unit || 'hours'}><option value="hours">Hours</option><option value="days">Days</option></select></FormCell>
        <FormCell label="Notes" last><input ref={refs.notes} className="form-input" placeholder="Optional" defaultValue={defaultCoat?.notes || ''} /></FormCell>
      </div>
    </Sheet>
  )
}

// ─── Ron Swanson modal ────────────────────────────────────────────────────────
function RonSwansonModal({ onClose }) {
  return (
    <div className="overlay" onClick={onClose} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0F1E38', borderRadius: 16, overflow: 'hidden', maxWidth: 380, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,.5)', animation: 'slideUp .3s cubic-bezier(.32,.72,0,1)' }}>
        <img src="/ronswanson.webp" alt="Ron Swanson" style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover', objectPosition: 'top' }} />
        <div style={{ padding: '20px 24px 24px', textAlign: 'center' }}>
          <p style={{ color: '#F0F4F8', fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 16 }}>
            "A real man always cleans his shop after every project."
          </p>
          <button onClick={onClose} style={{ background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
