import { useState, useRef } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import { Sheet, FormCell, maintStatus, fmtShort, localDt, IPlus, ITrash, IEdit, ICalendar, IBell } from '../components/Shared.jsx'

export default function Maintenance() {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd]   = useState(false)
  const [markId, setMarkId]     = useState(null)
  const [editItem, setEditItem] = useState(null)

  const del = async (id) => {
    mutate(d => ({ ...d, maintenance: d.maintenance.filter(m => m.id !== id) }))
    await db.deleteMaint(id).catch(e => alert('Error: ' + e.message))
  }

  const markDone = async (id, dt) => {
    const last_done = new Date(dt).toISOString()
    mutate(d => ({ ...d, maintenance: d.maintenance.map(m => m.id === id ? { ...m, last_done } : m) }))
    await db.updateMaint(id, { last_done }).catch(e => alert('Error: ' + e.message))
    setMarkId(null)
  }

  const handleAdd = async (fields) => {
    try {
      const item = await db.addMaint({ last_done: null, ...fields })
      mutate(d => ({ ...d, maintenance: [...d.maintenance, item] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, maintenance: d.maintenance.map(m => m.id === id ? { ...m, ...fields } : m) }))
    await db.updateMaint(id, fields).catch(e => alert('Error: ' + e.message))
    setEditItem(null)
  }

  const addReminder = (m) => {
    const next = m.last_done
      ? new Date(new Date(m.last_done).getTime() + m.interval_days * 86400000)
      : new Date(Date.now() + m.interval_days * 86400000)
    addToGoogleCalendar({
      title: `${m.name} — JDH Woodworks`,
      start: next,
      end: new Date(next.getTime() + 3600000),
      description: `Scheduled maintenance: ${m.name}. Every ${m.interval_days} days.${m.notes ? '\n\n' + m.notes : ''}`,
    })
  }

  const sorted = [...data.maintenance].sort((a, b) =>
    (maintStatus(a).urgent ? 0 : 1) - (maintStatus(b).urgent ? 0 : 1))
  const cats = [...new Set(sorted.map(m => m.category || 'General'))]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar"><h1>Maintenance</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {cats.map(cat => (
            <div key={cat}>
              <span className="section-label">{cat}</span>
              <div className="group">
                {sorted.filter(m => (m.category || 'General') === cat).map((m, i, arr) => {
                  const st   = maintStatus(m)
                  const last = i === arr.length - 1
                  return (
                    <div key={m.id} style={{ borderBottom: last ? 'none' : '.5px solid var(--sep2)', background: 'var(--surface)' }}>
                      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontWeight: 500 }}>{m.name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                            Every {m.interval_days}d{m.last_done ? ` · Last: ${fmtShort(m.last_done)}` : ''}
                          </div>
                          {m.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{m.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: st.color, whiteSpace: 'nowrap' }}>{st.label}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="icon-btn" onClick={() => setEditItem(m)}><IEdit size={14} /></button>
                            <button className="icon-btn" onClick={() => del(m.id)}><ITrash size={14} /></button>
                          </div>
                        </div>
                      </div>
                      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn-secondary"
                          style={{ background: st.urgent ? 'var(--blue)' : 'var(--fill)', color: st.urgent ? '#fff' : 'var(--text2)' }}
                          onClick={() => setMarkId(m.id)}>
                          {st.urgent ? 'Mark done' : 'Log done'}
                        </button>
                        <button onClick={() => addReminder(m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600, background: 'rgba(0,122,255,.1)', color: 'var(--blue)' }}>
                          <ICalendar size={14} c="var(--blue)" /> Google Calendar
                        </button>
                        <button onClick={() => {
                          const next = m.last_done
                            ? new Date(new Date(m.last_done).getTime() + m.interval_days * 86400000)
                            : new Date(Date.now() + m.interval_days * 86400000)
                          addToAppleReminders({ title: `${m.name} — JDH Woodworks`, notes: m.notes || '', dueDate: next })
                        }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600, background: 'rgba(52,199,89,.1)', color: 'var(--green)' }}>
                          <IBell size={14} c="var(--green)" /> Add to Reminders
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
              <div className="empty-sub">Track sharpening and recurring shop tasks</div>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}>
        <IPlus size={22} c="#fff" sw={2.5} />
      </button>
      {showAdd && <MaintSheet onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editItem && <MaintSheet item={editItem} onSave={f => handleEdit(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {markId && (
        <Sheet title="Mark Done" onClose={() => setMarkId(null)} onSave={async () => {
          const dt = document.getElementById('inp-donedt').value
          if (dt) await markDone(markId, dt)
        }}>
          <div className="form-group">
            <FormCell label="Date & time" last>
              <input id="inp-donedt" className="form-input" type="datetime-local" defaultValue={localDt()} />
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
      category:      refs.cat.current?.value || 'Sharpening',
      interval_days: parseInt(refs.days.current?.value) || 14,
      notes:         refs.notes.current?.value.trim() || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Task' : 'Add Task'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Task">
          <input ref={refs.name} className="form-input" placeholder="Sharpen bowl gouges"
            defaultValue={item?.name || ''} autoFocus />
        </FormCell>
        <FormCell label="Category">
          <select ref={refs.cat} className="form-select" defaultValue={item?.category || 'Sharpening'}>
            {['Sharpening','Lathe','Bandsaw','Router Table','Shop','General'].map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
        <FormCell label="Repeat (days)">
          <input ref={refs.days} className="form-input" type="number"
            defaultValue={item?.interval_days ?? 14} />
        </FormCell>
        <FormCell label="Notes" last>
          <input ref={refs.notes} className="form-input" placeholder="Jig settings, angles…"
            defaultValue={item?.notes || ''} />
        </FormCell>
      </div>
    </Sheet>
  )
}
