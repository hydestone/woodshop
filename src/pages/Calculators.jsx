import { useState, useCallback, useMemo } from 'react'
import ConstructionCalc from './ConstructionCalc.jsx'

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
  s = (s || '').trim().toLowerCase()
  if (!s) return null
  const ftIn = s.match(/^(\d+(?:\.\d+)?)['']\s*(\d+(?:[/ ]\d+)?)\"?$/)
  if (ftIn) { const f = parseFracObj(ftIn[2]); return parseFloat(ftIn[1]) * 12 + (f ? fracToDecimal(f) : 0) }
  const ft = s.match(/^(\d+(?:\.\d+)?)[''f]$/)
  if (ft) return parseFloat(ft[1]) * 12
  const inM = s.match(/^(\d+(?:\.\d+)?(?:[/ ]\d+)?)\s*(?:"|in)?$/)
  if (inM) { const f = parseFracObj(inM[1]); return f ? fracToDecimal(f) : null }
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
      <div style={{ flex: '0 0 auto', width: 320, padding: '12px 16px', overflowY: 'auto', borderRight: '2px solid var(--c-border)' }}>
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
        <div className="cm-tape" style={{ flex: 1, maxWidth: '100%' }}>
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
const CUT_COLS = ['var(--navy)','var(--forest)','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12','#BE185D']

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

  const toggleStock = ft => setStockSel(s => s.includes(ft) ? s.filter(x=>x!==ft) : [...s, ft].sort((a,b)=>a-b))
  const upd = (id, f, v) => setCuts(c => c.map(x => x.id===id ? {...x,[f]:v} : x))
  const addRow = () => {
    const newId = Date.now()
    setCuts(c => [...c, { id: newId, len: '', qty: 1, label: '' }])
    setTimeout(() => document.getElementById('len-' + newId)?.focus(), 50)
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
    r.pc = pc; setResult(r)
  }

  const waste = result
    ? Math.round((1 - result.boards.reduce((s,b)=>s+b.used,0) / result.boards.reduce((s,b)=>s+b.sl,0)) * 100)
    : null

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Top bar: stock checkboxes + kerf */}
      <div style={{ padding:'10px 16px 8px', borderBottom:'1px solid var(--c-border)', flexShrink:0, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className="calc-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>STOCK LENGTH</span>
          {STOCK_OPTS.map(ft => (
            <label key={ft} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox" checked={stockSel.includes(ft)} onChange={() => toggleStock(ft)}
                style={{ width:15, height:15, cursor:'pointer', accentColor:'var(--accent)' }} />
              <span style={{ fontSize:13, fontWeight:600, color: stockSel.includes(ft) ? 'var(--c-text-primary)' : 'var(--c-text-muted)' }}>{ft}'</span>
            </label>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span className="calc-label" style={{ marginBottom:0, whiteSpace:'nowrap' }}>KERF (in)</span>
          <input className="calc-input" type="number" step="0.0625" value={kerf}
            onChange={e => setKerf(e.target.value)}
            style={{ width:72, textAlign:'center', padding:'6px 8px', fontSize:13 }} />
        </div>
        <button className="btn-primary" style={{ padding:'6px 18px', fontSize:13, marginLeft:'auto' }} onClick={calc}>
          Calculate
        </button>
      </div>

      {/* Middle: cut list left, greenbar results right */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>

        {/* Cut list */}
        <div style={{ flex:'0 0 auto', width:380, padding:'10px 14px', overflowY:'auto', borderRight:'2px solid var(--c-border)' }}>
          <p style={{ fontSize:11, color:'var(--c-text-faint)', margin:'0 0 10px' }}>
            Lengths in inches (48), feet (4'), or ft/in (4'6"). Fractions OK: 3 7/8
          </p>

          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2.5fr) 48px minmax(0,2fr) 28px', gap:4, marginBottom:4 }}>
            {['Length','Qty','Label',''].map(h => (
              <div key={h} className="calc-label" style={{ marginBottom:0, textAlign:'center' }}>{h}</div>
            ))}
          </div>

          {/* Cut rows — all 4 on one line */}
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

        {/* Greenbar results tape */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          <div className="cm-tape-header">
            <span>CUT SUMMARY</span>
            {result && <span style={{ fontFamily:'var(--tape-font)', fontSize:11, color:'#b0d8a0' }}>
              {waste}% WASTE
            </span>}
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

      {/* Bottom: board cut diagrams */}
      {result && (
        <div style={{ borderTop:'2px solid var(--c-border)', padding:'10px 14px', overflowY:'auto', maxHeight:280, flexShrink:0 }}>
          <div className="calc-label" style={{ marginBottom:8 }}>BOARD CUT PLANS</div>
          {result.boards.map((b, bi) => (
            <div key={bi} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12 }}>
                <span style={{ fontWeight:700 }}>Board {bi+1} · <span style={{ color:'var(--accent)' }}>{inToFtInStr(b.sl)}</span></span>
                <span style={{ color:'var(--c-text-faint)' }}>waste {inToFtInStr(Math.max(0,b.sl-b.used))}</span>
              </div>
              <div style={{ display:'flex', height:22, borderRadius:0, overflow:'hidden', border:'1px solid var(--c-border-light)' }}>
                {b.cuts.map((cut,ci) => (
                  <div key={ci} title={inToFtInStr(cut)} style={{
                    width:`${(cut/b.sl)*100}%`, background:CUT_COLS[ci%CUT_COLS.length],
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:9, fontWeight:700, color:'#fff', overflow:'hidden',
                    borderRight:ci<b.cuts.length-1?'1px solid rgba(255,255,255,.3)':'none',
                  }}>{(cut/b.sl)>0.1?inToFtInStr(cut):''}</div>
                ))}
                {b.sl-b.used>0.05 && (
                  <div style={{ flex:1, background:'repeating-linear-gradient(45deg,var(--c-bg-subtle),var(--c-bg-subtle) 4px,var(--c-border-light) 4px,var(--c-border-light) 8px)' }} />
                )}
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:5 }}>
                {b.cuts.map((cut,ci) => {
                  const m = result.pc?.find(p=>Math.abs(p.length-cut)<0.01)
                  return (
                    <span key={ci} style={{ fontSize:10, padding:'1px 7px', borderRadius:99, fontWeight:600, background:CUT_COLS[ci%CUT_COLS.length]+'22', color:CUT_COLS[ci%CUT_COLS.length], border:`1px solid ${CUT_COLS[ci%CUT_COLS.length]}44` }}>
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
    const SCALE = 180/Math.max(sw,sh)
    const vw=sw*SCALE, vh=sh*SCALE
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
                {w>18&&h>12&&<text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={Math.min(10,w/5)} fontWeight="700" fontFamily="system-ui">{p.label.length>7?p.label.slice(0,6)+'…':p.label}</text>}
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
    <div style={{ padding: '0 20px 40px', maxWidth: 640, margin: '0 auto' }}>
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
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem('calc-notes') || '' } catch { return '' }
  })
  const save = v => { setNotes(v); try { localStorage.setItem('calc-notes', v) } catch {} }
  return (
    <div style={{ padding: '4px 20px 40px', maxWidth: 640, margin: '0 auto' }}>
      <p style={{ fontSize: 12, color: 'var(--c-text-faint)', marginBottom: 12 }}>Scratch pad — saves locally.</p>
      <textarea
        className="form-textarea"
        value={notes}
        onChange={e => save(e.target.value)}
        placeholder={"Measurements, cut lists, reminders…\n\nActual sizes:\n  2×4 = 1.5\" × 3.5\"\n  2×6 = 1.5\" × 5.5\"\n  1×4 = 0.75\" × 3.5\""}
        style={{ width: '100%', minHeight: 320, fontSize: 14, lineHeight: 1.7 }}
      />
      {notes && (
        <button className="btn-text" style={{ marginTop: 8, color: 'var(--red)' }} onClick={() => save('')}>
          Clear notes
        </button>
      )}
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
      <div className="page-header" style={{ paddingBottom: 0 }}>
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
      {(tab === 'construction' || tab === 'boardfoot' || tab === 'trim')
        ? <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {tab === 'construction' && <ConstructionCalc />}
            {tab === 'boardfoot'    && <BoardFoot />}
            {tab === 'trim'         && <TrimCuts />}
          </div>
        : <div className="scroll-page" style={{ paddingTop: 16, flex: 1 }}>
            {tab === 'converter' && <UnitConverter />}
            {tab === 'sheet'     && <SheetGoods />}
            {tab === 'notes'     && <CalcNotes />}
          </div>
      }
    </div>
  )
}
