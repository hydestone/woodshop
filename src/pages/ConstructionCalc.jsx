import { useState, useCallback, useMemo, useRef, useEffect } from 'react'

// ─── Math utilities (unchanged from original) ─────────────────────────────────
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
  // feet-inch-fraction: 6'4" 1/8 or 6' 4 1/8"
  const ftInFrac = s.match(/^(-?\d+(?:\.\d+)?)[''\u2019]\s*(\d+)\s*"?\s+(\d+)\/(\d+)\s*"?$/)
  if (ftInFrac) {
    const ft = parseFloat(ftInFrac[1]), ins = parseInt(ftInFrac[2])
    const num = parseInt(ftInFrac[3]), den = parseInt(ftInFrac[4])
    return fracReduce(Math.round((ft * 12 + ins + num / den) * 64), 64)
  }
  // feet-inch: 4'6" or 4' 6 1/2" or 4' 6
  const ftIn = s.match(/^(-?\d+(?:\.\d+)?)[''\u2019]\s*(\d+(?:\s+\d+\/\d+)?)\s*"?\s*$/)
  if (ftIn) {
    const ft = parseFloat(ftIn[1])
    const inPart = parseFracObj(ftIn[2].trim())
    if (inPart) return fracReduce(Math.round((ft * 12 + fracToDecimal(inPart)) * 64), 64)
    return fracReduce(Math.round(ft * 12 * 64), 64)
  }
  // feet only: 4'
  const ftOnly = s.match(/^(-?\d+(?:\.\d+)?)[''\u2019]\s*$/)
  if (ftOnly) return fracReduce(Math.round(parseFloat(ftOnly[1]) * 12 * 64), 64)
  // mixed: 3 1/2
  const m = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (m) { const sign = +m[1] < 0 ? -1 : 1; return fracReduce(+m[1] * +m[3] + sign * +m[2], +m[3]) }
  // fraction: 3/4
  const f = s.match(/^(-?\d+)\/(\d+)$/)
  if (f) return fracReduce(+f[1], +f[2])
  // decimal
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
      {(w === 0 || r !== 0) && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: fontSize * 0.6, lineHeight: 1 }}>
          <span style={{ borderBottom: '1.5px solid currentColor', paddingBottom: 1 }}>{w === 0 && n < 0 ? '-' : ''}{r || Math.abs(n)}</span>
          <span style={{ paddingTop: 1 }}>{d}</span>
        </span>
      )}
    </span>
  )
}

function inchToFrac(dec, den = 16) {
  const neg = dec < 0; dec = Math.abs(dec)
  const w = Math.floor(dec), f = dec - w
  const n = Math.round(f * den)
  if (n === 0) return { w: neg ? -w : w, n: 0, d: den }
  if (n === den) return { w: neg ? -(w + 1) : w + 1, n: 0, d: den }
  const g = gcd(n, den)
  return { w: neg ? -w : w, n: n / g, d: den / g }
}

function decToFracStr(dec, den = 16) {
  const { w, n, d } = inchToFrac(Math.abs(dec), den)
  const sign = dec < 0 ? '-' : ''
  if (n === 0) return `${sign}${w}"`
  if (w === 0) return `${sign}${n}/${d}"`
  return `${sign}${w} ${n}/${d}"`
}

function inToFtInStr(inches) {
  const neg = inches < 0; inches = Math.abs(inches)
  const ft = Math.floor(inches / 12), ins = inches % 12
  const pref = neg ? '-' : ''
  if (ft === 0) return pref + decToFracStr(ins)
  if (ins < 0.002) return `${pref}${ft}'`
  return `${pref}${ft}' ${decToFracStr(ins)}`
}

function ftInToHTML(inches, style = {}) {
  const neg = inches < 0; inches = Math.abs(inches)
  const ft = Math.floor(inches / 12), ins = inches % 12
  const { w, n, d } = inchToFrac(ins, 16)
  const fontSize = style.fontSize || 36
  const pref = neg ? '-' : ''
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, ...style }}>
      {pref}
      {ft > 0 && <><span style={{ fontSize }}>{ft}</span><span style={{ fontSize: fontSize * 0.55, opacity: 0.7 }}>'</span><span style={{ width: 4 }} /></>}
      {(w > 0 || (ft === 0 && n === 0)) && <span style={{ fontSize }}>{w}</span>}
      {n > 0 && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: fontSize * 0.5, lineHeight: 1, marginLeft: 2 }}>
          <span style={{ borderBottom: '1.5px solid currentColor', paddingBottom: 1 }}>{n}</span>
          <span style={{ paddingTop: 1 }}>{d}</span>
        </span>
      )}
      <span style={{ fontSize: fontSize * 0.55, opacity: 0.7 }}>"</span>
    </span>
  )
}

function parseLenIn(s) {
  const f = parseFracObj(s)
  return f ? fracToDecimal(f) : null
}

// ─── Construction Calculator ─────────────────────────────────────────────────

const HISTORY_KEY = 'calc-cm-history'
const MEMORY_KEY  = 'calc-cm-memory'

function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] } }
function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 40))) } catch {} }
function loadMemory() { try { const m = localStorage.getItem(MEMORY_KEY); return m ? JSON.parse(m) : null } catch { return null } }
function saveMemory(m) { try { if (m) localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); else localStorage.removeItem(MEMORY_KEY) } catch {} }

// ─── Sub-components ───────────────────────────────────────────────────────────
function ConPanel({ title, hint, children }) {
  return (
    <div className="cm-con-panel">
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)', marginBottom: 4 }}>{title}</div>
      {hint && <p style={{ fontSize: 11, color: 'var(--c-text-faint)', marginBottom: 10, lineHeight: 1.5 }}>{hint}</p>}
      {children}
    </div>
  )
}

function ConInput({ label, value, onSet, computed, isLen }) {
  const displayVal = computed
    ? (isLen ? inToFtInStr(computed) : String(computed))
    : value != null ? (isLen ? inToFtInStr(value) : String(value)) : null
  const isComputed = computed && !value
  return (
    <div className="cm-con-input-wrap">
      <div style={{ fontSize: 11, color: 'var(--c-text-faint)', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div className={`cm-con-value${isComputed ? ' computed' : ''}${displayVal ? ' has-value' : ''}`}>
          {displayVal || '—'}
        </div>
        <button className="cm-con-set-btn" onClick={onSet}>Set</button>
      </div>
    </div>
  )
}

function ConResult({ label, value }) {
  return (
    <div className="cm-con-result-item">
      <span style={{ fontSize: 11, color: 'var(--c-text-faint)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--forest)' }}>{value}</span>
    </div>
  )
}

function HelpItem({ title, desc }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)', marginBottom: 2 }}>{title}</div>
      <p style={{ fontSize: 12, color: 'var(--c-text-muted)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
    </div>
  )
}

// ─── Tape row ─────────────────────────────────────────────────────────────────
function TapeRow({ entry, onClick }) {
  const lhsStr = inToFtInStr(fracToDecimal(entry.left))
  const rhsStr = inToFtInStr(fracToDecimal(entry.right))
  const resStr = inToFtInStr(fracToDecimal(entry.result))
  return (
    <button onClick={onClick} style={{ display: 'contents', cursor: 'pointer', background: 'none', border: 'none', width: '100%' }}>
      <div className="cm-tape-row">
        <span className="cm-tape-dim">{lhsStr} {entry.op} {rhsStr}</span>
        <span style={{ whiteSpace: 'nowrap', fontSize: 10, color: 'var(--calc-tape-dim)' }}>tap to recall</span>
      </div>
      <div className="cm-tape-row tape-result">
        <span className="cm-tape-dim">= </span>
        <span className="tape-val">{resStr}</span>
      </div>
    </button>
  )
}

// ─── SVG visualizations ───────────────────────────────────────────────────────
function PitchViz({ rise, run }) {
  const scale = 120 / Math.max(rise, run)
  const rW = Math.round(run * scale), rH = Math.round(rise * scale)
  const pad = 30
  return (
    <svg viewBox={`0 0 ${rW + pad * 2} ${rH + pad * 2}`} style={{ width: '100%', maxHeight: 120, margin: '10px 0' }}>
      <polygon points={`${pad},${rH + pad} ${rW + pad},${rH + pad} ${pad},${pad}`} fill="rgba(74,222,128,.08)" stroke="rgba(74,222,128,.6)" strokeWidth="1.5" />
      <text x={pad + rW / 2} y={rH + pad + 16} textAnchor="middle" fill="var(--c-text-muted)" fontSize="10" fontFamily="system-ui">Run: {inToFtInStr(run)}</text>
      <text x={pad - 14} y={pad + rH / 2} textAnchor="middle" fill="var(--c-text-muted)" fontSize="10" fontFamily="system-ui" transform={`rotate(-90,${pad - 14},${pad + rH / 2})`}>Rise: {inToFtInStr(rise)}</text>
      <text x={pad + rW / 2 + 8} y={pad + rH / 2 - 4} textAnchor="middle" fill="#4ADE80" fontSize="10" fontWeight="700" fontFamily="system-ui" transform={`rotate(${-Math.atan(rise / run) * 180 / Math.PI},${pad + rW / 2 + 8},${pad + rH / 2 - 4})`}>
        Rafter: {inToFtInStr(Math.sqrt(rise * rise + run * run))}
      </text>
      <polyline points={`${pad + 12},${rH + pad} ${pad + 12},${rH + pad - 12} ${pad},${rH + pad - 12}`} fill="none" stroke="var(--c-text-faint)" strokeWidth="1" />
    </svg>
  )
}

function DiagViz({ w, h }) {
  const scale = 100 / Math.max(w, h)
  const rW = Math.round(w * scale), rH = Math.round(h * scale)
  const pad = 24
  return (
    <svg viewBox={`0 0 ${rW + pad * 2} ${rH + pad * 2}`} style={{ width: '100%', maxHeight: 100, margin: '10px 0' }}>
      <rect x={pad} y={pad} width={rW} height={rH} fill="none" stroke="var(--c-text-faint)" strokeWidth="1" strokeDasharray="4,3" />
      <line x1={pad} y1={rH + pad} x2={rW + pad} y2={pad} stroke="#4ADE80" strokeWidth="1.5" />
      <text x={pad + rW / 2} y={rH + pad + 14} textAnchor="middle" fill="var(--c-text-muted)" fontSize="10" fontFamily="system-ui">{inToFtInStr(w)}</text>
      <text x={pad + rW / 2 + 6} y={pad + rH / 2 - 4} textAnchor="middle" fill="#4ADE80" fontSize="10" fontWeight="700" fontFamily="system-ui">{inToFtInStr(Math.sqrt(w * w + h * h))}</text>
    </svg>
  )
}

function StairsViz({ riserH, tread, numRisers }) {
  const n = Math.min(numRisers, 8)
  const stepW = 22, stepH = 16
  const w = n * stepW + 40, h = n * stepH + 40
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxHeight: 120, margin: '10px 0' }}>
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <rect x={20 + i * stepW} y={h - 20 - (i + 1) * stepH} width={stepW} height={stepH}
            fill="rgba(74,222,128,.08)" stroke="rgba(74,222,128,.5)" strokeWidth="1" />
        </g>
      ))}
      <text x={12} y={h - 20 - stepH / 2} textAnchor="middle" fill="var(--c-text-faint)" fontSize="8" fontFamily="system-ui" transform={`rotate(-90,12,${h - 20 - stepH / 2})`}>{decToFracStr(riserH)}</text>
      <text x={20 + stepW / 2} y={h - 10} textAnchor="middle" fill="var(--c-text-faint)" fontSize="8" fontFamily="system-ui">{tread}"</text>
    </svg>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ConstructionCalc() {
  const [display, setDisplay]       = useState('')
  const [left, setLeft]             = useState(null)
  const [op, setOp]                 = useState(null)
  const [result, setResult]         = useState(null)
  const [justEvaled, setJustEvaled] = useState(false)
  const [memory, setMemoryState]    = useState(() => loadMemory())
  const [history, setHistoryState]  = useState(() => loadHistory())
  const [conState, setConState]     = useState({})
  const [conMode, setConMode]       = useState(null)
  const [showHelp, setShowHelp]     = useState(false)
  const containerRef = useRef(null)

  const setMemory = v => { setMemoryState(v); saveMemory(v) }
  const setHistory = h => { setHistoryState(h); saveHistory(h) }

  const parsedDisplay = useMemo(() => display ? parseFracObj(display) : null, [display])
  const activeVal = result || parsedDisplay

  // ── Core operations ──────────────────────────────────────────────────────
  const appendDigit = useCallback(d => {
    setResult(null)
    if (justEvaled) { setDisplay(d); setJustEvaled(false); return }
    setDisplay(prev => {
      if (d === '.' && prev.includes('.') && !prev.includes("'")) return prev
      return prev + d
    })
  }, [justEvaled])

  const appendChar = useCallback(c => {
    setResult(null); setJustEvaled(false)
    setDisplay(prev => {
      // Auto-space before " if display has ' but no space yet (e.g. "6'4" → "6'4 ")
      if (c === '"' && prev.includes("'") && !prev.endsWith(' ') && !prev.endsWith('"')) {
        return prev + ' ' + c
      }
      // Auto-space before fraction if display has " (e.g. 6'4" → "6'4" 1")
      if (c === '/' && prev.includes('"') && !prev.endsWith(' ')) {
        return prev.replace('"', '') + ' ' + c
      }
      return prev + c
    })
  }, [])

  const setDenominator = useCallback(den => {
    setResult(null); setJustEvaled(false)
    setDisplay(prev => {
      if (!prev) return `1/${den}`
      // ft/in context: ends with whole number after ' or "  e.g. "6'4 \"1" or "6' 1"
      if (prev.match(/['"\s](\d+)$/)) return prev.replace(/(\d+)$/, `$1/${den}`)
      if (prev.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)) return prev.replace(/\/\d+$/, `/${den}`)
      if (prev.match(/^(\d+)\/(\d+)$/)) return `${prev.split('/')[0]}/${den}`
      if (prev.match(/^(-?\d+)$/)) return `${prev}/${den}`
      return prev
    })
  }, [])

  const pressOp = useCallback(newOp => {
    setResult(null); setJustEvaled(false)
    const val = result || parsedDisplay
    if (val) { setLeft(val); setOp(newOp); setDisplay('') }
    else if (left) { setOp(newOp) }
  }, [result, parsedDisplay, left])

  const pressEquals = useCallback(() => {
    const rhs = parsedDisplay, lhs = left
    if (!rhs || !lhs || !op) return
    let res
    if (op === '+') res = fracAdd(lhs, rhs)
    else if (op === '−') res = fracSub(lhs, rhs)
    else if (op === '×') res = fracMul(lhs, rhs)
    else if (op === '÷') res = fracDiv(lhs, rhs)
    if (res) {
      const entry = { left: lhs, op, right: rhs, result: res, ts: Date.now() }
      setHistory(h => { const next = [entry, ...h].slice(0, 40); saveHistory(next); return next })
      setResult(res); setLeft(res); setOp(null); setDisplay(''); setJustEvaled(true)
    }
  }, [parsedDisplay, left, op])

  const pressAC = useCallback(() => {
    setDisplay(''); setLeft(null); setOp(null); setResult(null); setJustEvaled(false)
  }, [])

  const pressBackspace = useCallback(() => {
    setResult(null); setJustEvaled(false)
    setDisplay(prev => prev.slice(0, -1))
  }, [])

  const pressSqrt = useCallback(() => {
    const v = activeVal; if (!v) return
    const dec = fracToDecimal(v)
    if (dec < 0) return
    const r = fracReduce(Math.round(Math.sqrt(dec) * 64), 64)
    const entry = { left: v, op: '√', right: { n: 1, d: 1 }, result: r, ts: Date.now() }
    setHistory(h => { const next = [entry, ...h].slice(0, 40); saveHistory(next); return next })
    setResult(r); setLeft(r); setOp(null); setDisplay(''); setJustEvaled(true)
  }, [activeVal])

  const pressSq = useCallback(() => {
    const v = activeVal; if (!v) return
    const r = fracMul(v, v)
    const entry = { left: v, op: 'x²', right: v, result: r, ts: Date.now() }
    setHistory(h => { const next = [entry, ...h].slice(0, 40); saveHistory(next); return next })
    setResult(r); setLeft(r); setOp(null); setDisplay(''); setJustEvaled(true)
  }, [activeVal])

  const pressPi = useCallback(() => {
    const pi = fracReduce(Math.round(Math.PI * 64), 64)
    setResult(pi); setLeft(pi); setOp(null); setDisplay(''); setJustEvaled(true)
  }, [])

  // ── Memory ───────────────────────────────────────────────────────────────
  const memAdd = () => { const v = activeVal; if (!v) return; setMemory(memory ? fracAdd(memory, v) : v) }
  const memSub = () => { const v = activeVal; if (!v) return; setMemory(memory ? fracSub(memory, v) : { n: -v.n, d: v.d }) }
  const memRecall = () => { if (!memory) return; setResult(memory); setJustEvaled(true) }
  const memClear = () => setMemory(null)

  // ── Keyboard handler ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      // Don't capture if user is typing in an input elsewhere
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key
      if (k >= '0' && k <= '9') { e.preventDefault(); appendDigit(k) }
      else if (k === '.') { e.preventDefault(); appendDigit('.') }
      else if (k === '+') { e.preventDefault(); pressOp('+') }
      else if (k === '-' || k === '−') { e.preventDefault(); pressOp('−') }
      else if (k === '*') { e.preventDefault(); pressOp('×') }
      else if (k === '/') { e.preventDefault(); appendChar('/') }
      else if (k === 'Enter' || k === '=') { e.preventDefault(); pressEquals() }
      else if (k === 'Backspace') { e.preventDefault(); pressBackspace() }
      else if (k === 'Escape') { e.preventDefault(); pressAC() }
      else if (k === "'") { e.preventDefault(); appendChar("'") }
      else if (k === '"') { e.preventDefault(); appendChar('"') }
      else if (k === 'p' || k === 'P') { e.preventDefault(); pressPi() }
      else if (k === 'r' || k === 'R') { e.preventDefault(); pressSqrt() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [appendDigit, appendChar, pressOp, pressEquals, pressBackspace, pressAC, pressPi, pressSqrt])

  // ── Construction functions ────────────────────────────────────────────────
  const setConVal = (mode, key) => {
    const v = activeVal; if (!v) return
    setConState(prev => ({ ...prev, [`${mode}_${key}`]: fracToDecimal(v) }))
    pressAC()
  }

  const conResults = useMemo(() => {
    const s = conState, r = {}
    const pitch = s.pitch_pitch, rise = s.pitch_rise, run = s.pitch_run
    if (rise && run) { r.pitch_pitch = +(rise / run * 12).toFixed(3); r.pitch_rafter = Math.sqrt(rise*rise+run*run); r.pitch_angle = (Math.atan(rise/run)*180/Math.PI).toFixed(1)+'°' }
    if (pitch && run && !rise) r.pitch_rise = pitch * run / 12
    if (pitch && rise && !run) r.pitch_run = rise * 12 / pitch
    if (pitch && run) r.pitch_rafter = Math.sqrt(Math.pow(pitch*run/12,2)+run*run)
    if (pitch) r.pitch_angle = (Math.atan(pitch/12)*180/Math.PI).toFixed(1)+'°'
    const dw = s.diag_width, dh = s.diag_height
    if (dw && dh) { r.diag_diagonal = Math.sqrt(dw*dw+dh*dh); r.diag_angle = (Math.atan(dh/dw)*180/Math.PI).toFixed(1)+'°' }
    const totalRise = s.stairs_rise, numRisers = s.stairs_risers, treadW = s.stairs_tread || 10
    if (totalRise && numRisers) { const rH = totalRise/numRisers; r.stairs_riserH = rH; r.stairs_run = (numRisers-1)*treadW; r.stairs_angle = (Math.atan(rH/treadW)*180/Math.PI).toFixed(1)+'°'; r.stairs_ok = rH>=4 && rH<=7.75 }
    const circR = s.circle_radius, circD = s.circle_diameter, circC = s.circle_circ
    let cr = circR || (circD&&circD/2) || (circC&&circC/(2*Math.PI))
    if (cr) { r.circle_radius=cr; r.circle_diameter=cr*2; r.circle_circ=cr*2*Math.PI; r.circle_area=(cr*cr*Math.PI).toFixed(2)+' in²' }
    const corner = s.miter_corner, tilt = s.miter_tilt
    if (corner) { const half=corner/2; r.miter_flat=(90-half).toFixed(2)+'°'; if (tilt!=null) { r.miter_comp=(Math.atan(Math.cos(tilt*Math.PI/180)*Math.tan(half*Math.PI/180))*180/Math.PI).toFixed(2)+'°'; r.miter_bevel=(Math.atan(Math.sin(half*Math.PI/180)*Math.sin(tilt*Math.PI/180))*180/Math.PI).toFixed(2)+'°' } }
    return r
  }, [conState])

  // ── Display ──────────────────────────────────────────────────────────────
  const displayStr = result
    ? inToFtInStr(fracToDecimal(result))
    : display || '0'

  const eqStr = [
    left ? inToFtInStr(fracToDecimal(left)) : '',
    op || '',
    (!result && parsedDisplay && op) ? inToFtInStr(fracToDecimal(parsedDisplay)) : '',
  ].filter(Boolean).join(' ')

  const Btn = ({ children, cls = '', style = {}, onClick, ...rest }) => (
    <button className={`cm-key ${cls}`} onClick={onClick} style={style} {...rest}>{children}</button>
  )

  return (
    <div className="cm-outer">

      {/* ── Left: Calculator ── */}
      <div ref={containerRef} className="cm-left">

        {/* Display */}
        <div className="cm-display">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, minHeight: 16 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {memory && <span className="cm-indicator">M</span>}
              {conMode && <span className="cm-indicator" style={{ background: 'rgba(74,222,128,.15)', color: '#4ADE80' }}>{conMode.toUpperCase()}</span>}
            </div>
            <div className="cm-display-eq">{eqStr || '\u00a0'}</div>
          </div>
          <div className="cm-display-main">{displayStr}</div>
          <div className="cm-display-sub">
            {activeVal ? `${fracToDecimal(activeVal).toFixed(4)}"  ${(fracToDecimal(activeVal)*25.4).toFixed(2)}mm` : '\u00a0'}
          </div>
        </div>

        {/* Memory bar */}
        <div className="cm-memory-bar">
          <button className="cm-mem-btn" onClick={memAdd}>M+</button>
          <button className="cm-mem-btn" onClick={memSub}>M−</button>
          <button className="cm-mem-btn" onClick={memRecall} disabled={!memory}>MR</button>
          <button className="cm-mem-btn" onClick={memClear} disabled={!memory}>MC</button>
        </div>

        {/* Keypad + construction column side by side */}
        <div style={{ display: 'flex', gap: 3, flex: '0 0 auto' }}>

          {/* Left: digits/ops + fraction row */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Main 5-row keypad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 2px repeat(2,1fr)', gap: 3 }}>
              <Btn onClick={() => appendDigit('7')}>7</Btn>
              <Btn onClick={() => appendDigit('8')}>8</Btn>
              <Btn onClick={() => appendDigit('9')}>9</Btn>
              <div style={{ background: 'rgba(255,255,255,.06)' }} />
              <Btn cls="op" onClick={() => pressOp('÷')}>÷</Btn>
              <Btn cls="ac" onClick={pressAC}>AC</Btn>

              <Btn onClick={() => appendDigit('4')}>4</Btn>
              <Btn onClick={() => appendDigit('5')}>5</Btn>
              <Btn onClick={() => appendDigit('6')}>6</Btn>
              <div style={{ background: 'rgba(255,255,255,.06)' }} />
              <Btn cls="op" onClick={() => pressOp('×')}>×</Btn>
              <Btn cls="del" onClick={pressBackspace}>⌫</Btn>

              <Btn onClick={() => appendDigit('1')}>1</Btn>
              <Btn onClick={() => appendDigit('2')}>2</Btn>
              <Btn onClick={() => appendDigit('3')}>3</Btn>
              <div style={{ background: 'rgba(255,255,255,.06)' }} />
              <Btn cls="op" onClick={() => pressOp('−')}>−</Btn>
              <Btn cls="unit" onClick={() => appendChar("'")} title="feet">ft '</Btn>

              <Btn onClick={() => appendDigit('0')}>0</Btn>
              <Btn onClick={() => appendDigit('.')}>.</Btn>
              <Btn cls="unit" onClick={() => appendChar('/')} title="fraction slash">/</Btn>
              <div style={{ background: 'rgba(255,255,255,.06)' }} />
              <Btn cls="op" onClick={() => pressOp('+')}>+</Btn>
              <Btn cls="unit" onClick={() => appendChar('"')} title="inches">in "</Btn>

              <Btn cls="fn" onClick={pressSqrt} title="Square root (R)">√</Btn>
              <Btn cls="fn" onClick={pressSq} title="Square">x²</Btn>
              <Btn cls="fn" onClick={pressPi} title="Pi (P)">π</Btn>
              <div style={{ background: 'rgba(255,255,255,.06)' }} />
              <Btn cls="eq" onClick={pressEquals} style={{ gridColumn: 'span 2' }}>=</Btn>
            </div>

            {/* Fraction denominators */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 3 }}>
              {[2,4,8,16].map(d => (
                <Btn key={d} cls="frac" onClick={() => setDenominator(d)}>/{d}</Btn>
              ))}
            </div>
          </div>

          {/* Thin vertical separator */}
          <div style={{ width: 2, background: 'rgba(255,255,255,.06)', flexShrink: 0 }} />

          {/* Right: 6 construction function buttons in a single column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: 52, flexShrink: 0 }}>
            {[
              ['pitch',  '△', 'Pitch'],
              ['diag',   '▭', 'Diag'],
              ['stairs', '▤', 'Stair'],
              ['circle', '○', 'Circle'],
              ['miter',  '∠', 'Miter'],
              ['help',   '?', 'Help'],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                onClick={() => id === 'help' ? setShowHelp(h => !h) : setConMode(conMode === id ? null : id)}
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                  background: (id !== 'help' && conMode === id)
                    ? 'rgba(45,90,61,.4)'
                    : id === 'help' && showHelp
                      ? 'rgba(37,99,235,.2)'
                      : 'var(--calc-key2)',
                  border: (id !== 'help' && conMode === id)
                    ? '1px solid var(--forest)'
                    : id === 'help' && showHelp
                      ? '1px solid var(--accent)'
                      : '1px solid rgba(255,255,255,.08)',
                  cursor: 'pointer',
                  padding: '2px 2px',
                  minHeight: 0,
                  color: (id !== 'help' && conMode === id) ? 'var(--forest)' : id === 'help' && showHelp ? 'var(--accent)' : '#ffffff',
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.3px', lineHeight: 1 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Construction function panels */}
        <div style={{ overflowY: 'auto', flex: 1, marginTop: 6 }}>

          {conMode === 'pitch' && (
            <ConPanel title="Pitch · Rise · Run" hint="Enter any two values to solve.">
              <div className="cm-con-inputs">
                <ConInput label="Pitch (in 12)" value={conState.pitch_pitch} onSet={() => setConVal('pitch','pitch')} computed={!conState.pitch_pitch && conResults.pitch_pitch} />
                <ConInput label="Rise" value={conState.pitch_rise} onSet={() => setConVal('pitch','rise')} computed={!conState.pitch_rise && conResults.pitch_rise} isLen />
                <ConInput label="Run" value={conState.pitch_run} onSet={() => setConVal('pitch','run')} computed={!conState.pitch_run && conResults.pitch_run} isLen />
              </div>
              {(conResults.pitch_rafter||conResults.pitch_angle) && <div className="cm-con-results">{conResults.pitch_rafter && <ConResult label="Rafter" value={inToFtInStr(conResults.pitch_rafter)} />}{conResults.pitch_angle && <ConResult label="Angle" value={conResults.pitch_angle} />}</div>}
              {conState.pitch_rise && conState.pitch_run && <PitchViz rise={conState.pitch_rise} run={conState.pitch_run} />}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n={...s}; delete n.pitch_pitch; delete n.pitch_rise; delete n.pitch_run; return n })}>Clear pitch</button>
            </ConPanel>
          )}
          {conMode === 'diag' && (
            <ConPanel title="Diagonal · Squaring" hint="Enter width and height.">
              <div className="cm-con-inputs">
                <ConInput label="Width" value={conState.diag_width} onSet={() => setConVal('diag','width')} />
                <ConInput label="Height" value={conState.diag_height} onSet={() => setConVal('diag','height')} />
              </div>
              {(conResults.diag_diagonal||conResults.diag_angle) && <div className="cm-con-results">{conResults.diag_diagonal && <ConResult label="Diagonal" value={inToFtInStr(conResults.diag_diagonal)} />}{conResults.diag_angle && <ConResult label="Angle" value={conResults.diag_angle} />}</div>}
              {conState.diag_width && conState.diag_height && <DiagViz w={conState.diag_width} h={conState.diag_height} />}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n={...s}; delete n.diag_width; delete n.diag_height; return n })}>Clear diagonal</button>
            </ConPanel>
          )}
          {conMode === 'stairs' && (
            <ConPanel title="Stairs" hint='Code: 4"–7¾" riser, 10–11" tread.'>
              <div className="cm-con-inputs">
                <ConInput label="Total rise" value={conState.stairs_rise} onSet={() => setConVal('stairs','rise')} isLen />
                <ConInput label="# Risers" value={conState.stairs_risers} onSet={() => setConVal('stairs','risers')} />
                <ConInput label="Tread (in)" value={conState.stairs_tread} onSet={() => setConVal('stairs','tread')} />
              </div>
              {conResults.stairs_riserH && <div className="cm-con-results"><ConResult label="Riser height" value={inToFtInStr(conResults.stairs_riserH)} />{conResults.stairs_run && <ConResult label="Total run" value={inToFtInStr(conResults.stairs_run)} />}{conResults.stairs_angle && <ConResult label="Angle" value={conResults.stairs_angle} />}</div>}
              {conResults.stairs_ok !== undefined && <div style={{ marginTop: 8, background: conResults.stairs_ok ? 'var(--green-dim)' : 'var(--orange-dim)', borderRadius: 0, borderLeft: '3px solid currentColor', padding: '8px 12px', fontSize: 13, color: conResults.stairs_ok ? 'var(--green)' : 'var(--orange)' }}>{conResults.stairs_ok ? '✓ Within code (4"–7¾")' : '⚠ Outside code range'}</div>}
              {conResults.stairs_riserH && conState.stairs_risers && <StairsViz riserH={conResults.stairs_riserH} tread={conState.stairs_tread||10} numRisers={Math.min(conState.stairs_risers,8)} />}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n={...s}; delete n.stairs_rise; delete n.stairs_risers; delete n.stairs_tread; return n })}>Clear stairs</button>
            </ConPanel>
          )}
          {conMode === 'circle' && (
            <ConPanel title="Circle · Arc" hint="Enter radius, diameter, or circumference.">
              <div className="cm-con-inputs">
                <ConInput label="Radius" value={conState.circle_radius} onSet={() => setConVal('circle','radius')} computed={!conState.circle_radius && conResults.circle_radius} isLen />
                <ConInput label="Diameter" value={conState.circle_diameter} onSet={() => setConVal('circle','diameter')} computed={!conState.circle_diameter && conResults.circle_diameter} isLen />
                <ConInput label="Circumference" value={conState.circle_circ} onSet={() => setConVal('circle','circ')} computed={!conState.circle_circ && conResults.circle_circ} isLen />
              </div>
              {conResults.circle_area && <div className="cm-con-results"><ConResult label="Area" value={conResults.circle_area} /></div>}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n={...s}; delete n.circle_radius; delete n.circle_diameter; delete n.circle_circ; return n })}>Clear circle</button>
            </ConPanel>
          )}
          {conMode === 'miter' && (
            <ConPanel title="Compound Miter" hint="Corner angle: total joint angle. Blade tilt: degrees from vertical.">
              <div className="cm-con-inputs">
                <ConInput label="Corner (°)" value={conState.miter_corner} onSet={() => setConVal('miter','corner')} />
                <ConInput label="Tilt (°)" value={conState.miter_tilt} onSet={() => setConVal('miter','tilt')} />
              </div>
              {(conResults.miter_flat||conResults.miter_comp) && <div className="cm-con-results">{conResults.miter_flat && <ConResult label="Flat miter" value={conResults.miter_flat} />}{conResults.miter_comp && <ConResult label="Comp. miter" value={conResults.miter_comp} />}{conResults.miter_bevel && <ConResult label="Blade bevel" value={conResults.miter_bevel} />}</div>}
              <button className="cm-con-clear" onClick={() => setConState(s => { const n={...s}; delete n.miter_corner; delete n.miter_tilt; return n })}>Clear miter</button>
            </ConPanel>
          )}
          {showHelp && (
            <ConPanel title="Help">
              <div className="cm-help-grid">
                <HelpItem title="Feet-Inch-Fraction" desc="Example: 6'4 1/8&quot; → tap 6, ft', 4, in&quot;, 1, /8. The /2 /4 /8 /16 buttons set the denominator of the last digit." />
                <HelpItem title="Fractions" desc="Type 3/4 directly, or tap a digit then a /den button. Mixed numbers: type 3 then /4 for 3/4, or 1 then /8 for 1/8." />
                <HelpItem title="Keyboard" desc="0–9 digits · + − * / operators · Enter or = · Esc clear · ' feet · &quot; inches · R √ · P π · Backspace delete" />
                <HelpItem title="Memory" desc="M+ add to memory · M− subtract · MR recall · MC clear" />
                <HelpItem title="Tape" desc="Tap any tape row to recall that result. Clear wipes the tape history." />
              </div>
            </ConPanel>
          )}
        </div>
      </div>

      {/* ── Right/Bottom: Tape ── */}
      <div className="cm-right">
        <div className="cm-tape-header">
          <span>CALCULATION TAPE</span>
          <button onClick={() => setHistory([])} style={{ background: 'none', border: 'none', color: 'var(--c-text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--tape-font)' }}>
            [CLEAR]
          </button>
        </div>
        <div className="cm-tape" style={{ flex: 1, maxWidth: '100%' }}>
          {history.length === 0 && (
            <div style={{ padding: '20px 10px', color: 'var(--calc-tape-dim)', fontFamily: 'var(--tape-font)', fontSize: 12, textAlign: 'center', opacity: 0.6 }}>
              — no calculations yet —<br />
              <span style={{ fontSize: 10 }}>tap any tape row to recall</span>
            </div>
          )}
          {history.map((h, i) => (
            <TapeRow key={h.ts} entry={h} onClick={() => {
              setResult(h.result); setLeft(h.result); setOp(null); setDisplay(''); setJustEvaled(true)
            }} />
          ))}
        </div>

        {/* Nearest fractions — bottom of tape panel */}
        {activeVal && (
          <div className="cm-conversions">
            <div className="label-caps" style={{ marginBottom: 6 }}>Nearest fractions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
              {[2,4,8,16].map(den => {
                const dec = fracToDecimal(activeVal)
                const { w, n, d } = inchToFrac(dec, den)
                return (
                  <div key={den} className="cm-conv-cell">
                    <div style={{ fontSize: 9, color: 'var(--c-text-faint)' }}>1/{den}"</div>
                    <strong style={{ fontSize: 12, fontFamily: 'var(--tape-font)' }}>{n === 0 ? `${w}"` : `${w > 0 ? w + ' ' : ''}${n}/${d}"`}</strong>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
