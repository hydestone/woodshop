import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { hapticLight } from '../db.js'
import { addToGoogleCalendar } from '../supabase.js'
import {
  Sheet, FormCell, BulkAddSheet, ConfirmSheet, DropZone, PhotoGrid, PhotoImg, TagInput, FilterSelect, SwipeRow,
  STATUS, coatStatus, fmtShort, localDt, useLongPress, BeforeAfterCompare,
  IPlus, ITrash, ICircle, ICheck, IChevR, IChevL, IEdit, ICal, ICamera, IBell, IGrid, IStar, IList, IDollar,
} from '../components/Shared.jsx'

const STATUS_ORDER = ['active', 'planning', 'complete']
const STATUS_LABEL = { active: 'Active', planning: 'Planning', complete: 'Complete' }

export function ProjectDetail() {
  const { data, mutate, projId, setProjId, setTab } = useCtx()
  const toast = useToast()
  const [sub, setSub]           = useState(null)
  const [editing, setEditing]   = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showRon, setShowRon]   = useState(false)
  const [showQRLabel, setShowQRLabel] = useState(false)
  const photoInputRef = useRef(null)

  const handleQuickPhotoUpload = async (e) => {
    const files = e.target.files
    if (!files?.length) return
    setSub(null)
    for (const file of files) {
      try {
        const photo = await db.uploadPhoto(projId, file, '', 'progress', [])
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
      } catch (err) { toast(err.message, 'error') }
    }
    toast(`${files.length} photo${files.length > 1 ? 's' : ''} added`, 'success')
    e.target.value = ''
  }
  const [showReminder, setShowReminder] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [dtab, setDtab]         = useState(() => window.innerWidth < 768 ? 'steps' : 'overview')
  const isMobile = window.innerWidth < 768
  const DTABS = isMobile ? ['steps', 'finishing', 'photos'] : ['overview', 'steps', 'finishing', 'photos']
  const swipeRef = useRef(null)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = e => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    touchStartX.current = null
    // Only respond to predominantly horizontal swipes > 50px
    if (Math.abs(dx) < 50 || dy > Math.abs(dx) * 0.8) return
    const cur = DTABS.indexOf(dtab)
    if (dx < 0 && cur < DTABS.length - 1) setDtab(DTABS[cur + 1])
    if (dx > 0 && cur > 0) setDtab(DTABS[cur - 1])
  }

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
    const prevProjects = data.projects
    const prevWoodSources = data.projectWoodSources
    try {
      // Optimistic update
      mutate(d => ({ ...d, projects: d.projects.map(p => p.id === projId ? { ...p, ...fields } : p) }))
      await db.updateProject(projId, fields)
      // Persist wood source junction — only if caller passed woodStockId
      if (woodStockId !== undefined) {
        const oldIds = data.projectWoodSources.filter(pws => pws.project_id === projId).map(pws => pws.id)
        try {
          // Delete old rows first, then add new — avoids duplicate window
          for (const oldId of oldIds) await db.removeProjectWoodSource(oldId)
          const newPws = woodStockId ? await db.addProjectWoodSource(projId, woodStockId) : null
          mutate(d => ({
            ...d,
            projectWoodSources: [
              ...d.projectWoodSources.filter(pws => pws.project_id !== projId),
              ...(newPws ? [newPws] : [])
            ]
          }))
        } catch (wsErr) {
          // Wood source update failed — rollback to previous junction state
          mutate(d => ({ ...d, projectWoodSources: prevWoodSources }))
          toast(`Project saved but wood source link failed: ${wsErr.message}`, 'error')
          setEditing(false)
          return
        }
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
    const projPhotos = data.photos.filter(p => p.project_id === projId)
    const projSteps  = data.steps.filter(s => s.project_id === projId)
    const projCoats  = data.coats.filter(c => c.project_id === projId)
    const timeEntries = project.time_entries ? JSON.parse(project.time_entries) : []
    const costEntries = project.cost_entries ? JSON.parse(project.cost_entries) : []
    const totalMins  = timeEntries.reduce((s, e) => s + (e.minutes || 0), 0)
    const totalCost  = costEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
    const fmtMins = m => m >= 60 ? `${Math.floor(m/60)}h ${m%60 > 0 ? m%60+'m' : ''}`.trim() : `${m}m`
    const finishedPhotos = projPhotos.filter(p => p.tags?.includes('finished'))
    const progressPhotos = projPhotos.filter(p => !p.tags?.includes('finished'))

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
<title>${project.name} — JDH Woodworks</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Arial,sans-serif;color:#0F172A;padding:36px;max-width:820px;margin:0 auto;font-size:13px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F172A;padding-bottom:14px;margin-bottom:20px}
  .brand{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748B}
  .brand span{color:#2D5A3D}
  h1{font-size:26px;font-weight:900;letter-spacing:-.02em;margin:6px 0 4px}
  .meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#64748B}
  .pill{display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px}
  .pill-active{background:#DBEAFE;color:#1D4ED8}
  .pill-complete{background:#DCFCE7;color:#15803D}
  .pill-planning{background:#EDE9FE;color:#7C3AED}
  h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94A3B8;margin:22px 0 8px;border-bottom:1px solid #E2E8F0;padding-bottom:4px}
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:4px}
  .stat{background:#F8FAFC;border:1px solid #E2E8F0;padding:10px 12px}
  .stat-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin-bottom:3px}
  .stat-val{font-size:18px;font-weight:800;color:#0F172A}
  table{width:100%;border-collapse:collapse;margin-bottom:4px}
  th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;padding:6px 8px;border-bottom:2px solid #E2E8F0;text-align:left}
  td{padding:7px 8px;border-bottom:1px solid #F1F5F9;vertical-align:top}
  .done{color:#15803D;font-weight:600}
  .photo-grid{display:grid;gap:6px;margin-top:4px}
  .photo-grid-3{grid-template-columns:repeat(3,1fr)}
  .photo-grid-2{grid-template-columns:repeat(2,1fr)}
  .photo-grid-1{grid-template-columns:1fr}
  .photo-grid img{width:100%;aspect-ratio:4/3;object-fit:cover}
  .photo-caption{font-size:10px;color:#64748B;margin-top:2px}
  .footer{margin-top:28px;font-size:10px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;padding-top:12px}
  .no-print{margin-top:20px;text-align:center}
  @page{size:8.5in 11in;margin:.6in}
  @media print{body{padding:0}.no-print{display:none}}
</style></head><body>

<div class="header">
  <div>
    <div class="brand">JDH <span>Woodworks</span></div>
    <h1>${project.name}</h1>
    <div class="meta">
      ${project.wood_type?`<span>🪵 ${project.wood_type}</span>`:''}
      ${project.finish_used?`<span>🎨 ${project.finish_used}</span>`:''}
      ${project.category?`<span>📁 ${project.category}</span>`:''}
      ${project.year_completed?`<span>📅 ${project.year_completed}</span>`:''}
    </div>
  </div>
  <div style="text-align:right">
    <div class="pill pill-${project.status||'planning'}">${project.status||'planning'}</div>
    <div style="font-size:11px;color:#94A3B8;margin-top:4px">Exported ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
  </div>
</div>

${project.description?`<p style="font-size:13px;color:#334155;margin-bottom:16px;line-height:1.6">${project.description}</p>`:''}

${(totalMins>0||totalCost>0||projSteps.length>0||projCoats.length>0)?`
<div class="stat-grid">
  ${projSteps.length>0?`<div class="stat"><div class="stat-label">Steps</div><div class="stat-val">${projSteps.filter(s=>s.completed).length}/${projSteps.length}</div></div>`:''}
  ${projCoats.length>0?`<div class="stat"><div class="stat-label">Coats</div><div class="stat-val">${projCoats.length}</div></div>`:''}
  ${totalMins>0?`<div class="stat"><div class="stat-label">Time</div><div class="stat-val">${fmtMins(totalMins)}</div></div>`:''}
  ${totalCost>0?`<div class="stat"><div class="stat-label">Materials</div><div class="stat-val">$${totalCost.toFixed(2)}</div></div>`:''}
</div>`:''}

${projSteps.length>0?`
<h2>Build Steps</h2>
<table><thead><tr><th>#</th><th>Step</th><th>Status</th></tr></thead><tbody>
${projSteps.map((s,i)=>`<tr><td style="color:#94A3B8;width:28px">${i+1}</td><td>${s.content||s.description||''}</td><td class="${s.completed?'done':''}">${s.completed?'✓ Done':'—'}</td></tr>`).join('')}
</tbody></table>`:''}

${projCoats.length>0?`
<h2>Finishing Coats</h2>
<table><thead><tr><th>Coat</th><th>Product</th><th>Applied</th><th>Notes</th></tr></thead><tbody>
${projCoats.map(c=>`<tr><td>#${c.coat_number||1}</td><td>${c.product||''}</td><td>${c.applied_at?new Date(c.applied_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—'}</td><td>${c.notes||''}</td></tr>`).join('')}
</tbody></table>`:''}

${timeEntries.length>0?`
<h2>Time Log</h2>
<table><thead><tr><th>Date</th><th>Duration</th><th>Note</th></tr></thead><tbody>
${timeEntries.map(e=>`<tr><td>${e.date||''}</td><td>${fmtMins(e.minutes||0)}</td><td>${e.note||''}</td></tr>`).join('')}
</tbody></table>`:''}

${costEntries.length>0?`
<h2>Cost Breakdown</h2>
<table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>
${costEntries.map(e=>`<tr><td>${e.label||''}</td><td>$${parseFloat(e.amount||0).toFixed(2)}</td></tr>`).join('')}
<tr style="font-weight:700;border-top:2px solid #0F172A"><td>Total</td><td>$${totalCost.toFixed(2)}</td></tr>
</tbody></table>`:''}

${finishedPhotos.length>0?`
<h2>Finished Work (${finishedPhotos.length})</h2>
<div class="photo-grid ${finishedPhotos.length===1?'photo-grid-1':finishedPhotos.length===2?'photo-grid-2':'photo-grid-3'}">
${finishedPhotos.map(p=>`<div><img src="${p.url}" alt="${p.caption||''}"/>${p.caption?`<div class="photo-caption">${p.caption}</div>`:''}</div>`).join('')}
</div>`:''}

${progressPhotos.length>0?`
<h2>Progress Photos (${progressPhotos.length})</h2>
<div class="photo-grid photo-grid-3">
${progressPhotos.slice(0,12).map(p=>`<div><img src="${p.url}" alt="${p.caption||''}"/>${p.caption?`<div class="photo-caption">${p.caption}</div>`:''}</div>`).join('')}
${progressPhotos.length>12?`<div style="display:flex;align-items:center;justify-content:center;background:#F8FAFC;font-size:12px;color:#94A3B8">+${progressPhotos.length-12} more</div>`:''}
</div>`:''}

<div class="footer">JDH Woodworks · ${project.name} · ${new Date().toLocaleDateString()}</div>

<div class="no-print">
  <button onclick="window.print()" style="padding:10px 28px;background:#0F172A;color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;border-radius:6px">
    Print / Save as PDF
  </button>
</div>
</body></html>`)
    win.document.close()
  }

  const handleExportCSV = () => {
    const projSteps  = data.steps.filter(s => s.project_id === projId)
    const projCoats  = data.coats.filter(c => c.project_id === projId)
    const timeEntries = project.time_entries ? JSON.parse(project.time_entries) : []
    const costEntries = project.cost_entries ? JSON.parse(project.cost_entries) : []
    const rows = [
      ['Field', 'Value'],
      ['Name', project.name || ''],
      ['Status', project.status || ''],
      ['Species', project.wood_type || ''],
      ['Finish', project.finish_used || ''],
      ['Category', project.category || ''],
      ['Year Completed', project.year_completed || ''],
      ['Description', project.description || ''],
      [''],
      ['Steps', ''],
      ['Step', 'Completed'],
      ...projSteps.map(s => [s.content || s.description || '', s.completed ? 'Yes' : 'No']),
      [''],
      ['Finishing', ''],
      ['Coat', 'Product', 'Applied', 'Notes'],
      ...projCoats.map(c => [c.coat_number || '', c.product || '', c.applied_at ? new Date(c.applied_at).toLocaleDateString() : '', c.notes || '']),
      [''],
      ['Time Log', ''],
      ['Date', 'Minutes', 'Note'],
      ...timeEntries.map(e => [e.date || '', e.minutes || 0, e.note || '']),
      [''],
      ['Costs', ''],
      ['Item', 'Amount'],
      ...costEntries.map(e => [e.label || '', e.amount || 0]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${project.name.replace(/[^a-z0-9]/gi, '-')}-jdh.csv`
    a.click()
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

  // Overview tab data
  const timeEntries = project.time_entries ? JSON.parse(project.time_entries) : []
  const totalMins = timeEntries.reduce((s, e) => s + (e.minutes || 0), 0)
  const beforePhoto = photos.find(p => p.tags?.split(',').map(t=>t.trim()).includes('before'))
  const afterPhoto  = photos.find(p => p.tags?.split(',').map(t=>t.trim()).includes('after'))
  const edit = async (id, fields) => {
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => toast(e.message, 'error'))
  }

  // Hero photo — prefer finished, then any progress, then any photo
  const heroPhoto = photos.find(p => p.tags?.includes('finished'))
    || photos.find(p => p.photo_type === 'progress')
    || photos[0]

  return (
    <div style={{ overflowY: 'auto', background: 'var(--c-bg-raised)' }} className="slide-in">

      {/* ── Header ── */}
      <div style={{ background: 'var(--c-bg-surface)', borderBottom: '1px solid var(--c-border)' }}>

        {/* Hero image or compact header */}
        <div style={{
          position: 'relative',
          minHeight: heroPhoto ? 160 : 'auto',
          background: 'transparent',
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          overflow: 'hidden',
        }}>
          {heroPhoto && (
            <PhotoImg photo={heroPhoto} size="medium" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {/* Gradient overlay for readability */}
          {heroPhoto && (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.3) 0%, rgba(0,0,0,.1) 40%, rgba(0,0,0,.7) 100%)' }} />
          )}

          {/* Back + more buttons — always on top */}
          <div style={{ position: heroPhoto ? 'absolute' : 'relative', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', zIndex: 1 }}>
            <button className="back-btn" onClick={() => setProjId(null)} style={{ flexShrink: 0, color: heroPhoto ? '#fff' : 'var(--accent)' }}>
              <IChevL size={16} color="currentColor" sw={2.2} />
              Projects
            </button>
            <button type="button" className="icon-btn" onClick={() => setShowActions(true)} aria-label="More actions" style={{ flexShrink: 0, color: heroPhoto ? '#fff' : 'var(--c-text-primary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
            </button>
          </div>

          {/* Title + metadata — overlaid on image or inline */}
          <div style={{ position: 'relative', zIndex: 1, padding: heroPhoto ? '0 16px 14px' : '0 16px 10px' }}>
            <h2 style={{
              fontSize: heroPhoto ? 22 : 17, fontWeight: 800, margin: 0,
              color: heroPhoto ? '#fff' : 'var(--c-text-primary)',
              textShadow: heroPhoto ? '0 1px 4px rgba(0,0,0,.5)' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.name}
            </h2>
            {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setShowStatusPicker(true)}
                style={{
                  background: heroPhoto ? 'rgba(255,255,255,.2)' : ss.bg,
                  color: heroPhoto ? '#fff' : ss.color,
                  backdropFilter: heroPhoto ? 'blur(8px)' : 'none',
                  WebkitBackdropFilter: heroPhoto ? 'blur(8px)' : 'none',
                  border: 'none', borderRadius: 99,
                  padding: '2px 10px', fontSize: 12, fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                {STATUS_LABEL[project.status] || project.status}
                <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
              </button>
              {project.category && (
                <button type="button" onClick={() => setShowCategoryPicker(true)} style={{
                  fontSize: 12, borderRadius: 99, padding: '2px 10px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: heroPhoto ? 'rgba(255,255,255,.2)' : 'var(--blue-dim)',
                  color: heroPhoto ? '#fff' : 'var(--blue)',
                  backdropFilter: heroPhoto ? 'blur(8px)' : 'none',
                  WebkitBackdropFilter: heroPhoto ? 'blur(8px)' : 'none',
                }}>
                  {project.category}
                </button>
              )}
              {project.wood_type && <span style={{ fontSize: 12, color: heroPhoto ? 'rgba(255,255,255,.8)' : 'var(--c-text-muted)' }}>{project.wood_type}</span>}
              {project.year_completed && <span style={{ fontSize: 12, color: heroPhoto ? 'rgba(255,255,255,.6)' : 'var(--c-text-faint)' }}>{project.year_completed}</span>}
            </div>
            )}
          </div>
        </div>

        {/* Tabs — equal width */}
        <div style={{ display: 'flex', borderTop: '1px solid var(--c-border-light)' }}>
          {[
            ...(!isMobile ? [{ id: 'overview', label: 'Overview' }] : []),
            { id: 'steps',     label: 'Steps',     badge: steps.length ? `${stepsDone}/${steps.length}` : null },
            { id: 'finishing', label: 'Finishing',  badge: coats.length ? `${coats.filter(c=>c.applied_at).length}/${coats.length}` : null },
            { id: 'photos',    label: 'Photos',     badge: photos.length ? `${photos.length}` : null },
          ].map((t, i, arr) => (
            <button key={t.id} type="button" onClick={() => setDtab(t.id)} style={{
              flex: 1, padding: '10px 2px', border: 'none', cursor: 'pointer',
              borderRight: i < arr.length - 1 ? '1px solid var(--c-border-light)' : 'none',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-heading)',
              textTransform: 'uppercase', letterSpacing: '.04em',
              color: dtab === t.id ? 'var(--accent)' : 'var(--c-text-muted)',
              background: dtab === t.id ? 'var(--accent-dim)' : 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              minHeight: 44,
              transition: 'color 120ms, background 120ms',
            }}>
              {t.label}
              {t.badge && (
                <span style={{ fontSize: 10, fontWeight: 600, color: dtab === t.id ? 'var(--accent)' : 'var(--c-text-faint)', letterSpacing: 0, textTransform: 'none' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB CONTENT — swipeable ── */}
      <div
        ref={swipeRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >

      {/* ── OVERVIEW TAB ── */}
      {dtab === 'overview' && (
        <div style={{  }}>

          {/* Empty state — nothing tracked yet */}
          {steps.length === 0 && coats.length === 0 && photos.length === 0 && totalMins === 0 && !project.notes && (
            <div style={{ padding: '32px 20px 24px' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: 'var(--c-text-faint)', fontWeight: 500, letterSpacing: '.3px' }}>Nothing tracked yet</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340, margin: '0 auto' }}>
                <button className="btn-secondary" onClick={() => setSub('steps-add')}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textAlign: 'left', width: '100%' }}>
                  <ICheck size={20} color="var(--accent)" sw={2} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)' }}>Add build steps</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 1 }}>Break your build into milestones</div>
                  </div>
                </button>
                <button className="btn-secondary" onClick={() => setDtab('photos')}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textAlign: 'left', width: '100%' }}>
                  <ICamera size={20} color="var(--accent)" sw={2} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)' }}>Add a photo</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 1 }}>Document your progress</div>
                  </div>
                </button>
                <button className="btn-secondary" onClick={() => setDtab('finishing')}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', textAlign: 'left', width: '100%' }}>
                  <IGrid size={20} color="var(--accent)" sw={2} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--c-text-primary)' }}>Track finishing</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 1 }}>Log coats and dry times</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Summary grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, padding: '16px 16px 0' }}>
            {steps.length > 0 && (
              <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setDtab('steps')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{stepsDone}/{steps.length}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>Steps done</div>
              </div>
            )}
            {coats.length > 0 && (
              <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setDtab('finishing')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>{coats.filter(c => c.applied_at).length}/{coats.length}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>Coats applied</div>
              </div>
            )}
            {photos.length > 0 && (
              <div className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setDtab('photos')}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--purple)' }}>{photos.length}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>Photos</div>
              </div>
            )}
            {totalMins > 0 && (
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--orange)' }}>{totalMins >= 60 ? Math.floor(totalMins/60) + 'h' : totalMins + 'm'}</div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>Time logged</div>
              </div>
            )}
          </div>

          {/* Before/After */}
          {beforePhoto && afterPhoto && (
            <div style={{ padding: '16px' }}>
              <div className="label-caps" style={{ marginBottom: 8 }}>Before / After</div>
              <BeforeAfterCompare beforeUrl={beforePhoto.url} afterUrl={afterPhoto.url} />
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div style={{ padding: '0 16px 16px' }}>
              <div className="label-caps" style={{ marginBottom: 8 }}>Notes</div>
              <div style={{ fontSize: 14, color: 'var(--c-text-body)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{project.notes}</div>
            </div>
          )}

          {/* Recent photos preview */}
          {photos.length > 0 && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div className="label-caps">Recent photos</div>
                <button className="btn-text" style={{ fontSize: 12 }} onClick={() => setDtab('photos')}>View all →</button>
              </div>
              <PhotoGrid photos={photos.slice(0, 6)} onEdit={edit} />
            </div>
          )}
        </div>
      )}

      {/* ── STEPS TAB ── */}
      {dtab === 'steps' && (
        <div style={{ background: 'var(--c-bg-surface)', padding: '20px',  }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>Build Steps</div>
              {steps.length > 0 && <div style={{ fontSize: 13, color: 'var(--c-text-faint)', marginTop: 2 }}>{stepsDone} of {steps.length} complete</div>}
            </div>
            <button className="icon-btn" onClick={() => setSub('steps-add')} aria-label="Add step" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IPlus size={24} color="var(--accent)" sw={2.5} />
            </button>
          </div>
          {steps.length > 0 && (
            <div style={{ height: 3, background: 'var(--c-bg-subtle)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(stepsDone / steps.length) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 300ms ease' }} />
            </div>
          )}
          <StepsList projId={projId} />
        </div>
      )}

      {/* ── FINISHING TAB ── */}
      {dtab === 'finishing' && (
        <div style={{ background: 'var(--c-bg-surface)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>Finishing</div>
            <button className="icon-btn" onClick={() => setSub('finish-setup')} aria-label="Set up finish" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IPlus size={24} color="var(--accent)" sw={2.5} />
            </button>
          </div>
          <FinishingList projId={projId} sub={sub} setSub={setSub} />
        </div>
      )}

      {/* ── PHOTOS TAB ── */}
      {dtab === 'photos' && (
        <div style={{  }}>
          <div style={{ background: 'var(--c-bg-surface)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-primary)' }}>Photos</div>
              <button className="icon-btn" onClick={() => photoInputRef.current?.click()} aria-label="Add photo" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IPlus size={24} color="var(--accent)" sw={2.5} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={handleQuickPhotoUpload} />
            </div>
            <PhotoTimeline projId={projId} />
          </div>
          {data.photos.filter(p => p.project_id === projId && p.photo_type === 'inspiration').length > 0 && (
            <div style={{ background: 'var(--c-bg-surface)', marginTop: 1, padding: '20px' }}>
              <div className="label-caps" style={{ marginBottom: 12 }}>Inspiration</div>
              <PhotoPane projId={projId} type="inspiration" inline />
            </div>
          )}
        </div>
      )}

      </div>{/* end swipeable tab content */}

      {showCategoryPicker && (
        <Sheet title="Category" onClose={() => setShowCategoryPicker(false)} onSave={null}>
          <div className="form-group">
            {categories.map((cat, i) => (
              <div key={cat.id} className="more-item" style={{ padding: '14px 16px', borderBottom: i < categories.length-1 ? '1px solid var(--c-border-light)' : 'none' }}
                onClick={async () => {
                  setShowCategoryPicker(false)
                  if (cat.name === project.category) return
                  try {
                    await db.updateProject(project.id, { category: cat.name })
                    mutate(d => ({ ...d, projects: d.projects.map(p => p.id === project.id ? { ...p, category: cat.name } : p) }))
                  } catch (err) { toast(err.message, 'error') }
                }} role="button" tabIndex={0}>
                <span style={{ flex: 1, fontSize: 15, color: cat.name === project.category ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: cat.name === project.category ? 700 : 400 }}>{cat.name}</span>
                {cat.name === project.category && <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>}
              </div>
            ))}
            {categories.length === 0 && (
              <div style={{ padding: '20px', color: 'var(--c-text-muted)', fontSize: 14, textAlign: 'center' }}>No categories yet — add one in Edit Project.</div>
            )}
          </div>
        </Sheet>
      )}
      {showStatusPicker && (
        <Sheet title="Status" onClose={() => setShowStatusPicker(false)} onSave={null}>
          <div className="form-group">
            {['planning', 'active', 'complete'].map((s, i, arr) => (
              <div key={s} className="more-item" style={{ padding: '14px 16px', borderBottom: i < arr.length-1 ? '1px solid var(--c-border-light)' : 'none' }}
                onClick={async () => {
                  setShowStatusPicker(false)
                  if (s === project.status) return
                  try {
                    await db.updateProject(project.id, { status: s })
                    mutate(d => ({ ...d, projects: d.projects.map(p => p.id === project.id ? { ...p, status: s } : p) }))
                    if (s === 'complete' && project.status !== 'complete') setShowRon(true)
                  } catch (err) { toast(err.message, 'error') }
                }} role="button" tabIndex={0}>
                <span style={{ flex: 1, fontSize: 15, color: s === project.status ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: s === project.status ? 700 : 400 }}>{STATUS_LABEL[s]}</span>
                {s === project.status && <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>}
              </div>
            ))}
          </div>
        </Sheet>
      )}
      {editing    && <ProjectSheet project={project} categories={categories} onSave={handleUpdate} onClose={() => setEditing(false)} mutate={mutate} />}
      {confirming && <ConfirmSheet message={`Delete "${project.name}"? All steps, coats, and photos will be removed. This cannot be undone.`} onConfirm={handleDelete} onClose={() => setConfirming(false)} />}
      {showRon    && <RonSwansonModal onClose={() => setShowRon(false)} />}
      {showQRLabel && <QRLabelSheet project={project} onClose={() => setShowQRLabel(false)} />}
      {showReminder && <ReminderSheet project={project} onClose={() => setShowReminder(false)} />}
      {showActions && (
        <Sheet title="Project" onClose={() => setShowActions(false)} onSave={null}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => { setShowActions(false); setEditing(true) }} role="button" tabIndex={0}>
              <IEdit size={20} color="var(--accent)" />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Edit project</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => {
                setShowActions(false)
                const next = !project.is_favorite
                mutate(d => ({ ...d, projects: d.projects.map(p => p.id === projId ? { ...p, is_favorite: next } : p) }))
                db.toggleFavorite(projId, next).catch(e => toast(e.message, 'error'))
                toast(next ? 'Added to favorites' : 'Removed from favorites', 'success')
              }} role="button" tabIndex={0}>
              <IStar size={20} fill={project.is_favorite ? 'var(--yellow,#F59E0B)' : 'none'} color={project.is_favorite ? 'var(--yellow,#F59E0B)' : 'var(--accent)'} />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>{project.is_favorite ? 'Remove from favorites' : 'Add to favorites'}</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => { setShowActions(false); setShowReminder(true) }} role="button" tabIndex={0}>
              <IBell size={20} color="var(--accent)" sw={1.8} />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Add reminder</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => { setShowActions(false); handleShare() }} role="button" tabIndex={0}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Share project</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => { setShowActions(false); handlePrint() }} role="button" tabIndex={0}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Print / Export PDF</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => { setShowActions(false); setSub('add-time') }} role="button" tabIndex={0}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Add time</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
              onClick={() => { setShowActions(false); setSub('add-cost') }} role="button" tabIndex={0}>
              <IDollar size={20} color="var(--accent)" sw={1.8} />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Add cost</span>
            </div>
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: 'none' }}
              onClick={() => { setShowActions(false); handleExportCSV() }} role="button" tabIndex={0}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Export CSV</span>
            </div>
          </div>
          <div className="form-group">
            <div className="more-item" style={{ padding: '14px 16px', borderBottom: 'none' }}
              onClick={() => { setShowActions(false); setConfirming(true) }} role="button" tabIndex={0}>
              <ITrash size={20} color="var(--red)" />
              <span style={{ flex: 1, fontSize: 15, color: 'var(--red)' }}>Delete project</span>
            </div>
          </div>
        </Sheet>
      )}

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
      {/* Set up finish sheet */}
      {sub === 'finish-setup' && (
        <SetUpFinishSheet
          projId={projId}
          existingCoats={data.coats.filter(c => c.project_id === projId)}
          finishProducts={data.finishProducts || []}
          onSave={async (coats) => {
            const saved = []
            for (const fields of coats) {
              const coat = await db.addCoat({ project_id: projId, applied_at: null, ...fields })
              saved.push(coat)
            }
            mutate(d => ({ ...d, coats: [...d.coats, ...saved] }))
            setSub(null)
            toast(`${saved.length} coats planned`, 'success')
          }}
          onClose={() => setSub(null)}
        />
      )}
      {/* Edit finish plan sheet */}
      {typeof sub === 'string' && sub.startsWith('edit-finish-') && (() => {
        const product = sub.replace('edit-finish-', '')
        const groupCoats = data.coats.filter(c => c.project_id === projId && c.product === product).sort((a, b) => a.coat_number - b.coat_number)
        if (!groupCoats.length) return null
        const first = groupCoats[0]
        const applied = groupCoats.filter(c => c.applied_at).length
        const nextNum = (groupCoats.at(-1)?.coat_number ?? 0) + 1
        return (
          <Sheet title={`Edit: ${product}`} onClose={() => setSub(null)} onSave={null}>
            {/* Plan summary */}
            <div style={{ padding: '14px 16px', fontSize: 14, color: 'var(--c-text-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{groupCoats.length} coats</span>
                <span style={{ color: 'var(--c-text-muted)' }}>{applied} applied</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
                {first.interval_value}{first.interval_unit === 'hours' ? 'h' : 'd'} dry time between coats
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              {/* Add a coat to this plan */}
              <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
                onClick={async () => {
                  const coat = await db.addCoat({
                    project_id: projId, applied_at: null, product,
                    coat_number: nextNum,
                    interval_value: first.interval_value,
                    interval_unit: first.interval_unit,
                    notes: '',
                  })
                  mutate(d => ({ ...d, coats: [...d.coats, coat] }))
                  toast(`Coat ${nextNum} added to ${product}`, 'success')
                  setSub(null)
                }} role="button" tabIndex={0}>
                <IPlus size={20} color="var(--accent)" />
                <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Add a coat</span>
              </div>
              {/* Change dry time */}
              <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
                onClick={async () => {
                  const val = prompt('Dry time (number):', String(first.interval_value))
                  if (val === null) return
                  const iv = parseFloat(val)
                  if (!iv || iv <= 0) return
                  for (const c of groupCoats) {
                    await db.updateCoat(c.id, { interval_value: iv }).catch(() => {})
                  }
                  mutate(d => ({ ...d, coats: d.coats.map(c =>
                    c.project_id === projId && c.product === product ? { ...c, interval_value: iv } : c
                  )}))
                  toast('Dry time updated', 'success')
                  setSub(null)
                }} role="button" tabIndex={0}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Change dry time</span>
              </div>
              {/* Add another finish type */}
              <div className="more-item" style={{ padding: '14px 16px' }}
                onClick={() => { setSub('finish-setup') }} role="button" tabIndex={0}>
                <IGrid size={20} color="var(--accent)" />
                <span style={{ flex: 1, fontSize: 15, color: 'var(--c-text-primary)' }}>Add another finish type</span>
              </div>
            </div>
            <div className="form-group">
              <div className="more-item" style={{ padding: '14px 16px' }}
                onClick={async () => {
                  mutate(d => ({ ...d, coats: d.coats.filter(c => !(c.project_id === projId && c.product === product)) }))
                  for (const c of groupCoats) { await db.deleteCoat(c.id).catch(() => {}) }
                  toast(`${product} removed`, 'success')
                  setSub(null)
                }} role="button" tabIndex={0}>
                <ITrash size={20} color="var(--red)" />
                <span style={{ flex: 1, fontSize: 15, color: 'var(--red)' }}>Delete this finish</span>
              </div>
            </div>
          </Sheet>
        )
      })()}
      {/* Add time sheet */}
      {sub === 'add-time' && (() => {
        const entries = (() => { try { return JSON.parse(project.time_entries || '[]') } catch { return [] } })()
        return (
          <Sheet title="Log Time" onClose={() => setSub(null)} onSave={async () => {
            const hrs = parseInt(document.getElementById('time-hrs')?.value) || 0
            const mins = parseInt(document.getElementById('time-mins')?.value) || 0
            const m = hrs * 60 + mins
            if (!m) { toast('Enter a duration', 'error'); return }
            const entry = { id: Math.random().toString(36).slice(2), date: document.getElementById('time-date')?.value || new Date().toISOString().slice(0,10), minutes: m, note: document.getElementById('time-note')?.value?.trim() || '' }
            await handleUpdate({ time_entries: JSON.stringify([...entries, entry]) })
            toast('Time logged', 'success')
            setSub(null)
          }} saveLabel="Log">
            <div className="form-group">
              <FormCell label="Date"><input id="time-date" className="form-input" type="date" defaultValue={new Date().toISOString().slice(0,10)} /></FormCell>
              <FormCell label="Hours"><input id="time-hrs" className="form-input" type="number" min="0" placeholder="0" /></FormCell>
              <FormCell label="Minutes"><input id="time-mins" className="form-input" type="number" min="0" max="59" placeholder="0" /></FormCell>
              <FormCell label="Note" last><input id="time-note" className="form-input" placeholder="Optional" /></FormCell>
            </div>
          </Sheet>
        )
      })()}
      {/* Add cost sheet */}
      {sub === 'add-cost' && (() => {
        const entries = (() => { try { return JSON.parse(project.cost_entries || '[]') } catch { return [] } })()
        return (
          <Sheet title="Log Cost" onClose={() => setSub(null)} onSave={async () => {
            const amt = parseFloat(document.getElementById('cost-amt')?.value)
            if (!amt) { toast('Enter an amount', 'error'); return }
            const entry = { id: Math.random().toString(36).slice(2), date: document.getElementById('cost-date')?.value || new Date().toISOString().slice(0,10), amount: amt, note: document.getElementById('cost-note')?.value?.trim() || '' }
            await handleUpdate({ cost_entries: JSON.stringify([...entries, entry]) })
            toast('Cost logged', 'success')
            setSub(null)
          }} saveLabel="Log">
            <div className="form-group">
              <FormCell label="Date"><input id="cost-date" className="form-input" type="date" defaultValue={new Date().toISOString().slice(0,10)} /></FormCell>
              <FormCell label="Amount ($)"><input id="cost-amt" className="form-input" type="number" step="0.01" placeholder="0.00" autoFocus /></FormCell>
              <FormCell label="Note" last><input id="cost-note" className="form-input" placeholder="Material, tool, etc." /></FormCell>
            </div>
          </Sheet>
        )
      })()}
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
    completed ? hapticLight() : hapticLight()
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
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text-faint)', fontSize: 13 }}>No steps yet — click + to add</div>
  )

  return (
    <div>
      {steps.map(s => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border-light)' }}>
          <button className="check-btn" onClick={() => toggle(s)} style={{ flexShrink: 0, marginTop: 1 }}>
            {s.completed ? <ICheck size={20} color="var(--forest)" sw={2} /> : <ICircle size={20} color="var(--c-text-faint)" sw={1.5} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editId === s.id ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="edit-input" value={editVal} onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null) }} autoFocus />
                <button className="btn-text" onClick={() => saveEdit(s.id)}>Save</button>
              </div>
            ) : (
              <div style={{ fontSize: 16, color: s.completed ? 'var(--c-text-faint)' : 'var(--c-text-primary)', cursor: 'text' }}
                onClick={() => { setEditId(s.id); setEditVal(s.title) }}>
                {s.title}
              </div>
            )}
            {s.note && <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>{s.note}</div>}
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
  const [editCoat, setEditCoat] = useState(null)
  const [calendarOffer, setCalendarOffer] = useState(null) // { coat, nextCoat }
  const [adjustCoat, setAdjustCoat] = useState(null) // coat to adjust date
  const longPressTimer = useRef(null)

  const coats = data.coats.filter(c => c.project_id === projId).sort((a, b) => a.coat_number - b.coat_number)
  const proj  = data.projects.find(p => p.id === projId)

  // Group coats by product
  const groups = useMemo(() => {
    const map = {}
    coats.forEach(c => {
      const key = c.product || 'Untitled'
      if (!map[key]) map[key] = []
      map[key].push(c)
    })
    return Object.entries(map).map(([product, items]) => ({
      product,
      coats: items,
      applied: items.filter(c => c.applied_at).length,
      total: items.length,
    }))
  }, [coats])

  const del = async id => {
    mutate(d => ({ ...d, coats: d.coats.filter(c => c.id !== id) }))
    await db.deleteCoat(id).catch(e => toast(e.message, 'error'))
  }

  const handleApply = async (coat) => {
    const applied_at = new Date().toISOString()
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === coat.id ? { ...c, applied_at } : c) }))
    await db.updateCoat(coat.id, { applied_at }).catch(e => toast(e.message, 'error'))

    // Find next coat in same group
    const sameProduct = coats.filter(c => c.product === coat.product)
    const nextIdx = sameProduct.findIndex(c => c.id === coat.id) + 1
    const nextCoat = nextIdx < sameProduct.length ? sameProduct[nextIdx] : null

    const dryStr = coat.interval_unit === 'hours' ? `${coat.interval_value}h` : `${coat.interval_value}d`
    if (nextCoat) {
      toast(`Coat ${coat.coat_number} applied · Next ready in ${dryStr}`, 'success')
      setCalendarOffer({ coat: { ...coat, applied_at }, nextCoat })
    } else {
      toast(`${coat.product} finishing complete!`, 'success')
    }
  }

  const addToCalendar = () => {
    if (!calendarOffer) return
    const { coat, nextCoat } = calendarOffer
    const ms = coat.interval_unit === 'hours' ? coat.interval_value * 3600000 : coat.interval_value * 86400000
    const readyAt = new Date(new Date(coat.applied_at).getTime() + ms)
    addToGoogleCalendar({
      title: `Apply coat ${nextCoat.coat_number} — ${coat.product}${proj ? ` (${proj.name})` : ''}`,
      start: readyAt,
      end: new Date(readyAt.getTime() + 3600000),
      description: `Coat ${coat.coat_number} drying complete. Ready for coat ${nextCoat.coat_number}.`,
    })
    setCalendarOffer(null)
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === id ? { ...c, ...fields } : c) }))
    await db.updateCoat(id, fields).catch(e => toast(e.message, 'error'))
    toast('Saved', 'success')
    setEditCoat(null)
  }

  const deleteGroup = async (product) => {
    const groupCoats = coats.filter(c => c.product === product)
    mutate(d => ({ ...d, coats: d.coats.filter(c => !(c.project_id === projId && c.product === product)) }))
    for (const c of groupCoats) {
      await db.deleteCoat(c.id).catch(() => {})
    }
    toast(`${product} removed`, 'success')
  }

  if (!coats.length) return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 15, color: 'var(--c-text-muted)', marginBottom: 16 }}>No finishing plan yet</div>
      <button className="btn-primary" style={{ padding: '12px 28px', fontSize: 16, fontWeight: 700 }}
        onClick={() => setSub('finish-setup')}>
        Create Finish Plan
      </button>
    </div>
  )

  return (
    <div>
      {groups.map((group, gi) => {
        // Find next due coat in this group
        const nextDue = group.coats.find(c => !c.applied_at)
        // Is previous group complete? (for sequential finishes)
        const prevGroup = gi > 0 ? groups[gi - 1] : null
        const prevComplete = !prevGroup || prevGroup.applied === prevGroup.total

        return (
          <div key={group.product} style={{ marginBottom: gi < groups.length - 1 ? 16 : 0 }}>
            {/* Group header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-primary)', textTransform: 'uppercase', letterSpacing: '.02em' }}>{group.product}</span>
                <span style={{ fontSize: 12, color: group.applied === group.total ? 'var(--forest)' : 'var(--c-text-muted)', marginLeft: 8 }}>
                  {group.applied === group.total ? '✓ Complete' : `${group.applied}/${group.total}`}
                </span>
              </div>
              <button className="icon-btn" onClick={() => setSub('edit-finish-' + group.product)} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IEdit size={16} color="var(--c-text-muted)" />
              </button>
            </div>
            {/* Progress bar */}
            <div style={{ height: 3, background: 'var(--c-bg-subtle)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(group.applied / group.total) * 100}%`, background: 'var(--forest)', borderRadius: 2, transition: 'width 300ms ease' }} />
            </div>
            {/* Coat list — single line per coat */}
            {group.coats.map((coat, ci) => {
              const applied = !!coat.applied_at
              const isNextDue = coat.id === nextDue?.id && prevComplete
              const locked = !applied && (!prevComplete || (nextDue && coat.id !== nextDue.id))
              const prevCoat = ci > 0 ? group.coats[ci - 1] : null
              let readyTime = null
              if (prevCoat?.applied_at) {
                const ms = prevCoat.interval_unit === 'hours' ? prevCoat.interval_value * 3600000 : prevCoat.interval_value * 86400000
                readyTime = new Date(new Date(prevCoat.applied_at).getTime() + ms)
              }
              const isReady = readyTime ? new Date() >= readyTime : ci === 0
              const isOverdue = isNextDue && isReady

              const statusText = applied
                ? `Applied ${fmtShort(coat.applied_at)}`
                : isNextDue ? (isReady ? 'Ready' : `Ready ${fmtShort(readyTime?.toISOString())}`) : locked ? 'Waiting' : ''

              return (
                <SwipeRow key={coat.id} actions={[
                  { label: 'Edit', bg: 'var(--accent)', onClick: () => setEditCoat(coat) },
                  { label: 'Delete', bg: 'var(--red)', onClick: () => del(coat.id) },
                ]}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 4px',
                  borderBottom: ci < group.coats.length - 1 ? '1px solid var(--c-border-light)' : 'none',
                  opacity: locked ? 0.4 : 1,
                }}
                  onTouchStart={() => { longPressTimer.current = setTimeout(() => setAdjustCoat(coat), 500) }}
                  onTouchMove={() => clearTimeout(longPressTimer.current)}
                  onTouchEnd={() => clearTimeout(longPressTimer.current)}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    background: applied ? 'var(--forest)' : isOverdue ? 'var(--orange-dim)' : 'var(--c-bg-subtle)',
                    color: applied ? '#fff' : isOverdue ? 'var(--orange)' : 'var(--c-text-muted)',
                    border: applied ? 'none' : isOverdue ? '2px solid var(--orange)' : '1.5px solid var(--c-border)',
                  }}>
                    {applied ? '✓' : coat.coat_number}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-primary)', flexShrink: 0 }}>Coat {coat.coat_number}</span>
                  <span style={{ fontSize: 13, color: applied ? 'var(--c-text-muted)' : isOverdue ? 'var(--orange)' : 'var(--c-text-faint)', flex: 1 }}>{statusText}</span>
                  {isNextDue && prevComplete && (
                    <button
                      className="btn-primary"
                      style={{ fontSize: 12, padding: '4px 12px', flexShrink: 0 }}
                      onClick={() => handleApply(coat)}
                    >
                      Apply Now
                    </button>
                  )}
                </div>
                </SwipeRow>
              )
            })}
          </div>
        )
      })}

      {/* Calendar offer after applying */}
      {calendarOffer && (
        <div style={{
          marginTop: 12, padding: '12px 14px', background: 'var(--accent-dim)',
          border: '1px solid var(--accent)', borderRadius: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'var(--c-text-primary)' }}>
            Remind me for coat {calendarOffer.nextCoat.coat_number}?
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={addToCalendar}>
              <ICal size={12} color="#fff" /> Add to Calendar
            </button>
            <button className="btn-text" style={{ fontSize: 12, color: 'var(--c-text-muted)' }}
              onClick={() => setCalendarOffer(null)}>Skip</button>
          </div>
        </div>
      )}

      {editCoat && <CoatSheet nextNum={editCoat.coat_number} defaultCoat={editCoat} isEdit onSave={f => handleEdit(editCoat.id, f)} onClose={() => setEditCoat(null)} />}
      {adjustCoat && (
        <Sheet title={`Coat ${adjustCoat.coat_number} — ${adjustCoat.product}`} onClose={() => setAdjustCoat(null)} onSave={async () => {
          const el = document.getElementById('adjust-dt')
          if (!el?.value) return
          const applied_at = new Date(el.value).toISOString()
          mutate(d => ({ ...d, coats: d.coats.map(c => c.id === adjustCoat.id ? { ...c, applied_at } : c) }))
          await db.updateCoat(adjustCoat.id, { applied_at }).catch(e => toast(e.message, 'error'))
          toast('Date updated', 'success')
          setAdjustCoat(null)
        }} saveLabel="Save">
          <div className="form-group">
            <FormCell label={adjustCoat.applied_at ? 'Adjust applied date' : 'Set applied date'} last>
              <input id="adjust-dt" className="form-input" type="datetime-local"
                defaultValue={adjustCoat.applied_at ? adjustCoat.applied_at.slice(0, 16) : localDt()} />
            </FormCell>
          </div>
        </Sheet>
      )}
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
    <div style={{ background: 'var(--c-bg-surface)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="label-caps">Time</div>
          {totalMins > 0 && <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text-primary)', marginTop: 2 }}>{fmtMins(totalMins)}</div>}
        </div>
        <button className="icon-btn" onClick={() => setShow(s => !s)} aria-label="Log time"><IPlus size={18} color="var(--accent)" /></button>
      </div>

      {show && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="cell-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <input className="form-input" type="number" min="0" placeholder="0h" value={hrs} onChange={e => setHrs(e.target.value)}
              style={{ width: 52, background: 'var(--c-bg-subtle)', borderRadius: 8, padding: '7px 8px', border: '1px solid var(--c-border-light)', fontSize: 13, textAlign: 'right' }} />
            <input className="form-input" type="number" min="0" max="59" placeholder="00m" value={mins} onChange={e => setMins(e.target.value)}
              style={{ width: 52, background: 'var(--c-bg-subtle)', borderRadius: 8, padding: '7px 8px', border: '1px solid var(--c-border-light)', fontSize: 13, textAlign: 'right' }} />
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
              <div style={{ color: 'var(--c-text-muted)' }}>{e.date} {e.note && <span style={{ color: 'var(--c-text-faint)' }}>· {e.note}</span>}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--c-text-primary)' }}>{fmtMins(e.minutes)}</span>
                <button className="icon-btn" onClick={() => remove(e.id)} style={{ color: 'var(--red)', padding: 0 }}><ITrash size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--c-text-faint)', fontStyle: 'italic' }}>No time logged yet</div>
      )}
    </div>
  )
}

// ─── Cost Tracker ─────────────────────────────────────────────────────────────
function CostTracker({ project, onSave, projId, shopping = [] }) {
  const toast = useToast()
  const [show, setShow] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const entries = (() => { try { return JSON.parse(project.cost_entries || '[]') } catch { return [] } })()
  const shopItems   = shopping.filter(s => s.project_id === projId && s.cost > 0)
  const shopTotal   = shopItems.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0)
  const manualTotal = entries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const grandTotal  = manualTotal + shopTotal

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
    <div style={{ background: 'var(--c-bg-surface)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div className="label-caps">Cost</div>
          {grandTotal > 0 && <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text-primary)', marginTop: 2 }}>${grandTotal.toFixed(2)}</div>}
        </div>
        <button className="icon-btn" onClick={() => setShow(s => !s)} aria-label="Add cost"><IPlus size={18} color="var(--accent)" /></button>
      </div>

      {show && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input className="cell-input" placeholder="Item (e.g. Lumber)" value={label} onChange={e => setLabel(e.target.value)} />
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--c-bg-subtle)', borderRadius: 8, border: '1px solid var(--c-border-light)', paddingLeft: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>$</span>
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

      {(entries.length > 0 || shopItems.length > 0) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {entries.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--c-text-muted)' }}>{e.label}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--c-text-primary)' }}>${parseFloat(e.amount||0).toFixed(2)}</span>
                <button className="icon-btn" onClick={() => remove(e.id)} style={{ color: 'var(--red)', padding: 0 }}><ITrash size={12} /></button>
              </div>
            </div>
          ))}
          {shopItems.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: 'var(--c-text-muted)' }}>🛒 {i.name}{i.store ? <span style={{ color: 'var(--c-text-faint)' }}> · {i.store}</span> : ''}</span>
              <span style={{ fontWeight: 700, color: 'var(--c-text-primary)' }}>${parseFloat(i.cost||0).toFixed(2)}</span>
            </div>
          ))}
          {(entries.length + shopItems.length) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, paddingTop: 4, borderTop: '1px solid var(--c-border-light)', marginTop: 2 }}>
              <span>Total</span><span>${grandTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--c-text-faint)', fontStyle: 'italic' }}>No costs logged yet</div>
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

  // Before/After compare — find photos tagged 'before' and 'after'
  const beforePhoto = photos.find(p => p.tags?.split(',').map(t=>t.trim()).includes('before'))
  const afterPhoto  = photos.find(p => p.tags?.split(',').map(t=>t.trim()).includes('after'))

  return (
    <div>
      {beforePhoto && afterPhoto && (
        <div style={{ padding: '0 20px 16px' }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>Before / After</div>
          <BeforeAfterCompare
            beforeUrl={beforePhoto.url}
            afterUrl={afterPhoto.url}
            label={data.projects.find(p => p.id === projId)?.name}
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="label-caps">
          Photos{photos.length > 0 ? ` · ${photos.length}` : ''}
        </div>
        {photos.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setViewMode('grid')} style={{
              padding: '4px 10px', borderRadius: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600,
              background: viewMode === 'grid' ? 'var(--accent)' : 'var(--c-bg-subtle)',
              color: viewMode === 'grid' ? '#fff' : 'var(--c-text-muted)',
            }}>Grid</button>
            <button onClick={() => setViewMode('timeline')} style={{
              padding: '4px 10px', borderRadius: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600,
              background: viewMode === 'timeline' ? 'var(--accent)' : 'var(--c-bg-subtle)',
              color: viewMode === 'timeline' ? '#fff' : 'var(--c-text-muted)',
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
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-faint)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ height: 1, flex: 1, background: 'var(--c-border-light)' }} />
                {date}
                <div style={{ height: 1, flex: 1, background: 'var(--c-border-light)' }} />
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
      } catch (e) {
        if (e.message?.startsWith('PHOTO_LIMIT_REACHED')) {
          toast(`Photo limit reached (${db.PHOTO_LIMIT} photos). Contact us to upgrade.`, 'error', 6000)
          setUploading(false); break
        }
        toast('Upload failed: ' + e.message, 'error')
      }
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
    <div>
      <DropZone onFiles={handleFiles} uploading={uploading} />
      <PhotoGrid photos={photos} onEdit={edit} />
      {photos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '8px 0 24px', color: 'var(--c-text-faint)', fontSize: 13 }}>
          No photos yet — drag here or tap + to add
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
          border: 'none', borderRadius: 0, cursor: 'pointer',
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
        <DropZone onFiles={handleFiles} uploading={uploading} />
        {photos.length > 0
          ? <PhotoGrid photos={photos} onEdit={edit} />
          : <div className="empty"><div className="empty-icon"><ICamera size={32} color="var(--c-text-muted)" sw={1.5} /></div><div className="empty-title">No photos yet</div></div>
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
      <p style={{ fontSize: 13, color: 'var(--c-text-muted)', marginBottom: 8 }}>Tags</p>
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

export function ProjectSheet({ project, categories, onSave, onClose, mutate }) {
  const { data } = useCtx()
  const toast = useToast()
  const refs = {
    name: useRef(), desc: useRef(),
    final: useRef(), builtWith: useRef(), year: useRef(), giftRecipient: useRef(),
  }
  const [category,   setCategory]   = useState(project?.category    || '')
  const [finishVal,  setFinishVal]  = useState(project?.finish_used || '')
  const [statusVal,  setStatusVal]  = useState(project?.status      || 'active')
  const [showCatPicker,    setShowCatPicker]    = useState(false)
  const [showFinishPicker, setShowFinishPicker] = useState(false)
  const [showStatusPicker2, setShowStatusPicker2] = useState(false)
  const [newCatVal,    setNewCatVal]    = useState('')
  const [showNewCat,   setShowNewCat]   = useState(false)
  const [newFinishVal, setNewFinishVal] = useState('')
  const [showNewFinish, setShowNewFinish] = useState(false)
  const existingWoodSrc = data?.projectWoodSources?.find(pws => pws.project_id === project?.id)
  const [woodSrcId, setWoodSrcId] = useState(() => {
    // useState initializer function runs once on mount with current data
    const pws = data?.projectWoodSources?.find(p => p.project_id === project?.id)
    return pws?.wood_stock_id || ''
  })

  // Focus Name field after sheet animation completes so keyboard opens in correct position
  useEffect(() => {
    const t = setTimeout(() => refs.name.current?.focus(), 300)
    return () => clearTimeout(t)
  }, [])

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
      status:           statusVal,
      dimensions_final: refs.final.current?.value.trim()      || '',
      built_with:       refs.builtWith.current?.value.trim()  || '',
      finish_used:      finishVal,
      finish_id:        fi?.id || null,
      year_completed:   yearVal ? parseInt(yearVal) : null,
      gift_recipient:   refs.giftRecipient.current?.value.trim() || '',
    }, woodSrcId || null)
  }

  return (
    <>
    <Sheet title={project ? 'Edit Project' : 'New Project'} onClose={onClose} onSave={handleSave} variant="form">
      <div className="form-group">
        <FormCell label="Name"><input ref={refs.name} className="form-input" placeholder="Cherry Bowl" defaultValue={project?.name || ''} /></FormCell>
        <FormCell label="Category">
          <button type="button" onClick={() => setShowCatPicker(true)} style={{ textAlign: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontFamily: 'inherit', fontSize: 16, padding: 0, flex: 1 }}>
            {category || 'None'}
          </button>
        </FormCell>
        <FormCell label="Status" last>
          <button type="button" onClick={() => setShowStatusPicker2(true)} style={{ textAlign: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontFamily: 'inherit', fontSize: 16, padding: 0, flex: 1 }}>
            {STATUS_LABEL[statusVal] || statusVal}
          </button>
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
        <FormCell label="Finish used">
          <button type="button" onClick={() => setShowFinishPicker(true)} style={{ textAlign: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-primary)', fontFamily: 'inherit', fontSize: 16, padding: 0, flex: 1 }}>
            {finishVal || 'None'}
          </button>
        </FormCell>
        <FormCell label="Year completed"><input ref={refs.year} className="form-input" type="number" placeholder={new Date().getFullYear()} defaultValue={project?.year_completed || ''} /></FormCell>
        <FormCell label="Notes"><input ref={refs.desc} className="form-input" placeholder="Optional" defaultValue={project?.description || ''} /></FormCell>
        <FormCell label="Gift / recipient"><input ref={refs.giftRecipient} className="form-input" placeholder="Dad, Christmas 2023" defaultValue={project?.gift_recipient || ''} /></FormCell>
        <FormCell label="Final dimensions" last><input ref={refs.final} className="form-input" placeholder='10" × 3"' defaultValue={project?.dimensions_final || ''} /></FormCell>
      </div>
    </Sheet>

    {showCatPicker && (
      <Sheet title="Category" onClose={() => { setShowCatPicker(false); setShowNewCat(false); setNewCatVal('') }} onSave={null}>
        <div className="form-group">
          <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
            onClick={() => { setCategory(''); setShowCatPicker(false) }} role="button" tabIndex={0}>
            <span style={{ flex: 1, fontSize: 15, color: !category ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: !category ? 700 : 400 }}>None</span>
            {!category && <span style={{ color: 'var(--accent)' }}>✓</span>}
          </div>
          {categories.map((cat, i) => (
            <div key={cat.id} className="more-item" style={{ padding: '14px 16px', borderBottom: i < categories.length-1 || showNewCat ? '1px solid var(--c-border-light)' : 'none' }}
              onClick={() => { setCategory(cat.name); setShowCatPicker(false) }} role="button" tabIndex={0}>
              <span style={{ flex: 1, fontSize: 15, color: cat.name === category ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: cat.name === category ? 700 : 400 }}>{cat.name}</span>
              {cat.name === category && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </div>
          ))}
          {!showNewCat ? (
            <div className="more-item" style={{ padding: '14px 16px' }} onClick={() => setShowNewCat(true)} role="button" tabIndex={0}>
              <span style={{ fontSize: 15, color: 'var(--accent)' }}>+ Add category…</span>
            </div>
          ) : (
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Category name" value={newCatVal} onChange={e => setNewCatVal(e.target.value)} autoFocus style={{ flex: 1 }} />
              <button className="btn-text" onClick={async () => {
                if (!newCatVal.trim()) return
                try {
                  const cat = await db.addCategory(newCatVal.trim())
                  mutate(d => ({ ...d, categories: [...(d.categories||[]), cat].sort((a,b)=>a.name.localeCompare(b.name)) }))
                  setCategory(cat.name); setShowCatPicker(false); setShowNewCat(false); setNewCatVal('')
                } catch(e) { toast(e.message, 'error') }
              }}>Add</button>
            </div>
          )}
        </div>
      </Sheet>
    )}

    {showStatusPicker2 && (
      <Sheet title="Status" onClose={() => setShowStatusPicker2(false)} onSave={null}>
        <div className="form-group">
          {['planning','active','complete'].map((s, i, arr) => (
            <div key={s} className="more-item" style={{ padding: '14px 16px', borderBottom: i < arr.length-1 ? '1px solid var(--c-border-light)' : 'none' }}
              onClick={() => { setStatusVal(s); setShowStatusPicker2(false) }} role="button" tabIndex={0}>
              <span style={{ flex: 1, fontSize: 15, color: s === statusVal ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: s === statusVal ? 700 : 400 }}>{STATUS_LABEL[s]}</span>
              {s === statusVal && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </div>
          ))}
        </div>
      </Sheet>
    )}

    {showFinishPicker && (
      <Sheet title="Finish used" onClose={() => { setShowFinishPicker(false); setShowNewFinish(false); setNewFinishVal('') }} onSave={null}>
        <div className="form-group">
          <div className="more-item" style={{ padding: '14px 16px', borderBottom: '1px solid var(--c-border-light)' }}
            onClick={() => { setFinishVal(''); setShowFinishPicker(false) }} role="button" tabIndex={0}>
            <span style={{ flex: 1, fontSize: 15, color: !finishVal ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: !finishVal ? 700 : 400 }}>None</span>
            {!finishVal && <span style={{ color: 'var(--accent)' }}>✓</span>}
          </div>
          {finishesList.map((f, i) => (
            <div key={f.id} className="more-item" style={{ padding: '14px 16px', borderBottom: i < finishesList.length-1 || showNewFinish ? '1px solid var(--c-border-light)' : 'none' }}
              onClick={() => { setFinishVal(f.name); setShowFinishPicker(false) }} role="button" tabIndex={0}>
              <span style={{ flex: 1, fontSize: 15, color: f.name === finishVal ? 'var(--accent)' : 'var(--c-text-primary)', fontWeight: f.name === finishVal ? 700 : 400 }}>{f.name}</span>
              {f.name === finishVal && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </div>
          ))}
          {!showNewFinish ? (
            <div className="more-item" style={{ padding: '14px 16px' }} onClick={() => setShowNewFinish(true)} role="button" tabIndex={0}>
              <span style={{ fontSize: 15, color: 'var(--accent)' }}>+ Add finish…</span>
            </div>
          ) : (
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Finish name" value={newFinishVal} onChange={e => setNewFinishVal(e.target.value)} autoFocus style={{ flex: 1 }} />
              <button className="btn-text" onClick={async () => {
                if (!newFinishVal.trim()) return
                try {
                  const f = await db.addFinish(newFinishVal.trim())
                  mutate(d => ({ ...d, finishes: [...(d.finishes||[]), f].sort((a,b)=>a.name.localeCompare(b.name)) }))
                  setFinishVal(f.name); setShowFinishPicker(false); setShowNewFinish(false); setNewFinishVal('')
                } catch(e) { toast(e.message, 'error') }
              }}>Add</button>
            </div>
          )}
        </div>
      </Sheet>
    )}
  </>
)
}

// ─── Coat sheet ───────────────────────────────────────────────────────────────
function CoatSheet({ nextNum, defaultCoat, isEdit, onSave, onClose }) {
  const refs = { prod: useRef(), num: useRef(), iv: useRef(), iu: useRef(), notes: useRef(), applied: useRef() }

  const localNow = () => {
    const d = new Date()
    const offset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - offset).toISOString().slice(0, 16)
  }

  const appliedDefault = () => {
    if (!defaultCoat?.applied_at) return localNow()
    try {
      const d = new Date(defaultCoat.applied_at)
      if (isNaN(d.getTime())) return localNow()
      const offset = d.getTimezoneOffset() * 60000
      return new Date(d.getTime() - offset).toISOString().slice(0, 16)
    } catch { return localNow() }
  }

  const handleSave = async () => {
    const product = refs.prod.current?.value.trim()
    if (!product) return
    const iv = parseFloat(refs.iv.current?.value) || 4
    const iu = refs.iu.current?.value || 'hours'
    const appliedRaw = refs.applied.current?.value
    const applied = appliedRaw ? new Date(appliedRaw).toISOString() : null
    await onSave({
      product,
      coat_number:    parseInt(refs.num.current?.value) || nextNum,
      interval_value: iv,
      interval_unit:  iu,
      notes:          refs.notes.current?.value.trim() || '',
      ...(applied ? { applied_at: applied } : {}),
    })
  }

  return (
    <Sheet title={isEdit ? 'Edit Coat' : 'Add Coat'} onClose={onClose} onSave={handleSave} variant="form">
      <div className="form-group">
        <FormCell label="Product"><input ref={refs.prod} className="form-input" placeholder="Arm-R-Seal" defaultValue={defaultCoat?.product || ''} autoFocus /></FormCell>
        <FormCell label="Coat #"><input ref={refs.num} className="form-input" type="number" defaultValue={isEdit ? defaultCoat?.coat_number : nextNum} /></FormCell>
        <FormCell label="Applied">
          <input ref={refs.applied} className="form-input" type="datetime-local" defaultValue={appliedDefault()} />
        </FormCell>
        <FormCell label="Wait">
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={refs.iv} className="form-input" type="number" defaultValue={defaultCoat?.interval_value ?? 4} style={{ width: 70 }} />
            <select ref={refs.iu} className="form-select" defaultValue={defaultCoat?.interval_unit || 'hours'}>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </FormCell>
        <FormCell label="Notes" last><input ref={refs.notes} className="form-input" placeholder="Optional" defaultValue={defaultCoat?.notes || ''} /></FormCell>
      </div>
    </Sheet>
  )
}

// ─── Set Up Finish — batch coat creation ─────────────────────────────────────
function SetUpFinishSheet({ projId, existingCoats, finishProducts, onSave, onClose }) {
  const [product, setProduct] = useState('')
  const [customProduct, setCustomProduct] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [numCoats, setNumCoats] = useState(3)
  const [intervalVal, setIntervalVal] = useState('24')
  const [intervalUnit, setIntervalUnit] = useState('hours')
  const [notes, setNotes] = useState('')

  const nextNum = (existingCoats.at(-1)?.coat_number ?? 0) + 1
  const effectiveProduct = showCustom ? customProduct.trim() : product

  const handleSave = () => {
    const prod = effectiveProduct
    if (!prod) return
    const iv = parseFloat(intervalVal) || 24
    const coats = []
    for (let i = 0; i < numCoats; i++) {
      coats.push({
        product: prod,
        coat_number: nextNum + i,
        interval_value: iv,
        interval_unit: intervalUnit,
        notes: i === 0 ? notes : '',
      })
    }
    onSave(coats)
  }

  return (
    <Sheet title="Set Up Finish" onClose={onClose} onSave={handleSave} saveLabel="Create Plan" variant="form">
      <div className="form-group">
        <FormCell label="Product">
          {!showCustom ? (
            <select className="form-select" value={product} onChange={e => {
              if (e.target.value === '__new__') { setShowCustom(true); setProduct('') }
              else setProduct(e.target.value)
            }}>
              <option value="">Select a finish…</option>
              {finishProducts.map(fp => <option key={fp.id} value={fp.name}>{fp.name}</option>)}
              <option value="__new__">+ Add New</option>
            </select>
          ) : (
            <input
              className="form-input"
              placeholder="e.g. Arm-R-Seal, Walnut Oil"
              value={customProduct}
              onChange={e => setCustomProduct(e.target.value)}
              autoFocus
            />
          )}
        </FormCell>
        <FormCell label="Number of coats">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setNumCoats(n => Math.max(1, n - 1))}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1.5px solid var(--c-border)', background: 'var(--c-bg-subtle)',
                fontSize: 18, fontWeight: 700, cursor: 'pointer', color: 'var(--c-text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >−</button>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-primary)', minWidth: 32, textAlign: 'center' }}>{numCoats}</span>
            <button
              onClick={() => setNumCoats(n => Math.min(12, n + 1))}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                border: '1.5px solid var(--c-border)', background: 'var(--c-bg-subtle)',
                fontSize: 18, fontWeight: 700, cursor: 'pointer', color: 'var(--c-text-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit',
              }}
            >+</button>
          </div>
        </FormCell>
        <FormCell label="Dry time between coats">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              type="number"
              value={intervalVal}
              onChange={e => setIntervalVal(e.target.value)}
              style={{ width: 70 }}
            />
            <select className="form-select" value={intervalUnit} onChange={e => setIntervalUnit(e.target.value)}>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </FormCell>
        <FormCell label="Notes" last>
          <input className="form-input" placeholder="Optional" value={notes} onChange={e => setNotes(e.target.value)} />
        </FormCell>
      </div>
      <div style={{ padding: '12px 0 4px', fontSize: 13, color: 'var(--c-text-muted)' }}>
        This will create {numCoats} coat{numCoats !== 1 ? 's' : ''} of <strong>{effectiveProduct || '…'}</strong> with {intervalVal}{intervalUnit === 'hours' ? 'h' : 'd'} dry time between each.
        {existingCoats.length > 0 && <span> Coats will be numbered starting at {nextNum}.</span>}
      </div>
    </Sheet>
  )
}

// ─── Ron Swanson modal ────────────────────────────────────────────────────────
function RonSwansonModal({ onClose }) {
  return createPortal(
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
    </div>,
    document.body
  )
}

// ── QR Label Sheet ────────────────────────────────────────────────────────────
function QRLabelSheet({ project, onClose }) {
  const url = window.location.origin
  const handlePrint = () => {
    const label = [project.wood_type, project.category, project.year_completed].filter(Boolean).join(' · ')
    const win = window.open('', '_blank')
    win.document.write('<!DOCTYPE html><html><head><title>Label: ' + project.name + '</title>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><' + '/script>' +
      '<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fff}.label{border:2px solid #0F1E38;border-radius:12px;padding:20px 24px;max-width:280px;text-align:center}.name{font-size:18px;font-weight:800;color:#0F1E38;margin-bottom:4px}.meta{font-size:12px;color:#64748B;margin-bottom:16px}#qr{display:flex;justify-content:center;margin-bottom:12px}.brand{font-size:10px;font-weight:700;letter-spacing:2px;color:#94A3B8;text-transform:uppercase}@media print{body{min-height:auto}}</style></head>' +
      '<body><div class="label"><div class="name">' + project.name + '</div>' +
      '<div class="meta">' + label + '</div>' +
      '<div id="qr"></div><div class="brand">JDH Woodworks</div></div>' +
      '<script>new QRCode(document.getElementById("qr"),{text:"' + url + '",width:160,height:160,colorDark:"#0F1E38",colorLight:"#ffffff"});setTimeout(function(){window.print()},800)<' + '/script></body></html>')
    win.document.close()
  }
  return createPortal(
    <div className="overlay" onClick={onClose} style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--c-bg-surface)', borderRadius:16, padding:'28px 24px', maxWidth:320, width:'90%', textAlign:'center' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:32, marginBottom:8 }}>🏷️</div>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:4 }}>{project.name}</div>
        <div style={{ fontSize:13, color:'var(--c-text-muted)', marginBottom:20 }}>
          {[project.wood_type, project.category].filter(Boolean).join(' · ')}
        </div>
        <p style={{ fontSize:13, color:'var(--c-text-body)', marginBottom:20, lineHeight:1.5 }}>
          Prints a compact label with a QR code linking back to your workshop.
        </p>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-secondary" style={{ flex:1 }} onClick={onClose}>Cancel</button>
          <button className="btn-primary" style={{ flex:1 }} onClick={handlePrint}>Print Label</button>
        </div>
      </div>
    </div>,
    document.body
  )
}


// ─── Star burst animation (canvas particles on favorite) ─────────────────────
export function StarBurst({ onDone }) {
  const canvasRef = React.useRef()

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width = 120
    const H = canvas.height = 120
    const cx = W / 2, cy = H / 2

    // Create particles
    const particles = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2
      const speed = 1.5 + Math.random() * 2
      const colors = ['#F59E0B','#FCD34D','#FDE68A','#FF6B35','#FFD700','#FFF']
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.04 + Math.random() * 0.03,
      }
    })

    // Add a few trailing stars
    const stars = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6
      const speed = 0.8 + Math.random()
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 2,
        life: 1,
        decay: 0.025 + Math.random() * 0.02,
        color: '#F59E0B',
        trail: [],
      }
    })

    let raf
    const animate = () => {
      ctx.clearRect(0, 0, W, H)

      // Draw particles
      let anyAlive = false
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        p.vy += 0.08  // gravity
        p.vx *= 0.96  // friction
        p.life -= p.decay
        if (p.life <= 0) return
        anyAlive = true
        ctx.globalAlpha = Math.max(0, p.life)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      })

      // Draw trailing stars
      stars.forEach(s => {
        s.trail.push({ x: s.x, y: s.y })
        if (s.trail.length > 6) s.trail.shift()
        s.x += s.vx; s.y += s.vy
        s.vy += 0.05
        s.life -= s.decay
        if (s.life <= 0) return
        anyAlive = true
        // Draw trail
        s.trail.forEach((pt, i) => {
          ctx.globalAlpha = (i / s.trail.length) * s.life * 0.5
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, s.size * 0.4, 0, Math.PI * 2)
          ctx.fillStyle = '#FDE68A'
          ctx.fill()
        })
        // Draw star point
        ctx.globalAlpha = s.life
        ctx.fillStyle = s.color
        ctx.font = `${s.size * 2}px serif`
        ctx.fillText('★', s.x - s.size, s.y + s.size)
      })

      ctx.globalAlpha = 1
      if (anyAlive) {
        raf = requestAnimationFrame(animate)
      } else {
        onDone()
      }
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 100,
        width: 120, height: 120,
      }}
    />
  )
}
// ── Reminder Sheet ────────────────────────────────────────────────────────────
function ReminderSheet({ project, onClose }) {
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9,0,0,0)
    return d.toISOString().slice(0,16)
  })
  const [note, setNote] = useState(`Work on: ${project.name}`)

  const addGoogle = () => {
    const start = new Date(date)
    const end   = new Date(start.getTime() + 3600000)
    addToGoogleCalendar({ title: note, start, end, description: `Project: ${project.name}` })
    onClose()
  }
  return createPortal(
    <div className="overlay" onClick={onClose} style={{ alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--c-bg-surface)', borderRadius:16, padding:'28px 24px', maxWidth:340, width:'90%' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>Add Reminder</div>
        <div style={{ marginBottom:12 }}>
          <div className="calc-label" style={{ marginBottom:4 }}>Note</div>
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)} style={{ width:'100%' }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <div className="calc-label" style={{ marginBottom:4 }}>Date &amp; Time</div>
          <input className="form-input" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} style={{ width:'100%' }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={addGoogle}>
            <ICal size={15} color="#fff" /> Add to Google Calendar
          </button>
          <button className="btn-secondary" style={{ width:'100%', justifyContent:'center' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
