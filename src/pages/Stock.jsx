import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { addToGoogleCalendar, addToAppleReminders } from '../supabase.js'
import { Sheet, FormCell, ConfirmSheet, DropZone, STOCK_STATUS, fmt, IPlus, ITrash, IEdit, ICal, IBell, ICamera } from '../components/Shared.jsx'

const STATUS_ORDER = ['Freshly cut','Drying','Ready to use','Used up']

// ── Drying estimator ──────────────────────────────────────────────────────────
const SPECIES_FACTORS = { 'White Oak':2.0,'Red Oak':1.8,'Hard Maple':1.6,'Soft Maple':1.4,'Black Walnut':1.5,'Cherry':1.3,'White Ash':1.5,'Hickory':1.9,'Beech':1.7,'Birch':1.4,'White Pine':0.8,'Eastern White Pine':0.8,'Douglas Fir':0.9,'Cedar':0.7,'Basswood':0.7,'Aspen':0.6,'Poplar':0.9,'Butternut':1.1,'Elm':1.6 }
function getReadyDate(harvestedAt, species, thicknessIn) {
  if (!harvestedAt) return null
  const factor = SPECIES_FACTORS[species] || 1.3
  const months = Math.ceil(thicknessIn * factor * 12) / 12
  const d = new Date(harvestedAt)
  d.setMonth(d.getMonth() + Math.ceil(months))
  return d
}

// ── Moisture status ───────────────────────────────────────────────────────────
function moistureStatus(reading, intendedUse) {
  if (!reading) return null
  const isOutdoor = intendedUse?.toLowerCase().includes('outdoor') || intendedUse?.toLowerCase().includes('exterior')
  const hi = isOutdoor ? 15 : 9
  if (reading <= hi) return { label:'Ready', color:'#166534', bg:'#DCFCE7' }
  if (reading <= hi + 4) return { label:'Getting close', color:'#B45309', bg:'#FEF3C7' }
  return { label:'Still drying', color:'#1D4ED8', bg:'#DBEAFE' }
}

// ── EMC + board foot ──────────────────────────────────────────────────────────
function emcCalc(tempF, rh) {
  const W=rh/100, h=330+0.452*tempF+0.00415*tempF*tempF, k=0.791+0.000463*tempF-0.000000844*tempF*tempF
  const k1=6.34+0.000775*tempF-0.0000935*tempF*tempF, k2=1.09+0.0284*tempF-0.0000904*tempF*tempF, kW=k*W
  return Math.round(1800/W*(kW/(1-kW)+k1*kW+2*k1*k2*kW*kW)/(h*(1+k1*kW+k1*k2*kW*kW))*10)/10
}


// ── Species manager ───────────────────────────────────────────────────────────
function SpeciesManager() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const species = data.species || []
  const [newName, setNewName]   = useState('')
  const [editItem, setEditItem] = useState(null)
  const [editVal, setEditVal]   = useState('')
  const [expanded, setExpanded] = useState(false)

  const add = async () => {
    const name = newName.trim(); if (!name) return
    try {
      const item = await db.addSpecies(name)
      mutate(d => ({ ...d, species: [...(d.species||[]), item].sort((a,b)=>a.name.localeCompare(b.name)) }))
      setNewName(''); toast(`${name} added`, 'success')
    } catch(e) { toast(e.message, 'error') }
  }

  const rename = async () => {
    const name = editVal.trim(); if (!name) return
    try {
      await db.updateSpecies(editItem.id, name)
      const old = species.find(s => s.id === editItem.id)
      mutate(d => ({
        ...d,
        species: d.species.map(s => s.id === editItem.id ? { ...s, name } : s),
        projects: old ? d.projects.map(p => p.wood_type === old.name ? { ...p, wood_type: name } : p) : d.projects,
      }))
      setEditItem(null); toast('Renamed', 'success')
    } catch(e) { toast(e.message, 'error') }
  }

  const remove = async id => {
    await db.deleteSpecies(id).catch(e => toast(e.message, 'error'))
    mutate(d => ({ ...d, species: d.species.filter(s => s.id !== id) }))
  }

  return (
    <div style={{ margin: '8px 20px 16px', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--fill)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px' }}>
          Wood Species ({species.length})
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{expanded ? '▲' : '▼'} manage</span>
      </button>
      {expanded && (
        <div style={{ padding: '0 0 12px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 16px 4px' }}>Species names used in project dropdowns.</p>
          {species.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: i < species.length-1 ? '1px solid var(--border-2)' : 'none' }}>
              {editItem?.id === s.id ? (
                <>
                  <input className="form-input" style={{ flex: 1, fontSize: 13 }} value={editVal} onChange={e => setEditVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditItem(null) }} autoFocus />
                  <button className="btn-text" style={{ marginLeft: 8, fontSize: 12 }} onClick={rename}>Save</button>
                  <button className="btn-text" style={{ marginLeft: 4, fontSize: 12, color: 'var(--text-3)' }} onClick={() => setEditItem(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text)' }}>{s.name}</span>
                  <button className="icon-btn" onClick={() => { setEditItem(s); setEditVal(s.name) }}><IEdit size={13} /></button>
                  <button className="icon-btn" onClick={() => remove(s.id)} style={{ color: 'var(--red)' }}><ITrash size={13} /></button>
                </>
              )}
            </div>
          ))}
          {species.length === 0 && <div style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-4)' }}>No species yet</div>}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px 0' }}>
            <input className="form-input" style={{ flex: 1, fontSize: 13 }} placeholder="Add species…"
              value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
            <button className="btn-secondary" style={{ padding: '0 14px', flexShrink: 0, fontSize: 13 }} onClick={add}>Add</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolsPanel() {
  const [shopTemp,setShopTemp]=useState(65), [shopRH,setShopRH]=useState(50)
  const [saved,setSaved]=useState(()=>{ try{return JSON.parse(localStorage.getItem('shopCond')||'null')}catch{return null} })
  const [bfT,setBfT]=useState(''), [bfW,setBfW]=useState(''), [bfL,setBfL]=useState(''), [bfQ,setBfQ]=useState('1')
  const emc=emcCalc(shopTemp,shopRH), savedEmc=saved?emcCalc(saved.temp,saved.rh):null
  const bf=(()=>{ const t=parseFloat(bfT),w=parseFloat(bfW),l=parseFloat(bfL),q=parseInt(bfQ)||1; return (t&&w&&l)?Math.round(t*w*l/144*q*100)/100:null })()
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,margin:'0 20px 16px'}}>
      <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:16}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>EMC Calculator</div>
        {saved&&<div style={{fontSize:12,color:'var(--text-3)',marginBottom:8,padding:'5px 8px',background:'var(--fill-2)',borderRadius:6}}>Saved shop: {saved.temp}°F / {saved.rh}% → <strong style={{color:'var(--forest)'}}>{savedEmc}%</strong></div>}
        <div style={{display:'flex',gap:8,marginBottom:8}}>
          <div style={{flex:1}}><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Temp (°F)</div><input className="form-input" type="number" value={shopTemp} onChange={e=>setShopTemp(Number(e.target.value))}/></div>
          <div style={{flex:1}}><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>RH (%)</div><input className="form-input" type="number" value={shopRH} onChange={e=>setShopRH(Number(e.target.value))}/></div>
        </div>
        <div style={{fontSize:20,fontWeight:700,color:'var(--accent)',marginBottom:8}}>EMC: {emc}%</div>
        <div style={{fontSize:12,color:'var(--text-3)',marginBottom:8}}>{emc<=8?'✓ Good for furniture/indoor':'⚠ Too wet for indoor use'}</div>
        <button className="btn-secondary" style={{width:'100%',justifyContent:'center'}} onClick={()=>{const v={temp:shopTemp,rh:shopRH};localStorage.setItem('shopCond',JSON.stringify(v));setSaved(v)}}>Save as my shop</button>
      </div>
      <div style={{background:'var(--surface)',borderRadius:'var(--r-md)',border:'1px solid var(--border-2)',padding:16}}>
        <div style={{fontSize:12,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:10}}>Board Foot Calculator</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Thickness (in)</div><input className="form-input" type="number" step="0.25" placeholder="1" value={bfT} onChange={e=>setBfT(e.target.value)}/></div>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Width (in)</div><input className="form-input" type="number" step="0.5" placeholder="6" value={bfW} onChange={e=>setBfW(e.target.value)}/></div>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Length (in)</div><input className="form-input" type="number" step="1" placeholder="96" value={bfL} onChange={e=>setBfL(e.target.value)}/></div>
          <div><div style={{fontSize:11,color:'var(--text-3)',marginBottom:4}}>Qty</div><input className="form-input" type="number" step="1" placeholder="1" value={bfQ} onChange={e=>setBfQ(e.target.value)}/></div>
        </div>
        {bf!==null?<div style={{fontSize:20,fontWeight:700,color:'var(--accent)'}}>{bf} BF</div>:<div style={{fontSize:13,color:'var(--text-4)'}}>Enter dimensions above</div>}
      </div>
    </div>
  )
}

// ── Locations section ─────────────────────────────────────────────────────────
function LocationsSection({ locations, woodStock, mutate }) {
  const toast = useToast()
  const [showAdd, setShowAdd] = useState(false)
  const [editLoc, setEditLoc] = useState(null)
  const [delLoc, setDelLoc]   = useState(null)

  const stockForLoc = id => woodStock.filter(w => w.location_id === id)

  const handleSave = async fields => {
    try {
      if (editLoc) {
        const updated = await db.updateWoodLocation(editLoc.id, fields)
        mutate(d => ({ ...d, woodLocations: d.woodLocations.map(l => l.id === editLoc.id ? updated : l) }))
        toast('Location updated', 'success')
        setEditLoc(null)
      } else {
        const loc = await db.addWoodLocation(fields)
        mutate(d => ({ ...d, woodLocations: [...(d.woodLocations||[]), loc] }))
        toast('Location added', 'success')
        setShowAdd(false)
      }
    } catch(e) { toast(e.message, 'error') }
  }

  const handleDelete = async id => {
    mutate(d => ({ ...d, woodLocations: d.woodLocations.filter(l => l.id !== id) }))
    await db.deleteWoodLocation(id).catch(e => toast(e.message, 'error'))
    setDelLoc(null)
  }

  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 20px',marginBottom:6}}>
        <span style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px'}}>Locations</span>
        <button className="btn-text" onClick={() => setShowAdd(true)}>+ Add location</button>
      </div>
      {locations.length === 0 ? (
        <div style={{padding:'12px 20px',fontSize:13,color:'var(--text-3)'}}>No locations yet — add your first wood source</div>
      ) : (
        <div className="group">
          {locations.map((loc, i) => {
            const stock = stockForLoc(loc.id)
            return (
              <div key={loc.id} style={{padding:'12px 16px',borderBottom: i<locations.length-1?'1px solid var(--border-2)':'none',background:'var(--surface)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:15}}>{loc.name}</div>
                    {loc.address && <div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>📍 {loc.address}</div>}
                    {loc.notes && <div style={{fontSize:13,color:'var(--text-3)',marginTop:2,fontStyle:'italic'}}>{loc.notes}</div>}
                    <div style={{fontSize:12,color:'var(--text-3)',marginTop:3}}>{stock.length} stock entr{stock.length===1?'y':'ies'}{stock.length>0?' · '+[...new Set(stock.map(s=>s.species).filter(Boolean))].slice(0,3).join(', '):''}</div>
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    <button className="icon-btn" onClick={()=>setEditLoc(loc)}><IEdit size={14}/></button>
                    <button className="icon-btn" onClick={()=>setDelLoc(loc)} style={{color:'var(--red)'}}><ITrash size={14}/></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {(showAdd||editLoc) && <LocationSheet loc={editLoc} onSave={handleSave} onClose={()=>{setShowAdd(false);setEditLoc(null)}}/>}
      {delLoc && <ConfirmSheet message={`Delete "${delLoc.name}"? Stock entries won't be deleted.`} onConfirm={()=>handleDelete(delLoc.id)} onClose={()=>setDelLoc(null)}/>}
    </div>
  )
}

function LocationSheet({ loc, onSave, onClose }) {
  const toast = useToast()
  const nameRef = useRef()
  const [searchVal, setSearchVal]   = useState('')
  const [cityState, setCityState]   = useState(loc?.address?.split('·')[0]?.trim() || '')
  const [searching, setSearching]   = useState(false)
  const [results, setResults]       = useState([])
  const [pinLat, setPinLat]         = useState(loc?.lat || null)
  const [pinLng, setPinLng]         = useState(loc?.lng || null)
  const [pinLabel, setPinLabel]     = useState(loc?.address || '')
  const [notes, setNotes]           = useState(loc?.notes || '')
  const mapRef     = useRef()
  const mapInst    = useRef()
  const markerInst = useRef()

  // Load Leaflet once
  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'; link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const init = () => {
      if (!mapRef.current || mapInst.current) return
      const L = window.L
      if (!L) { setTimeout(init, 150); return }
      const center = (pinLat && pinLng) ? [pinLat, pinLng] : [43.5, -71.5]
      const zoom   = (pinLat && pinLng) ? 13 : 7
      const map = L.map(mapRef.current, { zoomControl: true }).setView(center, zoom)
      mapInst.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19
      }).addTo(map)
      if (pinLat && pinLng) {
        markerInst.current = L.marker([pinLat, pinLng]).addTo(map)
      }
      map.on('click', e => {
        const { lat, lng } = e.latlng
        setPinLat(lat); setPinLng(lng)
        setPinLabel(lat.toFixed(5) + ', ' + lng.toFixed(5))
        if (markerInst.current) map.removeLayer(markerInst.current)
        markerInst.current = L.marker([lat, lng]).addTo(map)
      })
    }
    if (!window.L) {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      s.onload = init
      document.head.appendChild(s)
    } else { setTimeout(init, 50) }
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [])

  const search = async () => {
    const q = searchVal.trim(); if (!q) return
    setSearching(true); setResults([])
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=5&countrycodes=us', {
        headers: { 'Accept-Language': 'en-US', 'User-Agent': 'JDHWoodworks/1.0' }
      })
      const data = await r.json()
      setResults(data)
    } catch(e) { toast('Search failed', 'error') }
    setSearching(false)
  }

  const pickResult = r => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon)
    const L = window.L
    if (L && mapInst.current) {
      mapInst.current.setView([lat, lng], 13)
      if (markerInst.current) mapInst.current.removeLayer(markerInst.current)
      markerInst.current = L.marker([lat, lng]).addTo(mapInst.current)
    }
    setPinLat(lat); setPinLng(lng)
    setPinLabel(r.display_name.split(',').slice(0,2).join(',').trim())
    setResults([])
  }

  const handleSave = async () => {
    const name = nameRef.current?.value.trim()
    if (!name) return
    if (!pinLat || !pinLng) { toast('Click on the map to place a pin first', 'error'); return }
    await onSave({ name, address: cityState.trim() || pinLabel, lat: pinLat, lng: pinLng, notes: notes.trim() })
  }

  return (
    <Sheet title={loc ? 'Edit Location' : 'Add Location'} onClose={onClose} onSave={handleSave}>
      <div className="form-group" style={{marginBottom:12}}>
        <FormCell label="Name">
          <input ref={nameRef} className="form-input" placeholder="Sherborn Back Lot" defaultValue={loc?.name||''} autoFocus/>
        </FormCell>
        <FormCell label="Notes">
          <input className="form-input" placeholder="e.g. Contacted Mike, back 40 near stream, ask in spring" value={notes} onChange={e=>setNotes(e.target.value)}/>
        </FormCell>
        <FormCell label="Street, city, state" last>
          <input
            className="form-input"
            placeholder="123 Mill St, Sherborn, MA"
            value={cityState}
            onChange={e=>setCityState(e.target.value)}
            onBlur={async()=>{
              const q=cityState.trim(); if(!q||!mapInst.current) return
              try {
                const r=await fetch('https://nominatim.openstreetmap.org/search?format=json&q='+encodeURIComponent(q)+'&limit=1&countrycodes=us',{headers:{'Accept-Language':'en-US','User-Agent':'JDHWoodworks/1.0'}})
                const d=await r.json()
                if(d.length) mapInst.current.setView([parseFloat(d[0].lat),parseFloat(d[0].lon)],12)
              } catch(e){}
            }}
          />
        </FormCell>
      </div>

      {/* Search bar */}
      <div style={{padding:'0 16px 8px'}}>
        <div style={{display:'flex',gap:8,marginBottom:6}}>
          <input
            className="form-input" style={{flex:1}}
            placeholder="Search: Sherborn, MA…"
            value={searchVal}
            onChange={e=>setSearchVal(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&search()}
          />
          <button className="btn-secondary" style={{padding:'0 14px',flexShrink:0}} onClick={search} disabled={searching}>
            {searching?'…':'Search'}
          </button>
        </div>
        {results.length>0&&(
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,marginBottom:6,maxHeight:120,overflowY:'auto'}}>
            {results.map((r,i)=>(
              <div key={i} onClick={()=>pickResult(r)} style={{padding:'8px 12px',fontSize:13,cursor:'pointer',borderBottom:i<results.length-1?'1px solid var(--border-2)':'none',color:'var(--text-2)'}}>
                {r.display_name.split(',').slice(0,3).join(', ')}
              </div>
            ))}
          </div>
        )}
        <div style={{fontSize:12,color:'var(--text-3)',marginBottom:6}}>Then click anywhere on the map to place your pin</div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{height:260,margin:'0 16px 12px',borderRadius:8,overflow:'hidden',border:'1px solid var(--border-2)'}}/>

      {/* Pin confirmation */}
      {pinLat&&pinLng&&(
        <div style={{margin:'0 16px 8px',padding:'8px 12px',background:'var(--green-dim)',borderRadius:8,fontSize:13,color:'var(--forest)',fontWeight:500}}>
          ✓ Pin set · {pinLabel || `${pinLat.toFixed(4)}, ${pinLng.toFixed(4)}`}
        </div>
      )}
    </Sheet>
  )
}

// ── Main Stock page ───────────────────────────────────────────────────────────
export default function Stock() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]       = useState(false)
  const [editItem, setEditItem]     = useState(null)
  const [detail,         setDetail]        = useState(null)
  const [stockPhotoItem, setStockPhotoItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [showTools, setShowTools]   = useState(false)
  const [logCache, setLogCache]     = useState({})

  const locations = data.woodLocations || []

  useEffect(() => {
    data.woodStock.forEach(item => {
      if (logCache[item.id] === undefined) {
        db.loadMoistureLog(item.id).then(rows => setLogCache(prev=>({...prev,[item.id]:rows}))).catch(()=>{})
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
      toast('Saved','success'); setEditItem(null)
    } else {
      try {
        const item = await db.addWoodStock(fields)
        mutate(d=>({...d,woodStock:[...d.woodStock,item]}))
        toast('Added','success'); setShowAdd(false)
      } catch(e) { toast(e.message,'error') }
    }
  }

  const calReminder = item => {
    if (!item.harvested_at) { toast('Set a harvest date first','error'); return }
    const d = new Date(new Date(item.harvested_at).getTime()+180*86_400_000)
    addToGoogleCalendar({ title:`Check ${item.species} — ready?`, start:d, end:new Date(d.getTime()+3_600_000), description:`${item.species} harvested ${fmt(item.harvested_at)}.` })
  }
  const appleReminder = item => {
    if (!item.harvested_at) { toast('Set a harvest date first','error'); return }
    const d = new Date(new Date(item.harvested_at).getTime()+180*86_400_000)
    addToAppleReminders({ title:`Check ${item.species} — ready?`, notes:`Harvested ${fmt(item.harvested_at)}.`, dueDate:d })
  }

  const byStatus = STATUS_ORDER.reduce((acc,s)=>{
    const items=data.woodStock.filter(w=>(w.status||'Drying')===s)
    if(items.length) acc.push({status:s,items}); return acc
  },[])

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',position:'relative'}}>
      <div className="scroll-page" style={{paddingBottom:80}}>
        <div className="page-header">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h1 className="page-title">Wood Stock</h1>
            <button className={showTools?'btn-primary':'btn-secondary'} style={{padding:'5px 12px',fontSize:13}} onClick={()=>setShowTools(s=>!s)}>
              {showTools?'Hide tools':'Tools'}
            </button>
          </div>
        </div>

        {showTools && <ToolsPanel/>}

        {/* Locations section */}
        <LocationsSection locations={locations} woodStock={data.woodStock} mutate={mutate}/>

        <SpeciesManager />

        {/* Stock section */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px 6px',marginTop:8}}>
          <span style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px'}}>Stock</span>
        </div>

        <div style={{paddingBottom:24}}>
          {byStatus.map(({status,items})=>{
            const ss=STOCK_STATUS[status]||{bg:'#F9FAFB',color:'#6B7280'}
            return (
              <div key={status}>
                <span className="section-label">{status}</span>
                <div className="group">
                  {items.map((item,i,arr)=>{
                    const logs=logCache[item.id]||[]
                    const latest=logs.length?logs.sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at))[0]?.reading:null
                    const ms=moistureStatus(latest,item.intended_use)
                    const readyDate=getReadyDate(item.harvested_at,item.species,item.thickness_in||1)
                    const isReady=readyDate&&new Date()>=readyDate
                    const loc=locations.find(l=>l.id===item.location_id)
                    return (
                      <div key={item.id} style={{borderBottom:i<arr.length-1?'1px solid var(--border-2)':'none',padding:'12px 16px',background:'var(--surface)'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                          <div style={{flex:1,paddingRight:12}}>
                            <div style={{fontWeight:600}}>{item.species}</div>
                            {loc&&<div style={{fontSize:13,color:'var(--accent)',marginTop:2}}>📍 {loc.name}</div>}
                            {!loc&&item.location&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>📍 {item.location}</div>}
                            {item.harvested_at&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>Harvested: {fmt(item.harvested_at)}</div>}
                            {item.intended_use&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>Use: {item.intended_use}</div>}
                            {ms&&<div style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,padding:'3px 10px',borderRadius:99,background:ms.bg}}>
                              <div style={{width:7,height:7,borderRadius:'50%',background:ms.color}}/><span style={{fontSize:12,fontWeight:600,color:ms.color}}>{ms.label}</span>
                              {latest&&<span style={{fontSize:12,color:ms.color,opacity:.8}}>· {latest}%</span>}
                            </div>}
                            {readyDate&&status!=='Ready to use'&&status!=='Used up'&&(
                              <div style={{fontSize:12,color:isReady?'var(--forest)':'var(--text-3)',marginTop:4}}>{isReady?'✓ Est. ready since':'Est. ready:'} {readyDate.toLocaleDateString('en-US',{month:'short',year:'numeric'})}</div>
                            )}
                            {item.notes&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:4}}>{item.notes}</div>}
                            <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                              <button className="btn-secondary" onClick={()=>setDetail(item)}>Moisture log</button>
                              <button className="btn-secondary" onClick={()=>setStockPhotoItem(item)} style={{display:'flex',alignItems:'center',gap:5}}>
                                <ICamera size={12} color="currentColor"/> Photos
                              </button>
                              {(status==='Freshly cut'||status==='Drying')&&<>
                                <button className="btn-cal" onClick={()=>calReminder(item)}><ICal size={13} color="currentColor"/> Google Cal</button>
                                <button className="btn-reminder" onClick={()=>appleReminder(item)}><IBell size={13} color="currentColor"/> Reminders</button>
                              </>}
                            </div>
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                            <span className="badge-pill" style={{background:ss.bg,color:ss.color,fontSize:11}}>{status}</span>
                            <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                              <button className="icon-btn" onClick={()=>setEditItem(item)}><IEdit size={14}/></button>
                              <button className="icon-btn" onClick={()=>setDeleteItem(item)} style={{color:'var(--red)'}}><ITrash size={14}/></button>
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
            <div className="empty"><div className="empty-icon">🌲</div><div className="empty-title">No stock entries</div><p className="empty-sub">Add a location above, then add stock entries</p></div>
          )}
        </div>
      </div>
      <button className="fab" onClick={()=>setShowAdd(true)} aria-label="Add stock"><IPlus size={22} color="#fff" sw={2.5}/></button>
      {showAdd    &&<StockSheet locations={locations} onSave={f=>handleSave(null,f)} onClose={()=>setShowAdd(false)}/>}
      {editItem   &&<StockSheet locations={locations} item={editItem} onSave={f=>handleSave(editItem.id,f)} onClose={()=>setEditItem(null)}/>}
      {deleteItem &&<ConfirmSheet message={`Delete "${deleteItem.species}"?`} onConfirm={()=>del(deleteItem.id)} onClose={()=>setDeleteItem(null)}/>}
      {detail     &&<MoistureLog item={detail} onClose={()=>setDetail(null)} onAdded={rows=>setLogCache(prev=>({...prev,[detail.id]:rows}))}/>}
      {stockPhotoItem&&<StockPhotoSheet item={stockPhotoItem} onClose={()=>setStockPhotoItem(null)}/>}
    </div>
  )
}


// ── Wood stock photo sheet ────────────────────────────────────────────────────
function StockPhotoSheet({ item, onClose }) {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)

  // Photos tagged with this stock item
  const photos = (data.photos || []).filter(p => p.caption?.startsWith(`stock:${item.id}`))

  const handleUpload = async files => {
    for (const file of Array.from(files)) {
      setUploading(true)
      try {
        const photo = await db.uploadPhoto(null, file, `stock:${item.id}`, 'wood_stock', 'wood_stock')
        mutate(d => ({ ...d, photos: [photo, ...d.photos] }))
        toast('Photo added', 'success')
      } catch(e) { toast(e.message, 'error') }
      setUploading(false)
    }
  }

  const deletePhoto = async photo => {
    mutate(d => ({ ...d, photos: d.photos.filter(p => p.id !== photo.id) }))
    await db.deletePhoto(photo).catch(e => toast(e.message, 'error'))
  }

  return (
    <Sheet title={`Photos — ${item.species}`} onClose={onClose}>
      <div style={{padding:'0 16px 16px'}}>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>handleUpload(e.target.files)}/>
        <button className="btn-primary" style={{width:'100%',justifyContent:'center',marginBottom:16}} onClick={()=>fileRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading…' : '+ Add Photo'}
        </button>
        {photos.length === 0
          ? <div style={{textAlign:'center',color:'var(--text-4)',fontSize:13,padding:'32px 0'}}>No photos yet — add some to document this stock</div>
          : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {photos.map(p => (
                <div key={p.id} style={{position:'relative',borderRadius:8,overflow:'hidden',aspectRatio:'1',background:'var(--fill)'}}>
                  <img src={p.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <button onClick={()=>deletePhoto(p)} style={{
                    position:'absolute',top:4,right:4,background:'rgba(0,0,0,.6)',border:'none',
                    borderRadius:'50%',width:24,height:24,cursor:'pointer',color:'#fff',fontSize:14,
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>×</button>
                </div>
              ))}
            </div>
        }
      </div>
    </Sheet>
  )
}

function StockSheet({ item, locations, onSave, onClose }) {
  const refs = { species:useRef(), harvested:useRef(), use:useRef(), status:useRef(), notes:useRef(), thickness:useRef() }
  const [locationId, setLocationId] = useState(item?.location_id||'')

  const handleSave = async () => {
    const species = refs.species.current?.value.trim()
    if (!species) return
    await onSave({
      species,
      location_id:  locationId||null,
      location:     locations.find(l=>l.id===locationId)?.name||'',
      harvested_at: refs.harvested.current?.value||null,
      intended_use: refs.use.current?.value.trim()||'',
      status:       refs.status.current?.value||'Drying',
      notes:        refs.notes.current?.value.trim()||'',
      thickness_in: parseFloat(refs.thickness.current?.value)||1,
    })
  }

  return (
    <Sheet title={item?'Edit Stock':'Add Stock Entry'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Species"><input ref={refs.species} className="form-input" placeholder="White Oak" defaultValue={item?.species||''} autoFocus/></FormCell>
        <FormCell label="Location">
          <select className="form-select" value={locationId} onChange={e=>setLocationId(e.target.value)}>
            <option value="">No location</option>
            {locations.map(l=><option key={l.id} value={l.id}>{l.name}{l.address?' — '+l.address:''}</option>)}
          </select>
        </FormCell>
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
  const [log,setLog]=useState([]), [loading,setLoading]=useState(true), [showAdd,setShowAdd]=useState(false)
  const readingRef=useRef(), notesRef=useRef()
  useEffect(()=>{ db.loadMoistureLog(item.id).then(rows=>{setLog(rows);setLoading(false)}).catch(()=>setLoading(false)) },[item.id])
  const addReading = async () => {
    const reading=parseFloat(readingRef.current?.value); if(isNaN(reading)) return
    try {
      const row=await db.addMoistureReading(item.id,reading,notesRef.current?.value.trim()||'')
      const newLog=[...log,row]; setLog(newLog); onAdded&&onAdded(newLog)
      toast('Reading saved','success'); setShowAdd(false)
    } catch(e) { toast(e.message,'error') }
  }
  return (
    <Sheet title={`${item.species} — Moisture Log`} onClose={onClose} onSave={null}>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
        <button className="btn-secondary" onClick={()=>setShowAdd(s=>!s)}>+ Add reading</button>
      </div>
      {showAdd&&<div className="form-group" style={{marginBottom:16}}>
        <FormCell label="Reading (%)"><input ref={readingRef} className="form-input" type="number" step="0.1" placeholder="8.5" autoFocus/></FormCell>
        <FormCell label="Notes" last><input ref={notesRef} className="form-input" placeholder="Optional"/></FormCell>
        <div style={{padding:'10px 16px'}}><button className="btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={addReading}>Save</button></div>
      </div>}
      {loading?<div style={{textAlign:'center',padding:32}}><div className="spinner" style={{margin:'0 auto'}}/></div>
        :log.length===0?<div className="empty" style={{padding:'32px 0'}}><div className="empty-icon">💧</div><div className="empty-title">No readings yet</div></div>
        :<div className="group">{log.sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).map((r,i)=>(
          <div key={r.id} className="cell" style={{borderBottom:i<log.length-1?'1px solid var(--border-2)':'none'}}>
            <div style={{flex:1}}><div style={{fontWeight:600,fontSize:16}}>{r.reading}%</div>{r.notes&&<div style={{fontSize:13,color:'var(--text-3)',marginTop:2}}>{r.notes}</div>}</div>
            <div style={{fontSize:13,color:'var(--text-3)'}}>{fmt(r.logged_at)}</div>
          </div>
        ))}</div>}
    </Sheet>
  )
}
