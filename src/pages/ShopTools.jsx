import { useState, useRef, useEffect } from 'react'
import { useCtx } from '../App.jsx'
import { useToast } from '../components/Toast.jsx'
import * as db from '../db.js'
import { Sheet, FormCell, ConfirmSheet, IPlus, ITrash, IEdit, ICircle, ICheck, IWrench } from '../components/Shared.jsx'

// ─── Tool categories (woodworking-focused) ────────────────────────────────────
const TOOL_CATS = [
  'Bench Planes',
  'Block Planes',
  'Chisels',
  'Gouges & Carving',
  'Saws — Hand',
  'Saws — Power',
  'Routers & Bits',
  'Lathe & Turning',
  'Drills & Drivers',
  'Sanders',
  'Clamps & Vises',
  'Measuring & Layout',
  'Sharpening',
  'Finishing',
  'Other Power Tools',
  'Other Hand Tools',
]

// ─── Tool spec fields by category ────────────────────────────────────────────
const SPEC_FIELDS = {
  'Bench Planes':       ['Blade Width','Blade Steel','Chipbreaker','Frog Angle','Sole Flatness'],
  'Block Planes':       ['Blade Width','Blade Angle','Blade Steel'],
  'Chisels':            ['Width','Steel Type','Handle Material','Bevel Angle'],
  'Gouges & Carving':   ['Sweep','Width','Steel Type','Handle Material'],
  'Saws — Hand':        ['TPI','Tooth Geometry','Blade Length','Kerf'],
  'Saws — Power':       ['Blade Diameter','Arbor Size','TPI / Tooth Count','Kerf','Max Depth of Cut','Bevel Capacity'],
  'Routers & Bits':     ['Collet Size','Max Bit Diameter','Shank Size','Profile','Cutting Length'],
  'Lathe & Turning':    ['Swing','Bed Length','Speed Range','Spindle Thread','Tool Rest Width'],
  'Drills & Drivers':   ['Chuck Size','Voltage / Power','Speed Range','Torque Settings'],
  'Sanders':            ['Pad / Belt Size','Orbit Diameter','Speed'],
  'Clamps & Vises':     ['Jaw Opening','Jaw Depth','Material'],
  'Measuring & Layout': ['Range / Length','Graduation','Accuracy'],
  'Sharpening':         ['Grit / Micron','Type','Lubrication','Size'],
  'Finishing':          ['Type','Coverage','Dry Time','Sheen'],
  'Other Power Tools':  ['Power','Speed','Capacity'],
  'Other Hand Tools':   ['Size','Material'],
}

// ─── localStorage tools store ─────────────────────────────────────────────────
const TOOLS_KEY = 'shop-tools-v1'
function loadTools() { try { return JSON.parse(localStorage.getItem(TOOLS_KEY)) || [] } catch { return [] } }
function saveTools(t) { try { localStorage.setItem(TOOLS_KEY, JSON.stringify(t)) } catch {} }

// ─── Shop Improvements tab (unchanged logic) ──────────────────────────────────
const IMP_CATS = ['Wish List', 'Planned Upgrade', 'Layout Idea', 'Tool Acquisition', 'Safety', 'Other']
const autoExpand = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }

function ShopIdeas() {
  const { data, mutate } = useCtx()
  const toast = useToast()
  const [showAdd, setShowAdd]   = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [delItem, setDelItem]   = useState(null)
  const [filter, setFilter]     = useState('active')

  const toggle = async item => {
    const completed = !item.completed
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.map(s => s.id === item.id ? { ...s, completed } : s) }))
    await db.updateShopImprovement(item.id, { completed }).catch(e => toast(e.message, 'error'))
  }

  const del = async id => {
    const item = data.shopImprovements.find(s => s.id === id)
    const prev = data.shopImprovements
    mutate(d => ({ ...d, shopImprovements: d.shopImprovements.filter(s => s.id !== id) }))
    try {
      const trashed = await db.deleteShopImprovement(id)
      if (trashed) {
        mutate(d => ({ ...d, trash: [trashed, ...(d.trash || [])] }))
        toast(`"${item?.title}" deleted`, 'success', 4000, {
          label: 'Undo', onClick: async () => {
            await db.restoreFromTrash(trashed.id, trashed)
            mutate(d => ({ ...d, shopImprovements: [item, ...d.shopImprovements], trash: d.trash.filter(t => t.id !== trashed.id) }))
          }
        })
      }
    } catch(e) { mutate(d => ({ ...d, shopImprovements: prev })); toast(e.message, 'error') }
    setDelItem(null)
  }

  const save = async (id, fields) => {
    if (id) {
      mutate(d => ({ ...d, shopImprovements: d.shopImprovements.map(s => s.id === id ? { ...s, ...fields } : s) }))
      await db.updateShopImprovement(id, fields).catch(e => toast(e.message, 'error'))
      toast('Saved', 'success'); setEditItem(null)
    } else {
      const item = await db.addShopImprovement(fields).catch(e => { toast(e.message, 'error'); return null })
      if (item) { mutate(d => ({ ...d, shopImprovements: [...d.shopImprovements, item] })); toast('Added', 'success'); setShowAdd(false) }
    }
  }

  const active = data.shopImprovements.filter(s => !s.completed)
  const done   = data.shopImprovements.filter(s =>  s.completed)
  const items  = filter === 'active' ? active : done
  const byCat  = IMP_CATS.reduce((acc, c) => {
    const ci = items.filter(s => s.category === c)
    if (ci.length) acc.push({ cat: c, items: ci })
    return acc
  }, [])

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <div className="page-header-row">
            <h1 className="page-title">Shop Ideas</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={filter==='active'?'btn-primary':'btn-secondary'} style={{ padding:'5px 14px',fontSize:13 }} onClick={() => setFilter('active')}>Active ({active.length})</button>
              <button className={filter==='done'  ?'btn-primary':'btn-secondary'} style={{ padding:'5px 14px',fontSize:13 }} onClick={() => setFilter('done')}>Done ({done.length})</button>
            </div>
          </div>
        </div>
        {byCat.map(({ cat, items: ci }) => (
          <div key={cat}>
            <span className="section-label">{cat}</span>
            <div className="group">
              {ci.map((item, i, arr) => (
                <div key={item.id} className="cell" style={{ borderBottom: i < arr.length-1 ? '1px solid var(--c-border-light)' : 'none', alignItems:'flex-start', paddingTop:12, paddingBottom:12 }}>
                  <button className="check-btn" style={{ marginTop:2 }} onClick={() => toggle(item)}>
                    {item.completed ? <ICheck size={22} color="var(--green)" sw={2} /> : <ICircle size={22} color="var(--c-text-faint)" sw={1.5} />}
                  </button>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:500, textDecoration: item.completed?'line-through':'none', color: item.completed?'var(--c-text-muted)':'var(--c-text-primary)' }}>{item.title}</div>
                    {item.notes && <div style={{ fontSize:13, color:'var(--c-text-muted)', marginTop:4, lineHeight:1.5 }}>{item.notes}</div>}
                  </div>
                  <div style={{ display:'flex', gap:4, marginLeft:8 }}>
                    <button className="icon-btn" onClick={() => setEditItem(item)}><IEdit size={15} /></button>
                    <button className="icon-btn" onClick={() => setDelItem(item)}><ITrash size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="empty">
            <div className="empty-icon"><IWrench size={32} color="var(--c-text-muted)" sw={1.5} /></div>
            <div className="empty-title">{filter==='active' ? 'Nothing planned yet' : 'Nothing completed yet'}</div>
            <p className="empty-sub">Track planned upgrades, wish list items, and layout ideas</p>
          </div>
        )}
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}><IPlus size={22} color="#fff" sw={2.5} /></button>
      {showAdd   && <IdeaSheet onSave={f => save(null, f)} onClose={() => setShowAdd(false)} />}
      {editItem  && <IdeaSheet item={editItem} onSave={f => save(editItem.id, f)} onClose={() => setEditItem(null)} />}
      {delItem   && <ConfirmSheet message={`Delete "${delItem.title}"?`} onConfirm={() => del(delItem.id)} onClose={() => setDelItem(null)} />}
    </div>
  )
}

function IdeaSheet({ item, onSave, onClose }) {
  const refs = { title: useRef(), cat: useRef() }
  const notesRef = useRef()
  return (
    <Sheet title={item ? 'Edit Idea' : 'Add Idea'} onClose={onClose} onSave={async () => {
      const title = refs.title.current?.value.trim()
      if (!title) return
      await onSave({ title, category: refs.cat.current?.value || 'Wish List', notes: notesRef.current?.value.trim() || '' })
    }}>
      <div className="form-group">
        <FormCell label="Item"><input ref={refs.title} className="form-input" placeholder="Dust collector upgrade" defaultValue={item?.title||''} autoFocus /></FormCell>
        <FormCell label="Category" last>
          <select ref={refs.cat} className="form-select" defaultValue={item?.category||'Wish List'}>
            {IMP_CATS.map(c => <option key={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>
      <p style={{ fontSize:13, color:'var(--c-text-muted)', marginBottom:8 }}>Notes</p>
      <textarea ref={notesRef} className="form-textarea" style={{ width:'100%' }} placeholder="Details, cost estimate…" defaultValue={item?.notes||''} onChange={autoExpand} />
    </Sheet>
  )
}

// ─── Tools Inventory tab ──────────────────────────────────────────────────────
function ToolsInventory() {
  const toast = useToast()
  const [tools, setTools]       = useState(loadTools)
  const [showAdd, setShowAdd]   = useState(false)
  const [editTool, setEditTool] = useState(null)
  const [delTool, setDelTool]   = useState(null)
  const [catFilter, setCatFilter] = useState('all')

  const persist = (next) => { setTools(next); saveTools(next) }

  const save = (fields) => {
    if (editTool) {
      persist(tools.map(t => t.id === editTool.id ? { ...t, ...fields } : t))
      toast('Saved', 'success'); setEditTool(null)
    } else {
      persist([...tools, { id: Date.now().toString(36), created_at: new Date().toISOString(), ...fields }])
      toast('Added', 'success'); setShowAdd(false)
    }
  }

  const del = (id) => {
    persist(tools.filter(t => t.id !== id))
    toast('Deleted', 'success'); setDelTool(null)
  }

  const filtered = catFilter === 'all' ? tools : tools.filter(t => t.category === catFilter)
  const usedCats = [...new Set(tools.map(t => t.category))].sort()
  const byCat = TOOL_CATS.reduce((acc, c) => {
    const ci = filtered.filter(t => t.category === c)
    if (ci.length) acc.push({ cat: c, items: ci })
    return acc
  }, [])

  return (
    <div style={{ position:'relative', height:'100%', display:'flex', flexDirection:'column' }}>
      <div className="scroll-page" style={{ paddingBottom: 80 }}>
        <div className="page-header">
          <div className="page-header-row">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <h1 className="page-title">Tools</h1>
              <span style={{ fontSize:13, color:'var(--c-text-muted)' }}>{tools.length}</span>
            </div>
            {usedCats.length > 1 && (
              <div className="filter-select-wrap">
                <select className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                  <option value="all">All Categories</option>
                  {usedCats.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="filter-select-chevron">▾</span>
              </div>
            )}
          </div>
        </div>

        {byCat.map(({ cat, items }) => (
          <div key={cat}>
            <span className="section-label">{cat}</span>
            <div className="group">
              {items.map((tool, i, arr) => (
                <div key={tool.id} style={{ borderBottom: i < arr.length-1 ? '1px solid var(--c-border-light)' : 'none', padding:'12px 16px', background:'var(--c-bg-surface)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1, paddingRight:12 }}>
                      <div style={{ fontWeight:600, fontSize:15 }}>{tool.name}</div>
                      {tool.brand && <div style={{ fontSize:12, color:'var(--c-text-muted)', marginTop:1 }}>{tool.brand}{tool.model ? ` · ${tool.model}` : ''}</div>}
                      {tool.notes && <div style={{ fontSize:13, color:'var(--c-text-muted)', marginTop:4, lineHeight:1.5 }}>{tool.notes}</div>}
                      {/* Spec fields */}
                      {tool.specs && Object.entries(tool.specs).filter(([,v]) => v).length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginTop:8 }}>
                          {Object.entries(tool.specs).filter(([,v]) => v).map(([k,v]) => (
                            <div key={k} style={{ fontSize:12 }}>
                              <span style={{ color:'var(--c-text-faint)', textTransform:'uppercase', letterSpacing:'.4px', fontSize:10 }}>{k} </span>
                              <span style={{ color:'var(--c-text-primary)', fontWeight:600 }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      <button className="icon-btn" onClick={() => setEditTool(tool)}><IEdit size={14} /></button>
                      <button className="icon-btn" onClick={() => setDelTool(tool)}><ITrash size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!tools.length && (
          <div className="empty">
            <div className="empty-icon"><IWrench size={32} color="var(--c-text-muted)" sw={1.5} /></div>
            <div className="empty-title">No tools logged yet</div>
            <p className="empty-sub">Add your tools with specs like blade size, TPI, collet size, and more</p>
          </div>
        )}
      </div>
      <button className="fab" onClick={() => setShowAdd(true)}><IPlus size={22} color="#fff" sw={2.5} /></button>
      {showAdd  && <ToolSheet onSave={save} onClose={() => setShowAdd(false)} />}
      {editTool && <ToolSheet tool={editTool} onSave={save} onClose={() => setEditTool(null)} />}
      {delTool  && <ConfirmSheet message={`Delete "${delTool.name}"?`} onConfirm={() => del(delTool.id)} onClose={() => setDelTool(null)} />}
    </div>
  )
}

function ToolSheet({ tool, onSave, onClose }) {
  const nameRef  = useRef()
  const brandRef = useRef()
  const modelRef = useRef()
  const notesRef = useRef()
  const catRef   = useRef()
  const [cat, setCat] = useState(tool?.category || TOOL_CATS[0])
  const specFields = SPEC_FIELDS[cat] || []
  const specRefs = useRef({})

  const handleSave = () => {
    const name = nameRef.current?.value.trim()
    if (!name) return
    const specs = {}
    specFields.forEach(f => {
      const v = specRefs.current[f]?.value?.trim()
      if (v) specs[f] = v
    })
    onSave({
      name,
      brand:    brandRef.current?.value.trim() || '',
      model:    modelRef.current?.value.trim() || '',
      notes:    notesRef.current?.value.trim() || '',
      category: cat,
      specs,
    })
  }

  return (
    <Sheet title={tool ? 'Edit Tool' : 'Add Tool'} onClose={onClose} onSave={handleSave}>
      <div className="form-group">
        <FormCell label="Tool Name">
          <input ref={nameRef} className="form-input" placeholder="No. 4 Smoothing Plane" defaultValue={tool?.name||''} autoFocus />
        </FormCell>
        <FormCell label="Brand">
          <input ref={brandRef} className="form-input" placeholder="Veritas, Lie-Nielsen, DeWalt…" defaultValue={tool?.brand||''} />
        </FormCell>
        <FormCell label="Model">
          <input ref={modelRef} className="form-input" placeholder="Model number or name" defaultValue={tool?.model||''} />
        </FormCell>
        <FormCell label="Category" last>
          <select ref={catRef} className="form-select" value={cat} onChange={e => setCat(e.target.value)}>
            {TOOL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormCell>
      </div>

      {specFields.length > 0 && (
        <>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--c-text-faint)', textTransform:'uppercase', letterSpacing:'.5px', margin:'16px 0 8px' }}>
            Specs — {cat}
          </p>
          <div className="form-group">
            {specFields.map((field, i) => (
              <FormCell key={field} label={field} last={i === specFields.length - 1}>
                <input
                  ref={el => specRefs.current[field] = el}
                  className="form-input"
                  placeholder={getSpecPlaceholder(cat, field)}
                  defaultValue={tool?.specs?.[field] || ''}
                />
              </FormCell>
            ))}
          </div>
        </>
      )}

      <p style={{ fontSize:13, color:'var(--c-text-muted)', margin:'16px 0 8px' }}>Notes</p>
      <textarea ref={notesRef} className="form-textarea" style={{ width:'100%' }}
        placeholder="Sharpening notes, quirks, purchase info…"
        defaultValue={tool?.notes||''} onChange={autoExpand} />
    </Sheet>
  )
}

function getSpecPlaceholder(cat, field) {
  const map = {
    'Blade Width': '1-3/4"', 'TPI': '8 tpi', 'Blade Diameter': '10"',
    'Collet Size': '1/2"', 'Swing': '16"', 'Bed Length': '42"',
    'Grit / Micron': '1000 / 6000', 'Chuck Size': '1/2"',
    'Bevel Angle': '25°', 'Blade Angle': '12°', 'Kerf': '0.125"',
    'Orbit Diameter': '3/16"', 'Jaw Opening': '24"',
  }
  return map[field] || ''
}

// ─── Combined page ────────────────────────────────────────────────────────────
export default function ShopTools() {
  const [tab, setTab] = useState('ideas')

  const TabBtn = ({ id, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '7px 18px', fontSize: 13, fontWeight: 700,
        fontFamily: 'inherit', borderRadius: 0, cursor: 'pointer',
        background: tab === id ? 'var(--navy)' : 'var(--c-bg-subtle)',
        color:      tab === id ? 'var(--white)' : 'var(--c-text-muted)',
        border: '1.5px solid var(--c-border)',
        borderRight: 'none',
        transition: 'background 120ms, color 120ms',
      }}
    >{label}</button>
  )

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'10px 16px 0', borderBottom:'1px solid var(--c-border)', flexShrink:0, display:'flex', alignItems:'center', gap:0 }}>
        <div style={{ display:'flex' }}>
          <TabBtn id="ideas" label="Shop Ideas" />
          <TabBtn id="tools" label="Tools Inventory" />
          <div style={{ width:1, background:'var(--c-border)', alignSelf:'stretch' }} />
        </div>
      </div>
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {tab === 'ideas' && <ShopIdeas />}
        {tab === 'tools' && <ToolsInventory />}
      </div>
    </div>
  )
}
