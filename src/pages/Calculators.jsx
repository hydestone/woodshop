import { useState, useCallback } from 'react'

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
  // mixed: "1 3/8"
  const m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) {
    const sign = +m[1] < 0 ? -1 : 1
    return fracReduce(+m[1] * +m[3] + sign * +m[2], +m[3])
  }
  // fraction: "3/8"
  const f = s.match(/^(-?\d+)\/(\d+)$/)
  if (f) return fracReduce(+f[1], +f[2])
  // decimal or integer
  const d = parseFloat(s)
  if (!isNaN(d)) {
    const n64 = Math.round(d * 64)
    return fracReduce(n64, 64)
  }
  return null
}

function fracToStr({ n, d }) {
  if (d === 1) return `${n}`
  const w = Math.trunc(n / d), r = Math.abs(n % d)
  if (r === 0) return `${w}`
  if (w !== 0) return `${w} ${Math.abs(r)}/${d}`
  return `${n}/${d}`
}

// Render fraction as proper stacked notation HTML
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

// Convert decimal inches to nearest 1/16 display
const DENOMS = [2,4,8,16,32,64]
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
  // ft' in"  or ft' in fraction"
  const ftIn = s.match(/^(\d+(?:\.\d+)?)['']\s*(\d+(?:[/ ]\d+)?)"?$/)
  if (ftIn) return parseFloat(ftIn[1]) * 12 + (parseFracObj(ftIn[2]) ? fracToDecimal(parseFracObj(ftIn[2])) : 0)
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

// ─── Shared constants ──────────────────────────────────────────────────────────
const NAVY = 'var(--navy)', FOREST = 'var(--forest)'
// Key classes: key-btn, key-btn.navy, key-btn.forest, key-btn.amber, key-btn.den
// Use helper for conditional active class
const kCls = (base, active) => `key-btn ${active ? base : ''}`

// ─── Tab: Board Foot ───────────────────────────────────────────────────────────
function BoardFoot() {
  const [t, setT] = useState(''), [w, setW] = useState(''), [l, setL] = useState('')
  const [qty, setQty] = useState('1'), [cost, setCost] = useState('')
  const [tally, setTally] = useState([])

  const f = (v) => { const o = parseFracObj(v); return o ? fracToDecimal(o) : null }
  const tv = f(t), wv = f(w), lv = parseFloat(l) || 0
  const bf = (tv && wv && lv) ? Math.round(tv * wv * lv / 144 * 1000) / 1000 : null
  const bfQty = bf ? Math.round(bf * (Math.max(1, parseInt(qty) || 1)) * 1000) / 1000 : null
  const estCost = bfQty && cost ? (bfQty * (parseFloat(cost) || 0)) : null

  const addTally = () => {
    if (!bfQty) return
    const q = parseInt(qty) || 1
    setTally(p => [...p, { desc: `${t || '?'}"×${w || '?'}"×${l || '?'}" ×${q}`, bf: bfQty, cost: estCost || 0 }])
  }

  const row = (label, val, set, ph, unit) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input className="form-input" value={val} onChange={e => set(e.target.value)} placeholder={ph} style={{ flex: 1, fontSize: 15, textAlign: 'right' }} />
        {unit && <span style={{ fontSize: 12, color: 'var(--text-4)', flexShrink: 0 }}>{unit}</span>}
      </div>
    </div>
  )

  return (
    <div style={{ padding: '4px 20px 40px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>BF = (T × W × L) ÷ 144 &nbsp;·&nbsp; Accepts fractions: 3/4, 1 3/8</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        {row('Thickness', t, setT, '3/4', 'in')}
        {row('Width', w, setW, '6', 'in')}
        {row('Length', l, setL, '96', 'in')}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {row('Qty', qty, setQty, '1', '')}
        {row('$/BF (optional)', cost, setCost, '5.00', '')}
      </div>
      <div className="result-box" style={{ marginBottom: 12 }}>
        <div>
          <div className="metric-num">{bfQty ?? '—'}</div>
          <div className="metric-sub">board feet{bf && bfQty !== bf ? ` (${parseInt(qty)}× ${bf} BF)` : ''}</div>
        </div>
        {estCost != null && (
          <div style={{ textAlign: 'right' }}>
            <div className="metric-green">${estCost.toFixed(2)}</div>
            <div className="metric-sub">est. cost</div>
          </div>
        )}
      </div>
      <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 20 }} onClick={addTally} disabled={!bfQty}>
        + Add to tally
      </button>
      {tally.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>Running Tally</div>
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
            {tally.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < tally.length - 1 ? '1px solid var(--border-2)' : 'none', fontSize: 13 }}>
                <span style={{ color: 'var(--text-3)' }}>{r.desc}</span>
                <span style={{ fontWeight: 700 }}>{r.bf} BF{r.cost > 0 ? ` · $${r.cost.toFixed(2)}` : ''}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--fill)', fontWeight: 700, fontSize: 14 }}>
              <span>Total</span>
              <span>
                {Math.round(tally.reduce((s, r) => s + r.bf, 0) * 1000) / 1000} BF
                {tally.some(r => r.cost > 0) ? ` · $${tally.reduce((s, r) => s + r.cost, 0).toFixed(2)}` : ''}
              </span>
            </div>
          </div>
          <button className="btn-text" style={{ marginTop: 8 }} onClick={() => setTally([])}>Clear tally</button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Fraction Calculator ─────────────────────────────────────────────────
function FractionCalc() {
  // State: left operand, operator, right operand, result
  // Input state: which side is active, current entry mode
  const [left, setLeft]     = useState(null)  // fracObj
  const [op, setOp]         = useState(null)  // '+' '-' '×' '÷'
  const [right, setRight]   = useState(null)  // fracObj
  const [result, setResult] = useState(null)  // fracObj
  const [entry, setEntry]   = useState({ whole: '', num: '', den: '', mode: 'whole' })
  // mode: 'whole' → typing whole part, 'num' → typing numerator, 'den' → typing denominator

  // Commit current entry to a fracObj
  const commitEntry = useCallback(() => {
    const { whole, num, den } = entry
    const w = parseInt(whole) || 0
    const n = parseInt(num) || 0
    const d = parseInt(den) || 1
    if (n === 0 && w === 0) return null
    if (n === 0) return { n: w, d: 1 }
    return fracReduce(w * d + n, d)
  }, [entry])

  const clearEntry = () => setEntry({ whole: '', num: '', den: '', mode: 'whole' })

  const handleDigit = (d) => {
    setResult(null)
    setEntry(e => {
      if (e.mode === 'whole') return { ...e, whole: (e.whole + d).replace(/^0+/, '') || '0' }
      if (e.mode === 'num')   return { ...e, num:   (e.num   + d).replace(/^0+/, '') || '0' }
      if (e.mode === 'den')   return { ...e, den:   (e.den   + d).replace(/^0+/, '') || '0' }
      return e
    })
  }

  const handleSlash = () => {
    // user pressed '/' manually — switch to num entry
    setEntry(e => ({ ...e, mode: 'num', num: '', den: '' }))
  }

  const handleDenBtn = (den) => {
    // Quick denominator button — set den, switch to num entry
    setResult(null)
    setEntry(e => ({ ...e, den: String(den), mode: 'num', num: e.num || '' }))
  }

  const handleBackspace = () => {
    setResult(null)
    setEntry(e => {
      if (e.mode === 'den' && e.den.length > 0) return { ...e, den: e.den.slice(0, -1) }
      if (e.mode === 'num' && e.num.length > 0) return { ...e, num: e.num.slice(0, -1) }
      if (e.mode === 'num' && e.num.length === 0) return { ...e, mode: 'whole', num: '', den: '' }
      if (e.mode === 'whole' && e.whole.length > 0) return { ...e, whole: e.whole.slice(0, -1) }
      return e
    })
  }

  const handleOp = (newOp) => {
    setResult(null)
    const val = commitEntry()
    if (val) {
      setLeft(val); setOp(newOp); clearEntry(); setRight(null)
    } else if (result) {
      setLeft(result); setOp(newOp); clearEntry(); setResult(null); setRight(null)
    } else if (left) {
      setOp(newOp)
    }
  }

  const handleEquals = () => {
    const val = commitEntry()
    const r = val || result
    if (!r || !left || !op) return
    setRight(r)
    let res
    if (op === '+') res = fracAdd(left, r)
    else if (op === '-') res = fracSub(left, r)
    else if (op === '×') res = fracMul(left, r)
    else if (op === '÷') res = fracDiv(left, r)
    if (res) { setResult(res); clearEntry() }
  }

  const handleAC = () => {
    setLeft(null); setOp(null); setRight(null); setResult(null); clearEntry()
  }

  const handleC = () => {
    setResult(null); clearEntry()
  }

  // Construct display expression
  const entryFrac = (() => {
    const { whole, num, den, mode } = entry
    if (!whole && !num) return null
    if (mode === 'whole' || (!num && !den)) return whole ? { n: parseInt(whole), d: 1 } : null
    const w = parseInt(whole) || 0
    const n = parseInt(num) || 0
    const d = parseInt(den) || (mode === 'num' ? null : 1)
    if (!d) return null
    return fracReduce(w * d + n, d)
  })()

  const activeVal = result || entryFrac

  // Result display
  const res = result
  const resDec = res ? fracToDecimal(res) : null
  const resMM = resDec != null ? (resDec * 25.4).toFixed(3) : null

  const displayFrac = (frac, size = 22) => {
    if (!frac) return <span style={{ color: 'var(--text-4)', fontSize: size }}>—</span>
    return fracToHTML(frac, { fontSize: size, color: 'var(--text)' })
  }

  const DENS = [2, 4, 8, 16, 32, 64]

  return (
    <div style={{ padding: '4px 16px 40px' }}>
      {/* Expression display */}
      <div style={{ background: NAVY, borderRadius: 12, padding: '14px 18px', marginBottom: 14, minHeight: 80 }}>
        {/* Equation line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          {left && fracToHTML(left, { fontSize: 20, color: '#fff' })}
          {op && <span style={{ fontSize: 22, color: '#F59E0B', fontWeight: 700 }}>{op}</span>}
          {(right || (op && entryFrac)) && fracToHTML(right || entryFrac, { fontSize: 20, color: '#fff' })}
        </div>
        {/* Result or current entry */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          {result
            ? <>
                {fracToHTML(result, { fontSize: 32, color: '#4ADE80', fontWeight: 800 })}
                <span style={{ fontSize: 13, color: '#8BA8D0' }}>{resDec?.toFixed(4)}" · {resMM} mm</span>
              </>
            : !op && entryFrac
              ? fracToHTML(entryFrac, { fontSize: 32, color: '#fff', fontWeight: 800 })
              : !op && <span style={{ fontSize: 24, color: 'rgba(255,255,255,.3)' }}>0</span>
          }
        </div>
        {/* Typing indicator */}
        {!result && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>
            {op ? (right ? '' : `Entering ${op === '+' || op === '-' ? 'right' : 'second'} value`) : ''}
            {!left && !op && entry.whole === '' ? 'Enter a number' : ''}
          </div>
        )}
      </div>

      {/* Keypad */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* Left: whole numbers */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6, textAlign: 'center' }}>Whole</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[7,8,9,4,5,6,1,2,3].map(n => (
              <button key={n} className="key-btn" onClick={() => handleDigit(String(n))}>{n}</button>
            ))}
            <button className="key-btn" onClick={() => handleDigit('0')}>0</button>
          </div>
          {/* Operators */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
            {['+', '-', '×', '÷'].map(o => (
              <button key={o} className={`key-btn amber ${op === o && !result ? "" : "op-inactive"}`} onClick={() => handleOp(o)}>{o}</button>
            ))}
          </div>
        </div>

        {/* Right: fractions + controls */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 6, textAlign: 'center' }}>Fraction</div>
          {/* Numerator digits 1-9 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} style={{ ...calcBtn(false), fontSize: 15 }} onClick={() => handleDigit(String(n))}>{n}</button>
            ))}
          </div>
          {/* Denominator quick buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            {DENS.map(d => (
              <button key={d} className={`key-btn den ${entry.den === String(d) ? "active" : ""}`} onClick={() => handleDenBtn(d)}>/{d}</button>
            ))}
          </div>
          {/* Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <button style={{ ...calcBtn(false, '#DC2626'), fontSize: 13 }} onClick={handleAC}>AC</button>
            <button style={{ ...calcBtn(false, '#9CA3AF'), fontSize: 13 }} onClick={handleC}>C</button>
            <button style={{ ...calcBtn(false, '#9CA3AF'), fontSize: 18 }} onClick={handleBackspace}>⌫</button>
          </div>
          {/* Slash and equals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, marginTop: 6 }}>
            <button style={{ ...calcBtn(false, '#6B7280'), fontSize: 18 }} onClick={handleSlash}>/</button>
            <button style={{ ...calcBtn(true, FOREST), fontSize: 20 }} onClick={handleEquals}>=</button>
          </div>
        </div>
      </div>

      {/* Conversion strip */}
      {activeVal && (
        <div style={{ marginTop: 14, background: 'var(--fill)', borderRadius: 10, padding: '10px 14px' }}>
          <div className="label-caps" style={{ marginBottom: 8 }}>Conversions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
            {[16, 32, 64].map(den => {
              const dec = fracToDecimal(activeVal)
              const { w, n, d } = inchToFrac(dec, den)
              return (
                <div key={den} style={{ background: 'var(--surface)', borderRadius: 8, padding: '6px 10px' }}>
                  <span style={{ color: 'var(--text-3)', fontSize: 10 }}>nearest 1/{den}" &nbsp;</span>
                  <strong>{n === 0 ? `${w}"` : `${w > 0 ? w + ' ' : ''}${n}/${d}"`}</strong>
                </div>
              )
            })}
            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>decimal &nbsp;</span>
              <strong>{fracToDecimal(activeVal).toFixed(5)}"</strong>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>mm &nbsp;</span>
              <strong>{(fracToDecimal(activeVal) * 25.4).toFixed(3)}</strong>
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 8, padding: '6px 10px' }}>
              <span style={{ color: 'var(--text-3)', fontSize: 10 }}>feet &nbsp;</span>
              <strong>{inToFtInStr(fracToDecimal(activeVal))}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Unit Converter ───────────────────────────────────────────────────────
const CONV_TYPES = {
  Length: {
    icon: '📏',
    units: ['in', 'ft', 'yd', 'mm', 'cm', 'm'],
    from: { in: 1, ft: 12, yd: 36, mm: 1/25.4, cm: 1/2.54, m: 39.3701 },
    // all stored as inches
    display: v => `${+v.toFixed(6)}`
  },
  Temperature: {
    icon: '🌡️',
    units: ['°F', '°C', 'K'],
    // special handling
  },
  Weight: {
    icon: '⚖️',
    units: ['lb', 'oz', 'kg', 'g'],
    from: { lb: 1, oz: 1/16, kg: 2.20462, g: 0.00220462 },
  },
  Area: {
    icon: '▭',
    units: ['in²', 'ft²', 'mm²', 'cm²', 'm²'],
    from: { 'in²': 1, 'ft²': 144, 'mm²': 1/645.16, 'cm²': 1/6.4516, 'm²': 1550.003 },
  },
  Volume: {
    icon: '🪣',
    units: ['fl oz', 'cup', 'qt', 'gal', 'mL', 'L'],
    from: { 'fl oz': 1, cup: 8, qt: 32, gal: 128, mL: 0.033814, L: 33.814 },
  },
}

function convertTemp(val, from, to) {
  let c
  if (from === '°F') c = (val - 32) * 5/9
  else if (from === 'K')  c = val - 273.15
  else c = val
  if (to === '°F') return c * 9/5 + 32
  if (to === 'K')  return c + 273.15
  return c
}

function UnitConverter() {
  const [type, setType] = useState('Length')
  const [fromUnit, setFromUnit] = useState('in')
  const [toUnit, setToUnit] = useState('mm')
  const [fromVal, setFromVal] = useState('')

  const cfg = CONV_TYPES[type]

  const handleTypeChange = (t) => {
    setType(t)
    const units = CONV_TYPES[t].units
    setFromUnit(units[0])
    setToUnit(units[1] || units[0])
    setFromVal('')
  }

  const result = (() => {
    const v = parseFloat(fromVal)
    if (isNaN(v) || fromVal === '') return ''
    if (type === 'Temperature') return convertTemp(v, fromUnit, toUnit).toFixed(4)
    const inBase = v * (cfg.from[fromUnit] || 1)
    return (inBase / (cfg.from[toUnit] || 1)).toFixed(6).replace(/\.?0+$/, '')
  })()

  return (
    <div style={{ padding: '4px 20px 40px' }}>
      {/* Type selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(CONV_TYPES).map(([t, cfg]) => (
          <button key={t} onClick={() => handleTypeChange(t)} className={`pill-tab ${type === t ? "active" : ""}`}>
            {cfg.icon} {t}
          </button>
        ))}
      </div>

      {/* From */}
      <div className="card-navy" style={{ marginBottom: 10 }}>
        <div className="metric-sub label-caps">From</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            className="form-input"
            value={fromVal}
            onChange={e => setFromVal(e.target.value)}
            placeholder="0"
            style={{ flex: 1, fontSize: 28, fontWeight: 700, background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', textAlign: 'right' }}
          />
          <select value={fromUnit} onChange={e => setFromUnit(e.target.value)} style={{
            background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.2)',
            borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
          }}>
            {(cfg.units || CONV_TYPES[type].units).map(u => <option key={u} style={{ background: NAVY }}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Swap arrow */}
      <div style={{ textAlign: 'center', margin: '4px 0 4px' }}>
        <button onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit) }} style={{
          background: 'var(--fill)', border: 'none', borderRadius: '50%', width: 36, height: 36,
          cursor: 'pointer', fontSize: 18, color: 'var(--text-3)',
        }}>⇅</button>
      </div>

      {/* To */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>Result</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 28, fontWeight: 700, color: FOREST, textAlign: 'right' }}>
            {result || '—'}
          </div>
          <select value={toUnit} onChange={e => setToUnit(e.target.value)} style={{
            background: 'var(--fill)', border: '1px solid var(--border-2)',
            borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit',
          }}>
            {(cfg.units || CONV_TYPES[type].units).map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Quick reference table */}
      {fromVal && result && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>All Conversions</div>
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
            {(cfg.units || CONV_TYPES[type].units).filter(u => u !== fromUnit).map((u, i, arr) => {
              const v = parseFloat(fromVal)
              let r
              if (type === 'Temperature') r = convertTemp(v, fromUnit, u)
              else { const inBase = v * (cfg.from[fromUnit] || 1); r = inBase / (cfg.from[u] || 1) }
              return (
                <div key={u} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-2)' : 'none', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-3)' }}>{u}</span>
                  <strong>{+r.toFixed(6)}</strong>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Trim / Linear cuts (FFD) ────────────────────────────────────────────
const CUT_COLS = ['#0F1E38','#2D5A3D','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12','#BE185D']

function ffd(cuts, stockLengths, kerf) {
  const pieces = []; cuts.forEach(c => { for (let i = 0; i < c.qty; i++) pieces.push(c.length) })
  pieces.sort((a, b) => b - a)
  const stocks = [...stockLengths].sort((a, b) => a - b)
  const boards = []
  for (const p of pieces) {
    let placed = false
    for (const b of boards) { if (p + kerf <= b.sl - b.used + 0.0001) { b.cuts.push(p); b.used += p + kerf; placed = true; break } }
    if (!placed) { const s = stocks.find(s => s >= p + kerf); if (!s) return null; boards.push({ sl: s, cuts: [p], used: p + kerf }) }
  }
  const summary = {}; boards.forEach(b => { summary[b.sl] = (summary[b.sl]||0)+1 })
  return { boards, summary }
}

function TrimCuts() {
  const [cuts, setCuts]   = useState([{ id:1,ft:'',ins:'',qty:1,label:'' },{ id:2,ft:'',ins:'',qty:1,label:'' }])
  const [stock, setStock] = useState("8', 10', 12'")
  const [kerf, setKerf]   = useState('0.125')
  const [result, setResult] = useState(null)
  const [error, setError]   = useState(null)
  const refs = {}

  const upd = (id, f, v) => setCuts(c => c.map(x => x.id === id ? {...x,[f]:v} : x))
  const addRow = () => { const id = Date.now(); setCuts(c => [...c, {id,ft:'',ins:'',qty:1,label:''}]) }

  const calc = () => {
    setError(null); setResult(null)
    const pc = cuts.map(c => {
      const raw = (parseFloat(c.ft)||0)*12 + (parseFracObj(c.ins) ? fracToDecimal(parseFracObj(c.ins)) : 0)
      return raw > 0 ? { length: Math.round(raw*16)/16, qty: Math.max(1,parseInt(c.qty)||1), label: c.label.trim() } : null
    }).filter(Boolean)
    if (!pc.length) { setError('Enter at least one cut.'); return }
    const sl = stock.split(/[,\s]+/).map(s => { const v = parseLenIn(s); return v ? Math.round(v*8)/8 : null }).filter(Boolean)
    if (!sl.length) { setError("Enter stock lengths e.g. 8', 10', 12'"); return }
    const k = parseFloat(kerf)||0.125
    if (Math.max(...pc.map(c=>c.length))+k > Math.max(...sl)) { setError('A cut is longer than all stock lengths.'); return }
    const r = ffd(pc, sl, k)
    if (!r) { setError('Could not fit all cuts.'); return }
    r.pc = pc; r.k = k; setResult(r)
  }

  return (
    <div style={{ padding: '4px 20px 40px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 10 }}>Inches field accepts fractions: 3/8, 1 3/16</p>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-2)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 1fr 26px', gap:6, padding:'6px 12px', borderBottom:'1px solid var(--border-2)', background:'var(--fill)' }}>
          {['Length','Qty','Label',''].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'.5px'}}>{h}</div>)}
        </div>
        {cuts.map((c,i)=>(
          <div key={c.id} style={{ display:'grid',gridTemplateColumns:'1fr 52px 1fr 26px',gap:6,padding:'6px 12px',borderBottom:i<cuts.length-1?'1px solid var(--border-2)':'none',alignItems:'center' }}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <input className="form-input" value={c.ft} onChange={e=>upd(c.id,'ft',e.target.value)} placeholder="0" style={{width:40,fontSize:13,textAlign:'right'}}/>
              <span style={{fontSize:11,color:'var(--text-4)'}}>ft</span>
              <input className="form-input" value={c.ins} onChange={e=>upd(c.id,'ins',e.target.value)} placeholder="0" style={{width:52,fontSize:13,textAlign:'right'}} onKeyDown={e=>e.key==='Enter'&&(i===cuts.length-1?addRow():null)}/>
              <span style={{fontSize:11,color:'var(--text-4)'}}>in</span>
            </div>
            <input className="form-input" type="number" min="1" value={c.qty} onChange={e=>upd(c.id,'qty',e.target.value)} style={{fontSize:13,textAlign:'center'}}/>
            <input className="form-input" placeholder="optional" value={c.label} onChange={e=>upd(c.id,'label',e.target.value)} style={{fontSize:13}}/>
            <button onClick={()=>setCuts(cc=>cc.filter(x=>x.id!==c.id))} disabled={cuts.length===1} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:16,padding:0,opacity:cuts.length===1?.3:1}}>×</button>
          </div>
        ))}
        <div style={{padding:'6px 12px'}}><button className="btn-text" onClick={addRow} style={{fontSize:13}}>+ Add cut</button></div>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:4}}>Stock lengths</div>
          <input className="form-input" value={stock} onChange={e=>setStock(e.target.value)} placeholder="8', 10', 12'" style={{fontSize:13}}/>
        </div>
        <div style={{width:88}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:4}}>Kerf (in)</div>
          <input className="form-input" type="number" step="0.0625" value={kerf} onChange={e=>setKerf(e.target.value)} style={{fontSize:13}}/>
        </div>
      </div>
      {error && <div style={{background:'var(--red-dim)',color:'var(--red)',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:10}}>{error}</div>}
      <button className="btn-primary" style={{width:'100%',justifyContent:'center',marginBottom:20}} onClick={calc}>Calculate</button>
      {result && (
        <>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
            {Object.entries(result.summary).sort(([a],[b])=>+a-+b).map(([len,cnt])=>(
              <div key={len} style={{background:NAVY,borderRadius:10,padding:'10px 16px',textAlign:'center'}}>
                <div style={{fontSize:26,fontWeight:900,color:'#fff'}}>{cnt}</div>
                <div style={{fontSize:12,color:'#8BA8D0'}}>× {inToFtInStr(+len)}</div>
              </div>
            ))}
            <div style={{flex:1,minWidth:80,background:'var(--surface)',borderRadius:10,padding:'10px 16px',border:'1px solid var(--border-2)',textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:700,color:'var(--orange)'}}>
                {Math.round((1-result.boards.reduce((s,b)=>s+b.used,0)/result.boards.reduce((s,b)=>s+b.sl,0))*100)}%
              </div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>waste</div>
            </div>
          </div>
          {result.boards.map((b,bi)=>(
            <div key={bi} style={{background:'var(--surface)',borderRadius:10,border:'1px solid var(--border-2)',padding:'12px 14px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13}}>
                <span style={{fontWeight:700}}>Board {bi+1} · <span style={{color:'var(--accent)'}}>{inToFtInStr(b.sl)}</span></span>
                <span style={{color:'var(--text-4)'}}>waste {inToFtInStr(Math.max(0,b.sl-b.used))}</span>
              </div>
              <div style={{display:'flex',height:26,borderRadius:6,overflow:'hidden',border:'1px solid var(--border-2)'}}>
                {b.cuts.map((cut,ci)=>(
                  <div key={ci} title={inToFtInStr(cut)} style={{width:`${(cut/b.sl)*100}%`,background:CUT_COLS[ci%CUT_COLS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'#fff',overflow:'hidden',borderRight:ci<b.cuts.length-1?'1px solid rgba(255,255,255,.3)':'none'}}>
                    {(cut/b.sl)>0.1?inToFtInStr(cut):''}
                  </div>
                ))}
                {b.sl-b.used>0.05&&<div style={{flex:1,background:'repeating-linear-gradient(45deg,var(--fill),var(--fill) 4px,var(--border-2) 4px,var(--border-2) 8px)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'var(--text-4)'}}>
                  {(b.sl-b.used)/b.sl>0.1?'waste':''}</div>}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
                {b.cuts.map((cut,ci)=>{const m=result.pc?.find(p=>Math.abs(p.length-cut)<0.01);return(
                  <span key={ci} style={{fontSize:11,padding:'2px 8px',borderRadius:99,fontWeight:600,background:CUT_COLS[ci%CUT_COLS.length]+'22',color:CUT_COLS[ci%CUT_COLS.length],border:`1px solid ${CUT_COLS[ci%CUT_COLS.length]}44`}}>
                    {m?.label||inToFtInStr(cut)}
                  </span>
                )})}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Tab: Sheet Goods (2D plywood optimizer) ──────────────────────────────────
const SHEET_COLS = ['#0F1E38','#2D5A3D','#1D4ED8','#92400E','#6B21A8','#065F46','#7C2D12','#BE185D','#0E7490','#7C3AED']

// Shelf-packing algorithm: sort pieces by height desc, pack L-R in shelves
function packSheets(pieces, sw, sh, kerf) {
  const sheets = []
  let cur = null

  const newSheet = () => ({ w: sw, h: sh, shelves: [], usedH: 0, pieces: [] })
  const newShelf = (h) => ({ y: 0, h, usedW: 0, pieces: [] })

  for (const piece of pieces) {
    const pw = piece.w + kerf, ph = piece.h + kerf
    if (pw > sw || ph > sh) return null // piece doesn't fit on sheet

    let placed = false
    for (const sheet of sheets) {
      for (const shelf of sheet.shelves) {
        if (ph <= shelf.h + 0.01 && pw <= sw - shelf.usedW + 0.01) {
          shelf.pieces.push({ ...piece, x: shelf.usedW, y: shelf.y })
          sheet.pieces.push({ ...piece, x: shelf.usedW, y: shelf.y })
          shelf.usedW += pw
          placed = true; break
        }
      }
      if (placed) break
      // Try new shelf on this sheet
      if (ph <= sh - sheet.usedH + 0.01) {
        const shelf = newShelf(ph)
        shelf.y = sheet.usedH
        shelf.pieces.push({ ...piece, x: 0, y: sheet.usedH })
        sheet.pieces.push({ ...piece, x: 0, y: sheet.usedH })
        shelf.usedW = pw
        sheet.usedH += ph
        sheet.shelves.push(shelf)
        placed = true; break
      }
    }
    if (!placed) {
      const sheet = newSheet()
      const shelf = newShelf(ph)
      shelf.pieces.push({ ...piece, x: 0, y: 0 })
      sheet.pieces.push({ ...piece, x: 0, y: 0 })
      shelf.usedW = pw
      sheet.usedH = ph
      sheet.shelves.push(shelf)
      sheets.push(sheet)
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
  const addRow = () => setCuts(c => [...c, { id:Date.now(),w:'',h:'',qty:1,label:'' }])

  const calc = () => {
    setError(null); setResult(null)
    const sw = parseFloat(sheetW), sh = parseFloat(sheetH), k = parseFloat(kerf)||0.125
    if (!sw||!sh) { setError('Enter sheet dimensions.'); return }
    const pieces = []
    for (const c of cuts) {
      const w = parseFloat(c.w), h = parseFloat(c.h)
      if (!w||!h) continue
      const qty = Math.max(1,parseInt(c.qty)||1)
      for (let i=0;i<qty;i++) pieces.push({ w, h, label: c.label||`${w}"×${h}"`, origW:w, origH:h })
    }
    if (!pieces.length) { setError('Enter at least one piece.'); return }
    if (pieces.some(p=>p.w>sw||p.h>sh)) { setError('A piece is larger than the sheet.'); return }
    // Sort by height desc (tallest first for shelf packing)
    pieces.sort((a,b)=>b.h-a.h||(b.w-a.w))
    const sheets = packSheets(pieces, sw, sh, k)
    if (!sheets) { setError('Could not pack all pieces.'); return }
    const totalArea = sw * sh * sheets.length
    const usedArea = pieces.reduce((s,p)=>s+p.origW*p.origH,0)
    setResult({ sheets, sw, sh, totalArea, usedArea, wastePct: Math.round((1-usedArea/totalArea)*100) })
  }

  // SVG sheet diagram
  const SheetDiagram = ({ sheet, sw, sh, idx }) => {
    const SCALE = 200 / Math.max(sw, sh)
    const vw = sw * SCALE, vh = sh * SCALE
    // assign colors by label
    const labelColors = {}
    let colorIdx = 0
    return (
      <div style={{ background:'var(--surface)',borderRadius:10,border:'1px solid var(--border-2)',padding:'12px 14px',marginBottom:8 }}>
        <div style={{ fontSize:13,fontWeight:700,marginBottom:8 }}>Sheet {idx+1}</div>
        <svg width={vw} height={vh} style={{ border:'1px solid var(--border-2)',borderRadius:6,background:'#F8F9FA',display:'block' }}>
          {sheet.pieces.map((p, i) => {
            if (!labelColors[p.label]) { labelColors[p.label] = SHEET_COLS[colorIdx++ % SHEET_COLS.length] }
            const color = labelColors[p.label]
            const x = p.x * SCALE, y = p.y * SCALE, w = p.origW * SCALE, h = p.origH * SCALE
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.7} stroke={color} strokeWidth={1}/>
                {w > 20 && h > 14 && (
                  <text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={Math.min(10,w/5)} fontWeight="700" fontFamily="system-ui">
                    {p.label.length > 8 ? p.label.slice(0,7)+'…' : p.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:8 }}>
          {[...new Set(sheet.pieces.map(p=>p.label))].map(label => {
            if (!labelColors[label]) labelColors[label] = SHEET_COLS[0]
            return (
              <span key={label} style={{ fontSize:11,padding:'2px 8px',borderRadius:99,fontWeight:600,background:labelColors[label]+'22',color:labelColors[label],border:`1px solid ${labelColors[label]}44` }}>
                {label}
              </span>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 20px 40px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Optimize cuts from full sheets. Default: 4×8 ft plywood (48"×96")</p>

      {/* Sheet dimensions */}
      <div style={{ display:'flex',gap:10,marginBottom:12 }}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:4}}>Sheet width (in)</div>
          <input className="form-input" value={sheetW} onChange={e=>setSheetW(e.target.value)} placeholder="48" style={{fontSize:14}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:4}}>Sheet height (in)</div>
          <input className="form-input" value={sheetH} onChange={e=>setSheetH(e.target.value)} placeholder="96" style={{fontSize:14}}/>
        </div>
        <div style={{width:80}}>
          <div style={{fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:4}}>Kerf (in)</div>
          <input className="form-input" type="number" step="0.0625" value={kerf} onChange={e=>setKerf(e.target.value)} style={{fontSize:14}}/>
        </div>
      </div>

      {/* Pieces */}
      <div style={{ background:'var(--surface)',borderRadius:12,border:'1px solid var(--border-2)',overflow:'hidden',marginBottom:12 }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 52px 1fr 26px',gap:6,padding:'6px 12px',borderBottom:'1px solid var(--border-2)',background:'var(--fill)' }}>
          {['Width','Height','Qty','Label',''].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:'var(--text-4)',textTransform:'uppercase',letterSpacing:'.5px'}}>{h}</div>)}
        </div>
        {cuts.map((c,i)=>(
          <div key={c.id} style={{ display:'grid',gridTemplateColumns:'1fr 1fr 52px 1fr 26px',gap:6,padding:'6px 12px',borderBottom:i<cuts.length-1?'1px solid var(--border-2)':'none',alignItems:'center' }}>
            <input className="form-input" value={c.w} onChange={e=>upd(c.id,'w',e.target.value)} placeholder='12"' style={{fontSize:13}}/>
            <input className="form-input" value={c.h} onChange={e=>upd(c.id,'h',e.target.value)} placeholder='24"' style={{fontSize:13}}/>
            <input className="form-input" type="number" min="1" value={c.qty} onChange={e=>upd(c.id,'qty',e.target.value)} style={{fontSize:13,textAlign:'center'}}/>
            <input className="form-input" value={c.label} onChange={e=>upd(c.id,'label',e.target.value)} placeholder="optional" style={{fontSize:13}}/>
            <button onClick={()=>setCuts(cc=>cc.filter(x=>x.id!==c.id))} disabled={cuts.length===1} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:16,padding:0,opacity:cuts.length===1?.3:1}}>×</button>
          </div>
        ))}
        <div style={{padding:'6px 12px'}}><button className="btn-text" onClick={addRow} style={{fontSize:13}}>+ Add piece</button></div>
      </div>

      {error && <div style={{background:'var(--red-dim)',color:'var(--red)',padding:'8px 12px',borderRadius:8,fontSize:13,marginBottom:10}}>{error}</div>}
      <button className="btn-primary" style={{width:'100%',justifyContent:'center',marginBottom:20}} onClick={calc}>Optimize sheets</button>

      {result && (
        <>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
            <div style={{background:NAVY,borderRadius:10,padding:'10px 16px',textAlign:'center'}}>
              <div style={{fontSize:32,fontWeight:900,color:'#fff'}}>{result.sheets.length}</div>
              <div style={{fontSize:12,color:'#8BA8D0'}}>sheet{result.sheets.length!==1?'s':''}</div>
            </div>
            <div style={{background:'var(--surface)',borderRadius:10,padding:'10px 16px',border:'1px solid var(--border-2)',textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:700,color:'var(--orange)'}}>{result.wastePct}%</div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>waste</div>
            </div>
            <div style={{flex:1,background:'var(--surface)',borderRadius:10,padding:'10px 16px',border:'1px solid var(--border-2)',textAlign:'center'}}>
              <div style={{fontSize:18,fontWeight:700}}>{(result.usedArea/144).toFixed(1)} ft²</div>
              <div style={{fontSize:11,color:'var(--text-3)'}}>material used</div>
            </div>
          </div>
          {result.sheets.map((sheet, i) => (
            <SheetDiagram key={i} sheet={sheet} sw={result.sw} sh={result.sh} idx={i}/>
          ))}
        </>
      )}
    </div>
  )
}

// ─── Tab: Advanced (Construction Master Pro functions) ────────────────────────
function AdvancedCalc() {
  const [mode, setMode] = useState('pitch')

  const modes = [
    { id:'pitch',  label:'Pitch / Rise / Run'  },
    { id:'diag',   label:'Diagonal'             },
    { id:'stairs', label:'Stairs'               },
    { id:'circle', label:'Circle / Arc'         },
    { id:'miter',  label:'Compound Miter'       },
  ]

  return (
    <div style={{ padding: '4px 20px 40px' }}>
      <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:18 }}>
        {modes.map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)} style={{
            padding:'6px 12px',borderRadius:99,border:'none',cursor:'pointer',
            fontFamily:'inherit',fontSize:12,fontWeight:600,
            background:mode===m.id?NAVY:'var(--fill)',
            color:mode===m.id?'#fff':'var(--text-3)',
          }}>{m.label}</button>
        ))}
      </div>
      {mode==='pitch'  && <PitchCalc/>}
      {mode==='diag'   && <DiagCalc/>}
      {mode==='stairs' && <StairCalc/>}
      {mode==='circle' && <CircleCalc/>}
      {mode==='miter'  && <MiterCalc/>}
    </div>
  )
}

function ResultBox({ label, value }) {
  return (
    <div className="result-box-light" style={{ flex: 1 }}>
      <div className="result-box-label">{label}</div>
      <div className="result-box-value">{value}</div>
    </div>
  )
}

function CalcInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1 }}>
      <div className="calc-label">{label}</div>
      <input className="calc-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || '—'} />
    </div>
  )
}

function PitchCalc() {
  const [pitch, setPitch] = useState(''), [rise, setRise] = useState(''), [run, setRun] = useState('')

  const p = parseFloat(pitch), ri = parseLenIn(rise), ru = parseLenIn(run)

  const calcPitch = ri && ru ? +(ri/ru*12).toFixed(4) : null
  const calcRise  = p && ru  ? inToFtInStr(p*ru/12)  : null
  const calcRun   = p && ri  ? inToFtInStr(ri*12/p)  : null
  const calcHyp   = ri && ru ? inToFtInStr(Math.sqrt(ri*ri+ru*ru)) : null
  const calcAngle = ri && ru ? (Math.atan(ri/ru)*180/Math.PI).toFixed(2)+'°' : null

  return (
    <div>
      <p style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>Enter any two values. Pitch = rise per 12" of run. Enter lengths as: 48, 4', 3'6"</p>
      <div style={{display:'flex',gap:10,marginBottom:10}}>
        <CalcInput label="Pitch (in 12)" value={pitch} onChange={setPitch} placeholder="6"/>
        <CalcInput label="Rise" value={rise} onChange={setRise} placeholder="4' 6&quot;"/>
        <CalcInput label="Run" value={run} onChange={setRun} placeholder="9'"/>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {calcPitch!==null && !pitch && <ResultBox label="Pitch (in 12)" value={calcPitch}/>}
        {calcRise  && !rise && <ResultBox label="Rise" value={calcRise}/>}
        {calcRun   && !run  && <ResultBox label="Run"  value={calcRun}/>}
        {calcHyp   && <ResultBox label="Rafter length" value={calcHyp}/>}
        {calcAngle && <ResultBox label="Angle" value={calcAngle}/>}
      </div>
    </div>
  )
}

function DiagCalc() {
  const [w, setW] = useState(''), [h, setH] = useState('')
  const wv = parseLenIn(w), hv = parseLenIn(h)
  const diag   = wv && hv ? inToFtInStr(Math.sqrt(wv*wv+hv*hv)) : null
  const angle  = wv && hv ? (Math.atan(hv/wv)*180/Math.PI).toFixed(2)+'°' : null
  const sq3_4_5 = wv && hv ? `3-4-5 check: ${inToFtInStr(wv)} × ${inToFtInStr(hv)} diag = ${diag}` : null
  return (
    <div>
      <p style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>Calculates diagonal of a rectangle. Use to check for square (3-4-5 method).</p>
      <div style={{display:'flex',gap:10,marginBottom:10}}>
        <CalcInput label="Width" value={w} onChange={setW} placeholder="8'"/>
        <CalcInput label="Height / Length" value={h} onChange={setH} placeholder="10'"/>
      </div>
      {diag && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <ResultBox label="Diagonal" value={diag}/>
          <ResultBox label="Corner angle" value={angle}/>
        </div>
      )}
      {diag && (
        <div style={{marginTop:12,background:'var(--fill)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'var(--text-3)'}}>
          To verify square: measure both diagonals — they must be equal ({diag}).
        </div>
      )}
    </div>
  )
}

function StairCalc() {
  const [totalRise, setTotalRise] = useState('')
  const [numRisers, setNumRisers] = useState('')
  const [treadW, setTreadW]       = useState('10')

  const tr = parseLenIn(totalRise), nr = parseInt(numRisers)||0, tw = parseFloat(treadW)||10
  const riserH   = tr && nr ? inToFtInStr(tr/nr) : null
  const riserDec = tr && nr ? tr/nr : null
  const stairRun = nr && tw ? inToFtInStr((nr-1)*tw) : null
  const angle    = riserDec && tw ? (Math.atan(riserDec/tw)*180/Math.PI).toFixed(1)+'°' : null
  const stringer = riserDec && tw ? inToFtInStr(Math.sqrt(riserDec*riserDec+tw*tw)*(nr-1)) : null
  const ok       = riserDec ? (riserDec >= 4 && riserDec <= 7.75) : null

  return (
    <div>
      <p style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>Standard rise: 7" max. Standard tread: 10–11". Rule of thumb: rise + tread = 17–18".</p>
      <div style={{display:'flex',gap:10,marginBottom:10,flexWrap:'wrap'}}>
        <CalcInput label="Total rise" value={totalRise} onChange={setTotalRise} placeholder="8' 4&quot;"/>
        <CalcInput label="Number of risers" value={numRisers} onChange={setNumRisers} placeholder="14"/>
        <CalcInput label="Tread width (in)" value={treadW} onChange={setTreadW} placeholder="10"/>
      </div>
      {riserH && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
          <ResultBox label="Riser height" value={riserH}/>
          <ResultBox label="Total run" value={stairRun||'—'}/>
          <ResultBox label="Stringer length" value={stringer||'—'}/>
          <ResultBox label="Stair angle" value={angle||'—'}/>
        </div>
      )}
      {ok !== null && (
        <div style={{ background: ok ? '#DCFCE7' : '#FEF3C7', borderRadius:8, padding:'8px 14px', fontSize:13, color: ok ? '#166534' : '#B45309' }}>
          {ok ? '✓ Riser height is within code (4"–7¾")' : `⚠ Riser height ${riserH} is outside typical code range (4"–7¾"). Adjust number of risers.`}
        </div>
      )}
    </div>
  )
}

function CircleCalc() {
  const [input, setInput] = useState('')
  const [inputType, setInputType] = useState('diameter')

  const v = parseLenIn(input)
  const r = v ? (inputType==='radius' ? v : inputType==='diameter' ? v/2 : inputType==='circumference' ? v/(2*Math.PI) : Math.sqrt(v/Math.PI)) : null
  const diameter = r ? inToFtInStr(r*2) : null
  const radius   = r ? inToFtInStr(r) : null
  const circ     = r ? inToFtInStr(r*2*Math.PI) : null
  const area     = r ? (r*r*Math.PI).toFixed(3)+' in²' : null

  return (
    <div>
      <p style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>Enter any one measurement. All others will be calculated.</p>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
        {['diameter','radius','circumference','area'].map(t=>(
          <button key={t} onClick={()=>setInputType(t)} style={{
            padding:'5px 10px',borderRadius:99,border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,
            background:inputType===t?FOREST:'var(--fill)',color:inputType===t?'#fff':'var(--text-3)',
          }}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>
      <CalcInput label={`Enter ${inputType}`} value={input} onChange={setInput} placeholder={inputType==='area'?'100 in²':"12\""}/>
      {r && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
          {inputType!=='diameter'     && <ResultBox label="Diameter"      value={diameter||'—'}/>}
          {inputType!=='radius'       && <ResultBox label="Radius"        value={radius||'—'}/>}
          {inputType!=='circumference'&& <ResultBox label="Circumference" value={circ||'—'}/>}
          {inputType!=='area'         && <ResultBox label="Area"          value={area||'—'}/>}
        </div>
      )}
    </div>
  )
}

function MiterCalc() {
  const [work, setWork]   = useState('')  // work angle (corner angle)
  const [tilt, setTilt]   = useState('')  // blade tilt from vertical

  const wa = parseFloat(work), bt = parseFloat(tilt)

  // Compound miter: given corner angle and blade tilt, find miter and bevel settings
  // Or given corner and desired miter, find bevel
  const cornerDeg = wa ? wa/2 : null  // half-angle at corner

  // Standard compound miter formulas:
  // miter angle = atan(cos(bladeTilt) * tan(cornerAngle))
  // bevel angle = atan(sin(cornerAngle) * sin(bladeTilt))
  const miter = (cornerDeg && bt) ? (Math.atan(Math.cos(bt*Math.PI/180)*Math.tan(cornerDeg*Math.PI/180))*180/Math.PI).toFixed(2)+'°' : null
  const bevel = (cornerDeg && bt) ? (Math.atan(Math.sin(cornerDeg*Math.PI/180)*Math.sin(bt*Math.PI/180))*180/Math.PI).toFixed(2)+'°' : null

  // Simple 2D miter (flat, no tilt)
  const flatMiter = cornerDeg ? (90-cornerDeg).toFixed(2)+'°' : null

  return (
    <div>
      <p style={{fontSize:12,color:'var(--text-4)',marginBottom:14}}>
        Corner angle: total angle of joint (90° for a box). Blade tilt: blade angle from vertical for compound cuts.
      </p>
      <div style={{display:'flex',gap:10,marginBottom:10}}>
        <CalcInput label="Corner angle (°)" value={work} onChange={setWork} placeholder="90"/>
        <CalcInput label="Blade tilt (°)" value={tilt} onChange={setTilt} placeholder="0 (flat)"/>
      </div>
      {cornerDeg && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <ResultBox label="Flat miter angle" value={flatMiter||'—'}/>
          {miter && <ResultBox label="Compound miter" value={miter}/>}
          {bevel && <ResultBox label="Blade bevel" value={bevel}/>}
        </div>
      )}
      {cornerDeg && (
        <div style={{marginTop:10,background:'var(--fill)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--text-3)'}}>
          For a standard 90° box (4 sides): set miter to 45°, bevel to 0°. <br/>
          For a 90° corner with sloped sides: enter blade tilt above.
        </div>
      )}
    </div>
  )
}

// ─── Tab: Notes ───────────────────────────────────────────────────────────────
function CalcNotes() {
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem('calc-notes') || '' } catch { return '' }
  })
  const save = (v) => {
    setNotes(v)
    try { localStorage.setItem('calc-notes', v) } catch {}
  }
  return (
    <div style={{ padding: '4px 20px 40px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 12 }}>Scratch pad — auto-saves locally.</p>
      <textarea
        className="form-textarea"
        value={notes}
        onChange={e => save(e.target.value)}
        placeholder={"Measurements, cut lists, reminders...\n\nDimensional lumber actual sizes:\n  2×4 = 1.5\" × 3.5\"\n  2×6 = 1.5\" × 5.5\"\n  1×4 = 0.75\" × 3.5\"\n  1×6 = 0.75\" × 5.5\""}
        style={{ width: '100%', minHeight: 300, fontSize: 14, lineHeight: 1.7, resize: 'vertical' }}
      />
      {notes && (
        <button className="btn-text" style={{ marginTop: 8, color: 'var(--red)' }} onClick={() => { if (window.confirm('Clear notes?')) save('') }}>
          Clear notes
        </button>
      )}
    </div>
  )
}

// ─── Main Calculators page ────────────────────────────────────────────────────
const TABS = [
  { id:'boardfoot', label:'Board Foot' },
  { id:'fractions', label:'Fractions'  },
  { id:'converter', label:'Converter'  },
  { id:'trim',      label:'Trim Cuts'  },
  { id:'sheet',     label:'Sheet Goods'},
  { id:'advanced',  label:'Advanced'   },
  { id:'notes',     label:'Notes'      },
]

export default function Calculators() {
  const [tab, setTab] = useState('boardfoot')
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ paddingBottom: 0 }}>
        <h1 className="page-title">Calculators</h1>
        {/* Tab bar */}
        <div className="page-tabs" style={{ marginTop: 12 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`page-tab ${tab === t.id ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-page" style={{ paddingTop: 16 }}>
        {tab === 'boardfoot' && <BoardFoot/>}
        {tab === 'fractions' && <FractionCalc/>}
        {tab === 'converter' && <UnitConverter/>}
        {tab === 'trim'      && <TrimCuts/>}
        {tab === 'sheet'     && <SheetGoods/>}
        {tab === 'advanced'  && <AdvancedCalc/>}
        {tab === 'notes'     && <CalcNotes/>}
      </div>
    </div>
  )
}
