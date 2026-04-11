import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar } from '../supabase.js'
import { Sheet, FormCell, ConfirmSheet, maintStatus, fmtShort, localDt, IPlus, ITrash, IEdit, ICal } from '../components/Shared.jsx'

const CATEGORIES = ['Sharpening', 'Lathe', 'Bandsaw', 'Router Table', 'Shop', 'General']

// ─── Sharpening log per maintenance item ─────────────────────────────────────
function SharpeningLog({ item, onUpdate }) {
  const toast = useToast()
  const [show, setShow]   = useState(false)
  const [date, setDate]   = useState(new Date().toISOString().slice(0,10))
  const [angle, setAngle] = useState('')
  const [note, setNote]   = useState('')

  const log = (() => { try { return JSON.parse(item.sharpening_log || '[]') } catch { return [] } })()

  const addEntry = async () => {
    const entry = { id: Math.random().toString(36).slice(2), date, angle: angle.trim(), note: note.trim() }
    const next = [entry, ...log]
    await db.updateMaint(item.id, { sharpening_log: JSON.stringify(next) })
      .then(() => onUpdate(item.id, { sharpening_log: JSON.stringify(next) }))
      .catch(e => toast(e.message, 'error'))
    toast('Logged', 'success')
    setAngle(''); setNote(''); setShow(false)
  }

  const remove = async (id) => {
    const next = log.filter(e => e.id !== id)
    await db.updateMaint(item.id, { sharpening_log: JSON.stringify(next) })
      .then(() => onUpdate(item.id, { sharpening_log: JSON.stringify(next) }))
      .catch(e => toast(e.message, 'error'))
  }

  return (
    <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--border-2)', background: 'var(--fill-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginBottom: show || log.length ? 8 : 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
          Sharpening Log {log.length > 0 ? `· ${log.length} entries` : ''}
        </span>
        <button className="btn-text" style={{ fontSize: 12 }} onClick={() => setShow(s => !s)}>
          {show ? 'Cancel' : '+ Log session'}
        </button>
      </div>
      {show && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ flex: 2, background: 'var(--surface)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border-2)', fontSize: 13 }}
            />
            <input
              className="form-input" placeholder="Angle (e.g. 40°)" value={angle} onChange={e => setAngle(e.target.value)}
              style={{ flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border-2)', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="form-input" placeholder="Note (grit, technique, result…)" value={note} onChange={e => setNote(e.target.value)}
              style={{ flex: 1, background: 'var(--surface)', borderRadius: 8, padding: '7px 10px', border: '1px solid var(--border-2)', fontSize: 13 }}
              onKeyDown={e => e.key === 'Enter' && addEntry()}
            />
            <button className="btn-primary" style={{ padding: '0 14px', fontSize: 13, flexShrink: 0 }} onClick={addEntry}>Save</button>
          </div>
        </div>
      )}
      {log.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 12 }}>
              <div>
                <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>{e.date}</span>
                {e.angle && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{e.angle}</span>}
                {e.note && <span style={{ color: 'var(--text-4)', marginLeft: 8 }}>{e.note}</span>}
              </div>
              <button className="icon-btn" onClick={() => remove(e.id)} style={{ color: 'var(--red)', padding: 0, marginTop: -1 }}><ITrash size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Maintenance() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [markItem, setMarkItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [expanded, setExpanded]     = useState({})

  const del = async id => {
    const prev = data.maintenance
    mutate(d => ({ ...d, maintenance: d.maintenance.filter(m => m.id !== id) }))
    await db.deleteMaint(id).catch(e => { mutate(d => ({ ...d, maintenance: prev })); toast(e.message, 'error') })
    setDeleteItem(null)
  }

  const markDone = async (id, dt) => {
    const last_done = new Date(dt).toISOString()
    mutate(d => ({ ...d, maintenance: d.maintenance.map(m => m.id === id ? { ...m, last_done } : m) }))
    await db.updateMaint(id, { last_done }).catch(e => toast(e.message, 'error'))
    toast('Logged', 'success')
    setMarkItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, maintenance: d.maintenance.map(m => m.id === id ? { ...m, ...fields } : m) }))
      await db.updateMaint(id, fields).catch(e => toast(e.message, 'error'))
      toast('Saved', 'success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addMaint({ last_done: null, ...fields })
        mutate(d => ({ ...d, maintenance: [...d.maintenance, item] }))
        toast('Added', 'success')
        setShowAdd(false)
      } catch (e) { toast(e.message, 'error') }
    }
  }

  const handleLogUpdate = (id, fields) => {
    mutate(d => ({ ...d, maintenance: d.maintenance.map(m => m.id === id ? { ...m, ...fields } : m) }))
  }

  const calReminder = m => {
    const next = m.last_done
      ? new Date(new Date(m.last_done).getTime() + m.interval_days * 86_400_000)
      : new Date(Date.now() + m.interval_days * 86_400_000)
    addToGoogleCalendar({
      title: `${m.name} — JDH Woodworks`,
      start: next,
      end:   new Date(next.getTime() + 3_600_000),
      description: `Scheduled maintenance: ${m.name}. Repeats every ${m.interval_days} days.${m.notes ? '\n\n' + m.notes : ''}`,
    })
  }


  const sorted = [...data.maintenance].sort((a, b) =>
    (maintStatus(a).urgent ? 0 : 1) - (maintStatus(b).urgent ? 0 : 1)
  )
  const cats = [...new Set(sorted.map(m => m.category || 'General'))]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header"><h1 className="page-title">Shop Maintenance</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {cats.map(cat => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {sorted.filter(m => (m.category || 'General') === cat).map((m, i, arr) => {
                  const st   = maintStatus(m)
                  const last = i === arr.length - 1
                  const isExp = expanded[m.id]
                  const hasSharpLog = m.category === 'Sharpening'
                  return (
                    <div key={m.id} style={{ borderBottom: last ? 'none' : '1px solid var(--border-2)', background: 'var(--surface)' }}>
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontWeight: 500 }}>{m.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                            Every {m.interval_days}d{m.last_done ? ` · Last: ${fmtShort(m.last_done)}` : ''}
                          </div>
                          {m.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{m.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {hasSharpLog && (
                              <button className="icon-btn" onClick={() => setExpanded(e => ({ ...e, [m.id]: !e[m.id] }))}
                                aria-label="Sharpening log" title="Sharpening log" style={{ fontSize: 14 }}>
                                🪨
                              </button>
                            )}
                            <button className="icon-btn" onClick={() => setEditItem(m)} aria-label={`Edit ${m.name}`}><IEdit size={14} /></button>
                            <button className="icon-btn" onClick={() => setDeleteItem(m)} aria-label={`Delete ${m.name}`}><ITrash size={14} /></button>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className={st.urgent ? 'btn-primary' : 'btn-secondary'} onClick={() => setMarkItem(m)}>
                          {st.urgent ? 'Mark done' : 'Log done'}
                        </button>
                        <button className="btn-cal" onClick={() => calReminder(m)}>
                          <ICal size={13} color="currentColor" /> Google Calendar
                        </button>
                      </div>
                      {hasSharpLog && isExp && (
                        <SharpeningLog item={m} onUpdate={handleLogUpdate} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {!data.maintenance.length && (
            <div className="empty">
              <div className="empty-icon">🔧</div>
              <div className="empty-title">No maintenance items</div>
              <p className="empty-sub">Track sharpening, oiling, and recurring shop tasks</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add maintenance task">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      {showAdd    && <MaintSheet onSave={f => handleSave(null, f)} onClose={() => setShowAdd(false)} />}
      {editItem   && <MaintSheet item={editItem} onSave={f => handleSave(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem && <ConfirmSheet message={`Delete "${deleteItem.name}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
      {markItem   && (
        <Sheet title="Log Done" onClose={() => setMarkItem(null)} onSave={async () => {
          const el = document.getElementById('maint-dt-input')
          if (el?.value) await markDone(markItem.id, el.value)
        }}>
          <div className="form-group">
            <FormCell label="Date & time" last>
              <input id="maint-dt-input" className="form-input" type="datetime-local" defaultValue={localDt()} />
            </FormCell>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function MaintSheet({ item, onSave, onClose }) {
  const refs = { name: useRef(), cat: useRef(), days: useRef(), notes: useRef() }
  const handleSave = async () => {
    const name = refs.name.current?.value.trim()
    if (!name) return
    await onSave({
      name,
      category:      refs.cat.current?.value  || 'General',
      interval_days: parseInt(refs.days.current?.value) || 14,
      notes:         refs.notes.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Task' : 'Add Task'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Task"><input ref={refs.name} className="form-input" placeholder="Sharpen bowl gouges" defaultValue={item?.name || ''} autoFocus /></FormCell>
        <FormCell label="Category">
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'General'}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
        <FormCell label="Repeat (days)"><input ref={refs.days} className="form-input" type="number" defaultValue={item?.interval_days ?? 14} /></FormCell>
        <FormCell label="Notes" last><input ref={refs.notes} className="form-input" placeholder="Jig settings, angles…" defaultValue={item?.notes || ''} /></FormCell>
      </div>
    </Sheet>
  )
}
