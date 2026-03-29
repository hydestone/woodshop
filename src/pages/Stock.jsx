import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import { Sheet, FormCell, STOCK_STATUS, fmt, IPlus, ITrash, IEdit, ICalendar, IBell } from '../components/Shared.jsx'

export default function Stock() {
  const { data, mutate } = useCtx()
  const [showAdd, setShowAdd]   = useState(false)
  const [detail, setDetail]     = useState(null)
  const [editItem, setEditItem] = useState(null)

  const del = async (id) => {
    mutate(d => ({ ...d, woodStock: d.woodStock.filter(s => s.id !== id) }))
    await db.deleteWoodStock(id).catch(e => alert('Error: ' + e.message))
  }

  const handleAdd = async (fields) => {
    try {
      const item = await db.addWoodStock(fields)
      mutate(d => ({ ...d, woodStock: [...d.woodStock, item] }))
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  const handleEdit = async (id, fields) => {
    mutate(d => ({ ...d, woodStock: d.woodStock.map(s => s.id === id ? { ...s, ...fields } : s) }))
    await db.updateWoodStock(id, fields).catch(e => alert('Error: ' + e.message))
    setEditItem(null)
  }

  const addDryingReminder = (item) => {
    if (!item.harvested_at) { alert('Set a harvest date first.'); return }
    const sixMonths = new Date(new Date(item.harvested_at).getTime() + 180 * 86400000)
    addToGoogleCalendar({
      title: `Check ${item.species} — ready to use?`,
      start: sixMonths,
      end: new Date(sixMonths.getTime() + 3600000),
      description: `${item.species} harvested ${fmt(item.harvested_at)}. Intended use: ${item.intended_use}. Check moisture content.`,
    })
  }

  const byStatus = {}
  for (const s of data.woodStock) {
    const key = s.status || 'Drying'
    if (!byStatus[key]) byStatus[key] = []
    byStatus[key].push(s)
  }
  const statusOrder = ['Freshly cut','Drying','Ready to use','Used up']

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="navbar"><h1>Wood Stock</h1></div>
        <div style={{ paddingBottom: 24 }}>
          {statusOrder.filter(s => byStatus[s]?.length).map(status => {
            const ss = STOCK_STATUS[status] || { bg: '#E5E5EA', color: '#8E8E93' }
            return (
              <div key={status}>
                <span className="section-label">{status}</span>
                <div className="group">
                  {byStatus[status].map((item, i, arr) => (
                    <div key={item.id} className="cell" style={{ borderBottom: i < arr.length - 1 ? '.5px solid var(--sep2)' : 'none', alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 600 }}>{item.species}</div>
                          <span className="badge-pill" style={{ background: ss.bg, color: ss.color, fontSize: 11 }}>{item.status}</span>
                        </div>
                        {item.location && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>📍 {item.location}</div>}
                        {item.harvested_at && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Harvested: {fmt(item.harvested_at)}</div>}
                        {item.intended_use && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Use: {item.intended_use}</div>}
                        {item.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{item.notes}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          <button className="btn-secondary" onClick={() => setDetail(item)}>Moisture log</button>
                          {(item.status === 'Freshly cut' || item.status === 'Drying') && (<>
                            <button onClick={() => addDryingReminder(item)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600, background: 'rgba(0,122,255,.1)', color: 'var(--blue)' }}>
                              <ICalendar size={13} c="var(--blue)" /> Google Calendar
                            </button>
                            <button onClick={() => {
                              if (!item.harvested_at) { alert('Set a harvest date first.'); return }
                              const sixMonths = new Date(new Date(item.harvested_at).getTime() + 180 * 86400000)
                              addToAppleReminders({ title: `Check ${item.species} — ready to use?`, notes: `Harvested ${fmt(item.harvested_at)}. Check moisture content.`, dueDate: sixMonths })
                            }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600, background: 'rgba(52,199,89,.1)', color: 'var(--green)' }}>
                              <IBell size={13} c="var(--green)" /> Add to Reminders
                            </button>
                          </>)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 8 }}>
                        <button className="icon-btn" onClick={() => setEditItem(item)}><IEdit size={15} /></button>
                        <button className="icon-btn" onClick={() => del(item.id)}><ITrash size={15} /></button>
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
              <div className="empty-sub">Track your harvested and drying lumber</div>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}>
        <IPlus size={22} c="#fff" sw={2.5} />
      </button>
      {showAdd && <StockSheet onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editItem && <StockSheet item={editItem} onSave={f => handleEdit(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {detail && <MoistureLog item={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function StockSheet({ item, onSave, onClose }) {
  const refs = {
    species: useRef(), location: useRef(), harvested: useRef(),
    use: useRef(), status: useRef(), notes: useRef()
  }
  const handleSave = async () => {
    const species = refs.species.current?.value.trim()
    if (!species) return
    await onSave({
      species,
      location:     refs.location.current?.value.trim() || '',
      harvested_at: refs.harvested.current?.value || null,
      intended_use: refs.use.current?.value.trim() || '',
      status:       refs.status.current?.value || 'Drying',
      notes:        refs.notes.current?.value.trim() || '',
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
  const [log, setLog] = useState([])
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
      setShowAdd(false)
    } catch (e) { alert('Error: ' + e.message) }
  }

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <button className="sheet-cancel" onClick={onClose}>Done</button>
          <span className="sheet-title">{item.species} — Moisture Log</span>
          <button className="sheet-save" onClick={() => setShowAdd(s => !s)}>+ Add</button>
        </div>
        <div className="sheet-body" style={{ paddingBottom: 20 }}>
          {showAdd && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <FormCell label="Reading (%)"><input ref={readingRef} className="form-input" type="number" step="0.1" placeholder="8.5" autoFocus /></FormCell>
              <FormCell label="Notes" last><input ref={notesRef} className="form-input" placeholder="Optional" /></FormCell>
              <div style={{ padding: '10px 16px' }}>
                <button className="btn-primary" style={{ width: '100%' }} onClick={addReading}>Save reading</button>
              </div>
            </div>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : log.length === 0 ? (
            <div className="empty" style={{ padding: '32px 0' }}>
              <div className="empty-icon">💧</div>
              <div className="empty-title">No readings yet</div>
              <div className="empty-sub">Track moisture content over time</div>
            </div>
          ) : (
            <div className="group">
              {log.map((r, i) => (
                <div key={r.id} className="cell" style={{ borderBottom: i < log.length - 1 ? '.5px solid var(--sep2)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.reading}%</div>
                    {r.notes && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>{r.notes}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>{fmt(r.logged_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
