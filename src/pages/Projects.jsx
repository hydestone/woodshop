import { useState, useRef, useEffect, useMemo } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import {
  Sheet, FormCell, BulkAddSheet, ConfirmSheet, DropZone, PhotoGrid, TagInput, FilterSelect,
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

  const handleAdd = async (fields, woodStockId) => {
    try {
      const proj = await db.addProject(fields)
      let pws = null
      if (woodStockId) {
        pws = await db.addProjectWoodSource(proj.id, woodStockId)
      }
      // Mutate only after all DB calls succeed
      mutate(d => ({
        ...d,
        projects: [...d.projects, proj],
        projectWoodSources: pws
          ? [...d.projectWoodSources, pws]
          : d.projectWoodSources
      }))
      toast('Project added', 'success')
      setShowAdd(false)
    } catch (e) { toast(e.message, 'error') }
  }

  const categories = data.categories || []
  const filtered = useMemo(() =>
    data.projects
      .filter(p => filter === 'all' || p.category === filter)
      .filter(p => statusFilter === 'all' || p.status === statusFilter),
    [data.projects, filter, statusFilter]
  )

  const groups = useMemo(() =>
    STATUS_ORDER.reduce((acc, s) => {
      const items = filtered.filter(p => p.status === s)
      if (items.length) acc.push({ status: s, items })
      return acc
    }, []),
    [filtered]
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
            <div style={{ marginTop: 10 }}>
              <FilterSelect
                value={filter}
                onChange={setFilter}
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                allLabel="All Categories"
                label="Filter by category"
              />
            </div>
          )}
        </div>

        {/* Desktop table view */}
        {viewMode === 'table'
          ? <ProjectTable projects={filtered} categories={categories} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
          : (
            <div style={{ paddingTop: 8, paddingBottom: 24 }}>
              {groups.map(({ status, items }) => (
                <div key={status}>
                  <span className="section-label">{STATUS_LABEL[status]}</span>
                  {items.map(p => <ProjectCard key={p.id} project={p} onOpen={() => setProjId(p.id)} data={data} stepCounts={stepCountMap[p.id]} urgentCoats={urgentCoatMap[p.id] || 0} />)}
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
function ProjectCard({ project, onOpen, data, stepCounts, urgentCoats = 0 }) {
  const total = stepCounts?.total || 0
  const done  = stepCounts?.done  || 0
  const rc    = urgentCoats
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
            {project.gift_recipient && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🎁 {project.gift_recipient}</span>}
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
  const { data, mutate, projId, setProjId, setTab } = useCtx()
  const toast = useToast()
  const [sub, setSub]           = useState(null)
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

  const handleUpdate = async (fields, woodStockId) => {
    // Snapshot for rollback
    const prevProjects = data.projects
    const prevWoodSources = data.projectWoodSources
    try {
      // Optimistic update
      mutate(d => ({ ...d, projects: d.projects.map(p => p.id === projId ? { ...p, ...fields } : p) }))
      // Persist project fields
      await db.updateProject(projId, fields)
      // Persist wood source junction — only if caller passed woodStockId
      if (woodStockId !== undefined) {
        await db.removeProjectWoodSources(projId)
        const newPws = woodStockId ? await db.addProjectWoodSource(projId, woodStockId) : null
        mutate(d => ({
          ...d,
          projectWoodSources: [
            ...d.projectWoodSources.filter(pws => pws.project_id !== projId),
            ...(newPws ? [newPws] : [])
          ]
        }))
      }
      toast('Saved', 'success')
      setEditing(false)
      if (fields.status === 'complete' && project.status !== 'complete') setShowRon(true)
    } catch (e) {
      // Rollback optimistic updates on failure
      mutate(d => ({ ...d, projects: prevProjects, projectWoodSources: prevWoodSources }))
      toast('Save failed: ' + e.message, 'error')
    }
  }

  const handleShare = () => {
    const url = `${window.location.origin}/portfolio?project=${projId}`
    if (navigator.share) {
      navigator.share({ title: project.name, url }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(url).then(() => toast('Link copied', 'success')).catch(() => toast(url, 'success'))
    }
  }

  const handlePrint = () => {
    const photos = data.photos.filter(p => p.project_id === projId)
    const steps = data.steps.filter(s => s.project_id === projId)
    const coats = data.coats.filter(c => c.project_id === projId)
    const timeEntries = project.time_entries ? JSON.parse(project.time_entries) : []
    const costEntries = project.cost_entries ? JSON.parse(project.cost_entries) : []
    const totalMins = timeEntries.reduce((s, e) => s + (e.minutes || 0), 0)
    const totalCost = costEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>${project.name} — JDH Woodworks</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, sans-serif; color: #0F172A; padding: 32px; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
      .meta { font-size: 13px; color: #64748B; margin-bottom: 24px; display: flex; gap: 12px; flex-wrap: wrap; }
      .pill { background: #DBEAFE; color: #1D4ED8; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
      h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #64748B; margin: 24px 0 8px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
      .cell { background: #F0F4F8; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
      .cell b { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #94A3B8; margin-bottom: 2px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      td, th { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; text-align: left; }
      th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #94A3B8; }
      .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
      .photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
      .footer { margin-top: 32px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 16px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="pill">${project.status || 'planning'}</div>
    <h1 style="margin-top:8px">${project.name}</h1>
    <div class="meta">
      ${project.wood_type ? `<span>🪵 ${project.wood_type}</span>` : ''}
      ${project.finish_used ? `<span>🎨 ${project.finish_used}</span>` : ''}
      ${project.year_completed ? `<span>📅 ${project.year_completed}</span>` : ''}
      ${project.category ? `<span>📁 ${project.category}</span>` : ''}
    </div>
    ${project.description ? `<p style="font-size:14px;color:#334155;margin-bottom:16px">${project.description}</p>` : ''}
    <div class="grid">
      ${totalMins > 0 ? `<div class="cell"><b>Total Time</b>${totalMins >= 60 ? Math.floor(totalMins/60)+'h '+(totalMins%60)+'m' : totalMins+'m'}</div>` : ''}
      ${totalCost > 0 ? `<div class="cell"><b>Material Cost</b>$${totalCost.toFixed(2)}</div>` : ''}
    </div>
    ${steps.length > 0 ? `<h2>Build Steps</h2><table><thead><tr><th>Step</th><th>Status</th></tr></thead><tbody>${steps.map(s => `<tr><td>${s.content || s.description || ''}</td><td>${s.completed ? '✓ Done' : 'Open'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${coats.length > 0 ? `<h2>Finishing</h2><table><thead><tr><th>Product</th><th>Coat</th><th>Notes</th></tr></thead><tbody>${coats.map(c => `<tr><td>${c.product || ''}</td><td>#${c.coat_number || 1}</td><td>${c.notes || ''}</td></tr>`).join('')}</tbody></table>` : ''}
    ${timeEntries.length > 0 ? `<h2>Time Log</h2><table><thead><tr><th>Date</th><th>Duration</th><th>Note</th></tr></thead><tbody>${timeEntries.map(e => `<tr><td>${e.date || ''}</td><td>${e.minutes >= 60 ? Math.floor(e.minutes/60)+'h '+(e.minutes%60)+'m' : e.minutes+'m'}</td><td>${e.note || ''}</td></tr>`).join('')}</tbody></table>` : ''}
    ${costEntries.length > 0 ? `<h2>Cost Breakdown</h2><table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>${costEntries.map(e => `<tr><td>${e.label || ''}</td><td>$${parseFloat(e.amount || 0).toFixed(2)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${photos.length > 0 ? `<h2>Photos</h2><div class="photos">${photos.slice(0,9).map(p => `<img src="${p.url}" alt="${p.caption || ''}"/>`).join('')}</div>` : ''}
    <div class="footer">JDH Woodworks · ${project.name} · Printed ${new Date().toLocaleDateString()}</div>
    </body></html>`)
    win.document.close()
    setTimeout(() => win.print(), 400)
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

  const steps      = data.steps.filter(s => s.project_id === projId)
  const coats      = data.coats.filter(c => c.project_id === projId)
  const photos     = data.photos.filter(p => p.project_id === projId)
  const stepsDone  = steps.filter(s => s.completed).length

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg)' }} className="slide-in">

      {/* ── Header ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button className="back-btn" onClick={() => setProjId(null)}>
            <IChevL size={16} color="currentColor" sw={2.2} />
            Projects
          </button>
          <div style={{ display: 'flex', gap: 2 }}>
            {(() => {
              const sorted = data.projects.slice().sort((a,b) => a.name.localeCompare(b.name))
              const idx = sorted.findIndex(p => p.id === projId)
              return (
                <>
                  <button className="icon-btn" disabled={idx <= 0} onClick={() => setProjId(sorted[idx-1].id)} aria-label="Previous project" style={{ opacity: idx <= 0 ? .3 : 1 }}>
                    <IChevL size={16} color="var(--text-3)" sw={2} />
                  </button>
                  <button className="icon-btn" disabled={idx >= sorted.length - 1} onClick={() => setProjId(sorted[idx+1].id)} aria-label="Next project" style={{ opacity: idx >= sorted.length - 1 ? .3 : 1 }}>
                    <IChevR size={16} color="var(--text-3)" sw={2} />
                  </button>
                </>
              )
            })()}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" onClick={handleShare} aria-label="Share project" title="Copy share link">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            <button className="icon-btn" onClick={handlePrint} aria-label="Print / PDF" title="Print or save as PDF">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
            </button>
            <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit project"><IEdit size={17} /></button>
            <button className="icon-btn" onClick={() => setConfirming(true)} aria-label="Delete project" style={{ color: 'var(--red)' }}><ITrash size={17} /></button>
          </div>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{project.name}</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {project.category && <span style={{ fontSize: 12, background: 'var(--blue-dim)', color: 'var(--blue)', borderRadius: 99, padding: '2px 10px', fontWeight: 600 }}>{project.category}</span>}
          {project.wood_type && <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{project.wood_type}</span>}
          {project.year_completed && <span style={{ fontSize: 13, color: 'var(--text-4)' }}>{project.year_completed}</span>}
          <button className="badge-pill" style={{ background: ss.bg, color: ss.color, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={cycleStatus} title="Tap to change status">
            {project.status} ▾
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {project.built_with    && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>👤 {project.built_with}</span>}
          {project.finish_used   && (
            <button
              className="btn-text"
              style={{ fontSize: 12, color: 'var(--accent)', padding: 0 }}
              onClick={() => setTab('finishes')}
              title="View finish details"
            >
              {project.finish_used} ↗
            </button>
          )}
          {project.gift_recipient&& <span style={{ fontSize: 12, color: 'var(--text-3)' }}>🎁 {project.gift_recipient}</span>}
          {project.description   && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{project.description}</span>}
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-2)' }} className="proj-detail-grid">

        {/* Left — Build Steps */}
        <div style={{ background: 'var(--surface)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div className="label-caps">Build Steps</div>
              {steps.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>{stepsDone} of {steps.length} complete</div>}
            </div>
            <button className="icon-btn" onClick={() => setSub('steps-add')} aria-label="Add step"><IPlus size={18} color="var(--accent)" /></button>
          </div>
          <StepsList projId={projId} />
        </div>

        {/* Right — Finishing */}
        <div style={{ background: 'var(--surface)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="label-caps">Finishing</div>
            <button className="icon-btn" onClick={() => setSub('finish-add')} aria-label="Add coat"><IPlus size={18} color="var(--accent)" /></button>
          </div>
          <FinishingList projId={projId} sub={sub} setSub={setSub} />
        </div>
      </div>

      {/* ── Time & Cost ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-2)', marginTop: 1 }}>
        <TimeTracker project={project} onSave={handleUpdate} />
        <CostTracker project={project} onSave={handleUpdate} />
      </div>

      {/* ── Photos full-width ── */}
      <div style={{ background: 'var(--surface)', marginTop: 1, padding: '20px' }}>
        <PhotoTimeline projId={projId} />
      </div>

      {/* ── Inspiration ── */}
      {data.photos.filter(p => p.project_id === projId && p.photo_type === 'inspiration').length > 0 && (
        <div style={{ background: 'var(--surface)', marginTop: 1, padding: '20px' }}>
          <div className="label-caps" style={{ marginBottom: 12 }}>Inspiration</div>
          <PhotoPane projId={projId} type="inspiration" inline />
        </div>
      )}

      <div style={{ height: 20 }} />

      {editing    && <ProjectSheet project={project} categories={categories} onSave={handleUpdate} onClose={() => setEditing(false)} mutate={mutate} />}
      {confirming && <ConfirmSheet message={`Delete "${project.name}"? All steps, coats, and photos will be removed. This cannot be undone.`} onConfirm={handleDelete} onClose={() => setConfirming(false)} />}
      {showRon    && <RonSwansonModal onClose={() => setShowRon(false)} />}

      {/* Add steps sheet */}
      {sub === 'steps-add' && (
        <BulkAddSheet title="Add Build Steps" hint="Enter one step per line"
          onSave={async lines => {
            const existing = data.steps.filter(s => s.project_id === projId)
            const maxOrder = existing.length ? Math.max(...existing.map(s => s.sort_order)) : 0
            const rows = lines.map((title, i) => ({ project_id: projId, title, note: '', completed: false, sort_order: maxOrder + i + 1 }))
            const saved = await db.addStepsBulk(rows)
            mutate(d => ({ ...d, steps: [...d.steps, ...saved] }))
            setSub(null)
          }}
          onClose={() => setSub(null)}
        />
      )}
      {/* Add coat sheet */}
      {sub === 'finish-add' && (
        <CoatSheet
          nextNum={(data.coats.filter(c=>c.project_id===projId).at(-1)?.coat_number??0)+1}
          defaultCoat={data.coats.filter(c=>c.project_id===projId).at(-1)}
          onSave={async fields => {
            const coat = await db.addCoat({ project_id: projId, applied_at: null, ...fields })
            mutate(d => ({ ...d, coats: [...d.coats, coat] }))
            setSub(null)
          }}
          onClose={() => setSub(null)}
        />
      )}
    </div>
  )
}


// ─── StepsList (inline for two-column layout) ─────────────────────────────────
function StepsList({ projId }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [editId, setEditId] = useState(null)
  const [editVal, setEditVal] = useState('')

  const steps = data.steps.filter(s => s.project_id === projId).sort((a, b) => a.sort_order - b.sort_order)

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

  if (!steps.length) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-4)', fontSize: 13 }}>No steps yet — click + to add</div>
  )

  return (
    <div>
      {steps.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-2)' }}>
          <button className="check-btn" onClick={() => toggle(s)} style={{ flexShrink: 0, marginTop: 1 }}>
            {s.completed ? <ICheck size={20} color="var(--forest)" sw={2} /> : <ICircle size={20} color="var(--text-4)" sw={1.5} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editId === s.id ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="edit-input" value={editVal} onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null) }} autoFocus />
                <button className="btn-text" onClick={() => saveEdit(s.id)}>Save</button>
              </div>
            ) : (
              <div style={{ fontSize: 14, textDecoration: s.completed ? 'line-through' : 'none', color: s.completed ? 'var(--text-4)' : 'var(--text)', cursor: 'text' }}
                onDoubleClick={() => { setEditId(s.id); setEditVal(s.title) }}>
                {s.title}
              </div>
            )}
            {s.note && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.note}</div>}
          </div>
          <button className="icon-btn" onClick={() => del(s.id)} style={{ flexShrink: 0 }}><ITrash size={14} /></button>
        </div>
      ))}
    </div>
  )
}


// ─── FinishingList (inline for two-column layout) ─────────────────────────────
function FinishingList({ projId, sub, setSub }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [markId, setMarkId]     = useState(null)
  const [editCoat, setEditCoat] = useState(null)

  const coats = data.coats.filter(c => c.project_id === projId).sort((a, b) => a.coat_number - b.coat_number)
  const proj  = data.projects.find(p => p.id === projId)

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

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === id ? { ...c, ...fields } : c) }))
    await db.updateCoat(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
    setEditCoat(null)
  }

  if (!coats.length) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-4)', fontSize: 13 }}>No coats yet — click + to add</div>
  )

  return (
    <div>
      {coats.map((coat, idx) => {
        const st     = coatStatus(coat)
        const prevOk = idx === 0 || !!coats[idx - 1].applied_at
        const locked = !coat.applied_at && !prevOk
        const applied= !!coat.applied_at
        const circleClass = applied ? 'coat-circle applied' : st.urgent ? 'coat-circle urgent' : 'coat-circle'
        return (
          <div key={coat.id} style={{ borderBottom: idx < coats.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '12px 0' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className={circleClass} style={{ flexShrink: 0 }}>{coat.coat_number}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{coat.product}</span>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: st.color }}>{st.label}</span>
                    <button className="icon-btn" onClick={() => setEditCoat(coat)}><IEdit size={13} /></button>
                    <button className="icon-btn" onClick={() => del(coat.id)} style={{ color: 'var(--red)' }}><ITrash size={13} /></button>
                  </div>
                </div>
                {coat.notes && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{coat.notes}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  {coat.applied_at ? `Applied ${fmtShort(coat.applied_at)} · ` : ''}Wait {coat.interval_value}{coat.interval_unit === 'hours' ? 'h' : 'd'}
                </div>
                {!locked && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <button className={st.urgent ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setMarkId(coat.id)}>
                      {coat.applied_at ? (st.urgent ? 'Apply next coat' : 'Re-log') : 'Mark applied'}
                    </button>
                    {applied && <>
                      <button className="btn-cal" onClick={() => {
                        const ms = coat.interval_unit==='hours' ? coat.interval_value*3600000 : coat.interval_value*86400000
                        const readyAt = new Date(new Date(coat.applied_at).getTime()+ms)
                        addToGoogleCalendar({ title: `Apply coat ${coat.coat_number+1} — ${coat.product}${proj?` (${proj.name})`:''}`, start: readyAt, end: new Date(readyAt.getTime()+3600000), description: `Coat ${coat.coat_number} is ready.` })
                      }}><ICal size={12} color="currentColor" /> Calendar</button>
                      <button className="btn-reminder" onClick={() => {
                        const ms = coat.interval_unit==='hours' ? coat.interval_value*3600000 : coat.interval_value*86400000
                        const readyAt = new Date(new Date(coat.applied_at).getTime()+ms)
                        addToAppleReminders({ title: `Apply coat ${coat.coat_number+1} — ${coat.product}`, notes: `Coat ${coat.coat_number} is ready.`, dueDate: readyAt })
                      }}><IBell size={12} color="currentColor" /> Reminders</button>
                    </>}
                  </div>
                )}
                {locked && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Waiting for coat {coat.coat_number - 1}</div>}
              </div>
            </div>
          </div>
        )
      })}
      {markId && (
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
      {editCoat && <CoatSheet nextNum={editCoat.coat_number} defaultCoat={editCoat} isEdit onSave={f => handleEdit(editCoat.id, f)} onClose={() => setEditCoat(null)} />}
    </div>
  )
}

// StepsPane removed — replaced by StepsList

// ─── Time Tracker ────────────────────────────────────────────────────────────
function TimeTracker({ project, onSave }) {
  const toast = useToast()
  const [show, setShow] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [hrs, setHrs]   = useState('')
  const [mins, setMins] = useState('')
  const [note, setNote] = useState('')

  const entries = (() => { try { return JSON.parse(project.time_entries || '[]') } catch { return [] } })()
  const totalMins = entries.reduce((s, e) => s + (e.minutes || 0), 0)

  const save = async () => {
    const m = (parseInt(hrs)||0)*60 + (parseInt(mins)||0)
    if (!m) { toast('Enter a duration', 'error'); return }
    const entry = { id: Math.random().toString(36).slice(2), date, minutes: m, note: note.trim() }
    const next = [...entries, entry]
    await onSave({ time_entries: JSON.stringify(next) })
    setHrs(''); setMins(''); setNote(''); setShow(false)
    toast('Time logged', 'success')
  }

  const remove = async (id) => {
    const next = entries.filter(e => e.id !== id)
    await onSave({ time_entries: JSON.stringify(next) })
    toast('Removed', 'success')
  }

  const fmtMins = m => m >= 60 ? `${Math.floor(m/60)}h ${m%60 > 0 ? m%60+'m' : ''}`.trim() : `${m}m`

  return (
    <div style={{ background: 'var(--surface)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="label-caps">Time</div>
          {totalMins > 0 && <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{fmtMins(totalMins)}</div>}
        </div>
        <button className="icon-btn" onClick={() => setShow(s => !s)} aria-label="Log time"><IPlus size={18} color="var(--accent)" /></button>
      </div>

      {show && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="cell-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <input className="form-input" type="number" min="0" placeholder="0h" value={hrs} onChange={e => setHrs(e.target.value)}
              style={{ width: 52, background: 'var(--fill)', borderRadius: 8, padding: '7px 8px', border: '1px solid var(--border-2)', fontSize: 13, textAlign: 'center' }} />
            <input className="form-input" type="number" min="0" max="59" placeholder="00m" value={mins} onChange={e => setMins(e.target.value)}
              style={{ width: 52, background: 'var(--fill)', borderRadius: 8, padding: '7px 8px', border: '1px solid var(--border-2)', fontSize: 13, textAlign: 'center' }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="cell-input" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} />
            <button className="btn-primary" style={{ padding: '0 14px', fontSize: 13, flexShrink: 0 }} onClick={save}>Log</button>
            <button className="btn-text" style={{ fontSize: 13 }} onClick={() => setShow(false)}>✕</button>
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.slice().sort((a,b) => b.date?.localeCompare(a.date)).map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div style={{ color: 'var(--text-3)' }}>{e.date} {e.note && <span style={{ color: 'var(--text-4)' }}>· {e.note}</span>}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtMins(e.minutes)}</span>
                <button className="icon-btn" onClick={() => remove(e.id)} style={{ color: 'var(--red)', padding: 0 }}><ITrash size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No time logged yet</div>
      )}
    </div>
  )
}

// ─── Cost Tracker ─────────────────────────────────────────────────────────────
function CostTracker({ project, onSave }) {
  const toast = useToast()
  const [show, setShow] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const entries = (() => { try { return JSON.parse(project.cost_entries || '[]') } catch { return [] } })()
  const total = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

  const save = async () => {
    if (!label.trim() || !amount) { toast('Enter item and amount', 'error'); return }
    const entry = { id: Math.random().toString(36).slice(2), label: label.trim(), amount: parseFloat(amount) }
    const next = [...entries, entry]
    await onSave({ cost_entries: JSON.stringify(next) })
    setLabel(''); setAmount(''); setShow(false)
    toast('Cost added', 'success')
  }

  const remove = async (id) => {
    const next = entries.filter(e => e.id !== id)
    await onSave({ cost_entries: JSON.stringify(next) })
  }

  return (
    <div style={{ background: 'var(--surface)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="label-caps">Cost</div>
          {total > 0 && <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>${total.toFixed(2)}</div>}
        </div>
        <button className="icon-btn" onClick={() => setShow(s => !s)} aria-label="Add cost"><IPlus size={18} color="var(--accent)" /></button>
      </div>

      {show && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="cell-input" placeholder="Item (e.g. Lumber)" value={label} onChange={e => setLabel(e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--fill)', borderRadius: 8, border: '1px solid var(--border-2)', paddingLeft: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>$</span>
              <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                style={{ width: 72, padding: '7px 8px', fontSize: 13, textAlign: 'right' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={save}>Add</button>
            <button className="btn-text" style={{ fontSize: 13 }} onClick={() => setShow(false)}>✕</button>
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>{e.label}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>${parseFloat(e.amount||0).toFixed(2)}</span>
                <button className="icon-btn" onClick={() => remove(e.id)} style={{ color: 'var(--red)', padding: 0 }}><ITrash size={12} /></button>
              </div>
            </div>
          ))}
          {entries.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, paddingTop: 4, borderTop: '1px solid var(--border-2)', marginTop: 2 }}>
              <span>Total</span><span>${total.toFixed(2)}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-4)', fontStyle: 'italic' }}>No costs logged yet</div>
      )}
    </div>
  )
}

// ─── Photo Timeline ───────────────────────────────────────────────────────────
function PhotoTimeline({ projId }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'timeline'

  const photos = data.photos
    .filter(p => p.project_id === projId)
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  const edit = async (id, fields) => {
    if (fields._delete) {
      const photo = data.photos.find(p => p.id === id)
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      if (photo) await db.deletePhoto(photo).catch(e => toast(e.message, 'error'))
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
  }

  // Group by date for timeline view
  const byDate = photos.reduce((acc, p) => {
    const d = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'
    if (!acc[d]) acc[d] = []
    acc[d].push(p)
    return acc
  }, {})

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="label-caps">
          Photos{photos.length > 0 ? ` · ${photos.length}` : ''}
        </div>
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setViewMode('grid')} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600,
              background: viewMode === 'grid' ? 'var(--accent)' : 'var(--fill)',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-3)',
            }}>Grid</button>
            <button onClick={() => setViewMode('timeline')} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600,
              background: viewMode === 'timeline' ? 'var(--accent)' : 'var(--fill)',
              color: viewMode === 'timeline' ? '#fff' : 'var(--text-3)',
            }}>Timeline</button>
          </div>
        )}
      </div>

      {viewMode === 'grid' ? (
        <PhotoPaneInline projId={projId} />
      ) : (
        <div>
          {Object.entries(byDate).map(([date, datePhs]) => (
            <div key={date} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 1, flex: 1, background: 'var(--border-2)' }} />
                {date}
                <div style={{ height: 1, flex: 1, background: 'var(--border-2)' }} />
              </div>
              <PhotoGrid photos={datePhs} onEdit={edit} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Thin wrapper so PhotoPane can be used inline from PhotoTimeline
function PhotoPaneInline({ projId }) {
  return <PhotoPane projId={projId} type="progress" showAll inline />
}

// ─── Photo pane ───────────────────────────────────────────────────────────────
function PhotoPane({ projId, type, showAll, inline }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [uploading, setUploading]       = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]           = useState(false)
  const fileRef = useRef()

  const photos = data.photos.filter(p => p.project_id === projId && (showAll ? true : p.photo_type === type))

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

  if (inline) return (
    <div style={{ position: 'relative' }}>
      <PhotoGrid photos={photos} onEdit={edit} />
      {photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-4)', fontSize: 13 }}>
          No photos yet — tap + to add
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 12, padding: '8px 14px',
          background: 'var(--accent)', color: 'var(--white)',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          opacity: uploading ? .6 : 1,
        }}
      >
        {uploading
          ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff' }} />
          : <ICamera size={14} color="#fff" sw={2} />}
        {uploading ? 'Uploading…' : 'Add Photo'}
      </button>
      {showTag && (
        <Sheet title="Add Photo" onClose={() => { setShowTag(false); setPendingFiles([]) }} onSave={async () => {}}>
          <PhotoTagSheetBody count={pendingFiles.length} onSave={doUpload} />
        </Sheet>
      )}
    </div>
  )

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
function ManagedSelect({ label, value, onChange, items, onAddNew, addLabel, last }) {
  const [showNew, setShowNew] = useState(false)
  const [newVal, setNewVal]   = useState('')
  const toast = useToast()

  const handleAdd = async () => {
    const name = newVal.trim(); if (!name) return
    try {
      await onAddNew(name)
      onChange(name)
      setNewVal(''); setShowNew(false)
    } catch(e) { toast(e.message, 'error') }
  }

  return (
    <>
      <FormCell label={label} last={last && !showNew}>
        <select className="form-select" value={value} onChange={e => {
          if (e.target.value === '__new__') setShowNew(true)
          else { onChange(e.target.value); setShowNew(false) }
        }}>
          <option value="">None</option>
          {items.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
          <option value="__new__">+ Add {addLabel}…</option>
        </select>
      </FormCell>
      {showNew && (
        <FormCell label={`New ${addLabel}`} last={last}>
          <input className="form-input" placeholder={`e.g. ${addLabel}`} value={newVal}
            onChange={e=>setNewVal(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&handleAdd()} autoFocus/>
          <button className="btn-text" style={{marginLeft:8,flexShrink:0}} onClick={handleAdd}>Add</button>
        </FormCell>
      )}
    </>
  )
}

function ProjectSheet({ project, categories, onSave, onClose, mutate }) {
  const { data } = useCtx()
  const toast = useToast()
  const refs = {
    name: useRef(), desc: useRef(), status: useRef(),
    final: useRef(), builtWith: useRef(), year: useRef(), giftRecipient: useRef(),
  }
  const [category,   setCategory]   = useState(project?.category    || '')
  const [finishVal,  setFinishVal]  = useState(project?.finish_used || '')
  const existingWoodSrc = data?.projectWoodSources?.find(pws => pws.project_id === project?.id)
  const [woodSrcId, setWoodSrcId] = useState(() => {
    // useState initializer function runs once on mount with current data
    const pws = data?.projectWoodSources?.find(p => p.project_id === project?.id)
    return pws?.wood_stock_id || ''
  })

  const woodLocations = data?.woodLocations || []
  const woodStock     = data?.woodStock     || []
  const finishesList  = data?.finishes      || []

  // Group stock by location for the dropdown
  const stockGroups = woodLocations.map(loc => ({
    loc,
    items: woodStock.filter(w => w.location_id === loc.id && w.status !== 'Used up')
  })).filter(g => g.items.length > 0)
  const unlocated = woodStock.filter(w => !w.location_id && w.status !== 'Used up')

  const handleSave = async () => {
    const name = refs.name.current?.value.trim(); if (!name) return
    const yearVal = refs.year.current?.value.trim()
    const fi = finishesList.find(f => f.name === finishVal)
    // Derive wood_type from selected wood stock entry's species
    const selectedStock = woodStock.find(w => w.id === woodSrcId)
    const derivedWoodType = selectedStock?.species || ''
    await onSave({
      name,
      category,
      wood_type:        derivedWoodType,
      description:      refs.desc.current?.value.trim()       || '',
      status:           refs.status.current?.value            || 'active',
      dimensions_final: refs.final.current?.value.trim()      || '',
      built_with:       refs.builtWith.current?.value.trim()  || '',
      finish_used:      finishVal,
      finish_id:        fi?.id || null,
      year_completed:   yearVal ? parseInt(yearVal) : null,
      gift_recipient:   refs.giftRecipient.current?.value.trim() || '',
    }, woodSrcId || null)
  }

  return (
    <Sheet title={project ? 'Edit Project' : 'New Project'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Name"><input ref={refs.name} className="form-input" placeholder="Cherry Bowl" defaultValue={project?.name || ''} autoFocus /></FormCell>
        <ManagedSelect label="Category" value={category} onChange={setCategory}
          items={categories} addLabel="category"
          onAddNew={async name => {
            const cat = await db.addCategory(name)
            mutate(d => ({ ...d, categories: [...(d.categories||[]), cat].sort((a,b)=>a.name.localeCompare(b.name)) }))
          }}
        />
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
        <FormCell label="Wood source">
          <select className="form-select" value={woodSrcId} onChange={e=>setWoodSrcId(e.target.value)}>
            <option value="">None</option>
            {stockGroups.map(g => (
              <optgroup key={g.loc.id} label={g.loc.name}>
                {g.items.map(w => <option key={w.id} value={w.id}>{w.species}{w.harvested_at?' · '+new Date(w.harvested_at).getFullYear():''} · {w.status}</option>)}
              </optgroup>
            ))}
            {unlocated.length > 0 && (
              <optgroup label="No location">
                {unlocated.map(w => <option key={w.id} value={w.id}>{w.species}{w.harvested_at?' · '+new Date(w.harvested_at).getFullYear():''}</option>)}
              </optgroup>
            )}
          </select>
        </FormCell>
        <FormCell label="Built with"><input ref={refs.builtWith} className="form-input" placeholder="Solo, with dad…" defaultValue={project?.built_with || ''} /></FormCell>
        <ManagedSelect label="Finish used" value={finishVal} onChange={setFinishVal}
          items={finishesList} addLabel="finish"
          onAddNew={async name => {
            const f = await db.addFinish(name)
            mutate(d => ({ ...d, finishes: [...(d.finishes||[]), f].sort((a,b)=>a.name.localeCompare(b.name)) }))
          }}
        />
        <FormCell label="Year completed"><input ref={refs.year} className="form-input" type="number" placeholder={new Date().getFullYear()} defaultValue={project?.year_completed || ''} /></FormCell>
        <FormCell label="Notes"><input ref={refs.desc} className="form-input" placeholder="Optional" defaultValue={project?.description || ''} /></FormCell>
        <FormCell label="Gift / recipient"><input ref={refs.giftRecipient} className="form-input" placeholder="Dad, Christmas 2023" defaultValue={project?.gift_recipient || ''} /></FormCell>
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
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--navy)', borderRadius: 16, overflow: 'hidden', maxWidth: 380, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,.5)', animation: 'slideUp .3s cubic-bezier(.32,.72,0,1)' }}>
        <img src="/ronswanson.webp" alt="Ron Swanson" style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover', objectPosition: 'top' }} />
        <div style={{ padding: '20px 24px 24px', textAlign: 'center' }}>
          <p style={{ color: '#F0F4F8', fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 16 }}>
            "A real man always cleans his shop after every project."
          </p>
          <button onClick={onClose} style={{ background: '#1D4ED8', color: 'var(--white)', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
