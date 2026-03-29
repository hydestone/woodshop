import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar } from '../supabase.js'
import {
  Sheet, FormCell, BulkAddSheet, DropZone, PhotoGrid, TagInput,
  STATUS, coatStatus, fmtShort, localDt,
  IPlus, ITrash, ICirc, IDone, IChev, IBack, IEdit, ICalendar, ICamera
} from '../components/Shared.jsx'

const SS = STATUS

// ─── Projects list ────────────────────────────────────────────────────────────
export default function Projects() {
  const { data, mutate, setProjId } = useCtx()
  const [showAdd, setShowAdd] = useState(false)

  const handleAdd = async (fields) => {
    try {
      const proj = await db.addProject(fields)
      mutate(d => ({ ...d, projects: [...d.projects, proj] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar"><h1>Projects</h1></div>
        <div style={{ paddingTop: 8, paddingBottom: 24 }}>
          {data.projects.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <div className="empty-title">No projects yet</div>
              <div className="empty-sub">Click + to start your first build</div>
            </div>
          ) : (
            ['active','planning','paused','complete'].map(status => {
              const group = data.projects.filter(p => p.status === status)
              if (!group.length) return null
              const ss = SS[status] || SS.planning
              return (
                <div key={status}>
                  <span className="section-label">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  {group.map(p => {
                    const ps    = data.steps.filter(s => s.project_id === p.id)
                    const done  = ps.filter(s => s.completed).length
                    const total = ps.length
                    const rc    = data.coats.filter(c => c.project_id === p.id && coatStatus(c).urgent).length
                    return (
                      <button key={p.id} className="proj-card" onClick={() => setProjId(p.id)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: total > 0 ? 10 : 0 }}>
                          <div style={{ flex: 1, paddingRight: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{p.wood_type}</div>
                            {p.description ? <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{p.description}</div> : null}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            {rc > 0 && <span className="badge-pill" style={{ background: 'rgba(255,149,0,.1)', color: 'var(--orange)' }}>coat ready</span>}
                          </div>
                        </div>
                        {total > 0 && <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Build progress</span>
                            <span style={{ fontSize: 12, color: 'var(--text3)' }}>{done}/{total} steps</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${(done / total) * 100}%`, background: status === 'complete' ? 'var(--green)' : 'var(--blue)' }} />
                          </div>
                        </>}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}>
        <IPlus size={22} c="#fff" sw={2.5} />
      </button>
      {showAdd && <AddProjectSheet onSave={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ─── Project detail ───────────────────────────────────────────────────────────
export function ProjectDetail() {
  const { data, mutate, projId, setProjId } = useCtx()
  const [sub, setSub] = useState('steps')
  const [editing, setEditing] = useState(false)
  const project = data.projects.find(p => p.id === projId)
  if (!project) return null
  const ss = SS[project.status] || SS.planning

  const handleUpdate = async (fields) => {
    try {
      mutate(d => ({ ...d, projects: d.projects.map(p => p.id === projId ? { ...p, ...fields } : p) }))
      await db.updateProject(projId, fields)
      setEditing(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }} className="slide-in">
      <div className="navbar" style={{ paddingTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="back-btn" onClick={() => setProjId(null)}>
            <IBack size={16} c="currentColor" sw={2} /> Projects
          </button>
          <button className="icon-btn" onClick={() => setEditing(true)} style={{ marginBottom: 6 }}>
            <IEdit size={17} c="var(--blue)" />
          </button>
        </div>
        <div style={{ marginBottom: 4 }}>
          <h2>{project.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {project.wood_type && <span style={{ fontSize: 13, color: 'var(--text3)' }}>{project.wood_type}</span>}
            <button
              onClick={() => {
                const order = ['planning','active','paused','complete']
                const next = order[(order.indexOf(project.status) + 1) % order.length]
                handleUpdate({ status: next })
              }}
              style={{ background: ss.bg, color: ss.color, border: 'none', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--fb)' }}
              title="Tap to change status"
            >{project.status} ▾</button>
            {project.dimensions_rough && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Rough: {project.dimensions_rough}</span>}
            {project.dimensions_final && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Final: {project.dimensions_final}</span>}
          </div>
        </div>
        <div className="sub-tabs">
          {[['steps','Build'],['finishing','Finishing'],['progress','Progress'],['inspiration','Inspiration']].map(([id, label]) => (
            <button key={id} className={`sub-tab ${sub === id ? 'active' : ''}`} onClick={() => setSub(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
        {sub === 'steps'       && <StepsPane     projId={projId} />}
        {sub === 'finishing'   && <FinishingPane  projId={projId} />}
        {sub === 'progress'    && <PhotoPane      projId={projId} type="progress" />}
        {sub === 'inspiration' && <PhotoPane      projId={projId} type="inspiration" />}
      </div>
      {editing && <EditProjectSheet project={project} onSave={handleUpdate} onClose={() => setEditing(false)} />}
    </div>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────
function StepsPane({ projId }) {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId]   = useState(null)
  const [editVal, setEditVal] = useState('')
  const steps = data.steps.filter(s => s.project_id === projId).sort((a, b) => a.sort_order - b.sort_order)
  const done = steps.filter(s => s.completed).length

  const toggle = async (step) => {
    const completed = !step.completed
    mutate(d => ({ ...d, steps: d.steps.map(s => s.id === step.id ? { ...s, completed } : s) }))
    await db.updateStep(step.id, { completed }).catch(e => alert('Error: ' + e.message))
  }

  const del = async (id) => {
    mutate(d => ({ ...d, steps: d.steps.filter(s => s.id !== id) }))
    await db.deleteStep(id).catch(e => alert('Error: ' + e.message))
  }

  const saveEdit = async (id) => {
    const title = editVal.trim()
    if (!title) { setEditId(null); return }
    mutate(d => ({ ...d, steps: d.steps.map(s => s.id === id ? { ...s, title } : s) }))
    await db.updateStep(id, { title }).catch(e => alert('Error: ' + e.message))
    setEditId(null)
  }

  const handleBulkAdd = async (lines) => {
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.sort_order)) : 0
    const rows = lines.map((title, i) => ({ project_id: projId, title, note: '', completed: false, sort_order: maxOrder + i + 1 }))
    try {
      const saved = await db.addStepsBulk(rows)
      mutate(d => ({ ...d, steps: [...d.steps, ...saved] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '12px 0 24px' }}>
          {steps.length > 0 && <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 20px 8px' }}>{done} of {steps.length} complete</p>}
          <div className="group">
            {steps.map(s => (
              <div key={s.id} className="cell">
                <button className="check-btn" onClick={() => toggle(s)}>
                  {s.completed ? <IDone size={22} c="var(--green)" sw={2} /> : <ICirc size={22} c="var(--text4)" sw={1.5} />}
                </button>
                <div style={{ flex: 1 }}>
                  {editId === s.id ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="edit-input" value={editVal} onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null) }}
                        autoFocus style={{ flex: 1 }} />
                      <button className="btn-text" style={{ fontSize: 13 }} onClick={() => saveEdit(s.id)}>Save</button>
                    </div>
                  ) : (
                    <div
                      style={{ textDecoration: s.completed ? 'line-through' : 'none', color: s.completed ? 'var(--text3)' : 'var(--text)', cursor: 'text' }}
                      onDoubleClick={() => { setEditId(s.id); setEditVal(s.title) }}
                    >{s.title}</div>
                  )}
                  {s.note && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{s.note}</div>}
                </div>
                <button className="icon-btn" onClick={() => del(s.id)}><ITrash size={15} /></button>
              </div>
            ))}
            {!steps.length && <div style={{ padding: 16 }}><div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">📋</div><div className="empty-title">No steps yet</div><div className="empty-sub">Click + to add build steps</div></div></div>}
          </div>
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}><IPlus size={22} c="#fff" sw={2.5} /></button>
      {showAdd && <BulkAddSheet title="Add Build Steps" hint="Enter one step per line" onSave={handleBulkAdd} onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ─── Finishing ────────────────────────────────────────────────────────────────
function FinishingPane({ projId }) {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd]     = useState(false)
  const [markId, setMarkId]       = useState(null)
  const [editCoat, setEditCoat]   = useState(null)
  const coats = data.coats.filter(c => c.project_id === projId).sort((a, b) => a.coat_number - b.coat_number)
  const lastCoat = coats.length > 0 ? coats[coats.length - 1] : null
  const nextNum  = lastCoat ? lastCoat.coat_number + 1 : 1

  const del = async (id) => {
    mutate(d => ({ ...d, coats: d.coats.filter(c => c.id !== id) }))
    await db.deleteCoat(id).catch(e => alert('Error: ' + e.message))
  }

  const markApplied = async (id, dt) => {
    const applied_at = new Date(dt).toISOString()
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === id ? { ...c, applied_at } : c) }))
    await db.updateCoat(id, { applied_at }).catch(e => alert('Error: ' + e.message))
    setMarkId(null)
  }

  const handleAdd = async (fields) => {
    try {
      const coat = await db.addCoat({ project_id: projId, applied_at: null, ...fields })
      mutate(d => ({ ...d, coats: [...d.coats, coat] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, coats: d.coats.map(c => c.id === id ? { ...c, ...fields } : c) }))
    await db.updateCoat(id, fields).catch(e => alert('Error: ' + e.message))
    setEditCoat(null)
  }

  const addCalendarReminder = (coat) => {
    if (!coat.applied_at) { alert('Mark the coat as applied first.'); return }
    const ms = coat.interval_unit === 'hours' ? coat.interval_value * 3600000 : coat.interval_value * 86400000
    const readyAt = new Date(new Date(coat.applied_at).getTime() + ms)
    addToGoogleCalendar({
      title: `Apply coat ${coat.coat_number + 1} — ${coat.product}`,
      start: readyAt,
      end: new Date(readyAt.getTime() + 3600000),
      description: `Coat ${coat.coat_number} is ready. Apply the next coat of ${coat.product}.`,
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div style={{ padding: '12px 0 24px' }}>
          <div className="group">
            {coats.map((coat, idx) => {
              const st     = coatStatus(coat)
              const prevOk = idx === 0 || coats[idx - 1].applied_at !== null
              const locked = !coat.applied_at && !prevOk
              const numBorder = coat.applied_at ? 'var(--green)' : st.urgent ? 'var(--orange)' : 'var(--sep)'
              const numBg     = coat.applied_at ? 'rgba(52,199,89,.1)' : 'var(--fill2)'
              const numColor  = coat.applied_at ? 'var(--green)' : 'var(--text3)'
              return (
                <div key={coat.id} style={{ borderBottom: idx < coats.length - 1 ? '.5px solid var(--sep2)' : 'none', padding: '14px 16px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div className="coat-num" style={{ color: numColor, borderColor: numBorder, background: numBg }}>{coat.coat_number}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600 }}>{coat.product}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: st.color }}>{st.label}</span>
                          <button className="icon-btn" onClick={() => setEditCoat(coat)}><IEdit size={14} /></button>
                          <button className="icon-btn" onClick={() => del(coat.id)}><ITrash size={14} /></button>
                        </div>
                      </div>
                      {coat.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{coat.notes}</div>}
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                        {coat.applied_at ? `Applied ${fmtShort(coat.applied_at)} · ` : ''}Wait {coat.interval_value}{coat.interval_unit === 'hours' ? 'h' : 'd'}
                      </div>
                      {!locked && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                          <button className="btn-secondary"
                            style={{ background: st.urgent ? 'var(--orange)' : 'var(--fill)', color: st.urgent ? '#fff' : 'var(--text2)' }}
                            onClick={() => setMarkId(coat.id)}>
                            {coat.applied_at ? (st.urgent ? 'Apply next coat' : 'Re-log') : 'Mark applied'}
                          </button>
                          {coat.applied_at && (
                            <button onClick={() => addCalendarReminder(coat)}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600, background: 'rgba(0,122,255,.1)', color: 'var(--blue)' }}>
                              <ICalendar size={14} c="var(--blue)" /> Add to Google Calendar
                            </button>
                          )}
                        </div>
                      )}
                      {locked && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>Waiting for coat {coat.coat_number - 1}</div>}
                    </div>
                  </div>
                </div>
              )
            })}
            {!coats.length && <div style={{ padding: 16 }}><div className="empty" style={{ padding: '24px 0' }}><div className="empty-icon">🎨</div><div className="empty-title">No finish coats</div><div className="empty-sub">Click + to add your schedule</div></div></div>}
          </div>
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}><IPlus size={22} c="#fff" sw={2.5} /></button>
      {showAdd && <AddCoatSheet nextNum={nextNum} defaultCoat={lastCoat} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editCoat && <AddCoatSheet nextNum={editCoat.coat_number} defaultCoat={editCoat} isEdit onSave={f => handleEdit(editCoat.id, f)} onClose={() => setEditCoat(null)} />}
      {markId && (
        <Sheet title="Mark Applied" onClose={() => setMarkId(null)} onSave={async () => {
          const dt = document.getElementById('inp-markdt').value
          if (dt) await markApplied(markId, dt)
        }}>
          <div className="form-group">
            <FormCell label="Date & time" last>
              <input id="inp-markdt" className="form-input" type="datetime-local" defaultValue={localDt()} />
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
  const [uploading, setUploading]   = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [showTag, setShowTag]       = useState(false)
  const fileRef = useRef()
  const photos = data.photos.filter(p => p.project_id === projId && p.photo_type === type)

  const handleFiles = (files) => {
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
      } catch (e) { alert('Upload failed: ' + e.message) }
      setUploading(false)
    }
    setPendingFiles([])
  }

  const del = async (photo) => {
    mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== photo.id) }))
    await db.deletePhoto(photo).catch(e => alert('Error: ' + e.message))
  }

  const edit = async (id, fields) => {
    if (fields._delete) {
      mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== id) }))
      const photo = data.photos.find(p => p.id === id)
      if (photo) await db.deletePhoto(photo).catch(e => alert('Error: ' + e.message))
      return
    }
    mutate(d => ({ ...d, photos: d.photos.map(p => p.id === id ? { ...p, ...fields } : p) }))
    await db.updatePhoto(id, fields).catch(e => alert('Error: ' + e.message))
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <DropZone onFiles={handleFiles} uploading={uploading} />
        {photos.length > 0
          ? <PhotoGrid photos={photos} onDelete={del} onEdit={edit} />
          : <div className="empty"><div className="empty-icon">📷</div><div className="empty-title">No photos yet</div><div className="empty-sub">Drop photos above or tap the camera button</div></div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      <button className="fab" onClick={() => fileRef.current.click()} disabled={uploading}>
        {uploading ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : <ICamera size={22} c="#fff" sw={2} />}
      </button>
      {showTag && <PhotoTagSheet onSave={doUpload} onClose={() => { setShowTag(false); setPendingFiles([]) }} count={pendingFiles.length} />}
    </div>
  )
}

// ─── Sheets ───────────────────────────────────────────────────────────────────
function AddProjectSheet({ onSave, onClose }) {
  const refs = {
    name: useRef(), wood: useRef(), desc: useRef(),
    status: useRef(), rough: useRef(), final: useRef()
  }
  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    await onSave({
      name,
      wood_type:         refs.wood.current?.value.trim() || '',
      description:       refs.desc.current?.value.trim() || '',
      status:            refs.status.current?.value || 'active',
      dimensions_rough:  refs.rough.current?.value.trim() || '',
      dimensions_final:  refs.final.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title="New Project" onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Project name"><input ref={refs.name} className="form-input" placeholder="Cherry Bowl" autoFocus /></FormCell>
        <FormCell label="Wood species"><input ref={refs.wood} className="form-input" placeholder="Cherry" /></FormCell>
        <FormCell label="Notes"><input ref={refs.desc} className="form-input" placeholder="Optional" /></FormCell>
        <FormCell label="Status" last>
          <select ref={refs.status} className="form-select">
            <option value="planning">planning</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="complete">complete</option>
          </select>
        </FormCell>
      </div>
      <div className="form-group">
        <FormCell label="Rough dimensions"><input ref={refs.rough} className="form-input" placeholder='12" × 12" × 4"' /></FormCell>
        <FormCell label="Final dimensions" last><input ref={refs.final} className="form-input" placeholder='10" × 3"' /></FormCell>
      </div>
    </Sheet>
  )
}

function EditProjectSheet({ project, onSave, onClose }) {
  const refs = {
    name: useRef(), wood: useRef(), desc: useRef(),
    status: useRef(), rough: useRef(), final: useRef()
  }
  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    await onSave({
      name,
      wood_type:         refs.wood.current?.value.trim() || '',
      description:       refs.desc.current?.value.trim() || '',
      status:            refs.status.current?.value || 'active',
      dimensions_rough:  refs.rough.current?.value.trim() || '',
      dimensions_final:  refs.final.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title="Edit Project" onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Project name"><input ref={refs.name} className="form-input" defaultValue={project.name} autoFocus /></FormCell>
        <FormCell label="Wood species"><input ref={refs.wood} className="form-input" defaultValue={project.wood_type} /></FormCell>
        <FormCell label="Notes"><input ref={refs.desc} className="form-input" defaultValue={project.description} /></FormCell>
        <FormCell label="Status" last>
          <select ref={refs.status} className="form-select" defaultValue={project.status}>
            <option value="planning">planning</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="complete">complete</option>
          </select>
        </FormCell>
      </div>
      <div className="form-group">
        <FormCell label="Rough dimensions"><input ref={refs.rough} className="form-input" defaultValue={project.dimensions_rough} placeholder='12" × 12" × 4"' /></FormCell>
        <FormCell label="Final dimensions" last><input ref={refs.final} className="form-input" defaultValue={project.dimensions_final} placeholder='10" × 3"' /></FormCell>
      </div>
    </Sheet>
  )
}

function AddCoatSheet({ nextNum, defaultCoat, isEdit, onSave, onClose }) {
  const refs = {
    prod: useRef(), num: useRef(), iv: useRef(),
    iu: useRef(), notes: useRef()
  }
  const handleSave = async () => {
    const product = refs.prod.current?.value.trim()
    if (!product) return
    await onSave({
      product,
      coat_number:    parseInt(refs.num.current?.value) || nextNum,
      interval_value: parseFloat(refs.iv.current?.value) || 4,
      interval_unit:  refs.iu.current?.value || 'hours',
      notes:          refs.notes.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={isEdit ? 'Edit Coat' : 'Add Coat'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Product"><input ref={refs.prod} className="form-input" placeholder="Arm-R-Seal" defaultValue={defaultCoat?.product || ''} autoFocus /></FormCell>
        <FormCell label="Coat #"><input ref={refs.num} className="form-input" type="number" defaultValue={isEdit ? defaultCoat?.coat_number : nextNum} /></FormCell>
        <FormCell label="Wait"><input ref={refs.iv} className="form-input" type="number" defaultValue={defaultCoat?.interval_value ?? 4} /></FormCell>
        <FormCell label="Unit">
          <select ref={refs.iu} className="form-select" defaultValue={defaultCoat?.interval_unit || 'hours'}>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </FormCell>
        <FormCell label="Notes" last><input ref={refs.notes} className="form-input" placeholder="Optional" defaultValue={defaultCoat?.notes || ''} /></FormCell>
      </div>
    </Sheet>
  )
}

function PhotoTagSheet({ onSave, onClose, count }) {
  const [caption, setCaption] = useState('')
  const [tags, setTags] = useState([])
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose}>Cancel</button>
          <span className="sheet-title">{count > 1 ? `${count} Photos` : 'Add Photo'}</span>
          <button className="sheet-save" onClick={() => onSave(caption, tags.join(','))}>Upload</button>
        </div>
        <div className="sheet-body" style={{ paddingBottom: 20 }}>
          <div className="form-group">
            <FormCell label="Caption" last>
              <input className="form-input" placeholder="Optional" value={caption} onChange={e => setCaption(e.target.value)} autoFocus />
            </FormCell>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: '0 4px 8px' }}>Tags</p>
          <TagInput tags={tags} onChange={setTags} />
          <p style={{ fontSize: 12, color: 'var(--text4)', marginTop: 6, padding: '0 4px' }}>Press Enter after each tag. Use "finished" to include in the Finished Products gallery.</p>
        </div>
      </div>
    </div>
  )
}
