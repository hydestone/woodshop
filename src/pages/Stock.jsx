import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import { Sheet, FormCell, ConfirmSheet, STOCK_STATUS, fmt, IPlus, ITrash, IEdit, ICal, IBell } from '../components/Shared.jsx'

const STATUS_ORDER = ['Freshly cut','Drying','Ready to use','Used up']

// ── Drying time estimator ─────────────────────────────────────────────────────
const SPECIES_FACTORS = {
  'White Oak':2.0,'Red Oak':1.8,'Hard Maple':1.6,'Soft Maple':1.4,'Black Walnut':1.5,
  'Cherry':1.3,'White Ash':1.5,'Hickory':1.9,'Beech':1.7,'Birch':1.4,
  'White Pine':0.8,'Eastern White Pine':0.8,'Douglas Fir':0.9,'Cedar':0.7,
  'Basswood':0.7,'Aspen':0.6,'Poplar':0.9,'Butternut':1.1,'Elm':1.6,
}
function getDryingMonths(species, thicknessIn) {
  const factor = SPECIES_FACTORS[species] || 1.3
  return Math.round(thicknessIn * factor * 12) / 12
}
function getReadyDate(harvestedAt, species, thicknessIn) {
  if (!harvestedAt) return null
  const months = getDryingMonths(species, thicknessIn)
  const d = new Date(harvestedAt)
  d.setMonth(d.getMonth() + Math.ceil(months))
  return d
}

// ── Moisture status ────────────────────────────────────────────────────────────
function moistureStatus(latestReading, intendedUse) {
  if (!latestReading) return null
  const mc = latestReading
  const isOutdoor = intendedUse?.toLowerCase().includes('outdoor') || intendedUse?.toLowerCase().includes('exterior')
  const targetLow = isOutdoor ? 12 : 6
  const targetHigh = isOutdoor ? 15 : 9
  if (mc <= targetHigh) return { label:'Ready', color:'#166534', bg:'#DCFCE7' }
  if (mc <= targetHigh + 4) return { label:'Getting close', color:'#B45309', bg:'#FEF3C7' }
  return { label:'Still drying', color:'#1D4ED8', bg:'#DBEAFE' }
}

// ── EMC calculator ─────────────────────────────────────────────────────────────
function emcCalc(tempF, rh) {
  const W = rh / 100
  const h = 330 + 0.452 * tempF + 0.00415 * tempF * tempF
  const k = 0.791 + 0.000463 * tempF - 0.000000844 * tempF * tempF
  const k1 = 6.34 + 0.000775 * tempF - 0.0000935 * tempF * tempF
  const k2 = 1.09 + 0.0284 * tempF - 0.0000904 * tempF * tempF
  const kW = k * W
  return Math.round(1800 / W * (kW / (1 - kW) + k1 * kW + 2 * k1 * k2 * kW * kW) / (h * (1 + k1 * kW + k1 * k2 * kW * kW)) * 10) / 10
}

function ToolsPanel() {
  const [shopTemp, setShopTemp] = useState(65)
  const [shopRH, setShopRH]     = useState(50)
  const [savedShop, setSavedShop] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shopConditions') || 'null') } catch { return null }
  })
  const [bfW, setBfW] = useState('')
  const [bfH, setBfH] = useState('')
  const [bfL, setBfL] = useState('')
  const [bfQty, setBfQty] = useState('1')

  const saveShop = () => {
    const v = { temp: shopTemp, rh: shopRH }
    localStorage.setItem('shopConditions', JSON.stringify(v))
    setSavedShop(v)
  }

  const emc = emcCalc(shopTemp, shopRH)
  const savedEmc = savedShop ? emcCalc(savedShop.temp, savedShop.rh) : null

  const bfResult = () => {
    const w=parseFloat(bfW),h=parseFloat(bfH),l=parseFloat(bfL),q=parseInt(bfQty)||1
    if(!w||!h||!l) return null
    return Math.round(w*h*l/144*q*100)/100
  }
  const bf = bfResult()

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,margin:'0 20px 24px'}}>
      {/* EMC Calculator */}
      <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:'16px'}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>EMC Calculator</div>
        {savedShop&&<div style={{fontSize:12,color:'var(--text-3)',marginBottom:10,padding:'6px 10px',background:'var(--fill-2)',borderRadius:6}}>
          Saved shop: {savedShop.temp}°F / {savedShop.rh}% RH → EMC <strong style={{color:'var(--forest)'}}>{savedEmc}%</strong>
        </div>}
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Temp (°F)</div>
            <input className="form-input" type="number" value={shopTemp} onChange={e=>setShopTemp(Number(e.target.value))} style={{width:'100%'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Humidity (%)</div>
            <input className="form-input" type="number" value={shopRH} onChange={e=>setShopRH(Number(e.target.value))} style={{width:'100%'}}/>
          </div>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:'var(--accent)',marginBottom:10}}>EMC: {emc}%</div>
        <div style={{fontSize:12,color:'var(--text-3)',marginBottom:10}}>
          {emc<=8?'✓ Good for furniture/indoor':'⚠ Too high for indoor use — wood needs drier conditions'}
        </div>
        <button className="btn-secondary" style={{width:'100%',justifyContent:'center'}} onClick={saveShop}>Save as my shop conditions</button>
      </div>

      {/* Board Foot Calculator */}
      <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:'16px'}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:12}}>Board Foot Calculator</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Thickness (in)</div><input className="form-input" type="number" step="0.25" placeholder="1" value={bfW} onChange={e=>setBfW(e.target.value)}/></div>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Width (in)</div><input className="form-input" type="number" step="0.5" placeholder="6" value={bfH} onChange={e=>setBfH(e.target.value)}/></div>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Length (in)</div><input className="form-input" type="number" step="1" placeholder="96" value={bfL} onChange={e=>setBfL(e.target.value)}/></div>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Qty</div><input className="form-input" type="number" step="1" placeholder="1" value={bfQty} onChange={e=>setBfQty(e.target.value)}/></div>
        </div>
        {bf!==null
          ? <div style={{fontSize:20,fontWeight:700,color:'var(--accent)'}}>{bf} BF</div>
          : <div style={{fontSize:13,color:'var(--text-4)'}}>Enter dimensions above</div>
        }
        <div style={{fontSize:11,color:'var(--text-3)',marginTop:6}}>Formula: T × W × L ÷ 144 × Qty</div>
      </div>
    </div>
  )
}

export default function Stock() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [detail, setDetail]         = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [showTools, setShowTools]   = useState(false)
  const [logCache, setLogCache]     = useState({})

  useEffect(() => {
    data.woodStock.forEach(item => {
      if (!logCache[item.id]) {
        db.loadMoistureLog(item.id).then(rows => {
          setLogCache(prev => ({...prev, [item.id]: rows}))
        }).catch(()=>{})
      }
    })
  }, [data.woodStock])

  const del = async id => {
    mutate(d=>({...d,woodStock:d.woodStock.filter(s=>s.id!==id)}))
    await db.deleteWoodStock(id).catch(e=>toast(e.message,'error'))
    setDeleteItem(null)
  }

  const handleSave = async (id, fields) => {
    if (id) {
      mutate(d=>({...d,woodStock:d.woodStock.map(s=>s.id===id?{...s,...fields}:s)}))
      await db.updateWoodStock(id, fields).catch(e=>toast(e.message,'error'))
      toast('Saved','success')
      setEditItem(null)
    } else {
      try {
        const item = await db.addWoodStock(fields)
        mutate(d=>({...d,woodStock:[...d.woodStock,item]}))
        toast('Added','success')
        setShowAdd(false)
      } catch(e) { toast(e.message,'error') }
    }
  }

  const calReminder = item => {
    if (!item.harvested_at) { toast('Set a harvest date first','error'); return }
    const sixMonths = new Date(new Date(item.harvested_at).getTime()+180*86_400_000)
    addToGoogleCalendar({ title:`Check ${item.species} — ready to use?`, start:sixMonths, end:new Date(sixMonths.getTime()+3_600_000), description:`${item.species} harvested ${fmt(item.harvested_at)}. Check moisture content.` })
  }

  const appleReminder = item => {
    if (!item.harvested_at) { toast('Set a harvest date first','error'); return }
    const sixMonths = new Date(new Date(item.harvested_at).getTime()+180*86_400_000)
    addToAppleReminders({ title:`Check ${item.species} — ready to use?`, notes:`Harvested ${fmt(item.harvested_at)}. Check moisture content.`, dueDate:sixMonths })
  }

  const byStatus = STATUS_ORDER.reduce((acc,s)=>{
    const items=data.woodStock.filter(w=>(w.status||'Drying')===s)
    if(items.length) acc.push({status:s,items})
    return acc
  },[])

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',position:'relative'}}>
      <div className="scroll-page" style={{paddingBottom:80}}>
        <div className="page-header">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h1 className="page-title">Wood Stock</h1>
            <button className={showTools?'btn-primary':'btn-secondary'} style={{padding:'5px 12px',fontSize:13}} onClick={()=>setShowTools(s=>!s)}>
              {showTools?'Hide tools':'Tools & Calculators'}
            </button>
          </div>
        </div>

        {showTools && <ToolsPanel/>}

        <div style={{paddingBottom:24}}>
          {byStatus.map(({status,items})=>{
            const ss=STOCK_STATUS[status]||{bg:'#F9FAFB',color:'#6B7280'}
            return (
              <div key={status}>
                <span className="section-label">{status}</span>
                <div className="group">
                  {items.map((item,i,arr)=>{
                    const logs = logCache[item.id]||[]
                    const latest = logs.length ? logs.sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at))[0]?.reading : null
                    const ms = moistureStatus(latest, item.intended_use)
                    const readyDate = getReadyDate(item.harvested_at, item.species, item.thickness_in||1)
                    const isReady = readyDate && new Date() >= readyDate
                    return (
                      <div key={item.id} style={{borderBottom:i<arr.length-1?'1px solid var(--border-2)':'none',padding:'12px 16px',background:'var(--surface)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                          <div style={{flex:1,paddingRight:12}}>
                            <div style={{fontWeight:600}}>{item.species}</div>
                            {item.location&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>📍 {item.location}</div>}
                            {item.harvested_at&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>Harvested: {fmt(item.harvested_at)}</div>}
                            {item.intended_use&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>Use: {item.intended_use}</div>}

                            {/* Moisture status indicator */}
                            {ms&&<div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,padding:'3px 10px',borderRadius:99,background:ms.bg}}>
                              <div style={{width:7,height:7,borderRadius:'50%',background:ms.color}}/>
                              <span style={{fontSize:12,fontWeight:600,color:ms.color}}>{ms.label}</span>
                              {latest&&<span style={{fontSize:12,color:ms.color,opacity:.8}}>· {latest}%</span>}
                            </div>}

                            {/* Drying estimator */}
                            {readyDate&&status!=='Ready to use'&&status!=='Used up'&&(
                              <div style={{fontSize:12,color:isReady?'var(--forest)':'var(--text-3)',marginTop:4}}>
                                {isReady?'✓ Est. ready since':'Est. ready:'} {readyDate.toLocaleDateString('en-US',{month:'short',year:'numeric'})}
                              </div>
                            )}

                            {item.notes&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:4}}>{item.notes}</div>}
                            <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                              <button className="btn-secondary" onClick={()=>setDetail(item)}>Moisture log</button>
                              {(status==='Freshly cut'||status==='Drying')&&<>
                                <button className="btn-cal" onClick={()=>calReminder(item)}><ICal size={13} color="currentColor"/> Google Calendar</button>
                                <button className="btn-reminder" onClick={()=>appleReminder(item)}><IBell size={13} color="currentColor"/> Add to Reminders</button>
                              </>}
                            </div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                            <span className="badge-pill" style={{background:ss.bg,color:ss.color,fontSize:11}}>{status}</span>
                            <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                              <button className="icon-btn" onClick={()=>setEditItem(item)} aria-label={`Edit ${item.species}`}><IEdit size={14}/></button>
                              <button className="icon-btn" onClick={()=>setDeleteItem(item)} aria-label={`Delete ${item.species}`}><ITrash size={14}/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {!data.woodStock.length&&(
            <div className="empty">
              <div className="empty-icon">🌲</div>
              <div className="empty-title">No wood stock</div>
              <p className="empty-sub">Track your harvested and drying lumber</p>
            </div>
          )}
        </div>
      </div>
      <button className="fab" onClick={()=>setShowAdd(true)} aria-label="Add wood stock"><IPlus size={22} color="#fff" sw={2.5}/></button>
      {showAdd    &&<StockSheet onSave={f=>handleSave(null,f)} onClose={()=>setShowAdd(false)}/>}
      {editItem   &&<StockSheet item={editItem} onSave={f=>handleSave(editItem.id,f)} onClose={()=>setEditItem(null)}/>}
      {deleteItem &&<ConfirmSheet message={`Delete "${deleteItem.species}"?`} onConfirm={()=>del(deleteItem.id)} onClose={()=>setDeleteItem(null)}/>}
      {detail     &&<MoistureLog item={detail} onClose={()=>setDetail(null)} onAdded={rows=>setLogCache(prev=>({...prev,[detail.id]:rows}))}/>}
    </div>
  )
}

function StockSheet({ item, onSave, onClose }) {
  const refs = { species:useRef(), location:useRef(), harvested:useRef(), use:useRef(), status:useRef(), notes:useRef(), thickness:useRef() }
  const handleSave = async () => {
    const species = refs.species.current?.value.trim()
    if (!species) return
    await onSave({
      species,
      location:     refs.location.current?.value.trim()||'',
      harvested_at: refs.harvested.current?.value||null,
      intended_use: refs.use.current?.value.trim()||'',
      status:       refs.status.current?.value||'Drying',
      notes:        refs.notes.current?.value.trim()||'',
      thickness_in: parseFloat(refs.thickness.current?.value)||1,
    })
  }
  return (
    <Sheet title={item?'Edit Stock':'Add Wood Stock'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Species"><input ref={refs.species} className="form-input" placeholder="White Oak" defaultValue={item?.species||''} autoFocus/></FormCell>
        <FormCell label="Location/Source"><input ref={refs.location} className="form-input" placeholder="Back lot, Sherborn" defaultValue={item?.location||''}/></FormCell>
        <FormCell label="Thickness (in)"><input ref={refs.thickness} className="form-input" type="number" step="0.25" placeholder="1" defaultValue={item?.thickness_in||''}/></FormCell>
        <FormCell label="Harvested"><input ref={refs.harvested} className="form-input" type="date" defaultValue={item?.harvested_at||''}/></FormCell>
        <FormCell label="Intended use"><input ref={refs.use} className="form-input" placeholder="Bowl blanks" defaultValue={item?.intended_use||''}/></FormCell>
        <FormCell label="Status">
          <select ref={refs.status} className="form-select" defaultValue={item?.status||'Drying'}>
            {['Freshly cut','Drying','Ready to use','Used up'].map(s=><option key={s}>{s}</option>)}
          </select>
        </FormCell>
        <FormCell label="Notes" last><input ref={refs.notes} className="form-input" placeholder="Optional" defaultValue={item?.notes||''}/></FormCell>
      </div>
    </Sheet>
  )
}

function MoistureLog({ item, onClose, onAdded }) {
  const toast = useToast()
  const [log, setLog]         = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const readingRef = useRef()
  const notesRef   = useRef()

  useEffect(()=>{
    db.loadMoistureLog(item.id).then(rows=>{setLog(rows);setLoading(false)}).catch(()=>setLoading(false))
  },[item.id])

  const addReading = async () => {
    const reading = parseFloat(readingRef.current?.value)
    if (isNaN(reading)) return
    try {
      const row = await db.addMoistureReading(item.id, reading, notesRef.current?.value.trim()||'')
      const newLog = [...log, row]
      setLog(newLog)
      onAdded&&onAdded(newLog)
      toast('Reading saved','success')
      setShowAdd(false)
    } catch(e) { toast(e.message,'error') }
  }

  return (
    <Sheet title={`${item.species} — Moisture Log`} onClose={onClose} onSave={null}>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button className="btn-secondary" onClick={()=>setShowAdd(s=>!s)}>+ Add reading</button>
      </div>
      {showAdd&&(
        <div className="form-group" style={{marginBottom:16}}>
          <FormCell label="Reading (%)"><input ref={readingRef} className="form-input" type="number" step="0.1" placeholder="8.5" autoFocus/></FormCell>
          <FormCell label="Notes" last><input ref={notesRef} className="form-input" placeholder="Optional"/></FormCell>
          <div style={{padding:'10px 16px'}}><button className="btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={addReading}>Save</button></div>
        </div>
      )}
      {loading
        ?<div style={{textAlign:'center',padding:32}}><div className="spinner" style={{margin:'0 auto'}}/></div>
        :log.length===0
          ?<div className="empty" style={{padding:'32px 0'}}><div className="empty-icon">💧</div><div className="empty-title">No readings yet</div><p className="empty-sub">Track moisture content over time</p></div>
          :<div className="group">
            {log.sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).map((r,i)=>(
              <div key={r.id} className="cell" style={{borderBottom:i<log.length-1?'1px solid var(--border-2)':'none'}}>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:16}}>{r.reading}%</div>{r.notes&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>{r.notes}</div>}</div>
                <div style={{fontSize:13,color:'var(--text-3)'}}>{fmt(r.logged_at)}</div>
              </div>
            ))}
          </div>
      }
    </Sheet>
  )
}
