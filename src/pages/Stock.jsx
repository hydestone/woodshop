import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import { Sheet, FormCell, ConfirmSheet, STOCK_STATUS, fmt, IPlus, ITrash, IEdit, ICal, IBell } from '../components/Shared.jsx'

const STATUS_ORDER = ['Freshly cut', 'Drying', 'Ready to use', 'Used up']

export default function Stock() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [detail, setDetail]         = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)

  const del = async id => {
    mutate(d => ({ ...d, woodStock: d.woodStock.filter(s => s.id !== id) }))
    await db.deleteWoodStock(id).catch(e => toast(e.message, 'error'))
    setDeleteItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, woodStock: d.woodStock.map(s => s.id === id ? { ...s, ...fields } : s) }))
      await db.updateWoodStock(id, fields).catch(e => toast(e.message, 'error'))
      toast('Saved', 'success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addWoodStock(fields)
        mutate(d => ({ ...d, woodStock: [...d.woodStock, item] }))
        toast('Added', 'success')
        setShowAdd(false)
      } catch (e) { toast(e.message, 'error') }
    }
  }

  const calReminder = item => {
    if (!item.harvested_at) { toast('Set a harvest date first', 'error'); return }
    const sixMonths = new Date(new Date(item.harvested_at).getTime() + 180 * 86_400_000)
    addToGoogleCalendar({
      title: `Check ${item.species} — ready to use?`,
      start: sixMonths,
      end:   new Date(sixMonths.getTime() + 3_600_000),
      description: `${item.species} harvested ${fmt(item.harvested_at)}. Check moisture content and assess readiness.`,
    })
  }

  const appleReminder = item => {
    if (!item.harvested_at) { toast('Set a harvest date first', 'error'); return }
    const sixMonths = new Date(new Date(item.harvested_at).getTime() + 180 * 86_400_000)
    addToAppleReminders({
      title: `Check ${item.species} — ready to use?`,
      notes: `Harvested ${fmt(item.harvested_at)}. Check moisture content.`,
      dueDate: sixMonths,
    })
  }

  const byStatus = STATUS_ORDER.reduce((acc, s) => {
    const items = data.woodStock.filter(w => (w.status || 'Drying') === s)
    if (items.length) acc.push({ status: s, items })
    return acc
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header"><h1 className="page-title">Wood Stock</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {byStatus.map(({ status, items }) => {
            const ss = STOCK_STATUS[status] || { bg: '#F9FAFB', color: '#6B7280' }
            return (
              <div key={status}>
                <span className="section-label">{status}</span>
                <div className="group">
                  {items.map((item, i, arr) => (
                    <div key={item.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', padding: '12px 16px', background: 'var(--surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ fontWeight: 600 }}>{item.species}</div>
                          {item.location && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>📍 {item.location}</div>}
                          {item.harvested_at && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Harvested: {fmt(item.harvested_at)}</div>}
                          {item.intended_use && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Use: {item.intended_use}</div>}
                          {item.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{item.notes}</div>}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <button className="btn-secondary" onClick={() => setDetail(item)}>Moisture log</button>
                            {(status === 'Freshly cut' || status === 'Drying') && (<>
                              <button className="btn-cal" onClick={() => calReminder(item)}>
                                <ICal size={13} color="currentColor" /> Google Calendar
                              </button>
                              <button className="btn-reminder" onClick={() => appleReminder(item)}>
                                <IBell size={13} color="currentColor" /> Add to Reminders
                              </button>
                            </>)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <span className="badge-pill" style={{ background: ss.bg, color: ss.color, fontSize: 11 }}>{status}</span>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button className="icon-btn" onClick={() => setEditItem(item)} aria-label={`Edit ${item.species}`}><IEdit size={14} /></button>
                            <button className="icon-btn" onClick={() => setDeleteItem(item)} aria-label={`Delete ${item.species}`}><ITrash size={14} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {!data.woodStock.length && (
            <div className="empty">
              <div className="empty-icon">🌲</div>
              <div className="empty-title">No wood stock</div>
              <p className="empty-sub">Track your harvested and drying lumber</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add wood stock">
        <IPlus size={22} color="#fff" sw={2.5} />
      </button>
      {showAdd     && <StockSheet onSave={f => handleSave(null, f)} onClose={() => setShowAdd(false)} />}
      {editItem    && <StockSheet item={editItem} onSave={f => handleSave(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {deleteItem  && <ConfirmSheet message={`Delete "${deleteItem.species}"?`} onConfirm={() => del(deleteItem.id)} onClose={() => setDeleteItem(null)} />}
      {detail      && <MoistureLog item={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function StockSheet({ item, onSave, onClose }) {
  const refs = { species: useRef(), location: useRef(), harvested: useRef(), use: useRef(), status: useRef(), notes: useRef() }
  const handleSave = async () => {
    const species = refs.species.current?.value.trim()
    if (!species) return
    await onSave({
      species,
      location:     refs.location.current?.value.trim()  || '',
      harvested_at: refs.harvested.current?.value        || null,
      intended_use: refs.use.current?.value.trim()       || '',
      status:       refs.status.current?.value           || 'Drying',
      notes:        refs.notes.current?.value.trim()     || '',
    })
  }
  return (
    <Sheet title={item ? 'Edit Stock' : 'Add Wood Stock'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Species"><input ref={refs.species} className="form-input" placeholder="White Oak" defaultValue={item?.species || ''} autoFocus /></FormCell>
        <FormCell label="Location/Source"><input ref={refs.location} className="form-input" placeholder="Back lot, Sherborn" defaultValue={item?.location || ''} /></FormCell>
        <FormCell label="Harvested"><input ref={refs.harvested} className="form-input" type="date" defaultValue={item?.harvested_at || ''} /></FormCell>
        <FormCell label="Intended use"><input ref={refs.use} className="form-input" placeholder="Bowl blanks" defaultValue={item?.intended_use || ''} /></FormCell>
        <FormCell label="Status">
          <select ref={refs.status} className="form-select" defaultValue={item?.status || 'Drying'}>
            {['Freshly cut','Drying','Ready to use','Used up'].map(s => <option key={s}>{s}</option>)}
          </select>
        </FormCell>
        <FormCell label="Notes" last><input ref={refs.notes} className="form-input" placeholder="Optional" defaultValue={item?.notes || ''} /></FormCell>
      </div>
    </Sheet>
  )
}

function MoistureLog({ item, onClose }) {
  const toast = useToast()
  const [log, setLog]       = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const readingRef = useRef()
  const notesRef   = useRef()

  useEffect(() => {
    db.loadMoistureLog(item.id).then(rows => { setLog(rows); setLoading(false) }).catch(() => setLoading(false))
  }, [item.id])

  const addReading = async () => {
    const reading = parseFloat(readingRef.current?.value)
    if (isNaN(reading)) return
    try {
      const row = await db.addMoistureReading(item.id, reading, notesRef.current?.value.trim() || '')
      setLog(prev => [...prev, row])
      toast('Reading saved', 'success')
      setShowAdd(false)
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <Sheet title={`${item.species} — Moisture Log`} onClose={onClose} onSave={null}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn-secondary" onClick={() => setShowAdd(s => !s)}>+ Add reading</button>
      </div>
      {showAdd && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <FormCell label="Reading (%)"><input ref={readingRef} className="form-input" type="number" step="0.1" placeholder="8.5" autoFocus /></FormCell>
          <FormCell label="Notes" last><input ref={notesRef} className="form-input" placeholder="Optional" /></FormCell>
          <div style={{ padding: '10px 16px' }}>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addReading}>Save</button>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : log.length === 0 ? (
        <div className="empty" style={{ padding: '32px 0' }}>
          <div className="empty-icon">💧</div>
          <div className="empty-title">No readings yet</div>
          <p className="empty-sub">Track moisture content over time</p>
        </div>
      ) : (
        <div className="group">
          {log.map((r, i) => (
            <div key={r.id} className="cell" style={{ borderBottom: i < log.length - 1 ? '1px solid var(--border-2)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{r.reading}%</div>
                {r.notes && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{r.notes}</div>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{fmt(r.logged_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
