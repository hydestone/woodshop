import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import { Sheet, FormCell, ConfirmSheet, maintStatus, fmtShort, localDt, IPlus, ITrash, IEdit, ICal, IBell } from '../components/Shared.jsx'

const CATEGORIES = ['Sharpening', 'Lathe', 'Bandsaw', 'Router Table', 'Shop', 'General']

export default function Maintenance() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [markItem, setMarkItem]     = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const del = async id => {
    mutate(d => ({ ...d, maintenance: d.maintenance.filter(m => m.id !== id) }))
    await db.deleteMaint(id).catch(e => toast(e.message, 'error'))
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

  const appleReminder = m => {
    const next = m.last_done
      ? new Date(new Date(m.last_done).getTime() + m.interval_days * 86_400_000)
      : new Date(Date.now() + m.interval_days * 86_400_000)
    addToAppleReminders({ title: `${m.name} — JDH Woodworks`, notes: m.notes || '', dueDate: next })
  }

  const sorted = [...data.maintenance].sort((a, b) =>
    (maintStatus(a).urgent ? 0 : 1) - (maintStatus(b).urgent ? 0 : 1)
  )
  const cats = [...new Set(sorted.map(m => m.category || 'General'))]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header"><h1 className="page-title">Maintenance</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {cats.map(cat => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {sorted.filter(m => (m.category || 'General') === cat).map((m, i, arr) => {
                  const st   = maintStatus(m)
                  const last = i === arr.length - 1
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
                            <button className="icon-btn" onClick={() => setEditItem(m)} aria-label={`Edit ${m.name}`}><IEdit size={14} /></button>
                            <button className="icon-btn" onClick={() => setDeleteItem(m)} aria-label={`Delete ${m.name}`}><ITrash size={14} /></button>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          className={st.urgent ? 'btn-primary' : 'btn-secondary'}
                          onClick={() => setMarkItem(m)}
                        >
                          {st.urgent ? 'Mark done' : 'Log done'}
                        </button>
                        <button className="btn-cal" onClick={() => calReminder(m)}>
                          <ICal size={13} color="currentColor" /> Google Calendar
                        </button>
                        <button className="btn-reminder" onClick={() => appleReminder(m)}>
                          <IBell size={13} color="currentColor" /> Add to Reminders
                        </button>
                      </div>
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
