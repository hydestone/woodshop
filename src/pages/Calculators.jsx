import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import ConstructionCalc from './ConstructionCalc.jsx'
import * as db from '../db.js'

// ─── Math utilities ────────────────────────────────────────────────────────────
function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a) }
function fracReduce(n, d) {
  if (d === 0) return { n: 0, d: 1 }
  const g = gcd(Math.abs(n), Math.abs(d))
  return { n: (d < 0 ? -1 : 1) * n / g, d: Math.abs(d) / g }
}
function fracAdd(a, b) { return fracReduce(a.n * b.d + b.n * a.d, a.d * b.d) }
function fracSub(a, b) { return fracReduce(a.n * b.d - b.n * a.d, a.d * b.d) }
function fracMul(a, b) { return fracReduce(a.n * b.n, a.d * b.d) }
function fracDiv(a, b) { return fracReduce(a.n * b.d, a.d * b.n) }
function fracToDecimal({ n, d }) { return d === 0 ? 0 : n / d }

function parseFracObj(s) {
  s = (s || '').trim()
  const m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) { const sign = +m[1] < 0 ? -1 : 1; return fracReduce(+m[1] * +m[3] + sign * +m[2], +m[3]) }
  const f = s.match(/^(-?\d+)\/(\d+)$/)
  if (f) return fracReduce(+f[1], +f[2])
  const dv = parseFloat(s)
  if (!isNaN(dv)) return fracReduce(Math.round(dv * 64), 64)
  return null
}

function fracToHTML({ n, d }, style = {}) {
  if (d === 1) return <span style={style}>{n}</span>
  const w = Math.trunc(n / d), r = Math.abs(n % d)
  const fontSize = style.fontSize || 22
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, ...style }}>
      {w !== 0 && <span style={{ fontSize }}>{w}</span>}
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: fontSize * 0.6, lineHeight: 1 }}>
        <span style={{ borderBottom: '1.5px solid currentColor', paddingBottom: 1 }}>{Math.abs(r)}</span>
        <span style={{ paddingTop: 1 }}>{d}</span>
      </span>
    </span>
  )
}

function inchToFrac(dec, den = 16) {
  const w = Math.floor(dec), f = dec - w
  const n = Math.round(f * den)
  if (n === 0) return { w, n: 0, d: den }
  if (n === den) return { w: w + 1, n: 0, d: den }
  const g = gcd(n, den)
  return { w, n: n / g, d: den / g }
}

function decToFracStr(dec, den = 16) {
  const { w, n, d } = inchToFrac(Math.abs(dec), den)
  const sign = dec < 0 ? '-' : ''
  if (n === 0) return `${sign}${w}"`
  if (w === 0) return `${sign}${n}/${d}"`
  return `${sign}${w} ${n}/${d}"`
}

function parseLenIn(s) {
  s = (s || '').trim()
  if (!s) return null
  // ft-in-fraction: 4\'7 1/2" or 4\'-7 1/2" or 4\'7.5 or 4\' 7 1/2
  const ftInFrac = s.match(/^(\d+(?:\.\d+)?)[\u2018\u2019\'\''][-\s]*(\d+(?:\s+\d+\/\d+|(?:\.\d+)?))\s*"?$/)
  if (ftInFrac) {
    const f = parseFracObj(ftInFrac[2].trim())
    return parseFloat(ftInFrac[1]) * 12 + (f ? fracToDecimal(f) : 0)
  }
  // feet only: 4\'
  const ft = s.match(/^(\d+(?:\.\d+)?)[\u2018\u2019\'\''f]$/)
  if (ft) return parseFloat(ft[1]) * 12
  // inches with optional fraction: 48, 7 1/2, 3/4, 7.5
  const inM = s.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+|(?:\.\d+)?)?)\s*(?:"|in)?$/)
  if (inM) { const f = parseFracObj(inM[1].trim()); return f ? fracToDecimal(f) : null }
  return null
}

function inToFtInStr(inches) {
  const neg = inches < 0; inches = Math.abs(inches)
  const ft = Math.floor(inches / 12), ins = inches % 12
  const pref = neg ? '-' : ''
  if (ft === 0) return pref + decToFracStr(ins)
  if (ins < 0.002) return `${pref}${ft}'`
  return `${pref}${ft}' ${decToFracStr(ins)}`
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────
function SectionCard({ title, children }) {
  return (
    <div style={{ background: 'var(--c-bg-surface)', border: '1px solid var(--c-border-light)', borderRadius: 0, borderLeft: '3px solid var(--c-border)', padding: '16px', marginBottom: 12 }}>
      {title && <div className="label-caps" style={{ marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  )
}

function ResultRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--c-border-light)' }}>
      <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: accent ? 'var(--forest)' : 'var(--c-text-primary)', fontSize: 15 }}>{value}</span>
    </div>
  )
}

function LenInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1 }}>
      {label && <div className="calc-label">{label}</div>}
      <input
        className="calc-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || '0'}
        inputMode="decimal"
        style={{ width: '100%', textAlign: 'center' }}
      />
    </div>
  )
}

// ─── Tab: Board Foot ───────────────────────────────────────────────────────────
function BoardFoot() {
  const [t, setT] = useState(''), [w, setW] = useState(''), [l, setL] = useState('')
  const [qty, setQty] = useState('1'), [cost, setCost] = useState('')
  const [tally, setTally] = useState([])

  const pf = v => { const o = parseFracObj(v); return o ? fracToDecimal(o) : null }
  const tv = pf(t), wv = pf(w), lv = parseFloat(l) || 0
  const bf = tv && wv && lv ? Math.round(tv * wv * lv / 144 * 1000) / 1000 : null
  const q = Math.max(1, parseInt(qty) || 1)
  const bfQty = bf ? Math.round(bf * q * 1000) / 1000 : null
  const estCost = bfQty && cost ? (bfQty * (parseFloat(cost) || 0)).toFixed(2) : null

  const clearFields = () => { setT(''); setW(''); setL(''); setQty('1'); setCost('') }

  const addTally = () => {
    if (!bfQty) return
    setTally(p => [...p, { desc: `${t||'?'}" × ${w||'?'}" × ${l||'?'}" ×${q}`, bf: bfQty, cost: estCost ? parseFloat(estCost) : 0 }])
  }

  const totalBF = Math.round(tally.reduce((s, r) => s + r.bf, 0) * 1000) / 1000
  const totalCost = tally.reduce((s, r) => s + r.cost, 0)
  const hasCost = tally.some(r => r.cost > 0)

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: '0 0 auto', width: 320, padding: '12px 20px 12px 16px', overflowY: 'auto', borderRight: '2px solid var(--c-border)' }}>
        <p style={{ fontSize: 12, color: 'var(--c-text-faint)', margin: '0 0 12px' }}>BF = T × W × L ÷ 144 · Fractions OK: 3/4, 1 3/8</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <LenInput label="Thickness (in)" value={t} onChange={setT} placeholder="3/4" />
          <LenInput label="Width (in)" value={w} onChange={setW} placeholder="6" />
          <LenInput label="Length (in)" value={l} onChange={setL} placeholder="96" />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <LenInput label="Qty" value={qty} onChange={setQty} placeholder="1" />
          <LenInput label="$/BF (optional)" value={cost} onChange={setCost} placeholder="5.00" />
        </div>
        <div className="result-box" style={{ marginBottom: 10 }}>
          <div>
            <div key={bfQty} className={`metric-num${bfQty ? ' result-appear' : ''}`}>{bfQty ?? '—'}</div>
            <div className="metric-sub">board feet{bf && bfQty !== bf ? ` (${q}× ${bf} BF)` : ''}</div>
          </div>
          {estCost && (
            <div style={{ textAlign: 'right' }}>
              <div className="metric-green">${estCost}</div>
              <div className="metric-sub">est. cost</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={addTally} disabled={!bfQty}>+ Add to tally</button>
          <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={clearFields}>Clear</button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div className="cm-tape-header">
          <span>RUNNING TALLY</span>
          {tally.length > 0 && (
            <button onClick={() => setTally([])} style={{ background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--tape-font)' }}>[CLEAR]</button>
          )}
        </div>
        <div className="cm-tape" style={{ flex: 1, maxWidth: 260 }}>
          {tally.length === 0 ? (
            <div style={{ padding: '20px 10px', color: 'var(--calc-tape-dim)', fontFamily: 'var(--tape-font)', fontSize: 12, textAlign: 'center', opacity: 0.6 }}>
              — tally is empty —<br /><span style={{ fontSize: 10 }}>add entries from the left panel</span>
            </div>
          ) : (
            <>
              {tally.map((r, i) => (
                <div key={i} className="cm-tape-row" style={{ background: i % 2 === 0 ? 'var(--calc-tape-bg1)' : 'var(--calc-tape-bg2)' }}>
                  <span className="cm-tape-dim" style={{ fontSize: 11 }}>{r.desc}</span>
                  <span style={{ fontFamily: 'var(--tape-font)', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.bf} BF{r.cost > 0 ? ` · $${r.cost.toFixed(2)}` : ''}</span>
                </div>
              ))}
              <div className="cm-tape-row tape-result" style={{ marginTop: 4, borderTop: '2px solid var(--calc-tape-dim)' }}>
                <span style={{ fontFamily: 'var(--tape-font)', letterSpacing: '.5px' }}>TOTAL</span>
                <span className="tape-val">{totalBF} BF{hasCost ? ` · $${totalCost.toFixed(2)}` : ''}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Converter ──────────────────────────────────────────────────────────
const CONV_CATS = {
  Length:         { units: ['in','ft','yd','mi','mm','cm','m','km'], toBase: { in:1, ft:12, yd:36, mi:63360, mm:1/25.4, cm:1/2.54, m:39.3701, km:39370.1 } },
  Area:           { units: ['in²','ft²','yd²','ac','mm²','cm²','m²'], toBase: { 'in²':1,'ft²':144,'yd²':1296,'ac':6272640,'mm²':1/645.16,'cm²':1/6.4516,'m²':1550.003 } },
  'Volume (fluid)': { units: ['fl oz','cup','pt','qt','gal','ml','L'], toBase: { 'fl oz':1,cup:8,pt:16,qt:32,gal:128,ml:1/29.5735,L:33.814 } },
  'Volume (solid)': { units: ['in³','ft³','yd³','cm³','m³','L'], toBase: { 'in³':1,'ft³':1728,'yd³':46656,'cm³':1/16.387,'m³':61023.7,'L':61.0237 } },
  Weight:         { units: ['oz','lb','ton','g','kg','t'], toBase: { oz:1,lb:16,ton:32000,g:1/28.3495,kg:1/0.028349,t:1/0.0000283495 } },
  Temperature:    { units: ['°F','°C','K'], special: true },
  Speed:          { units: ['mph','fps','km/h','m/s','knot'], toBase: { mph:1,fps:0.681818,'km/h':0.621371,'m/s':2.23694,knot:1.15078 } },
  Pressure:       { units: ['PSI','bar','kPa','MPa','atm'], toBase: { PSI:1,bar:14.5038,kPa:0.145038,MPa:145.038,atm:14.696 } },
  Torque:         { units: ['ft·lb','in·lb','N·m','kgf·m'], toBase: { 'ft·lb':1,'in·lb':0.0833333,'N·m':0.737562,'kgf·m':7.23301 } },
  'Board Foot':   { units: ['BF','in³','ft³'], toBase: { BF:1,'in³':1/144,'ft³':12 } },
}

// Shared grid: label | value-input | from-select | arrow | result | to-select | swap
// Columns:     120px   1fr           80px          18px    1fr      80px        32px
const CONV_GRID = '120px 1fr 80px 18px 1fr 80px 32px'

function convertTemp(v, from, to) {
  let c = from==='°F'?(v-32)*5/9 : from==='K'?v-273.15 : v
  return to==='°F'?c*9/5+32 : to==='K'?c+273.15 : c
}
function doConvert(v, from, to, cfg) {
  if (!cfg || isNaN(v)) return ''
  if (cfg.special) { const r = convertTemp(v, from, to); return Number.isFinite(r) ? +r.toFixed(6)+'' : '' }
  const base = v * (cfg.toBase[from] || 1)
  const res = base / (cfg.toBase[to] || 1)
  return +res.toFixed(8)+''
}

const selStyle = (light) => ({
  background: 'transparent', border: 'none', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer', padding: '2px 2px', width: '100%',
  color: light ? 'var(--white)' : 'var(--c-text-primary)',
})

function ConverterRow({ title, cfg }) {
  const [from, setFrom] = useState(cfg.units[0])
  const [to,   setTo]   = useState(cfg.units[1] || cfg.units[0])
  const [val,  setVal]  = useState('')
  const result = val !== '' ? doConvert(parseFloat(val), from, to, cfg) : ''

  return (
    <div style={{ display:'grid', gridTemplateColumns: CONV_GRID, gap:4, alignItems:'center', padding:'5px 0', borderBottom:'1px solid var(--c-border-light)' }}>
      {/* Label with green left accent */}
      <div style={{ display:'flex', alignItems:'center', gap:0 }}>
        <div style={{ width:3, alignSelf:'stretch', background:'var(--forest)', marginRight:8, flexShrink:0 }} />
        <span style={{ fontSize:11, fontWeight:700, color:'var(--c-text-muted)', textTransform:'uppercase', letterSpacing:'.4px' }}>{title}</span>
      </div>
      {/* Input with left accent */}
      <div style={{ borderLeft:'2px solid var(--accent)', paddingLeft:1 }}>
        <input className="calc-input" value={val} onChange={e=>setVal(e.target.value)}
          placeholder="0" inputMode="decimal"
          style={{ fontSize:14, padding:'6px 8px', textAlign:'right', width:'100%' }} />
      </div>
      <select value={from} onChange={e=>setFrom(e.target.value)} style={selStyle(false)}>
        {cfg.units.map(u=><option key={u}>{u}</option>)}
      </select>
      <span style={{ textAlign:'center', color:'var(--c-text-faint)', fontSize:13, userSelect:'none' }}>→</span>
      {/* Result with left accent */}
      <div style={{ borderLeft:'2px solid var(--forest)', paddingLeft:1 }}>
        <div style={{ background:'var(--c-bg-subtle)', border:'1px solid var(--c-border-light)', padding:'6px 8px', fontSize:14, fontWeight:700, color:'var(--forest)', textAlign:'right', minHeight:38, display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
          {result || <span style={{color:'var(--c-text-faint)'}}>—</span>}
        </div>
      </div>
      <select value={to} onChange={e=>setTo(e.target.value)} style={selStyle(false)}>
        {cfg.units.map(u=><option key={u}>{u}</option>)}
      </select>
      <button onClick={()=>{setFrom(to);setTo(from)}} title="Swap"
        style={{ background:'none', border:'1px solid var(--c-border)', borderRadius:0, cursor:'pointer', fontSize:13, color:'var(--c-text-muted)', padding:'4px 6px', width:32 }}>⇄</button>
    </div>
  )
}

function WildcardConverter() {
  const [cat, setCat] = useState('Length')
  const cfg = CONV_CATS[cat]
  const [from, setFrom] = useState(cfg.units[0])
  const [to,   setTo]   = useState(cfg.units[1] || cfg.units[0])
  const [val,  setVal]  = useState('')

  const handleCat = c => {
    setCat(c)
    const u = CONV_CATS[c].units
    setFrom(u[0]); setTo(u[1]||u[0]); setVal('')
  }
  const curCfg = CONV_CATS[cat]
  const result = val !== '' ? doConvert(parseFloat(val), from, to, curCfg) : ''

  const darkSel = {
    background:'rgba(255,255,255,.1)', color:'var(--white)',
    border:'1px solid rgba(255,255,255,.2)', borderRadius:0,
    fontFamily:'inherit', fontSize:13, fontWeight:700,
    padding:'6px 8px', cursor:'pointer', outline:'none', width:'100%',
  }

  return (
    <div style={{ background:'var(--navy)', marginBottom:12, borderLeft:'3px solid var(--accent)' }}>
      <div style={{ padding:'6px 12px 4px', fontSize:10, fontWeight:700, color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.5px' }}>QUICK CONVERT</div>
      {/* Same grid as rows for alignment */}
      <div style={{ display:'grid', gridTemplateColumns: CONV_GRID, gap:4, alignItems:'center', padding:'0 0 10px 0' }}>
        {/* Category label col — dropdown */}
        <div style={{ paddingLeft:12 }}>
          <select value={cat} onChange={e=>handleCat(e.target.value)} style={{ ...darkSel, fontSize:11, fontWeight:700 }}>
            {Object.keys(CONV_CATS).map(c=><option key={c} style={{background:'var(--navy)'}}>{c}</option>)}
          </select>
        </div>
        {/* Value input with left accent */}
        <div style={{ borderLeft:'2px solid var(--accent-light)', paddingLeft:1 }}>
          <input className="calc-input" value={val} onChange={e=>setVal(e.target.value)}
            placeholder="value" inputMode="decimal"
            style={{ background:'rgba(255,255,255,.1)', color:'var(--white)', border:'1px solid rgba(255,255,255,.2)', fontSize:15, fontWeight:700, textAlign:'right', padding:'6px 8px', width:'100%' }} />
        </div>
        <select value={from} onChange={e=>setFrom(e.target.value)} style={darkSel}>
          {curCfg.units.map(u=><option key={u} style={{background:'var(--navy)'}}>{u}</option>)}
        </select>
        <span style={{ textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:13, userSelect:'none' }}>→</span>
        {/* Result with left accent */}
        <div style={{ borderLeft:'2px solid rgba(74,222,128,.5)', paddingLeft:1 }}>
          <div style={{ background:'rgba(0,0,0,.3)', border:'1px solid rgba(255,255,255,.1)', padding:'6px 8px', fontSize:15, fontWeight:700, color:'#4ADE80', textAlign:'right', minHeight:38, display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
            {result || <span style={{color:'rgba(255,255,255,.2)'}}>—</span>}
          </div>
        </div>
        <select value={to} onChange={e=>setTo(e.target.value)} style={darkSel}>
          {curCfg.units.map(u=><option key={u} style={{background:'var(--navy)'}}>{u}</option>)}
        </select>
        <button onClick={()=>{setFrom(to);setTo(from)}}
          style={{ background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:0, color:'var(--white)', fontSize:13, padding:'6px 0', cursor:'pointer', width:32 }}>⇄</button>
      </div>
    </div>
  )
}

function UnitConverter() {
  return (
    <div style={{ padding:'12px 20px 40px', maxWidth:860, margin:'0 auto' }}>
      <WildcardConverter />
      <div>
        {Object.entries(CONV_CATS).map(([title, cfg]) => (
          <ConverterRow key={title} title={title} cfg={cfg} />
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Trim / Linear cuts (FFD) ────────────────────────────────────────────
const CUT_COLS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899']

function ffd(cuts, stockLengths, kerf) {
  const pieces = []; cuts.forEach(c => { for (let i=0;i<c.qty;i++) pieces.push(c.length) })
  pieces.sort((a,b) => b-a)
  const stocks = [...stockLengths].sort((a,b) => a-b)
  const boards = []
  for (const p of pieces) {
    let placed = false
    for (const b of boards) { if (p+kerf <= b.sl-b.used+0.0001) { b.cuts.push(p); b.used+=p+kerf; placed=true; break } }
    if (!placed) { const s=stocks.find(s=>s>=p+kerf); if(!s) return null; boards.push({sl:s,cuts:[p],used:p+kerf}) }
  }
  const summary={}; boards.forEach(b=>{summary[b.sl]=(summary[b.sl]||0)+1})
  return {boards,summary}
}

function TrimCuts() {
  const STOCK_OPTS = [8, 10, 12, 14, 16]
  const [stockSel, setStockSel] = useState([8, 10, 12])
  const [kerf, setKerf]   = useState('0.125')
  const [cuts, setCuts] = useState([
    { id:1, len:'', qty:1, label:'' },
    { id:2, len:'', qty:1, label:'' },
  ])
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)
  const [view, setView]     = useState('summary') // 'summary' | 'plans'

  const toggleStock = ft => setStockSel(s => s.includes(ft) ? s.filter(x=>x!==ft) : [...s, ft].sort((a,b)=>a-b))
  const upd = (id, f, v) => setCuts(c => c.map(x => x.id===id ? {...x,[f]:v} : x))
  const addRow = () => {
    const newId = Date.now()
    setCuts(c => [...c, { id: newId, len: '', qty: 1, label: '' }])
    setTimeout(() => document.getElementById('len-' + newId)?.focus(), 50)
  }
  const clearAll = () => {
    setCuts([{ id:1, len:'', qty:1, label:'' }, { id:2, len:'', qty:1, label:'' }])
    setResult(null); setError(null); setView('summary')
  }

  const calc = () => {
    setError(null); setResult(null)
    const pc = cuts.map(c => {
      const v = parseLenIn(c.len)
      return v > 0 ? { length: Math.round(v*16)/16, qty: Math.max(1,parseInt(c.qty)||1), label: c.label.trim() } : null
    }).filter(Boolean)
    if (!pc.length) { setError('Enter at least one cut.'); return }
    if (!stockSel.length) { setError('Select at least one stock length.'); return }
    const sl = stockSel.map(ft => ft * 12)
    const k = parseFloat(kerf) || 0.125
    if (Math.max(...pc.map(c=>c.length))+k > Math.max(...sl)) { setError('A cut is longer than all stock lengths.'); return }
    const r = ffd(pc, sl, k)
    if (!r) { setError('Could not fit all cuts.'); return }
    r.pc = pc; setResult(r); setView('summary')
  }

  const waste = result
    ? Math.round((1 - result.boards.reduce((s,b)=>s+b.used,0) / result.boards.reduce((s,b)=>s+b.sl,0)) * 100)
    : null

  const printPDF = () => {
    if (!result) return
    const colMap = {}
    result.boards.forEach(b => b.cuts.forEach((cut, ci) => { colMap[ci] = CUT_COLS[ci % CUT_COLS.length] }))

    const boardRows = result.boards.map((b, bi) => {
      const pct = cut => `${(cut/b.sl*100).toFixed(1)}%`
      const segments = b.cuts.map((cut, ci) => {
        const label = result.pc?.find(p => Math.abs(p.length-cut)<0.01)?.label || inToFtInStr(cut)
        return `<div style="width:${pct(cut)};background:${CUT_COLS[ci%CUT_COLS.length]};display:flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:700;overflow:hidden;border-right:1px solid rgba(255,255,255,.3)">${(cut/b.sl)>0.08?label:''}</div>`
      }).join('')
      const wasteW = b.sl - b.used
      const wasteBar = wasteW > 0.05 ? `<div style="flex:1;background:repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 3px,#f3f4f6 3px,#f3f4f6 6px)"></div>` : ''
      const labels = b.cuts.map((cut, ci) => {
        const lbl = result.pc?.find(p => Math.abs(p.length-cut)<0.01)?.label || inToFtInStr(cut)
        return `<span style="font-size:9px;padding:1px 6px;border-radius:99px;background:${CUT_COLS[ci%CUT_COLS.length]}22;color:${CUT_COLS[ci%CUT_COLS.length]};border:1px solid ${CUT_COLS[ci%CUT_COLS.length]}66;margin-right:3px">${lbl}</span>`
      }).join('')
      return `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px">
            <strong>Board ${bi+1} · <span style="color:#2563eb">${inToFtInStr(b.sl)}</span></strong>
            <span style="color:#6b7280">waste ${inToFtInStr(Math.max(0,wasteW))}</span>
          </div>
          <div style="display:flex;height:20px;overflow:hidden;border:1px solid #d1d5db">${segments}${wasteBar}</div>
          <div style="margin-top:4px">${labels}</div>
        </div>`
    }).join('')

    const cutListRows = result.pc.map(p =>
      `<tr><td style="padding:3px 8px;border-bottom:1px solid #e5e7eb">${inToFtInStr(p.length)}</td><td style="padding:3px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${p.qty}</td><td style="padding:3px 8px;border-bottom:1px solid #e5e7eb">${p.label||'—'}</td></tr>`
    ).join('')

    const stockSummary = Object.entries(result.summary).sort(([a],[b])=>+a-+b)
      .map(([len,cnt]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #e5e7eb;font-size:11px"><span>${inToFtInStr(+len)}</span><span style="font-weight:700">× ${cnt}</span></div>`).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<title>Trim Cut Plan</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 24px; }
  @page { size: 8.5in 11in; margin: 0.5in; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  h1 { font-size: 18px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
  h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; color: #374151; border-bottom: 2px solid #111; padding-bottom: 3px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #111; color: #fff; padding: 4px 8px; text-align: left; font-size: 10px; }
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #111;padding-bottom:12px">
  <div>
    <h1>JDH Woodworks</h1>
    <div style="font-size:11px;color:#6b7280;margin-top:2px">Trim Cut Plan · ${new Date().toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'})}</div>
  </div>
  <div style="text-align:right;font-size:11px">
    <div><strong>Boards needed:</strong> ${result.boards.length} pcs</div>
    <div><strong>Waste:</strong> ${waste}%</div>
    <div><strong>Kerf:</strong> ${kerf}"</div>
  </div>
</div>

<div class="grid">
  <div>
    <h2>Cut List</h2>
    <table>
      <thead><tr><th>Length</th><th style="text-align:center">Qty</th><th>Label</th></tr></thead>
      <tbody>${cutListRows}</tbody>
    </table>
  </div>
  <div>
    <h2>Stock Needed</h2>
    ${stockSummary}
  </div>
</div>

<h2>Board Cut Plans</h2>
${boardRows}

<div class="no-print" style="margin-top:24px;text-align:center">
  <button onclick="window.print()" style="padding:8px 24px;background:#2563eb;color:#fff;border:none;border-radius:4px;font-size:13px;cursor:pointer">Print / Save as PDF</button>
</div>
</body>
</html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  const ViewBtn = ({ id, label }) => (
    <button onClick={() => setView(id)} style={{
      padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer',
      fontFamily:'inherit', borderRadius:0,
      background: view===id ? 'var(--navy)' : 'var(--c-bg-subtle)',
      color: view===id ? 'var(--white)' : 'var(--c-text-muted)',
      border:'1.5px solid var(--c-border)',
      transition:'background 120ms, color 120ms',
    }}>{label}</button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Top bar */}
      <div style={{ padding:'10px 16px 8px', borderBottom:'1px solid var(--c-border)', flexShrink:0, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <span className="calc-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>AVAILABLE STOCK LENGTH</span>
          {STOCK_OPTS.map(ft => (
            <label key={ft} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={stockSel.includes(ft)} onChange={() => toggleStock(ft)}
                style={{ width:16, height:16, cursor:'pointer', accentColor:'var(--accent)' }} />
              <span style={{ fontSize:14, fontWeight:600, color: stockSel.includes(ft) ? 'var(--c-text-primary)' : 'var(--c-text-muted)' }}>{ft}'</span>
            </label>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className="calc-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>KERF (in)</span>
          <input className="calc-input" type="number" step="0.0625" value={kerf}
            onChange={e => setKerf(e.target.value)}
            style={{ width:72, textAlign:'center', padding:'6px 8px', fontSize:13 }} />
        </div>
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          <button className="btn-secondary" style={{ padding:'6px 14px', fontSize:13 }} onClick={clearAll}>Clear</button>
          {result && <button className="btn-secondary" style={{ padding:'6px 14px', fontSize:13 }} onClick={printPDF}>⎙ PDF</button>}
          <button className="btn-primary" style={{ padding:'6px 18px', fontSize:13 }} onClick={calc}>Calculate</button>
        </div>
      </div>

      {/* View toggle — only when results exist */}
      {result && (
        <div style={{ display:'flex', gap:0, padding:'8px 16px', borderBottom:'1px solid var(--c-border)', flexShrink:0, alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:0 }}>
            <ViewBtn id="summary" label="Summary + Tape" />
            <ViewBtn id="plans" label="Board Cut Plans" />
          </div>
          <span style={{ fontSize:12, color:'var(--c-text-muted)', fontFamily:'var(--tape-font)' }}>
            {result.boards.length} boards · {waste}% waste
          </span>
        </div>
      )}

      {/* Main content area */}
      {view === 'summary' ? (
        /* Summary view: cut list left + tape right */
        <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
          <div style={{ flex:'0 0 auto', width:380, padding:'10px 14px', overflowY:'auto', overflowX:'hidden', borderRight:'2px solid var(--c-border)' }}>
            <p style={{ fontSize:11, color:'var(--c-text-faint)', margin:'0 0 10px', lineHeight:1.4, wordBreak:'break-word' }}>
              Lengths: inches (48), feet (4'), or ft/in (4'6"). Fractions OK: 3 7/8
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2.5fr) 48px minmax(0,2fr) 28px', gap:4, marginBottom:4 }}>
              {['Length','Qty','Label',''].map(h => (
                <div key={h} className="calc-label" style={{ marginBottom:0, textAlign:'center' }}>{h}</div>
              ))}
            </div>
            {cuts.map(c => (
              <div key={c.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,2.5fr) 48px minmax(0,2fr) 28px', gap:4, marginBottom:5, alignItems:'center' }}>
                <input id={'len-'+c.id} className="calc-input" value={c.len}
                  onChange={e => upd(c.id,'len',e.target.value)}
                  placeholder="48 or 4'6&quot;"
                  style={{ fontSize:13, padding:'7px 8px' }}
                  onKeyDown={e => e.key==='Enter' && addRow()} />
                <input className="calc-input" type="number" min="1" value={c.qty}
                  onChange={e => upd(c.id,'qty',e.target.value)}
                  style={{ textAlign:'center', fontSize:13, padding:'7px 4px' }} />
                <input className="calc-input" value={c.label}
                  onChange={e => upd(c.id,'label',e.target.value)}
                  placeholder="label"
                  style={{ fontSize:12, padding:'7px 6px' }} />
                <button onClick={() => setCuts(cc => cc.filter(x=>x.id!==c.id))}
                  disabled={cuts.length===1} className="icon-btn"
                  style={{ color:'var(--red)', opacity:cuts.length===1?.3:1, fontSize:16 }}>×</button>
              </div>
            ))}
            <button className="btn-text" onClick={addRow} style={{ fontSize:12, marginTop:4 }}>+ Add cut</button>
            {error && <div className="warn-box" style={{ marginTop:10 }}>{error}</div>}
          </div>

          {/* Results tape */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
            <div className="cm-tape-header">
              <span>CUT SUMMARY</span>
              {result && <span style={{ fontFamily:'var(--tape-font)', fontSize:11, color:'var(--calc-tape-dim)' }}>{waste}% WASTE</span>}
            </div>
            <div className="cm-tape" style={{ flex:1, maxWidth:'100%' }}>
              {!result ? (
                <div style={{ padding:'20px 10px', color:'var(--calc-tape-dim)', fontFamily:'var(--tape-font)', fontSize:12, textAlign:'center', opacity:0.6 }}>
                  — enter cuts and press Calculate —
                </div>
              ) : (
                <>
                  <div className="cm-tape-row tape-result" style={{ borderBottom:'2px solid var(--calc-tape-dim)', marginBottom:4 }}>
                    <span style={{ fontFamily:'var(--tape-font)' }}>BOARDS NEEDED</span>
                    <span className="tape-val">{result.boards.length} pcs</span>
                  </div>
                  {Object.entries(result.summary).sort(([a],[b])=>+a-+b).map(([len,cnt], i) => (
                    <div key={len} className="cm-tape-row" style={{ background: i%2===0?'var(--calc-tape-bg1)':'var(--calc-tape-bg2)' }}>
                      <span className="cm-tape-dim">{inToFtInStr(+len)}</span>
                      <span style={{ fontFamily:'var(--tape-font)', fontWeight:700 }}>× {cnt}</span>
                    </div>
                  ))}
                  <div className="cm-tape-row" style={{ borderTop:'1px solid var(--calc-tape-dim)', marginTop:8, paddingTop:6 }}>
                    <span className="cm-tape-dim">WASTE</span>
                    <span style={{ fontFamily:'var(--tape-font)', color: waste>30?'#e87070':'var(--calc-tape-txt)' }}>{waste}%</span>
                  </div>
                  {result.pc?.length > 0 && (
                    <>
                      <div className="cm-tape-row tape-result" style={{ borderTop:'2px solid var(--calc-tape-dim)', marginTop:8, borderBottom:'1px solid var(--calc-tape-dim)' }}>
                        <span style={{ fontFamily:'var(--tape-font)' }}>CUT LIST</span>
                      </div>
                      {result.pc.map((p, i) => (
                        <div key={i} className="cm-tape-row" style={{ background: i%2===0?'var(--calc-tape-bg1)':'var(--calc-tape-bg2)' }}>
                          <span className="cm-tape-dim">{p.label || inToFtInStr(p.length)}</span>
                          <span style={{ fontFamily:'var(--tape-font)' }}>{inToFtInStr(p.length)} × {p.qty}</span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Board cut plans view — full width, scrollable */
        <div style={{ flex:1, overflowY:'auto', padding:'12px 20px' }}>
          {result?.boards.map((b, bi) => (
            <div key={bi} style={{ marginBottom:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12 }}>
                <span style={{ fontWeight:700 }}>Board {bi+1} · <span style={{ color:'var(--accent)' }}>{inToFtInStr(b.sl)}</span></span>
                <span style={{ color:'var(--c-text-faint)' }}>waste {inToFtInStr(Math.max(0,b.sl-b.used))}</span>
              </div>
              <div style={{ display:'flex', height:28, borderRadius:0, overflow:'hidden', border:'1px solid var(--c-border-light)' }}>
                {b.cuts.map((cut,ci) => (
                  <div key={ci} title={inToFtInStr(cut)} style={{
                    width:`${(cut/b.sl)*100}%`, background:CUT_COLS[ci%CUT_COLS.length],
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:10, fontWeight:700, color:'#fff', overflow:'hidden',
                    borderRight:ci<b.cuts.length-1?'1px solid rgba(255,255,255,.3)':'none',
                  }}>{(cut/b.sl)>0.08?inToFtInStr(cut):''}</div>
                ))}
                {b.sl-b.used>0.05 && (
                  <div style={{ flex:1, background:'repeating-linear-gradient(45deg,var(--c-bg-subtle),var(--c-bg-subtle) 4px,var(--c-border-light) 4px,var(--c-border-light) 8px)' }} />
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                {b.cuts.map((cut,ci) => {
                  const m = result.pc?.find(p=>Math.abs(p.length-cut)<0.01)
                  return (
                    <span key={ci} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, fontWeight:600, background:CUT_COLS[ci%CUT_COLS.length]+'33', color:CUT_COLS[ci%CUT_COLS.length], border:`1px solid ${CUT_COLS[ci%CUT_COLS.length]}88` }}>
                      {m?.label||inToFtInStr(cut)}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ─── Tab: Sheet Goods ──────────────────────────────────────────────────────────
const SHEET_COLS = ['var(--navy)','var(--forest)','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12','#BE185D','#0E7490','#7C3AED']

function packSheets(pieces, sw, sh, kerf) {
  const sheets = []
  for (const piece of pieces) {
    const pw = piece.w+kerf, ph = piece.h+kerf
    if (pw>sw||ph>sh) return null
    let placed = false
    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        if (ph<=shelf.h+0.01&&pw<=sw-shelf.usedW+0.01) {
          shelf.pieces.push({...piece,x:shelf.usedW,y:shelf.y})
          sheet.pieces.push({...piece,x:shelf.usedW,y:shelf.y})
          shelf.usedW+=pw; placed=true; break
        }
      }
      if (placed) break
      if (ph<=sh-sheet.usedH+0.01) {
        const shelf={h:ph,y:sheet.usedH,usedW:0,pieces:[]}
        shelf.pieces.push({...piece,x:0,y:sheet.usedH})
        sheet.pieces.push({...piece,x:0,y:sheet.usedH})
        shelf.usedW=pw; sheet.usedH+=ph; sheet.shelves.push(shelf); placed=true; break
      }
    }
    if (!placed) {
      const sheet={w:sw,h:sh,shelves:[],usedH:0,pieces:[]}
      const shelf={h:ph,y:0,usedW:0,pieces:[]}
      shelf.pieces.push({...piece,x:0,y:0}); sheet.pieces.push({...piece,x:0,y:0})
      shelf.usedW=pw; sheet.usedH=ph; sheet.shelves.push(shelf); sheets.push(sheet)
    }
  }
  return sheets
}

function SheetGoods() {
  const [sheetW, setSheetW] = useState('48')
  const [sheetH, setSheetH] = useState('96')
  const [kerf, setKerf]     = useState('0.125')
  const [cuts, setCuts]     = useState([
    { id:1, w:'', h:'', qty:1, label:'' },
    { id:2, w:'', h:'', qty:1, label:'' },
  ])
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)

  const upd = (id, f, v) => setCuts(c => c.map(x => x.id===id?{...x,[f]:v}:x))
  const addRow = () => {
    const newId = Date.now()
    setCuts(c => [...c, { id: newId, w: '', h: '', qty: 1, label: '' }])
    setTimeout(() => document.getElementById('sw-' + newId)?.focus(), 50)
  }

  const calc = () => {
    setError(null); setResult(null)
    const sw=parseFloat(sheetW), sh=parseFloat(sheetH), k=parseFloat(kerf)||0.125
    if (!sw||!sh) { setError('Enter sheet dimensions.'); return }
    const pieces = []
    for (const c of cuts) {
      const w=parseFloat(c.w), h=parseFloat(c.h)
      if (!w||!h) continue
      const qty=Math.max(1,parseInt(c.qty)||1)
      for (let i=0;i<qty;i++) pieces.push({w,h,label:c.label||`${w}"×${h}"`,origW:w,origH:h})
    }
    if (!pieces.length) { setError('Enter at least one piece.'); return }
    if (pieces.some(p=>p.w>sw||p.h>sh)) { setError('A piece is larger than the sheet.'); return }
    pieces.sort((a,b)=>b.h-a.h||(b.w-a.w))
    const sheets = packSheets(pieces,sw,sh,k)
    if (!sheets) { setError('Could not pack.'); return }
    const usedArea=pieces.reduce((s,p)=>s+p.origW*p.origH,0)
    setResult({ sheets, sw, sh, wastePct: Math.round((1-usedArea/(sw*sh*sheets.length))*100), usedSqFt: (usedArea/144).toFixed(1) })
  }

  const SheetDiagram = ({ sheet, sw, sh, idx }) => {
    const SCALE = 320/Math.max(sw,sh)
    const vw=Math.round(sw*SCALE), vh=Math.round(sh*SCALE)
    const labelColors={}; let ci=0
    return (
      <div className="card" style={{ marginBottom:8 }}>
        <div style={{ fontSize:13,fontWeight:700,marginBottom:8 }}>Sheet {idx+1}</div>
        <svg width={vw} height={vh} style={{ border:'1px solid var(--c-border-light)',borderRadius:6,background:'var(--c-bg-subtle-2)',display:'block' }}>
          {sheet.pieces.map((p,i) => {
            if (!labelColors[p.label]) { labelColors[p.label]=SHEET_COLS[ci++%SHEET_COLS.length] }
            const color=labelColors[p.label]
            const x=p.x*SCALE,y=p.y*SCALE,w=p.origW*SCALE,h=p.origH*SCALE
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={1}/>
                {w>18&&h>12&&<text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" stroke="rgba(0,0,0,.4)" strokeWidth={0.3} fontSize={Math.min(11,w/4)} fontWeight="700" fontFamily="system-ui">{p.label.length>7?p.label.slice(0,6)+'…':p.label}</text>}
              </g>
            )
          })}
        </svg>
        <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:8 }}>
          {[...new Set(sheet.pieces.map(p=>p.label))].map(label => (
            <span key={label} style={{ fontSize:11,padding:'2px 8px',borderRadius:99,fontWeight:600,background:(labelColors[label]||'#999')+'22',color:labelColors[label]||'#999',border:`1px solid ${labelColors[label]||'#999'}44` }}>
              {label}
            </span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 24px 40px', maxWidth: 900, margin: '0 auto' }}>
      <p style={{ fontSize: 12, color: 'var(--c-text-faint)', margin: '12px 0' }}>
        Optimize cuts from full sheets. Default: 4×8 plywood (48"×96").
      </p>

      <div style={{ display:'flex', gap:10, marginBottom:12 }}>
        <LenInput label='Sheet width (in)' value={sheetW} onChange={setSheetW} placeholder="48" />
        <LenInput label='Sheet height (in)' value={sheetH} onChange={setSheetH} placeholder="96" />
        <div style={{ width:80 }}>
          <div className="calc-label">Kerf</div>
          <input className="calc-input" type="number" step="0.0625" value={kerf} onChange={e=>setKerf(e.target.value)} style={{ width:'100%' }} />
        </div>
      </div>

      <SectionCard>
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) 44px minmax(0,1fr) 28px', gap:5, marginBottom:6 }}>
          {['Width','Height','Qty','Label',''].map(h => <div key={h} className="calc-label" style={{ marginBottom:0, textAlign:'center' }}>{h}</div>)}
        </div>
        {cuts.map((c,i) => (
          <div key={c.id} style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr) 44px minmax(0,1fr) 28px', gap:5, marginBottom:6, alignItems:'center' }}>
            <input id={'sw-' + c.id} className="calc-input" value={c.w} onChange={e=>upd(c.id,'w',e.target.value)} placeholder='12"' />
            <input className="calc-input" value={c.h} onChange={e=>upd(c.id,'h',e.target.value)} placeholder='24"' />
            <input className="calc-input" type="number" min="1" value={c.qty} onChange={e=>upd(c.id,'qty',e.target.value)} style={{ textAlign:'center' }} />
            <input className="calc-input" value={c.label} onChange={e=>upd(c.id,'label',e.target.value)} placeholder="optional" />
            <button onClick={()=>setCuts(cc=>cc.filter(x=>x.id!==c.id))} disabled={cuts.length===1} className="icon-btn" style={{ color:'var(--red)',opacity:cuts.length===1?.3:1,justifySelf:'center' }}>×</button>
          </div>
        ))}
        <button className="btn-text" onClick={addRow} style={{ fontSize:13 }}>+ Add piece</button>
      </SectionCard>

      {error && <div className="warn-box">{error}</div>}
      <button className="btn-primary" style={{ width:'100%',justifyContent:'center',marginBottom:20 }} onClick={calc}>
        Optimize sheets
      </button>

      {result && (
        <>
          <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
            <div className="card-navy" style={{ padding:'10px 16px',textAlign:'center',borderRadius:0 }}>
              <div style={{ fontSize:28,fontWeight:900,color:'var(--white)' }}>{result.sheets.length}</div>
              <div style={{ fontSize:12,color:'var(--sb-text)' }}>sheet{result.sheets.length!==1?'s':''}</div>
            </div>
            <div style={{ flex:1,background:'var(--c-bg-surface)',borderRadius:0,padding:'10px 16px',border:'1px solid var(--c-border-light)',textAlign:'center' }}>
              <div style={{ fontSize:22,fontWeight:700,color:'var(--orange)' }}>{result.wastePct}%</div>
              <div style={{ fontSize:11,color:'var(--c-text-muted)' }}>waste</div>
            </div>
            <div style={{ flex:1,background:'var(--c-bg-surface)',borderRadius:0,padding:'10px 16px',border:'1px solid var(--c-border-light)',textAlign:'center' }}>
              <div style={{ fontSize:18,fontWeight:700 }}>{result.usedSqFt} ft²</div>
              <div style={{ fontSize:11,color:'var(--c-text-muted)' }}>used</div>
            </div>
          </div>
          {result.sheets.map((sheet,i) => <SheetDiagram key={i} sheet={sheet} sw={result.sw} sh={result.sh} idx={i}/>)}
        </>
      )}
    </div>
  )
}

// AdvancedCalc removed — merged into ConstructionCalc

// AdvancedCalc removed — merged into ConstructionCalc

// ─── Tab: Notes ───────────────────────────────────────────────────────────────
function CalcNotes() {
  const editorRef  = useRef(null)
  const [isEmpty, setIsEmpty]           = useState(true)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl]           = useState('')
  const [fontSize, setFontSize]         = useState(14)
  const [fontColor, setFontColor]       = useState('#000000')
  const savedRange = useRef(null)
  const saveTimer  = useRef(null)

  // Load from Supabase; migrate from localStorage if first time
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let html = await db.loadNote('calc')
        // First-time migration: pull from localStorage if Supabase is empty
        if (!html) {
          try { html = localStorage.getItem('calc-notes-html') || '' } catch {}
          if (html) await db.saveNote('calc', html).catch(() => {})
        }
        if (!cancelled && editorRef.current) {
          editorRef.current.innerHTML = html || ''
          setIsEmpty(!html || editorRef.current.innerText.trim() === '')
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])

  const save = () => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    setIsEmpty(!editorRef.current.innerText.trim())
    // Debounce saves — write to Supabase 1.5s after last keystroke
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      db.saveNote('calc', html).catch(() => {})
    }, 1500)
  }

  const exec = (cmd, value = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
    save()
  }

  const applyFontSize = (size) => {
    setFontSize(size)
    editorRef.current?.focus()
    document.execCommand('fontSize', false, '7')
    editorRef.current?.querySelectorAll('font[size="7"]').forEach(el => {
      el.removeAttribute('size')
      el.style.fontSize = size + 'px'
    })
    save()
  }

  const applyColor = (color) => {
    setFontColor(color)
    exec('foreColor', color)
  }

  const insertLink = () => {
    if (!linkUrl.trim()) { setShowLinkInput(false); return }
    editorRef.current?.focus()
    if (savedRange.current) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
    const url = linkUrl.startsWith('http') ? linkUrl : 'https://' + linkUrl
    document.execCommand('createLink', false, url)
    editorRef.current?.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener' })
    setShowLinkInput(false); setLinkUrl(''); save()
  }

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel.rangeCount) savedRange.current = sel.getRangeAt(0).cloneRange()
  }

  const COLORS = ['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280']
  const FONT_SIZES = [11, 13, 15, 18, 22, 28]

  const Div = () => <div style={{ width:1, height:20, background:'var(--c-border)', margin:'0 3px', flexShrink:0 }} />

  const ToolBtn = ({ title, cmd, value, children }) => (
    <button onMouseDown={e => { e.preventDefault(); exec(cmd, value) }} title={title}
      style={{ background:'none', border:'none', borderRadius:0, cursor:'pointer', padding:'4px 8px', fontSize:14, fontWeight:700, color:'var(--c-text-muted)', fontFamily:'inherit' }}>
      {children}
    </button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:2, padding:'6px 8px', borderBottom:'1px solid var(--c-border)', flexShrink:0, flexWrap:'wrap', background:'var(--c-bg-surface)' }}>
        <ToolBtn title="Bold (Ctrl+B)" cmd="bold"><b>B</b></ToolBtn>
        <ToolBtn title="Italic (Ctrl+I)" cmd="italic"><i>I</i></ToolBtn>
        <ToolBtn title="Underline (Ctrl+U)" cmd="underline"><u>U</u></ToolBtn>
        <Div />
        <ToolBtn title="Bullet list" cmd="insertUnorderedList">• Bullets</ToolBtn>
        <ToolBtn title="Numbered list" cmd="insertOrderedList">1. Numbers</ToolBtn>
        <button onMouseDown={e => {
            e.preventDefault()
            exec('insertHTML', '<div class="note-check-item" style="display:flex;align-items:flex-start;gap:8px;margin:3px 0"><input type="checkbox" style="margin-top:3px;width:15px;height:15px;cursor:pointer;flex-shrink:0" /><span style="flex:1">&#8203;</span></div>')
          }} title="Insert checkbox item"
          style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 8px', fontSize:13, color:'var(--c-text-muted)', fontFamily:'inherit' }}>
          ☐ Check
        </button>
        <Div />
        {/* Font size */}
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ fontSize:11, color:'var(--c-text-faint)', userSelect:'none' }}>Size</span>
          <select value={fontSize} onChange={e => applyFontSize(+e.target.value)}
            style={{ background:'var(--c-bg-subtle)', border:'1px solid var(--c-border)', color:'var(--c-text-primary)', fontFamily:'inherit', fontSize:12, padding:'2px 4px', borderRadius:0, cursor:'pointer' }}>
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>
        <Div />
        {/* Font color swatches */}
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ fontSize:11, color:'var(--c-text-faint)', userSelect:'none' }}>Color</span>
          <div style={{ display:'flex', gap:2 }}>
            {COLORS.map(c => (
              <button key={c} onMouseDown={e => { e.preventDefault(); applyColor(c) }}
                title={c}
                style={{ width:16, height:16, background:c, border: fontColor===c ? '2px solid var(--accent)' : '1px solid var(--c-border)', borderRadius:3, cursor:'pointer', padding:0, flexShrink:0 }} />
            ))}
          </div>
        </div>
        <Div />
        <button onMouseDown={e => { e.preventDefault(); saveSelection(); setShowLinkInput(v => !v); setLinkUrl('') }} title="Insert link"
          style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 8px', fontSize:12, color:'var(--c-text-muted)', fontFamily:'inherit' }}>
          🔗 Link
        </button>
        <button onMouseDown={e => { e.preventDefault(); exec('removeFormat') }} title="Clear formatting"
          style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 8px', color:'var(--c-text-muted)', display:'flex', alignItems:'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M4 12h10M4 17h6"/><line x1="18" y1="14" x2="22" y2="18"/><line x1="22" y1="14" x2="18" y2="18"/>
          </svg>
        </button>
        <div style={{ marginLeft:'auto' }}>
          {!isEmpty && (
            <button className="btn-text" style={{ color:'var(--red)', fontSize:12 }}
              onClick={() => { if (editorRef.current) editorRef.current.innerHTML = ''; save() }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div style={{ display:'flex', gap:6, padding:'6px 12px', borderBottom:'1px solid var(--c-border)', alignItems:'center', flexShrink:0 }}>
          <input className="calc-input" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key==='Enter' && insertLink()} placeholder="https://example.com" autoFocus
            style={{ flex:1, fontSize:13, padding:'5px 10px' }} />
          <button className="btn-primary" style={{ padding:'5px 14px', fontSize:13 }} onClick={insertLink}>Insert</button>
          <button className="btn-secondary" style={{ padding:'5px 10px', fontSize:13 }} onClick={() => setShowLinkInput(false)}>Cancel</button>
        </div>
      )}

      {/* Editor — fills remaining height */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={save}
        onBlur={save}
        data-placeholder="Measurements, cut lists, reminders…"
        style={{
          flex: 1,
          padding: '16px 20px',
          outline: 'none',
          fontSize: fontSize,
          lineHeight: 1.8,
          color: 'var(--c-text-primary)',
          background: 'var(--c-bg-surface)',
          fontFamily: 'inherit',
          overflowY: 'auto',
          minHeight: 0,
        }}
      />
      <style>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: var(--c-text-faint); pointer-events: none; display: block; }
        [contenteditable] a { color: #3B82F6; text-decoration: underline; }
        [contenteditable] ul { list-style: disc; padding-left: 20px; }
        [contenteditable] ol { list-style: decimal; padding-left: 20px; }
        [contenteditable] li { margin-bottom: 2px; }
      `}</style>
    </div>
  )
}

// ─── Main Calculators page ────────────────────────────────────────────────────
const TABS = [
  { id:'construction', label:'Construction Calc' },
  { id:'boardfoot', label:'Board Foot' },
  { id:'converter', label:'Converter'  },
  { id:'trim',      label:'Trim Cuts'  },
  { id:'sheet',     label:'Sheet Goods'},
  { id:'notes',     label:'Notes'      },
]

export default function Calculators() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('calc-tab') || 'construction' } catch { return 'construction' }
  })

  const switchTab = t => {
    setTab(t)
    try { localStorage.setItem('calc-tab', t) } catch {}
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ paddingBottom: 0 }} data-tutorial-target="calculator">
        <h1 className="page-title">Calculators</h1>
        {/* Mobile: dropdown */}
        <div className="calc-tab-select-wrap">
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
            <select
              className="filter-select"
              value={tab}
              onChange={e => switchTab(e.target.value)}
              style={{ width: '100%' }}
            >
              {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <span className="filter-select-chevron" aria-hidden="true">▾</span>
          </div>
        </div>
        {/* Desktop: tabs */}
        <div className="page-tabs" style={{ marginTop: 12 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} className={`page-tab${tab === t.id ? ' active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {(tab === 'construction' || tab === 'boardfoot' || tab === 'trim' || tab === 'notes')
        ? <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {tab === 'construction' && <ConstructionCalc />}
            {tab === 'boardfoot'    && <BoardFoot />}
            {tab === 'trim'         && <TrimCuts />}
            {tab === 'notes'        && <CalcNotes />}
          </div>
        : <div className="scroll-page" style={{ paddingTop: 16, flex: 1 }}>
            {tab === 'converter' && <UnitConverter />}
            {tab === 'sheet'     && <SheetGoods />}
          </div>
      }
    </div>
  )
}
